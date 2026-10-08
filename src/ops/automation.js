// ─────────────────────────────────────────────
// ⚙️ Automation Engine — تسکهای تکرارشونده و Workflowها
// ─────────────────────────────────────────────
import { kvGet, kvPut, kvDel, indexAdd, indexRemove, readMany, newId, nowIso } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { complete, completeJson } from "../gateway/router.js";
import { runAgent } from "../agents/runtime.js";
import { runTool } from "../agents/tools.js";
import { ctx } from "../core/ctx.js";

export const TASK_INDEX = "tasks:index";
export const WF_INDEX = "workflows:index";
const tKey = id => `task:${id}`;
const wKey = id => `workflow:${id}`;
const rKey = id => `wfrun:${id}`;

export const NODE_TYPES = {
  trigger: { label: "Trigger", inputs: 0 },
  agent: { label: "Agent" },
  model: { label: "Model" },
  search: { label: "Search" },
  tool: { label: "Tool" },
  condition: { label: "Condition" },
  transform: { label: "Transform" },
  file: { label: "File" },
  database: { label: "Database" },
  notification: { label: "Notification" },
  delay: { label: "Delay" }
};

// ── Scheduled / recurring tasks ───────────────
export async function listTasks(env, userId = null) {
  const ids = await kvGet(env, TASK_INDEX, []);
  const rows = await readMany(env, ids.map(tKey));
  return userId ? rows.filter(t => String(t.userId) === String(userId)) : rows;
}

export async function getTask(env, id) { return kvGet(env, tKey(id), null); }

// cron ساده: minute hour dom mon dow (فقط * و اعداد و */n)
export function cronMatches(expr, date, tzOffsetMin = 0) {
  const d = new Date(date.getTime() + tzOffsetMin * 60000);
  const fields = String(expr || "* * * * *").trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const vals = [d.getUTCMinutes(), d.getUTCHours(), d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCDay()];
  return fields.every((f, i) => matchField(f, vals[i]));
}

function matchField(f, v) {
  if (f === "*") return true;
  for (const part of f.split(",")) {
    if (part.startsWith("*/")) { const n = Number(part.slice(2)); if (n > 0 && v % n === 0) return true; continue; }
    if (part.includes("-")) { const [a, b] = part.split("-").map(Number); if (v >= a && v <= b) return true; continue; }
    if (Number(part) === v) return true;
  }
  return false;
}

export async function createTask(env, input, userId = 0) {
  const task = {
    id: newId("task"),
    userId,
    chatId: input.chatId || userId,
    name: String(input.name || "Task").slice(0, 80),
    cron: String(input.cron || "0 8 * * *"),
    tzOffsetMin: Number(input.tzOffsetMin || 0),
    kind: input.kind || "agent",              // agent | workflow | tool | prompt
    agentId: input.agentId || "builtin:master",
    workflowId: input.workflowId || null,
    tool: input.tool || null,
    toolArgs: input.toolArgs || {},
    prompt: String(input.prompt || input.goal || "").slice(0, 2000),
    enabled: input.enabled !== false,
    lastRun: null, lastResult: null, runs: 0,
    createdAt: nowIso()
  };
  await kvPut(env, tKey(task.id), task);
  await indexAdd(env, TASK_INDEX, task.id);
  await audit(env, { userId, action: "task.create", resource: task.id, meta: { name: task.name, cron: task.cron } });
  return task;
}

export async function updateTask(env, id, patch, userId = 0) {
  const t = await getTask(env, id);
  if (!t) throw new Error("تسک یافت نشد");
  Object.assign(t, patch, { updatedAt: nowIso() });
  await kvPut(env, tKey(id), t);
  await audit(env, { userId, action: "task.update", resource: id });
  return t;
}

export async function deleteTask(env, id, userId = 0) {
  await kvDel(env, tKey(id));
  await indexRemove(env, TASK_INDEX, id);
  await audit(env, { userId, action: "task.delete", resource: id });
  return true;
}

// تبدیل زبان طبیعی به تسک ساختاریافته
export async function taskFromNaturalLanguage(env, text, { userId = 0, chatId = null, tzOffsetMin = 0 } = {}) {
  const { json } = await completeJson(env,
    `Convert this automation request into JSON.\n\nRequest: """${String(text).slice(0, 1000)}"""\n\nReturn ONLY: {"name":"short name","cron":"m h dom mon dow","goal":"complete instruction for an AI agent","kind":"agent"}\nUse 5-field cron in the USER'S LOCAL TIME. Examples: every morning 8am -> "0 8 * * *"; every 6 hours -> "0 */6 * * *"; every Monday 9am -> "0 9 * * 1"; every day -> "0 9 * * *".`,
    { system: "You convert natural language schedules into JSON. Output strict JSON only.", maxTokens: 400, temperature: 0, task: "data" });
  return createTask(env, {
    name: json.name, cron: json.cron, prompt: json.goal, kind: "agent",
    chatId, tzOffsetMin
  }, userId);
}

export async function runTask(env, task, { notify } = {}) {
  const t0 = Date.now();
  let output = "", ok = true, error = null;
  try {
    if (task.kind === "workflow" && task.workflowId) {
      const run = await runWorkflow(env, task.workflowId, { userId: task.userId, input: task.prompt });
      output = run.output || run.status;
    } else if (task.kind === "tool" && task.tool) {
      const r = await runTool(env, task.tool, task.toolArgs, { userId: task.userId, confirmed: false });
      ok = r.ok; error = r.error;
      output = JSON.stringify(r.result || r.error).slice(0, 3000);
    } else if (task.kind === "prompt") {
      const r = await complete(env, task.prompt, { userId: task.userId, maxTokens: 1500 });
      output = r.text;
    } else {
      const r = await runAgent(env, { agentId: task.agentId || "builtin:master", goal: task.prompt, userId: task.userId });
      output = r.answer;
    }
  } catch (e) {
    ok = false; error = String(e.message || e).slice(0, 300);
  }
  task.lastRun = nowIso();
  task.runs = (task.runs || 0) + 1;
  task.lastResult = { ok, ms: Date.now() - t0, error, preview: String(output).slice(0, 300) };
  await kvPut(env, tKey(task.id), task);
  if (notify && task.chatId) {
    await notify(task.chatId, ok
      ? `⏱ <b>${escapeH(task.name)}</b>\n\n${String(output).slice(0, 3500)}`
      : `⚠️ <b>${escapeH(task.name)}</b> اجرا نشد: ${escapeH(error || "خطای نامشخص")}`);
  }
  await audit(env, { userId: task.userId, action: "task.run", resource: task.id, result: ok ? "ok" : "fail" });
  return { ok, output, error };
}

function escapeH(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// اجرای همه تسکهای سررسیده (از cron هر دقیقه فراخوانی میشود)
export async function tickTasks(env, { notify, now = new Date(), max = 3 } = {}) {
  const tasks = (await listTasks(env)).filter(t => t.enabled);
  const due = tasks.filter(t => cronMatches(t.cron, now, t.tzOffsetMin) && (!t.lastRun || Date.now() - new Date(t.lastRun).getTime() > 55000));
  const ran = [];
  for (const t of due.slice(0, max)) {
    ran.push({ id: t.id, name: t.name, ...(await runTask(env, t, { notify })) });
  }
  return { due: due.length, ran: ran.length, results: ran };
}

// ─────────────────────────────────────────────
// 🔀 Workflows
// ─────────────────────────────────────────────
export async function listWorkflows(env, userId = null) {
  const ids = await kvGet(env, WF_INDEX, []);
  const rows = await readMany(env, ids.map(wKey));
  return userId ? rows.filter(w => String(w.userId) === String(userId)) : rows;
}

export async function getWorkflow(env, id) { return kvGet(env, wKey(id), null); }

export async function createWorkflow(env, input, userId = 0) {
  const wf = {
    id: newId("wf"),
    userId,
    name: String(input.name || "Workflow").slice(0, 80),
    description: String(input.description || "").slice(0, 300),
    nodes: (input.nodes || []).map(normalizeNode),
    edges: input.edges || [],
    enabled: input.enabled !== false,
    createdAt: nowIso(), runs: 0
  };
  await kvPut(env, wKey(wf.id), wf);
  await indexAdd(env, WF_INDEX, wf.id);
  await audit(env, { userId, action: "workflow.create", resource: wf.id, meta: { name: wf.name, nodes: wf.nodes.length } });
  return wf;
}

function normalizeNode(n) {
  return {
    id: n.id || newId("n"),
    type: NODE_TYPES[n.type] ? n.type : "model",
    label: String(n.label || NODE_TYPES[n.type]?.label || n.type).slice(0, 60),
    config: n.config || {},
    x: Number(n.x || 0), y: Number(n.y || 0)
  };
}

export async function updateWorkflow(env, id, patch, userId = 0) {
  const wf = await getWorkflow(env, id);
  if (!wf) throw new Error("workflow یافت نشد");
  if (patch.nodes) patch.nodes = patch.nodes.map(normalizeNode);
  Object.assign(wf, patch, { updatedAt: nowIso() });
  await kvPut(env, wKey(id), wf);
  await audit(env, { userId, action: "workflow.update", resource: id });
  return wf;
}

export async function deleteWorkflow(env, id, userId = 0) {
  await kvDel(env, wKey(id));
  await indexRemove(env, WF_INDEX, id);
  await audit(env, { userId, action: "workflow.delete", resource: id });
  return true;
}

// تبدیل زبان طبیعی به workflow
export async function workflowFromNaturalLanguage(env, text, userId = 0) {
  const { json } = await completeJson(env,
    `Design a workflow for this request.\n\nRequest: """${String(text).slice(0, 1200)}"""\n\nNode types: ${Object.keys(NODE_TYPES).join(", ")}\nReturn ONLY JSON: {"name":"...","description":"...","nodes":[{"id":"n1","type":"trigger","label":"...","config":{}}],"edges":[{"from":"n1","to":"n2"}]}\nFor 'search' nodes use config {"query":"..."}; for 'agent' use {"agentId":"builtin:research","goal":"..."}; for 'model' use {"prompt":"... use {{input}} for previous output"}; for 'tool' use {"tool":"name","args":{}}; for 'condition' use {"expression":"contains:word"}; for 'notification' use {"message":"..."}.`,
    { system: "You are a workflow designer. Output strict JSON only.", maxTokens: 900, temperature: 0.2, task: "data" });
  return createWorkflow(env, json, userId);
}

// اجرای workflow (گراف خطی/شرطی سبک)
export async function runWorkflow(env, id, { userId = 0, input = "", onUpdate, notify, chatId } = {}) {
  const wf = await getWorkflow(env, id);
  if (!wf) throw new Error("workflow یافت نشد");
  const runId = newId("wfrun");
  const run = { id: runId, workflowId: id, name: wf.name, startedAt: nowIso(), status: "running", steps: [], userId };
  await kvPut(env, rKey(runId), run);

  const order = topoOrder(wf);
  let data = input;
  for (const node of order) {
    const step = { node: node.id, type: node.type, label: node.label, status: "running", ts: nowIso() };
    run.steps.push(step);
    if (onUpdate) await onUpdate(run);
    try {
      const res = await execNode(env, node, data, { userId, notify, chatId: chatId || userId });
      if (res?.stop) { step.status = "skip"; step.detail = "شرط برقرار نبود"; break; }
      data = res?.output ?? data;
      step.status = "done";
      step.preview = String(data).slice(0, 200);
    } catch (e) {
      step.status = "fail";
      step.detail = String(e.message || e).slice(0, 200);
      run.status = "failed";
      run.error = step.detail;
      break;
    }
    await kvPut(env, rKey(runId), run);
  }
  if (run.status !== "failed") run.status = "done";
  run.finishedAt = nowIso();
  run.output = String(data).slice(0, 8000);
  await kvPut(env, rKey(runId), run);
  wf.runs = (wf.runs || 0) + 1;
  wf.lastRun = nowIso();
  await kvPut(env, wKey(id), wf);
  await audit(env, { userId, action: "workflow.run", resource: id, result: run.status });
  return run;
}

function topoOrder(wf) {
  const nodes = wf.nodes || [];
  if (!nodes.length) return [];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const incoming = new Map(nodes.map(n => [n.id, 0]));
  for (const e of wf.edges || []) incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
  const queue = nodes.filter(n => (incoming.get(n.id) || 0) === 0).map(n => n.id);
  const seen = new Set(), out = [];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const n = byId.get(id);
    if (n) out.push(n);
    for (const e of (wf.edges || []).filter(x => x.from === id)) {
      incoming.set(e.to, (incoming.get(e.to) || 1) - 1);
      if ((incoming.get(e.to) || 0) <= 0) queue.push(e.to);
    }
  }
  for (const n of nodes) if (!seen.has(n.id)) out.push(n);
  return out;
}

async function execNode(env, node, data, { userId, notify, chatId }) {
  const cfg = node.config || {};
  const fill = s => String(s || "").replace(/\{\{input\}\}/g, String(data || ""));
  switch (node.type) {
    case "trigger":
      return { output: data || fill(cfg.value || "") };
    case "search": {
      const r = await runTool(env, "web_search", { query: fill(cfg.query || data), max: cfg.max || 6 }, { userId });
      if (!r.ok) throw new Error(r.error);
      return { output: (r.result.results || []).map((x, i) => `[${i + 1}] ${x.title}\n${x.url}\n${x.snippet}`).join("\n\n") };
    }
    case "tool": {
      const args = { ...(cfg.args || {}) };
      for (const k of Object.keys(args)) if (typeof args[k] === "string") args[k] = fill(args[k]);
      const r = await runTool(env, cfg.tool, args, { userId, confirmed: !!cfg.confirmed });
      if (!r.ok) throw new Error(r.error);
      return { output: typeof r.result === "string" ? r.result : JSON.stringify(r.result) };
    }
    case "agent": {
      const r = await runAgent(env, { agentId: cfg.agentId || "builtin:master", goal: fill(cfg.goal || cfg.prompt || data), userId });
      return { output: r.answer };
    }
    case "model": {
      const r = await complete(env, fill(cfg.prompt || data), { system: cfg.system, maxTokens: cfg.maxTokens || 1200, modelId: cfg.modelId, task: cfg.task, userId });
      return { output: r.text };
    }
    case "transform": {
      const r = await complete(env, `${fill(cfg.instruction || "Summarize concisely")}\n\nInput:\n${String(data).slice(0, 8000)}`, { maxTokens: cfg.maxTokens || 1200, userId });
      return { output: r.text };
    }
    case "condition": {
      const expr = String(cfg.expression || "");
      const text = String(data || "");
      let pass = true;
      if (expr.startsWith("contains:")) pass = text.toLowerCase().includes(expr.slice(9).toLowerCase());
      else if (expr.startsWith("regex:")) pass = new RegExp(expr.slice(6), "i").test(text);
      else if (expr.startsWith("minLength:")) pass = text.length >= Number(expr.slice(10));
      return pass ? { output: data } : { stop: true };
    }
    case "database": {
      const r = await runTool(env, "d1_query", { sql: fill(cfg.sql) }, { userId });
      if (!r.ok) throw new Error(r.error);
      return { output: JSON.stringify(r.result.rows) };
    }
    case "file":
      return { output: data };
    case "notification": {
      const msg = fill(cfg.message || "{{input}}");
      if (notify && chatId) await notify(chatId, msg.slice(0, 3800));
      return { output: data };
    }
    case "delay":
      await new Promise(r => setTimeout(r, Math.min(5000, Number(cfg.ms || 1000))));
      return { output: data };
    default:
      return { output: data };
  }
}

export async function getWorkflowRun(env, id) { return kvGet(env, rKey(id), null); }
