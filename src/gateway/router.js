// ─────────────────────────────────────────────
// 🧭 Intelligent Router — انتخاب مدل، Load Balancing، Failover
// ─────────────────────────────────────────────
import { kvGet, kvPut, newId, nowIso } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { getProvider, listProviders } from "./providers.js";
import { callChat } from "./client.js";
import {
  listModels, getModel, isModelAvailable, costPer1M, estimateCost,
  recordModelUsage, scoreModel, getWeights, TASK_CAPS
} from "./models.js";

export const POLICIES = {
  balanced: { label: "متعادل", weights: { quality: 35, speed: 25, reliability: 25, cost: 15 } },
  quality: { label: "کیفیت", weights: { quality: 65, speed: 10, reliability: 20, cost: 5 } },
  speed: { label: "سرعت", weights: { quality: 15, speed: 60, reliability: 20, cost: 5 } },
  cost: { label: "هزینه", weights: { quality: 15, speed: 15, reliability: 20, cost: 50 } }
};

export const LB_STRATEGIES = ["adaptive", "roundRobin", "leastLatency", "lowestCost", "weighted"];

const CFG_KEY = "settings:routing";

export async function getRoutingConfig(env) {
  const cfg = await kvGet(env, CFG_KEY, {});
  return {
    policy: cfg.policy || "balanced",
    strategy: cfg.strategy || "adaptive",
    maxFallbacks: cfg.maxFallbacks ?? 3,
    defaultModelId: cfg.defaultModelId || null,
    rules: cfg.rules || [],
    latencyLimitMs: cfg.latencyLimitMs || 0,
    monthlyBudget: cfg.monthlyBudget || 0,
    enableCache: cfg.enableCache !== false, // Cache enabled by default
    cacheTTL: cfg.cacheTTL || 3600 // Default 1 hour
  };
}

export async function setRoutingConfig(env, patch, userId = 0) {
  const cfg = await getRoutingConfig(env);
  const next = { ...cfg, ...patch };
  if (patch.policy && !POLICIES[patch.policy]) throw new Error("policy نامعتبر");
  if (patch.strategy && !LB_STRATEGIES.includes(patch.strategy)) throw new Error("strategy نامعتبر");
  await kvPut(env, CFG_KEY, next);
  await audit(env, { userId, action: "routing.update", resource: "config", meta: { fields: Object.keys(patch) } });
  return next;
}

export async function addRule(env, rule, userId = 0) {
  const cfg = await getRoutingConfig(env);
  const r = {
    id: newId("rule"),
    task: String(rule.task || "chat"),
    providerId: rule.providerId || null,
    modelId: rule.modelId || null,
    fallbackModelIds: rule.fallbackModelIds || [],
    priority: Number(rule.priority || 0),
    enabled: rule.enabled !== false,
    createdAt: nowIso()
  };
  cfg.rules = [...cfg.rules, r].sort((a, b) => b.priority - a.priority);
  await kvPut(env, CFG_KEY, cfg);
  await audit(env, { userId, action: "routing.rule.add", resource: r.id, meta: { task: r.task } });
  return r;
}

export async function deleteRule(env, ruleId, userId = 0) {
  const cfg = await getRoutingConfig(env);
  cfg.rules = cfg.rules.filter(r => r.id !== ruleId);
  await kvPut(env, CFG_KEY, cfg);
  await audit(env, { userId, action: "routing.rule.delete", resource: ruleId });
  return cfg.rules;
}

// ─────────────────────────────────────────────
// 🔍 تشخیص نوع درخواست
// ─────────────────────────────────────────────
export function classifyTask(text, opts = {}) {
  if (opts.task) return opts.task;
  const t = String(text || "").toLowerCase();
  if (opts.hasImage) return "vision";
  if (/\b(code|function|bug|debug|refactor|python|javascript|typescript|sql|regex)\b|کد|برنامه|باگ|تابع/.test(t)) return "coding";
  if (/\b(translate)\b|ترجمه/.test(t)) return "translation";
  if (/\b(summar)\w*|خلاصه/.test(t)) return "summarization";
  if (/\b(research|investigate|sources)\b|تحقیق|منابع/.test(t)) return "research";
  if (/\b(prove|solve|why|logic|step by step)\b|چرا|اثبات|حل کن/.test(t)) return "reasoning";
  if (/\b(csv|dataset|statistics|analyz)\w*|تحلیل داده|آمار/.test(t)) return "data";
  if (/\b(write|essay|story|poem|post)\b|بنویس|داستان|مقاله/.test(t)) return "writing";
  if ((text || "").length > 8000) return "longContext";
  return "chat";
}

function requiredCaps(task) { return TASK_CAPS[task] || ["chat"]; }

function eligible(models, task, opts = {}) {
  const caps = requiredCaps(task);
  return models.filter(m => {
    if (!isModelAvailable(m) && !(task === "embedding" && m.capabilities?.embedding?.supported)) return false;
    for (const c of caps) {
      if (c === "chat" && task === "embedding") continue;
      if (!m.capabilities?.[c]?.supported) return false;
    }
    if (opts.minContext && (m.contextWindow || 0) < opts.minContext) return false;
    if (opts.maxLatency && m.latency && m.latency > opts.maxLatency) return false;
    if (opts.freeOnly && !(m.pricing?.free ?? costPer1M(m) === 0)) return false;
    if (opts.providerId && m.providerId !== opts.providerId) return false;
    return true;
  });
}

function applyStrategy(candidates, strategy, weights, allModels) {
  const scored = candidates.map(m => ({ m, s: scoreModel(m, weights, allModels) }));
  switch (strategy) {
    case "leastLatency":
      return scored.sort((a, b) => (a.m.latency || 9e9) - (b.m.latency || 9e9)).map(x => x.m);
    case "lowestCost":
      return scored.sort((a, b) => (costPer1M(a.m) ?? 9e9) - (costPer1M(b.m) ?? 9e9) || (a.m.latency || 9e9) - (b.m.latency || 9e9)).map(x => x.m);
    case "roundRobin": {
      const sorted = scored.sort((a, b) => (a.m.stats?.req || 0) - (b.m.stats?.req || 0));
      return sorted.map(x => x.m);
    }
    case "weighted": {
      return scored.sort((a, b) => ((b.s.overall || 0) * (b.m.weight || 1)) - ((a.s.overall || 0) * (a.m.weight || 1))).map(x => x.m);
    }
    default: { // adaptive: امتیاز کل + جریمه خطای اخیر
      return scored.sort((a, b) => {
        const pa = (a.s.overall || 0) - (a.m.failStreak || 0) * 15;
        const pb = (b.s.overall || 0) - (b.m.failStreak || 0) * 15;
        return pb - pa;
      }).map(x => x.m);
    }
  }
}

// انتخاب زنجیره مدل (اصلی + fallbackها) بر اساس رجیستری واقعی
export async function selectModels(env, { text = "", task, opts = {} } = {}) {
  const cfg = await getRoutingConfig(env);
  const all = await listModels(env);
  const resolvedTask = task || classifyTask(text, opts);
  const weights = { ...(POLICIES[opts.policy || cfg.policy]?.weights || POLICIES.balanced.weights) };
  const globalWeights = await getWeights(env);
  const merged = { ...globalWeights, ...weights };

  const chain = [];
  const push = m => { if (m && !chain.find(x => x.id === m.id)) chain.push(m); };

  // ۱) مدل صریح
  if (opts.modelId) push(all.find(m => m.id === opts.modelId || m.slug === opts.modelId));
  // ۲) قوانین مسیریابی
  const rule = cfg.rules.find(r => r.enabled && r.task === resolvedTask);
  if (rule) {
    if (rule.modelId) push(all.find(m => m.id === rule.modelId));
    if (rule.providerId) for (const m of applyStrategy(eligible(all, resolvedTask, { ...opts, providerId: rule.providerId }), cfg.strategy, merged, all)) push(m);
    for (const fid of rule.fallbackModelIds || []) push(all.find(m => m.id === fid));
  }
  // ۳) مدل پیشفرض
  if (cfg.defaultModelId && !opts.modelId) push(all.find(m => m.id === cfg.defaultModelId));
  // ۴) کاندیدهای مناسب تسک
  const cands = eligible(all, resolvedTask, { ...opts, maxLatency: opts.maxLatency || cfg.latencyLimitMs || 0 });
  for (const m of applyStrategy(cands, opts.strategy || cfg.strategy, merged, all)) push(m);
  // ۵) در نهایت هر مدل چت سالم
  if (chain.length < 2) for (const m of applyStrategy(eligible(all, "chat"), "adaptive", merged, all)) push(m);

  return { task: resolvedTask, chain: chain.slice(0, 1 + (cfg.maxFallbacks ?? 3)), config: cfg, weights: merged, total: all.length };
}

// اجرای واقعی درخواست با failover و caching
export async function route(env, messages, opts = {}) {
  const text = typeof opts.text === "string" ? opts.text : messages.filter(m => m.role === "user").map(m => (typeof m.content === "string" ? m.content : "")).join(" ");
  const { task, chain, config } = await selectModels(env, { text, task: opts.task, opts });
  if (!chain.length) throw new Error("هیچ مدل سالمی در رجیستری موجود نیست. ابتدا یک پروایدر اضافه کنید.");

  // Try cache first (if enabled and not streaming and not explicitly disabled)
  const useCache = config.enableCache && !opts.onChunk && !opts.skipCache && opts.useCache !== false;
  
  if (useCache) {
    const model = chain[0];
    const provider = await getProvider(env, model.providerId);
    if (provider && provider.enabled !== false) {
      try {
        const { callChatWithCache } = await import("./cache.js");
        const cacheOpts = {
          ...opts,
          projectId: opts.projectId,
          memoryContext: opts.memoryContext,
          userId: opts.userId,
          modelVersion: model.version
        };
        const res = await callChatWithCache(env, provider, model.apiModelId, messages, cacheOpts);
        
        if (res.cacheHit) {
          // Return cached response immediately
          const cost = estimateCost(model, res.promptTokens, res.completionTokens);
          return {
            ...res,
            task,
            cost,
            modelId: model.id,
            displayName: model.displayName,
            attempts: [],
            failover: false,
            chainLength: chain.length,
            cached: true
          };
        }
        
        // Cache miss, but response stored - return it
        if (res.cached === false) {
          const cost = estimateCost(model, res.promptTokens, res.completionTokens);
          await recordModelUsage(env, model.id, { ok: true, latency: res.latency, promptTokens: res.promptTokens, completionTokens: res.completionTokens, cost });
          return {
            ...res,
            task,
            cost,
            modelId: model.id,
            displayName: model.displayName,
            attempts: [],
            failover: false,
            chainLength: chain.length
          };
        }
      } catch (cacheError) {
        // Cache error, fall through to regular flow
        console.error("[Router] Cache error, falling back to direct call:", cacheError);
      }
    }
  }

  const attempts = [];
  for (const model of chain) {
    opts.signal?.throwIfAborted();
    const provider = await getProvider(env, model.providerId);
    if (!provider || provider.enabled === false) { attempts.push({ model: model.apiModelId, error: "provider disabled" }); continue; }
    const t0 = Date.now();
    try {
      const res = await callChat(env, provider, model.apiModelId, messages, opts);
      const cost = estimateCost(model, res.promptTokens, res.completionTokens);
      await recordModelUsage(env, model.id, { ok: true, latency: res.latency, promptTokens: res.promptTokens, completionTokens: res.completionTokens, cost });
      return {
        ...res, task, cost, modelId: model.id, displayName: model.displayName,
        attempts, failover: attempts.length > 0, chainLength: chain.length
      };
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      const err = String(e.message || e).slice(0, 200);
      attempts.push({ model: model.apiModelId, provider: provider.name, error: err, ms: Date.now() - t0 });
      await recordModelUsage(env, model.id, { ok: false, error: err });
      if (attempts.length === 1) {
        await audit(env, { userId: opts.userId || 0, action: "routing.failover", resource: model.id, result: "fail", meta: { error: err, task } });
      }
    }
  }
  const err = new Error(`همه ${attempts.length} مدل ناموفق بودند: ${attempts.map(a => `${a.model} (${a.error})`).join(" · ").slice(0, 300)}`);
  err.attempts = attempts;
  throw err;
}

// یک فراخوانی ساده متن→متن برای استفاده داخلی ابزارها/عاملها
export async function complete(env, prompt, opts = {}) {
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    { role: "user", content: prompt }
  ];
  const res = await route(env, messages, { ...opts, text: prompt });
  return res;
}

export async function completeJson(env, prompt, opts = {}) {
  const res = await complete(env, prompt, { ...opts, json: true, task: opts.task || "data" });
  const m = (res.text || "").match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) throw new Error("پاسخ JSON معتبر نبود");
  return { json: JSON.parse(m[0]), raw: res };
}

// ─────────────────────────────────────────────
// Phase 19: Advanced Router Enhancements
// ─────────────────────────────────────────────

/**
 * Advanced model selection considering multiple factors
 */
export async function advancedSelectModels(env, opts = {}) {
  const {
    task,
    capability,
    userId,
    projectId,
    text,
    contextLength,
    maxCost,
    maxLatency,
    preferReliable
  } = opts;
  
  const { listModels, getModelReliability } = await import("./models.js");
  const { getProvider } = await import("./providers.js");
  
  // Get all available models
  let candidates = await listModels(env, { enabled: true, status: "healthy" });
  
  // Filter by capability if specified
  if (capability) {
    candidates = candidates.filter(m => 
      m.capabilities && m.capabilities.includes(capability)
    );
  }
  
  // Filter by context window if specified
  if (contextLength) {
    candidates = candidates.filter(m => 
      m.contextWindow && m.contextWindow >= contextLength
    );
  }
  
  // Get model reliability scores
  let withScores = await Promise.all(candidates.map(async (model) => {
    const provider = await getProvider(env, model.providerId);
    const reliability = getModelReliability(model);
    
    // Calculate composite score
    let score = model.score?.overall || 50;
    
    // Factor in reliability
    if (preferReliable) {
      score = (score * 0.6) + (reliability * 0.4);
    }
    
    // Penalize if provider is unhealthy
    if (provider) {
      if (provider.status === "degraded") score *= 0.8;
      else if (provider.status === "down") score *= 0.3;
      
      // Check for rate limits on provider keys
      if (provider.keys && provider.keys.length > 0) {
        const availableKeys = provider.keys.filter(k => 
          !k.cooldownUntil || new Date(k.cooldownUntil) < new Date()
        );
        if (availableKeys.length === 0) score *= 0.1; // Heavy penalty if all keys in cooldown
        else if (availableKeys.length < provider.keys.length * 0.5) score *= 0.7; // Moderate penalty
      }
    }
    
    // Penalize if over cost budget
    if (maxCost && model.costPer1M) {
      const estimatedCost = (contextLength || 1000) / 1000000 * model.costPer1M;
      if (estimatedCost > maxCost) score *= 0.5;
    }
    
    // Penalize if over latency budget
    if (maxLatency && model.latency) {
      if (model.latency > maxLatency) score *= 0.6;
    }
    
    return {
      ...model,
      reliability,
      compositeScore: score,
      provider: provider ? {
        id: provider.id,
        status: provider.status,
        healthScore: provider.healthScore || 50
      } : null
    };
  }));
  
  // Sort by composite score
  withScores.sort((a, b) => b.compositeScore - a.compositeScore);
  
  // Check user/project policies
  if (userId || projectId) {
    const policy = await getUserModelPolicy(env, userId, projectId);
    if (policy) {
      // Filter by whitelist
      if (policy.allowedModels && policy.allowedModels.length > 0) {
        withScores = withScores.filter(m => policy.allowedModels.includes(m.id));
      }
      
      // Filter by blocked models
      if (policy.blockedModels && policy.blockedModels.length > 0) {
        withScores = withScores.filter(m => !policy.blockedModels.includes(m.id));
      }
      
      // Apply cost limits
      if (policy.maxCostPerRequest) {
        withScores = withScores.filter(m => {
          const estimatedCost = (contextLength || 1000) / 1000000 * (m.costPer1M || 0);
          return estimatedCost <= policy.maxCostPerRequest;
        });
      }
    }
  }
  
  return withScores;
}

/**
 * Get user/project model policy
 */
async function getUserModelPolicy(env, userId, projectId) {
  // Check project policy first
  if (projectId) {
    const projectPolicy = await kvGet(env, `policy:project:${projectId}`, null);
    if (projectPolicy) return projectPolicy;
  }
  
  // Check user policy
  if (userId) {
    const userPolicy = await kvGet(env, `policy:user:${userId}`, null);
    if (userPolicy) return userPolicy;
  }
  
  return null;
}

/**
 * Set user/project model policy
 */
export async function setModelPolicy(env, target, policy, userId = 0) {
  const key = target.type === "project" 
    ? `policy:project:${target.id}` 
    : `policy:user:${target.id}`;
  
  const policyData = {
    target,
    allowedModels: policy.allowedModels || [],
    blockedModels: policy.blockedModels || [],
    allowedProviders: policy.allowedProviders || [],
    blockedProviders: policy.blockedProviders || [],
    maxCostPerRequest: policy.maxCostPerRequest || null,
    maxTokensPerRequest: policy.maxTokensPerRequest || null,
    requireApprovalOver: policy.requireApprovalOver || null,
    updatedAt: nowIso(),
    updatedBy: userId
  };
  
  await kvPut(env, key, policyData);
  
  await audit(env, {
    userId,
    action: "policy.set",
    resource: key,
    meta: { target: target.type }
  });
  
  return policyData;
}

/**
 * Get model policy
 */
export async function getModelPolicy(env, target) {
  const key = target.type === "project" 
    ? `policy:project:${target.id}` 
    : `policy:user:${target.id}`;
  
  return await kvGet(env, key, null);
}

/**
 * Enhanced route function with advanced selection
 */
export async function routeAdvanced(env, messages, opts = {}) {
  // Use advanced selection if requested
  if (opts.useAdvancedSelection) {
    const candidates = await advancedSelectModels(env, {
      task: opts.task,
      capability: opts.capability,
      userId: opts.userId,
      projectId: opts.projectId,
      text: opts.text,
      contextLength: opts.contextLength || estimateTokenCount(messages),
      maxCost: opts.maxCost,
      maxLatency: opts.maxLatency,
      preferReliable: opts.preferReliable !== false
    });
    
    if (candidates.length === 0) {
      throw new Error("No suitable models found matching criteria");
    }
    
    // Try candidates in order until one succeeds
    for (const model of candidates.slice(0, 3)) { // Try top 3
      try {
        opts.modelId = model.id;
        const result = await route(env, messages, opts);
        result.selectedBy = "advanced";
        result.candidatesConsidered = candidates.length;
        result.modelRank = candidates.findIndex(c => c.id === model.id) + 1;
        return result;
      } catch (e) {
        // Try next candidate
        continue;
      }
    }
    
    throw new Error("All candidate models failed");
  }
  
  // Fall back to standard routing
  return await route(env, messages, opts);
}

/**
 * Estimate token count from messages
 */
function estimateTokenCount(messages) {
  const text = messages.map(m => m.content || "").join(" ");
  return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 chars
}

/**
 * Track historical reliability for router optimization
 */
export async function recordRouterDecision(env, decision) {
  const key = `router:history:${decision.userId || 0}`;
  const history = await kvGet(env, key, []);
  
  history.push({
    timestamp: nowIso(),
    modelId: decision.modelId,
    task: decision.task,
    success: decision.success,
    latency: decision.latency,
    cost: decision.cost,
    failedAttempts: decision.failedAttempts || 0
  });
  
  // Keep last 1000 decisions
  if (history.length > 1000) {
    history.splice(0, history.length - 1000);
  }
  
  await kvPut(env, key, history);
}

/**
 * Get router statistics
 */
export async function getRouterStats(env, userId = 0) {
  const key = `router:history:${userId}`;
  const history = await kvGet(env, key, []);
  
  if (history.length === 0) {
    return {
      totalRequests: 0,
      successRate: 0,
      avgLatency: 0,
      avgCost: 0,
      topModels: []
    };
  }
  
  const stats = {
    totalRequests: history.length,
    successRate: (history.filter(d => d.success).length / history.length) * 100,
    avgLatency: history.reduce((sum, d) => sum + (d.latency || 0), 0) / history.length,
    avgCost: history.reduce((sum, d) => sum + (d.cost || 0), 0) / history.length,
    topModels: []
  };
  
  // Calculate top models by usage
  const modelUsage = {};
  for (const decision of history) {
    if (!modelUsage[decision.modelId]) {
      modelUsage[decision.modelId] = { count: 0, successes: 0, totalLatency: 0, totalCost: 0 };
    }
    modelUsage[decision.modelId].count++;
    if (decision.success) modelUsage[decision.modelId].successes++;
    modelUsage[decision.modelId].totalLatency += decision.latency || 0;
    modelUsage[decision.modelId].totalCost += decision.cost || 0;
  }
  
  stats.topModels = Object.entries(modelUsage)
    .map(([modelId, data]) => ({
      modelId,
      count: data.count,
      successRate: (data.successes / data.count) * 100,
      avgLatency: data.totalLatency / data.count,
      avgCost: data.totalCost / data.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return stats;
}
