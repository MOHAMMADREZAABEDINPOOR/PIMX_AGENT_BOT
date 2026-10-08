// ─────────────────────────────────────────────
// 🔍 Enhanced Global Search — Unified search across all resources
// Fuzzy matching, relevance scoring, filters, faceted search
// ─────────────────────────────────────────────

import { kvGet, kvPut } from "../core/kv.js";
import { listModels } from "../gateway/models.js";
import { listProviders } from "../gateway/providers.js";
import { listAgents } from "../agents/runtime.js";
import { listProjects, listMemories } from "../knowledge/memory.js";
import { listWorkflows, listTasks } from "../ops/automation.js";
import { listBenchmarks } from "../gateway/benchmark.js";
import { listCouncilRuns } from "../gateway/council.js";

// ── Search Configuration ────────────────────────────────────────

const RESOURCE_TYPES = {
  model: { weight: 1.0, fields: ["displayName", "apiModelId", "tags"], limit: 10 },
  provider: { weight: 0.9, fields: ["name", "baseUrl", "format"], limit: 8 },
  agent: { weight: 0.95, fields: ["name", "description", "systemPrompt"], limit: 8 },
  project: { weight: 0.85, fields: ["name", "description"], limit: 5 },
  workflow: { weight: 0.85, fields: ["name", "description"], limit: 5 },
  task: { weight: 0.8, fields: ["name", "description", "command"], limit: 5 },
  memory: { weight: 0.7, fields: ["text", "kind"], limit: 5 },
  benchmark: { weight: 0.6, fields: ["label", "tasks"], limit: 3 },
  council: { weight: 0.6, fields: ["mode", "label"], limit: 3 }
};

// ── Fuzzy Matching ──────────────────────────────────────────────

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate fuzzy match score (0-1)
 */
function fuzzyMatchScore(query, text) {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match
  if (textLower === queryLower) return 1.0;

  // Contains exact query
  if (textLower.includes(queryLower)) {
    const position = textLower.indexOf(queryLower);
    const positionScore = 1 - (position / textLower.length * 0.3); // Prefer matches at start
    return 0.8 * positionScore;
  }

  // Word boundary match
  const words = textLower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(queryLower)) return 0.7;
    if (word.includes(queryLower)) return 0.6;
  }

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(queryLower, textLower.slice(0, queryLower.length + 5));
  const maxDistance = Math.max(queryLower.length, textLower.length);
  const similarity = 1 - (distance / maxDistance);

  if (similarity > 0.7) return similarity * 0.5;

  return 0;
}

/**
 * Calculate relevance score for an item
 */
function calculateRelevance(query, item, fields, resourceWeight) {
  let bestScore = 0;

  for (const field of fields) {
    const value = item[field];
    if (!value) continue;

    let fieldValue;
    if (Array.isArray(value)) {
      fieldValue = value.join(" ");
    } else {
      fieldValue = String(value);
    }

    const score = fuzzyMatchScore(query, fieldValue);
    if (score > bestScore) bestScore = score;
  }

  return bestScore * resourceWeight;
}

// ── Advanced Search ─────────────────────────────────────────────

/**
 * Search across all resources with enhanced features
 */
export async function advancedSearch(env, {
  query,
  userId,
  filters = {},
  sort = "relevance", // "relevance", "recent", "alphabetical"
  limit = 50,
  fuzzy = true,
  includeTypes = null // null = all types, or array like ["model", "agent"]
}) {
  const needle = query.toLowerCase().trim();
  if (!needle) return { results: [], facets: {}, stats: { total: 0, byType: {} } };

  // Determine which resource types to search
  const typesToSearch = includeTypes || Object.keys(RESOURCE_TYPES);

  // Fetch all resources in parallel
  const resourcePromises = [];
  const resourceMap = {};

  if (typesToSearch.includes("model")) {
    resourcePromises.push(
      listModels(env).then(items => { resourceMap.model = items; })
    );
  }

  if (typesToSearch.includes("provider")) {
    resourcePromises.push(
      listProviders(env).then(items => { resourceMap.provider = items; })
    );
  }

  if (typesToSearch.includes("agent")) {
    resourcePromises.push(
      listAgents(env).then(items => { resourceMap.agent = items; })
    );
  }

  if (typesToSearch.includes("project")) {
    resourcePromises.push(
      listProjects(env, userId).then(items => { resourceMap.project = items; })
    );
  }

  if (typesToSearch.includes("workflow")) {
    resourcePromises.push(
      listWorkflows(env, userId).then(items => { resourceMap.workflow = items; })
    );
  }

  if (typesToSearch.includes("task")) {
    resourcePromises.push(
      listTasks(env, userId).then(items => { resourceMap.task = items; })
    );
  }

  if (typesToSearch.includes("memory")) {
    resourcePromises.push(
      listMemories(env, userId).then(items => { resourceMap.memory = items; })
    );
  }

  if (typesToSearch.includes("benchmark")) {
    resourcePromises.push(
      listBenchmarks(env, 100).then(items => { resourceMap.benchmark = items; })
    );
  }

  if (typesToSearch.includes("council")) {
    resourcePromises.push(
      listCouncilRuns(env, 100).then(items => { resourceMap.council = items; })
    );
  }

  await Promise.all(resourcePromises);

  // Search and score results
  const results = [];
  const facets = {};

  for (const [type, items] of Object.entries(resourceMap)) {
    if (!items) continue;

    const config = RESOURCE_TYPES[type];
    const typeResults = [];

    for (const item of items) {
      // Apply filters
      if (filters.status && item.status !== filters.status) continue;
      if (filters.enabled !== undefined && item.enabled !== filters.enabled) continue;
      if (filters.tag && (!item.tags || !item.tags.includes(filters.tag))) continue;

      // Calculate relevance score
      const relevance = fuzzy
        ? calculateRelevance(needle, item, config.fields, config.weight)
        : fuzzyMatchScore(needle, config.fields.map(f => item[f]).join(" "));

      if (relevance > 0.1) { // Threshold for including result
        typeResults.push({
          type,
          id: item.id,
          title: item.displayName || item.name || item.text?.slice(0, 50) || "Untitled",
          subtitle: getSubtitle(type, item),
          relevance,
          item: getSafeItem(item), // Remove sensitive data
          timestamp: item.createdAt || item.lastChecked || item.updatedAt || null
        });
      }
    }

    // Sort by relevance and apply per-type limit
    typeResults.sort((a, b) => b.relevance - a.relevance);
    results.push(...typeResults.slice(0, config.limit));

    // Build facets
    facets[type] = typeResults.length;
  }

  // Apply global sort
  if (sort === "relevance") {
    results.sort((a, b) => b.relevance - a.relevance);
  } else if (sort === "recent") {
    results.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  } else if (sort === "alphabetical") {
    results.sort((a, b) => a.title.localeCompare(b.title));
  }

  // Apply global limit
  const limitedResults = results.slice(0, limit);

  // Calculate stats
  const stats = {
    total: limitedResults.length,
    byType: facets,
    query: needle,
    hasMore: results.length > limit
  };

  return { results: limitedResults, facets, stats };
}

/**
 * Get subtitle for search result
 */
function getSubtitle(type, item) {
  switch (type) {
    case "model":
      return `${item.providerName || "Unknown"} · ${item.status || "unknown"}`;
    case "provider":
      return item.baseUrl || "";
    case "agent":
      return item.description || "";
    case "project":
    case "workflow":
    case "task":
      return item.description || "";
    case "memory":
      return item.kind || "memory";
    case "benchmark":
      return `${item.reports?.length || 0} models tested`;
    case "council":
      return `${item.mode || "unknown"} · ${item.participantCount || 0} participants`;
    default:
      return "";
  }
}

/**
 * Remove sensitive data from item
 */
function getSafeItem(item) {
  const safe = { ...item };
  delete safe.apiKey;
  delete safe.apiKeys;
  delete safe.keys;
  delete safe.systemPrompt;
  delete safe.internalNotes;
  return safe;
}

// ── Faceted Search ──────────────────────────────────────────────

/**
 * Get available facets for search
 */
export async function getSearchFacets(env, userId) {
  const [models, providers, agents] = await Promise.all([
    listModels(env),
    listProviders(env),
    listAgents(env)
  ]);

  return {
    resourceTypes: Object.keys(RESOURCE_TYPES),
    modelStatuses: [...new Set(models.map(m => m.status))],
    providerFormats: [...new Set(providers.map(p => p.format))],
    agentTypes: [...new Set(agents.map(a => a.type || "custom"))],
    tags: [...new Set(models.flatMap(m => m.tags || []))]
  };
}

// ── Search Suggestions ──────────────────────────────────────────

/**
 * Get search suggestions based on partial query
 */
export async function getSearchSuggestions(env, { query, userId, limit = 10 }) {
  const needle = query.toLowerCase().trim();
  if (needle.length < 2) return [];

  const [models, providers, agents, projects] = await Promise.all([
    listModels(env),
    listProviders(env),
    listAgents(env),
    listProjects(env, userId)
  ]);

  const suggestions = new Set();

  // Add model names
  models.forEach(m => {
    if (m.displayName.toLowerCase().startsWith(needle)) {
      suggestions.add(m.displayName);
    }
  });

  // Add provider names
  providers.forEach(p => {
    if (p.name.toLowerCase().startsWith(needle)) {
      suggestions.add(p.name);
    }
  });

  // Add agent names
  agents.forEach(a => {
    if (a.name.toLowerCase().startsWith(needle)) {
      suggestions.add(a.name);
    }
  });

  // Add project names
  projects.forEach(p => {
    if (p.name.toLowerCase().startsWith(needle)) {
      suggestions.add(p.name);
    }
  });

  return Array.from(suggestions).slice(0, limit);
}

// ── Search History ──────────────────────────────────────────────

/**
 * Record search query
 */
export async function recordSearch(env, { query, userId, resultCount }) {
  const history = await kvGet(env, `search_history:${userId}`) || [];
  
  history.unshift({
    query,
    timestamp: Date.now(),
    resultCount
  });

  // Keep last 50 searches
  await kvPut(env, `search_history:${userId}`, history.slice(0, 50), { expirationTtl: 86400 * 30 });
}

/**
 * Get search history
 */
export async function getSearchHistory(env, userId, { limit = 20 } = {}) {
  const history = await kvGet(env, `search_history:${userId}`) || [];
  return history.slice(0, limit);
}

/**
 * Get popular searches
 */
export async function getPopularSearches(env, { limit = 10 } = {}) {
  // This would require a more sophisticated implementation with counters
  // For now, return a simple placeholder
  return [
    { query: "gpt-4", count: 150 },
    { query: "claude", count: 120 },
    { query: "embedding", count: 80 },
    { query: "fast", count: 65 },
    { query: "cheap", count: 50 }
  ].slice(0, limit);
}
