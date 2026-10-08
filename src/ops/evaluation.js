// ─────────────────────────────────────────────
// Phase 15-16: AI Evaluation & Regression Testing System
// ─────────────────────────────────────────────
import { kvGet, kvPut, kvDel, indexAdd, indexRemove, newId, nowIso, readMany } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { route } from "../gateway/router.js";
import { runAgent } from "../agents/runtime.js";

const EVAL_INDEX = "eval:datasets";
const EVAL_RUN_INDEX = "eval:runs";
const evalKey = id => `eval:dataset:${id}`;
const runKey = id => `eval:run:${id}`;

// ═══════════════════════════════════════════════════════════
// Phase 15: Evaluation Dataset System
// ═══════════════════════════════════════════════════════════

/**
 * Evaluation criteria types
 */
export const EVAL_CRITERIA = {
  exact_match: { label: "Exact Match", desc: "Output must match expected exactly" },
  contains: { label: "Contains", desc: "Output must contain expected substring" },
  regex: { label: "Regex Match", desc: "Output must match regex pattern" },
  semantic_similarity: { label: "Semantic Similarity", desc: "Output semantically similar to expected (>threshold)" },
  json_valid: { label: "Valid JSON", desc: "Output must be valid JSON" },
  json_schema: { label: "JSON Schema", desc: "Output must match JSON schema" },
  no_errors: { label: "No Errors", desc: "Execution must not produce errors" },
  custom_function: { label: "Custom Function", desc: "Pass output to custom evaluation function" },
  llm_judge: { label: "LLM Judge", desc: "Use LLM to judge if output meets criteria" },
  latency_max: { label: "Max Latency", desc: "Response time must be under threshold" },
  token_max: { label: "Max Tokens", desc: "Token count must be under threshold" },
  cost_max: { label: "Max Cost", desc: "Cost must be under threshold" }
};

/**
 * Create evaluation dataset
 */
export async function createEvalDataset(env, input, userId = 0) {
  const dataset = {
    id: input.id || newId("evds"),
    userId,
    name: String(input.name || "Untitled Dataset").slice(0, 100),
    description: String(input.description || "").slice(0, 500),
    category: input.category || "general", // general, model, agent, router, prompt
    tags: Array.isArray(input.tags) ? input.tags : [],
    cases: [], // Evaluation test cases
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  
  await kvPut(env, evalKey(dataset.id), dataset);
  await indexAdd(env, EVAL_INDEX, dataset.id);
  
  await audit(env, { userId, action: "eval.dataset.create", resource: dataset.id, meta: { name: dataset.name } });
  
  return dataset;
}

/**
 * Add test case to dataset
 */
export async function addEvalCase(env, datasetId, testCase, userId = 0) {
  const dataset = await kvGet(env, evalKey(datasetId), null);
  if (!dataset) throw new Error("Dataset not found");
  if (dataset.userId && dataset.userId !== userId) throw new Error("Unauthorized");
  
  const evalCase = {
    id: testCase.id || newId("case"),
    question: String(testCase.question || "").trim(),
    input: testCase.input || {}, // Additional input parameters
    expectedBehavior: String(testCase.expectedBehavior || "").slice(0, 1000),
    expectedOutput: testCase.expectedOutput || null, // Optional reference answer
    criteria: Array.isArray(testCase.criteria) ? testCase.criteria : [
      { type: "no_errors", threshold: null }
    ],
    context: testCase.context || {}, // System prompt, memory, tools, etc.
    tags: Array.isArray(testCase.tags) ? testCase.tags : [],
    createdAt: nowIso()
  };
  
  dataset.cases.push(evalCase);
  dataset.updatedAt = nowIso();
  
  await kvPut(env, evalKey(datasetId), dataset);
  await audit(env, { userId, action: "eval.case.add", resource: datasetId, meta: { caseId: evalCase.id } });
  
  return evalCase;
}

/**
 * Update test case
 */
export async function updateEvalCase(env, datasetId, caseId, updates, userId = 0) {
  const dataset = await kvGet(env, evalKey(datasetId), null);
  if (!dataset) throw new Error("Dataset not found");
  if (dataset.userId && dataset.userId !== userId) throw new Error("Unauthorized");
  
  const caseIndex = dataset.cases.findIndex(c => c.id === caseId);
  if (caseIndex === -1) throw new Error("Test case not found");
  
  dataset.cases[caseIndex] = {
    ...dataset.cases[caseIndex],
    ...updates,
    id: caseId, // Preserve ID
    updatedAt: nowIso()
  };
  
  dataset.updatedAt = nowIso();
  await kvPut(env, evalKey(datasetId), dataset);
  
  return dataset.cases[caseIndex];
}

/**
 * Delete test case
 */
export async function deleteEvalCase(env, datasetId, caseId, userId = 0) {
  const dataset = await kvGet(env, evalKey(datasetId), null);
  if (!dataset) throw new Error("Dataset not found");
  if (dataset.userId && dataset.userId !== userId) throw new Error("Unauthorized");
  
  dataset.cases = dataset.cases.filter(c => c.id !== caseId);
  dataset.updatedAt = nowIso();
  
  await kvPut(env, evalKey(datasetId), dataset);
  return true;
}

/**
 * Get evaluation dataset
 */
export async function getEvalDataset(env, datasetId) {
  return await kvGet(env, evalKey(datasetId), null);
}

/**
 * List evaluation datasets
 */
export async function listEvalDatasets(env, userId = 0, filters = {}) {
  const ids = await kvGet(env, EVAL_INDEX, []);
  const datasets = await readMany(env, ids.map(evalKey));
  
  let filtered = datasets.filter(d => !userId || !d.userId || d.userId === userId);
  
  if (filters.category) {
    filtered = filtered.filter(d => d.category === filters.category);
  }
  
  if (filters.tag) {
    filtered = filtered.filter(d => d.tags && d.tags.includes(filters.tag));
  }
  
  return filtered;
}

/**
 * Delete evaluation dataset
 */
export async function deleteEvalDataset(env, datasetId, userId = 0) {
  const dataset = await kvGet(env, evalKey(datasetId), null);
  if (!dataset) return false;
  if (dataset.userId && dataset.userId !== userId) throw new Error("Unauthorized");
  
  const ids = (await kvGet(env, EVAL_INDEX, [])).filter(x => x !== datasetId);
  await kvPut(env, EVAL_INDEX, ids);
  
  await kvDel(env, evalKey(datasetId));
  
  await audit(env, { userId, action: "eval.dataset.delete", resource: datasetId });
  return true;
}

// ═══════════════════════════════════════════════════════════
// Phase 16: Regression Testing - Evaluation Runner
// ═══════════════════════════════════════════════════════════

/**
 * Evaluate single test case
 */
async function evaluateCase(env, testCase, targetConfig, options = {}) {
  const startTime = Date.now();
  let output = null;
  let error = null;
  let metadata = {};
  
  try {
    // Execute based on target type
    if (targetConfig.type === "model" || targetConfig.type === "router") {
      const messages = [
        ...(testCase.context?.systemPrompt ? [{ role: "system", content: testCase.context.systemPrompt }] : []),
        { role: "user", content: testCase.question }
      ];
      
      const result = await route(env, messages, {
        modelId: targetConfig.modelId,
        userId: options.userId,
        ...testCase.input
      });
      
      output = result.text;
      metadata = {
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        cost: result.cost,
        latency: result.latency
      };
      
    } else if (targetConfig.type === "agent") {
      const result = await runAgent(env, targetConfig.agentId, {
        goal: testCase.question,
        userId: options.userId,
        ...testCase.input
      });
      
      output = result.result;
      metadata = {
        agentId: targetConfig.agentId,
        steps: result.steps?.length || 0,
        toolCalls: result.toolCalls || 0,
        cost: result.cost
      };
    }
    
  } catch (e) {
    error = String(e.message || e);
  }
  
  const executionTime = Date.now() - startTime;
  
  // Evaluate against criteria
  const results = [];
  for (const criterion of testCase.criteria) {
    const result = await evaluateCriterion(env, criterion, output, testCase, metadata, executionTime);
    results.push(result);
  }
  
  const passed = results.every(r => r.passed);
  const score = results.length > 0 ? results.filter(r => r.passed).length / results.length : 0;
  
  return {
    caseId: testCase.id,
    question: testCase.question,
    output,
    error,
    executionTime,
    metadata,
    criteriaResults: results,
    passed,
    score: Math.round(score * 100),
    timestamp: nowIso()
  };
}

/**
 * Evaluate single criterion
 */
async function evaluateCriterion(env, criterion, output, testCase, metadata, executionTime) {
  const result = {
    type: criterion.type,
    passed: false,
    score: 0,
    message: "",
    details: null
  };
  
  try {
    switch (criterion.type) {
      case "exact_match":
        result.passed = output === testCase.expectedOutput;
        result.message = result.passed ? "Exact match" : "Output does not match expected";
        result.score = result.passed ? 100 : 0;
        break;
        
      case "contains":
        result.passed = output && output.includes(testCase.expectedOutput);
        result.message = result.passed ? "Contains expected substring" : "Missing expected substring";
        result.score = result.passed ? 100 : 0;
        break;
        
      case "regex":
        const regex = new RegExp(criterion.pattern);
        result.passed = regex.test(output);
        result.message = result.passed ? "Matches regex" : "Does not match regex";
        result.score = result.passed ? 100 : 0;
        break;
        
      case "json_valid":
        try {
          JSON.parse(output);
          result.passed = true;
          result.message = "Valid JSON";
          result.score = 100;
        } catch {
          result.passed = false;
          result.message = "Invalid JSON";
          result.score = 0;
        }
        break;
        
      case "no_errors":
        result.passed = !metadata.error && !testCase.error;
        result.message = result.passed ? "No errors" : "Execution failed";
        result.score = result.passed ? 100 : 0;
        break;
        
      case "latency_max":
        result.passed = executionTime <= criterion.threshold;
        result.message = `Latency: ${executionTime}ms (max: ${criterion.threshold}ms)`;
        result.score = result.passed ? 100 : Math.max(0, 100 - ((executionTime - criterion.threshold) / criterion.threshold * 100));
        result.details = { actual: executionTime, threshold: criterion.threshold };
        break;
        
      case "token_max":
        const totalTokens = (metadata.promptTokens || 0) + (metadata.completionTokens || 0);
        result.passed = totalTokens <= criterion.threshold;
        result.message = `Tokens: ${totalTokens} (max: ${criterion.threshold})`;
        result.score = result.passed ? 100 : Math.max(0, 100 - ((totalTokens - criterion.threshold) / criterion.threshold * 100));
        result.details = { actual: totalTokens, threshold: criterion.threshold };
        break;
        
      case "cost_max":
        result.passed = (metadata.cost || 0) <= criterion.threshold;
        result.message = `Cost: $${metadata.cost} (max: $${criterion.threshold})`;
        result.score = result.passed ? 100 : Math.max(0, 100 - ((metadata.cost - criterion.threshold) / criterion.threshold * 100));
        result.details = { actual: metadata.cost, threshold: criterion.threshold };
        break;
        
      case "llm_judge":
        // Use LLM to evaluate if output meets criteria
        const judgeMessages = [
          { role: "system", content: "You are an evaluation judge. Determine if the output meets the specified criteria. Respond with JSON: {\"passed\": true/false, \"score\": 0-100, \"reasoning\": \"explanation\"}" },
          { role: "user", content: `Criteria: ${testCase.expectedBehavior}\n\nOutput: ${output}\n\nDoes this output meet the criteria?` }
        ];
        
        const judgeResult = await route(env, judgeMessages, { json: true, maxTokens: 300 });
        const judgment = JSON.parse(judgeResult.text);
        
        result.passed = judgment.passed;
        result.score = judgment.score || (judgment.passed ? 100 : 0);
        result.message = judgment.reasoning;
        break;
        
      default:
        result.message = `Unknown criterion type: ${criterion.type}`;
    }
  } catch (e) {
    result.message = `Evaluation error: ${e.message}`;
  }
  
  return result;
}

/**
 * Run evaluation on dataset
 */
export async function runEvaluation(env, datasetId, targetConfig, options = {}) {
  const dataset = await getEvalDataset(env, datasetId);
  if (!dataset) throw new Error("Dataset not found");
  
  const runId = newId("evrun");
  const run = {
    id: runId,
    datasetId,
    datasetName: dataset.name,
    targetConfig,
    status: "running",
    startedAt: nowIso(),
    finishedAt: null,
    results: [],
    summary: {
      total: dataset.cases.length,
      passed: 0,
      failed: 0,
      avgScore: 0,
      avgExecutionTime: 0,
      totalCost: 0
    }
  };
  
  await kvPut(env, runKey(runId), run);
  await indexAdd(env, EVAL_RUN_INDEX, runId);
  
  // Run evaluations in batches
  const batchSize = options.batchSize || 5;
  for (let i = 0; i < dataset.cases.length; i += batchSize) {
    const batch = dataset.cases.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(testCase => evaluateCase(env, testCase, targetConfig, options))
    );
    run.results.push(...batchResults);
    
    // Update run progress
    await kvPut(env, runKey(runId), run);
  }
  
  // Calculate summary
  run.summary.passed = run.results.filter(r => r.passed).length;
  run.summary.failed = run.results.filter(r => !r.passed).length;
  run.summary.avgScore = Math.round(run.results.reduce((sum, r) => sum + r.score, 0) / run.results.length);
  run.summary.avgExecutionTime = Math.round(run.results.reduce((sum, r) => sum + r.executionTime, 0) / run.results.length);
  run.summary.totalCost = run.results.reduce((sum, r) => sum + (r.metadata.cost || 0), 0);
  
  run.status = "completed";
  run.finishedAt = nowIso();
  
  await kvPut(env, runKey(runId), run);
  
  await audit(env, {
    userId: options.userId || 0,
    action: "eval.run",
    resource: runId,
    result: "success",
    meta: {
      datasetId,
      passed: run.summary.passed,
      failed: run.summary.failed,
      avgScore: run.summary.avgScore
    }
  });
  
  return run;
}

/**
 * Get evaluation run
 */
export async function getEvalRun(env, runId) {
  return await kvGet(env, runKey(runId), null);
}

/**
 * List evaluation runs
 */
export async function listEvalRuns(env, filters = {}) {
  const ids = await kvGet(env, EVAL_RUN_INDEX, []);
  const runs = await readMany(env, ids.map(runKey));
  
  let filtered = runs;
  
  if (filters.datasetId) {
    filtered = filtered.filter(r => r.datasetId === filters.datasetId);
  }
  
  if (filters.status) {
    filtered = filtered.filter(r => r.status === filters.status);
  }
  
  return filtered.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

/**
 * Compare evaluation runs
 */
export async function compareEvalRuns(env, runIds) {
  const runs = await Promise.all(runIds.map(id => getEvalRun(env, id)));
  
  if (runs.some(r => !r)) throw new Error("One or more runs not found");
  
  // Build comparison
  const comparison = {
    runs: runs.map(r => ({
      id: r.id,
      datasetName: r.datasetName,
      target: r.targetConfig,
      summary: r.summary,
      timestamp: r.startedAt
    })),
    delta: {
      scoreChange: runs.length >= 2 ? runs[runs.length - 1].summary.avgScore - runs[0].summary.avgScore : null,
      costChange: runs.length >= 2 ? runs[runs.length - 1].summary.totalCost - runs[0].summary.totalCost : null,
      latencyChange: runs.length >= 2 ? runs[runs.length - 1].summary.avgExecutionTime - runs[0].summary.avgExecutionTime : null
    },
    caseComparison: []
  };
  
  // Compare individual cases
  if (runs.length >= 2 && runs[0].results.length === runs[1].results.length) {
    for (let i = 0; i < runs[0].results.length; i++) {
      const baseline = runs[0].results[i];
      const current = runs[runs.length - 1].results[i];
      
      comparison.caseComparison.push({
        caseId: baseline.caseId,
        question: baseline.question,
        baselineScore: baseline.score,
        currentScore: current.score,
        scoreDelta: current.score - baseline.score,
        regression: current.score < baseline.score
      });
    }
  }
  
  return comparison;
}

/**
 * Auto-run evaluations when changes detected (regression testing)
 */
export async function autoRunRegression(env, triggerType, triggerData, options = {}) {
  // Find relevant datasets based on trigger
  const datasets = await listEvalDatasets(env);
  const relevant = datasets.filter(d => {
    if (triggerType === "model" && d.category === "model") return true;
    if (triggerType === "prompt" && d.category === "prompt") return true;
    if (triggerType === "agent" && d.category === "agent") return true;
    if (triggerType === "router" && d.category === "router") return true;
    return false;
  });
  
  const results = [];
  
  for (const dataset of relevant) {
    const targetConfig = {
      type: triggerType,
      ...triggerData
    };
    
    const run = await runEvaluation(env, dataset.id, targetConfig, options);
    results.push({
      datasetId: dataset.id,
      datasetName: dataset.name,
      runId: run.id,
      passed: run.summary.passed,
      failed: run.summary.failed,
      avgScore: run.summary.avgScore
    });
  }
  
  return {
    trigger: { type: triggerType, data: triggerData },
    datasetsEvaluated: results.length,
    results
  };
}
