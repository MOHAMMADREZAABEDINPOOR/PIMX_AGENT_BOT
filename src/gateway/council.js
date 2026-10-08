// ─────────────────────────────────────────────
// AI Council — multi-model independent / debate / judge / panel / iterative
// Real model calls only. Failures do not abort the whole council.
// ─────────────────────────────────────────────
import { kvGet, kvPut, kvDel, indexAdd, newId, nowIso, readMany } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { listModels, isModelAvailable, estimateCost, getModel } from "./models.js";
import { getProvider } from "./providers.js";
import { callChat } from "./client.js";
import { selectModels } from "./router.js";

export const COUNCIL_MODES = {
  auto: { label: "خودکار", desc: "تحلیل هوشمند و تعیین بهترین پیکربندی" },
  independent: { label: "مستقل", desc: "هر مدل جداگانه پاسخ میدهد، سپس سنتز" },
  debate: { label: "مناظره", desc: "پاسخ → نقد متقابل → سنتز" },
  panel: { label: "پنل متخصص", desc: "نقشهای تخصصی روی مدلهای مختلف" },
  judge: { label: "داور", desc: "پاسخ مستقل + داوری و برنده" },
  iterative: { label: "تکراری", desc: "چند دور نقد و بازنگری سپس داوری" }
};

export const PANEL_ROLES = [
  { id: "researcher", label: "Researcher", prompt: "You are a rigorous researcher. Prioritize evidence, sources, and uncertainty." },
  { id: "engineer", label: "Engineer", prompt: "You are a senior engineer. Prioritize correctness, practicality, security." },
  { id: "critic", label: "Critic", prompt: "You are a sharp critic. Find flaws, risks, missing assumptions." },
  { id: "strategist", label: "Strategist", prompt: "You are a strategist. Focus on trade-offs, priorities, long-term impact." },
  { id: "security", label: "Security", prompt: "You are a security expert. Focus on abuse cases, secrets, auth, SSRF." },
  { id: "creative", label: "Creative", prompt: "You are a creative expert. Offer novel but realistic angles." }
];

const RUN_INDEX = "council:runs";
const CFG_INDEX = "council:cfgs";
const runKey = id => `councilrun:${id}`;
const cfgKey = id => `councilcfg:${id}`;

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

/** Select N diverse healthy models (prefer different providers). */
export async function pickCouncilModels(env, { count = 3, modelIds = null, task = "chat", text = "", ensureDiversity = true } = {}) {
  const n = clamp(Number(count) || 3, 2, 30);
  const all = await listModels(env);
  
  // If explicit modelIds provided, use them
  if (Array.isArray(modelIds) && modelIds.length) {
    const picked = [];
    for (const id of modelIds) {
      const m = all.find(x => x.id === id || x.apiModelId === id || x.slug === id);
      if (m && isModelAvailable(m)) picked.push(m);
    }
    if (picked.length >= 2) return picked.slice(0, n);
  }
  
  // Get healthy models via router
  const { chain } = await selectModels(env, { text, task, opts: {} });
  const healthy = (chain.length ? chain : all.filter(isModelAvailable));
  
  if (!ensureDiversity) {
    return healthy.slice(0, n);
  }
  
  // ══════════════════════════════════════════════
  // Enhanced Provider Diversity Algorithm
  // ══════════════════════════════════════════════
  // Phase 11: Ensure models from different providers
  // Maximizes provider diversity before filling remaining slots
  
  const byProvider = new Map();
  const rest = [];
  
  // First pass: one model per provider
  for (const m of healthy) {
    if (!byProvider.has(m.providerId)) {
      byProvider.set(m.providerId, [m]);
    } else {
      byProvider.get(m.providerId).push(m);
      rest.push(m);
    }
  }
  
  // Build diverse list: one from each provider first
  const diverse = [];
  for (const models of byProvider.values()) {
    diverse.push(models[0]); // Best model from each provider
  }
  
  // Fill remaining slots with alternating providers
  let providerIndex = 0;
  const providerKeys = Array.from(byProvider.keys());
  const remaining = n - diverse.length;
  
  if (remaining > 0 && providerKeys.length > 0) {
    for (let i = 0; i < remaining; i++) {
      const providerId = providerKeys[providerIndex % providerKeys.length];
      const providerModels = byProvider.get(providerId);
      
      // Find next unused model from this provider
      const nextModel = providerModels.find(m => !diverse.includes(m));
      if (nextModel) {
        diverse.push(nextModel);
      } else if (rest.length > 0) {
        // Fallback to rest pool
        diverse.push(rest.shift());
      }
      
      providerIndex++;
    }
  }
  
  return diverse.slice(0, n);
}

/** Calculate provider diversity metrics for a council run */
export function calculateDiversityMetrics(models) {
  const providers = new Set(models.map(m => m.providerId));
  const providerCounts = {};
  
  for (const m of models) {
    providerCounts[m.providerName || m.providerId] = (providerCounts[m.providerName || m.providerId] || 0) + 1;
  }
  
  const totalModels = models.length;
  const uniqueProviders = providers.size;
  const diversityScore = totalModels > 0 ? (uniqueProviders / totalModels) * 100 : 0;
  
  return {
    totalModels,
    uniqueProviders,
    diversityScore: Math.round(diversityScore),
    providerDistribution: providerCounts,
    balanced: uniqueProviders === totalModels, // Perfect diversity
    concentration: Math.max(...Object.values(providerCounts)) / totalModels
  };
}

async function callOne(env, model, messages, opts = {}) {
  const provider = await getProvider(env, model.providerId);
  if (!provider || provider.enabled === false) throw new Error("provider disabled");
  const t0 = Date.now();
  try {
    const res = await callChat(env, provider, model.apiModelId, messages, {
      maxTokens: opts.maxTokens || 900,
      temperature: opts.temperature ?? 0.5,
      timeout: opts.timeout || 45000
    });
    const cost = estimateCost(model, res.promptTokens, res.completionTokens) || 0;
    const latency = res.latency || (Date.now() - t0);
    
    // Phase 13: Record successful model usage for reliability tracking
    const { recordModelUsage } = await import("./models.js");
    await recordModelUsage(env, model.id, true, latency, null);
    
    return {
      ok: true,
      modelId: model.id,
      model: model.apiModelId,
      displayName: model.displayName || model.apiModelId,
      providerName: model.providerName || provider.name,
      providerId: model.providerId,
      text: (res.text || "").trim(),
      latency,
      promptTokens: res.promptTokens || 0,
      completionTokens: res.completionTokens || 0,
      cost,
      role: opts.role || null
    };
  } catch (e) {
    const latency = Date.now() - t0;
    const errorType = e.message?.includes("timeout") ? "timeout" :
                      e.message?.includes("rate") ? "rate_limit" :
                      e.message?.includes("auth") ? "auth" :
                      "unknown";
    
    // Phase 13: Record failed model usage for reliability tracking
    const { recordModelUsage } = await import("./models.js");
    await recordModelUsage(env, model.id, false, latency, errorType);
    
    return {
      ok: false,
      modelId: model.id,
      model: model.apiModelId,
      displayName: model.displayName || model.apiModelId,
      providerName: model.providerName,
      providerId: model.providerId,
      error: String(e.message || e).slice(0, 220),
      latency,
      text: "",
      promptTokens: 0,
      completionTokens: 0,
      cost: 0,
      role: opts.role || null
    };
  }
}

async function runParallel(env, models, buildMessages, opts, onProgress) {
  const out = [];
  const conc = clamp(opts.concurrency || 4, 1, 8);
  for (let i = 0; i < models.length; i += conc) {
    const batch = models.slice(i, i + conc);
    if (onProgress) await onProgress({ phase: "calling", done: i, total: models.length });
    const part = await Promise.all(batch.map((m, j) => {
      const role = opts.roles?.[i + j] || null;
      const msgs = buildMessages(m, role);
      return callOne(env, m, msgs, { ...opts, role: role?.id || role?.label || null });
    }));
    out.push(...part);
  }
  return out;
}

function safeSummary(text, max = 1200) {
  return String(text || "").replace(/\n{3,}/g, "\n\n").slice(0, max);
}

async function synthesize(env, { question, answers, mode, judgeModel, onProgress }) {
  const okAnswers = answers.filter(a => a.ok && a.text);
  if (!okAnswers.length) {
    return {
      final: "هیچ مدلی پاسخ معتبری نداد.",
      consensus: "none",
      confidence: 0,
      agreement: 0,
      strong: [],
      disagreements: ["همه فراخوانیها ناموفق بودند"],
      winner: null,
      judge: null,
      quality: {
        consensus: 0,
        evidence: 0,
        confidence: 0,
        contradictions: 0
      }
    };
  }
  if (okAnswers.length === 1) {
    return {
      final: okAnswers[0].text,
      consensus: "single",
      confidence: 55,
      agreement: 100,
      strong: ["تنها پاسخ موفق"],
      disagreements: [],
      winner: okAnswers[0].displayName,
      judge: null,
      quality: {
        consensus: 55,
        evidence: 50,
        confidence: 55,
        contradictions: 0
      }
    };
  }

  const dossier = okAnswers.map((a, i) =>
    `### Candidate ${i + 1}: ${a.displayName} (${a.providerName || "?"})\n${safeSummary(a.text, 1400)}`
  ).join("\n\n");

  // ══════════════════════════════════════════════
  // Enhanced Judge System (Phase 11)
  // ══════════════════════════════════════════════
  // Added quality scoring metrics for better synthesis analysis

  const system = `You are the Council Judge/Synthesizer for PIMXAGENT.
Compare candidate answers. Do NOT invent facts. Do NOT reveal hidden chain-of-thought.
Analyze answer quality on multiple dimensions.

Return STRICT JSON only:
{
  "final": "one coherent final answer for the user (markdown ok)",
  "consensus": "high|medium|low|none",
  "confidence": 0-100,
  "agreement": 0-100,
  "strong": ["strength 1", "strength 2", ...],
  "disagreements": ["disagreement 1", "disagreement 2", ...],
  "winner": "candidate display name or null",
  "notes": "short internal notes",
  "quality": {
    "consensus": 0-100,
    "evidence": 0-100,
    "confidence": 0-100,
    "contradictions": 0-100
  }
}

Quality metrics:
- consensus: how much candidates agree (0=total disagreement, 100=perfect agreement)
- evidence: strength of factual support and citations (0=no evidence, 100=well-sourced)
- confidence: judge's certainty in synthesis quality (0=unsure, 100=certain)
- contradictions: level of conflicting information (0=no conflicts, 100=major conflicts)`;

  const user = `User question:\n${question}\n\nMode: ${mode}\n\nCandidates:\n${dossier}\n\nProduce the JSON with quality metrics.`;

  if (onProgress) await onProgress({ phase: "judge", done: okAnswers.length, total: okAnswers.length });

  let judge = null;
  try {
    if (judgeModel) {
      judge = await callOne(env, judgeModel, [
        { role: "system", content: system },
        { role: "user", content: user }
      ], { maxTokens: 1600, temperature: 0.2, timeout: 50000 });
    } else {
      const pool = await pickCouncilModels(env, { count: 6, text: question, task: "reasoning" });
      const jm = pool.find(m => !okAnswers.some(a => a.modelId === m.id)) || pool[0];
      if (!jm?.apiModelId) throw new Error("no judge model");
      judge = await callOne(env, jm, [
        { role: "system", content: system },
        { role: "user", content: user }
      ], { maxTokens: 1600, temperature: 0.2 });
    }
  } catch (e) {
    // fallback: pick longest successful answer
    const best = okAnswers.sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))[0];
    return {
      final: best.text,
      consensus: "fallback",
      confidence: 40,
      agreement: Math.round(100 / okAnswers.length),
      strong: [],
      disagreements: ["داور ناموفق — بهترین پاسخ موجود برگردانده شد"],
      winner: best.displayName,
      judge: null,
      judgeError: String(e.message || e),
      quality: {
        consensus: 30,
        evidence: 30,
        confidence: 40,
        contradictions: 50
      }
    };
  }

  if (!judge?.ok) {
    const best = okAnswers[0];
    return {
      final: best.text,
      consensus: "fallback",
      confidence: 40,
      agreement: 50,
      strong: [],
      disagreements: [judge?.error || "judge failed"],
      winner: best.displayName,
      judge: null,
      quality: {
        consensus: 30,
        evidence: 30,
        confidence: 40,
        contradictions: 50
      }
    };
  }

  try {
    const m = (judge.text || "").match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : judge.text);
    
    // Extract quality metrics with defaults
    const quality = j.quality || {};
    
    return {
      final: j.final || judge.text,
      consensus: j.consensus || "medium",
      confidence: Number(j.confidence) || 60,
      agreement: Number(j.agreement) || 60,
      strong: Array.isArray(j.strong) ? j.strong.slice(0, 8) : [],
      disagreements: Array.isArray(j.disagreements) ? j.disagreements.slice(0, 8) : [],
      winner: j.winner || null,
      notes: j.notes || null,
      judge: { model: judge.displayName, latency: judge.latency, cost: judge.cost },
      quality: {
        consensus: Number(quality.consensus) || 60,
        evidence: Number(quality.evidence) || 50,
        confidence: Number(quality.confidence) || 60,
        contradictions: Number(quality.contradictions) || 20
      }
    };
  } catch {
    return {
      final: judge.text,
      consensus: "medium",
      confidence: 55,
      agreement: 55,
      strong: [],
      disagreements: [],
      winner: null,
      judge: { model: judge.displayName, latency: judge.latency, cost: judge.cost },
      quality: {
        consensus: 50,
        evidence: 45,
        confidence: 55,
        contradictions: 25
      }
    };
  }
}

// ─────────────────────────────────────────────
// Phase 13: Enhanced Quality Scoring with Reliability
// ─────────────────────────────────────────────

/**
 * Calculate comprehensive quality metrics including model/provider reliability
 * @param {object} env - Worker environment
 * @param {Array} answers - Council answers
 * @param {object} synthesis - Judge synthesis result
 * @returns {object} Enhanced quality metrics
 */
async function calculateQualityMetrics(env, answers, synthesis) {
  const { getModel, getModelReliability, calculateAnswerReliability } = await import("./models.js");
  const { getProvider } = await import("./providers.js");
  
  const okAnswers = answers.filter(a => a.ok && a.text);
  if (okAnswers.length === 0) {
    return {
      ...synthesis.quality,
      modelReliability: 0,
      providerReliability: 0,
      overallQuality: 0
    };
  }
  
  // Calculate model reliability scores
  const modelReliabilities = [];
  const providerReliabilities = [];
  
  for (const answer of okAnswers) {
    const model = await getModel(env, answer.modelId);
    const provider = await getProvider(env, answer.providerId);
    
    if (model) {
      const modelReliability = getModelReliability(model);
      modelReliabilities.push(modelReliability);
      
      const answerReliability = calculateAnswerReliability(model, provider);
      providerReliabilities.push(answerReliability);
    }
  }
  
  // Average reliability scores
  const avgModelReliability = modelReliabilities.length > 0
    ? Math.round(modelReliabilities.reduce((sum, r) => sum + r, 0) / modelReliabilities.length)
    : 50;
  
  const avgProviderReliability = providerReliabilities.length > 0
    ? Math.round(providerReliabilities.reduce((sum, r) => sum + r, 0) / providerReliabilities.length)
    : 50;
  
  // Calculate overall quality score (weighted average)
  const weights = {
    consensus: 0.25,
    evidence: 0.20,
    confidence: 0.15,
    contradictions: -0.10, // Negative weight for contradictions
    modelReliability: 0.20,
    providerReliability: 0.20
  };
  
  const quality = synthesis.quality || {};
  const overallQuality = Math.round(
    (quality.consensus || 50) * weights.consensus +
    (quality.evidence || 50) * weights.evidence +
    (quality.confidence || 50) * weights.confidence +
    (100 - (quality.contradictions || 0)) * Math.abs(weights.contradictions) + // Invert contradictions
    avgModelReliability * weights.modelReliability +
    avgProviderReliability * weights.providerReliability
  );
  
  return {
    consensus: quality.consensus || 50,
    evidence: quality.evidence || 50,
    confidence: quality.confidence || 50,
    contradictions: quality.contradictions || 0,
    modelReliability: avgModelReliability,
    providerReliability: avgProviderReliability,
    overallQuality: Math.max(0, Math.min(100, overallQuality)),
    breakdown: {
      participatingModels: okAnswers.length,
      modelScores: modelReliabilities,
      providerScores: providerReliabilities
    }
  };
}

/**
 * Run a full council session.
 * @param {object} opts
 *  - question (required)
 *  - mode: independent|debate|panel|judge|iterative|auto
 *  - count / modelIds
 *  - rounds (for debate/iterative)
 *  - userId
 *  - onProgress
 *  - budgetTokens (soft)
 */
export async function runCouncil(env, opts = {}) {
  const question = String(opts.question || opts.goal || "").trim();
  if (!question) throw new Error("سوال Council خالی است");

  // Phase 12: Auto mode support
  let mode = opts.mode;
  let rounds = opts.rounds;
  let count = opts.count;
  let judgeModelId = opts.judgeModelId;
  let maxTokens = opts.maxTokens;
  let concurrency = opts.concurrency;
  let ensureDiversity = opts.ensureDiversity;
  let autoPlan = null;
  
  if (mode === "auto" || opts.autoPlan) {
    // Use Council Planner to determine optimal configuration
    autoPlan = planCouncil(question, {
      maxCost: opts.costBudget || opts.maxCost,
      maxModels: opts.maxModels,
      maxRounds: opts.maxRounds,
      timeout: opts.timeout
    });
    
    // Apply recommendations
    mode = autoPlan.recommended.mode;
    rounds = autoPlan.recommended.rounds;
    count = autoPlan.recommended.modelCount;
    maxTokens = maxTokens || autoPlan.recommended.maxTokens;
    concurrency = concurrency || autoPlan.recommended.concurrency;
    ensureDiversity = autoPlan.recommended.ensureDiversity;
    
    // Select judge model if recommended
    if (autoPlan.recommended.judgePreference && !judgeModelId) {
      // Will be selected after model picking
    }
    
    // Check budget
    if (!autoPlan.estimates.withinBudget && autoPlan.estimates.budgetRecommendation) {
      // Already adjusted in planner, but inform user
      if (opts.onProgress) {
        opts.onProgress({
          type: "plan",
          message: "⚠️ Configuration adjusted to fit budget",
          budgetRecommendation: autoPlan.estimates.budgetRecommendation
        });
      }
    }
  }

  mode = COUNCIL_MODES[mode] ? mode : "independent";
  rounds = clamp(Number(rounds) || (mode === "iterative" ? 3 : mode === "debate" ? 2 : 1), 1, 5);
  count = clamp(Number(count) || (opts.modelIds?.length || 3), 2, 30);

  // Estimate cost before approval check
  const estimatedTokens = (question.length * 1.5) * count * rounds + 1000 * count * rounds;
  const estimatedCost = autoPlan ? autoPlan.estimates.estimatedCost : (estimatedTokens / 1000000) * 0.5;

  // Check if approval required for expensive Council
  if (!opts.approvalGranted && estimatedCost > (opts.costBudget || 0.5)) {
    const { checkPermission } = await import("../core/approval.js");
    
    const operation = {
      type: "COUNCIL_RUN",
      user: {
        id: opts.userId || 0,
        name: opts.userName || "Unknown",
        role: opts.userRole || "user",
        costBudget: opts.costBudget || 0.5
      },
      details: {
        question: question.slice(0, 200),
        mode,
        rounds,
        modelCount: count,
        autoPlanned: !!autoPlan
      },
      context: {
        estimatedCost
      },
      estimatedCost,
      metadata: {
        models: opts.modelIds || [],
        plan: autoPlan ? {
          complexity: autoPlan.analysis.complexity,
          characteristics: autoPlan.analysis.characteristics,
          reasoning: autoPlan.reasoning
        } : null
      }
    };
    
    const permission = await checkPermission(env, operation);
    
    if (!permission.allowed && permission.requiresApproval) {
      throw Object.assign(new Error("Council run requires approval"), {
        needsApproval: true,
        approvalRequestId: permission.approvalRequestId,
        request: permission.request,
        estimatedCost,
        autoPlan
      });
    }
  }

  const models = await pickCouncilModels(env, {
    count,
    modelIds: opts.modelIds,
    text: question,
    task: opts.task || (mode === "panel" ? "reasoning" : "chat"),
    ensureDiversity: ensureDiversity !== undefined ? ensureDiversity : true
  });
  if (models.length < 2) throw new Error("حداقل ۲ مدل سالم برای Council لازم است. ابتدا پروایدر/مدل اضافه و تست کنید.");

  // Phase 12: Auto-select judge model if planned
  let judgeModel = null;
  if (judgeModelId) {
    judgeModel = await getModel(env, judgeModelId) || models.find(m => m.id === judgeModelId);
  } else if (autoPlan?.recommended.judgePreference) {
    judgeModel = await selectJudgeModel(env, models, autoPlan.recommended.judgePreference);
  }

  const runId = newId("cnc");
  const run = {
    id: runId,
    userId: opts.userId || 0,
    question,
    mode,
    rounds,
    status: "running",
    models: models.map(m => ({ id: m.id, name: m.displayName || m.apiModelId, provider: m.providerName, providerId: m.providerId })),
    diversity: calculateDiversityMetrics(models), // Phase 11: Provider diversity tracking
    autoPlan: autoPlan ? { // Phase 12: Include auto-plan details
      complexity: autoPlan.analysis.complexity,
      characteristics: autoPlan.analysis.characteristics,
      quality: autoPlan.analysis.quality,
      speed: autoPlan.analysis.speed,
      cost: autoPlan.analysis.cost,
      reasoning: autoPlan.reasoning
    } : null,
    templateId: opts.templateId || null, // Phase 14: Template tracking
    metadata: opts.metadata || {}, // Phase 14: Additional metadata
    roundsData: [],
    answers: [],
    synthesis: null,
    startedAt: nowIso(),
    finishedAt: null,
    totals: { promptTokens: 0, completionTokens: 0, cost: 0, ok: 0, fail: 0 }
  };

  const onProgress = opts.onProgress;
  const bump = (arr) => {
    for (const a of arr) {
      run.totals.promptTokens += a.promptTokens || 0;
      run.totals.completionTokens += a.completionTokens || 0;
      run.totals.cost += a.cost || 0;
      if (a.ok) run.totals.ok++; else run.totals.fail++;
    }
  };

  // soft budget estimate before (informational)
  run.estimate = {
    modelCalls: mode === "independent" || mode === "judge" ? models.length + 1
      : mode === "debate" ? models.length * rounds + 1
      : mode === "iterative" ? models.length * rounds + 1
      : models.length + 1,
    models: models.length,
    rounds
  };

  try {
    if (mode === "independent" || mode === "judge") {
      // Phase 14: Use template system prompt if provided
      const systemPrompt = opts.systemPrompt || "Answer the user carefully, completely, and honestly. Be structured. Do not invent sources.";
      const answers = await runParallel(env, models,
        () => [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        { maxTokens: opts.maxTokens || 1000, concurrency: opts.concurrency },
        onProgress
      );
      bump(answers);
      run.answers = answers;
      run.roundsData.push({ round: 1, type: "independent", answers });
    }

    if (mode === "panel") {
      // Phase 14: Use template roles if provided, otherwise use default PANEL_ROLES
      let roles = opts.roles || PANEL_ROLES.slice(0, models.length);
      while (roles.length < models.length) roles.push(PANEL_ROLES[roles.length % PANEL_ROLES.length]);
      const answers = await runParallel(env, models,
        (m, role) => [
          { role: "system", content: (role?.prompt || "You are an expert.") + "\nRespond from your role only. Be concrete." },
          { role: "user", content: question }
        ],
        { maxTokens: opts.maxTokens || 900, concurrency: opts.concurrency, roles },
        onProgress
      );
      bump(answers);
      run.answers = answers;
      run.roundsData.push({ round: 1, type: "panel", answers });
    }

    if (mode === "debate" || mode === "iterative") {
      let current = [];
      // Round 1 independent
      current = await runParallel(env, models,
        () => [
          { role: "system", content: "Provide your best independent answer. Be clear and structured." },
          { role: "user", content: question }
        ],
        { maxTokens: opts.maxTokens || 900, concurrency: opts.concurrency },
        onProgress
      );
      bump(current);
      run.roundsData.push({ round: 1, type: "proposals", answers: current });

      for (let r = 2; r <= rounds; r++) {
        const peerBrief = current.filter(a => a.ok).map(a =>
          `- ${a.displayName}: ${safeSummary(a.text, 500)}`
        ).join("\n");
        const isLast = r === rounds;
        current = await runParallel(env, models,
          (m) => {
            const mine = current.find(a => a.modelId === m.id);
            return [
              {
                role: "system",
                content: isLast
                  ? "Revise your answer using peer critiques. Produce an improved final position. Do not invent facts."
                  : "Critique peers briefly, then improve your own answer. Focus on errors, missing points, better structure."
              },
              {
                role: "user",
                content: `Question:\n${question}\n\nYour previous answer:\n${safeSummary(mine?.text, 800) || "(failed)"}\n\nPeer answers:\n${peerBrief}\n\n${isLast ? "Write your revised final answer." : "Write critique + improved answer."}`
              }
            ];
          },
          { maxTokens: opts.maxTokens || 1000, concurrency: opts.concurrency },
          async (p) => onProgress && onProgress({ ...p, phase: `round-${r}` })
        );
        bump(current);
        run.roundsData.push({ round: r, type: isLast ? "revised" : "critique", answers: current });
      }
      run.answers = current;
    }

    // synthesis / judge
    run.synthesis = await synthesize(env, {
      question,
      answers: run.answers,
      mode,
      judgeModel,
      onProgress
    });
    if (run.synthesis?.judge?.cost) run.totals.cost += run.synthesis.judge.cost;
    
    // Phase 13: Calculate enhanced quality metrics with model/provider reliability
    run.synthesis.quality = await calculateQualityMetrics(env, run.answers, run.synthesis);

    run.status = "done";
    run.finishedAt = nowIso();
  } catch (e) {
    run.status = "failed";
    run.error = String(e.message || e).slice(0, 300);
    run.finishedAt = nowIso();
  }

  await kvPut(env, runKey(runId), run);
  await indexAdd(env, RUN_INDEX, runId);
  // keep index short
  const ids = await kvGet(env, RUN_INDEX, []);
  if (ids.length > 80) await kvPut(env, RUN_INDEX, ids.slice(-80));

  await audit(env, {
    userId: opts.userId || 0,
    action: "council.run",
    resource: runId,
    result: run.status,
    meta: { mode, models: models.length, ok: run.totals.ok, fail: run.totals.fail, cost: run.totals.cost }
  });

  return run;
}

export async function getCouncilRun(env, id) {
  return kvGet(env, runKey(id), null);
}

export async function listCouncilRuns(env, userId = null, limit = 20) {
  const ids = await kvGet(env, RUN_INDEX, []);
  const rows = await readMany(env, ids.slice(-60).reverse().map(runKey));
  let list = rows;
  if (userId) list = list.filter(r => !r.userId || Number(r.userId) === Number(userId));
  return list.slice(0, limit);
}

export async function saveCouncilConfig(env, input, userId = 0) {
  const cfg = {
    id: input.id || newId("ccfg"),
    userId,
    name: String(input.name || "Council").slice(0, 60),
    mode: COUNCIL_MODES[input.mode] ? input.mode : "independent",
    count: clamp(Number(input.count) || 3, 2, 30),
    modelIds: input.modelIds || [],
    rounds: clamp(Number(input.rounds) || 2, 1, 5),
    judgeModelId: input.judgeModelId || null,
    task: input.task || "chat",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await kvPut(env, cfgKey(cfg.id), cfg);
  await indexAdd(env, CFG_INDEX, cfg.id);
  return cfg;
}

export async function listCouncilConfigs(env, userId = 0) {
  const ids = await kvGet(env, CFG_INDEX, []);
  const rows = await readMany(env, ids.map(cfgKey));
  return rows.filter(c => !userId || !c.userId || Number(c.userId) === Number(userId));
}

export async function deleteCouncilConfig(env, id) {
  const ids = (await kvGet(env, CFG_INDEX, [])).filter(x => x !== id);
  await kvPut(env, CFG_INDEX, ids);
  await kvDel(env, cfgKey(id));
  return true;
}

/** Rough preflight estimate for UI confirmation */
export async function estimateCouncil(env, opts = {}) {
  const count = clamp(Number(opts.count) || 3, 2, 30);
  const mode = opts.mode || "independent";
  const rounds = clamp(Number(opts.rounds) || 2, 1, 5);
  let calls = count;
  if (mode === "debate" || mode === "iterative") calls = count * rounds;
  calls += 1; // judge
  const models = await pickCouncilModels(env, { count, modelIds: opts.modelIds, text: opts.question || "" });
  const diversity = calculateDiversityMetrics(models); // Phase 11: Include diversity metrics
  
  return {
    models: models.map(m => ({ id: m.id, name: m.displayName || m.apiModelId, provider: m.providerName, status: m.status })),
    modelCalls: calls,
    diversity, // Provider diversity metrics
    note: "برآورد تقریبی — هزینه واقعی بعد از اجرا ثبت میشود",
    available: models.length
  };
}

// ─────────────────────────────────────────────
// Phase 12: Council Planner — Auto mode
// ─────────────────────────────────────────────

/**
 * Analyze task complexity and determine optimal council configuration
 * @param {string} question - The question/task to analyze
 * @param {object} constraints - Optional user constraints (maxCost, maxModels, maxRounds, timeout)
 * @returns {object} Recommended configuration
 */
export function planCouncil(question, constraints = {}) {
  const q = String(question || "").trim().toLowerCase();
  const length = question.length;
  const wordCount = question.split(/\s+/).length;
  
  // Detect task characteristics
  const characteristics = {
    isCoding: /code|program|function|algorithm|debug|implement|refactor|script|api|sql|regex/i.test(question),
    isResearch: /research|analyze|compare|investigate|study|review|evaluate|assess|survey|examination/i.test(question),
    isFactual: /what is|who is|when did|where is|how many|define|explain|list|name|identify/i.test(question),
    isCreative: /write|create|generate|design|imagine|story|poem|essay|article|content|brainstorm/i.test(question),
    isReasoning: /why|how|reason|logic|prove|deduce|infer|conclude|justify|argument|philosophy/i.test(question),
    isMath: /calculate|solve|equation|formula|mathematics|compute|integral|derivative|probability/i.test(question),
    isSecurity: /security|vulnerability|exploit|attack|defense|threat|risk|penetration|audit/i.test(question),
    isArchitecture: /architect|design system|infrastructure|scalab|microservice|distributed|cloud|database design/i.test(question),
    isMultiStep: /step by step|first.*then|1\.|2\.|multiple|several|various|different aspects|comprehensive/i.test(question),
    isDebate: /debate|argue|pros and cons|advantages.*disadvantages|for and against|perspective|viewpoint/i.test(question),
    requiresConsensus: /consensus|agreement|unified|single answer|definitive|correct answer|fact check/i.test(question),
    requiresDiversity: /different|various|multiple perspectives|diverse|alternative|compare approaches/i.test(question),
    isOpenEnded: /opinion|think|feel|should|would you|creative|imagine|philosophical|subjective/i.test(question),
    isUrgent: /urgent|asap|quick|fast|immediately|now/i.test(question),
    isCostSensitive: /cheap|low cost|budget|economical|minimal|free/i.test(question)
  };
  
  // Calculate complexity score (0-100)
  let complexity = 30; // base
  if (wordCount > 100) complexity += 20;
  else if (wordCount > 50) complexity += 10;
  else if (wordCount > 20) complexity += 5;
  
  if (characteristics.isCoding) complexity += 15;
  if (characteristics.isResearch) complexity += 15;
  if (characteristics.isReasoning) complexity += 10;
  if (characteristics.isSecurity) complexity += 15;
  if (characteristics.isArchitecture) complexity += 15;
  if (characteristics.isMultiStep) complexity += 10;
  if (characteristics.isDebate) complexity += 10;
  if (characteristics.requiresDiversity) complexity += 10;
  if (characteristics.isOpenEnded) complexity += 5;
  
  if (characteristics.isFactual && !characteristics.isResearch) complexity -= 10;
  if (characteristics.isUrgent) complexity -= 5;
  if (characteristics.isCostSensitive) complexity -= 10;
  
  complexity = clamp(complexity, 0, 100);
  
  // Determine optimal number of models (2-30)
  let modelCount = 3; // default
  if (complexity >= 80) modelCount = constraints.maxModels ? Math.min(10, constraints.maxModels) : 10;
  else if (complexity >= 60) modelCount = constraints.maxModels ? Math.min(7, constraints.maxModels) : 7;
  else if (complexity >= 40) modelCount = constraints.maxModels ? Math.min(5, constraints.maxModels) : 5;
  else modelCount = constraints.maxModels ? Math.min(3, constraints.maxModels) : 3;
  
  if (characteristics.requiresDiversity) modelCount = Math.max(modelCount, 5);
  if (characteristics.isDebate) modelCount = Math.max(modelCount, 4);
  if (characteristics.isUrgent || characteristics.isCostSensitive) modelCount = Math.min(modelCount, 3);
  
  // Determine optimal mode
  let mode = "independent";
  let rounds = 1;
  
  if (characteristics.isDebate) {
    mode = "debate";
    rounds = complexity >= 60 ? 3 : 2;
  } else if (characteristics.requiresConsensus || characteristics.isFactual) {
    mode = "judge";
    rounds = 1;
  } else if (characteristics.isCoding || characteristics.isArchitecture || characteristics.isSecurity) {
    mode = "panel"; // Expert roles
    rounds = 1;
  } else if (characteristics.isMultiStep || (complexity >= 70 && !characteristics.isUrgent)) {
    mode = "iterative";
    rounds = complexity >= 80 ? 3 : 2;
  } else if (characteristics.isReasoning || characteristics.isResearch) {
    mode = "independent"; // Parallel reasoning
    rounds = 1;
  }
  
  // Apply user constraints
  if (constraints.maxRounds && rounds > constraints.maxRounds) rounds = constraints.maxRounds;
  
  // Determine if diversity should be enforced
  const ensureDiversity = characteristics.requiresDiversity || 
                          characteristics.isResearch || 
                          characteristics.isDebate ||
                          characteristics.isArchitecture ||
                          modelCount >= 5;
  
  // Assign roles for panel mode
  let roles = [];
  if (mode === "panel") {
    if (characteristics.isCoding) {
      roles = ["Software Engineer", "Code Reviewer", "Algorithm Expert", "Performance Engineer"];
    } else if (characteristics.isSecurity) {
      roles = ["Security Analyst", "Penetration Tester", "Compliance Expert", "Incident Responder"];
    } else if (characteristics.isArchitecture) {
      roles = ["System Architect", "DevOps Engineer", "Database Expert", "Cloud Architect"];
    } else if (characteristics.isResearch) {
      roles = ["Researcher", "Data Analyst", "Domain Expert", "Reviewer"];
    } else {
      roles = PANEL_ROLES.slice(0, modelCount);
    }
  }
  
  // Determine judge selection criteria
  let judgePreference = null;
  if (mode === "judge" || mode === "debate" || mode === "iterative") {
    if (characteristics.isCoding) {
      judgePreference = { capability: "coding", preference: "highest_score" };
    } else if (characteristics.isReasoning || characteristics.isMath) {
      judgePreference = { capability: "reasoning", preference: "highest_score" };
    } else {
      judgePreference = { preference: "highest_score" };
    }
  }
  
  // Estimate tokens and cost
  const avgInputTokens = Math.ceil(length * 1.5);
  const avgOutputTokens = complexity >= 60 ? 1500 : complexity >= 40 ? 1000 : 600;
  let totalModelCalls = modelCount;
  if (mode === "debate" || mode === "iterative") {
    totalModelCalls = modelCount * rounds;
  }
  totalModelCalls += 1; // judge
  
  const estimatedPromptTokens = avgInputTokens * totalModelCalls;
  const estimatedCompletionTokens = avgOutputTokens * totalModelCalls;
  const estimatedTotalTokens = estimatedPromptTokens + estimatedCompletionTokens;
  const estimatedCost = (estimatedTotalTokens / 1000000) * 0.5; // $0.50/1M tokens average
  
  // Check cost constraint
  let withinBudget = true;
  let budgetRecommendation = null;
  if (constraints.maxCost && estimatedCost > constraints.maxCost) {
    withinBudget = false;
    // Reduce configuration to fit budget
    const targetCost = constraints.maxCost * 0.9; // 10% margin
    const costReductionNeeded = estimatedCost / targetCost;
    
    if (costReductionNeeded > 1) {
      const newModelCount = Math.max(2, Math.floor(modelCount / Math.sqrt(costReductionNeeded)));
      const newRounds = Math.max(1, Math.floor(rounds / Math.sqrt(costReductionNeeded)));
      
      budgetRecommendation = {
        originalModelCount: modelCount,
        originalRounds: rounds,
        suggestedModelCount: newModelCount,
        suggestedRounds: newRounds,
        originalCost: estimatedCost,
        suggestedCost: (estimatedCost / costReductionNeeded) * 0.9
      };
      
      modelCount = newModelCount;
      rounds = newRounds;
    }
  }
  
  // Quality vs Speed vs Cost tradeoff
  const quality = complexity >= 70 ? "high" : complexity >= 40 ? "medium" : "standard";
  const speed = characteristics.isUrgent || modelCount <= 3 ? "fast" : modelCount <= 5 ? "medium" : "slow";
  const cost = estimatedCost >= 1.0 ? "high" : estimatedCost >= 0.3 ? "medium" : "low";
  
  return {
    recommended: {
      modelCount,
      mode,
      rounds,
      ensureDiversity,
      roles: roles.length > 0 ? roles.slice(0, modelCount) : null,
      judgePreference,
      maxTokens: avgOutputTokens,
      concurrency: characteristics.isUrgent ? 8 : 4
    },
    analysis: {
      complexity,
      characteristics: Object.entries(characteristics).filter(([k, v]) => v).map(([k]) => k),
      quality,
      speed,
      cost
    },
    estimates: {
      modelCalls: totalModelCalls,
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens,
      totalTokens: estimatedTotalTokens,
      estimatedCost,
      withinBudget,
      budgetRecommendation
    },
    reasoning: {
      whyThisMode: getModeReasoning(mode, characteristics),
      whyThisCount: getCountReasoning(modelCount, complexity, characteristics),
      whyTheseRounds: getRoundsReasoning(rounds, mode, complexity)
    }
  };
}

function getModeReasoning(mode, chars) {
  if (mode === "debate") return "Task involves debate or multiple perspectives requiring back-and-forth discussion";
  if (mode === "judge") return "Task requires consensus or definitive answer with quality assessment";
  if (mode === "panel") return "Task benefits from expert roles (coding/security/architecture)";
  if (mode === "iterative") return "Complex multi-step task benefits from iterative refinement";
  return "Standard independent responses are sufficient for this task";
}

function getCountReasoning(count, complexity, chars) {
  if (count >= 10) return "Very high complexity requires maximum diversity of perspectives";
  if (count >= 7) return "High complexity benefits from diverse viewpoints";
  if (count >= 5) return "Moderate complexity benefits from multiple perspectives";
  if (count >= 3) return "Standard task complexity with baseline model diversity";
  return "Simple task requiring minimal models";
}

function getRoundsReasoning(rounds, mode, complexity) {
  if (rounds >= 3) return `${mode === "iterative" ? "Iterative" : "Debate"} mode with high complexity benefits from multiple rounds of refinement`;
  if (rounds === 2) return `${mode === "iterative" ? "Iterative" : "Debate"} mode benefits from two rounds of processing`;
  return "Single round sufficient for this mode";
}

/**
 * Select optimal judge model based on preference and available models
 */
async function selectJudgeModel(env, availableModels, preference = null) {
  if (!preference) {
    // Default: pick highest scoring model
    return availableModels.reduce((best, m) => 
      (m.score || 0) > (best.score || 0) ? m : best
    , availableModels[0]);
  }
  
  if (preference.capability) {
    // Filter by capability
    const { listModels, CAPABILITIES } = await import("./models.js");
    const allModels = await listModels(env);
    const capable = allModels.filter(m => 
      m.status === "healthy" &&
      m.capabilities?.includes(preference.capability)
    );
    
    if (capable.length > 0) {
      return capable.reduce((best, m) => 
        (m.score || 0) > (best.score || 0) ? m : best
      , capable[0]);
    }
  }
  
  // Fallback to highest score from available
  return availableModels.reduce((best, m) => 
    (m.score || 0) > (best.score || 0) ? m : best
  , availableModels[0]);
}

/** Parse natural language council intent */
export function detectCouncilIntent(text) {
  const t = String(text || "").trim();
  const l = t.toLowerCase();
  if (!/(council|debate|مناظره|شورای|چند\s*مدل|multiple\s*models|ask\s+\d+\s*models|let\s+\d+|panel of|داوری\s*مدل)/i.test(t + " " + l)
    && !/^\/council\b/i.test(t)) return null;

  const num = Number((t.match(/(?:council\s+|ask\s+|با\s+|از\s+)?(\d{1,2})\s*(?:models?|مدل)/i) || t.match(/\/council\s+(\d+)/i) || [])[1]) || 0;
  let mode = "independent";
  if (/debate|مناظره|جدل/i.test(l)) mode = "debate";
  else if (/judge|داور/i.test(l)) mode = "judge";
  else if (/panel|متخصص|expert/i.test(l)) mode = "panel";
  else if (/iterat|چند\s*دور|round/i.test(l)) mode = "iterative";
  else if (/best answer|بهترین پاسخ|compare|مقایسه/i.test(l)) mode = "judge";

  // strip command-ish prefix to get question
  let question = t
    .replace(/^\/council\s*/i, "")
    .replace(/^ask\s+\d+\s*models?\s*(about|to|on|regarding)?\s*/i, "")
    .replace(/^let\s+\d+\s*(ai\s*)?models?\s*(debate|analyze|answer)?\s*(this|about)?\s*/i, "")
    .replace(/^با\s*\d+\s*مدل\s*(درباره|در مورد|تحلیل|بگو)?\s*/i, "")
    .replace(/^از\s*\d+\s*مدل\s*(بپرس|سوال کن)?\s*/i, "")
    .replace(/^(council|debate|مناظره|داوری)\s*[:：\-]?\s*/i, "")
    .trim();
  if (!question || question.length < 3) question = t.replace(/^\/council\s*(\d+\s*)?(debate|judge|panel|iterative)?\s*/i, "").trim();
  if (/^(about|to|on)\s+/i.test(question)) question = question.replace(/^(about|to|on)\s+/i, "");

  return {
    intent: "council.run",
    args: { count: num >= 2 ? num : 3, mode, question: question || t },
    confidence: 0.9
  };
}

// ─────────────────────────────────────────────
// Phase 14: Council Templates
// ─────────────────────────────────────────────

const TEMPLATE_INDEX = "council:templates";
const tmplKey = id => `council:template:${id}`;

/**
 * Built-in Council Templates for common use cases
 */
export const COUNCIL_TEMPLATES = {
  coding: {
    id: "coding",
    name: "Coding Council",
    description: "Code review, debugging, and implementation with software engineering experts",
    icon: "💻",
    mode: "panel",
    count: 5,
    rounds: 1,
    roles: [
      { id: "engineer", label: "Senior Engineer", prompt: "You are a senior software engineer. Focus on correctness, best practices, maintainability." },
      { id: "reviewer", label: "Code Reviewer", prompt: "You are a code reviewer. Focus on bugs, edge cases, security issues, performance." },
      { id: "architect", label: "Architect", prompt: "You are a software architect. Focus on design patterns, scalability, maintainability." },
      { id: "security", label: "Security Expert", prompt: "You are a security expert. Focus on vulnerabilities, authentication, authorization, input validation." },
      { id: "tester", label: "QA Engineer", prompt: "You are a QA engineer. Focus on test cases, edge cases, error handling." }
    ],
    task: "coding",
    ensureDiversity: true,
    systemPrompt: "Analyze this code or implementation request from multiple engineering perspectives. Be specific and actionable."
  },
  
  research: {
    id: "research",
    name: "Research Council",
    description: "Deep research with source verification, multiple perspectives, and fact-checking",
    icon: "🔬",
    mode: "iterative",
    count: 5,
    rounds: 2,
    task: "reasoning",
    ensureDiversity: true,
    systemPrompt: "Research this topic thoroughly. Provide evidence, cite sources when possible, identify uncertainties. Be rigorous and honest about what is known vs unknown."
  },
  
  security: {
    id: "security",
    name: "Security Audit Council",
    description: "Comprehensive security review with threat modeling and vulnerability analysis",
    icon: "🔒",
    mode: "panel",
    count: 4,
    rounds: 1,
    roles: [
      { id: "pentester", label: "Penetration Tester", prompt: "You are a penetration tester. Find vulnerabilities, attack vectors, exploits." },
      { id: "appsec", label: "Application Security", prompt: "You are an application security expert. Focus on OWASP Top 10, secure coding, input validation." },
      { id: "compliance", label: "Compliance Expert", prompt: "You are a compliance expert. Focus on standards, regulations, best practices." },
      { id: "incident", label: "Incident Responder", prompt: "You are an incident responder. Focus on detection, monitoring, incident response." }
    ],
    task: "reasoning",
    ensureDiversity: true,
    systemPrompt: "Perform a comprehensive security audit. Identify vulnerabilities, assess risks, recommend remediations."
  },
  
  architecture: {
    id: "architecture",
    name: "Architecture Review Council",
    description: "System design review with scalability, reliability, and performance analysis",
    icon: "🏗️",
    mode: "panel",
    count: 5,
    rounds: 1,
    roles: [
      { id: "architect", label: "System Architect", prompt: "You are a system architect. Focus on overall design, components, data flow." },
      { id: "devops", label: "DevOps Engineer", prompt: "You are a DevOps engineer. Focus on deployment, monitoring, reliability, CI/CD." },
      { id: "dba", label: "Database Expert", prompt: "You are a database expert. Focus on data modeling, queries, indexing, scalability." },
      { id: "performance", label: "Performance Engineer", prompt: "You are a performance engineer. Focus on bottlenecks, optimization, caching, load." },
      { id: "cloud", label: "Cloud Architect", prompt: "You are a cloud architect. Focus on cloud services, cost, scalability, availability." }
    ],
    task: "reasoning",
    ensureDiversity: true,
    systemPrompt: "Review this architecture from multiple technical perspectives. Assess scalability, reliability, performance, cost."
  },
  
  factcheck: {
    id: "factcheck",
    name: "Fact Check Council",
    description: "Verify claims with evidence, identify misinformation, assess source credibility",
    icon: "✓",
    mode: "judge",
    count: 5,
    rounds: 1,
    task: "factual",
    ensureDiversity: true,
    systemPrompt: "Verify the factual accuracy of this claim or statement. Provide evidence for or against. Identify any misinformation or misleading statements. Assess source credibility. Be rigorous and cite sources."
  },
  
  business: {
    id: "business",
    name: "Business Analysis Council",
    description: "Business strategy, market analysis, and decision-making with multiple stakeholder perspectives",
    icon: "📊",
    mode: "panel",
    count: 5,
    rounds: 1,
    roles: [
      { id: "strategist", label: "Business Strategist", prompt: "You are a business strategist. Focus on strategy, competitive advantage, market position." },
      { id: "finance", label: "Financial Analyst", prompt: "You are a financial analyst. Focus on costs, revenue, ROI, financial viability." },
      { id: "marketing", label: "Marketing Expert", prompt: "You are a marketing expert. Focus on positioning, messaging, customer acquisition." },
      { id: "ops", label: "Operations Manager", prompt: "You are an operations manager. Focus on execution, processes, resources, risks." },
      { id: "customer", label: "Customer Advocate", prompt: "You are a customer advocate. Focus on user needs, pain points, value proposition." }
    ],
    task: "reasoning",
    ensureDiversity: true,
    systemPrompt: "Analyze this business decision or strategy from multiple stakeholder perspectives."
  },
  
  creative: {
    id: "creative",
    name: "Creative Brainstorming Council",
    description: "Generate diverse creative ideas with different creative perspectives",
    icon: "🎨",
    mode: "independent",
    count: 6,
    rounds: 1,
    task: "creative",
    ensureDiversity: true,
    systemPrompt: "Generate creative and diverse ideas for this prompt. Think outside the box. Be original and specific."
  },
  
  reasoning: {
    id: "reasoning",
    name: "Advanced Reasoning Council",
    description: "Deep analytical reasoning with multiple logical approaches",
    icon: "🧠",
    mode: "debate",
    count: 5,
    rounds: 3,
    task: "reasoning",
    ensureDiversity: true,
    systemPrompt: "Apply rigorous logical reasoning to this problem. Show your reasoning steps. Consider multiple approaches. Identify assumptions and limitations."
  }
};

/**
 * Get built-in template by ID
 */
export function getBuiltinTemplate(templateId) {
  return COUNCIL_TEMPLATES[templateId] || null;
}

/**
 * List all built-in templates
 */
export function listBuiltinTemplates() {
  return Object.values(COUNCIL_TEMPLATES);
}

/**
 * Create custom template
 */
export async function createCouncilTemplate(env, input, userId = 0) {
  const template = {
    id: input.id || newId("ctpl"),
    userId,
    name: String(input.name || "Custom Council").slice(0, 100),
    description: String(input.description || "").slice(0, 500),
    icon: input.icon || "⚙️",
    mode: COUNCIL_MODES[input.mode] ? input.mode : "independent",
    count: clamp(Number(input.count) || 3, 2, 30),
    rounds: clamp(Number(input.rounds) || 1, 1, 5),
    roles: input.roles || [],
    task: input.task || "chat",
    ensureDiversity: input.ensureDiversity !== false,
    systemPrompt: input.systemPrompt || null,
    modelIds: input.modelIds || [],
    judgeModelId: input.judgeModelId || null,
    tags: Array.isArray(input.tags) ? input.tags : [],
    isBuiltin: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  
  await kvPut(env, tmplKey(template.id), template);
  await indexAdd(env, TEMPLATE_INDEX, template.id);
  
  await audit(env, {
    userId,
    action: "council.template.create",
    resource: template.id,
    meta: { name: template.name, mode: template.mode }
  });
  
  return template;
}

/**
 * Get template by ID (checks both builtin and custom)
 */
export async function getCouncilTemplate(env, templateId) {
  // Check builtin first
  const builtin = getBuiltinTemplate(templateId);
  if (builtin) {
    return { ...builtin, isBuiltin: true };
  }
  
  // Check custom
  return await kvGet(env, tmplKey(templateId), null);
}

/**
 * List all templates (builtin + custom for user)
 */
export async function listCouncilTemplates(env, userId = 0) {
  const builtin = listBuiltinTemplates().map(t => ({ ...t, isBuiltin: true }));
  
  const ids = await kvGet(env, TEMPLATE_INDEX, []);
  const custom = await readMany(env, ids.map(tmplKey));
  const userCustom = custom.filter(t => !userId || !t.userId || Number(t.userId) === Number(userId));
  
  return [...builtin, ...userCustom];
}

/**
 * Update custom template
 */
export async function updateCouncilTemplate(env, templateId, updates, userId = 0) {
  const template = await kvGet(env, tmplKey(templateId), null);
  if (!template) throw new Error("Template not found");
  if (template.isBuiltin) throw new Error("Cannot modify builtin templates");
  if (template.userId && template.userId !== userId) throw new Error("Unauthorized");
  
  const updated = {
    ...template,
    name: updates.name !== undefined ? String(updates.name).slice(0, 100) : template.name,
    description: updates.description !== undefined ? String(updates.description).slice(0, 500) : template.description,
    icon: updates.icon !== undefined ? updates.icon : template.icon,
    mode: updates.mode && COUNCIL_MODES[updates.mode] ? updates.mode : template.mode,
    count: updates.count !== undefined ? clamp(Number(updates.count), 2, 30) : template.count,
    rounds: updates.rounds !== undefined ? clamp(Number(updates.rounds), 1, 5) : template.rounds,
    roles: updates.roles !== undefined ? updates.roles : template.roles,
    task: updates.task !== undefined ? updates.task : template.task,
    ensureDiversity: updates.ensureDiversity !== undefined ? updates.ensureDiversity : template.ensureDiversity,
    systemPrompt: updates.systemPrompt !== undefined ? updates.systemPrompt : template.systemPrompt,
    modelIds: updates.modelIds !== undefined ? updates.modelIds : template.modelIds,
    judgeModelId: updates.judgeModelId !== undefined ? updates.judgeModelId : template.judgeModelId,
    tags: updates.tags !== undefined ? updates.tags : template.tags,
    updatedAt: nowIso()
  };
  
  await kvPut(env, tmplKey(templateId), updated);
  
  await audit(env, {
    userId,
    action: "council.template.update",
    resource: templateId,
    meta: { name: updated.name }
  });
  
  return updated;
}

/**
 * Delete custom template
 */
export async function deleteCouncilTemplate(env, templateId, userId = 0) {
  const template = await kvGet(env, tmplKey(templateId), null);
  if (!template) return false;
  if (template.isBuiltin) throw new Error("Cannot delete builtin templates");
  if (template.userId && template.userId !== userId) throw new Error("Unauthorized");
  
  const ids = (await kvGet(env, TEMPLATE_INDEX, [])).filter(x => x !== templateId);
  await kvPut(env, TEMPLATE_INDEX, ids);
  
  await kvDel(env, tmplKey(templateId));
  
  await audit(env, {
    userId,
    action: "council.template.delete",
    resource: templateId,
    meta: { name: template.name }
  });
  
  return true;
}

/**
 * Duplicate template (builtin or custom)
 */
export async function duplicateCouncilTemplate(env, templateId, userId = 0, customizations = {}) {
  const source = await getCouncilTemplate(env, templateId);
  if (!source) throw new Error("Template not found");
  
  const duplicate = {
    ...source,
    id: newId("ctpl"),
    name: customizations.name || `${source.name} (Copy)`,
    description: customizations.description || source.description,
    userId,
    isBuiltin: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...customizations
  };
  
  delete duplicate.isBuiltin;
  
  await kvPut(env, tmplKey(duplicate.id), duplicate);
  await indexAdd(env, TEMPLATE_INDEX, duplicate.id);
  
  return duplicate;
}

/**
 * Instantiate council from template
 * Merges template settings with runtime overrides
 */
export function instantiateFromTemplate(template, overrides = {}) {
  const config = {
    mode: overrides.mode || template.mode,
    count: overrides.count !== undefined ? overrides.count : template.count,
    rounds: overrides.rounds !== undefined ? overrides.rounds : template.rounds,
    modelIds: overrides.modelIds || template.modelIds || [],
    judgeModelId: overrides.judgeModelId || template.judgeModelId,
    task: overrides.task || template.task,
    ensureDiversity: overrides.ensureDiversity !== undefined ? overrides.ensureDiversity : template.ensureDiversity,
    maxTokens: overrides.maxTokens,
    concurrency: overrides.concurrency
  };
  
  // Add system prompt if present in template
  if (template.systemPrompt && !overrides.ignoreSystemPrompt) {
    config.systemPrompt = template.systemPrompt;
  }
  
  // Add roles if panel mode
  if (config.mode === "panel" && template.roles && template.roles.length > 0) {
    config.roles = template.roles;
  }
  
  return config;
}

/**
 * Get template statistics (usage count, avg quality, etc.)
 */
export async function getTemplateStats(env, templateId) {
  // Get all council runs
  const runs = await listCouncilRuns(env, null, 1000);
  
  // Filter by template (stored in run metadata or match by config)
  const templateRuns = runs.filter(r => 
    r.templateId === templateId || 
    (r.metadata && r.metadata.templateId === templateId)
  );
  
  if (templateRuns.length === 0) {
    return {
      templateId,
      totalRuns: 0,
      avgQuality: null,
      avgCost: null,
      avgDuration: null
    };
  }
  
  const avgQuality = templateRuns
    .filter(r => r.synthesis && r.synthesis.quality && r.synthesis.quality.overallQuality)
    .reduce((sum, r) => sum + r.synthesis.quality.overallQuality, 0) / templateRuns.length;
  
  const avgCost = templateRuns
    .reduce((sum, r) => sum + (r.totals.cost || 0), 0) / templateRuns.length;
  
  const avgDuration = templateRuns
    .filter(r => r.startedAt && r.finishedAt)
    .reduce((sum, r) => {
      const duration = new Date(r.finishedAt) - new Date(r.startedAt);
      return sum + duration;
    }, 0) / templateRuns.filter(r => r.startedAt && r.finishedAt).length;
  
  return {
    templateId,
    totalRuns: templateRuns.length,
    avgQuality: Math.round(avgQuality) || null,
    avgCost: Math.round(avgCost * 1000) / 1000 || null,
    avgDuration: Math.round(avgDuration / 1000) || null, // seconds
    successRate: Math.round((templateRuns.filter(r => r.status === "done").length / templateRuns.length) * 100)
  };
}
