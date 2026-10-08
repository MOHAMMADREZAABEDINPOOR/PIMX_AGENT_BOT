// ─────────────────────────────────────────────
// Built-in provider seeding.
//
// Disabled by default: the Mini App must only ever show providers and models
// that the user added explicitly. Set SEED_BUILTINS="1" in the environment to
// re-enable importing the legacy bot keys into the platform registry.
//
// purgeBuiltins() removes anything a previous version auto-seeded so existing
// deployments converge on an empty registry.
// ─────────────────────────────────────────────
import { kvGet, kvPut, nowIso } from "../core/kv.js";
import { createProvider, listProviders, updateProvider, deleteProvider } from "./providers.js";
import { upsertModel, listModels, saveModel, deleteModel } from "./models.js";

const SEED_FLAG = "seed:builtins:v2";
const PURGE_FLAG = "seed:purged:v1";

const BUILTIN_MODELS = {
  nvidia: [
    { id: "meta/llama-3.3-70b-instruct", caps: ["chat", "streaming"] },
    { id: "meta/llama-3.1-70b-instruct", caps: ["chat", "streaming"] },
    { id: "meta/llama-3.1-8b-instruct", caps: ["chat", "streaming"] },
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1", caps: ["chat", "reasoning"] },
    { id: "meta/llama-3.2-11b-vision-instruct", caps: ["chat", "vision"] },
    { id: "mistralai/mixtral-8x7b-instruct-v0.1", caps: ["chat"] },
    { id: "qwen/qwen2.5-coder-32b-instruct", caps: ["chat"] }
  ],
  openrouter: [
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", caps: ["chat", "reasoning"] },
    { id: "nvidia/nemotron-3-super-120b-a12b:free", caps: ["chat", "reasoning"] },
    { id: "nvidia/nemotron-3-nano-30b-a3b:free", caps: ["chat"] },
    { id: "nvidia/nemotron-nano-9b-v2:free", caps: ["chat"] },
    { id: "poolside/laguna-m.1:free", caps: ["chat"] },
    { id: "poolside/laguna-xs-2.1:free", caps: ["chat"] },
    { id: "cohere/north-mini-code:free", caps: ["chat"] },
    { id: "openai/gpt-oss-20b:free", caps: ["chat", "reasoning"] },
    { id: "google/gemma-4-26b-a4b-it:free", caps: ["chat", "vision"] },
    { id: "nvidia/nemotron-3.5-content-safety:free", caps: ["chat"] }
  ],
  mistral: [
    { id: "mistral-large-latest", caps: ["chat", "streaming", "json", "vision"] },
    { id: "mistral-medium-latest", caps: ["chat", "streaming"] },
    { id: "codestral-latest", caps: ["chat"] }
  ],
  gemini: [
    { id: "gemini-flash-latest", caps: ["chat", "streaming", "vision", "json"] },
    { id: "gemini-flash-lite-latest", caps: ["chat", "streaming", "vision"] }
  ]
};

export async function purgeBuiltins(env) {
  if (!env?.BOT_KV) return { skipped: true };
  if (await kvGet(env, PURGE_FLAG, null)) return { already: true };

  const providers = await listProviders(env);
  const builtins = providers.filter(p =>
    p.builtin === true || (p.tags || []).some(t => t === "builtin" || String(t).indexOf("builtin:") === 0)
  );

  let removedModels = 0;
  for (const p of builtins) {
    const models = await listModels(env, { providerId: p.id });
    for (const m of models) { await deleteModel(env, m.id, 0); removedModels++; }
    await deleteProvider(env, p.id, 0);
  }

  const orphans = (await listModels(env)).filter(m => (m.tags || []).indexOf("builtin") >= 0);
  for (const m of orphans) { await deleteModel(env, m.id, 0); removedModels++; }

  await kvPut(env, PURGE_FLAG, { at: nowIso(), providers: builtins.map(p => p.name), models: removedModels });
  return { purgedProviders: builtins.length, purgedModels: removedModels };
}

export async function seedBuiltins(env, sources = {}) {
  if (!env?.BOT_KV) return { skipped: true };
  if (env.SEED_BUILTINS !== "1") return await purgeBuiltins(env);

  const flag = await kvGet(env, SEED_FLAG, null);
  const existing = await listProviders(env);
  const findBuiltin = (slug, baseUrl) =>
    existing.find(p => (p.tags || []).includes(`builtin:${slug}`)) ||
    existing.find(p => p.builtin && p.baseUrl === baseUrl);

  const wanted = [];
  if (sources.nvidiaKeys?.length) {
    wanted.push({
      slug: "nvidia", name: "NVIDIA NIM",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      keys: sources.nvidiaKeys, format: "openai", auth: "bearer", priority: 10,
      description: "NVIDIA NIM OpenAI-compatible endpoint"
    });
  }
  if (sources.openrouterKey) {
    wanted.push({
      slug: "openrouter", name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      keys: [sources.openrouterKey], format: "openai", auth: "bearer", priority: 8,
      description: "OpenRouter multi-model gateway"
    });
  }
  if (sources.mistralKey) {
    wanted.push({
      slug: "mistral", name: "Mistral",
      baseUrl: "https://api.mistral.ai/v1",
      keys: [sources.mistralKey], format: "openai", auth: "bearer", priority: 7,
      description: "Mistral AI"
    });
  }
  if (sources.geminiKeys?.length) {
    wanted.push({
      slug: "gemini", name: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      keys: sources.geminiKeys, format: "gemini", auth: "query", authQuery: "key", priority: 9,
      description: "Google Gemini generateContent API"
    });
  }

  // Fast path: all builtins already present
  if (flag && wanted.every(w => findBuiltin(w.slug, w.baseUrl))) {
    return { already: true, totalProviders: existing.length };
  }

  const created = [];
  const updated = [];

  for (const def of wanted) {
    const tag = `builtin:${def.slug}`;
    let p = findBuiltin(def.slug, def.baseUrl);
    if (!p) {
      p = await createProvider(env, {
        name: def.name,
        baseUrl: def.baseUrl,
        apiKeys: def.keys,
        format: def.format || "openai",
        auth: def.auth || "bearer",
        authQuery: def.authQuery,
        tags: [tag, "builtin"],
        description: def.description,
        builtin: true,
        priority: def.priority || 0,
        enabled: true
      }, 0);
      created.push(p.name);
      existing.push(p);
    } else if (def.keys?.length && (!p.keys || p.keys.length < Math.min(def.keys.length, 3))) {
      // only top-up keys if registry has fewer than expected (avoid re-encrypting 30 keys every boot)
      p = await updateProvider(env, p.id, { apiKeys: def.keys.slice(0, 8) }, 0);
      updated.push(p.name);
    }

    const catalog = BUILTIN_MODELS[def.slug] || [];
    const have = new Set((await listModels(env, { providerId: p.id })).map(m => m.apiModelId));
    for (const m of catalog) {
      if (have.has(m.id) && flag) continue;
      const { model } = await upsertModel(env, p, m.id, {
        capabilities: m.caps,
        tags: ["builtin", def.slug]
      });
      if (model.status === "unknown") {
        model.status = "healthy";
        model.enabled = true;
        model.lastChecked = nowIso();
        await saveModel(env, model);
      }
    }
  }

  await kvPut(env, SEED_FLAG, { at: nowIso(), created, updated });
  return {
    created, updated,
    totalProviders: (await listProviders(env)).length,
    totalModels: (await listModels(env)).length
  };
}
