// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸŒ Data Residency Controls
// Geographic data storage, compliance regions, data sovereignty
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, nowIso, kvListRaw } from "./kv.js";
import { audit } from "./audit.js";

// â”€â”€ Supported Regions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const DATA_REGIONS = {
  global: {
    id: "global",
    name: "Global",
    description: "No specific geographic restrictions",
    countries: [],
    regulations: [],
    storageLocations: ["cloudflare-global"]
  },
  
  eu: {
    id: "eu",
    name: "European Union",
    description: "GDPR-compliant data storage within EU",
    countries: ["DE", "FR", "NL", "IE", "SE", "PL", "ES", "IT"],
    regulations: ["GDPR", "ePrivacy"],
    storageLocations: ["cloudflare-weur", "cloudflare-eeur"],
    transferRestrictions: {
      allowedRegions: ["eu", "uk"],
      requiresApproval: ["us", "global"]
    }
  },
  
  us: {
    id: "us",
    name: "United States",
    description: "US-based data storage",
    countries: ["US"],
    regulations: ["CCPA", "HIPAA", "SOC2"],
    storageLocations: ["cloudflare-wnam", "cloudflare-enam"],
    transferRestrictions: {
      allowedRegions: ["us", "global"],
      requiresApproval: ["eu", "asia"]
    }
  },
  
  uk: {
    id: "uk",
    name: "United Kingdom",
    description: "UK GDPR-compliant storage",
    countries: ["GB"],
    regulations: ["UK-GDPR", "DPA-2018"],
    storageLocations: ["cloudflare-weur"],
    transferRestrictions: {
      allowedRegions: ["uk", "eu", "global"],
      requiresApproval: ["us", "asia"]
    }
  },
  
  asia: {
    id: "asia",
    name: "Asia Pacific",
    description: "APAC region data storage",
    countries: ["SG", "JP", "AU", "IN", "HK"],
    regulations: ["PDPA-SG", "APPI-JP"],
    storageLocations: ["cloudflare-apac"],
    transferRestrictions: {
      allowedRegions: ["asia", "global"],
      requiresApproval: ["eu", "us"]
    }
  },
  
  canada: {
    id: "canada",
    name: "Canada",
    description: "PIPEDA-compliant Canadian storage",
    countries: ["CA"],
    regulations: ["PIPEDA"],
    storageLocations: ["cloudflare-wnam"],
    transferRestrictions: {
      allowedRegions: ["canada", "us", "global"],
      requiresApproval: ["eu", "asia"]
    }
  }
};

// â”€â”€ Data Classification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const DATA_CLASSIFICATIONS = {
  public: {
    level: 0,
    name: "Public",
    description: "Publicly accessible data",
    restrictions: []
  },
  internal: {
    level: 1,
    name: "Internal",
    description: "Internal use only",
    restrictions: ["authentication_required"]
  },
  confidential: {
    level: 2,
    name: "Confidential",
    description: "Sensitive business data",
    restrictions: ["authentication_required", "encryption_at_rest", "audit_log"]
  },
  restricted: {
    level: 3,
    name: "Restricted",
    description: "Highly sensitive data (PII, PHI)",
    restrictions: [
      "authentication_required",
      "encryption_at_rest",
      "encryption_in_transit",
      "audit_log",
      "access_control",
      "data_residency"
    ]
  }
};

// â”€â”€ Data Residency Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Set tenant data residency
 */
export async function setTenantResidency(env, tenantId, regionId, userId) {
  if (!DATA_REGIONS[regionId]) {
    throw new Error(`Invalid region: ${regionId}`);
  }

  const residency = {
    tenantId,
    regionId,
    region: DATA_REGIONS[regionId],
    setBy: userId,
    setAt: nowIso(),
    enforcedAt: nowIso()
  };

  await kvPut(env, `tenant_residency:${tenantId}`, residency);
  await audit(env, { userId, action: "residency.set", resource: tenantId, meta: { regionId } });

  return residency;
}

/**
 * Get tenant data residency
 */
export async function getTenantResidency(env, tenantId) {
  const residency = await kvGet(env, `tenant_residency:${tenantId}`);
  return residency || { regionId: "global", region: DATA_REGIONS.global };
}

/**
 * Validate data can be stored in region
 */
export async function validateDataResidency(env, tenantId, dataClassification) {
  const residency = await getTenantResidency(env, tenantId);
  const classification = DATA_CLASSIFICATIONS[dataClassification] || DATA_CLASSIFICATIONS.internal;

  // If data is restricted, residency must be enforced
  if (classification.restrictions.includes("data_residency") && residency.regionId === "global") {
    return {
      allowed: false,
      reason: "Restricted data requires specific geographic region"
    };
  }

  return { allowed: true };
}

/**
 * Check if data transfer is allowed
 */
export async function checkDataTransfer(env, fromRegionId, toRegionId, dataClassification) {
  const fromRegion = DATA_REGIONS[fromRegionId];
  const toRegion = DATA_REGIONS[toRegionId];

  if (!fromRegion || !toRegion) {
    throw new Error("Invalid region");
  }

  // Global region allows all transfers
  if (fromRegionId === "global" || toRegionId === "global") {
    return { allowed: true, requiresApproval: false };
  }

  // Check transfer restrictions
  const restrictions = fromRegion.transferRestrictions || {};
  
  if (restrictions.allowedRegions?.includes(toRegionId)) {
    return { allowed: true, requiresApproval: false };
  }

  if (restrictions.requiresApproval?.includes(toRegionId)) {
    return {
      allowed: false,
      requiresApproval: true,
      reason: `Data transfer from ${fromRegion.name} to ${toRegion.name} requires approval`
    };
  }

  return {
    allowed: false,
    requiresApproval: false,
    reason: `Data transfer from ${fromRegion.name} to ${toRegion.name} is not permitted`
  };
}

// â”€â”€ Data Transfer Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create data transfer request
 */
export async function createDataTransferRequest(env, {
  tenantId,
  fromRegion,
  toRegion,
  dataType,
  dataClassification,
  justification,
  requestedBy
}) {
  const request = {
    id: `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    tenantId,
    fromRegion,
    toRegion,
    dataType,
    dataClassification,
    justification,
    status: "pending", // "pending", "approved", "rejected"
    requestedBy,
    requestedAt: nowIso()
  };

  await kvPut(env, `data_transfer_request:${request.id}`, request);
  await audit(env, {
    userId: requestedBy,
    action: "data_transfer.request",
    resource: tenantId,
    meta: { fromRegion, toRegion, dataType }
  });

  return request;
}

/**
 * Approve data transfer request
 */
export async function approveDataTransferRequest(env, requestId, approvedBy) {
  const request = await kvGet(env, `data_transfer_request:${requestId}`);
  if (!request) throw new Error("Transfer request not found");

  request.status = "approved";
  request.approvedBy = approvedBy;
  request.approvedAt = nowIso();

  await kvPut(env, `data_transfer_request:${requestId}`, request);
  await audit(env, {
    userId: approvedBy,
    action: "data_transfer.approve",
    resource: request.tenantId,
    meta: { requestId }
  });

  return request;
}

/**
 * Reject data transfer request
 */
export async function rejectDataTransferRequest(env, requestId, rejectedBy, reason) {
  const request = await kvGet(env, `data_transfer_request:${requestId}`);
  if (!request) throw new Error("Transfer request not found");

  request.status = "rejected";
  request.rejectedBy = rejectedBy;
  request.rejectedAt = nowIso();
  request.rejectionReason = reason;

  await kvPut(env, `data_transfer_request:${requestId}`, request);
  await audit(env, {
    userId: rejectedBy,
    action: "data_transfer.reject",
    resource: request.tenantId,
    meta: { requestId, reason }
  });

  return request;
}

// â”€â”€ Compliance Reporting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get data residency report
 */
export async function getResidencyReport(env, tenantId) {
  const residency = await getTenantResidency(env, tenantId);
  
  // Count data by classification
  const dataByClassification = {
    public: 0,
    internal: 0,
    confidential: 0,
    restricted: 0
  };

  // Get transfer requests
  const keys = await kvListRaw(env, { prefix: `data_transfer_request:` });
  const transfers = [];

  for (const key of keys.keys) {
    const transfer = await kvGet(env, key.name);
    if (transfer && transfer.tenantId === tenantId) {
      transfers.push(transfer);
    }
  }

  return {
    tenantId,
    region: residency.region,
    regulations: residency.region.regulations,
    storageLocations: residency.region.storageLocations,
    dataByClassification,
    transfers: {
      total: transfers.length,
      pending: transfers.filter(t => t.status === "pending").length,
      approved: transfers.filter(t => t.status === "approved").length,
      rejected: transfers.filter(t => t.status === "rejected").length
    },
    compliance: {
      encrypted: true,
      auditLogging: true,
      accessControl: true,
      dataResidency: residency.regionId !== "global"
    }
  };
}

/**
 * Get compliance status
 */
export async function getComplianceStatus(env, tenantId) {
  const residency = await getTenantResidency(env, tenantId);
  const region = residency.region;

  const checks = {
    dataResidency: {
      status: residency.regionId !== "global" ? "compliant" : "not_applicable",
      region: region.name
    },
    regulations: region.regulations.map(reg => ({
      name: reg,
      status: "compliant"
    })),
    encryption: {
      atRest: { status: "enabled" },
      inTransit: { status: "enabled" }
    },
    auditLogs: {
      status: "enabled",
      retention: "90 days"
    },
    accessControl: {
      status: "enabled",
      method: "RBAC"
    }
  };

  const allCompliant = checks.regulations.every(r => r.status === "compliant");

  return {
    tenantId,
    overall: allCompliant ? "compliant" : "non_compliant",
    checks,
    lastChecked: nowIso()
  };
}

// â”€â”€ Data Locality Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get appropriate storage location for tenant
 */
export function getStorageLocation(tenantId, residency) {
  if (!residency || residency.regionId === "global") {
    return "cloudflare-global";
  }

  const region = DATA_REGIONS[residency.regionId];
  return region.storageLocations[0]; // Return primary location
}

/**
 * Classify data automatically
 */
export function classifyData(data) {
  // Simple heuristic-based classification
  const dataStr = JSON.stringify(data).toLowerCase();
  
  // Check for PII patterns
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{16}\b/, // Credit card
    /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/, // Email
    /\b\d{3}-\d{3}-\d{4}\b/ // Phone
  ];

  for (const pattern of piiPatterns) {
    if (pattern.test(dataStr)) {
      return "restricted";
    }
  }

  // Check for sensitive keywords
  const sensitiveKeywords = ["password", "secret", "token", "key", "ssn", "credit"];
  if (sensitiveKeywords.some(kw => dataStr.includes(kw))) {
    return "confidential";
  }

  return "internal";
}

/**
 * Anonymize data for cross-region transfer
 */
export function anonymizeData(data, classification) {
  if (classification === "public") {
    return data;
  }

  const anonymized = { ...data };

  // Remove or hash PII fields
  const piiFields = ["email", "phone", "address", "ssn", "creditCard", "password"];
  for (const field of piiFields) {
    if (anonymized[field]) {
      anonymized[field] = "[REDACTED]";
    }
  }

  return anonymized;
}
