// تست زنده OpenRouter + Mistral — node test-providers.mjs
const OR_KEY = process.env.OPENROUTER_API_KEY;
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
if (!OR_KEY || !MISTRAL_KEY) throw new Error("Set OPENROUTER_API_KEY and MISTRAL_API_KEY");

const OR_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "poolside/laguna-m.1:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "cohere/north-mini-code:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-content-safety:free",
];
const MISTRAL_MODELS = ["mistral-large-latest", "codestral-latest", "mistral-medium-latest"];

async function test(url, key, model, extraHeaders = {}) {
  const ctrl = AbortSignal.timeout(45000);
  try {
    const res = await fetch(url, {
      method: "POST", signal: ctrl,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Say OK" }], max_tokens: 10, stream: false }),
    });
    const body = await res.text();
    if (!res.ok) return { model, ok: false, status: res.status, detail: body.slice(0, 140).replace(/\s+/g, " ") };
    const j = JSON.parse(body);
    return { model, ok: true, sample: String(j.choices?.[0]?.message?.content ?? "").slice(0, 20) };
  } catch (e) {
    return { model, ok: false, status: 0, detail: String(e.message).slice(0, 80) };
  }
}

console.log("===== OpenRouter =====");
for (let i = 0; i < OR_MODELS.length; i += 3) {
  const r = await Promise.all(OR_MODELS.slice(i, i + 3).map(m =>
    test("https://openrouter.ai/api/v1/chat/completions", OR_KEY, m)));
  r.forEach(x => console.log(`${x.ok ? "✅" : "❌"} ${x.model} [${x.status ?? 200}] ${x.ok ? "" : x.detail}`));
}

console.log("\n===== Mistral =====");
for (const m of MISTRAL_MODELS) {
  const x = await test("https://api.mistral.ai/v1/chat/completions", MISTRAL_KEY, m);
  console.log(`${x.ok ? "✅" : "❌"} ${x.model} [${x.status ?? 200}] ${x.ok ? "" : x.detail}`);
}

console.log("\n===== Mistral Embeddings =====");
try {
  const res = await fetch("https://api.mistral.ai/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${MISTRAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "mistral-embed", input: ["سلام دنیا"] }),
  });
  const j = await res.json();
  const dim = j.data?.[0]?.embedding?.length;
  console.log(dim ? `✅ mistral-embed — بردار ${dim} بعدی` : `❌ mistral-embed: ${JSON.stringify(j).slice(0, 140)}`);
} catch (e) { console.log("❌ mistral-embed:", e.message); }
