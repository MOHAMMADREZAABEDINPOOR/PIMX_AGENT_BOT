// ─────────────────────────────────────────────
// 🗣 Natural Language Infrastructure Control
// دستور زبان طبیعی → عملیات واقعی روی رجیستری (با تأیید برای عملیات مخرب)
// ─────────────────────────────────────────────
import { kvGet, kvPut, kvDel, newId, nowIso } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { completeJson } from "../gateway/router.js";
import {
  listProviders, getProvider, createProvider, updateProvider, deleteProvider,
  bulkCreateProviders, parseKeys, publicProvider, providerHealth, normalizeBaseUrl
} from "../gateway/providers.js";
import {
  listModels, getModel, deleteModel, upsertModel, testModels, testModel,
  costPer1M, scoreModel, getWeights, saveModel, DEFAULT_TESTS, CAPABILITIES
} from "../gateway/models.js";
import { discoverModels } from "../gateway/models.js";
import { runBenchmark, QUICK_TASKS } from "../gateway/benchmark.js";
import { setRoutingConfig, getRoutingConfig, addRule } from "../gateway/router.js";
import { diagnose } from "../gateway/doctor.js";

// عملیات پشتیبانیشده
export const INTENTS = [
  "provider.add", "provider.bulkAdd", "provider.delete", "provider.list", "provider.enable", "provider.disable", "provider.test", "provider.rename",
  "model.discover", "model.add", "model.list", "model.test", "model.testAll", "model.delete", "model.deleteUnhealthy",
  "model.enable", "model.disable", "model.setDefault", "model.cheapest", "model.fastest", "model.best", "model.compare", "model.benchmark",
  "routing.policy", "routing.rule", "routing.failover",
  "monitor.status", "usage.report", "doctor.run", "none"
];

const CONFIRM_INTENTS = new Set([
  "provider.delete", "model.delete", "model.deleteUnhealthy", "provider.disable", "model.disable"
]);

// ── تشخیص سریع با regex (بدون هزینه مدل) ─────
export function quickIntent(text) {
  const t = String(text || "").trim();
  const l = t.toLowerCase();
  const urls = t.match(/https?:\/\/[^\s]+/g) || [];
  const keys = t.match(/\b(sk-[A-Za-z0-9-_]{12,}|nvapi-[A-Za-z0-9-_]{12,}|gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|[A-Za-z0-9]{32,})\b/g) || [];

  if (/^(add provider|\/provider add|افزودن پروایدر|پروایدر جدید|اضافه کردن پروایدر)/.test(l) || /^add (an? )?(ai )?provider/.test(l))
    return { intent: "provider.add", args: { baseUrl: urls[0], apiKey: keys[0] }, confidence: 0.95 };
  if (/(bulk|چندتایی|چند کلید|این ۱۰|these \d+ keys|import .*keys)/.test(l) && (urls.length || keys.length > 1))
    return { intent: "provider.bulkAdd", args: { baseUrl: urls[0], keys }, confidence: 0.85 };
  if (/^(list |show )?(providers|پروایدرها)$|^\/providers?$/.test(l))
    return { intent: "provider.list", args: {}, confidence: 0.9 };
  if (/(delete|remove|حذف).*(provider|پروایدر)/.test(l))
    return { intent: "provider.delete", args: { name: extractQuoted(t) }, confidence: 0.8 };
  if (/(discover|import).*(models|مدل)|(همه )?مدل.*(وارد|کشف)/.test(l))
    return { intent: "model.discover", args: { baseUrl: urls[0], name: extractQuoted(t) }, confidence: 0.8 };
  if (/(delete|remove|حذف).*(unhealthy|broken|failed|ناسالم|خراب|معیوب).*(model|مدل)|(حذف|delete).*(مدل|model).*(ناسالم|خراب|unhealthy|failed)/.test(l))
    return { intent: "model.deleteUnhealthy", args: {}, confidence: 0.9 };
  if (/(test|تست).*(all|every|همه).*(model|مدل)|(تست|test) (همه|all) ?/.test(l))
    return { intent: "model.testAll", args: { provider: extractAfter(t, /(from|of|از)\s+/i) }, confidence: 0.85 };
  if (/(cheapest|ارزان).*(model|مدل)|(model|مدل).*(cheapest|ارزان)/.test(l))
    return { intent: "model.cheapest", args: { capability: capFromText(l) }, confidence: 0.9 };
  if (/(fastest|سریعترین|سریع ترین).*(model|مدل)|(model|مدل).*(fastest|سریعترین)/.test(l))
    return { intent: "model.fastest", args: { capability: capFromText(l) }, confidence: 0.9 };
  if (/(best|بهترین).*(model|مدل)/.test(l))
    return { intent: "model.best", args: { capability: capFromText(l), task: taskFromText(l) }, confidence: 0.85 };
  if (/(healthy|سالم).*(model|مدل)|(model|مدل).*(سالم|healthy)/.test(l))
    return { intent: "model.list", args: { status: "healthy" }, confidence: 0.85 };
  if (/^(models|مدلها|مدل ها)$|^\/models?$/.test(l))
    return { intent: "model.list", args: {}, confidence: 0.9 };
  if (/(benchmark|بنچمارک)/.test(l))
    return { intent: "model.benchmark", args: { names: extractModelNames(t) }, confidence: 0.85 };
  if (/(compare|مقایسه)/.test(l) && extractModelNames(t).length >= 2)
    return { intent: "model.compare", args: { names: extractModelNames(t) }, confidence: 0.85 };
  if (/(default|پیشفرض|پیش فرض).*(model|مدل)|(model|مدل).*(default|پیشفرض)/.test(l))
    return { intent: "model.setDefault", args: { name: extractQuoted(t) || extractModelNames(t)[0], criteria: /fastest|سریع/.test(l) ? "fastest" : /cheap|ارزان/.test(l) ? "cheapest" : /best|بهترین/.test(l) ? "best" : null }, confidence: 0.8 };
  if (/(prioritize|policy|اولویت).*(quality|speed|cost|کیفیت|سرعت|هزینه)/.test(l))
    return { intent: "routing.policy", args: { policy: /quality|کیفیت/.test(l) ? "quality" : /speed|سرعت/.test(l) ? "speed" : /cost|هزینه/.test(l) ? "cost" : "balanced" }, confidence: 0.9 };
  if (/(monitor|status|وضعیت|مانیتور)/.test(l) && !/usage|مصرف/.test(l))
    return { intent: "monitor.status", args: {}, confidence: 0.8 };
  if (/(usage|مصرف|هزینه)/.test(l) && /report|گزارش|چقدر|how much/.test(l))
    return { intent: "usage.report", args: { days: /30|ماه/.test(l) ? 30 : /7|هفته|week/.test(l) ? 7 : 1 }, confidence: 0.8 };
  if (/(doctor|عیبیابی|عیب یابی|diagnos)/.test(l) && urls.length)
    return { intent: "doctor.run", args: { baseUrl: urls[0], apiKey: keys[0] }, confidence: 0.9 };
  if (/(disable|غیرفعال).*(latency|تأخیر|تاخیر)/.test(l)) {
    const ms = (t.match(/(\d+(?:\.\d+)?)\s*(s|ثانیه|sec|seconds)/i) || [])[1];
    const raw = (t.match(/(\d{3,6})\s*ms/i) || [])[1];
    return { intent: "model.disable", args: { latencyAbove: raw ? Number(raw) : ms ? Number(ms) * 1000 : 3000 }, confidence: 0.85 };
  }
  if (urls.length && keys.length === 1 && t.split(/\s+/).length < 12)
    return { intent: "provider.add", args: { baseUrl: urls[0], apiKey: keys[0] }, confidence: 0.6 };
  return null;
}

function extractQuoted(t) {
  const m = t.match(/[«"']([^«»"']{2,60})[»"']/);
  return m ? m[1] : null;
}
function extractAfter(t, re) {
  const m = t.split(re);
  return m.length > 1 ? m[m.length - 1].trim().replace(/[.،?]$/, "").slice(0, 50) : null;
}
function capFromText(l) {
  if (/vision|تصویر|بینایی/.test(l)) return "vision";
  if (/tool|function/.test(l)) return "tools";
  if (/json/.test(l)) return "json";
  if (/reason|استدلال/.test(l)) return "reasoning";
  if (/long context|متن بلند/.test(l)) return "longContext";
  return null;
}
function taskFromText(l) {
  if (/coding|code|کد|برنامه/.test(l)) return "coding";
  if (/vision|تصویر/.test(l)) return "vision";
  if (/reason|استدلال/.test(l)) return "reasoning";
  if (/translat|ترجمه/.test(l)) return "translation";
  if (/research|تحقیق/.test(l)) return "research";
  return "chat";
}
function extractModelNames(t) {
  const out = new Set();
  for (const m of t.match(/\b[\w.-]+\/[\w.:-]+\b/g) || []) out.add(m);
  for (const m of t.match(/\b(gpt-[\w.-]+|gemini-[\w.-]+|claude-[\w.-]+|llama-?[\w.-]+|mistral-[\w.-]+|qwen[\w.-]*|deepseek-[\w.-]+|nemotron[\w.:-]*)\b/gi) || []) out.add(m);
  return [...out];
}

// ── تشخیص با مدل (fallback) ───────────────────
export async function parseIntent(env, text) {
  const quick = quickIntent(text);
  if (quick && quick.confidence >= 0.8) return quick;
  try {
    const { json } = await completeJson(env,
      `Classify this AI-infrastructure instruction into one intent and extract arguments.\n\nAllowed intents: ${INTENTS.join(", ")}\n\nInstruction: """${String(text).slice(0, 800)}"""\n\nReturn ONLY JSON: {"intent":"...","args":{...},"confidence":0..1}\nArgument keys you may use: baseUrl, apiKey, keys(array), name, nameTemplate, provider, model, models(array), status, capability, task, policy, days, latencyAbove, count, criteria.`,
      { system: "You are an intent parser. Output strict JSON only.", maxTokens: 400, temperature: 0, task: "data" });
    if (INTENTS.includes(json.intent)) return { intent: json.intent, args: json.args || {}, confidence: Number(json.confidence ?? 0.7), viaModel: true };
  } catch {}
  return quick || { intent: "none", args: {}, confidence: 0 };
}

export function needsConfirmation(intent) { return CONFIRM_INTENTS.has(intent); }

// ── ذخیره عملیات معلق برای تأیید ──────────────
export async function stagePending(env, userId, op) {
  const id = newId("op");
  await kvPut(env, `pendingop:${userId}:${id}`, { ...op, id, ts: nowIso() }, { expirationTtl: 1800 });
  return id;
}
export async function takePending(env, userId, id) {
  const key = `pendingop:${userId}:${id}`;
  const op = await kvGet(env, key, null);
  if (op) await kvDel(env, key);
  return op;
}

// ── اجرای عملیات ──────────────────────────────
export async function execute(env, { intent, args = {} }, { userId = 0, onProgress, confirmed = false } = {}) {
  const say = async m => { if (onProgress) await onProgress(m); };

  switch (intent) {
    case "provider.add": {
      if (!args.baseUrl) return { needsInput: "baseUrl", message: "Base URL پروایدر را بفرستید (مثل https://api.example.com/v1)" };
      const keyList = Array.isArray(args.apiKeys) && args.apiKeys.length
        ? args.apiKeys
        : (args.apiKey ? [args.apiKey] : []);
      await say("🔍 بررسی اتصال و سازگاری…");
      const diag = await diagnose({ baseUrl: args.baseUrl, apiKey: keyList[0] || "", format: args.format || "openai" });
      const provider = await createProvider(env, {
        name: args.name || guessName(args.baseUrl),
        baseUrl: args.baseUrl,
        apiKeys: keyList,
        format: diag.info?.suggestedFormat || args.format || "openai",
        tags: args.tags
      }, userId);
      await say("📦 کشف مدلها…");
      const disc = await discoverModels(env, provider.id, userId).catch(() => ({ models: [], found: 0, created: 0 }));
      let tested = [];
      if (disc.models.length) {
        const ids = disc.models.slice(0, args.testLimit || 12).map(m => m.id);
        await say(`🧪 تست ${ids.length} مدل…`);
        tested = await testModels(env, ids, ["basic"], { userId, concurrency: 4, onProgress: p => say(`🧪 تست مدلها ${p.done}/${p.total}`) });
      }
      const healthy = tested.filter(t => t.model?.status === "healthy").length;
      const models = await listModels(env, { providerId: provider.id });
      return {
        type: "provider.added",
        provider: publicProvider(await getProvider(env, provider.id)),
        diagnostics: diag,
        keyCount: keyList.length,
        discovered: disc.found, imported: models.length,
        tested: tested.length, healthy, failed: tested.length - healthy,
        avgLatency: avg(models.map(m => m.latency).filter(Boolean)),
        capabilities: capSummary(models)
      };
    }

    case "provider.bulkAdd": {
      const keys = Array.isArray(args.keys) ? args.keys : parseKeys(args.keys || "");
      if (!args.baseUrl) return { needsInput: "baseUrl", message: "Base URL را بفرستید" };
      if (!keys.length) return { needsInput: "keys", message: "کلیدها را بفرستید (هر خط یک کلید یا JSON)" };
      await say(`📦 ساخت ${keys.length} پروایدر…`);
      const created = await bulkCreateProviders(env, {
        baseUrl: args.baseUrl, keys,
        nameTemplate: args.nameTemplate || `${guessName(args.baseUrl)}-{n}`,
        format: args.format || "openai"
      }, userId);
      const report = [];
      for (let i = 0; i < created.length; i++) {
        const p = created[i];
        await say(`🧪 اعتبارسنجی ${i + 1}/${created.length}`);
        const d = await diagnose({ baseUrl: p.baseUrl, apiKey: (await keyOf(env, p)), format: p.format });
        const authStep = d.steps.find(s => s.name === "Authentication");
        const rateLimited = d.steps.some(s => /429/.test(s.detail || ""));
        const status = authStep?.ok ? (rateLimited ? "rateLimited" : "healthy") : "invalid";
        await updateProvider(env, p.id, { enabled: status !== "invalid" }, userId);
        const fresh = await getProvider(env, p.id);
        fresh.status = status === "healthy" ? "healthy" : status === "rateLimited" ? "degraded" : "failed";
        await kvPut(env, `provider:${p.id}`, fresh);
        report.push({ name: p.name, id: p.id, status, detail: d.diagnosis?.cause || d.summary });
      }
      return {
        type: "provider.bulkAdded", created: created.length, report,
        healthy: report.filter(r => r.status === "healthy").length,
        invalid: report.filter(r => r.status === "invalid").length,
        rateLimited: report.filter(r => r.status === "rateLimited").length
      };
    }

    case "provider.list": {
      const providers = await listProviders(env);
      const models = await listModels(env);
      return {
        type: "provider.list",
        providers: providers.map(p => ({
          ...publicProvider(p),
          modelCount: models.filter(m => m.providerId === p.id).length,
          healthyModels: models.filter(m => m.providerId === p.id && m.status === "healthy").length,
          health: providerHealth(p)
        }))
      };
    }

    case "provider.delete": {
      const p = await resolveProvider(env, args);
      if (!p) return { error: "پروایدر پیدا نشد. نام دقیق را بگویید." };
      const models = await listModels(env, { providerId: p.id });
      const cfg = await getRoutingConfig(env);
      const rules = cfg.rules.filter(r => r.providerId === p.id).length;
      if (!confirmed) {
        return {
          type: "confirm",
          intent: "provider.delete",
          args: { providerId: p.id },
          summary: { provider: p.name, models: models.length, rules },
          message: `حذف پروایدر «${p.name}» — ${models.length} مدل و ${rules} قانون مسیریابی غیرفعال میشوند.`
        };
      }
      for (const m of models) await deleteModel(env, m.id, userId);
      await deleteProvider(env, p.id, userId);
      return { type: "provider.deleted", provider: p.name, modelsDeleted: models.length };
    }

    case "provider.enable":
    case "provider.disable": {
      const enable = intent === "provider.enable";
      if (args.all || /all|همه/.test(String(args.name || ""))) {
        const providers = await listProviders(env);
        let n = 0;
        for (const p of providers) {
          if (enable && p.status === "failed") continue;
          await updateProvider(env, p.id, { enabled: enable }, userId); n++;
        }
        return { type: "provider.toggled", count: n, enabled: enable };
      }
      const p = await resolveProvider(env, args);
      if (!p) return { error: "پروایدر پیدا نشد" };
      if (!enable && !confirmed) {
        return { type: "confirm", intent: "provider.disable", args: { providerId: p.id }, summary: { provider: p.name }, message: `غیرفعالسازی «${p.name}»؟` };
      }
      await updateProvider(env, p.id, { enabled: enable }, userId);
      return { type: "provider.toggled", count: 1, enabled: enable, provider: p.name };
    }

    case "provider.rename": {
      const p = await resolveProvider(env, args);
      if (!p || !args.name) return { error: "پروایدر یا نام جدید مشخص نیست" };
      await updateProvider(env, p.id, { name: args.name }, userId);
      return { type: "provider.renamed", from: p.name, to: args.name };
    }

    case "provider.test":
    case "doctor.run": {
      let baseUrl = args.baseUrl, apiKey = args.apiKey, format = args.format || "openai";
      if (!baseUrl) {
        const p = await resolveProvider(env, args);
        if (!p) return { needsInput: "baseUrl", message: "Base URL یا نام پروایدر را بگویید" };
        baseUrl = p.baseUrl; apiKey = await keyOf(env, p); format = p.format;
      }
      await say("🩺 اجرای API Doctor…");
      const d = await diagnose({ baseUrl, apiKey, format });
      await audit(env, { userId, action: "doctor.run", resource: baseUrl, result: d.ok ? "ok" : "fail" });
      return { type: "doctor", report: d };
    }

    case "model.discover": {
      const p = await resolveProvider(env, args);
      if (!p) return { error: "پروایدر مشخص نیست. اول پروایدر را اضافه کنید." };
      await say("📦 کشف مدلها…");
      const d = await discoverModels(env, p.id, userId);
      return { type: "model.discovered", provider: p.name, found: d.found, created: d.created, path: d.path, total: d.models.length };
    }

    case "model.add": {
      const p = await resolveProvider(env, args);
      if (!p) return { error: "پروایدر مشخص نیست" };
      const ids = args.models?.length ? args.models : (args.model ? [args.model] : []);
      if (!ids.length) return { needsInput: "model", message: "شناسه مدل را بفرستید (هر خط یک مدل)" };
      const added = [];
      for (const id of ids) {
        const { model } = await upsertModel(env, p, id, { displayName: args.displayName, contextWindow: args.contextWindow, capabilities: args.capabilities, pricing: args.pricing });
        added.push(model);
      }
      await say(`🧪 تست ${added.length} مدل…`);
      const tested = await testModels(env, added.map(m => m.id), ["basic"], { userId });
      return {
        type: "model.added", provider: p.name, count: added.length,
        healthy: tested.filter(t => t.model?.status === "healthy").length,
        models: added.map(m => m.apiModelId)
      };
    }

    case "model.list": {
      const filter = {};
      if (args.status) filter.status = args.status;
      if (args.capability) filter.capability = args.capability;
      if (args.q || args.name) filter.q = args.q || args.name;
      if (args.provider) { const p = await resolveProvider(env, args); if (p) filter.providerId = p.id; }
      const rows = await listModels(env, filter);
      const weights = await getWeights(env);
      const all = await listModels(env);
      return {
        type: "model.list", filter,
        models: rows.map(m => ({ ...slim(m), score: scoreModel(m, weights, all) })).sort((a, b) => (b.score.overall || 0) - (a.score.overall || 0))
      };
    }

    case "model.test": {
      const m = await resolveModel(env, args);
      if (!m) return { error: "مدل پیدا نشد" };
      await say(`🧪 تست ${m.displayName}…`);
      const r = await testModel(env, m.id, args.tests || DEFAULT_TESTS, userId);
      return { type: "model.tested", model: slim(r.model), results: r.results, passed: r.passed, total: r.total };
    }

    case "model.testAll": {
      let rows = await listModels(env);
      if (args.provider) { const p = await resolveProvider(env, args); if (p) rows = rows.filter(m => m.providerId === p.id); }
      if (args.status) rows = rows.filter(m => m.status === args.status);
      const limit = Math.min(rows.length, Number(args.limit || 60));
      rows = rows.slice(0, limit);
      if (!rows.length) return { error: "مدلی برای تست وجود ندارد" };
      const results = await testModels(env, rows.map(m => m.id), args.tests || ["basic"], {
        userId, concurrency: 4,
        onProgress: p => say(`🧪 ${p.done}/${p.total} مدل تست شد`)
      });
      const healthy = results.filter(r => r.model?.status === "healthy").length;
      return {
        type: "model.testedAll", total: results.length, healthy, failed: results.length - healthy,
        details: results.map(r => ({ model: r.model?.apiModelId || r.model?.id, status: r.model?.status, latency: r.model?.latency, error: r.model?.lastError }))
      };
    }

    case "model.delete": {
      const m = await resolveModel(env, args);
      if (!m) return { error: "مدل پیدا نشد" };
      if (!confirmed) return { type: "confirm", intent: "model.delete", args: { modelId: m.id }, summary: { model: m.displayName, provider: m.providerName }, message: `حذف مدل «${m.displayName}»؟` };
      await deleteModel(env, m.id, userId);
      return { type: "model.deleted", model: m.displayName };
    }

    case "model.deleteUnhealthy": {
      const rows = (await listModels(env)).filter(m => m.status === "failed" || (m.status === "degraded" && (m.errorRate || 0) > 50));
      if (!rows.length) return { type: "model.deleted", count: 0, message: "همه مدلها سالماند — چیزی حذف نشد." };
      if (!confirmed) {
        return {
          type: "confirm", intent: "model.deleteUnhealthy", args: {},
          summary: { count: rows.length, models: rows.slice(0, 15).map(m => `${m.displayName} (${m.providerName})`) },
          message: `${rows.length} مدل ناسالم پیدا شد. حذف شوند؟`
        };
      }
      for (const m of rows) await deleteModel(env, m.id, userId);
      return { type: "model.deleted", count: rows.length, models: rows.map(m => m.displayName).slice(0, 20) };
    }

    case "model.enable":
    case "model.disable": {
      const enable = intent === "model.enable";
      let rows = [];
      if (args.latencyAbove) rows = (await listModels(env)).filter(m => (m.latency || 0) > Number(args.latencyAbove));
      else if (args.status) rows = await listModels(env, { status: args.status });
      else if (args.all) rows = await listModels(env);
      else { const m = await resolveModel(env, args); if (m) rows = [m]; }
      if (!rows.length) return { error: "مدلی مطابق شرط پیدا نشد" };
      if (!enable && !confirmed) {
        return {
          type: "confirm", intent: "model.disable", args,
          summary: { count: rows.length, models: rows.slice(0, 15).map(m => `${m.displayName} · ${m.latency ?? "?"}ms`) },
          message: `${rows.length} مدل غیرفعال شود؟`
        };
      }
      for (const m of rows) { m.enabled = enable; await saveModel(env, m); }
      await audit(env, { userId, action: enable ? "model.enable" : "model.disable", resource: "-", meta: { count: rows.length } });
      return { type: "model.toggled", count: rows.length, enabled: enable, models: rows.map(m => m.displayName).slice(0, 20) };
    }

    case "model.cheapest":
    case "model.fastest":
    case "model.best": {
      const all = await listModels(env);
      let rows = all.filter(m => m.enabled && m.status !== "failed");
      if (args.capability) rows = rows.filter(m => m.capabilities?.[args.capability]?.supported);
      if (args.status !== "any") rows = rows.filter(m => m.status === "healthy" || m.status === "unknown");
      if (!rows.length) return { error: "مدل مطابق شرط در رجیستری نیست. اول مدلها را تست/اضافه کنید." };
      const weights = await getWeights(env);
      let sorted;
      if (intent === "model.cheapest") sorted = rows.sort((a, b) => (costPer1M(a) ?? 9e9) - (costPer1M(b) ?? 9e9) || (a.latency || 9e9) - (b.latency || 9e9));
      else if (intent === "model.fastest") sorted = rows.sort((a, b) => (a.latency || 9e9) - (b.latency || 9e9));
      else sorted = rows.sort((a, b) => (scoreModel(b, weights, all).overall || 0) - (scoreModel(a, weights, all).overall || 0));
      return {
        type: "model.pick", criteria: intent.split(".")[1], capability: args.capability || null,
        models: sorted.slice(0, 5).map(m => ({ ...slim(m), score: scoreModel(m, weights, all) }))
      };
    }

    case "model.setDefault": {
      let m = await resolveModel(env, args);
      if (!m && args.criteria) {
        const r = await execute(env, { intent: `model.${args.criteria}`, args: { capability: args.capability } }, { userId });
        if (r.models?.length) m = await getModel(env, r.models[0].id);
      }
      if (!m) return { error: "مدل مشخص نشد" };
      await setRoutingConfig(env, { defaultModelId: m.id }, userId);
      return { type: "routing.default", model: slim(m) };
    }

    case "model.compare": {
      const ids = [];
      for (const n of args.names || args.models || []) {
        const m = await resolveModel(env, { model: n });
        if (m) ids.push(m.id);
      }
      if (ids.length < 2) return { error: "حداقل دو مدل معتبر لازم است" };
      const { compareModels } = await import("../gateway/benchmark.js");
      await say(`⚖️ مقایسه ${ids.length} مدل…`);
      return { type: "model.compare", rows: await compareModels(env, ids, args.tasks || QUICK_TASKS) };
    }

    case "model.benchmark": {
      let ids = [];
      for (const n of args.names || args.models || []) {
        const m = await resolveModel(env, { model: n });
        if (m) ids.push(m.id);
      }
      if (!ids.length) {
        let rows = await listModels(env, { status: "healthy" });
        if (args.provider) { const p = await resolveProvider(env, args); if (p) rows = rows.filter(m => m.providerId === p.id); }
        ids = rows.slice(0, Number(args.limit || 5)).map(m => m.id);
      }
      if (!ids.length) return { error: "مدل سالمی برای بنچمارک نیست" };
      const run = await runBenchmark(env, {
        modelIds: ids, tasks: args.tasks || QUICK_TASKS, userId,
        onProgress: p => say(`🏁 بنچمارک ${p.done}/${p.total}`)
      });
      return { type: "benchmark", run };
    }

    case "routing.policy": {
      const cfg = await setRoutingConfig(env, { policy: args.policy || "balanced", ...(args.strategy ? { strategy: args.strategy } : {}) }, userId);
      return { type: "routing.policy", config: cfg };
    }

    case "routing.rule": {
      const p = args.provider ? await resolveProvider(env, args) : null;
      const m = args.model ? await resolveModel(env, args) : null;
      if (!p && !m) return { error: "برای قانون، پروایدر یا مدل مشخص کنید" };
      const rule = await addRule(env, { task: args.task || "chat", providerId: p?.id || null, modelId: m?.id || null, priority: args.priority || 10 }, userId);
      return { type: "routing.rule", rule, target: p?.name || m?.displayName };
    }

    case "routing.failover": {
      const primary = await resolveProvider(env, { name: args.provider || args.primary });
      const backup = await resolveProvider(env, { name: args.fallback || args.backup });
      if (!primary || !backup) return { error: "پروایدر اصلی و پشتیبان را مشخص کنید" };
      const pm = (await listModels(env, { providerId: primary.id })).filter(m => m.status !== "failed");
      const bm = (await listModels(env, { providerId: backup.id })).filter(m => m.status !== "failed");
      if (!pm.length || !bm.length) return { error: "مدل سالم در یکی از پروایدرها نیست" };
      const rule = await addRule(env, { task: args.task || "chat", providerId: primary.id, modelId: pm[0].id, fallbackModelIds: bm.slice(0, 3).map(m => m.id), priority: 20 }, userId);
      return { type: "routing.failover", rule, primary: primary.name, backup: backup.name };
    }

    case "monitor.status": {
      const { healthOverview, snapshot } = await import("../ops/monitor.js");
      const snap = await snapshot(env);
      const overview = await healthOverview(env);
      return { type: "monitor", snapshot: snap, providers: overview.providers, models: overview.models.slice(0, 30) };
    }

    case "usage.report": {
      const { usageRange } = await import("../ops/monitor.js");
      return { type: "usage", days: Number(args.days || 7), usage: await usageRange(env, Number(args.days || 7)) };
    }

    default:
      return { type: "none" };
  }
}

// ── کمکها ────────────────────────────────────
async function keyOf(env, provider) {
  const { pickKey } = await import("../gateway/providers.js");
  const { plain } = await pickKey(env, provider);
  return plain;
}

async function resolveProvider(env, args) {
  const providers = await listProviders(env);
  if (!providers.length) return null;
  const needle = String(args.providerId || args.provider || args.name || "").trim().toLowerCase();
  if (args.providerId) { const byId = providers.find(p => p.id === args.providerId); if (byId) return byId; }
  if (!needle) return providers.length === 1 ? providers[0] : null;
  return providers.find(p => p.id === needle)
    || providers.find(p => p.name.toLowerCase() === needle)
    || providers.find(p => p.name.toLowerCase().includes(needle))
    || providers.find(p => p.baseUrl.toLowerCase().includes(needle))
    || null;
}

async function resolveModel(env, args) {
  const rows = await listModels(env);
  const needle = String(args.modelId || args.model || args.name || "").trim().toLowerCase();
  if (args.modelId) { const byId = rows.find(m => m.id === args.modelId); if (byId) return byId; }
  if (!needle) return null;
  return rows.find(m => m.id === needle)
    || rows.find(m => m.apiModelId.toLowerCase() === needle)
    || rows.find(m => (m.displayName || "").toLowerCase() === needle)
    || rows.find(m => m.apiModelId.toLowerCase().includes(needle))
    || rows.find(m => (m.displayName || "").toLowerCase().includes(needle))
    || null;
}

function slim(m) {
  return {
    id: m.id, name: m.displayName, apiModelId: m.apiModelId, provider: m.providerName, providerId: m.providerId,
    status: m.status, enabled: m.enabled, latency: m.latency, errorRate: m.errorRate,
    context: m.contextWindow, pricing: m.pricing, costPer1M: costPer1M(m),
    capabilities: Object.entries(m.capabilities || {}).filter(([, v]) => v.supported).map(([k]) => k),
    requests: m.stats?.req || 0, lastChecked: m.lastChecked
  };
}

function capSummary(models) {
  const out = {};
  for (const c of CAPABILITIES) {
    const n = models.filter(m => m.capabilities?.[c]?.supported).length;
    if (n) out[c] = n;
  }
  return out;
}

function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null; }

function guessName(baseUrl) {
  try {
    const h = new URL(/^https?:/.test(baseUrl) ? baseUrl : `https://${baseUrl}`).hostname.replace(/^www\.|^api\./, "");
    const core = h.split(".")[0];
    return core.charAt(0).toUpperCase() + core.slice(1);
  } catch { return "Provider"; }
}
