// ─────────────────────────────────────────────
// 🤖 Agent Runtime — Planner، Tool Executor، Multi-Agent، Self-Correction
// خروجی فقط خلاصه اجرای امن است (بدون chain-of-thought خام)
// ─────────────────────────────────────────────
import { kvGet, kvPut, kvDel, indexAdd, indexRemove, readMany, newId, nowIso } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { route, complete, completeJson, classifyTask } from "../gateway/router.js";
import { listTools, runTool, toolSchemas, getTool } from "./tools.js";

export const AGENT_INDEX = "agents:index";
const aKey = id => `agent:${id}`;
const runKey = id => `agentrun:${id}`;
export const RUN_INDEX = "agentruns:index";

// ── عاملهای پیشفرض ────────────────────────────
export const BUILTIN_AGENTS = {
  master: {
    name: "Master Agent",
    description: "هدف را تحلیل و به عاملهای تخصصی واگذار میکند",
    systemPrompt: "You are the master orchestrator of PIMXAGENT. Break goals into steps, delegate to specialist agents/tools, verify results and produce a final answer. Be concise and factual. Never fabricate data.",
    tools: ["web_search", "fetch_page", "calculator", "list_models", "memory_search", "ai_council"],
    task: "reasoning", maxSteps: 8
  },
  research: {
    name: "Research Agent",
    description: "تحقیق چندمرحلهای با منابع و راستیآزمایی",
    systemPrompt: "You are a rigorous research agent. Search, read sources, cross-check claims, cite URLs, and clearly flag uncertainty. Never invent sources.",
    tools: ["web_search", "fetch_page"],
    task: "research", maxSteps: 10
  },
  coding: {
    name: "Coding Agent",
    description: "تولید، دیباگ و بازآرایی کد",
    systemPrompt: "You are an expert software engineer. Produce complete, correct, secure code. Explain briefly. Prefer standard libraries and existing project conventions.",
    tools: ["code_analysis", "github_repo", "fetch_page"],
    task: "coding", maxSteps: 6
  },
  security: {
    name: "Security Agent",
    description: "بررسی امنیتی کد و پیکربندی",
    systemPrompt: "You are a security auditor. Identify vulnerabilities with severity, evidence and concrete fixes. Do not guess: base findings on the provided code and tool output.",
    tools: ["code_analysis", "github_repo"],
    task: "coding", maxSteps: 5
  },
  data: {
    name: "Data Analyst",
    description: "تحلیل داده CSV/JSON و آمار",
    systemPrompt: "You are a data analyst. Use the data_analyze tool for real numbers; never estimate statistics yourself. Explain findings in plain language.",
    tools: ["data_analyze", "calculator"],
    task: "data", maxSteps: 6
  },
  factcheck: {
    name: "Fact Checker",
    description: "بررسی صحت ادعا با شواهد و درجه اطمینان",
    systemPrompt: "You are a fact checker. Identify the claim, gather independent evidence, compare sources, detect contradictions, then output a verdict (true/false/partly true/unverifiable) with a confidence percentage and citations.",
    tools: ["web_search", "fetch_page"],
    task: "research", maxSteps: 8
  },
  api: {
    name: "API Agent",
    description: "عیبیابی و مدیریت پروایدرها/مدلها",
    systemPrompt: "You manage AI infrastructure. Use tools to inspect real registry data and diagnose endpoints. Never invent model names, latency or health values.",
    tools: ["provider_diagnose", "list_models", "http_request"],
    task: "chat", maxSteps: 6
  },
  writer: {
    name: "Writer Agent",
    description: "تولید محتوای نوشتاری",
    systemPrompt: "You are a professional writer. Match the requested tone, structure and language. Be vivid but accurate.",
    tools: [],
    task: "writing", maxSteps: 3
  },
  vision: {
    name: "Vision Agent",
    description: "تحلیل تصویر و استخراج متن",
    systemPrompt: "You analyze images precisely: describe content, extract text verbatim when asked, and state what is unclear.",
    tools: [],
    task: "vision", maxSteps: 3
  }
};

export async function listAgents(env) {
  const ids = await kvGet(env, AGENT_INDEX, []);
  const custom = await readMany(env, ids.map(aKey));
  const builtins = Object.entries(BUILTIN_AGENTS).map(([key, a]) => ({
    id: `builtin:${key}`, key, builtin: true, enabled: true,
    ...a, preferredModels: [], memory: true, knowledge: true
  }));
  return [...builtins, ...custom];
}

export async function getAgent(env, id) {
  if (String(id).startsWith("builtin:")) {
    const key = String(id).slice(8);
    const a = BUILTIN_AGENTS[key];
    return a ? { id, key, builtin: true, enabled: true, preferredModels: [], memory: true, knowledge: true, ...a } : null;
  }
  return kvGet(env, aKey(id), null);
}

export async function createAgent(env, input, userId = 0) {
  const agent = {
    id: newId("agent"),
    name: String(input.name || "Agent").slice(0, 60),
    description: String(input.description || "").slice(0, 300),
    systemPrompt: String(input.systemPrompt || "").slice(0, 4000),
    preferredModels: input.preferredModels || [],
    tools: (input.tools || []).filter(t => getTool(t)),
    task: input.task || "chat",
    memory: input.memory !== false,
    knowledge: input.knowledge !== false,
    permissions: input.permissions || ["read"],
    budget: Number(input.budget || 0),
    maxSteps: Math.min(20, Number(input.maxSteps || 6)),
    enabled: input.enabled !== false,
    createdAt: nowIso(), createdBy: userId, runs: 0
  };
  await kvPut(env, aKey(agent.id), agent);
  await indexAdd(env, AGENT_INDEX, agent.id);
  await audit(env, { userId, action: "agent.create", resource: agent.id, meta: { name: agent.name } });
  return agent;
}

export async function updateAgent(env, id, patch, userId = 0) {
  const a = await getAgent(env, id);
  if (!a) throw new Error("عامل یافت نشد");
  if (a.builtin) throw new Error("عاملهای پیشفرض قابل ویرایش نیستند — ابتدا کپی بگیرید");
  const next = { ...a };
  for (const k of ["name", "description", "systemPrompt", "task", "enabled", "memory", "knowledge", "budget"]) {
    if (patch[k] !== undefined) next[k] = patch[k];
  }
  if (patch.tools) next.tools = patch.tools.filter(t => getTool(t));
  if (patch.preferredModels) next.preferredModels = patch.preferredModels;
  if (patch.maxSteps) next.maxSteps = Math.min(20, Number(patch.maxSteps));
  next.updatedAt = nowIso();
  await kvPut(env, aKey(id), next);
  await audit(env, { userId, action: "agent.update", resource: id });
  return next;
}

export async function duplicateAgent(env, id, userId = 0) {
  const a = await getAgent(env, id);
  if (!a) throw new Error("عامل یافت نشد");
  return createAgent(env, { ...a, name: `${a.name} (Copy)` }, userId);
}

export async function deleteAgent(env, id, userId = 0) {
  if (String(id).startsWith("builtin:")) throw new Error("عامل پیشفرض حذف نمیشود");
  await kvDel(env, aKey(id));
  await indexRemove(env, AGENT_INDEX, id);
  await audit(env, { userId, action: "agent.delete", resource: id });
  return true;
}

// ── Execution timeline ────────────────────────
class Timeline {
  constructor(onUpdate) { this.steps = []; this.onUpdate = onUpdate; }
  async add(label, status = "running", detail = "") {
    const s = { label, status, detail: String(detail).slice(0, 200), ts: nowIso() };
    this.steps.push(s);
    if (this.onUpdate) await this.onUpdate(this.render(), this.steps);
    return s;
  }
  async finish(step, status = "done", detail = "") {
    step.status = status;
    if (detail) step.detail = String(detail).slice(0, 200);
    if (this.onUpdate) await this.onUpdate(this.render(), this.steps);
  }
  render() {
    const icon = s => ({ running: "◌", done: "✓", fail: "✗", skip: "–" })[s.status] || "•";
    return this.steps.map(s => `${icon(s)} ${s.label}${s.detail ? ` — ${s.detail}` : ""}`).join("\n");
  }
}

// ── Planner ───────────────────────────────────
export async function makePlan(env, goal, agent, availableTools) {
  const toolList = availableTools.map(t => `- ${t.name}: ${t.description}`).join("\n") || "- (none)";
  const prompt = `Goal: ${goal}\n\nAvailable tools:\n${toolList}\n\nReturn ONLY JSON:\n{"complex":true|false,"steps":[{"title":"short step title","tool":"tool_name or null","why":"one short clause"}],"final":"what the final deliverable should be"}\nMax 6 steps. If the goal is a simple question, set complex=false with a single step.`;
  try {
    const { json } = await completeJson(env, prompt, { system: "You are a planning module. Output strict JSON only.", maxTokens: 700, temperature: 0.2, task: "reasoning" });
    const steps = Array.isArray(json.steps) ? json.steps.slice(0, 6) : [];
    return { complex: !!json.complex && steps.length > 1, steps, final: json.final || "" };
  } catch {
    return { complex: false, steps: [{ title: "پاسخ مستقیم", tool: null }], final: "" };
  }
}

// ── Agent run ─────────────────────────────────
export async function runAgent(env, { agentId = "builtin:master", goal, userId = 0, onUpdate, context = "", maxSteps, confirmDangerous = false }) {
  const agent = await getAgent(env, agentId);
  if (!agent) throw new Error("عامل یافت نشد");
  const runId = newId("run");
  const timeline = new Timeline(onUpdate);
  const budgetSteps = Math.min(agent.maxSteps || 6, maxSteps || agent.maxSteps || 6);
  const tools = listTools({ includeDangerous: confirmDangerous }).filter(t => !agent.tools?.length || agent.tools.includes(t.name));
  const run = {
    id: runId, agentId, agentName: agent.name, goal: String(goal).slice(0, 2000),
    userId, startedAt: nowIso(), status: "running", steps: [], toolCalls: [], cost: 0, tokens: 0
  };
  await kvPut(env, runKey(runId), run);
  await indexAdd(env, RUN_INDEX, runId);

  const planStep = await timeline.add("برنامهریزی");
  const plan = await makePlan(env, goal, agent, tools);
  await timeline.finish(planStep, "done", plan.complex ? `${plan.steps.length} مرحله` : "پاسخ مستقیم");
  run.plan = plan;

  const findings = [];
  let totalCost = 0, totalTokens = 0;

  // اجرای ابزارها بر اساس پلن (با self-correction)
  if (plan.complex) {
    for (const step of plan.steps.slice(0, budgetSteps)) {
      const st = await timeline.add(step.title || "مرحله");
      if (!step.tool || !tools.find(t => t.name === step.tool)) {
        await timeline.finish(st, "skip", "ابزار لازم نبود");
        continue;
      }
      const argsRes = await buildToolArgs(env, step, goal, findings, tools.find(t => t.name === step.tool));
      let result = await runTool(env, step.tool, argsRes, { userId, confirmed: confirmDangerous });
      let attempt = 1;
      while (!result.ok && attempt < 3 && !result.needsConfirmation) {
        const fixed = await repairToolArgs(env, step, goal, argsRes, result.error, tools.find(t => t.name === step.tool));
        if (!fixed) break;
        result = await runTool(env, step.tool, fixed, { userId, confirmed: confirmDangerous });
        attempt++;
      }
      run.toolCalls.push({ tool: step.tool, ok: result.ok, ms: result.ms, error: result.error || null, attempts: attempt });
      if (result.ok) {
        findings.push({ step: step.title, tool: step.tool, data: truncate(result.result) });
        await timeline.finish(st, "done", "");
      } else {
        await timeline.finish(st, "fail", result.error || "ناموفق");
      }
      await kvPut(env, runKey(runId), { ...run, steps: timeline.steps });
    }
  }

  // سنتز نهایی
  const synthStep = await timeline.add("تولید پاسخ نهایی");
  const evidence = findings.length
    ? `\n\nTool findings (real data — use only this, do not invent):\n${findings.map((f, i) => `[${i + 1}] ${f.tool} → ${JSON.stringify(f.data).slice(0, 2500)}`).join("\n")}`
    : "";
  const system = `${agent.systemPrompt}\n\nRules: cite sources when available, state uncertainty explicitly, never fabricate numbers or URLs. Answer in the user's language (Persian if the request is Persian).`;
  let final;
  try {
    final = await complete(env, `${context ? `Context:\n${context}\n\n` : ""}Goal: ${goal}${evidence}${plan.final ? `\n\nDeliverable: ${plan.final}` : ""}`, {
      system, task: agent.task || classifyTask(goal), maxTokens: 2600, temperature: 0.5, userId,
      modelId: agent.preferredModels?.[0]
    });
    await timeline.finish(synthStep, "done", final.displayName || final.model);
  } catch (e) {
    await timeline.finish(synthStep, "fail", String(e.message || e).slice(0, 120));
    run.status = "failed";
    run.error = String(e.message || e);
    run.finishedAt = nowIso();
    run.steps = timeline.steps;
    await kvPut(env, runKey(runId), run);
    throw e;
  }
  totalCost += final.cost || 0;
  totalTokens += (final.promptTokens || 0) + (final.completionTokens || 0);

  run.status = "done";
  run.finishedAt = nowIso();
  run.steps = timeline.steps;
  run.answer = final.text;
  run.model = final.model;
  run.cost = totalCost;
  run.tokens = totalTokens;
  await kvPut(env, runKey(runId), run);
  await audit(env, { userId, action: "agent.run", resource: agentId, meta: { runId, tools: run.toolCalls.length, model: final.model } });

  if (!agent.builtin) {
    const a = await getAgent(env, agentId);
    if (a) { a.runs = (a.runs || 0) + 1; await kvPut(env, aKey(agentId), a); }
  }

  return {
    runId, answer: final.text, model: final.model, displayName: final.displayName,
    timeline: timeline.render(), steps: timeline.steps, toolCalls: run.toolCalls,
    plan, cost: totalCost, tokens: totalTokens, latency: final.latency,
    sources: extractSources(findings)
  };
}

function truncate(data) {
  const s = JSON.stringify(data ?? null);
  if (s.length <= 4000) return data;
  try { return JSON.parse(s.slice(0, 4000) + (s.endsWith("}") ? "}" : "")); } catch { return s.slice(0, 4000); }
}

function extractSources(findings) {
  const out = [];
  for (const f of findings) {
    const d = f.data;
    if (d?.results) for (const r of d.results) if (r.url) out.push({ title: r.title || r.url, uri: r.url });
    if (d?.url) out.push({ title: d.title || d.url, uri: d.url });
  }
  const seen = new Set();
  return out.filter(s => !seen.has(s.uri) && seen.add(s.uri)).slice(0, 8);
}

async function buildToolArgs(env, step, goal, findings, tool) {
  if (!tool) return {};
  const props = Object.keys(tool.input?.properties || {});
  // مسیر سریع برای ابزارهای تکپارامتری
  if (props.length === 1 && ["query", "expression", "code", "data", "url", "repo", "sql"].includes(props[0])) {
    if (props[0] === "query") return { query: `${goal}`.slice(0, 300) };
  }
  const prompt = `Tool: ${tool.name}\nDescription: ${tool.description}\nJSON schema: ${JSON.stringify(tool.input)}\nGoal: ${goal}\nStep: ${step.title}\nPrior findings: ${JSON.stringify(findings).slice(0, 1200)}\n\nReturn ONLY the JSON arguments object for this tool.`;
  try {
    const { json } = await completeJson(env, prompt, { system: "Output strict JSON arguments only.", maxTokens: 400, temperature: 0.1, task: "data" });
    return json;
  } catch {
    return props.includes("query") ? { query: String(goal).slice(0, 300) } : {};
  }
}

async function repairToolArgs(env, step, goal, prevArgs, error, tool) {
  try {
    const { json } = await completeJson(env,
      `The tool call failed.\nTool: ${tool.name}\nSchema: ${JSON.stringify(tool.input)}\nArguments used: ${JSON.stringify(prevArgs)}\nError: ${error}\nGoal: ${goal}\n\nReturn ONLY corrected JSON arguments.`,
      { system: "Output strict JSON only.", maxTokens: 300, temperature: 0.1, task: "data" });
    return json;
  } catch { return null; }
}

export async function getRun(env, id) { return kvGet(env, runKey(id), null); }

export async function listRuns(env, limit = 20) {
  const ids = (await kvGet(env, RUN_INDEX, [])).slice(-limit).reverse();
  const rows = await readMany(env, ids.map(runKey));
  return rows.map(r => ({
    id: r.id, agentName: r.agentName, goal: (r.goal || "").slice(0, 120), status: r.status,
    startedAt: r.startedAt, finishedAt: r.finishedAt, model: r.model, tools: r.toolCalls?.length || 0, cost: r.cost
  }));
}

// تحقیق چندمرحلهای اختصاصی (Question → Search → Verify → Report)
export async function researchReport(env, topic, { userId = 0, onUpdate, depth = 3 } = {}) {
  return runAgent(env, {
    agentId: "builtin:research",
    goal: `Produce a well-structured research report about: ${topic}. Include key facts, current developments, at least ${depth} independent sources with URLs, contradictions if any, and a short conclusion.`,
    userId, onUpdate
  });
}

export async function factCheck(env, claim, { userId = 0, onUpdate } = {}) {
  return runAgent(env, {
    agentId: "builtin:factcheck",
    goal: `Fact-check this claim and output: Verdict, Confidence %, Evidence with URLs, and what remains uncertain.\n\nClaim: ${claim}`,
    userId, onUpdate
  });
}
