// ─────────────────────────────────────────────
// 🌐 Universal AI Client
// یک لایه واحد برای فراخوانی هر پروایدر (OpenAI-compatible / Gemini / Anthropic)
// ─────────────────────────────────────────────
import { API_FORMATS, authHeaders, buildUrl, pickKey, recordProviderCall } from "./providers.js";
import { languageMessages } from '../i18n/server.js';

const DEFAULT_TIMEOUT = 45000;

export async function httpJson(url, { method = "GET", headers = {}, body, timeout = 15000, signal } = {}) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) ctrl.abort();
  const killer = setTimeout(() => ctrl.abort(), timeout);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method, headers,
      body: body === undefined ? undefined : (typeof body === "string" ? body : JSON.stringify(body)),
      signal: ctrl.signal
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { ok: res.ok, status: res.status, json, text, ms: Date.now() - t0, headers: res.headers };
  } catch (e) {
    return { ok: false, status: 0, json: null, text: "", ms: Date.now() - t0, error: e.name === "AbortError" ? `timeout ${timeout}ms` : String(e.message || e) };
  } finally { clearTimeout(killer); signal?.removeEventListener("abort", onAbort); }
}

function messagesToGemini(messages) {
  const system = messages.filter(m => m.role === "system").map(m => textOf(m.content)).join("\n\n");
  const contents = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: partsOf(m.content)
  }));
  return { system, contents };
}

function textOf(c) {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(p => (typeof p === "string" ? p : p.text || "")).join(" ");
  return String(c ?? "");
}

function partsOf(c) {
  if (typeof c === "string") return [{ text: c }];
  if (Array.isArray(c)) {
    return c.map(p => {
      if (typeof p === "string") return { text: p };
      if (p.type === "image_url" && p.image_url?.url?.startsWith("data:")) {
        const [meta, data] = p.image_url.url.split(",");
        return { inline_data: { mime_type: meta.slice(5).split(";")[0], data } };
      }
      return { text: p.text || "" };
    });
  }
  return [{ text: String(c ?? "") }];
}

function getFmt(provider) {
  const f = provider?.format;
  return f === "claude" ? "anthropic" : (f || "openai");
}

function buildBody(provider, model, messages, opts) {
  const fmt = getFmt(provider);
  if (fmt === "gemini") {
    const { system, contents } = messagesToGemini(messages);
    return {
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        topP: opts.topP ?? 0.95,
        maxOutputTokens: opts.maxTokens ?? 2048,
        ...(opts.json ? { responseMimeType: "application/json" } : {})
      }
    };
  }
  if (fmt === "anthropic") {
    const system = messages.filter(m => m.role === "system").map(m => textOf(m.content)).join("\n\n");
    const isThinking = String(model).toLowerCase().includes("thinking");
    const out = {
      model,
      max_tokens: isThinking ? Math.max(opts.maxTokens ?? 2048, 1024) : (opts.maxTokens ?? 2048),
      ...(system ? { system } : {}),
      messages: messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: textOf(m.content) })),
      ...(opts.stream ? { stream: true } : {})
    };
    if (!isThinking && opts.temperature !== undefined) out.temperature = opts.temperature;
    return out;
  }
  return {
    model,
    messages,
    stream: !!opts.stream,
    temperature: opts.temperature ?? 0.7,
    top_p: opts.topP ?? 0.95,
    max_tokens: opts.maxTokens ?? 2048,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    ...(opts.tools ? { tools: opts.tools, tool_choice: opts.toolChoice || "auto" } : {}),
    ...(opts.stream ? { stream_options: { include_usage: true } } : {})
  };
}

function chatPath(provider, model, stream) {
  const fmt = getFmt(provider);
  if (fmt === "gemini") return `/models/${encodeURIComponent(model)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  return API_FORMATS[fmt]?.chatPath || "/chat/completions";
}

function parseNonStream(provider, json) {
  const fmt = getFmt(provider);
  if (fmt === "gemini") {
    const cand = json?.candidates?.[0];
    const text = (cand?.content?.parts || []).map(p => p.text || "").join("");
    return {
      text,
      promptTokens: json?.usageMetadata?.promptTokenCount || 0,
      completionTokens: json?.usageMetadata?.candidatesTokenCount || 0,
      toolCalls: (cand?.content?.parts || []).filter(p => p.functionCall).map(p => ({ name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) }))
    };
  }
  if (fmt === "anthropic") {
    const textBlocks = (json?.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const thinkingBlocks = (json?.content || []).filter(b => b.type === "thinking").map(b => b.thinking).join("");
    const text = textBlocks || thinkingBlocks || (typeof json?.completion === "string" ? json.completion : "");
    return {
      text,
      promptTokens: json?.usage?.input_tokens || 0,
      completionTokens: json?.usage?.output_tokens || 0,
      toolCalls: (json?.content || []).filter(b => b.type === "tool_use").map(b => ({ name: b.name, arguments: JSON.stringify(b.input || {}) }))
    };
  }
  const msg = json?.choices?.[0]?.message || {};
  return {
    text: typeof msg.content === "string" ? msg.content : textOf(msg.content) || json?.choices?.[0]?.text || "",
    promptTokens: json?.usage?.prompt_tokens || 0,
    completionTokens: json?.usage?.completion_tokens || 0,
    toolCalls: (msg.tool_calls || []).map(t => ({ id: t.id, name: t.function?.name, arguments: t.function?.arguments }))
  };
}

function deltaOf(provider, obj) {
  const fmt = getFmt(provider);
  if (fmt === "gemini") return (obj?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
  if (fmt === "anthropic") return obj?.delta?.text || obj?.delta?.thinking || "";
  return obj?.choices?.[0]?.delta?.content || "";
}

function usageOf(provider, obj) {
  const fmt = getFmt(provider);
  if (fmt === "gemini" && obj?.usageMetadata) return { prompt: obj.usageMetadata.promptTokenCount, completion: obj.usageMetadata.candidatesTokenCount };
  if (fmt === "anthropic" && obj?.usage) return { prompt: obj.usage.input_tokens || 0, completion: obj.usage.output_tokens || 0 };
  if (obj?.usage) return { prompt: obj.usage.prompt_tokens, completion: obj.usage.completion_tokens };
  return null;
}

// فراخوانی چت روی یک پروایدر مشخص. onChunk → استریم
export async function callChat(env, provider, model, messages, opts = {}) {
  messages = languageMessages(messages);
  const { plain: key, entry } = await pickKey(env, provider);
  const stream = !!opts.onChunk;
  const path = chatPath(provider, model, stream);
  const url = buildUrl(provider, path, key);
  const headers = authHeaders(provider, key);
  if (stream) headers["Accept"] = "text/event-stream";
  const body = buildBody(provider, model, messages, { ...opts, stream });
  const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const t0 = Date.now();

  if (!stream) {
    const r = await httpJson(url, { method: "POST", headers, body, timeout, signal: opts.signal });
    const ms = r.ms;
    
    if (!r.ok) {
      const err = errorMessage(r);
      
      // Import adapter to check error type
      const { createAdapter } = await import("./adapters.js");
      const adapter = createAdapter(provider);
      const isRateLimit = adapter.isRateLimitError(r);
      const isAuthError = adapter.isAuthError(r);
      
      // Record key usage with error classification
      const { recordKeyUsage } = await import("./providers.js");
      await recordKeyUsage(env, provider, entry, { ok: false, ms, error: err, isRateLimit, isAuthError });
      await recordProviderCall(env, provider, false, ms, err);
      
      if (entry && isAuthError) entry.status = "invalid";
      throw Object.assign(new Error(err), { status: r.status, providerId: provider.id, model });
    }
    
    const parsed = parseNonStream(provider, r.json);
    if (!parsed.text && !parsed.toolCalls?.length) {
      const { recordKeyUsage } = await import("./providers.js");
      await recordKeyUsage(env, provider, entry, { ok: false, ms, error: "empty response" });
      await recordProviderCall(env, provider, false, ms, "empty response");
      throw Object.assign(new Error("empty response"), { providerId: provider.id, model });
    }
    
    // Record successful key usage
    const { recordKeyUsage } = await import("./providers.js");
    await recordKeyUsage(env, provider, entry, { ok: true, ms });
    await recordProviderCall(env, provider, true, ms, null);
    
    return finalize(parsed, provider, model, messages, ms);
  }

  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  if (opts.signal?.aborted) ctrl.abort();
  const killer = setTimeout(() => ctrl.abort(), timeout);
  const cleanup = () => { clearTimeout(killer); opts.signal?.removeEventListener("abort", onAbort); };
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    cleanup();
    const err = e.name === "AbortError" ? `timeout ${timeout}ms` : String(e.message || e);
    const ms = Date.now() - t0;
    
    const { recordKeyUsage } = await import("./providers.js");
    await recordKeyUsage(env, provider, entry, { ok: false, ms, error: err });
    await recordProviderCall(env, provider, false, ms, err);
    throw Object.assign(new Error(err), { providerId: provider.id, model });
  }
  
  if (!res.ok) {
    cleanup();
    const ms = Date.now() - t0;
    let detail = "";
    try { detail = (await res.text()).slice(0, 300); } catch {}
    const err = `HTTP ${res.status}${detail ? `: ${shortDetail(detail)}` : ""}`;
    
    // Check error type
    const { createAdapter } = await import("./adapters.js");
    const adapter = createAdapter(provider);
    const mockResponse = { status: res.status, text: detail, ok: false };
    const isRateLimit = adapter.isRateLimitError(mockResponse);
    const isAuthError = adapter.isAuthError(mockResponse);
    
    const { recordKeyUsage } = await import("./providers.js");
    await recordKeyUsage(env, provider, entry, { ok: false, ms, error: err, isRateLimit, isAuthError });
    await recordProviderCall(env, provider, false, ms, err);
    throw Object.assign(new Error(err), { status: res.status, providerId: provider.id, model });
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "", usage = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const d = t.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const obj = JSON.parse(d);
          const delta = deltaOf(provider, obj);
          if (delta) { full += delta; await opts.onChunk(full); }
          const u = usageOf(provider, obj);
          if (u) usage = u;
        } catch {}
      }
    }
  } catch (e) {
    cleanup();
    const err = e.name === "AbortError" ? `stream timeout ${timeout}ms` : String(e.message || e);
    const ms = Date.now() - t0;
    
    const { recordKeyUsage } = await import("./providers.js");
    await recordKeyUsage(env, provider, entry, { ok: false, ms, error: err });
    await recordProviderCall(env, provider, false, ms, err);
    throw Object.assign(new Error(err), { providerId: provider.id, model });
  }
  cleanup();
  const ms = Date.now() - t0;
  
  if (!full) {
    const { recordKeyUsage } = await import("./providers.js");
    await recordKeyUsage(env, provider, entry, { ok: false, ms, error: "empty stream" });
    await recordProviderCall(env, provider, false, ms, "empty stream");
    throw Object.assign(new Error("empty stream"), { providerId: provider.id, model });
  }
  
  const { recordKeyUsage } = await import("./providers.js");
  await recordKeyUsage(env, provider, entry, { ok: true, ms });
  await recordProviderCall(env, provider, true, ms, null);
  
  return finalize({ text: full, promptTokens: usage?.prompt || 0, completionTokens: usage?.completion || 0, toolCalls: [] }, provider, model, messages, ms);
}

function finalize(parsed, provider, model, messages, ms) {
  return {
    text: parsed.text || "",
    toolCalls: parsed.toolCalls || [],
    model,
    providerId: provider.id,
    providerName: provider.name,
    latency: ms,
    promptTokens: parsed.promptTokens || Math.ceil(JSON.stringify(messages).length / 4),
    completionTokens: parsed.completionTokens || Math.ceil((parsed.text || "").length / 4)
  };
}

function shortDetail(text) {
  try {
    const j = JSON.parse(text);
    return String(j.error?.message || j.message || j.detail || text).slice(0, 160);
  } catch { return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 160); }
}

export function errorMessage(r) {
  if (r.error) return r.error;
  return `HTTP ${r.status}${r.text ? `: ${shortDetail(r.text)}` : ""}`;
}

// دریافت لیست مدلها از پروایدر
export async function fetchModelList(env, provider) {
  const { plain: key } = await pickKey(env, provider);
  const headers = authHeaders(provider, key);
  const fmt = getFmt(provider);
  const candidates = fmt === "anthropic"
    ? ["/models", "/v1/models"]
    : fmt === "gemini"
      ? ["/models"]
      : ["/models", "/v1/models", "/models/list", "/api/models"];
  const attempts = [];
  for (const path of candidates) {
    const url = buildUrl(provider, path, key);
    const r = await httpJson(url, { headers, timeout: 15000 });
    attempts.push({ path, status: r.status, ok: r.ok, ms: r.ms });
    if (!r.ok || !r.json) continue;
    const raw = extractModelArray(r.json);
    if (raw.length) return { models: raw, path, attempts };
  }
  return { models: [], path: null, attempts };
}

function extractModelArray(json) {
  const arr = Array.isArray(json) ? json
    : json.data || json.models || json.model_list || json.result || json.available_models || [];
  if (!Array.isArray(arr)) return [];
  return arr.map(m => (typeof m === "string" ? { id: m } : m)).filter(m => m && (m.id || m.name || m.model));
}
