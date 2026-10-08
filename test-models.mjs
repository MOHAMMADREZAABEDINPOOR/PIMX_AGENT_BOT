// تست زنده مدل‌های NVIDIA NIM — node test-models.mjs
const KEYS = JSON.parse(process.env.NVIDIA_KEYS_JSON || "[]");
if (!Array.isArray(KEYS) || !KEYS.length || KEYS.some(key => typeof key !== "string" || !key.trim())) {
  throw new Error("Set NVIDIA_KEYS_JSON to a non-empty JSON array of API keys");
}

const MODELS = [
  // لیست فعلی ربات
  "meta/llama-3.3-70b-instruct",
  "mistralai/mistral-large-2-instruct",
  "qwen/qwen3-235b-a22b",
  "google/gemma-3-27b-it",
  "microsoft/phi-4-mini-instruct",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "qwen/qwen2.5-coder-32b-instruct",
  "deepseek-ai/deepseek-coder-33b-instruct",
  "meta/codellama-70b-instruct",
  "ibm/granite-34b-code-instruct",
  "meta/llama-3.2-90b-vision-instruct",
  "meta/llama-3.2-11b-vision-instruct",
  "microsoft/phi-3.5-vision-instruct",
  "qwen/qwen2-vl-72b-instruct",
  "nvidia/neva-22b",
  "deepseek-ai/deepseek-r1",
  "qwen/qwq-32b",
  "nvidia/nemotron-4-340b-instruct",
  "mistralai/mixtral-8x22b-instruct-v0.1",
  "cohere/aya-expanse-32b",
  "cohere/aya-expanse-8b",
  "qwen/qwen2.5-72b-instruct",
  // کاندیداهای جایگزین
  "meta/llama-3.1-405b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.1-8b-instruct",
  "meta/llama-4-maverick-17b-128e-instruct",
  "meta/llama-4-scout-17b-16e-instruct",
  "mistralai/mixtral-8x7b-instruct-v0.1",
  "mistralai/mistral-7b-instruct-v0.3",
  "google/gemma-2-27b-it",
  "google/gemma-2-9b-it",
  "microsoft/phi-3-medium-128k-instruct",
  "microsoft/phi-4",
  "deepseek-ai/deepseek-r1-distill-qwen-32b",
  "deepseek-ai/deepseek-r1-distill-llama-8b",
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "nvidia/llama-3.1-nemotron-nano-8b-v1",
  "qwen/qwen3-32b",
  "qwen/qwen2.5-7b-instruct",
  "writer/palmyra-creative-122b",
  "ibm/granite-3.0-8b-instruct",
];

let ki = 0;
const nextKey = () => KEYS[ki++ % KEYS.length];

async function testModel(model) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${nextKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 10, stream: false,
      }),
    });
    clearTimeout(t);
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 120).replace(/\s+/g, " "); } catch {}
      return { model, ok: false, status: res.status, detail };
    }
    const j = await res.json();
    const txt = j.choices?.[0]?.message?.content ?? "";
    return { model, ok: true, status: 200, sample: String(txt).slice(0, 30).replace(/\s+/g, " ") };
  } catch (e) {
    clearTimeout(t);
    return { model, ok: false, status: 0, detail: String(e.message || e).slice(0, 80) };
  }
}

// اجرا با هم‌زمانی ۵تایی
const results = [];
for (let i = 0; i < MODELS.length; i += 5) {
  const batch = MODELS.slice(i, i + 5);
  const r = await Promise.all(batch.map(testModel));
  results.push(...r);
  for (const x of r) {
    console.log(`${x.ok ? "✅" : "❌"} ${x.model}  [${x.status}]${x.ok ? "" : " " + (x.detail || "")}`);
  }
}

console.log("\n===== WORKING =====");
results.filter(r => r.ok).forEach(r => console.log(r.model));
console.log("\n===== BROKEN =====");
results.filter(r => !r.ok).forEach(r => console.log(`${r.model} (${r.status})`));
