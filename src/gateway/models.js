import { pxText, pxTemplate } from '../i18n/server.js';
// ─────────────────────────────────────────────
// 🧠 Model Registry — کشف، ثبت، تست، سلامت، قابلیتها
// ─────────────────────────────────────────────
import { kvGet, kvPut, kvDel, indexAdd, indexRemove, readMany, newId, nowIso } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { getProvider, listProviders } from "./providers.js";
import { callChat, fetchModelList } from "./client.js";

export const MODEL_INDEX = "models:index";
const mKey = id => `model:${id}`;

// ✨ Enhanced Capability Registry — Structured by category
export const CAPABILITY_CATEGORIES = {
  text: ["chat", "completion", "instruction"],
  vision: ["image_input", "image_generation", "video_input"],
  audio: ["speech_to_text", "text_to_speech", "audio_input"],
  reasoning: ["chain_of_thought", "extended_thinking", "problem_solving"],
  coding: ["code_generation", "code_review", "code_execution"],
  tools: ["function_calling", "tool_use", "api_integration"],
  streaming: ["text_streaming", "chunk_streaming"],
  embeddings: ["text_embedding", "multimodal_embedding"],
  longContext: ["context_100k", "context_200k", "context_1m"],
  structured: ["json_mode", "structured_output", "schema_validation"]
};

// Flat list for backward compatibility
export const CAPABILITIES = [
  "chat", "streaming", "json", "structured", "tools", "vision", "audio", 
  "reasoning", "longContext", "embedding", "completion", "instruction",
  "image_input", "image_generation", "video_input", "speech_to_text",
  "text_to_speech", "audio_input", "chain_of_thought", "extended_thinking",
  "problem_solving", "code_generation", "code_review", "code_execution",
  "function_calling", "tool_use", "api_integration", "text_streaming",
  "chunk_streaming", "text_embedding", "multimodal_embedding",
  "context_100k", "context_200k", "context_1m", "json_mode",
  "structured_output", "schema_validation"
];

// Helper: Get all capabilities in a category
export function getCapabilitiesInCategory(category) {
  return CAPABILITY_CATEGORIES[category] || [];
}

// Helper: Get category for a capability
export function getCategoryForCapability(capability) {
  for (const [cat, caps] of Object.entries(CAPABILITY_CATEGORIES)) {
    if (caps.includes(capability)) return cat;
  }
  return "other";
}

export const TASK_CAPS = {
  chat: ["chat"],
  coding: ["chat"],
  reasoning: ["chat", "reasoning"],
  research: ["chat"],
  vision: ["vision"],
  translation: ["chat"],
  writing: ["chat"],
  summarization: ["chat"],
  data: ["chat", "json"],
  fast: ["chat"],
  longContext: ["longContext"],
  tools: ["tools"],
  embedding: ["embedding"]
};

export function modelSlug(providerId, apiModelId) {
  return `${providerId}::${apiModelId}`;
}

export async function listModels(env, filter = {}) {
  const ids = await kvGet(env, MODEL_INDEX, []);
  let rows = await readMany(env, ids.map(mKey));
  if (filter.providerId) rows = rows.filter(m => m.providerId === filter.providerId);
  if (filter.status) rows = rows.filter(m => m.status === filter.status);
  if (filter.enabled !== undefined) rows = rows.filter(m => !!m.enabled === !!filter.enabled);
  if (filter.capability) rows = rows.filter(m => m.capabilities?.[filter.capability]?.supported);
  if (filter.tag) rows = rows.filter(m => (m.tags || []).includes(filter.tag));
  if (filter.q) {
    const q = String(filter.q).toLowerCase();
    rows = rows.filter(m => `${m.displayName} ${m.apiModelId} ${m.providerName}`.toLowerCase().includes(q));
  }
  return rows;
}

export async function getModel(env, id) { return kvGet(env, mKey(id), null); }

export async function saveModel(env, m) {
  m.updatedAt = nowIso();
  await kvPut(env, mKey(m.id), m);
  await indexAdd(env, MODEL_INDEX, m.id);
  return m;
}

export async function deleteModel(env, id, userId = 0) {
  const m = await getModel(env, id);
  if (!m) return false;
  await kvDel(env, mKey(id));
  await indexRemove(env, MODEL_INDEX, id);
  await audit(env, { userId, action: "model.delete", resource: id, meta: { model: m.apiModelId, provider: m.providerName } });
  return true;
}

export async function deleteModelsByProvider(env, providerId, userId = 0) {
  const rows = await listModels(env, { providerId });
  for (const m of rows) await deleteModel(env, m.id, userId);
  return rows.length;
}

function emptyCaps() {
  const c = {};
  for (const k of CAPABILITIES) c[k] = { supported: false, confidence: 0, source: "unknown" };
  return c;
}

// استنتاج قابلیتها از metadata و نام مدل (Enhanced with structured categories)
export function inferCapabilities(raw, apiModelId) {
  const caps = emptyCaps();
  const id = String(apiModelId || "").toLowerCase();
  const meta = raw || {};
  
  // Default: assume text/chat capability
  caps.chat = { supported: true, confidence: 60, source: "assumed" };
  caps.completion = { supported: true, confidence: 55, source: "assumed" };
  caps.instruction = { supported: true, confidence: 55, source: "assumed" };

  const declared = []
    .concat(meta.capabilities || [], meta.supported_generation_methods || [], meta.architecture?.modality || [], meta.modalities || [])
    .map(x => String(x).toLowerCase());
  const declaredText = declared.join(" ") + " " + JSON.stringify(meta.architecture || {}).toLowerCase();

  // === VISION CAPABILITIES ===
  if (/image|vision|multimodal/.test(declaredText)) {
    caps.vision = { supported: true, confidence: 85, source: "metadata" };
    caps.image_input = { supported: true, confidence: 85, source: "metadata" };
  } else if (/vision|-vl|vl-|llava|gpt-4o|gemini|pixtral|multimodal|qwen.*vl|internvl/.test(id)) {
    caps.vision = { supported: true, confidence: 60, source: "name" };
    caps.image_input = { supported: true, confidence: 60, source: "name" };
  }
  if (/dall-e|sdxl|flux|imagen|midjourney/.test(id)) {
    caps.image_generation = { supported: true, confidence: 70, source: "name" };
  }
  if (/video/.test(declaredText + id)) {
    caps.video_input = { supported: true, confidence: 50, source: "name" };
  }

  // === AUDIO CAPABILITIES ===
  if (/whisper/.test(id)) {
    caps.audio = { supported: true, confidence: 90, source: "name" };
    caps.speech_to_text = { supported: true, confidence: 90, source: "name" };
  }
  if (/tts|text-to-speech|elevenlabs/.test(id)) {
    caps.text_to_speech = { supported: true, confidence: 70, source: "name" };
  }
  if (/audio|speech|voice/.test(declaredText + id)) {
    caps.audio = { supported: true, confidence: 60, source: "name" };
    caps.audio_input = { supported: true, confidence: 50, source: "name" };
  }

  // === EMBEDDING CAPABILITIES ===
  if (/embed/.test(id) || /embedcontent|embedding/.test(declaredText)) {
    caps.embedding = { supported: true, confidence: 90, source: "name" };
    caps.text_embedding = { supported: true, confidence: 90, source: "name" };
    caps.chat = { supported: false, confidence: 80, source: "name" };
    caps.completion = { supported: false, confidence: 80, source: "name" };
  }
  if (/multimodal.*embed|clip|blip/.test(id)) {
    caps.multimodal_embedding = { supported: true, confidence: 70, source: "name" };
  }

  // === TOOL CAPABILITIES ===
  if (/tool|function/.test(declaredText)) {
    caps.tools = { supported: true, confidence: 80, source: "metadata" };
    caps.function_calling = { supported: true, confidence: 80, source: "metadata" };
    caps.tool_use = { supported: true, confidence: 80, source: "metadata" };
  }
  if (meta.supports_tools || meta.tool_use) {
    caps.tools = { supported: true, confidence: 85, source: "metadata" };
    caps.function_calling = { supported: true, confidence: 85, source: "metadata" };
    caps.tool_use = { supported: true, confidence: 85, source: "metadata" };
    caps.api_integration = { supported: true, confidence: 75, source: "metadata" };
  }

  // === REASONING CAPABILITIES ===
  if (/reason|think|o1|o3|o4-mini|r1|qwq|deepseek-r/.test(id)) {
    caps.reasoning = { supported: true, confidence: 75, source: "name" };
    caps.chain_of_thought = { supported: true, confidence: 70, source: "name" };
    caps.problem_solving = { supported: true, confidence: 65, source: "name" };
  }
  if (/o1|o3|deepseek-r/.test(id)) {
    caps.extended_thinking = { supported: true, confidence: 80, source: "name" };
  }

  // === CODING CAPABILITIES ===
  if (/code|codex|coder|starcoder|codegen|codellama|codegeex/.test(id)) {
    caps.coding = { supported: true, confidence: 80, source: "name" };
    caps.code_generation = { supported: true, confidence: 80, source: "name" };
    caps.code_review = { supported: true, confidence: 65, source: "name" };
  }

  // === STREAMING CAPABILITIES ===
  if (/stream/.test(declaredText)) {
    caps.streaming = { supported: true, confidence: 80, source: "metadata" };
    caps.text_streaming = { supported: true, confidence: 80, source: "metadata" };
    caps.chunk_streaming = { supported: true, confidence: 75, source: "metadata" };
  } else {
    // Most modern models support streaming
    caps.streaming = { supported: true, confidence: 50, source: "assumed" };
    caps.text_streaming = { supported: true, confidence: 50, source: "assumed" };
  }

  // === STRUCTURED OUTPUT CAPABILITIES ===
  if (/json/.test(declaredText)) {
    caps.json = { supported: true, confidence: 75, source: "metadata" };
    caps.structured = { supported: true, confidence: 75, source: "metadata" };
    caps.json_mode = { supported: true, confidence: 75, source: "metadata" };
    caps.structured_output = { supported: true, confidence: 70, source: "metadata" };
  }
  if (meta.response_format || /response.*format/.test(declaredText)) {
    caps.json_mode = { supported: true, confidence: 80, source: "metadata" };
    caps.structured_output = { supported: true, confidence: 75, source: "metadata" };
    caps.schema_validation = { supported: true, confidence: 70, source: "metadata" };
  }

  // === LONG CONTEXT CAPABILITIES ===
  const ctxWin = Number(
    meta.context_length || meta.context_window || meta.max_context_length ||
    meta.inputTokenLimit || meta.top_provider?.context_length || 0
  ) || null;
  
  if (ctxWin && ctxWin >= 100000) {
    caps.longContext = { supported: true, confidence: 90, source: "metadata" };
    caps.context_100k = { supported: true, confidence: 90, source: "metadata" };
  }
  if (ctxWin && ctxWin >= 200000) {
    caps.context_200k = { supported: true, confidence: 90, source: "metadata" };
  }
  if (ctxWin && ctxWin >= 1000000) {
    caps.context_1m = { supported: true, confidence: 90, source: "metadata" };
  }

  return { caps, contextWindow: ctxWin };
}

export const KNOWN_MODEL_PRICES = [
  { pattern: /gpt-4o-mini/i, input: 0.15, output: 0.60 },
  { pattern: /gpt-4o/i, input: 2.50, output: 10.00 },
  { pattern: /gpt-4-turbo|gpt-4-0125|gpt-4-1106/i, input: 10.00, output: 30.00 },
  { pattern: /gpt-4/i, input: 30.00, output: 60.00 },
  { pattern: /gpt-3\.5-turbo/i, input: 0.50, output: 1.50 },
  { pattern: /o1-mini/i, input: 3.00, output: 12.00 },
  { pattern: /o1-preview|o1\b/i, input: 15.00, output: 60.00 },
  { pattern: /o3-mini/i, input: 1.10, output: 4.40 },
  { pattern: /o3\b/i, input: 10.00, output: 40.00 },
  { pattern: /claude-3-7-sonnet/i, input: 3.00, output: 15.00 },
  { pattern: /claude-3-5-sonnet/i, input: 3.00, output: 15.00 },
  { pattern: /claude-3-5-haiku/i, input: 0.80, output: 4.00 },
  { pattern: /claude-3-haiku/i, input: 0.25, output: 1.25 },
  { pattern: /claude-3-opus/i, input: 15.00, output: 75.00 },
  { pattern: /gemini-2\.5-flash/i, input: 0.10, output: 0.40 },
  { pattern: /gemini-2\.5-pro/i, input: 1.25, output: 5.00 },
  { pattern: /gemini-2\.0-flash-lite/i, input: 0.075, output: 0.30 },
  { pattern: /gemini-2\.0-flash/i, input: 0.10, output: 0.40 },
  { pattern: /gemini-1\.5-flash/i, input: 0.075, output: 0.30 },
  { pattern: /gemini-1\.5-pro/i, input: 1.25, output: 5.00 },
  { pattern: /gemini-1\.0-pro/i, input: 0.50, output: 1.50 },
  { pattern: /deepseek-reasoner|deepseek-r1/i, input: 0.55, output: 2.19 },
  { pattern: /deepseek-chat|deepseek-v3/i, input: 0.14, output: 0.28 },
  { pattern: /deepseek/i, input: 0.14, output: 0.28 },
  { pattern: /llama-3\.3-70b/i, input: 0.59, output: 0.79 },
  { pattern: /llama-3\.1-405b/i, input: 2.00, output: 2.00 },
  { pattern: /llama-3\.1-70b/i, input: 0.55, output: 0.75 },
  { pattern: /llama-3\.1-8b|llama-3-8b/i, input: 0.05, output: 0.08 },
  { pattern: /llama-3-70b/i, input: 0.59, output: 0.79 },
  { pattern: /mistral-large/i, input: 2.00, output: 6.00 },
  { pattern: /mistral-small/i, input: 0.20, output: 0.60 },
  { pattern: /codestral/i, input: 0.30, output: 0.90 },
  { pattern: /mixtral-8x22b/i, input: 0.90, output: 0.90 },
  { pattern: /mixtral-8x7b/i, input: 0.24, output: 0.24 },
  { pattern: /grok-2/i, input: 2.00, output: 10.00 },
  { pattern: /grok-beta/i, input: 5.00, output: 15.00 },
  { pattern: /qwen-2\.5-72b/i, input: 0.40, output: 0.40 },
  { pattern: /qwq-32b/i, input: 0.20, output: 0.20 }
];

export function extractPricing(raw, modelId = "") {
  const p = raw?.pricing || raw?.price || {};
  let inTok = Number(p.prompt ?? p.input ?? p.input_cost_per_token ?? 0);
  let outTok = Number(p.completion ?? p.output ?? p.output_cost_per_token ?? 0);
  const norm = v => (v > 0 && v < 0.001 ? v * 1_000_000 : v);
  inTok = norm(inTok);
  outTok = norm(outTok);

  const mid = String(modelId || raw?.id || raw?.name || "").toLowerCase();
  const isFree = /:free$/i.test(mid) || /free/i.test(raw?.id || "");

  if (inTok === 0 && outTok === 0 && !isFree) {
    for (const kp of KNOWN_MODEL_PRICES) {
      if (kp.pattern.test(mid)) {
        inTok = kp.input;
        outTok = kp.output;
        break;
      }
    }
  }

  return {
    inputPer1M: inTok,
    outputPer1M: outTok,
    currency: p.currency || "USD",
    free: isFree || (inTok === 0 && outTok === 0)
  };
}

export async function upsertModel(env, provider, rawOrId, extra = {}) {
  const raw = typeof rawOrId === "string" ? { id: rawOrId } : (rawOrId || {});
  const apiModelId = String(raw.id || raw.name || raw.model || "").replace(/^models\//, "");
  if (!apiModelId) throw new Error(pxText("شناسه مدل نامعتبر است"));
  const slug = modelSlug(provider.id, apiModelId);
  const existing = (await listModels(env, { providerId: provider.id })).find(m => m.apiModelId === apiModelId);
  const { caps, contextWindow } = inferCapabilities(raw, apiModelId);
  const pricing = extractPricing(raw, apiModelId);

  const model = existing || {
    id: newId("mdl"),
    slug,
    providerId: provider.id,
    createdAt: nowIso(),
    status: "unknown",
    enabled: true,
    tags: [],
    stats: { req: 0, ok: 0, fail: 0, latSum: 0, latN: 0, tokensIn: 0, tokensOut: 0, cost: 0 },
    tests: [],
    benchmarks: []
  };
  model.providerName = provider.name;
  model.apiModelId = apiModelId;
  model.displayName = extra.displayName || model.displayName || (raw.display_name || raw.displayName || raw.name || apiModelId);
  model.contextWindow = extra.contextWindow || contextWindow || model.contextWindow || null;
  model.capabilities = mergeCaps(model.capabilities || emptyCaps(), caps);
  if (extra.capabilities) {
    for (const c of extra.capabilities) if (model.capabilities[c]) model.capabilities[c] = { supported: true, confidence: 100, source: "manual" };
  }
  model.pricing = extra.pricing || (pricing.inputPer1M || pricing.outputPer1M || pricing.free ? pricing : model.pricing || null);
  model.raw = trimRaw(raw);
  if (extra.tags) model.tags = [...new Set([...(model.tags || []), ...extra.tags])];
  await saveModel(env, model);
  return { model, created: !existing };
}

function mergeCaps(oldC, newC) {
  const out = { ...emptyCaps(), ...oldC };
  for (const k of CAPABILITIES) {
    const a = out[k] || { supported: false, confidence: 0, source: "unknown" };
    const b = newC[k];
    if (!b) continue;
    // منبع probe/manual اولویت بالاتری از metadata/name دارد
    const rank = s => ({ manual: 4, probe: 3, metadata: 2, name: 1, assumed: 0.5, unknown: 0 })[s] ?? 0;
    out[k] = rank(b.source) >= rank(a.source) ? b : a;
  }
  return out;
}

function trimRaw(raw) {
  const keep = {};
  for (const k of ["id", "name", "display_name", "context_length", "context_window", "inputTokenLimit", "pricing", "architecture", "created", "owned_by", "description"]) {
    if (raw[k] !== undefined) keep[k] = raw[k];
  }
  return keep;
}

// ─────────────────────────────────────────────
// 🔎 Model discovery
// ─────────────────────────────────────────────
export async function discoverModels(env, providerId, userId = 0) {
  const provider = await getProvider(env, providerId);
  if (!provider) throw new Error(pxText("پروایدر یافت نشد"));
  const { models: raw, path, attempts } = await fetchModelList(env, provider);
  const imported = [];
  let createdCount = 0;
  for (const r of raw) {
    try {
      const { model, created } = await upsertModel(env, provider, r);
      imported.push(model);
      if (created) createdCount++;
    } catch {}
  }
  await audit(env, { userId, action: "provider.discover", resource: providerId, meta: { found: raw.length, created: createdCount, path } });
  return { provider, models: imported, found: raw.length, created: createdCount, path, attempts };
}

// ─────────────────────────────────────────────
// 🧪 Model tests
// ─────────────────────────────────────────────
export const TEST_SUITE = {
  basic: {
    label: "Basic Chat",
    messages: [{ role: "user", content: "Reply with: PIMX_OK" }],
    opts: { maxTokens: 256, temperature: 0.2 },
    check: r => (r.text || "").trim().length > 0 ? null : pxText("پاسخی از مدل دریافت نشد"),
    capability: "chat"
  },
  streaming: {
    label: "Streaming",
    messages: [{ role: "user", content: "Count from 1 to 5, separated by spaces." }],
    opts: { maxTokens: 256, temperature: 0.2, stream: true },
    check: r => (r.text || "").trim().length > 0 ? null : pxText("استریم متنی دریافت نشد"),
    capability: "streaming"
  },
  json: {
    label: "JSON Output",
    messages: [{ role: "user", content: 'Return ONLY minified JSON: {"ok":true,"n":7}' }],
    opts: { maxTokens: 60, temperature: 0, json: true },
    check: r => {
      const m = (r.text || "").match(/\{[\s\S]*\}/);
      if (!m) return pxText("JSON پیدا نشد");
      try { const j = JSON.parse(m[0]); return j.ok === true && Number(j.n) === 7 ? null : pxText("مقادیر JSON مطابق نبود"); }
      catch { return pxText("JSON نامعتبر"); }
    },
    capability: "json"
  },
  coding: {
    label: "Coding",
    messages: [{ role: "user", content: "Write a JavaScript function named add that returns the sum of two args. Code only." }],
    opts: { maxTokens: 160, temperature: 0 },
    check: r => /function\s+add|const\s+add\s*=|add\s*=\s*\(/.test(r.text || "") ? null : pxText("کد معتبر تولید نشد"),
    capability: "chat"
  },
  reasoning: {
    label: "Reasoning",
    messages: [{ role: "user", content: "A bat and ball cost $1.10. The bat costs $1.00 more than the ball. How much is the ball? Answer with the number only in dollars." }],
    opts: { maxTokens: 200, temperature: 0 },
    check: r => /0?\.05|5\s*cents|۵/.test(r.text || "") ? null : pxText("پاسخ استدلالی نادرست"),
    capability: "reasoning"
  },
  multilingual: {
    label: "Multilingual",
    messages: [{ role: "user", content: "Translate to Persian, output only the translation: Good morning" }],
    opts: { maxTokens: 60, temperature: 0 },
    check: r => /[\u0600-\u06FF]/.test(r.text || "") ? null : pxText("خروجی فارسی نبود"),
    capability: "chat"
  },
  longContext: {
    label: "Long Context",
    messages: [{
      role: "user",
      content: `Here is a list.\n${Array.from({ length: 400 }, (_, i) => `item-${i}: value-${i}`).join("\n")}\n\nWhat is the value of item-377? Answer with the value only.`
    }],
    opts: { maxTokens: 40, temperature: 0 },
    check: r => /value-377/.test(r.text || "") ? null : pxText("بازیابی از متن بلند ناموفق"),
    capability: "longContext"
  },
  tools: {
    label: "Tool Calling",
    messages: [{ role: "user", content: "What's the weather in Tehran? Use the get_weather tool." }],
    opts: {
      maxTokens: 120, temperature: 0,
      tools: [{
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather for a city",
          parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] }
        }
      }]
    },
    check: r => (r.toolCalls || []).some(t => t.name === "get_weather") ? null : pxText("tool_call برنگشت"),
    capability: "tools"
  },
  vision: {
    label: "Vision",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "What color is this image? One word." },
        { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8Dwn4GBgYGRgYEBAB3+Av8FZjWiAAAAAElFTkSuQmCC" } }
      ]
    }],
    opts: { maxTokens: 30, temperature: 0 },
    check: r => (r.text || "").trim() ? null : pxText("پاسخ تصویری خالی"),
    capability: "vision"
  },
  errorHandling: {
    label: "Error Handling",
    messages: [{ role: "user", content: "" }],
    opts: { maxTokens: 16 },
    expectFailure: true,
    check: () => null,
    capability: "chat"
  }
};

export const DEFAULT_TESTS = ["basic", "streaming", "json"];

export async function runModelTest(env, model, testKey, opts = {}) {
  const t = TEST_SUITE[testKey];
  if (!t) throw new Error(pxTemplate`تست ${testKey} وجود ندارد`);
  const provider = await getProvider(env, model.providerId);
  if (!provider) throw new Error(pxText("پروایدر مدل یافت نشد"));
  const t0 = Date.now();
  try {
    const callOpts = { ...t.opts, timeout: opts.timeout || 40000 };
    if (t.opts.stream) { callOpts.onChunk = () => {}; delete callOpts.stream; }
    const res = await callChat(env, provider, model.apiModelId, t.messages, callOpts);
    const problem = t.check(res);
    return {
      test: testKey, label: t.label, ok: !problem, error: problem || null,
      latency: res.latency, ms: Date.now() - t0,
      promptTokens: res.promptTokens, completionTokens: res.completionTokens,
      sample: (res.text || "").slice(0, 400), toolCalls: (res.toolCalls || []).length,
      ts: nowIso()
    };
  } catch (e) {
    return {
      test: testKey, label: t.label,
      ok: !!t.expectFailure, error: t.expectFailure ? null : String(e.message || e).slice(0, 200),
      latency: null, ms: Date.now() - t0, ts: nowIso()
    };
  }
}

// اجرای مجموعهای از تستها + بهروزرسانی قابلیتها و سلامت
export async function testModel(env, modelId, tests = DEFAULT_TESTS, userId = 0) {
  const model = await getModel(env, modelId);
  if (!model) throw new Error(pxText("مدل یافت نشد"));
  const results = [];
  for (const key of tests) {
    if (!TEST_SUITE[key]) continue;
    const r = await runModelTest(env, model, key);
    results.push(r);
    const cap = TEST_SUITE[key].capability;
    if (cap && model.capabilities?.[cap]) {
      model.capabilities[cap] = { supported: r.ok, confidence: r.ok ? 95 : 90, source: "probe", ts: r.ts };
    }
  }
  const basic = results.find(r => r.test === "basic") || results[0];
  const passed = results.filter(r => r.ok).length;
  const lats = results.filter(r => r.latency).map(r => r.latency);
  model.latency = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : model.latency || null;
  model.status = basic?.ok ? "healthy" : (passed > 0 ? "degraded" : "failed");
  model.errorRate = results.length ? Math.round(((results.length - passed) / results.length) * 100) : model.errorRate || 0;
  model.lastChecked = nowIso();
  model.lastError = results.find(r => !r.ok)?.error || null;
  model.tests = [{ ts: nowIso(), results, passed, total: results.length }, ...(model.tests || [])].slice(0, 10);
  await saveModel(env, model);
  await audit(env, { userId, action: "model.test", resource: model.id, result: model.status, meta: { passed, total: results.length, model: model.apiModelId } });
  return { model, results, passed, total: results.length };
}

// تست همه مدلهای یک پروایدر (با محدودیت همزمانی برای CPU workers)
export async function testModels(env, modelIds, tests = DEFAULT_TESTS, { concurrency = 4, onProgress, userId = 0 } = {}) {
  const out = [];
  let done = 0;
  for (let i = 0; i < modelIds.length; i += concurrency) {
    const batch = modelIds.slice(i, i + concurrency);
    const rs = await Promise.all(batch.map(async id => {
      try { return await testModel(env, id, tests, userId); }
      catch (e) { return { model: { id }, results: [], passed: 0, total: 0, error: String(e.message || e) }; }
    }));
    out.push(...rs);
    done += batch.length;
    if (onProgress) await onProgress({ done, total: modelIds.length, results: out });
  }
  return out;
}

// ثبت مصرف واقعی روی مدل
export async function recordModelUsage(env, modelId, { ok, latency, promptTokens = 0, completionTokens = 0, cost = 0, error = null }) {
  const m = await getModel(env, modelId);
  if (!m) return;
  m.stats = m.stats || { req: 0, ok: 0, fail: 0, latSum: 0, latN: 0, tokensIn: 0, tokensOut: 0, cost: 0 };
  m.stats.req++;
  if (ok) {
    m.stats.ok++;
    if (latency) { m.stats.latSum += latency; m.stats.latN++; m.latency = Math.round(m.stats.latSum / m.stats.latN); }
    m.stats.tokensIn += promptTokens; m.stats.tokensOut += completionTokens; m.stats.cost += cost;
    m.status = "healthy"; m.failStreak = 0; m.disabledUntil = 0; m.lastError = null;
  } else {
    m.stats.fail++;
    m.failStreak = (m.failStreak || 0) + 1;
    m.lastError = String(error || "").slice(0, 200);
    if (m.failStreak >= 3) { m.status = "failed"; m.disabledUntil = Date.now() + 20 * 60000; }
    else m.status = "degraded";
  }
  const total = m.stats.ok + m.stats.fail;
  m.errorRate = total ? Math.round((m.stats.fail / total) * 100) : 0;
  m.lastChecked = nowIso();
  await saveModel(env, m);
}

export function isModelAvailable(m) {
  if (!m.enabled) return false;
  if (m.status === "failed" && (m.disabledUntil || 0) > Date.now()) return false;
  if (!m.capabilities?.chat?.supported) return false;
  return true;
}

export function costPer1M(m) {
  const p = m?.pricing;
  if (p && (Number(p.inputPer1M) || Number(p.outputPer1M))) {
    return (Number(p.inputPer1M) || 0) + (Number(p.outputPer1M) || 0);
  }
  if (p?.free) return 0;
  const mid = String(m?.apiModelId || m?.name || "").toLowerCase();
  for (const kp of KNOWN_MODEL_PRICES) {
    if (kp.pattern.test(mid)) return kp.input + kp.output;
  }
  return 0;
}

export function estimateCost(m, promptTokens = 0, completionTokens = 0) {
  const p = m?.pricing;
  if (p?.free) return 0;
  let inP = Number(p?.inputPer1M || 0);
  let outP = Number(p?.outputPer1M || 0);
  if (inP === 0 && outP === 0) {
    const mid = String(m?.apiModelId || m?.name || "").toLowerCase();
    for (const kp of KNOWN_MODEL_PRICES) {
      if (kp.pattern.test(mid)) { inP = kp.input; outP = kp.output; break; }
    }
  }
  return ((inP * promptTokens) + (outP * completionTokens)) / 1_000_000;
}

// ─────────────────────────────────────────────
// 🏅 Model Score
// ─────────────────────────────────────────────
export const DEFAULT_WEIGHTS = { quality: 40, speed: 20, reliability: 20, cost: 10, capabilities: 10 };

export async function getWeights(env) {
  return { ...DEFAULT_WEIGHTS, ...(await kvGet(env, "settings:weights", {})) };
}
export async function setWeights(env, w) {
  const clean = {};
  for (const k of Object.keys(DEFAULT_WEIGHTS)) clean[k] = Math.max(0, Number(w[k] ?? DEFAULT_WEIGHTS[k]));
  await kvPut(env, "settings:weights", clean);
  return clean;
}

export function scoreModel(m, weights = DEFAULT_WEIGHTS, ctxAll = []) {
  const bench = m.benchmarks?.[0] || null;
  const quality = bench?.qualityScore ?? (m.tests?.[0] ? (m.tests[0].passed / Math.max(1, m.tests[0].total)) * 100 : null);
  const lat = m.latency || bench?.avgLatency || null;
  const speed = lat ? Math.max(0, 100 - Math.min(100, (lat - 300) / 60)) : null;
  const reliability = m.stats?.req ? Math.round(((m.stats.ok || 0) / m.stats.req) * 100) : (m.status === "healthy" ? 80 : null);
  const c = costPer1M(m);
  const maxCost = Math.max(1, ...ctxAll.map(x => costPer1M(x) || 0));
  const cost = c === null ? null : Math.round(100 - Math.min(100, (c / maxCost) * 100));
  const capCount = Object.values(m.capabilities || {}).filter(v => v.supported).length;
  const capabilities = Math.min(100, Math.round((capCount / 8) * 100));

  const parts = { quality, speed, reliability, cost, capabilities };
  let sum = 0, wsum = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (parts[k] === null || parts[k] === undefined) continue;
    sum += parts[k] * w; wsum += w;
  }
  return {
    overall: wsum ? Math.round(sum / wsum) : null,
    quality: quality === null ? null : Math.round(quality),
    speed: speed === null ? null : Math.round(speed),
    reliability, cost, capabilities
  };
}

// ─────────────────────────────────────────────
// Phase 13: Model & Provider Reliability Tracking
// ─────────────────────────────────────────────

// Removed duplicate recordModelUsage function - using the original at line 508

/**
 * Get model reliability score (0-100)
 * @param {object} model - Model object
 * @returns {number} Reliability score
 */
export function getModelReliability(model) {
  if (!model.reliability || model.reliability.totalCalls === 0) {
    return 50; // Neutral score for new models
  }
  
  const r = model.reliability;
  
  // Base score from success rate
  let score = r.successRate;
  
  // Penalty for high latency (>5s avg)
  if (r.avgLatency > 5000) {
    score -= 10;
  } else if (r.avgLatency > 10000) {
    score -= 20;
  }
  
  // Bonus for consistent performance (low variance)
  if (r.history.length >= 10) {
    const recentSuccesses = r.history.slice(-10).filter(h => h.success).length;
    const consistency = (recentSuccesses / 10) * 100;
    if (consistency >= 90) {
      score += 5; // Bonus for very consistent
    } else if (consistency <= 30) {
      score -= 10; // Penalty for inconsistent
    }
  }
  
  // Penalty for insufficient data (< 10 calls)
  if (r.totalCalls < 10) {
    score *= 0.8; // 20% reduction for low sample size
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get reliability metrics for all models grouped by provider
 * @param {object} env - Worker environment
 * @returns {object} Provider reliability scores
 */
export async function getProviderReliability(env) {
  const models = await listModels(env);
  const byProvider = {};
  
  for (const model of models) {
    const providerId = model.providerId || "unknown";
    if (!byProvider[providerId]) {
      byProvider[providerId] = {
        providerId,
        providerName: model.providerName,
        totalModels: 0,
        activeModels: 0,
        avgReliability: 0,
        totalCalls: 0,
        successRate: 0,
        avgLatency: 0,
        models: []
      };
    }
    
    byProvider[providerId].totalModels++;
    
    if (model.reliability && model.reliability.totalCalls > 0) {
      byProvider[providerId].activeModels++;
      byProvider[providerId].totalCalls += model.reliability.totalCalls;
      byProvider[providerId].models.push({
        id: model.id,
        name: model.displayName || model.apiModelId,
        reliability: getModelReliability(model),
        successRate: model.reliability.successRate,
        avgLatency: model.reliability.avgLatency,
        totalCalls: model.reliability.totalCalls
      });
    }
  }
  
  // Calculate aggregate metrics
  for (const p of Object.values(byProvider)) {
    if (p.activeModels > 0) {
      p.avgReliability = Math.round(
        p.models.reduce((sum, m) => sum + m.reliability, 0) / p.activeModels
      );
      p.successRate = Math.round(
        p.models.reduce((sum, m) => sum + (m.successRate || 0), 0) / p.activeModels
      );
      p.avgLatency = Math.round(
        p.models.reduce((sum, m) => sum + (m.avgLatency || 0), 0) / p.activeModels
      );
    }
  }
  
  return byProvider;
}

/**
 * Get top N most reliable models
 * @param {object} env - Worker environment
 * @param {number} limit - Number of models to return
 * @returns {Array} Top reliable models
 */
export async function getTopReliableModels(env, limit = 10) {
  const models = await listModels(env);
  const withReliability = models
    .filter(m => m.reliability && m.reliability.totalCalls >= 5) // Min 5 calls
    .map(m => ({
      id: m.id,
      name: m.displayName || m.apiModelId,
      provider: m.providerName,
      reliability: getModelReliability(m),
      successRate: m.reliability.successRate,
      avgLatency: m.reliability.avgLatency,
      totalCalls: m.reliability.totalCalls
    }))
    .sort((a, b) => b.reliability - a.reliability);
  
  return withReliability.slice(0, limit);
}

/**
 * Calculate reliability score for council answer
 * Takes into account model and provider reliability
 */
export function calculateAnswerReliability(model, provider) {
  let score = 50; // Base score
  
  if (model.reliability) {
    const modelScore = getModelReliability(model);
    score = (score + modelScore) / 2; // Weighted average
  }
  
  // Provider health influence
  if (provider && provider.status) {
    if (provider.status === "healthy") score += 10;
    else if (provider.status === "degraded") score -= 10;
    else if (provider.status === "down") score -= 30;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}
