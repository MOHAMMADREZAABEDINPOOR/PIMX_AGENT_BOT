import { pxText, pxTemplate } from '../i18n/server.js';
// ─────────────────────────────────────────────
// 🏭 Provider Registry
// افزودن/ویرایش/حذف پروایدر + مدیریت چند کلید + آمار سلامت
// ─────────────────────────────────────────────
import { kvGet, kvPut, kvDel, indexAdd, indexRemove, readMany, newId, nowIso } from "../core/kv.js";
import { encryptSecret, decryptSecret, maskKey, fingerprint } from "../core/secrets.js";
import { audit } from "../core/audit.js";

export const PROVIDER_INDEX = "providers:index";
const pKey = id => `provider:${id}`;

export const API_FORMATS = {
  openai: { label: "OpenAI-Compatible", chatPath: "/chat/completions", modelsPath: "/models", embedPath: "/embeddings" },
  gemini: { label: "Google Gemini", chatPath: ":generateContent", modelsPath: "/models", embedPath: ":embedContent" },
  anthropic: { label: "Anthropic Messages", chatPath: "/messages", modelsPath: "/models", embedPath: null },
  claude: { label: "Anthropic Messages", chatPath: "/messages", modelsPath: "/models", embedPath: null }
};

// ─────────────────────────────────────────────
// 🎯 پروایدرهای از پیش تعریف شده
// ─────────────────────────────────────────────
export const PREDEFINED_PROVIDERS = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    format: "openai",
    auth: "bearer",
    authHeader: "Authorization",
    description: "Official OpenAI API (GPT-4, GPT-3.5, etc.)",
    icon: "🤖"
  },
  claude: {
    name: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    format: "anthropic",
    auth: "header",
    authHeader: "x-api-key",
    description: "Anthropic Claude models (Claude 3.5 Sonnet, etc.)",
    icon: "🧠"
  },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    format: "gemini",
    auth: "query",
    authHeader: "key",
    description: "Google Gemini models (Gemini 1.5 Pro/Flash)",
    icon: "✨"
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    format: "openai",
    auth: "bearer",
    authHeader: "Authorization",
    description: "DeepSeek AI models",
    icon: "🔍"
  },
  grok: {
    name: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    format: "openai",
    auth: "bearer",
    authHeader: "Authorization",
    description: "xAI Grok models",
    icon: "🚀"
  },
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    format: "openai",
    auth: "bearer",
    authHeader: "Authorization",
    description: "Multi-provider AI routing aggregator",
    icon: "🌐"
  },
  mistral: {
    name: "Mistral AI",
    baseUrl: "https://api.mistral.ai/v1",
    format: "openai",
    auth: "bearer",
    authHeader: "Authorization",
    description: "Official Mistral AI API",
    icon: "🌪️"
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    format: "openai",
    auth: "bearer",
    authHeader: "Authorization",
    description: "Ultra-fast LPU inference (Llama, Mixtral)",
    icon: "⚡"
  },
  cohere: {
    name: "Cohere",
    baseUrl: "https://api.cohere.com/v2",
    format: "openai",
    auth: "bearer",
    authHeader: "Authorization",
    description: "Cohere Command & Embed models",
    icon: "🧬"
  },
  together: {
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    format: "openai",
    auth: "bearer",
    authHeader: "Authorization",
    description: "Open-source models cloud (Llama, Qwen, DeepSeek)",
    icon: "🤝"
  }
};

export const AUTH_METHODS = {
  bearer: "Bearer Token (Authorization: Bearer <key>)",
  header: "Custom Header (<header>: <key>)",
  query: "Query Parameter (?<param>=<key>)",
  none: "No Auth"
};

function autoProviderName(baseUrl) {
  try {
    const h = new URL(baseUrl).hostname.replace(/^api\./, "").replace(/\.(com|ai|io|org|net|co)$/, "");
    return h.charAt(0).toUpperCase() + h.slice(1);
  } catch { return "Custom Provider"; }
}

export function normalizeBaseUrl(url) {
  let u = String(url || "").trim();
  if (!u) throw new Error(pxText("Base URL خالی است"));
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  u = u.replace(/\/+$/, "");
  // حذف مسیرهای اضافه رایج که کاربر اشتباهی پیست میکند
  u = u.replace(/\/(chat\/completions|completions|models)$/i, "");
  const parsed = new URL(u);
  if (!parsed.hostname.includes(".")) throw new Error(pxText("دامنه نامعتبر است"));
  return parsed.origin + parsed.pathname.replace(/\/+$/, "");
}

export function publicProvider(p) {
  if (!p) return null;
  const { keys = [], ...rest } = p;
  
  const keyInfo = keys.map(k => {
    const stats = k.stats || {};
    const total = (stats.ok || 0) + (stats.fail || 0);
    const successRate = total ? Math.round((stats.ok / total) * 100) : null;
    const now = Date.now();
    const inCooldown = k.cooldownUntil && k.cooldownUntil > now;
    
    return {
      id: k.id,
      mask: k.mask,
      fp: k.fp,
      status: k.status,
      successRate,
      requests: stats.req || 0,
      errors: stats.fail || 0,
      rateLimits: stats.rateLimits || 0,
      lastUsed: k.lastUsed,
      lastError: k.lastError || null,
      inCooldown,
      cooldownRemaining: inCooldown ? Math.ceil((k.cooldownUntil - now) / 1000) : 0,
      addedAt: k.addedAt
    };
  });
  
  return {
    ...rest,
    keyCount: keys.length,
    keys: keyInfo
  };
}

export async function listProviders(env) {
  const ids = await kvGet(env, PROVIDER_INDEX, []);
  const rows = await readMany(env, ids.map(pKey));
  return rows.sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(a.name).localeCompare(String(b.name)));
}

export async function getProvider(env, id) {
  return kvGet(env, pKey(id), null);
}

export async function saveProvider(env, p) {
  p.updatedAt = nowIso();
  await kvPut(env, pKey(p.id), p);
  await indexAdd(env, PROVIDER_INDEX, p.id);
  
  // Invalidate cache entries for this provider
  try {
    const { invalidateCacheEntries } = await import("./cache.js");
    await invalidateCacheEntries(env, { providerId: p.id });
  } catch (error) {
    console.error("[Provider] Failed to invalidate cache:", error);
  }
  
  return p;
}

async function buildKeyEntry(env, raw) {
  const plain = String(raw || "").trim();
  return {
    id: newId("k"),
    enc: await encryptSecret(env, plain),
    mask: maskKey(plain),
    fp: await fingerprint(plain),
    status: "unknown",
    addedAt: nowIso(),
    lastUsed: null,
    cooldownUntil: null,
    stats: { req: 0, ok: 0, fail: 0, rateLimits: 0, authErrors: 0, latSum: 0, latN: 0 },
    rr: 0
  };
}

export async function createProvider(env, input, userId = 0) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  let format = input.format || "auto";
  if (format === "claude") format = "anthropic";
  if (format === "auto") {
    const low = baseUrl.toLowerCase();
    if (low.includes("anthropic.com") || low.includes("claude")) format = "anthropic";
    else if (low.includes("generativelanguage.googleapis.com") || low.includes("google")) format = "gemini";
    else format = "openai";
  }
  if (!API_FORMATS[format]) format = "openai";

  const defaultAuth = format === "anthropic" ? "header" : format === "gemini" ? "query" : "bearer";
  const auth = AUTH_METHODS[input.auth] ? input.auth : (input.apiKey || (input.apiKeys || []).length ? defaultAuth : "none");
  const authHeader = String(input.authHeader || "").slice(0, 60) || (format === "anthropic" ? "x-api-key" : (auth === "header" ? "x-api-key" : (auth === "bearer" ? "Authorization" : "")));
  const authQuery = String(input.authQuery || "").slice(0, 40) || (format === "gemini" ? "key" : (auth === "query" ? "key" : ""));

  const keysRaw = input.apiKeys?.length ? input.apiKeys : (input.apiKey ? [input.apiKey] : []);
  const keys = [];
  const seen = new Set();
  for (const k of keysRaw) {
    const entry = await buildKeyEntry(env, k);
    if (seen.has(entry.fp)) continue;
    seen.add(entry.fp);
    keys.push(entry);
  }
  const provider = {
    id: newId("prov"),
    name: String(input.name || autoProviderName(baseUrl)).trim().slice(0, 60),
    baseUrl,
    format,
    auth,
    authHeader,
    authQuery,
    headers: sanitizeHeaders(input.headers),
    org: String(input.org || "").slice(0, 80),
    description: String(input.description || "").slice(0, 300),
    tags: (Array.isArray(input.tags) ? input.tags : String(input.tags || "").split(/[\s,]+/).filter(Boolean)).map(t => String(t).slice(0, 24)).slice(0, 10),
    enabled: input.enabled !== false,
    priority: Number(input.priority || 0),
    weight: Number(input.weight || 1),
    keys,
    status: "unknown",
    lastChecked: null,
    lastError: null,
    stats: { req: 0, ok: 0, fail: 0, latSum: 0, latN: 0 },
    createdAt: nowIso(),
    builtin: !!input.builtin,
    createdBy: userId
  };
  await saveProvider(env, provider);
  await audit(env, { userId, action: "provider.create", resource: provider.id, meta: { name: provider.name, baseUrl, keys: keys.length } });
  return provider;
}

function sanitizeHeaders(h) {
  const out = {};
  if (!h) return out;
  const entries = Array.isArray(h) ? h.map(x => [x.key, x.value]) : Object.entries(h);
  for (const [k, v] of entries) {
    const key = String(k || "").trim();
    if (!key || /^(authorization|host|content-length)$/i.test(key)) continue;
    out[key.slice(0, 60)] = String(v ?? "").slice(0, 300);
  }
  return out;
}

export async function updateProvider(env, id, patch, userId = 0) {
  const p = await getProvider(env, id);
  if (!p) throw new Error(pxText("پروایدر یافت نشد"));
  if (patch.baseUrl) p.baseUrl = normalizeBaseUrl(patch.baseUrl);
  if (patch.name !== undefined) p.name = String(patch.name).slice(0, 60);
  if (patch.format && API_FORMATS[patch.format]) p.format = patch.format;
  if (patch.auth && AUTH_METHODS[patch.auth]) p.auth = patch.auth;
  if (patch.authHeader !== undefined) p.authHeader = String(patch.authHeader).slice(0, 60);
  if (patch.authQuery !== undefined) p.authQuery = String(patch.authQuery).slice(0, 40);
  if (patch.headers !== undefined) p.headers = sanitizeHeaders(patch.headers);
  if (patch.org !== undefined) p.org = String(patch.org).slice(0, 80);
  if (patch.description !== undefined) p.description = String(patch.description).slice(0, 300);
  if (patch.tags !== undefined) p.tags = (Array.isArray(patch.tags) ? patch.tags : String(patch.tags || "").split(/[\s,]+/).filter(Boolean)).map(t => String(t).slice(0, 24)).slice(0, 10);
  if (patch.enabled !== undefined) p.enabled = !!patch.enabled;
  if (patch.priority !== undefined) p.priority = Number(patch.priority) || 0;
  if (patch.weight !== undefined) p.weight = Math.max(0, Number(patch.weight) || 1);
  if (patch.apiKey) p.keys = [...(p.keys || []), await buildKeyEntry(env, patch.apiKey)];
  if (patch.apiKeys?.length) {
    const have = new Set((p.keys || []).map(k => k.fp));
    for (const raw of patch.apiKeys) {
      const e = await buildKeyEntry(env, raw);
      if (!have.has(e.fp)) { have.add(e.fp); p.keys.push(e); }
    }
  }
  if (patch.replaceKeys) {
    p.keys = [];
    for (const raw of patch.replaceKeys) p.keys.push(await buildKeyEntry(env, raw));
  }
  await saveProvider(env, p);
  await audit(env, { userId, action: "provider.update", resource: id, meta: { fields: Object.keys(patch) } });
  return p;
}

export async function removeProviderKey(env, id, keyId, userId = 0) {
  const p = await getProvider(env, id);
  if (!p) throw new Error(pxText("پروایدر یافت نشد"));
  p.keys = (p.keys || []).filter(k => k.id !== keyId);
  await saveProvider(env, p);
  await audit(env, { userId, action: "provider.key.delete", resource: id, meta: { keyId } });
  return p;
}

export async function deleteProvider(env, id, userId = 0) {
  const p = await getProvider(env, id);
  if (!p) return false;
  await kvDel(env, pKey(id));
  await indexRemove(env, PROVIDER_INDEX, id);
  await audit(env, { userId, action: "provider.delete", resource: id, meta: { name: p.name } });
  return true;
}

// انتخاب کلید بعدی با cooldown، health tracking، و automatic failover
export async function pickKey(env, provider) {
  const now = Date.now();
  let keys = (provider.keys || []).filter(k => {
    // Filter out invalid keys
    if (k.status === "invalid") return false;
    // Filter out keys in cooldown
    if (k.cooldownUntil && k.cooldownUntil > now) return false;
    return true;
  });
  
  // If no healthy keys, try degraded/unknown keys not in cooldown
  if (!keys.length) {
    keys = (provider.keys || []).filter(k => 
      k.status !== "invalid" && (!k.cooldownUntil || k.cooldownUntil <= now)
    );
  }
  
  // Last resort: use any key (even invalid) if all are exhausted
  const pool = keys.length ? keys : (provider.keys || []);
  if (!pool.length) return { plain: "", entry: null };
  
  // Round-robin with health preference (prefer keys with better success rate)
  const sortedPool = pool.sort((a, b) => {
    const aRate = a.stats?.ok && a.stats?.req ? a.stats.ok / a.stats.req : 0.5;
    const bRate = b.stats?.ok && b.stats?.req ? b.stats.ok / b.stats.req : 0.5;
    return bRate - aRate; // Higher success rate first
  });
  
  const idx = (provider._rr || 0) % sortedPool.length;
  provider._rr = idx + 1;
  const entry = sortedPool[idx];
  
  return { plain: await decryptSecret(env, entry.enc), entry };
}

// Track usage and errors per key
export async function recordKeyUsage(env, provider, keyEntry, { ok, ms, error = null, isRateLimit = false, isAuthError = false }) {
  if (!keyEntry) return;
  
  const p = await getProvider(env, provider.id);
  if (!p) return;
  
  const key = p.keys.find(k => k.id === keyEntry.id);
  if (!key) return;
  
  // Initialize stats if missing
  key.stats = key.stats || { req: 0, ok: 0, fail: 0, rateLimits: 0, authErrors: 0, latSum: 0, latN: 0 };
  
  // Update stats
  key.stats.req++;
  key.lastUsed = nowIso();
  
  if (ok) {
    key.stats.ok++;
    if (ms) {
      key.stats.latSum += ms;
      key.stats.latN++;
    }
    key.status = "healthy";
    key.lastError = null;
    key.cooldownUntil = null; // Clear cooldown on success
  } else {
    key.stats.fail++;
    key.lastError = String(error || "").slice(0, 200);
    
    if (isRateLimit) {
      key.stats.rateLimits++;
      // Put key in cooldown for 60 seconds
      key.cooldownUntil = Date.now() + 60000;
      key.status = "rate_limited";
    } else if (isAuthError) {
      key.stats.authErrors++;
      key.status = "invalid";
      key.cooldownUntil = null; // No cooldown, just mark invalid
    } else {
      // Generic error
      const errorRate = key.stats.fail / key.stats.req;
      if (errorRate > 0.5 && key.stats.req > 5) {
        key.status = "degraded";
      } else {
        key.status = "unknown";
      }
    }
  }
  
  await saveProvider(env, p);
}

// Rotate to next healthy key (manual rotation)
export async function rotateProviderKey(env, providerId) {
  const p = await getProvider(env, providerId);
  if (!p) throw new Error("Provider not found");
  
  const healthyKeys = p.keys.filter(k => k.status === "healthy" || k.status === "unknown");
  if (healthyKeys.length === 0) throw new Error("No healthy keys available");
  
  // Force rotation by incrementing round-robin counter
  p._rr = ((p._rr || 0) + 1) % healthyKeys.length;
  await saveProvider(env, p);
  
  return { rotated: true, nextKey: healthyKeys[p._rr % healthyKeys.length].mask };
}

// Get key health stats
export function getKeyHealth(key) {
  const stats = key.stats || {};
  const total = (stats.ok || 0) + (stats.fail || 0);
  const successRate = total ? Math.round((stats.ok / total) * 100) : null;
  const avgLatency = stats.latN ? Math.round(stats.latSum / stats.latN) : null;
  
  const now = Date.now();
  const inCooldown = key.cooldownUntil && key.cooldownUntil > now;
  const cooldownRemaining = inCooldown ? Math.ceil((key.cooldownUntil - now) / 1000) : 0;
  
  return {
    id: key.id,
    mask: key.mask,
    status: key.status,
    successRate,
    avgLatency,
    requests: stats.req || 0,
    errors: stats.fail || 0,
    rateLimits: stats.rateLimits || 0,
    authErrors: stats.authErrors || 0,
    lastUsed: key.lastUsed,
    inCooldown,
    cooldownRemaining,
    addedAt: key.addedAt
  };
}

export async function allKeys(env, provider) {
  const out = [];
  for (const k of provider.keys || []) out.push({ entry: k, plain: await decryptSecret(env, k.enc) });
  return out;
}

export function authHeaders(provider, key) {
  const h = { "Content-Type": "application/json", ...(provider.headers || {}) };
  const fmt = provider.format;
  if (fmt === "anthropic" || fmt === "claude") {
    if (key) {
      h["x-api-key"] = key;
      h["Authorization"] = `Bearer ${key}`;
    }
    h["anthropic-version"] = h["anthropic-version"] || "2023-06-01";
    return h;
  }
  switch (provider.auth) {
    case "bearer": if (key) h["Authorization"] = `Bearer ${key}`; break;
    case "header": if (key) h[provider.authHeader || "x-api-key"] = key; break;
    case "query": break;
    default: if (key) h["Authorization"] = `Bearer ${key}`; break;
  }
  if (provider.org) {
    if (/openai/i.test(provider.baseUrl)) h["OpenAI-Organization"] = provider.org;
    else h["X-Organization"] = provider.org;
  }
  return h;
}

export function buildUrl(provider, path, key) {
  let url = provider.baseUrl + path;
  if (provider.auth === "query" && key) {
    url += (url.includes("?") ? "&" : "?") + `${provider.authQuery || "key"}=${encodeURIComponent(key)}`;
  }
  return url;
}

export async function recordProviderCall(env, provider, ok, ms, errMsg = null) {
  const p = await getProvider(env, provider.id);
  if (!p) return;
  p.stats = p.stats || { req: 0, ok: 0, fail: 0, latSum: 0, latN: 0 };
  p.stats.req++;
  if (ok) { p.stats.ok++; p.stats.latSum += ms; p.stats.latN++; p.status = "healthy"; p.lastError = null; }
  else { p.stats.fail++; p.lastError = String(errMsg || "").slice(0, 200); if (p.stats.fail > p.stats.ok) p.status = "degraded"; }
  p.lastChecked = nowIso();
  await kvPut(env, pKey(p.id), p);
}

export function providerHealth(p) {
  const s = p.stats || {};
  const total = (s.ok || 0) + (s.fail || 0);
  return {
    successRate: total ? Math.round((s.ok / total) * 100) : null,
    avgLatency: s.latN ? Math.round(s.latSum / s.latN) : null,
    requests: s.req || 0,
    errors: s.fail || 0
  };
}

// ─────────────────────────────────────────────
// 📦 Bulk import: یک Base URL + چند کلید → چند پروایدر
// ─────────────────────────────────────────────
export function parseKeys(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  // JSON array یا object
  if (/^[[{]/.test(text)) {
    try {
      const j = JSON.parse(text);
      const arr = Array.isArray(j) ? j : (j.keys || j.apiKeys || Object.values(j));
      return dedupe(arr.map(x => (typeof x === "string" ? x : x?.key || x?.apiKey || "")).filter(Boolean));
    } catch {}
  }
  return dedupe(text.split(/[\n,;\s]+/).map(s => s.trim().replace(/^["'`]|["'`,]$/g, "")).filter(s => s.length >= 8));
}

function dedupe(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) { const k = String(x).trim(); if (k && !seen.has(k)) { seen.add(k); out.push(k); } }
  return out;
}

export function renderNameTemplate(template, n, total) {
  const pad = String(total).length >= 2 ? String(total).length : 2;
  const num = String(n).padStart(pad, "0");
  const t = String(template || "Provider-{n}");
  if (!t.includes("{n}")) return `${t} ${num}`;
  return t.replace(/\{n\}/g, num).replace(/\{i\}/g, String(n));
}

export async function bulkCreateProviders(env, { baseUrl, keys, nameTemplate, format = "openai", auth = "bearer", headers, tags }, userId = 0) {
  const list = Array.isArray(keys) ? dedupe(keys) : parseKeys(keys);
  if (!list.length) throw new Error(pxText("هیچ کلید معتبری پیدا نشد"));
  const created = [];
  for (let i = 0; i < list.length; i++) {
    const name = renderNameTemplate(nameTemplate, i + 1, list.length);
    const p = await createProvider(env, { name, baseUrl, apiKey: list[i], format, auth, headers, tags }, userId);
    created.push(p);
  }
  await audit(env, { userId, action: "provider.bulkCreate", resource: "-", meta: { count: created.length, baseUrl } });
  return created;
}

// ─────────────────────────────────────────────
// 🔌 Provider Adapter Integration
// ─────────────────────────────────────────────

/**
 * Get adapter for a provider and execute health check
 */
export async function checkProviderHealth(env, providerId) {
  const provider = await getProvider(env, providerId);
  if (!provider) return { error: "Provider not found" };
  
  const { createAdapter } = await import("./adapters.js");
  const adapter = createAdapter(provider);
  return adapter.healthCheck(env);
}

/**
 * Authenticate provider using adapter
 */
export async function authenticateProvider(env, providerId) {
  const provider = await getProvider(env, providerId);
  if (!provider) return { ok: false, error: "Provider not found" };
  
  const { createAdapter } = await import("./adapters.js");
  const adapter = createAdapter(provider);
  return adapter.authenticate(env);
}

/**
 * List models using adapter
 */
export async function listModelsViaAdapter(env, providerId) {
  const provider = await getProvider(env, providerId);
  if (!provider) return { models: [], error: "Provider not found" };
  
  const { createAdapter } = await import("./adapters.js");
  const adapter = createAdapter(provider);
  return adapter.listModels(env);
}

/**
 * Detect model capabilities using adapter
 */
export async function detectModelCapabilities(env, providerId, modelId) {
  const provider = await getProvider(env, providerId);
  if (!provider) return { capabilities: {}, error: "Provider not found" };
  
  const { createAdapter } = await import("./adapters.js");
  const adapter = createAdapter(provider);
  return adapter.detectCapabilities(env, modelId);
}
