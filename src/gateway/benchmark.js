import { pxText, pxTemplate } from '../i18n/server.js';
// ─────────────────────────────────────────────
// 🏁 Benchmark Engine — اجرای واقعی پرامپتهای استاندارد و امتیازدهی
// ─────────────────────────────────────────────
import { kvGet, kvPut, indexAdd, newId, nowIso, readMany } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { getProvider } from "./providers.js";
import { callChat } from "./client.js";
import { getModel, saveModel, estimateCost, scoreModel, getWeights, listModels } from "./models.js";

export const BENCH_INDEX = "benchmarks:index";
const bKey = id => `benchmark:${id}`;

export const BENCH_TASKS = {
  factual: {
    label: "Factual",
    prompt: "What is the capital of Australia? Answer with the city name only.",
    opts: { maxTokens: 20, temperature: 0 },
    score: t => /canberra/i.test(t) ? 100 : 0
  },
  reasoning: {
    label: "Reasoning",
    prompt: "If 3 machines make 3 widgets in 3 minutes, how long do 100 machines take to make 100 widgets? Answer with the number of minutes only.",
    opts: { maxTokens: 200, temperature: 0 },
    score: t => /\b3\b|three/i.test(t) ? 100 : 0
  },
  math: {
    label: "Math",
    prompt: "Compute (17*23) + (144/12) - 5. Answer with the number only.",
    opts: { maxTokens: 120, temperature: 0 },
    score: t => /\b398\b/.test(t.replace(/[,٬]/g, "")) ? 100 : 0
  },
  coding: {
    label: "Coding",
    prompt: "Write a JavaScript function isPalindrome(s) that ignores case and non-alphanumerics. Return only code.",
    opts: { maxTokens: 300, temperature: 0 },
    score: t => {
      let s = 0;
      if (/function\s+isPalindrome|const\s+isPalindrome/.test(t)) s += 40;
      if (/toLowerCase\(\)/.test(t)) s += 20;
      if (/replace\(|\[^a-z0-9\]|\\W/i.test(t)) s += 20;
      if (/reverse\(\)|for\s*\(|while\s*\(/.test(t)) s += 20;
      return s;
    }
  },
  json: {
    label: "JSON Compliance",
    prompt: 'Return ONLY valid minified JSON with keys name (string "pimx"), items (array of 3 numbers 1,2,3), ok (true). No prose.',
    opts: { maxTokens: 120, temperature: 0, json: true },
    score: t => {
      const m = t.match(/\{[\s\S]*\}/);
      if (!m) return 0;
      try {
        const j = JSON.parse(m[0]);
        let s = 40;
        if (j.name === "pimx") s += 20;
        if (Array.isArray(j.items) && j.items.join(",") === "1,2,3") s += 20;
        if (j.ok === true) s += 20;
        return s;
      } catch { return 10; }
    }
  },
  instruction: {
    label: "Instruction Following",
    prompt: "List exactly three fruits, one per line, each line starting with '- '. No other text.",
    opts: { maxTokens: 80, temperature: 0 },
    score: t => {
      const lines = t.trim().split("\n").map(l => l.trim()).filter(Boolean);
      let s = 0;
      if (lines.length === 3) s += 50;
      if (lines.every(l => l.startsWith("- "))) s += 50;
      return s;
    }
  },
  multilingual: {
    label: "Multilingual",
    prompt: "Translate into Persian, output only the translation: The weather is nice today.",
    opts: { maxTokens: 80, temperature: 0 },
    score: t => (/[\u0600-\u06FF]/.test(t) ? 70 : 0) + (/هوا|امروز/.test(t) ? 30 : 0)
  },
  longContext: {
    label: "Long Context",
    prompt: `Given this data:\n${Array.from({ length: 300 }, (_, i) => `k${i}=v${i}`).join("\n")}\n\nWhat is k271? Answer with the value only.`,
    opts: { maxTokens: 40, temperature: 0 },
    score: t => /v271/.test(t) ? 100 : 0
  },
  tools: {
    label: "Tool Calling",
    prompt: "Get the current stock price for AAPL using the available tool.",
    opts: {
      maxTokens: 120, temperature: 0,
      tools: [{ type: "function", function: { name: "get_stock", description: "Get stock price", parameters: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] } } }]
    },
    score: (t, res) => (res.toolCalls || []).some(c => c.name === "get_stock") ? 100 : 0
  }
};

export const QUICK_TASKS = ["factual", "json", "instruction"];
export const FULL_TASKS = Object.keys(BENCH_TASKS);

export async function benchmarkModel(env, modelId, tasks = QUICK_TASKS) {
  const model = await getModel(env, modelId);
  if (!model) throw new Error(pxText("مدل یافت نشد"));
  const provider = await getProvider(env, model.providerId);
  if (!provider) throw new Error(pxText("پروایدر یافت نشد"));

  const rows = [];
  for (const key of tasks) {
    const task = BENCH_TASKS[key];
    if (!task) continue;
    const t0 = Date.now();
    try {
      const res = await callChat(env, provider, model.apiModelId, [{ role: "user", content: task.prompt }], { ...task.opts, timeout: 45000 });
      const score = Math.max(0, Math.min(100, task.score(res.text || "", res)));
      rows.push({
        task: key, label: task.label, ok: true, score,
        latency: res.latency, promptTokens: res.promptTokens, completionTokens: res.completionTokens,
        cost: estimateCost(model, res.promptTokens, res.completionTokens),
        sample: (res.text || "").slice(0, 300)
      });
    } catch (e) {
      rows.push({ task: key, label: task.label, ok: false, score: 0, latency: null, error: String(e.message || e).slice(0, 200), ms: Date.now() - t0, cost: 0 });
    }
  }

  const okRows = rows.filter(r => r.ok);
  const report = {
    modelId: model.id,
    model: model.apiModelId,
    displayName: model.displayName,
    providerId: model.providerId,
    providerName: model.providerName,
    ts: nowIso(),
    tasks: rows,
    qualityScore: rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0,
    successRate: rows.length ? Math.round((okRows.length / rows.length) * 100) : 0,
    avgLatency: okRows.length ? Math.round(okRows.reduce((a, r) => a + (r.latency || 0), 0) / okRows.length) : null,
    tokensIn: rows.reduce((a, r) => a + (r.promptTokens || 0), 0),
    tokensOut: rows.reduce((a, r) => a + (r.completionTokens || 0), 0),
    cost: rows.reduce((a, r) => a + (r.cost || 0), 0),
    byTask: Object.fromEntries(rows.map(r => [r.task, r.score]))
  };

  model.benchmarks = [report, ...(model.benchmarks || [])].slice(0, 5);
  if (report.avgLatency) model.latency = report.avgLatency;
  if (report.successRate === 0) model.status = "failed";
  else if (model.status === "unknown") model.status = report.successRate === 100 ? "healthy" : "degraded";
  await saveModel(env, model);
  return report;
}

export async function runBenchmark(env, { modelIds, tasks = QUICK_TASKS, label = "", concurrency = 3, onProgress, userId = 0 }) {
  const id = newId("bench");
  const run = {
    id, label: label || `Benchmark ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    tasks, modelIds, startedAt: nowIso(), status: "running", reports: [], userId
  };
  await kvPut(env, bKey(id), run);
  await indexAdd(env, BENCH_INDEX, id);

  for (let i = 0; i < modelIds.length; i += concurrency) {
    const batch = modelIds.slice(i, i + concurrency);
    const reports = await Promise.all(batch.map(async mid => {
      try { return await benchmarkModel(env, mid, tasks); }
      catch (e) { return { modelId: mid, error: String(e.message || e), qualityScore: 0, successRate: 0, tasks: [] }; }
    }));
    run.reports.push(...reports);
    await kvPut(env, bKey(id), run);
    if (onProgress) await onProgress({ done: run.reports.length, total: modelIds.length, run });
  }

  const weights = await getWeights(env);
  const all = await listModels(env);
  for (const r of run.reports) {
    const m = all.find(x => x.id === r.modelId);
    if (m) r.score = scoreModel({ ...m, benchmarks: [r] }, weights, all);
  }
  run.reports.sort((a, b) => (b.score?.overall || b.qualityScore || 0) - (a.score?.overall || a.qualityScore || 0));
  run.status = "done";
  run.finishedAt = nowIso();
  run.winner = run.reports[0] ? { modelId: run.reports[0].modelId, model: run.reports[0].model, score: run.reports[0].score?.overall ?? run.reports[0].qualityScore } : null;
  await kvPut(env, bKey(id), run);
  await audit(env, { userId, action: "benchmark.run", resource: id, meta: { models: modelIds.length, tasks: tasks.length, winner: run.winner?.model } });
  return run;
}

export async function getBenchmark(env, id) { return kvGet(env, bKey(id), null); }

export async function listBenchmarks(env, limit = 20) {
  const ids = (await kvGet(env, BENCH_INDEX, [])).slice(-limit).reverse();
  const rows = await readMany(env, ids.map(bKey));
  return rows.map(r => ({
    id: r.id, label: r.label, status: r.status, startedAt: r.startedAt, finishedAt: r.finishedAt,
    models: r.modelIds?.length || 0, tasks: r.tasks, winner: r.winner
  }));
}

export async function compareModels(env, modelIds, tasks = QUICK_TASKS) {
  const weights = await getWeights(env);
  const all = await listModels(env);
  const rows = [];
  for (const id of modelIds) {
    const m = all.find(x => x.id === id);
    if (!m) continue;
    let report = m.benchmarks?.[0];
    if (!report) report = await benchmarkModel(env, id, tasks);
    rows.push({
      modelId: m.id, model: m.apiModelId, displayName: m.displayName, provider: m.providerName,
      latency: m.latency, cost: m.pricing, status: m.status,
      capabilities: Object.fromEntries(Object.entries(m.capabilities || {}).map(([k, v]) => [k, v.supported])),
      byTask: report?.byTask || {}, quality: report?.qualityScore ?? null,
      score: scoreModel(m, weights, all)
    });
  }
  return rows;
}
