// ─────────────────────────────────────────────
// 🩺 API Doctor — عیبیابی واقعی یک endpoint
// ─────────────────────────────────────────────
import { httpJson, errorMessage } from "./client.js";
import { normalizeBaseUrl } from "./providers.js";

function step(name, ok, detail = "", extra = {}) {
  return { name, ok, detail: String(detail || "").slice(0, 300), ...extra };
}

export async function diagnose({ baseUrl, apiKey = "", format = "openai", auth = "bearer", authHeader = "x-api-key", authQuery = "key", headers = {}, model = "" }) {
  const steps = [];
  let normalized = "";
  try {
    normalized = normalizeBaseUrl(baseUrl);
    steps.push(step("URL", true, normalized));
  } catch (e) {
    steps.push(step("URL", false, e.message));
    return finish(steps, normalized, null);
  }

  const u = new URL(normalized);
  if (u.protocol !== "https:") steps.push(step("TLS", false, "پروتکل https نیست — کلید روی http لو میرود"));

  const baseHeaders = { "Content-Type": "application/json", ...headers };
  if (format === "anthropic") { baseHeaders["x-api-key"] = apiKey; baseHeaders["anthropic-version"] = "2023-06-01"; }
  else if (auth === "bearer" && apiKey) baseHeaders["Authorization"] = `Bearer ${apiKey}`;
  else if (auth === "header" && apiKey) baseHeaders[authHeader || "x-api-key"] = apiKey;

  const withQuery = (p) => auth === "query" && apiKey ? `${normalized}${p}${p.includes("?") ? "&" : "?"}${authQuery || "key"}=${encodeURIComponent(apiKey)}` : normalized + p;

  // DNS + reachability
  const root = await httpJson(withQuery("/"), { headers: baseHeaders, timeout: 12000 });
  if (root.status === 0) {
    const dnsFail = /fail|dns|resolve|enotfound/i.test(root.error || "");
    steps.push(step("DNS/Network", false, root.error || "دسترسی ناموفق"));
    steps.push(step("TLS", false, "چون اتصال برقرار نشد بررسی نشد"));
    return finish(steps, normalized, null);
  }
  steps.push(step("DNS", true, u.hostname));
  steps.push(step("TLS", u.protocol === "https:", u.protocol === "https:" ? "گواهی معتبر" : "بدون TLS"));

  // /models
  let modelsOk = false, discovered = 0, modelSample = [];
  const mr = await httpJson(withQuery("/models"), { headers: baseHeaders, timeout: 15000 });
  if (mr.ok && mr.json) {
    const arr = Array.isArray(mr.json) ? mr.json : (mr.json.data || mr.json.models || []);
    modelsOk = Array.isArray(arr) && arr.length > 0;
    discovered = Array.isArray(arr) ? arr.length : 0;
    modelSample = (Array.isArray(arr) ? arr : []).slice(0, 5).map(m => (typeof m === "string" ? m : m.id || m.name)).filter(Boolean);
    steps.push(step("/models", modelsOk, modelsOk ? `${discovered} مدل` : "پاسخ خالی/غیرمنتظره", { status: mr.status, ms: mr.ms }));
  } else {
    steps.push(step("/models", false, errorMessage(mr), { status: mr.status, ms: mr.ms }));
  }

  // Authentication signal
  if (mr.status === 401 || mr.status === 403) {
    steps.push(step("Authentication", false, `HTTP ${mr.status} — کلید یا روش احراز هویت نادرست است`));
  } else if (mr.status === 429) {
    steps.push(step("Authentication", true, "کلید پذیرفته شد ولی rate limit فعال است"));
  } else if (modelsOk) {
    steps.push(step("Authentication", true, "کلید پذیرفته شد"));
  }

  // /chat/completions
  const testModel = model || modelSample[0] || "gpt-3.5-turbo";
  const chatPath = format === "anthropic" ? "/messages" : format === "gemini" ? `/models/${encodeURIComponent(testModel)}:generateContent` : "/chat/completions";
  const chatBody = format === "gemini"
    ? { contents: [{ role: "user", parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 8 } }
    : format === "anthropic"
      ? { model: testModel, max_tokens: 8, messages: [{ role: "user", content: "ping" }] }
      : { model: testModel, max_tokens: 8, messages: [{ role: "user", content: "ping" }] };
  const cr = await httpJson(withQuery(chatPath), { method: "POST", headers: baseHeaders, body: chatBody, timeout: 30000 });
  const chatOk = cr.ok && !!cr.json;
  steps.push(step("Chat endpoint", chatOk, chatOk ? `مدل تست: ${testModel}` : errorMessage(cr), { status: cr.status, ms: cr.ms }));

  // Streaming
  let streamOk = null;
  if (chatOk) {
    const sr = await probeStream(withQuery(format === "gemini" ? `/models/${encodeURIComponent(testModel)}:streamGenerateContent?alt=sse` : chatPath), baseHeaders, format, testModel);
    streamOk = sr.ok;
    steps.push(step("Streaming", sr.ok, sr.detail, { ms: sr.ms }));
  }

  // Rate limit headers
  const rl = ["x-ratelimit-remaining-requests", "x-ratelimit-remaining", "ratelimit-remaining", "retry-after"]
    .map(h => [h, mr.headers?.get?.(h)]).filter(([, v]) => v);
  if (rl.length) steps.push(step("Rate limit", true, rl.map(([k, v]) => `${k}=${v}`).join(", ")));

  return finish(steps, normalized, {
    format, discovered, modelSample, chatOk, streamOk,
    compatible: modelsOk || chatOk,
    suggestedFormat: guessFormat(mr.json, cr.json, format)
  });
}

async function probeStream(url, headers, format, model) {
  const ctrl = new AbortController();
  const killer = setTimeout(() => ctrl.abort(), 20000);
  const t0 = Date.now();
  try {
    const body = format === "gemini"
      ? { contents: [{ role: "user", parts: [{ text: "count to 3" }] }], generationConfig: { maxOutputTokens: 20 } }
      : { model, max_tokens: 20, stream: true, messages: [{ role: "user", content: "count to 3" }] };
    const res = await fetch(url, { method: "POST", headers: { ...headers, Accept: "text/event-stream" }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}`, ms: Date.now() - t0 };
    const reader = res.body.getReader();
    const { value } = await reader.read();
    try { await reader.cancel(); } catch {}
    const chunk = new TextDecoder().decode(value || new Uint8Array());
    return { ok: chunk.includes("data:"), detail: chunk.includes("data:") ? "SSE پشتیبانی میشود" : "SSE برنگشت", ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, detail: e.name === "AbortError" ? "timeout" : String(e.message || e), ms: Date.now() - t0 };
  } finally { clearTimeout(killer); }
}

function guessFormat(modelsJson, chatJson, current) {
  if (chatJson?.choices) return "openai";
  if (chatJson?.candidates) return "gemini";
  if (chatJson?.content && Array.isArray(chatJson.content)) return "anthropic";
  if (modelsJson?.data) return "openai";
  return current;
}

function finish(steps, baseUrl, info) {
  const failed = steps.filter(s => !s.ok);
  return {
    baseUrl, steps, info,
    ok: failed.length === 0,
    summary: failed.length ? `${failed.length} بررسی ناموفق` : "همه بررسیها موفق",
    diagnosis: diagnosisFor(steps, info)
  };
}

function diagnosisFor(steps, info) {
  const find = n => steps.find(s => s.name === n);
  const models = find("/models"), chat = find("Chat endpoint"), authS = find("Authentication"), url = find("URL");
  if (url && !url.ok) return { cause: "Base URL نامعتبر", fix: "آدرس کامل مثل https://api.example.com/v1 را وارد کنید" };
  if (find("DNS/Network") && !find("DNS/Network").ok) return { cause: "دامنه قابل دسترسی نیست", fix: "املای دامنه و در دسترس بودن سرویس را بررسی کنید" };
  if (authS && !authS.ok) return { cause: "احراز هویت رد شد", fix: "کلید را بررسی کنید یا روش احراز هویت را به Authorization: Bearer <API_KEY> تغییر دهید" };
  if (models && !models.ok && chat?.ok) return { cause: "پروایدر endpoint لیست مدل ندارد", fix: "مدلها را دستی اضافه کنید — چت سالم است" };
  if (chat && !chat.ok && models?.ok) {
    if (chat.status === 404) return { cause: "مسیر چت متفاوت است یا مدل تست وجود ندارد", fix: "یک شناسه مدل معتبر از لیست کشفشده بدهید" };
    if (chat.status === 401 || chat.status === 403) return { cause: "کلید مجوز چت ندارد", fix: "دسترسی/اعتبار کلید را بررسی کنید" };
    if (chat.status === 429) return { cause: "محدودیت نرخ", fix: "کمی بعد تلاش کنید یا کلیدهای بیشتری اضافه کنید" };
    return { cause: "خطای endpoint چت", fix: chat.detail };
  }
  if (info?.suggestedFormat && info.suggestedFormat !== info.format) {
    return { cause: "فرمت API مطابق تنظیم نیست", fix: `فرمت را روی ${info.suggestedFormat} بگذارید` };
  }
  if (steps.every(s => s.ok)) return { cause: null, fix: "پروایدر آماده استفاده است" };
  return { cause: "بررسیهای جزئی ناموفق", fix: "جزئیات هر مرحله را ببینید" };
}
