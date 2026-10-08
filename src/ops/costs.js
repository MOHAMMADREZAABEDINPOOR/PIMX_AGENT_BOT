// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ’° Cost Governance â€” Budgets, Tracking, Alerts
// Per-user, per-project, per-model cost management
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, indexAdd, indexRemove, kvListRaw } from "../core/kv.js";
import { audit } from "../core/audit.js";

// â”€â”€ Budget Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create cost budget
 */
export async function createBudget(env, { name, scope, scopeId, limit, period = "monthly", alertThresholds = [75, 90, 100], userId }) {
  const budget = {
    id: newId("budget"),
    name,
    scope, // "user", "project", "global"
    scopeId,
    limit, // Max cost in USD
    period, // "daily", "weekly", "monthly", "yearly"
    alertThresholds, // % thresholds for alerts
    enabled: true,
    currentSpend: 0,
    lastReset: nowIso(),
    createdBy: userId,
    createdAt: nowIso()
  };

  await kvPut(env, `budget:${budget.id}`, budget);
  await indexAdd(env, `budgets_by_scope:${scope}:${scopeId}`, budget.id);
  await audit(env, { userId, action: "budget.create", resource: budget.id, meta: { name, scope, limit } });

  return budget;
}

/**
 * Get budget
 */
export async function getBudget(env, budgetId) {
  return await kvGet(env, `budget:${budgetId}`);
}

/**
 * List budgets
 */
export async function listBudgets(env, { scope = null, scopeId = null } = {}) {
  const budgets = [];
  if (scope && scopeId !== null && scopeId !== undefined) {
    const ids = await kvGet(env, `budgets_by_scope:${scope}:${scopeId}`, []);
    for (const id of ids) {
      const budget = await kvGet(env, `budget:${id}`);
      if (budget) budgets.push(budget);
    }
  } else {
    const keys = await kvListRaw(env, { prefix: "budget:" });
    for (const key of keys.keys) {
      const budget = await kvGet(env, key.name);
      if (budget) budgets.push(budget);
    }
  }

  return budgets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Update budget
 */
export async function updateBudget(env, budgetId, updates, userId) {
  const budget = await getBudget(env, budgetId);
  if (!budget) throw new Error("Budget not found");

  const allowed = ["name", "limit", "period", "alertThresholds", "enabled"];
  for (const key of allowed) {
    if (updates[key] !== undefined) budget[key] = updates[key];
  }

  budget.updatedAt = nowIso();
  await kvPut(env, `budget:${budgetId}`, budget);
  await audit(env, { userId, action: "budget.update", resource: budgetId, meta: updates });

  return budget;
}

/**
 * Delete budget
 */
export async function deleteBudget(env, budgetId, userId) {
  const budget = await getBudget(env, budgetId);
  if (!budget) return false;

  await indexRemove(env, `budgets_by_scope:${budget.scope}:${budget.scopeId}`, budgetId);
  await kvPut(env, `budget:${budgetId}`, null);
  await audit(env, { userId, action: "budget.delete", resource: budgetId });

  return true;
}

/**
 * Reset budget (new period)
 */
export async function resetBudget(env, budgetId) {
  const budget = await getBudget(env, budgetId);
  if (!budget) throw new Error("Budget not found");

  budget.currentSpend = 0;
  budget.lastReset = nowIso();
  await kvPut(env, `budget:${budgetId}`, budget);

  return budget;
}

// â”€â”€ Cost Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Record cost transaction
 */
export async function recordCost(env, { userId, projectId = null, modelId, providerId, operation, cost, tokens = {}, metadata = {} }) {
  const transaction = {
    id: newId("cost"),
    userId,
    projectId,
    modelId,
    providerId,
    operation, // "completion", "embedding", "chat", etc.
    cost, // USD
    tokens: {
      prompt: tokens.prompt || 0,
      completion: tokens.completion || 0,
      total: tokens.total || 0
    },
    metadata,
    timestamp: Date.now(),
    createdAt: nowIso()
  };

  // Store transaction
  await kvPut(env, `cost:${transaction.id}`, transaction, { expirationTtl: 86400 * 90 }); // Keep 90 days

  // Update aggregations
  await updateCostAggregations(env, transaction);

  // Check budgets
  await checkBudgets(env, transaction);

  return transaction;
}

/**
 * Update cost aggregations
 */
async function updateCostAggregations(env, transaction) {
  const date = new Date(transaction.timestamp);
  const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

  // User daily aggregation
  const userDailyKey = `cost_agg:user:${transaction.userId}:${dateKey}`;
  const userDaily = await kvGet(env, userDailyKey) || { userId: transaction.userId, date: dateKey, cost: 0, tokens: 0, requests: 0 };
  userDaily.cost += transaction.cost;
  userDaily.tokens += transaction.tokens.total;
  userDaily.requests += 1;
  await kvPut(env, userDailyKey, userDaily, { expirationTtl: 86400 * 90 });

  // Project daily aggregation (if projectId exists)
  if (transaction.projectId) {
    const projectDailyKey = `cost_agg:project:${transaction.projectId}:${dateKey}`;
    const projectDaily = await kvGet(env, projectDailyKey) || { projectId: transaction.projectId, date: dateKey, cost: 0, tokens: 0, requests: 0 };
    projectDaily.cost += transaction.cost;
    projectDaily.tokens += transaction.tokens.total;
    projectDaily.requests += 1;
    await kvPut(env, projectDailyKey, projectDaily, { expirationTtl: 86400 * 90 });
  }

  // Model daily aggregation
  const modelDailyKey = `cost_agg:model:${transaction.modelId}:${dateKey}`;
  const modelDaily = await kvGet(env, modelDailyKey) || { modelId: transaction.modelId, date: dateKey, cost: 0, tokens: 0, requests: 0 };
  modelDaily.cost += transaction.cost;
  modelDaily.tokens += transaction.tokens.total;
  modelDaily.requests += 1;
  await kvPut(env, modelDailyKey, modelDaily, { expirationTtl: 86400 * 90 });

  // Provider daily aggregation
  const providerDailyKey = `cost_agg:provider:${transaction.providerId}:${dateKey}`;
  const providerDaily = await kvGet(env, providerDailyKey) || { providerId: transaction.providerId, date: dateKey, cost: 0, tokens: 0, requests: 0 };
  providerDaily.cost += transaction.cost;
  providerDaily.tokens += transaction.tokens.total;
  providerDaily.requests += 1;
  await kvPut(env, providerDailyKey, providerDaily, { expirationTtl: 86400 * 90 });

  // Global daily aggregation
  const globalDailyKey = `cost_agg:global:${dateKey}`;
  const globalDaily = await kvGet(env, globalDailyKey) || { date: dateKey, cost: 0, tokens: 0, requests: 0 };
  globalDaily.cost += transaction.cost;
  globalDaily.tokens += transaction.tokens.total;
  globalDaily.requests += 1;
  await kvPut(env, globalDailyKey, globalDaily, { expirationTtl: 86400 * 90 });
}

/**
 * Check budgets and send alerts
 */
async function checkBudgets(env, transaction) {
  // Check user budget
  const userBudgets = await listBudgets(env, { scope: "user", scopeId: transaction.userId });
  for (const budget of userBudgets) {
    if (!budget.enabled) continue;
    await checkBudgetThreshold(env, budget, transaction.cost);
  }

  // Check project budget
  if (transaction.projectId) {
    const projectBudgets = await listBudgets(env, { scope: "project", scopeId: transaction.projectId });
    for (const budget of projectBudgets) {
      if (!budget.enabled) continue;
      await checkBudgetThreshold(env, budget, transaction.cost);
    }
  }

  // Check global budget
  const globalBudgets = await listBudgets(env, { scope: "global", scopeId: "platform" });
  for (const budget of globalBudgets) {
    if (!budget.enabled) continue;
    await checkBudgetThreshold(env, budget, transaction.cost);
  }
}

/**
 * Check if budget threshold crossed
 */
async function checkBudgetThreshold(env, budget, additionalCost) {
  const newSpend = budget.currentSpend + additionalCost;
  const percentage = (newSpend / budget.limit) * 100;

  // Update current spend
  budget.currentSpend = newSpend;
  await kvPut(env, `budget:${budget.id}`, budget);

  // Check thresholds
  for (const threshold of budget.alertThresholds) {
    const previousPercentage = (budget.currentSpend - additionalCost) / budget.limit * 100;
    if (previousPercentage < threshold && percentage >= threshold) {
      // Threshold crossed - create alert
      await createCostAlert(env, {
        budgetId: budget.id,
        budgetName: budget.name,
        threshold,
        currentSpend: newSpend,
        limit: budget.limit,
        percentage: percentage.toFixed(2)
      });
    }
  }
}

/**
 * Create cost alert
 */
async function createCostAlert(env, alert) {
  const alertRecord = {
    id: newId("alert"),
    type: "budget_threshold",
    severity: alert.percentage >= 100 ? "critical" : alert.percentage >= 90 ? "high" : "medium",
    ...alert,
    createdAt: nowIso()
  };

  await kvPut(env, `cost_alert:${alertRecord.id}`, alertRecord);
  return alertRecord;
}

/**
 * Get cost alerts
 */
export async function getCostAlerts(env, { severity = null, limit = 50 } = {}) {
  const keys = await kvListRaw(env, { prefix: "cost_alert:", limit: 1000 });
  const alerts = [];

  for (const key of keys.keys) {
    const alert = await kvGet(env, key.name);
    if (!alert) continue;
    if (severity && alert.severity !== severity) continue;
    alerts.push(alert);
  }

  return alerts
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// â”€â”€ Cost Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get cost summary
 */
export async function getCostSummary(env, { scope, scopeId, startDate, endDate }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split("T")[0]);
  }

  const dailyCosts = [];
  let totalCost = 0;
  let totalTokens = 0;
  let totalRequests = 0;

  for (const day of days) {
    const key = `cost_agg:${scope}:${scopeId}:${day}`;
    const agg = await kvGet(env, key);
    if (agg) {
      dailyCosts.push({ date: day, ...agg });
      totalCost += agg.cost;
      totalTokens += agg.tokens;
      totalRequests += agg.requests;
    } else {
      dailyCosts.push({ date: day, cost: 0, tokens: 0, requests: 0 });
    }
  }

  return {
    scope,
    scopeId,
    startDate,
    endDate,
    totalCost,
    totalTokens,
    totalRequests,
    avgDailyCost: days.length > 0 ? totalCost / days.length : 0,
    dailyCosts
  };
}

/**
 * Get top spenders
 */
export async function getTopSpenders(env, { scope = "user", period = 7, limit = 10 } = {}) {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - period);

  const spenders = new Map();
  const keys = await kvListRaw(env, { prefix: `cost_agg:${scope}:`, limit: 10000 });

  for (const key of keys.keys) {
    const agg = await kvGet(env, key.name);
    if (!agg) continue;

    const aggDate = new Date(agg.date);
    if (aggDate < startDate || aggDate > endDate) continue;

    const id = scope === "user" ? agg.userId : scope === "project" ? agg.projectId : scope === "model" ? agg.modelId : agg.providerId;
    if (!spenders.has(id)) {
      spenders.set(id, { id, cost: 0, tokens: 0, requests: 0 });
    }

    const spender = spenders.get(id);
    spender.cost += agg.cost;
    spender.tokens += agg.tokens;
    spender.requests += agg.requests;
  }

  return Array.from(spenders.values())
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
}

/**
 * Get cost forecast
 */
export async function getCostForecast(env, { scope, scopeId, days = 30 } = {}) {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const summary = await getCostSummary(env, {
    scope,
    scopeId,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0]
  });

  const avgDailyCost = summary.avgDailyCost;
  const forecast = {
    dailyAverage: avgDailyCost,
    nextWeek: avgDailyCost * 7,
    nextMonth: avgDailyCost * 30,
    nextQuarter: avgDailyCost * 90,
    nextYear: avgDailyCost * 365
  };

  return forecast;
}

/**
 * Export costs to CSV
 */
export async function exportCosts(env, { scope, scopeId, startDate, endDate }) {
  const summary = await getCostSummary(env, { scope, scopeId, startDate, endDate });
  
  const rows = [["Date", "Cost", "Tokens", "Requests"]];
  for (const day of summary.dailyCosts) {
    rows.push([day.date, day.cost.toFixed(4), day.tokens, day.requests]);
  }

  return rows.map(row => row.join(",")).join("\n");
}
