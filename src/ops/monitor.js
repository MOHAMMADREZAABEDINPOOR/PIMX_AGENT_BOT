// ─────────────────────────────────────────────
// 📈 Monitoring, Alerts & Usage — دادههای واقعی
// ─────────────────────────────────────────────
import { kvGet, kvPut, newId, nowIso } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { listProviders, providerHealth, getProvider } from "../gateway/providers.js";
import { listModels, testModel, isModelAvailable, costPer1M } from "../gateway/models.js";

const dayKey = (off = 0) => new Date(Date.now() - off * 86400000).toISOString().slice(0, 10);

// ── Usage ─────────────────────────────────────
export async function trackPlatformUsage(env, { userId = 0, modelId, model, providerId, providerName, promptTokens = 0, completionTokens = 0, cost = 0, latency = 0, ok = true, task = "chat" }) {
  const key = `usage:${dayKey()}`;
  const day = await kvGet(env, key, { requests: 0, errors: 0, tokensIn: 0, tokensOut: 0, cost: 0, latSum: 0, latN: 0, byModel: {}, byProvider: {}, byTask: {}, byUser: {} });
  day.requests++;
  if (!ok) day.errors++;
  day.tokensIn += promptTokens; day.tokensOut += completionTokens; day.cost += cost;
  if (latency) { day.latSum += latency; day.latN++; }
  const bump = (obj, k) => {
    if (!k) return;
    obj[k] = obj[k] || { requests: 0, tokensIn: 0, tokensOut: 0, cost: 0, errors: 0, latSum: 0, latN: 0 };
    obj[k].requests++; obj[k].tokensIn += promptTokens; obj[k].tokensOut += completionTokens; obj[k].cost += cost;
    if (!ok) obj[k].errors++;
    if (latency) { obj[k].latSum += latency; obj[k].latN++; }
  };
  bump(day.byModel, model || modelId);
  bump(day.byProvider, providerName || providerId);
  bump(day.byTask, task);
  bump(day.byUser, String(userId));
  await kvPut(env, key, day, { expirationTtl: 100 * 86400 });
  return day;
}

export async function usageRange(env, days = 7) {
  const series = [];
  const totals = { requests: 0, errors: 0, tokensIn: 0, tokensOut: 0, cost: 0, latSum: 0, latN: 0 };
  const byModel = {}, byProvider = {}, byTask = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(i);
    const day = await kvGet(env, `usage:${d}`, null);
    series.push({
      date: d,
      requests: day?.requests || 0,
      errors: day?.errors || 0,
      tokens: (day?.tokensIn || 0) + (day?.tokensOut || 0),
      cost: day?.cost || 0,
      avgLatency: day?.latN ? Math.round(day.latSum / day.latN) : null
    });
    if (!day) continue;
    totals.requests += day.requests || 0; totals.errors += day.errors || 0;
    totals.tokensIn += day.tokensIn || 0; totals.tokensOut += day.tokensOut || 0;
    totals.cost += day.cost || 0; totals.latSum += day.latSum || 0; totals.latN += day.latN || 0;
    for (const [k, v] of Object.entries(day.byModel || {})) merge(byModel, k, v);
    for (const [k, v] of Object.entries(day.byProvider || {})) merge(byProvider, k, v);
    for (const [k, v] of Object.entries(day.byTask || {})) merge(byTask, k, v);
  }
  return {
    series,
    totals: { ...totals, avgLatency: totals.latN ? Math.round(totals.latSum / totals.latN) : null, tokens: totals.tokensIn + totals.tokensOut },
    byModel: topList(byModel), byProvider: topList(byProvider), byTask: topList(byTask)
  };
}

function merge(target, k, v) {
  target[k] = target[k] || { requests: 0, tokensIn: 0, tokensOut: 0, cost: 0, errors: 0, latSum: 0, latN: 0 };
  for (const f of ["requests", "tokensIn", "tokensOut", "cost", "errors", "latSum", "latN"]) target[k][f] += v[f] || 0;
}

function topList(obj) {
  return Object.entries(obj)
    .map(([name, v]) => ({ name, ...v, tokens: v.tokensIn + v.tokensOut, avgLatency: v.latN ? Math.round(v.latSum / v.latN) : null }))
    .sort((a, b) => b.requests - a.requests).slice(0, 25);
}

// ── Monitoring snapshots ──────────────────────
export async function snapshot(env) {
  const providers = await listProviders(env);
  const models = await listModels(env);
  const healthyModels = models.filter(m => m.status === "healthy" && m.enabled);
  const usage = await usageRange(env, 1);
  const snap = {
    ts: nowIso(),
    providers: providers.length,
    providersHealthy: providers.filter(p => p.enabled && p.status !== "degraded" && p.status !== "failed").length,
    models: models.length,
    modelsHealthy: healthyModels.length,
    modelsFailed: models.filter(m => m.status === "failed").length,
    avgLatency: healthyModels.length ? Math.round(healthyModels.reduce((a, m) => a + (m.latency || 0), 0) / healthyModels.length) : null,
    requests: usage.totals.requests,
    errors: usage.totals.errors,
    cost: usage.totals.cost,
    tokens: usage.totals.tokens
  };
  const key = `monitor:${dayKey()}`;
  const list = await kvGet(env, key, []);
  list.push(snap);
  await kvPut(env, key, list.slice(-96), { expirationTtl: 30 * 86400 });
  return snap;
}

export async function monitorHistory(env, days = 7) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const list = await kvGet(env, `monitor:${dayKey(i)}`, []);
    out.push(...list);
  }
  return out;
}

export async function healthOverview(env) {
  const providers = await listProviders(env);
  const models = await listModels(env);
  return {
    providers: providers.map(p => ({
      id: p.id, name: p.name, status: p.status, enabled: p.enabled,
      models: models.filter(m => m.providerId === p.id).length,
      healthyModels: models.filter(m => m.providerId === p.id && m.status === "healthy").length,
      ...providerHealth(p),
      lastError: p.lastError, lastChecked: p.lastChecked
    })),
    models: models.map(m => ({
      id: m.id, name: m.displayName, apiModelId: m.apiModelId, provider: m.providerName,
      status: m.status, enabled: m.enabled, latency: m.latency, errorRate: m.errorRate,
      requests: m.stats?.req || 0, lastChecked: m.lastChecked, available: isModelAvailable(m),
      cost: costPer1M(m)
    }))
  };
}

// ── Alerts ────────────────────────────────────
export const ALERT_TYPES = {
  providerDown: { label: "پروایدر از کار افتاد" },
  modelDown: { label: "مدل از کار افتاد" },
  latency: { label: "تأخیر بالا" },
  errorRate: { label: "نرخ خطای بالا" },
  rateLimit: { label: "محدودیت نرخ" },
  cost: { label: "سقف هزینه" },
  healthDegraded: { label: "افت سلامت" }
};

export async function listAlertRules(env) {
  return kvGet(env, "alerts:rules", []);
}

export async function addAlertRule(env, rule, userId = 0) {
  const rules = await listAlertRules(env);
  const r = {
    id: newId("alert"),
    type: ALERT_TYPES[rule.type] ? rule.type : "modelDown",
    threshold: Number(rule.threshold || 0),
    target: rule.target || "*",
    channel: rule.channel === "miniapp" ? "miniapp" : "telegram",
    chatId: rule.chatId || null,
    enabled: rule.enabled !== false,
    createdAt: nowIso()
  };
  rules.push(r);
  await kvPut(env, "alerts:rules", rules);
  await audit(env, { userId, action: "alert.add", resource: r.id, meta: { type: r.type, threshold: r.threshold } });
  return r;
}

export async function deleteAlertRule(env, id, userId = 0) {
  const rules = (await listAlertRules(env)).filter(r => r.id !== id);
  await kvPut(env, "alerts:rules", rules);
  await audit(env, { userId, action: "alert.delete", resource: id });
  return rules;
}

export async function listAlertEvents(env, limit = 50) {
  return (await kvGet(env, "alerts:events", [])).slice(-limit).reverse();
}

async function fireAlert(env, event, notify) {
  const events = await kvGet(env, "alerts:events", []);
  const dedupeKey = `${event.type}:${event.target}`;
  const recent = events.find(e => `${e.type}:${e.target}` === dedupeKey && Date.now() - new Date(e.ts).getTime() < 3600000);
  if (recent) return false;
  const ev = { id: newId("ev"), ts: nowIso(), ...event };
  events.push(ev);
  await kvPut(env, "alerts:events", events.slice(-200), { expirationTtl: 30 * 86400 });
  if (notify && event.chatId) {
    await notify(event.chatId, `🚨 <b>هشدار: ${ALERT_TYPES[event.type]?.label || event.type}</b>\n\n${event.message}`);
  }
  return true;
}

// بررسی قوانین هشدار روی دادههای واقعی
export async function evaluateAlerts(env, { notify, adminChatId } = {}) {
  const rules = (await listAlertRules(env)).filter(r => r.enabled);
  if (!rules.length) return { fired: 0, checked: 0 };
  const providers = await listProviders(env);
  const models = await listModels(env);
  const usage = await usageRange(env, 1);
  let fired = 0;

  for (const rule of rules) {
    const chatId = rule.chatId || adminChatId;
    const match = (name) => rule.target === "*" || rule.target === name;
    if (rule.type === "providerDown") {
      for (const p of providers) {
        if (!match(p.id) && !match(p.name)) continue;
        if (p.status === "failed" || (p.enabled && p.status === "degraded" && (p.stats?.fail || 0) > 3)) {
          if (await fireAlert(env, { type: "providerDown", target: p.id, chatId, message: `پروایدر <b>${p.name}</b> وضعیت ${p.status} دارد.\nآخرین خطا: ${p.lastError || "—"}` }, notify)) fired++;
        }
      }
    }
    if (rule.type === "modelDown") {
      for (const m of models.filter(x => x.status === "failed" && x.enabled)) {
        if (!match(m.id) && !match(m.apiModelId)) continue;
        if (await fireAlert(env, { type: "modelDown", target: m.id, chatId, message: `مدل <b>${m.displayName}</b> (${m.providerName}) از کار افتاده.\n${m.lastError || ""}` }, notify)) fired++;
      }
    }
    if (rule.type === "latency" && rule.threshold) {
      for (const m of models.filter(x => x.latency && x.latency > rule.threshold && x.enabled)) {
        if (!match(m.id) && !match(m.apiModelId)) continue;
        if (await fireAlert(env, { type: "latency", target: m.id, chatId, message: `تأخیر مدل <b>${m.displayName}</b> = ${m.latency}ms (حد: ${rule.threshold}ms)` }, notify)) fired++;
      }
    }
    if (rule.type === "errorRate" && rule.threshold) {
      for (const m of models.filter(x => (x.errorRate || 0) > rule.threshold && (x.stats?.req || 0) >= 5)) {
        if (!match(m.id) && !match(m.apiModelId)) continue;
        if (await fireAlert(env, { type: "errorRate", target: m.id, chatId, message: `نرخ خطای مدل <b>${m.displayName}</b> = ${m.errorRate}% (حد: ${rule.threshold}%)` }, notify)) fired++;
      }
    }
    if (rule.type === "cost" && rule.threshold) {
      const monthly = await usageRange(env, 30);
      if (monthly.totals.cost > rule.threshold) {
        if (await fireAlert(env, { type: "cost", target: "global", chatId, message: `هزینه ۳۰ روز = $${monthly.totals.cost.toFixed(4)} از سقف $${rule.threshold} عبور کرد.` }, notify)) fired++;
      }
    }
    if (rule.type === "healthDegraded" && rule.threshold) {
      const healthy = models.filter(m => m.status === "healthy").length;
      const pct = models.length ? Math.round((healthy / models.length) * 100) : 100;
      if (pct < rule.threshold) {
        if (await fireAlert(env, { type: "healthDegraded", target: "global", chatId, message: `فقط ${pct}% مدلها سالماند (حد: ${rule.threshold}%)` }, notify)) fired++;
      }
    }
    if (rule.type === "rateLimit") {
      for (const p of providers.filter(x => /429|rate limit/i.test(x.lastError || ""))) {
        if (!match(p.id) && !match(p.name)) continue;
        if (await fireAlert(env, { type: "rateLimit", target: p.id, chatId, message: `پروایدر <b>${p.name}</b> با محدودیت نرخ مواجه شده.` }, notify)) fired++;
      }
    }
  }
  return { fired, checked: rules.length, errors: usage.totals.errors };
}

// چرخه سلامت خودکار: هر بار زیرمجموعهای از مدلها تست میشوند (سازگار با CPU limits)
export async function healthSweep(env, { batch = 5 } = {}) {
  const models = (await listModels(env)).filter(m => m.enabled);
  if (!models.length) return { tested: 0 };
  const cursor = await kvGet(env, "monitor:cursor", 0);
  const slice = [];
  for (let i = 0; i < Math.min(batch, models.length); i++) slice.push(models[(cursor + i) % models.length]);
  await kvPut(env, "monitor:cursor", (cursor + slice.length) % models.length);
  let healthy = 0;
  for (const m of slice) {
    try { const r = await testModel(env, m.id, ["basic"]); if (r.model.status === "healthy") healthy++; }
    catch {}
  }
  return { tested: slice.length, healthy };
}
