// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ” Role-Based Access Control (RBAC)
// Permissions, roles, policies, resource-level access
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, kvListRaw } from "./kv.js";
import { audit } from "./audit.js";

// â”€â”€ Permissions & Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const PERMISSIONS = {
  // Provider permissions
  "provider:read": "View providers",
  "provider:create": "Create providers",
  "provider:update": "Update providers",
  "provider:delete": "Delete providers",
  "provider:test": "Test provider connections",
  
  // Model permissions
  "model:read": "View models",
  "model:create": "Create models",
  "model:update": "Update models",
  "model:delete": "Delete models",
  "model:test": "Test models",
  "model:use": "Use models for inference",
  
  // Agent permissions
  "agent:read": "View agents",
  "agent:create": "Create agents",
  "agent:update": "Update agents",
  "agent:delete": "Delete agents",
  "agent:run": "Run agents",
  
  // Project permissions
  "project:read": "View projects",
  "project:create": "Create projects",
  "project:update": "Update projects",
  "project:delete": "Delete projects",
  
  // Workflow permissions
  "workflow:read": "View workflows",
  "workflow:create": "Create workflows",
  "workflow:update": "Update workflows",
  "workflow:delete": "Delete workflows",
  "workflow:run": "Run workflows",
  
  // Admin permissions
  "admin:users": "Manage users",
  "admin:tenants": "Manage tenants",
  "admin:billing": "View billing",
  "admin:audit": "View audit logs",
  "admin:settings": "Manage global settings",
  
  // Cost permissions
  "cost:read": "View costs",
  "cost:budget": "Manage budgets",
  
  // Observability permissions
  "observability:read": "View metrics and logs",
  "observability:traces": "View traces"
};

// â”€â”€ Roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const BUILTIN_ROLES = {
  viewer: {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to resources",
    permissions: [
      "provider:read",
      "model:read",
      "agent:read",
      "project:read",
      "workflow:read",
      "cost:read",
      "observability:read"
    ],
    builtin: true
  },
  
  member: {
    id: "member",
    name: "Member",
    description: "Standard user with read/write access",
    permissions: [
      "provider:read",
      "model:read", "model:use",
      "agent:read", "agent:create", "agent:update", "agent:run",
      "project:read", "project:create", "project:update",
      "workflow:read", "workflow:create", "workflow:update", "workflow:run",
      "cost:read"
    ],
    builtin: true
  },
  
  developer: {
    id: "developer",
    name: "Developer",
    description: "Full development access including model/provider management",
    permissions: [
      "provider:read", "provider:create", "provider:update", "provider:test",
      "model:read", "model:create", "model:update", "model:test", "model:use",
      "agent:read", "agent:create", "agent:update", "agent:delete", "agent:run",
      "project:read", "project:create", "project:update", "project:delete",
      "workflow:read", "workflow:create", "workflow:update", "workflow:delete", "workflow:run",
      "cost:read", "cost:budget",
      "observability:read", "observability:traces"
    ],
    builtin: true
  },
  
  admin: {
    id: "admin",
    name: "Admin",
    description: "Full administrative access",
    permissions: [
      "provider:read", "provider:create", "provider:update", "provider:delete", "provider:test",
      "model:read", "model:create", "model:update", "model:delete", "model:test", "model:use",
      "agent:read", "agent:create", "agent:update", "agent:delete", "agent:run",
      "project:read", "project:create", "project:update", "project:delete",
      "workflow:read", "workflow:create", "workflow:update", "workflow:delete", "workflow:run",
      "admin:users", "admin:billing", "admin:audit", "admin:settings",
      "cost:read", "cost:budget",
      "observability:read", "observability:traces"
    ],
    builtin: true
  },
  
  owner: {
    id: "owner",
    name: "Owner",
    description: "Full access including tenant management",
    permissions: Object.keys(PERMISSIONS),
    builtin: true
  }
};

// â”€â”€ Role Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create custom role
 */
export async function createRole(env, { tenantId, name, description, permissions, createdBy }) {
  const role = {
    id: newId("role"),
    tenantId,
    name,
    description,
    permissions,
    builtin: false,
    createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await kvPut(env, `role:${tenantId}:${role.id}`, role);
  await audit(env, { userId: createdBy, action: "role.create", resource: role.id, meta: { name, tenantId } });

  return role;
}

/**
 * Get role
 */
export async function getRole(env, tenantId, roleId) {
  // Check builtin roles first
  if (BUILTIN_ROLES[roleId]) {
    return BUILTIN_ROLES[roleId];
  }
  
  return await kvGet(env, `role:${tenantId}:${roleId}`);
}

/**
 * List roles for tenant
 */
export async function listRoles(env, tenantId) {
  const keys = await kvListRaw(env, { prefix: `role:${tenantId}:` });
  const customRoles = [];

  for (const key of keys.keys) {
    const role = await kvGet(env, key.name);
    if (role) customRoles.push(role);
  }

  // Combine builtin and custom roles
  return [
    ...Object.values(BUILTIN_ROLES),
    ...customRoles
  ];
}

/**
 * Update role
 */
export async function updateRole(env, tenantId, roleId, updates, updatedBy) {
  const role = await getRole(env, tenantId, roleId);
  if (!role) throw new Error("Role not found");
  if (role.builtin) throw new Error("Cannot modify builtin roles");

  const allowed = ["name", "description", "permissions"];
  for (const key of allowed) {
    if (updates[key] !== undefined) role[key] = updates[key];
  }

  role.updatedAt = nowIso();
  await kvPut(env, `role:${tenantId}:${roleId}`, role);
  await audit(env, { userId: updatedBy, action: "role.update", resource: roleId, meta: updates });

  return role;
}

/**
 * Delete role
 */
export async function deleteRole(env, tenantId, roleId, deletedBy) {
  const role = await getRole(env, tenantId, roleId);
  if (!role) return false;
  if (role.builtin) throw new Error("Cannot delete builtin roles");

  await kvPut(env, `role:${tenantId}:${roleId}`, null);
  await audit(env, { userId: deletedBy, action: "role.delete", resource: roleId });

  return true;
}

// â”€â”€ User Role Assignment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Assign role to user
 */
export async function assignRole(env, { tenantId, userId, roleId, assignedBy }) {
  const role = await getRole(env, tenantId, roleId);
  if (!role) throw new Error("Role not found");

  const assignment = {
    tenantId,
    userId,
    roleId,
    assignedBy,
    assignedAt: nowIso()
  };

  await kvPut(env, `user_role:${tenantId}:${userId}`, assignment);
  await audit(env, { userId: assignedBy, action: "role.assign", resource: roleId, meta: { userId, tenantId } });

  return assignment;
}

/**
 * Get user's role
 */
export async function getUserRole(env, tenantId, userId) {
  const assignment = await kvGet(env, `user_role:${tenantId}:${userId}`);
  if (!assignment) return null;

  const role = await getRole(env, tenantId, assignment.roleId);
  return role;
}

/**
 * Get user's permissions
 */
export async function getUserPermissions(env, tenantId, userId) {
  const role = await getUserRole(env, tenantId, userId);
  return role?.permissions || [];
}

/**
 * Check if user has permission
 */
export async function hasPermission(env, tenantId, userId, permission) {
  const permissions = await getUserPermissions(env, tenantId, userId);
  return permissions.includes(permission);
}

/**
 * Check multiple permissions (requires all)
 */
export async function hasAllPermissions(env, tenantId, userId, requiredPermissions) {
  const permissions = await getUserPermissions(env, tenantId, userId);
  return requiredPermissions.every(p => permissions.includes(p));
}

/**
 * Check multiple permissions (requires any)
 */
export async function hasAnyPermission(env, tenantId, userId, requiredPermissions) {
  const permissions = await getUserPermissions(env, tenantId, userId);
  return requiredPermissions.some(p => permissions.includes(p));
}

// â”€â”€ Resource-Level Permissions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Grant resource permission
 */
export async function grantResourcePermission(env, {
  tenantId,
  resourceType,
  resourceId,
  userId,
  permission,
  grantedBy
}) {
  const grant = {
    id: newId("grant"),
    tenantId,
    resourceType,
    resourceId,
    userId,
    permission,
    grantedBy,
    grantedAt: nowIso()
  };

  const key = `resource_permission:${tenantId}:${resourceType}:${resourceId}:${userId}:${permission}`;
  await kvPut(env, key, grant);
  await audit(env, { userId: grantedBy, action: "permission.grant", resource: resourceId, meta: { userId, permission } });

  return grant;
}

/**
 * Revoke resource permission
 */
export async function revokeResourcePermission(env, {
  tenantId,
  resourceType,
  resourceId,
  userId,
  permission,
  revokedBy
}) {
  const key = `resource_permission:${tenantId}:${resourceType}:${resourceId}:${userId}:${permission}`;
  await kvPut(env, key, null);
  await audit(env, { userId: revokedBy, action: "permission.revoke", resource: resourceId, meta: { userId, permission } });

  return true;
}

/**
 * Check resource permission
 */
export async function hasResourcePermission(env, tenantId, resourceType, resourceId, userId, permission) {
  // First check role-based permissions
  const hasRolePermission = await hasPermission(env, tenantId, userId, `${resourceType}:${permission}`);
  if (hasRolePermission) return true;

  // Then check resource-level permissions
  const key = `resource_permission:${tenantId}:${resourceType}:${resourceId}:${userId}:${permission}`;
  const grant = await kvGet(env, key);
  return !!grant;
}

/**
 * List resource permissions
 */
export async function listResourcePermissions(env, tenantId, resourceType, resourceId) {
  const prefix = `resource_permission:${tenantId}:${resourceType}:${resourceId}:`;
  const keys = await kvListRaw(env, { prefix });
  const permissions = [];

  for (const key of keys.keys) {
    const grant = await kvGet(env, key.name);
    if (grant) permissions.push(grant);
  }

  return permissions;
}

// â”€â”€ Permission Policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create permission policy
 */
export async function createPolicy(env, {
  tenantId,
  name,
  description,
  effect = "allow", // "allow" or "deny"
  actions,
  resources,
  conditions = {},
  createdBy
}) {
  const policy = {
    id: newId("policy"),
    tenantId,
    name,
    description,
    effect,
    actions,
    resources,
    conditions,
    enabled: true,
    createdBy,
    createdAt: nowIso()
  };

  await kvPut(env, `policy:${tenantId}:${policy.id}`, policy);
  await audit(env, { userId: createdBy, action: "policy.create", resource: policy.id, meta: { name } });

  return policy;
}

/**
 * Evaluate policy
 */
export async function evaluatePolicy(env, policy, context) {
  if (!policy.enabled) return null;

  // Check if action matches
  const actionMatch = policy.actions.includes("*") || policy.actions.includes(context.action);
  if (!actionMatch) return null;

  // Check if resource matches
  const resourceMatch = policy.resources.includes("*") || policy.resources.some(r => {
    if (r.endsWith("/*")) {
      const prefix = r.slice(0, -2);
      return context.resource.startsWith(prefix);
    }
    return r === context.resource;
  });
  if (!resourceMatch) return null;

  // Evaluate conditions
  if (policy.conditions.ipWhitelist && !policy.conditions.ipWhitelist.includes(context.ip)) {
    return null;
  }

  if (policy.conditions.timeRestriction) {
    const now = new Date();
    const hour = now.getHours();
    const { startHour, endHour } = policy.conditions.timeRestriction;
    if (hour < startHour || hour >= endHour) return null;
  }

  return policy.effect;
}

/**
 * Check access with policies
 */
export async function checkAccessWithPolicies(env, tenantId, userId, action, resource, context = {}) {
  // Get all policies for tenant
  const keys = await kvListRaw(env, { prefix: `policy:${tenantId}:` });
  const policies = [];

  for (const key of keys.keys) {
    const policy = await kvGet(env, key.name);
    if (policy && policy.enabled) policies.push(policy);
  }

  // Evaluate policies
  const fullContext = { action, resource, userId, ...context };
  let hasExplicitDeny = false;
  let hasExplicitAllow = false;

  for (const policy of policies) {
    const effect = await evaluatePolicy(env, policy, fullContext);
    if (effect === "deny") hasExplicitDeny = true;
    if (effect === "allow") hasExplicitAllow = true;
  }

  // Deny takes precedence
  if (hasExplicitDeny) return false;
  if (hasExplicitAllow) return true;

  // Default: check role-based permissions
  return await hasPermission(env, tenantId, userId, action);
}

// â”€â”€ Access Control Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Require permission middleware helper
 */
export function requirePermission(permission) {
  return async (env, tenantId, userId) => {
    const allowed = await hasPermission(env, tenantId, userId, permission);
    if (!allowed) {
      throw new Error(`Permission denied: ${permission}`);
    }
    return true;
  };
}

/**
 * Require any permission middleware helper
 */
export function requireAnyPermission(permissions) {
  return async (env, tenantId, userId) => {
    const allowed = await hasAnyPermission(env, tenantId, userId, permissions);
    if (!allowed) {
      throw new Error(`Permission denied: requires one of ${permissions.join(", ")}`);
    }
    return true;
  };
}

/**
 * Require resource permission
 */
export async function requireResourcePermission(env, tenantId, resourceType, resourceId, userId, permission) {
  const allowed = await hasResourcePermission(env, tenantId, resourceType, resourceId, userId, permission);
  if (!allowed) {
    throw new Error(`Permission denied: ${resourceType}:${permission} on ${resourceId}`);
  }
  return true;
}
