// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸš¦ Smart Rate Limiting â€” Token Bucket, User Tiers
// Adaptive rate limiting with burst support
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, kvListRaw } from "../core/kv.js";

// â”€â”€ User Tiers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const USER_TIERS = {
  FREE: {
    name: "free",
    rateLimit: {
      requests: 100,
      period: 3600, // 1 hour in seconds
      burst: 10
    },
    quotas: {
      dailyRequests: 500,
      monthlyTokens: 100000,
      maxConcurrent: 2
    }
  },
  BASIC: {
    name: "basic",
    rateLimit: {
      requests: 500,
      period: 3600,
      burst: 50
    },
    quotas: {
      dailyRequests: 5000,
      monthlyTokens: 1000000,
      maxConcurrent: 5
    }
  },
  PRO: {
    name: "pro",
    rateLimit: {
      requests: 2000,
      period: 3600,
      burst: 200
    },
    quotas: {
      dailyRequests: 50000,
      monthlyTokens: 10000000,
      maxConcurrent: 20
    }
  },
  ENTERPRISE: {
    name: "enterprise",
    rateLimit: {
      requests: 10000,
      period: 3600,
      burst: 1000
    },
    quotas: {
      dailyRequests: 1000000,
      monthlyTokens: 100000000,
      maxConcurrent: 100
    }
  },
  UNLIMITED: {
    name: "unlimited",
    rateLimit: {
      requests: Infinity,
      period: 1,
      burst: Infinity
    },
    quotas: {
      dailyRequests: Infinity,
      monthlyTokens: Infinity,
      maxConcurrent: Infinity
    }
  }
};

// â”€â”€ Token Bucket Algorithm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get or create token bucket for user
 */
async function getTokenBucket(env, userId, tier) {
  const key = `ratelimit:${userId}`;
  let bucket = await kvGet(env, key);

  const config = USER_TIERS[tier.toUpperCase()] || USER_TIERS.FREE;
  const now = Date.now();

  if (!bucket) {
    // Initialize new bucket
    bucket = {
      userId,
      tier: config.name,
      tokens: config.rateLimit.requests,
      capacity: config.rateLimit.requests,
      refillRate: config.rateLimit.requests / config.rateLimit.period, // tokens per second
      lastRefill: now,
      burst: config.rateLimit.burst
    };
  } else {
    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  return bucket;
}

/**
 * Save token bucket
 */
async function saveTokenBucket(env, bucket) {
  await kvPut(env, `ratelimit:${bucket.userId}`, bucket, { expirationTtl: 86400 });
}

/**
 * Check rate limit with token bucket
 */
export async function checkRateLimit(env, userId, { tier = "free", cost = 1 } = {}) {
  const bucket = await getTokenBucket(env, userId, tier);

  // Check if enough tokens available
  if (bucket.tokens >= cost) {
    // Allow request
    bucket.tokens -= cost;
    await saveTokenBucket(env, bucket);

    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetAt: bucket.lastRefill + (bucket.capacity / bucket.refillRate) * 1000,
      retryAfter: null
    };
  } else {
    // Rate limited
    const tokensNeeded = cost - bucket.tokens;
    const waitSeconds = tokensNeeded / bucket.refillRate;

    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.lastRefill + waitSeconds * 1000,
      retryAfter: Math.ceil(waitSeconds)
    };
  }
}

// â”€â”€ Quota Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get user quotas
 */
export async function getUserQuotas(env, userId, tier = "free") {
  const config = USER_TIERS[tier.toUpperCase()] || USER_TIERS.FREE;
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const month = now.toISOString().slice(0, 7); // YYYY-MM

  const dailyKey = `quota:daily:${userId}:${today}`;
  const monthlyKey = `quota:monthly:${userId}:${month}`;
  const concurrentKey = `quota:concurrent:${userId}`;

  const [daily, monthly, concurrent] = await Promise.all([
    kvGet(env, dailyKey),
    kvGet(env, monthlyKey),
    kvGet(env, concurrentKey)
  ]);

  return {
    daily: {
      used: daily?.requests || 0,
      limit: config.quotas.dailyRequests,
      remaining: config.quotas.dailyRequests - (daily?.requests || 0)
    },
    monthly: {
      used: monthly?.tokens || 0,
      limit: config.quotas.monthlyTokens,
      remaining: config.quotas.monthlyTokens - (monthly?.tokens || 0)
    },
    concurrent: {
      active: concurrent?.active || 0,
      limit: config.quotas.maxConcurrent,
      remaining: config.quotas.maxConcurrent - (concurrent?.active || 0)
    }
  };
}

/**
 * Increment quota usage
 */
export async function incrementQuota(env, userId, { requests = 1, tokens = 0 } = {}) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const month = now.toISOString().slice(0, 7);

  // Daily quota
  const dailyKey = `quota:daily:${userId}:${today}`;
  const daily = await kvGet(env, dailyKey) || { userId, date: today, requests: 0, tokens: 0 };
  daily.requests += requests;
  daily.tokens += tokens;
  await kvPut(env, dailyKey, daily, { expirationTtl: 86400 * 2 });

  // Monthly quota
  const monthlyKey = `quota:monthly:${userId}:${month}`;
  const monthly = await kvGet(env, monthlyKey) || { userId, month, requests: 0, tokens: 0 };
  monthly.requests += requests;
  monthly.tokens += tokens;
  await kvPut(env, monthlyKey, monthly, { expirationTtl: 86400 * 32 });

  return { daily, monthly };
}

/**
 * Check quota limits
 */
export async function checkQuotas(env, userId, tier = "free", { tokens = 0 } = {}) {
  const quotas = await getUserQuotas(env, userId, tier);

  const violations = [];

  if (quotas.daily.remaining < 1) {
    violations.push({
      type: "daily_requests",
      limit: quotas.daily.limit,
      used: quotas.daily.used
    });
  }

  if (quotas.monthly.remaining < tokens) {
    violations.push({
      type: "monthly_tokens",
      limit: quotas.monthly.limit,
      used: quotas.monthly.used
    });
  }

  if (quotas.concurrent.remaining < 1) {
    violations.push({
      type: "concurrent_requests",
      limit: quotas.concurrent.limit,
      active: quotas.concurrent.active
    });
  }

  return {
    allowed: violations.length === 0,
    violations
  };
}

// â”€â”€ Concurrent Request Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Acquire concurrent slot
 */
export async function acquireConcurrentSlot(env, userId, tier = "free") {
  const config = USER_TIERS[tier.toUpperCase()] || USER_TIERS.FREE;
  const key = `quota:concurrent:${userId}`;
  const concurrent = await kvGet(env, key) || { userId, active: 0, slots: [] };

  if (concurrent.active >= config.quotas.maxConcurrent) {
    return { acquired: false, limit: config.quotas.maxConcurrent };
  }

  const slotId = newId("slot");
  concurrent.active += 1;
  concurrent.slots.push({ id: slotId, acquiredAt: Date.now() });
  await kvPut(env, key, concurrent, { expirationTtl: 3600 });

  return { acquired: true, slotId };
}

/**
 * Release concurrent slot
 */
export async function releaseConcurrentSlot(env, userId, slotId) {
  const key = `quota:concurrent:${userId}`;
  const concurrent = await kvGet(env, key);
  if (!concurrent) return;

  concurrent.active = Math.max(0, concurrent.active - 1);
  concurrent.slots = concurrent.slots.filter(s => s.id !== slotId);
  await kvPut(env, key, concurrent, { expirationTtl: 3600 });
}

// â”€â”€ Adaptive Rate Limiting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Calculate adaptive rate limit based on system load
 */
export async function getAdaptiveRateLimit(env, userId, tier = "free") {
  const config = USER_TIERS[tier.toUpperCase()] || USER_TIERS.FREE;
  
  // Get system load metrics
  const loadKey = "system:load";
  const load = await kvGet(env, loadKey) || { cpu: 0, memory: 0, requests: 0 };

  // Calculate load factor (0-1, where 1 is max load)
  const loadFactor = Math.max(load.cpu, load.memory, load.requests / 10000);

  // Reduce rate limit under high load
  let adjustedRequests = config.rateLimit.requests;
  if (loadFactor > 0.8) {
    adjustedRequests = Math.floor(config.rateLimit.requests * 0.5); // 50% reduction
  } else if (loadFactor > 0.6) {
    adjustedRequests = Math.floor(config.rateLimit.requests * 0.75); // 25% reduction
  }

  return {
    ...config.rateLimit,
    requests: adjustedRequests,
    adaptive: true,
    loadFactor: loadFactor.toFixed(2)
  };
}

/**
 * Update system load metrics
 */
export async function updateSystemLoad(env, metrics) {
  const loadKey = "system:load";
  await kvPut(env, loadKey, metrics, { expirationTtl: 60 });
}

// â”€â”€ IP-based Rate Limiting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Check IP rate limit (for public endpoints)
 */
export async function checkIpRateLimit(env, ip, { requests = 100, period = 60 } = {}) {
  const key = `ratelimit:ip:${ip}`;
  const now = Date.now();
  const windowStart = now - (period * 1000);

  let ipData = await kvGet(env, key) || { ip, requests: [], firstRequest: now };
  
  // Remove old requests outside the window
  ipData.requests = ipData.requests.filter(timestamp => timestamp > windowStart);

  // Check if limit exceeded
  if (ipData.requests.length >= requests) {
    const oldestRequest = Math.min(...ipData.requests);
    const resetAt = oldestRequest + (period * 1000);
    const retryAfter = Math.ceil((resetAt - now) / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter
    };
  }

  // Add current request
  ipData.requests.push(now);
  await kvPut(env, key, ipData, { expirationTtl: period * 2 });

  return {
    allowed: true,
    remaining: requests - ipData.requests.length,
    resetAt: windowStart + (period * 1000),
    retryAfter: null
  };
}

// â”€â”€ Rate Limit Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get rate limit statistics
 */
export async function getRateLimitStats(env, { hours = 24 } = {}) {
  const keys = await kvListRaw(env, { prefix: "ratelimit:", limit: 10000 });
  const stats = {
    totalUsers: 0,
    byTier: {},
    violations: 0,
    avgTokens: 0
  };

  let totalTokens = 0;

  for (const key of keys.keys) {
    if (key.name.startsWith("ratelimit:ip:")) continue;
    
    const bucket = await kvGet(env, key.name);
    if (!bucket) continue;

    stats.totalUsers += 1;
    stats.byTier[bucket.tier] = (stats.byTier[bucket.tier] || 0) + 1;
    
    if (bucket.tokens <= 0) {
      stats.violations += 1;
    }

    totalTokens += bucket.tokens;
  }

  stats.avgTokens = stats.totalUsers > 0 ? totalTokens / stats.totalUsers : 0;

  return stats;
}

/**
 * Get user tier
 */
export async function getUserTier(env, userId) {
  const key = `user:${userId}:tier`;
  const tier = await kvGet(env, key);
  return tier || "free";
}

/**
 * Set user tier
 */
export async function setUserTier(env, userId, tier) {
  if (!USER_TIERS[tier.toUpperCase()]) {
    throw new Error(`Invalid tier: ${tier}`);
  }
  
  const key = `user:${userId}:tier`;
  await kvPut(env, key, tier.toLowerCase());
  
  // Reset rate limit bucket to apply new limits
  await kvPut(env, `ratelimit:${userId}`, null);
  
  return tier.toLowerCase();
}
