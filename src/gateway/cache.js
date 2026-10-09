// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸŽ¯ Semantic & Response Cache
// Caching AI responses with validity checks
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import crypto from "crypto";
import { currentLanguage } from '../i18n/server.js';

const CACHE_TTL_DEFAULT = 3600; // 1 hour
const CACHE_TTL_SHORT = 600; // 10 minutes (for dynamic context)
const CACHE_TTL_LONG = 86400; // 24 hours (for stable prompts)

// Cache key generation with semantic awareness
export function generateCacheKey(request) {
  const {
    model,
    modelVersion,
    messages,
    systemPrompt,
    temperature,
    topP,
    maxTokens,
    json,
    tools,
    toolChoice,
    projectId,
    memoryContext,
    userId
  } = request;

  // Normalize messages to ignore minor formatting differences
  const normalizedMessages = normalizeMessages(messages);

  // Create cache key components
  const components = {
    language: currentLanguage(),
    model: model || "unknown",
    modelVersion: modelVersion || "default",
    messagesHash: hashContent(normalizedMessages),
    systemPrompt: hashContent(systemPrompt || ""),
    params: {
      temperature: temperature ?? 0.7,
      topP: topP ?? 0.95,
      maxTokens: maxTokens ?? 2048,
      json: !!json
    },
    tools: tools ? hashContent(JSON.stringify(tools.map(t => ({ name: t.name, description: t.description })))) : null,
    toolChoice: toolChoice || null,
    projectId: projectId || null,
    memoryHash: memoryContext ? hashContent(JSON.stringify(memoryContext)) : null,
    userId: userId || null
  };

  // Generate cache key
  const keyString = JSON.stringify(components);
  const cacheKey = `cache:${hashContent(keyString)}`;
  
  return { cacheKey, components };
}

// Normalize messages for semantic comparison
function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  
  return messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === "string" 
      ? msg.content.trim() 
      : normalizeContent(msg.content)
  }));
}

function normalizeContent(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === "string") return part.trim();
      if (part.type === "text") return { type: "text", text: part.text?.trim() };
      if (part.type === "image_url") return { type: "image_url", url: part.image_url?.url };
      return part;
    });
  }
  return content;
}

// Hash content for comparison
function hashContent(content) {
  const str = typeof content === "string" ? content : JSON.stringify(content);
  return crypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 16);
}

// Cache entry structure
export function createCacheEntry(request, response, metadata = {}) {
  const now = Date.now();
  const { cacheKey, components } = generateCacheKey(request);
  
  // Determine TTL based on context stability
  let ttl = CACHE_TTL_DEFAULT;
  if (components.memoryHash || components.projectId) {
    // Shorter TTL if memory/project context involved (context may change)
    ttl = CACHE_TTL_SHORT;
  } else if (!components.tools && components.params.temperature < 0.3) {
    // Longer TTL for deterministic, tool-free requests
    ttl = CACHE_TTL_LONG;
  }
  
  return {
    key: cacheKey,
    components,
    response: {
      text: response.text,
      toolCalls: response.toolCalls || [],
      promptTokens: response.promptTokens || 0,
      completionTokens: response.completionTokens || 0,
      latency: response.latency || 0
    },
    metadata: {
      ...metadata,
      model: response.model,
      providerId: response.providerId,
      providerName: response.providerName,
      cached: false
    },
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl * 1000).toISOString(),
    ttl,
    hits: 0,
    lastHit: null
  };
}

// Store cache entry in KV
export async function setCacheEntry(env, entry) {
  try {
    const { kvPut: put } = await import("../core/kv.js");
    await put(env, entry.key, entry, { expirationTtl: entry.ttl });
    return true;
  } catch (error) {
    console.error("[Cache] Failed to store cache entry:", error);
    return false;
  }
}

// Retrieve cache entry from KV
export async function getCacheEntry(env, cacheKey) {
  try {
    const { kvGet: get } = await import("../core/kv.js");
    const entry = await get(env, cacheKey);
    
    if (!entry) return null;
    
    // Check expiration
    const now = Date.now();
    const expiresAt = new Date(entry.expiresAt).getTime();
    if (expiresAt < now) {
      await deleteCacheEntry(env, cacheKey);
      return null;
    }
    
    // Update hit count
    entry.hits = (entry.hits || 0) + 1;
    entry.lastHit = new Date(now).toISOString();
    
    // Update in background (don't await)
    setCacheEntry(env, entry).catch(() => {});
    
    return entry;
  } catch (error) {
    console.error("[Cache] Failed to retrieve cache entry:", error);
    return null;
  }
}

// Delete cache entry
export async function deleteCacheEntry(env, cacheKey) {
  try {
    const { kvDel: del } = await import("../core/kv.js");
    await del(env, cacheKey);
    return true;
  } catch (error) {
    console.error("[Cache] Failed to delete cache entry:", error);
    return false;
  }
}

// Validate cache entry against current context
export function validateCacheEntry(entry, request) {
  if (!entry) return { valid: false, reason: "no_entry" };
  
  const { components } = generateCacheKey(request);
  const cached = entry.components;
  
  // Check model match
  if (components.model !== cached.model) {
    return { valid: false, reason: "model_mismatch" };
  }
  
  // Check model version match (if specified)
  if (request.modelVersion && components.modelVersion !== cached.modelVersion) {
    return { valid: false, reason: "model_version_mismatch" };
  }
  
  // Check messages hash
  if (components.messagesHash !== cached.messagesHash) {
    return { valid: false, reason: "messages_mismatch" };
  }
  
  // Check system prompt
  if (components.systemPrompt !== cached.systemPrompt) {
    return { valid: false, reason: "system_prompt_mismatch" };
  }
  
  // Check critical parameters
  if (JSON.stringify(components.params) !== JSON.stringify(cached.params)) {
    return { valid: false, reason: "parameters_mismatch" };
  }
  
  // Check tools (if present)
  if (components.tools !== cached.tools) {
    return { valid: false, reason: "tools_mismatch" };
  }
  
  // Check project context (if specified)
  if (request.projectId && components.projectId !== cached.projectId) {
    return { valid: false, reason: "project_mismatch" };
  }
  
  // Check memory context (if changed)
  if (request.memoryContext && components.memoryHash !== cached.memoryHash) {
    return { valid: false, reason: "memory_mismatch" };
  }
  
  return { valid: true, reason: null };
}

// Invalidate cache entries based on criteria
export async function invalidateCacheEntries(env, criteria) {
  try {
    const { kvListRaw: list, kvDel: del } = await import("../core/kv.js");
    const prefix = "cache:";
    const { keys } = await list(env, { prefix });
    
    let deleted = 0;
    for (const key of keys) {
      const entry = await getCacheEntry(env, key.name);
      if (!entry) continue;
      
      let shouldDelete = false;
      
      // Invalidate by model
      if (criteria.model && entry.components.model === criteria.model) {
        shouldDelete = true;
      }
      
      // Invalidate by provider
      if (criteria.providerId && entry.metadata.providerId === criteria.providerId) {
        shouldDelete = true;
      }
      
      // Invalidate by project
      if (criteria.projectId && entry.components.projectId === criteria.projectId) {
        shouldDelete = true;
      }
      
      // Invalidate by user
      if (criteria.userId && entry.components.userId === criteria.userId) {
        shouldDelete = true;
      }
      
      // Invalidate by age
      if (criteria.olderThan) {
        const age = Date.now() - new Date(entry.createdAt).getTime();
        if (age > criteria.olderThan * 1000) {
          shouldDelete = true;
        }
      }
      
      if (shouldDelete) {
        await del(env, key.name);
        deleted++;
      }
    }
    
    return { deleted };
  } catch (error) {
    console.error("[Cache] Failed to invalidate cache entries:", error);
    return { deleted: 0, error: String(error) };
  }
}

// Get cache statistics
export async function getCacheStats(env, options = {}) {
  try {
    const { kvListRaw: list } = await import("../core/kv.js");
    const prefix = "cache:";
    const { keys } = await list(env, { prefix, limit: options.limit || 1000 });
    
    const stats = {
      totalEntries: 0,
      validEntries: 0,
      expiredEntries: 0,
      totalHits: 0,
      byModel: {},
      byProvider: {},
      byProject: {},
      avgTTL: 0,
      avgHits: 0
    };
    
    const now = Date.now();
    let totalTTL = 0;
    
    for (const key of keys) {
      const entry = await getCacheEntry(env, key.name);
      if (!entry) continue;
      
      stats.totalEntries++;
      
      const expiresAt = new Date(entry.expiresAt).getTime();
      if (expiresAt > now) {
        stats.validEntries++;
      } else {
        stats.expiredEntries++;
      }
      
      stats.totalHits += entry.hits || 0;
      totalTTL += entry.ttl || 0;
      
      // By model
      const model = entry.components.model;
      stats.byModel[model] = (stats.byModel[model] || 0) + 1;
      
      // By provider
      const provider = entry.metadata.providerId;
      if (provider) {
        stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1;
      }
      
      // By project
      const project = entry.components.projectId;
      if (project) {
        stats.byProject[project] = (stats.byProject[project] || 0) + 1;
      }
    }
    
    if (stats.totalEntries > 0) {
      stats.avgTTL = Math.round(totalTTL / stats.totalEntries);
      stats.avgHits = Math.round(stats.totalHits / stats.totalEntries * 10) / 10;
    }
    
    // Calculate hit rate (total hits / valid entries)
    stats.hitRate = stats.validEntries > 0 ? Math.round((stats.totalHits / stats.validEntries) * 100) / 100 : 0;
    
    return stats;
  } catch (error) {
    console.error("[Cache] Failed to get cache stats:", error);
    return null;
  }
}

// Clear all cache entries
export async function clearAllCache(env) {
  try {
    const { kvListRaw: list, kvDel: del } = await import("../core/kv.js");
    const prefix = "cache:";
    const { keys } = await list(env, { prefix });
    
    let deleted = 0;
    for (const key of keys) {
      await del(env, key.name);
      deleted++;
    }
    
    return { deleted };
  } catch (error) {
    console.error("[Cache] Failed to clear cache:", error);
    return { deleted: 0, error: String(error) };
  }
}

// Cached chat call wrapper
export async function callChatWithCache(env, provider, model, messages, opts = {}) {
  const { callChat } = await import("./client.js");
  
  // Skip cache for streaming requests
  if (opts.onChunk) {
    return await callChat(env, provider, model, messages, opts);
  }
  
  // Skip cache if explicitly disabled
  if (opts.skipCache) {
    return await callChat(env, provider, model, messages, opts);
  }
  
  // Generate cache key
  const request = {
    model,
    modelVersion: opts.modelVersion,
    messages,
    systemPrompt: opts.systemPrompt,
    temperature: opts.temperature,
    topP: opts.topP,
    maxTokens: opts.maxTokens,
    json: opts.json,
    tools: opts.tools,
    toolChoice: opts.toolChoice,
    projectId: opts.projectId,
    memoryContext: opts.memoryContext,
    userId: opts.userId
  };
  
  const { cacheKey } = generateCacheKey(request);
  
  // Try to get from cache
  const cached = await getCacheEntry(env, cacheKey);
  
  if (cached) {
    // Validate cache entry
    const validation = validateCacheEntry(cached, request);
    
    if (validation.valid) {
      // Return cached response
      return {
        ...cached.response,
        model: cached.metadata.model,
        providerId: cached.metadata.providerId,
        providerName: cached.metadata.providerName,
        cached: true,
        cacheHit: true,
        cacheKey,
        originalLatency: cached.response.latency,
        latency: 0 // Cache hit has negligible latency
      };
    } else {
      // Invalid cache entry, delete it
      await deleteCacheEntry(env, cacheKey);
    }
  }
  
  // Cache miss, call provider
  const response = await callChat(env, provider, model, messages, opts);
  
  // Store in cache
  const entry = createCacheEntry(request, response);
  await setCacheEntry(env, entry);
  
  return {
    ...response,
    cached: false,
    cacheHit: false,
    cacheKey
  };
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Phase 33: Semantic Cache Enhancement
// Vector-based similarity matching for fuzzy cache hits
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { generateEmbedding, queryVectors, insertVectors } from "../knowledge/vectorize.js";

/**
 * Semantic cache using vector similarity
 */
export async function semanticCacheGet(env, { query, modelId, similarityThreshold = 0.95, userId }) {
  const cacheIndexId = "semantic_cache_index";

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(env, {
      text: query,
      modelId: modelId || "text-embedding-ada-002",
      userId
    });

    // Search for similar cached queries
    const { queryVectors } = await import("../knowledge/vectorize.js");
    const results = await queryVectors(env, cacheIndexId, {
      vector: queryEmbedding,
      topK: 1,
      includeMetadata: true
    });

    if (results.length === 0 || results[0].score < similarityThreshold) {
      return null; // Cache miss
    }

    // Check if cached response is still valid
    const cacheEntry = results[0].metadata;
    if (cacheEntry.expiresAt && new Date(cacheEntry.expiresAt) < new Date()) {
      return null; // Expired
    }

    return {
      hit: true,
      response: cacheEntry.response,
      originalQuery: cacheEntry.query,
      similarity: results[0].score,
      cachedAt: cacheEntry.cachedAt
    };
  } catch (error) {
    // Fall back to exact match cache
    return null;
  }
}

/**
 * Store response in semantic cache
 */
export async function semanticCacheSet(env, { query, response, modelId, ttl = 3600, userId }) {
  const cacheIndexId = "semantic_cache_index";

  try {
    // Generate embedding for query
    const embedding = await generateEmbedding(env, {
      text: query,
      modelId: modelId || "text-embedding-ada-002",
      userId
    });

    const cacheEntry = {
      query,
      response,
      modelId,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    };

    // Store in vector index
    await insertVectors(env, cacheIndexId, [{
      id: `cache_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      values: embedding,
      metadata: cacheEntry
    }]);

    return true;
  } catch (error) {
    // Silently fail - cache is optional
    return false;
  }
}

/**
 * Invalidate semantic cache entries
 */
export async function semanticCacheInvalidate(env, { pattern = null, olderThan = null } = {}) {
  const cacheIndexId = "semantic_cache_index";
  
  try {
    const { getVectorIndex } = await import("../knowledge/vectorize.js");
    const index = await getVectorIndex(env, cacheIndexId);
    
    if (!index) return { invalidated: 0 };

    // Get all cached vectors
    const { kvListRaw } = await import("../core/kv.js");
    const keys = await kvListRaw(env, { prefix: `vector:${cacheIndexId}:` });
    let invalidated = 0;

    for (const key of keys.keys) {
      const { kvGet, kvPut } = await import("../core/kv.js");
      const vector = await kvGet(env, key.name);
      if (!vector) continue;

      let shouldInvalidate = false;

      // Check pattern match
      if (pattern && vector.metadata.query.includes(pattern)) {
        shouldInvalidate = true;
      }

      // Check age
      if (olderThan) {
        const cachedAt = new Date(vector.metadata.cachedAt);
        const cutoff = new Date(Date.now() - olderThan * 1000);
        if (cachedAt < cutoff) {
          shouldInvalidate = true;
        }
      }

      // Check expiration
      if (vector.metadata.expiresAt && new Date(vector.metadata.expiresAt) < new Date()) {
        shouldInvalidate = true;
      }

      if (shouldInvalidate) {
        await kvPut(env, key.name, null);
        invalidated++;
      }
    }

    return { invalidated };
  } catch (error) {
    return { invalidated: 0, error: error.message };
  }
}

/**
 * Get semantic cache statistics
 */
export async function getSemanticCacheStats(env) {
  const cacheIndexId = "semantic_cache_index";

  try {
    const { kvListRaw } = await import("../core/kv.js");
    const keys = await kvListRaw(env, { prefix: `vector:${cacheIndexId}:` });
    const { kvGet } = await import("../core/kv.js");
    
    let total = 0;
    let expired = 0;
    let validCount = 0;
    let totalAge = 0;

    for (const key of keys.keys) {
      const vector = await kvGet(env, key.name);
      if (!vector) continue;

      total++;

      if (vector.metadata.expiresAt && new Date(vector.metadata.expiresAt) < new Date()) {
        expired++;
      } else {
        validCount++;
      }

      const age = Date.now() - new Date(vector.metadata.cachedAt).getTime();
      totalAge += age;
    }

    return {
      total,
      valid: validCount,
      expired,
      avgAgeSeconds: total > 0 ? Math.floor(totalAge / total / 1000) : 0
    };
  } catch (error) {
    return { total: 0, valid: 0, expired: 0, error: error.message };
  }
}

/**
 * Hybrid cache: Try semantic first, fall back to exact
 */
export async function hybridCacheGet(env, request, userId) {
  // Try semantic cache first
  const semanticResult = await semanticCacheGet(env, {
    query: JSON.stringify(request.messages),
    modelId: request.model,
    userId
  });

  if (semanticResult && semanticResult.hit) {
    return {
      ...semanticResult,
      cacheType: "semantic"
    };
  }

  // Fall back to exact match cache
  const exactKey = generateCacheKey(request);
  const { kvGet } = await import("../core/kv.js");
  const exactResult = await kvGet(env, `cache:${exactKey}`);

  if (exactResult) {
    return {
      hit: true,
      response: exactResult,
      cacheType: "exact",
      similarity: 1.0
    };
  }

  return null;
}

/**
 * Hybrid cache set
 */
export async function hybridCacheSet(env, request, response, userId) {
  // Store in both caches
  const exactKey = generateCacheKey(request);
  const { kvPut } = await import("../core/kv.js");
  
  // Exact cache
  await kvPut(env, `cache:${exactKey}`, response, { expirationTtl: CACHE_TTL_DEFAULT });

  // Semantic cache
  await semanticCacheSet(env, {
    query: JSON.stringify(request.messages),
    response,
    modelId: request.model,
    ttl: CACHE_TTL_DEFAULT,
    userId
  });
}
