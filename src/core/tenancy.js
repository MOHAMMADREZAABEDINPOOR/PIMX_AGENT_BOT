// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ¢ Multi-Tenancy â€” Full isolation per organization
// Tenant management, resource isolation, cross-tenant operations
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, indexAdd, indexRemove, kvListRaw } from "./kv.js";
import { audit } from "./audit.js";

// â”€â”€ Tenant Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create new tenant (organization)
 */
export async function createTenant(env, { name, slug, ownerId, settings = {}, metadata = {} }) {
  // Check slug uniqueness
  const existing = await getTenantBySlug(env, slug);
  if (existing) throw new Error(`Tenant slug "${slug}" already exists`);

  const tenant = {
    id: newId("tenant"),
    name,
    slug,
    ownerId,
    status: "active", // "active", "suspended", "trial"
    plan: "free", // "free", "starter", "business", "enterprise"
    settings: {
      isolationLevel: "strict", // "strict", "shared"
      dataResidency: "global", // "global", "eu", "us", "asia"
      allowCrossTeamSharing: false,
      ...settings
    },
    quotas: {
      maxUsers: 10,
      maxProjects: 5,
      maxModels: 50,
      maxProviders: 10,
      storageGB: 10
    },
    usage: {
      users: 0,
      projects: 0,
      models: 0,
      providers: 0,
      storageGB: 0
    },
    metadata,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await kvPut(env, `tenant:${tenant.id}`, tenant);
  await kvPut(env, `tenant_by_slug:${slug}`, tenant.id);
  await indexAdd(env, `tenants`, tenant.id);
  await audit(env, { userId: ownerId, action: "tenant.create", resource: tenant.id, meta: { name, slug } });

  return tenant;
}

/**
 * Get tenant by ID
 */
export async function getTenant(env, tenantId) {
  return await kvGet(env, `tenant:${tenantId}`);
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(env, slug) {
  const tenantId = await kvGet(env, `tenant_by_slug:${slug}`);
  if (!tenantId) return null;
  return await getTenant(env, tenantId);
}

/**
 * List all tenants
 */
export async function listTenants(env, { status = null, plan = null, limit = 100 } = {}) {
  const keys = await kvListRaw(env, { prefix: "tenant:", limit: 1000 });
  const tenants = [];

  for (const key of keys.keys) {
    const tenant = await kvGet(env, key.name);
    if (!tenant) continue;
    if (status && tenant.status !== status) continue;
    if (plan && tenant.plan !== plan) continue;
    tenants.push(tenant);
  }

  return tenants
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

/**
 * Update tenant
 */
export async function updateTenant(env, tenantId, updates, userId) {
  const tenant = await getTenant(env, tenantId);
  if (!tenant) throw new Error("Tenant not found");

  const allowed = ["name", "status", "plan", "settings", "quotas", "metadata"];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (typeof updates[key] === "object" && !Array.isArray(updates[key])) {
        tenant[key] = { ...tenant[key], ...updates[key] };
      } else {
        tenant[key] = updates[key];
      }
    }
  }

  tenant.updatedAt = nowIso();
  await kvPut(env, `tenant:${tenantId}`, tenant);
  await audit(env, { userId, action: "tenant.update", resource: tenantId, meta: updates });

  return tenant;
}

/**
 * Delete tenant (with cascade)
 */
export async function deleteTenant(env, tenantId, userId) {
  const tenant = await getTenant(env, tenantId);
  if (!tenant) return false;

  // Delete tenant resources
  await deleteTenantResources(env, tenantId);

  // Delete tenant
  await kvPut(env, `tenant_by_slug:${tenant.slug}`, null);
  await kvPut(env, `tenant:${tenantId}`, null);
  await indexRemove(env, `tenants`, tenantId);
  await audit(env, { userId, action: "tenant.delete", resource: tenantId });

  return true;
}

/**
 * Delete all tenant resources
 */
async function deleteTenantResources(env, tenantId) {
  // Delete members
  const members = await listTenantMembers(env, tenantId);
  for (const member of members) {
    await removeTenantMember(env, tenantId, member.userId);
  }

  // Delete tenant-scoped data
  const prefixes = [
    `tenant_data:${tenantId}:`,
    `tenant_member:${tenantId}:`,
    `tenant_invite:${tenantId}:`
  ];

  for (const prefix of prefixes) {
    const keys = await kvListRaw(env, { prefix });
    for (const key of keys.keys) {
      await kvPut(env, key.name, null);
    }
  }
}

// â”€â”€ Tenant Members â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Add member to tenant
 */
export async function addTenantMember(env, { tenantId, userId, role = "member", invitedBy }) {
  const tenant = await getTenant(env, tenantId);
  if (!tenant) throw new Error("Tenant not found");

  // Check quota
  if (tenant.usage.users >= tenant.quotas.maxUsers) {
    throw new Error("Tenant user quota exceeded");
  }

  const member = {
    tenantId,
    userId,
    role, // "owner", "admin", "member", "viewer"
    status: "active",
    invitedBy,
    joinedAt: nowIso()
  };

  await kvPut(env, `tenant_member:${tenantId}:${userId}`, member);
  await indexAdd(env, `user_tenants:${userId}`, tenantId);

  // Update usage
  tenant.usage.users += 1;
  await kvPut(env, `tenant:${tenantId}`, tenant);

  await audit(env, { userId: invitedBy, action: "tenant.member.add", resource: tenantId, meta: { userId, role } });

  return member;
}

/**
 * Remove member from tenant
 */
export async function removeTenantMember(env, tenantId, userId, removedBy = null) {
  const member = await kvGet(env, `tenant_member:${tenantId}:${userId}`);
  if (!member) return false;

  await kvPut(env, `tenant_member:${tenantId}:${userId}`, null);
  await indexRemove(env, `user_tenants:${userId}`, tenantId);

  // Update usage
  const tenant = await getTenant(env, tenantId);
  if (tenant) {
    tenant.usage.users = Math.max(0, tenant.usage.users - 1);
    await kvPut(env, `tenant:${tenantId}`, tenant);
  }

  if (removedBy) {
    await audit(env, { userId: removedBy, action: "tenant.member.remove", resource: tenantId, meta: { userId } });
  }

  return true;
}

/**
 * List tenant members
 */
export async function listTenantMembers(env, tenantId, { role = null } = {}) {
  const keys = await kvListRaw(env, { prefix: `tenant_member:${tenantId}:` });
  const members = [];

  for (const key of keys.keys) {
    const member = await kvGet(env, key.name);
    if (!member) continue;
    if (role && member.role !== role) continue;
    members.push(member);
  }

  return members.sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));
}

/**
 * Get user's tenants
 */
export async function getUserTenants(env, userId) {
  const keys = await kvListRaw(env, { prefix: `user_tenants:${userId}:` });
  const tenants = [];

  for (const key of keys.keys) {
    const tenantId = key.name.split(":").pop();
    const tenant = await getTenant(env, tenantId);
    if (tenant) {
      const member = await kvGet(env, `tenant_member:${tenantId}:${userId}`);
      tenants.push({ ...tenant, memberRole: member?.role });
    }
  }

  return tenants;
}

/**
 * Check if user is member of tenant
 */
export async function isTenantMember(env, tenantId, userId) {
  const member = await kvGet(env, `tenant_member:${tenantId}:${userId}`);
  return !!member;
}

/**
 * Get user's role in tenant
 */
export async function getTenantMemberRole(env, tenantId, userId) {
  const member = await kvGet(env, `tenant_member:${tenantId}:${userId}`);
  return member?.role || null;
}

/**
 * Update member role
 */
export async function updateMemberRole(env, tenantId, userId, newRole, updatedBy) {
  const member = await kvGet(env, `tenant_member:${tenantId}:${userId}`);
  if (!member) throw new Error("Member not found");

  member.role = newRole;
  member.updatedAt = nowIso();
  await kvPut(env, `tenant_member:${tenantId}:${userId}`, member);
  await audit(env, { userId: updatedBy, action: "tenant.member.role_update", resource: tenantId, meta: { userId, newRole } });

  return member;
}

// â”€â”€ Tenant Invitations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create tenant invitation
 */
export async function createTenantInvite(env, { tenantId, email, role = "member", invitedBy }) {
  const invite = {
    id: newId("invite"),
    tenantId,
    email,
    role,
    status: "pending", // "pending", "accepted", "expired"
    invitedBy,
    token: newId("token"),
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 days
    createdAt: nowIso()
  };

  await kvPut(env, `tenant_invite:${tenantId}:${invite.id}`, invite);
  await kvPut(env, `invite_token:${invite.token}`, invite.id);
  await audit(env, { userId: invitedBy, action: "tenant.invite.create", resource: tenantId, meta: { email, role } });

  return invite;
}

/**
 * Accept tenant invitation
 */
export async function acceptTenantInvite(env, token, userId) {
  const inviteId = await kvGet(env, `invite_token:${token}`);
  if (!inviteId) throw new Error("Invalid invitation token");

  const keys = await kvListRaw(env, { prefix: "tenant_invite:" });
  let invite = null;
  for (const key of keys.keys) {
    const i = await kvGet(env, key.name);
    if (i && i.id === inviteId) {
      invite = i;
      break;
    }
  }

  if (!invite) throw new Error("Invitation not found");
  if (invite.status !== "pending") throw new Error("Invitation already used");
  if (new Date(invite.expiresAt) < new Date()) throw new Error("Invitation expired");

  // Add user to tenant
  await addTenantMember(env, {
    tenantId: invite.tenantId,
    userId,
    role: invite.role,
    invitedBy: invite.invitedBy
  });

  // Mark invite as accepted
  invite.status = "accepted";
  invite.acceptedBy = userId;
  invite.acceptedAt = nowIso();
  await kvPut(env, `tenant_invite:${invite.tenantId}:${invite.id}`, invite);

  return invite;
}

// â”€â”€ Resource Isolation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Scope resource to tenant
 */
export function scopeResourceKey(tenantId, resourceType, resourceId) {
  return `tenant_data:${tenantId}:${resourceType}:${resourceId}`;
}

/**
 * Get tenant-scoped resource
 */
export async function getTenantResource(env, tenantId, resourceType, resourceId) {
  const key = scopeResourceKey(tenantId, resourceType, resourceId);
  return await kvGet(env, key);
}

/**
 * Set tenant-scoped resource
 */
export async function setTenantResource(env, tenantId, resourceType, resourceId, data) {
  const key = scopeResourceKey(tenantId, resourceType, resourceId);
  await kvPut(env, key, data);
}

/**
 * List tenant-scoped resources
 */
export async function listTenantResources(env, tenantId, resourceType) {
  const prefix = `tenant_data:${tenantId}:${resourceType}:`;
  const keys = await kvListRaw(env, { prefix });
  const resources = [];

  for (const key of keys.keys) {
    const resource = await kvGet(env, key.name);
    if (resource) resources.push(resource);
  }

  return resources;
}

/**
 * Check tenant access to resource
 */
export async function checkTenantAccess(env, tenantId, userId, permission = "read") {
  const member = await kvGet(env, `tenant_member:${tenantId}:${userId}`);
  if (!member) return false;

  const rolePermissions = {
    owner: ["read", "write", "delete", "admin"],
    admin: ["read", "write", "delete"],
    member: ["read", "write"],
    viewer: ["read"]
  };

  return rolePermissions[member.role]?.includes(permission) || false;
}

// â”€â”€ Tenant Statistics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get tenant statistics
 */
export async function getTenantStats(env, tenantId) {
  const tenant = await getTenant(env, tenantId);
  if (!tenant) throw new Error("Tenant not found");

  const members = await listTenantMembers(env, tenantId);

  return {
    tenantId,
    name: tenant.name,
    status: tenant.status,
    plan: tenant.plan,
    usage: tenant.usage,
    quotas: tenant.quotas,
    utilization: {
      users: (tenant.usage.users / tenant.quotas.maxUsers) * 100,
      projects: (tenant.usage.projects / tenant.quotas.maxProjects) * 100,
      models: (tenant.usage.models / tenant.quotas.maxModels) * 100,
      storage: (tenant.usage.storageGB / tenant.quotas.storageGB) * 100
    },
    members: {
      total: members.length,
      byRole: {
        owner: members.filter(m => m.role === "owner").length,
        admin: members.filter(m => m.role === "admin").length,
        member: members.filter(m => m.role === "member").length,
        viewer: members.filter(m => m.role === "viewer").length
      }
    },
    createdAt: tenant.createdAt
  };
}

// â”€â”€ Tenant Plans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const TENANT_PLANS = {
  free: {
    name: "Free",
    maxUsers: 10,
    maxProjects: 5,
    maxModels: 50,
    maxProviders: 10,
    storageGB: 10,
    features: ["basic_support"]
  },
  starter: {
    name: "Starter",
    maxUsers: 25,
    maxProjects: 20,
    maxModels: 200,
    maxProviders: 50,
    storageGB: 50,
    features: ["basic_support", "sso", "audit_logs"]
  },
  business: {
    name: "Business",
    maxUsers: 100,
    maxProjects: 100,
    maxModels: 1000,
    maxProviders: 200,
    storageGB: 500,
    features: ["priority_support", "sso", "audit_logs", "data_residency", "rbac"]
  },
  enterprise: {
    name: "Enterprise",
    maxUsers: Infinity,
    maxProjects: Infinity,
    maxModels: Infinity,
    maxProviders: Infinity,
    storageGB: Infinity,
    features: ["dedicated_support", "sso", "audit_logs", "data_residency", "rbac", "custom_contracts"]
  }
};
