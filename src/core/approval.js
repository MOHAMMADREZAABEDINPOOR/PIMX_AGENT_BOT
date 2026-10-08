// ─────────────────────────────────────────────
// 🧑‍⚖️ Human-in-the-Loop Approval System
// Permission framework for sensitive operations
// ─────────────────────────────────────────────

import { kvGet, kvPut, kvDel, newId, nowIso } from "./kv.js";
import { audit } from "./audit.js";

// Risk levels for operations
export const RISK_LEVELS = {
  SAFE: "safe",           // No approval needed
  LOW: "low",             // Auto-approve for trusted users
  MEDIUM: "medium",       // Requires confirmation
  HIGH: "high",           // Requires explicit approval + reason
  CRITICAL: "critical"    // Requires multi-step approval + admin consent
};

// Operation categories
export const OPERATION_TYPES = {
  // Infrastructure
  PROVIDER_DELETE: { risk: "high", category: "infrastructure", description: "Delete AI provider" },
  PROVIDER_MODIFY_KEYS: { risk: "medium", category: "infrastructure", description: "Modify API keys" },
  MODEL_DELETE: { risk: "medium", category: "infrastructure", description: "Delete model" },
  ROUTER_CONFIG: { risk: "medium", category: "infrastructure", description: "Modify routing configuration" },
  
  // Data
  DATA_DELETE: { risk: "high", category: "data", description: "Delete data" },
  DATA_EXPORT: { risk: "medium", category: "data", description: "Export data" },
  PROJECT_DELETE: { risk: "high", category: "data", description: "Delete project" },
  MEMORY_DELETE: { risk: "medium", category: "data", description: "Delete memory entries" },
  CACHE_CLEAR: { risk: "low", category: "data", description: "Clear cache" },
  
  // Workflows
  WORKFLOW_CREATE: { risk: "low", category: "workflow", description: "Create workflow" },
  WORKFLOW_MODIFY: { risk: "medium", category: "workflow", description: "Modify workflow" },
  WORKFLOW_DELETE: { risk: "medium", category: "workflow", description: "Delete workflow" },
  WORKFLOW_RUN: { risk: "low", category: "workflow", description: "Run workflow" },
  
  // AI Operations
  COUNCIL_RUN: { risk: "medium", category: "ai", description: "Run AI Council", checkCost: true },
  AGENT_RUN: { risk: "low", category: "ai", description: "Run agent", checkCost: true },
  AGENT_TOOL_DANGEROUS: { risk: "high", category: "ai", description: "Execute high-risk tool" },
  
  // Security
  SECRET_VIEW: { risk: "critical", category: "security", description: "View secret value" },
  PERMISSION_GRANT: { risk: "high", category: "security", description: "Grant permissions" },
  USER_DELETE: { risk: "critical", category: "security", description: "Delete user" },
  
  // Tools
  TOOL_HTTP_REQUEST: { risk: "medium", category: "tool", description: "Execute HTTP request" },
  TOOL_DATABASE_QUERY: { risk: "high", category: "tool", description: "Execute database query" },
  TOOL_FILE_WRITE: { risk: "high", category: "tool", description: "Write file" },
  TOOL_FILE_DELETE: { risk: "high", category: "tool", description: "Delete file" },
  TOOL_COMMAND_EXEC: { risk: "critical", category: "tool", description: "Execute system command" }
};

// Approval request structure
export function createApprovalRequest(operation) {
  const { type, user, details, context, estimatedCost, metadata } = operation;
  const opDef = OPERATION_TYPES[type];
  
  if (!opDef) {
    throw new Error(`Unknown operation type: ${type}`);
  }
  
  return {
    id: newId("approval"),
    type,
    category: opDef.category,
    risk: opDef.risk,
    description: opDef.description,
    userId: user?.id || 0,
    userName: user?.name || "Unknown",
    details: details || {},
    context: context || {},
    estimatedCost: estimatedCost || 0,
    metadata: metadata || {},
    status: "pending",
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour expiry
    approvals: [],
    rejections: [],
    decision: null,
    decisionAt: null,
    decisionBy: null,
    decisionReason: null
  };
}

// Check if operation requires approval
export function requiresApproval(operationType, context = {}) {
  const opDef = OPERATION_TYPES[operationType];
  if (!opDef) return false;
  
  const { risk } = opDef;
  const { userRole, estimatedCost, costBudget, autoApprove } = context;
  
  // Safe operations never need approval
  if (risk === RISK_LEVELS.SAFE) return false;
  
  // Auto-approve if explicitly enabled
  if (autoApprove === true) return false;
  
  // Low risk: auto-approve for admins
  if (risk === RISK_LEVELS.LOW && userRole === "admin") return false;
  
  // Medium risk: auto-approve for admins with low cost
  if (risk === RISK_LEVELS.MEDIUM && userRole === "admin" && estimatedCost < (costBudget || 0.1)) {
    return false;
  }
  
  // Cost-based approval
  if (opDef.checkCost && estimatedCost > (costBudget || 0.5)) {
    return true;
  }
  
  // High and critical operations always require approval
  if (risk === RISK_LEVELS.HIGH || risk === RISK_LEVELS.CRITICAL) {
    return true;
  }
  
  return false;
}

// Store approval request
export async function storeApprovalRequest(env, request) {
  const key = `approval:${request.id}`;
  await kvPut(env, key, request);
  
  // Add to pending queue
  const queue = await getApprovalQueue(env);
  queue.pending.push(request.id);
  await kvPut(env, "approval:queue", queue);
  
  await audit(env, {
    userId: request.userId,
    action: "approval.request",
    resource: request.id,
    meta: {
      type: request.type,
      risk: request.risk,
      estimatedCost: request.estimatedCost
    }
  });
  
  return request;
}

// Get approval request
export async function getApprovalRequest(env, requestId) {
  const key = `approval:${requestId}`;
  const request = await kvGet(env, key, null);
  
  if (!request) return null;
  
  // Check expiry
  const now = Date.now();
  const expiresAt = new Date(request.expiresAt).getTime();
  
  if (expiresAt < now && request.status === "pending") {
    request.status = "expired";
    request.decision = "expired";
    request.decisionAt = nowIso();
    await kvPut(env, key, request);
  }
  
  return request;
}

// Get approval queue
export async function getApprovalQueue(env) {
  const queue = await kvGet(env, "approval:queue", {
    pending: [],
    approved: [],
    rejected: [],
    expired: []
  });
  
  return queue;
}

// List pending approvals
export async function listPendingApprovals(env, options = {}) {
  const { category, risk, userId, limit = 50 } = options;
  const queue = await getApprovalQueue(env);
  
  let requestIds = queue.pending.slice(-limit);
  
  const requests = [];
  for (const id of requestIds) {
    const request = await getApprovalRequest(env, id);
    if (!request) continue;
    
    // Filter by criteria
    if (category && request.category !== category) continue;
    if (risk && request.risk !== risk) continue;
    if (userId && request.userId !== userId) continue;
    if (request.status !== "pending") continue;
    
    requests.push(request);
  }
  
  return requests.reverse(); // Most recent first
}

// Approve request
export async function approveRequest(env, requestId, approverId, reason = "") {
  const request = await getApprovalRequest(env, requestId);
  
  if (!request) {
    throw new Error("Approval request not found");
  }
  
  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}`);
  }
  
  // Add approval
  request.approvals.push({
    userId: approverId,
    reason: reason || "",
    timestamp: nowIso()
  });
  
  // Check if enough approvals (critical operations need 2)
  const requiredApprovals = request.risk === RISK_LEVELS.CRITICAL ? 2 : 1;
  
  if (request.approvals.length >= requiredApprovals) {
    request.status = "approved";
    request.decision = "approved";
    request.decisionAt = nowIso();
    request.decisionBy = approverId;
    request.decisionReason = reason;
    
    // Move to approved queue
    const queue = await getApprovalQueue(env);
    queue.pending = queue.pending.filter(id => id !== requestId);
    queue.approved.push(requestId);
    await kvPut(env, "approval:queue", queue);
  }
  
  await kvPut(env, `approval:${requestId}`, request);
  
  await audit(env, {
    userId: approverId,
    action: "approval.approve",
    resource: requestId,
    meta: {
      type: request.type,
      status: request.status,
      approvalsCount: request.approvals.length
    }
  });
  
  return request;
}

// Reject request
export async function rejectRequest(env, requestId, rejecterId, reason = "") {
  const request = await getApprovalRequest(env, requestId);
  
  if (!request) {
    throw new Error("Approval request not found");
  }
  
  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}`);
  }
  
  // Add rejection
  request.rejections.push({
    userId: rejecterId,
    reason: reason || "Rejected",
    timestamp: nowIso()
  });
  
  request.status = "rejected";
  request.decision = "rejected";
  request.decisionAt = nowIso();
  request.decisionBy = rejecterId;
  request.decisionReason = reason;
  
  // Move to rejected queue
  const queue = await getApprovalQueue(env);
  queue.pending = queue.pending.filter(id => id !== requestId);
  queue.rejected.push(requestId);
  await kvPut(env, "approval:queue", queue);
  
  await kvPut(env, `approval:${requestId}`, request);
  
  await audit(env, {
    userId: rejecterId,
    action: "approval.reject",
    resource: requestId,
    meta: {
      type: request.type,
      reason
    }
  });
  
  return request;
}

// Cancel request
export async function cancelRequest(env, requestId, userId) {
  const request = await getApprovalRequest(env, requestId);
  
  if (!request) {
    throw new Error("Approval request not found");
  }
  
  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}`);
  }
  
  // Only requester can cancel
  if (request.userId !== userId) {
    throw new Error("Only the requester can cancel this request");
  }
  
  request.status = "cancelled";
  request.decision = "cancelled";
  request.decisionAt = nowIso();
  request.decisionBy = userId;
  
  // Remove from queue
  const queue = await getApprovalQueue(env);
  queue.pending = queue.pending.filter(id => id !== requestId);
  await kvPut(env, "approval:queue", queue);
  
  await kvPut(env, `approval:${requestId}`, request);
  
  await audit(env, {
    userId,
    action: "approval.cancel",
    resource: requestId,
    meta: { type: request.type }
  });
  
  return request;
}

// Cleanup expired requests
export async function cleanupExpiredRequests(env) {
  const queue = await getApprovalQueue(env);
  const now = Date.now();
  let cleaned = 0;
  
  const stillPending = [];
  for (const id of queue.pending) {
    const request = await getApprovalRequest(env, id);
    if (!request) continue;
    
    if (request.status === "expired") {
      queue.expired.push(id);
      cleaned++;
    } else {
      stillPending.push(id);
    }
  }
  
  queue.pending = stillPending;
  await kvPut(env, "approval:queue", queue);
  
  return { cleaned };
}

// Get approval stats
export async function getApprovalStats(env) {
  const queue = await getApprovalQueue(env);
  
  const stats = {
    pending: queue.pending.length,
    approved: queue.approved.length,
    rejected: queue.rejected.length,
    expired: queue.expired.length,
    total: queue.pending.length + queue.approved.length + queue.rejected.length + queue.expired.length,
    byRisk: {
      safe: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    byCategory: {}
  };
  
  // Analyze pending requests
  for (const id of queue.pending.slice(-100)) {
    const request = await getApprovalRequest(env, id);
    if (!request) continue;
    
    stats.byRisk[request.risk] = (stats.byRisk[request.risk] || 0) + 1;
    stats.byCategory[request.category] = (stats.byCategory[request.category] || 0) + 1;
  }
  
  return stats;
}

// Permission checker for operations
export async function checkPermission(env, operation) {
  const { type, user, context } = operation;
  
  // Check if approval required
  const needsApproval = requiresApproval(type, {
    userRole: user?.role || "user",
    estimatedCost: context?.estimatedCost || 0,
    costBudget: user?.costBudget || 0.5,
    autoApprove: context?.autoApprove || false
  });
  
  if (!needsApproval) {
    return {
      allowed: true,
      requiresApproval: false,
      reason: "Operation approved automatically"
    };
  }
  
  // Create approval request
  const request = createApprovalRequest(operation);
  await storeApprovalRequest(env, request);
  
  return {
    allowed: false,
    requiresApproval: true,
    approvalRequestId: request.id,
    reason: "Operation requires approval",
    request
  };
}

// Wait for approval (for async operations)
export async function waitForApproval(env, requestId, timeoutMs = 300000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const request = await getApprovalRequest(env, requestId);
    
    if (!request) {
      throw new Error("Approval request not found");
    }
    
    if (request.status === "approved") {
      return { approved: true, request };
    }
    
    if (request.status === "rejected") {
      return { approved: false, request, reason: request.decisionReason };
    }
    
    if (request.status === "expired" || request.status === "cancelled") {
      return { approved: false, request, reason: request.status };
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Timeout
  return { approved: false, request: null, reason: "timeout" };
}
