// ─────────────────────────────────────────────
// ⚡ Query Optimizer — Intelligent query rewriting and optimization
// Prompt optimization, query decomposition, parallel execution
// ─────────────────────────────────────────────

import { route } from "./router.js";
import { kvGet, kvPut, nowIso } from "../core/kv.js";

// ── Query Analysis ──────────────────────────────────────────────

/**
 * Analyze query complexity
 */
export function analyzeQueryComplexity(query) {
  const analysis = {
    length: query.length,
    words: query.split(/\s+/).length,
    sentences: query.split(/[.!?]+/).filter(s => s.trim()).length,
    questions: (query.match(/\?/g) || []).length,
    complexity: "simple"
  };

  // Detect complexity indicators
  const complexityIndicators = {
    multiStep: /first.*then|step.*step|before.*after/i.test(query),
    conditional: /if.*then|when.*do|unless/i.test(query),
    comparison: /compare|versus|vs\.|difference between/i.test(query),
    listing: /list|enumerate|all of|every/i.test(query),
    calculation: /calculate|compute|sum|total|average/i.test(query)
  };

  const indicatorCount = Object.values(complexityIndicators).filter(Boolean).length;

  if (indicatorCount >= 2 || analysis.words > 100) {
    analysis.complexity = "complex";
  } else if (indicatorCount === 1 || analysis.words > 50) {
    analysis.complexity = "medium";
  }

  analysis.indicators = complexityIndicators;

  return analysis;
}

/**
 * Detect query type
 */
export function detectQueryType(query) {
  const types = [];

  if (/what|who|where|when|which|whose/i.test(query)) {
    types.push("factual");
  }
  if (/how/i.test(query)) {
    types.push("procedural");
  }
  if (/why/i.test(query)) {
    types.push("explanatory");
  }
  if (/should|would|could|can/i.test(query)) {
    types.push("hypothetical");
  }
  if (/\?$/i.test(query.trim())) {
    types.push("question");
  } else {
    types.push("statement");
  }

  return types;
}

// ── Query Decomposition ─────────────────────────────────────────

/**
 * Decompose complex query into sub-queries
 */
export async function decomposeQuery(env, { query, modelId, userId }) {
  const analysis = analyzeQueryComplexity(query);

  if (analysis.complexity === "simple") {
    return { subQueries: [query], needsDecomposition: false };
  }

  // Use LLM to decompose
  const prompt = `Decompose the following complex query into simpler sub-queries that can be answered independently. Return ONLY a JSON array of strings.

Query: "${query}"

Example format: ["sub-query 1", "sub-query 2", "sub-query 3"]`;

  try {
    const result = await route(env, [
      { role: "user", content: prompt }
    ], {
      modelId: modelId || "gpt-4",
      temperature: 0.3,
      maxTokens: 500,
      json: true,
      userId
    });

    const subQueries = JSON.parse(result.text);
    return {
      subQueries: Array.isArray(subQueries) ? subQueries : [query],
      needsDecomposition: true,
      original: query
    };
  } catch (error) {
    // Fall back to original query
    return { subQueries: [query], needsDecomposition: false, error: error.message };
  }
}

/**
 * Execute sub-queries in parallel
 */
export async function executeParallelQueries(env, { subQueries, modelId, userId }) {
  const results = await Promise.all(
    subQueries.map(async (query, index) => {
      try {
        const result = await route(env, [
          { role: "user", content: query }
        ], {
          modelId,
          userId
        });

        return {
          index,
          query,
          answer: result.text,
          success: true,
          latency: result.latency
        };
      } catch (error) {
        return {
          index,
          query,
          error: error.message,
          success: false
        };
      }
    })
  );

  return results;
}

/**
 * Synthesize sub-query results
 */
export async function synthesizeResults(env, { original, results, modelId, userId }) {
  const successfulResults = results.filter(r => r.success);

  if (successfulResults.length === 0) {
    throw new Error("All sub-queries failed");
  }

  const context = successfulResults
    .map(r => `Q: ${r.query}\nA: ${r.answer}`)
    .join("\n\n");

  const prompt = `Based on these answers to sub-questions, provide a comprehensive answer to the original question.

Original question: "${original}"

Sub-question answers:
${context}

Provide a clear, coherent answer that synthesizes the information above:`;

  const result = await route(env, [
    { role: "user", content: prompt }
  ], {
    modelId,
    temperature: 0.5,
    userId
  });

  return {
    answer: result.text,
    subResults: results,
    totalLatency: results.reduce((sum, r) => sum + (r.latency || 0), 0)
  };
}

// ── Prompt Optimization ─────────────────────────────────────────

/**
 * Optimize prompt for better results
 */
export async function optimizePrompt(env, { prompt, objective = "clarity", modelId, userId }) {
  const optimizationStrategies = {
    clarity: "Rewrite this prompt to be clearer and more specific",
    conciseness: "Rewrite this prompt to be more concise while retaining all key information",
    detail: "Expand this prompt with more context and specific requirements",
    structure: "Restructure this prompt with clear sections and bullet points",
    examples: "Add relevant examples to this prompt to clarify expectations"
  };

  const strategy = optimizationStrategies[objective] || optimizationStrategies.clarity;

  const optimizationPrompt = `${strategy}:

Original prompt:
"""
${prompt}
"""

Optimized prompt:`;

  try {
    const result = await route(env, [
      { role: "user", content: optimizationPrompt }
    ], {
      modelId: modelId || "gpt-4",
      temperature: 0.7,
      userId
    });

    return {
      original: prompt,
      optimized: result.text.trim(),
      objective,
      improvement: result.text.length / prompt.length
    };
  } catch (error) {
    return {
      original: prompt,
      optimized: prompt,
      objective,
      error: error.message
    };
  }
}

/**
 * Suggest prompt improvements
 */
export function suggestPromptImprovements(prompt) {
  const suggestions = [];

  // Check for vagueness
  if (prompt.length < 20) {
    suggestions.push({
      type: "length",
      severity: "high",
      message: "Prompt is very short. Add more context and specific requirements."
    });
  }

  // Check for questions
  if (!prompt.includes("?") && !prompt.toLowerCase().includes("please")) {
    suggestions.push({
      type: "clarity",
      severity: "medium",
      message: "Consider phrasing as a clear question or request."
    });
  }

  // Check for examples
  if (prompt.length > 100 && !prompt.includes("example") && !prompt.includes("like")) {
    suggestions.push({
      type: "examples",
      severity: "low",
      message: "Consider adding examples to clarify expectations."
    });
  }

  // Check for constraints
  if (prompt.length > 50 && !/(length|format|style|tone)/i.test(prompt)) {
    suggestions.push({
      type: "constraints",
      severity: "low",
      message: "Consider specifying output format, length, or style preferences."
    });
  }

  return suggestions;
}

// ── Query Rewriting ─────────────────────────────────────────────

/**
 * Rewrite query for better results
 */
export async function rewriteQuery(env, { query, context = null, modelId, userId }) {
  let rewritePrompt = `Rewrite the following query to be clearer and more likely to get a good answer. Keep the core intent but improve clarity and specificity.

Original query: "${query}"`;

  if (context) {
    rewritePrompt += `\n\nContext: ${context}`;
  }

  rewritePrompt += `\n\nRewritten query:`;

  try {
    const result = await route(env, [
      { role: "user", content: rewritePrompt }
    ], {
      modelId: modelId || "gpt-4",
      temperature: 0.5,
      maxTokens: 200,
      userId
    });

    return {
      original: query,
      rewritten: result.text.trim(),
      improved: true
    };
  } catch (error) {
    return {
      original: query,
      rewritten: query,
      improved: false,
      error: error.message
    };
  }
}

/**
 * Expand abbreviations and acronyms
 */
export function expandAbbreviations(query) {
  const abbreviations = {
    "AI": "Artificial Intelligence",
    "ML": "Machine Learning",
    "NLP": "Natural Language Processing",
    "API": "Application Programming Interface",
    "UI": "User Interface",
    "UX": "User Experience",
    "DB": "Database",
    "SQL": "Structured Query Language",
    "REST": "Representational State Transfer",
    "JSON": "JavaScript Object Notation",
    "HTML": "HyperText Markup Language",
    "CSS": "Cascading Style Sheets",
    "JS": "JavaScript"
  };

  let expanded = query;
  const expansions = [];

  for (const [abbr, full] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${abbr}\\b`, "g");
    if (regex.test(expanded)) {
      expansions.push({ abbreviation: abbr, expansion: full });
      // Optionally expand in the query
      // expanded = expanded.replace(regex, `${abbr} (${full})`);
    }
  }

  return { original: query, expanded, expansions };
}

// ── Execution Strategies ────────────────────────────────────────

/**
 * Auto-select optimal execution strategy
 */
export async function optimizeQueryExecution(env, { query, modelId, userId }) {
  const analysis = analyzeQueryComplexity(query);

  // Simple queries: direct execution
  if (analysis.complexity === "simple") {
    return {
      strategy: "direct",
      query,
      optimization: "none"
    };
  }

  // Complex queries: decompose and parallelize
  if (analysis.complexity === "complex") {
    const decomposition = await decomposeQuery(env, { query, modelId, userId });
    
    if (decomposition.needsDecomposition && decomposition.subQueries.length > 1) {
      return {
        strategy: "decompose",
        subQueries: decomposition.subQueries,
        optimization: "parallel_execution"
      };
    }
  }

  // Medium complexity: rewrite for clarity
  const rewritten = await rewriteQuery(env, { query, modelId, userId });

  return {
    strategy: "rewrite",
    query: rewritten.rewritten,
    original: query,
    optimization: "clarity"
  };
}

// ── Performance Tracking ────────────────────────────────────────

/**
 * Track optimization metrics
 */
export async function trackOptimization(env, { strategy, latency, success, userId }) {
  const key = `optimization_metrics:${strategy}`;
  const metrics = await kvGet(env, key) || {
    strategy,
    totalExecutions: 0,
    successfulExecutions: 0,
    totalLatency: 0,
    avgLatency: 0
  };

  metrics.totalExecutions += 1;
  if (success) metrics.successfulExecutions += 1;
  metrics.totalLatency += latency;
  metrics.avgLatency = metrics.totalLatency / metrics.totalExecutions;
  metrics.successRate = (metrics.successfulExecutions / metrics.totalExecutions) * 100;
  metrics.lastUpdated = nowIso();

  await kvPut(env, key, metrics, { expirationTtl: 86400 * 30 });

  return metrics;
}

/**
 * Get optimization statistics
 */
export async function getOptimizationStats(env) {
  const strategies = ["direct", "decompose", "rewrite", "parallel"];
  const stats = {};

  for (const strategy of strategies) {
    const metrics = await kvGet(env, `optimization_metrics:${strategy}`);
    if (metrics) {
      stats[strategy] = metrics;
    }
  }

  return stats;
}

/**
 * Recommend best strategy based on historical data
 */
export async function recommendStrategy(env, query) {
  const analysis = analyzeQueryComplexity(query);
  const stats = await getOptimizationStats(env);

  // Find strategy with best success rate for this complexity
  const candidates = Object.entries(stats)
    .filter(([, metrics]) => metrics.totalExecutions > 10)
    .sort((a, b) => b[1].successRate - a[1].successRate);

  if (candidates.length === 0) {
    // No historical data, use heuristic
    return analysis.complexity === "complex" ? "decompose" : "direct";
  }

  return candidates[0][0];
}
