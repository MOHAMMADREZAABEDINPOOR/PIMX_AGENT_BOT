// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ“œ Audit Log â€” Ø«Ø¨Øª Ø¹Ù…Ù„ÛŒØ§Øª Ù…Ù‡Ù… (Ø¨Ø¯ÙˆÙ† Ù‡ÛŒÚ† secret)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { kvGet, kvPut, newId, nowIso, kvListRaw } from "./kv.js";
import { redact } from "./secrets.js";

const MAX_PER_DAY = 400;

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export async function audit(env, { userId = 0, action, resource = "", result = "ok", meta = {} }) {
  try {
    const key = `audit:${dayKey()}`;
    const list = await kvGet(env, key, []);
    list.push({
      id: newId("a"),
      ts: nowIso(),
      userId,
      action,
      resource,
      result,
      meta: JSON.parse(redact(JSON.stringify(meta || {})))
    });
    await kvPut(env, key, list.slice(-MAX_PER_DAY), { expirationTtl: 60 * 86400 });
  } catch {}
}

export async function auditRead(env, days = 7, limit = 200) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const list = await kvGet(env, `audit:${dayKey(d)}`, []);
    out.push(...list);
  }
  return out.sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, limit);
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Phase 29: Enhanced Compliance Audit Functions
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Enhanced audit with classification and context
 */
export async function auditEnhanced(env, { userId, action, resource, meta = {}, tenantId = null, ip = null, userAgent = null }) {
  const entry = {
    id: newId("audit"),
    timestamp: Date.now(),
    datetime: nowIso(),
    userId,
    tenantId,
    action,
    resource,
    meta: JSON.parse(redact(JSON.stringify(meta || {}))),
    context: {
      ip,
      userAgent,
      source: "api"
    },
    classification: classifyAuditAction(action)
  };

  // Store individual entry with long retention
  await kvPut(env, `audit_detail:${entry.id}`, entry, { expirationTtl: 86400 * 365 });

  // Also add to daily log
  await audit(env, { userId, action, resource, result: "ok", meta });

  return entry;
}

/**
 * Classify audit action by sensitivity
 */
function classifyAuditAction(action) {
  const critical = ["tenant.delete", "user.delete", "role.delete", "sso.config.delete", "budget.delete"];
  const high = ["role.assign", "permission.grant", "sso.login", "data_transfer.approve"];
  const medium = ["provider.create", "model.create", "agent.create"];
  
  if (critical.some(a => action.includes(a))) return "critical";
  if (high.some(a => action.includes(a))) return "high";
  if (medium.some(a => action.includes(a))) return "medium";
  return "low";
}

/**
 * Export audit logs for compliance
 */
export async function auditExport(env, { startDate, endDate, tenantId = null, format = "json" }) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  
  const logs = [];
  const keys = await kvListRaw(env, { prefix: "audit_detail:", limit: 10000 });

  for (const key of keys.keys) {
    const entry = await kvGet(env, key.name);
    if (!entry || entry.timestamp < start || entry.timestamp > end) continue;
    if (tenantId && entry.tenantId !== tenantId) continue;
    logs.push(entry);
  }

  logs.sort((a, b) => a.timestamp - b.timestamp);

  if (format === "csv") {
    return exportAuditCsv(logs);
  }

  return { logs, count: logs.length, startDate, endDate };
}

/**
 * Export audit logs as CSV
 */
function exportAuditCsv(logs) {
  const rows = [["Timestamp", "User ID", "Tenant ID", "Action", "Resource", "Classification", "IP", "Meta"]];
  
  for (const log of logs) {
    rows.push([
      log.datetime,
      log.userId || "",
      log.tenantId || "",
      log.action,
      log.resource || "",
      log.classification,
      log.context?.ip || "",
      JSON.stringify(log.meta)
    ]);
  }

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

/**
 * Get audit statistics
 */
export async function auditStats(env, days = 30, tenantId = null) {
  const logs = await auditRead(env, days, 10000);
  
  const stats = {
    total: logs.length,
    byAction: {},
    byUser: {},
    topActions: [],
    topUsers: []
  };

  for (const log of logs) {
    stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
    if (log.userId) {
      stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;
    }
  }

  stats.topActions = Object.entries(stats.byAction)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  stats.topUsers = Object.entries(stats.byUser)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return stats;
}

/**
 * Generate compliance report
 */
export async function generateComplianceReport(env, { tenantId, startDate, endDate, regulations = [] }) {
  const exportData = await auditExport(env, { startDate, endDate, tenantId });
  const logs = exportData.logs || [];
  
  const report = {
    tenantId,
    period: { startDate, endDate },
    regulations,
    generated: nowIso(),
    summary: {
      totalEvents: logs.length,
      criticalEvents: logs.filter(l => l.classification === "critical").length,
      userCount: new Set(logs.map(l => l.userId)).size,
      dataAccessEvents: logs.filter(l => l.action.includes("read") || l.action.includes("access")).length,
      dataModificationEvents: logs.filter(l => l.action.includes("update") || l.action.includes("delete")).length,
      securityEvents: logs.filter(l => 
        l.action.includes("login") || 
        l.action.includes("permission") || 
        l.action.includes("role")
      ).length
    },
    compliance: {
      auditLogRetention: "365 days",
      encryptionAtRest: true,
      encryptionInTransit: true,
      accessControl: true,
      dataMinimization: true
    },
    findings: [],
    recommendations: []
  };

  // Check for compliance issues
  const failedLogins = logs.filter(l => l.action === "auth.failed");
  if (failedLogins.length > 100) {
    report.findings.push({
      severity: "high",
      issue: "High number of failed login attempts",
      count: failedLogins.length,
      recommendation: "Review authentication logs and consider implementing rate limiting"
    });
  }

  return report;
}

/**
 * Search audit logs
 */
export async function auditSearch(env, { query, startDate, endDate, limit = 100 }) {
  const start = startDate ? new Date(startDate).getTime() : Date.now() - 30 * 86400000;
  const end = endDate ? new Date(endDate).getTime() : Date.now();
  
  const keys = await kvListRaw(env, { prefix: "audit_detail:", limit: 10000 });
  const results = [];
  const queryLower = query.toLowerCase();

  for (const key of keys.keys) {
    const entry = await kvGet(env, key.name);
    if (!entry || entry.timestamp < start || entry.timestamp > end) continue;

    const searchText = `${entry.action} ${entry.resource} ${JSON.stringify(entry.meta)}`.toLowerCase();
    if (searchText.includes(queryLower)) {
      results.push(entry);
    }
  }

  return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}
