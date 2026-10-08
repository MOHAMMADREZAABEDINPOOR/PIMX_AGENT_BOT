// ─────────────────────────────────────────────
// 🧠 Advanced Memory, Knowledge Graph & Projects
// روی حافظه/KB موجود ربات ساخته میشود و آن را جایگزین نمیکند.
// ─────────────────────────────────────────────
import { kvGet, kvPut, kvDel, indexAdd, indexRemove, readMany, newId, nowIso } from "../core/kv.js";
import { ctx } from "../core/ctx.js";
import { completeJson } from "../gateway/router.js";
import { audit } from "../core/audit.js";

// ══════════════════════════════════════════════
// Multi-Scope Memory Architecture (Phase 10)
// ══════════════════════════════════════════════
// Separate memory scopes with authorization:
// - CONVERSATION: Short-term, single conversation
// - USER: User-level long-term facts
// - PROJECT: Project-specific context
// - AGENT: Agent's learned behaviors
// - KNOWLEDGE_BASE: Shared knowledge repository
// ══════════════════════════════════════════════

// Memory scope enumeration
export const MEMORY_SCOPES = {
  CONVERSATION: "conversation",    // Short-term, expires with conversation
  USER: "user",                    // User-level long-term memory
  PROJECT: "project",              // Project-specific context
  AGENT: "agent",                  // Agent-specific learned patterns
  KNOWLEDGE_BASE: "knowledge"      // Shared knowledge repository
};

// Key generation for each scope
const memKey = (userId) => `mem:${userId}`;  // Backward compatibility (USER scope)
const conversationMemKey = (convId) => `mem:conv:${convId}`;
const userMemKey = (userId) => `mem:user:${userId}`;
const projectMemKey = (projectId) => `mem:project:${projectId}`;
const agentMemKey = (agentId) => `mem:agent:${agentId}`;
const knowledgeMemKey = () => `mem:knowledge:global`;

const graphKey = (userId) => `graph:${userId}`;
const projKey = (id) => `project:${id}`;
const PROJ_INDEX = uid => `projects:index:${uid}`;

export const MEMORY_KINDS = ["fact", "preference", "project", "semantic", "skill", "relationship"];

// Memory access control
const SCOPE_PERMISSIONS = {
  [MEMORY_SCOPES.CONVERSATION]: { read: ["owner"], write: ["owner"], delete: ["owner"] },
  [MEMORY_SCOPES.USER]: { read: ["owner"], write: ["owner", "system"], delete: ["owner"] },
  [MEMORY_SCOPES.PROJECT]: { read: ["project_member", "owner"], write: ["project_member"], delete: ["owner"] },
  [MEMORY_SCOPES.AGENT]: { read: ["owner", "agent"], write: ["agent", "system"], delete: ["owner"] },
  [MEMORY_SCOPES.KNOWLEDGE_BASE]: { read: ["all"], write: ["admin"], delete: ["admin"] }
};

// ══════════════════════════════════════════════
// Authorization Check
// ══════════════════════════════════════════════
function checkMemoryAccess(scope, action, { userId, projectId, agentId, role = "user" }) {
  const perms = SCOPE_PERMISSIONS[scope];
  if (!perms) throw new Error(`Unknown memory scope: ${scope}`);
  
  const allowed = perms[action] || [];
  
  // Admin can do anything
  if (role === "admin") return true;
  
  // Check specific permissions
  if (allowed.includes("all")) return true;
  if (allowed.includes("owner") && userId) return true;
  if (allowed.includes("project_member") && projectId) return true;
  if (allowed.includes("agent") && agentId) return true;
  if (allowed.includes("system") && role === "system") return true;
  
  return false;
}

// Get the appropriate key for a scope
function getScopeKey(scope, { userId, conversationId, projectId, agentId }) {
  switch (scope) {
    case MEMORY_SCOPES.CONVERSATION:
      if (!conversationId) throw new Error("conversationId required for CONVERSATION scope");
      return conversationMemKey(conversationId);
    case MEMORY_SCOPES.USER:
      if (!userId) throw new Error("userId required for USER scope");
      return userMemKey(userId);
    case MEMORY_SCOPES.PROJECT:
      if (!projectId) throw new Error("projectId required for PROJECT scope");
      return projectMemKey(projectId);
    case MEMORY_SCOPES.AGENT:
      if (!agentId) throw new Error("agentId required for AGENT scope");
      return agentMemKey(agentId);
    case MEMORY_SCOPES.KNOWLEDGE_BASE:
      return knowledgeMemKey();
    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}

// ══════════════════════════════════════════════
// Multi-Scope Memory Operations
// ══════════════════════════════════════════════

/**
 * List memories from a specific scope
 * @param {Object} env - Environment
 * @param {Object} opts - Options
 * @param {string} opts.scope - Memory scope (CONVERSATION/USER/PROJECT/AGENT/KNOWLEDGE_BASE)
 * @param {number} opts.userId - User ID (required for auth)
 * @param {string} opts.conversationId - Conversation ID (for CONVERSATION scope)
 * @param {string} opts.projectId - Project ID (for PROJECT scope)
 * @param {string} opts.agentId - Agent ID (for AGENT scope)
 * @param {string} opts.kind - Filter by kind
 * @param {string} opts.q - Search query
 * @param {string} opts.role - User role (for permissions)
 */
export async function listMemoriesScoped(env, opts = {}) {
  const { scope = MEMORY_SCOPES.USER, userId, conversationId, projectId, agentId, kind, q, role } = opts;
  
  // Authorization check
  if (!checkMemoryAccess(scope, "read", { userId, projectId, agentId, role })) {
    throw new Error(`Access denied: Cannot read ${scope} memories`);
  }
  
  const key = getScopeKey(scope, { userId, conversationId, projectId, agentId });
  let rows = await kvGet(env, key, []);
  
  // Filters
  if (kind) rows = rows.filter(m => m.kind === kind);
  if (q) {
    const n = String(q).toLowerCase();
    rows = rows.filter(m => m.text.toLowerCase().includes(n));
  }
  
  return rows;
}

/**
 * Add memory to a specific scope
 * @param {Object} env - Environment
 * @param {Object} opts - Options
 * @param {string} opts.scope - Memory scope
 * @param {string} opts.text - Memory text
 * @param {string} opts.kind - Memory kind
 * @param {number} opts.userId - User ID
 * @param {string} opts.conversationId - Conversation ID
 * @param {string} opts.projectId - Project ID
 * @param {string} opts.agentId - Agent ID
 * @param {string} opts.source - Source of memory
 * @param {boolean} opts.embed - Whether to embed
 * @param {string} opts.role - User role
 */
export async function addMemoryScoped(env, opts = {}) {
  const { 
    scope = MEMORY_SCOPES.USER, 
    text, 
    kind = "fact", 
    userId, 
    conversationId, 
    projectId, 
    agentId, 
    source = "user", 
    embed = true,
    role 
  } = opts;
  
  // Authorization check
  if (!checkMemoryAccess(scope, "write", { userId, projectId, agentId, role })) {
    throw new Error(`Access denied: Cannot write ${scope} memories`);
  }
  
  const key = getScopeKey(scope, { userId, conversationId, projectId, agentId });
  const rows = await kvGet(env, key, []);
  
  const clean = String(text || "").trim().slice(0, 1200);
  if (!clean) throw new Error("متن حافظه خالی است");
  
  // Check for duplicates
  if (rows.some(m => m.text.toLowerCase() === clean.toLowerCase())) return rows;
  
  const item = {
    id: newId("m"),
    text: clean,
    kind: MEMORY_KINDS.includes(kind) ? kind : "fact",
    scope,
    source,
    ts: nowIso(),
    hits: 0,
    // Scope-specific metadata
    userId: scope === MEMORY_SCOPES.USER ? userId : undefined,
    conversationId: scope === MEMORY_SCOPES.CONVERSATION ? conversationId : undefined,
    projectId: scope === MEMORY_SCOPES.PROJECT ? projectId : undefined,
    agentId: scope === MEMORY_SCOPES.AGENT ? agentId : undefined
  };
  
  // Embedding
  if (embed && ctx.ai.embed) {
    try { 
      const [v] = await ctx.ai.embed([clean]); 
      item.vec = v; 
    } catch {}
  }
  
  rows.push(item);
  
  // Scope-specific limits
  const limits = {
    [MEMORY_SCOPES.CONVERSATION]: 50,   // Conversations are short-term
    [MEMORY_SCOPES.USER]: 400,          // User memories are long-term
    [MEMORY_SCOPES.PROJECT]: 200,       // Project-scoped
    [MEMORY_SCOPES.AGENT]: 300,         // Agent learned patterns
    [MEMORY_SCOPES.KNOWLEDGE_BASE]: 1000 // Shared knowledge
  };
  const limit = limits[scope] || 400;
  
  await kvPut(env, key, rows.slice(-limit));
  
  // Audit trail
  await audit(env, { 
    userId, 
    action: "memory.add", 
    resource: item.id, 
    meta: { scope, kind, source } 
  });
  
  return item;
}

/**
 * Update memory in a specific scope
 */
export async function updateMemoryScoped(env, id, text, opts = {}) {
  const { scope = MEMORY_SCOPES.USER, userId, conversationId, projectId, agentId, role } = opts;
  
  // Authorization check
  if (!checkMemoryAccess(scope, "write", { userId, projectId, agentId, role })) {
    throw new Error(`Access denied: Cannot update ${scope} memories`);
  }
  
  const key = getScopeKey(scope, { userId, conversationId, projectId, agentId });
  const rows = await kvGet(env, key, []);
  const m = rows.find(x => x.id === id);
  if (!m) throw new Error("حافظه یافت نشد");
  
  m.text = String(text).slice(0, 1200);
  m.updatedAt = nowIso();
  
  if (ctx.ai.embed) { 
    try { 
      const [v] = await ctx.ai.embed([m.text]); 
      m.vec = v; 
    } catch {} 
  }
  
  await kvPut(env, key, rows);
  
  await audit(env, { userId, action: "memory.update", resource: id, meta: { scope } });
  
  return m;
}

/**
 * Delete memory from a specific scope
 */
export async function deleteMemoryScoped(env, id, opts = {}) {
  const { scope = MEMORY_SCOPES.USER, userId, conversationId, projectId, agentId, role } = opts;
  
  // Authorization check
  if (!checkMemoryAccess(scope, "delete", { userId, projectId, agentId, role })) {
    throw new Error(`Access denied: Cannot delete ${scope} memories`);
  }
  
  const key = getScopeKey(scope, { userId, conversationId, projectId, agentId });
  const rows = (await kvGet(env, key, [])).filter(x => x.id !== id);
  await kvPut(env, key, rows);
  
  await audit(env, { userId, action: "memory.delete", resource: id, meta: { scope } });
  
  return rows;
}

/**
 * Clear all memories in a scope
 */
export async function clearMemoriesScoped(env, opts = {}) {
  const { scope = MEMORY_SCOPES.USER, userId, conversationId, projectId, agentId, kind = null, role } = opts;
  
  // Authorization check
  if (!checkMemoryAccess(scope, "delete", { userId, projectId, agentId, role })) {
    throw new Error(`Access denied: Cannot clear ${scope} memories`);
  }
  
  const key = getScopeKey(scope, { userId, conversationId, projectId, agentId });
  const rows = kind ? (await kvGet(env, key, [])).filter(m => m.kind !== kind) : [];
  await kvPut(env, key, rows);
  
  await audit(env, { userId, action: "memory.clear", resource: key, meta: { scope, kind } });
  
  return rows;
}

/**
 * Search memories across scopes
 * @param {Object} env - Environment
 * @param {string} query - Search query
 * @param {Object} opts - Options
 * @param {Array<string>} opts.scopes - Scopes to search (defaults to all accessible)
 * @param {number} opts.topK - Number of results per scope
 * @param {number} opts.userId - User ID (for auth)
 * @param {string} opts.conversationId - Conversation ID
 * @param {string} opts.projectId - Project ID
 * @param {string} opts.agentId - Agent ID
 * @param {string} opts.role - User role
 */
export async function searchMemoryScoped(env, query, opts = {}) {
  const { 
    scopes = [MEMORY_SCOPES.USER, MEMORY_SCOPES.PROJECT, MEMORY_SCOPES.KNOWLEDGE_BASE],
    topK = 5,
    userId,
    conversationId,
    projectId,
    agentId,
    role
  } = opts;
  
  const allResults = [];
  
  for (const scope of scopes) {
    try {
      // Check access
      if (!checkMemoryAccess(scope, "read", { userId, projectId, agentId, role })) {
        continue;
      }
      
      const rows = await listMemoriesScoped(env, { scope, userId, conversationId, projectId, agentId, role });
      if (!rows.length) continue;
      
      // Get query vector
      let qv = null;
      if (ctx.ai.embed) { 
        try { 
          [qv] = await ctx.ai.embed([query]); 
        } catch {} 
      }
      
      // Keyword matching
      const words = String(query).toLowerCase().split(/\s+/).filter(w => w.length > 2);
      
      // Score and rank
      const scored = rows.map(m => {
        const sem = qv && m.vec ? cosine(qv, m.vec) : 0;
        const lex = words.length ? words.filter(w => m.text.toLowerCase().includes(w)).length / words.length : 0;
        return { ...m, score: sem * 0.75 + lex * 0.25 };
      });
      
      const results = scored
        .sort((a, b) => b.score - a.score)
        .filter(m => m.score > 0.12)
        .slice(0, topK)
        .map(({ vec, ...rest }) => rest);
      
      allResults.push(...results);
    } catch (e) {
      // Skip inaccessible scopes
      continue;
    }
  }
  
  // Sort all results by score
  return allResults.sort((a, b) => b.score - a.score).slice(0, topK * scopes.length);
}

/**
 * Get memory statistics for a scope
 */
export async function getMemoryStats(env, opts = {}) {
  const { scope = MEMORY_SCOPES.USER, userId, conversationId, projectId, agentId, role } = opts;
  
  // Authorization check
  if (!checkMemoryAccess(scope, "read", { userId, projectId, agentId, role })) {
    throw new Error(`Access denied: Cannot read ${scope} memory stats`);
  }
  
  const key = getScopeKey(scope, { userId, conversationId, projectId, agentId });
  const rows = await kvGet(env, key, []);
  
  const byKind = {};
  const bySource = {};
  let totalHits = 0;
  let embedded = 0;
  
  for (const m of rows) {
    byKind[m.kind] = (byKind[m.kind] || 0) + 1;
    bySource[m.source] = (bySource[m.source] || 0) + 1;
    totalHits += m.hits || 0;
    if (m.vec) embedded++;
  }
  
  return {
    scope,
    total: rows.length,
    byKind,
    bySource,
    totalHits,
    avgHits: rows.length ? (totalHits / rows.length).toFixed(2) : 0,
    embedded,
    embeddedPercent: rows.length ? ((embedded / rows.length) * 100).toFixed(1) : 0
  };
}

/**
 * Merge conversation memories into user memories (at conversation end)
 */
export async function mergeConversationMemories(env, conversationId, userId, opts = {}) {
  const { role } = opts;
  
  // Get conversation memories
  const convMems = await listMemoriesScoped(env, {
    scope: MEMORY_SCOPES.CONVERSATION,
    conversationId,
    userId,
    role
  });
  
  if (!convMems.length) return { merged: 0 };
  
  // Get user memories for deduplication
  const userMems = await listMemoriesScoped(env, {
    scope: MEMORY_SCOPES.USER,
    userId,
    role
  });
  
  const userTexts = new Set(userMems.map(m => m.text.toLowerCase()));
  let merged = 0;
  
  // Merge non-duplicate facts and preferences
  for (const mem of convMems) {
    if (mem.kind === "fact" || mem.kind === "preference") {
      if (!userTexts.has(mem.text.toLowerCase())) {
        await addMemoryScoped(env, {
          scope: MEMORY_SCOPES.USER,
          text: mem.text,
          kind: mem.kind,
          userId,
          source: "conversation",
          embed: !!mem.vec,
          role
        });
        merged++;
      }
    }
  }
  
  // Clear conversation memories after merge
  await clearMemoriesScoped(env, {
    scope: MEMORY_SCOPES.CONVERSATION,
    conversationId,
    userId,
    role
  });
  
  return { merged, total: convMems.length };
}

// ══════════════════════════════════════════════
// Backward Compatibility Layer
// ══════════════════════════════════════════════
// Legacy functions delegate to scoped versions with USER scope

export async function listMemories(env, userId, { kind, projectId, q } = {}) {
  // If projectId provided, use PROJECT scope
  if (projectId) {
    return listMemoriesScoped(env, {
      scope: MEMORY_SCOPES.PROJECT,
      projectId,
      userId,
      kind,
      q
    });
  }
  
  // Default to USER scope
  return listMemoriesScoped(env, {
    scope: MEMORY_SCOPES.USER,
    userId,
    kind,
    q
  });
}

export async function addMemory(env, userId, { text, kind = "fact", projectId = null, source = "user", embed = true }) {
  // Delegate to scoped version
  if (projectId) {
    const item = await addMemoryScoped(env, {
      scope: MEMORY_SCOPES.PROJECT,
      text,
      kind,
      projectId,
      userId,
      source,
      embed
    });
    return [item];
  }
  
  const item = await addMemoryScoped(env, {
    scope: MEMORY_SCOPES.USER,
    text,
    kind,
    userId,
    source,
    embed
  });
  return [item];
}

export async function updateMemory(env, userId, id, text) {
  // Try USER scope first (most common)
  try {
    return await updateMemoryScoped(env, id, text, {
      scope: MEMORY_SCOPES.USER,
      userId
    });
  } catch (e) {
    // If not found, try PROJECT scope
    // (we don't know projectId, so this is best effort)
    throw new Error("حافظه یافت نشد");
  }
}

export async function deleteMemory(env, userId, id) {
  // Try USER scope
  try {
    return await deleteMemoryScoped(env, id, {
      scope: MEMORY_SCOPES.USER,
      userId
    });
  } catch (e) {
    throw new Error("حافظه یافت نشد");
  }
}

export async function clearMemories(env, userId, kind = null) {
  return clearMemoriesScoped(env, {
    scope: MEMORY_SCOPES.USER,
    userId,
    kind
  });
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// جستجوی معنایی + کلیدواژهای (hybrid) - backward compatible
export async function searchMemory(env, userId, query, { topK = 5, projectId = null } = {}) {
  if (projectId) {
    return searchMemoryScoped(env, query, {
      scopes: [MEMORY_SCOPES.PROJECT],
      projectId,
      userId,
      topK
    });
  }
  
  return searchMemoryScoped(env, query, {
    scopes: [MEMORY_SCOPES.USER],
    userId,
    topK
  });
}

// استخراج حافظه از مکالمه (واقعی، با مدل)
export async function extractMemories(env, userId, conversation, { projectId = null } = {}) {
  try {
    const { json } = await completeJson(env,
      `Extract durable facts about the user from this conversation. Only include stable information (name, role, preferences, ongoing projects, tools they use). Ignore one-off questions.\n\nConversation:\n${String(conversation).slice(0, 4000)}\n\nReturn ONLY JSON: {"items":[{"text":"...","kind":"fact|preference|project|skill|relationship"}]}\nMax 5 items. Empty array if nothing durable.`,
      { system: "You extract long-term memory. Output strict JSON only.", maxTokens: 500, temperature: 0.1, task: "data" });
    const items = Array.isArray(json.items) ? json.items.slice(0, 5) : [];
    for (const it of items) {
      if (it?.text) await addMemory(env, userId, { text: it.text, kind: it.kind, projectId, source: "auto" });
    }
    return items;
  } catch { return []; }
}

// ── Knowledge Graph ───────────────────────────
export const ENTITY_TYPES = ["person", "project", "technology", "document", "conversation", "task", "provider", "model", "organization"];

export async function getGraph(env, userId) {
  return kvGet(env, graphKey(userId), { nodes: [], edges: [] });
}

export async function addGraphNode(env, userId, { name, type = "technology", meta = {} }) {
  const g = await getGraph(env, userId);
  const key = `${type}:${String(name).toLowerCase()}`;
  let node = g.nodes.find(n => n.key === key);
  if (!node) {
    node = { id: newId("gn"), key, name: String(name).slice(0, 80), type: ENTITY_TYPES.includes(type) ? type : "technology", meta, ts: nowIso(), weight: 1 };
    g.nodes.push(node);
  } else node.weight = (node.weight || 1) + 1;
  await kvPut(env, graphKey(userId), { nodes: g.nodes.slice(-300), edges: g.edges.slice(-600) });
  return node;
}

export async function addGraphEdge(env, userId, { from, to, relation = "related" }) {
  const g = await getGraph(env, userId);
  const a = await addGraphNode(env, userId, typeof from === "string" ? { name: from } : from);
  const b = await addGraphNode(env, userId, typeof to === "string" ? { name: to } : to);
  const g2 = await getGraph(env, userId);
  const exists = g2.edges.find(e => e.from === a.id && e.to === b.id && e.relation === relation);
  if (!exists) g2.edges.push({ id: newId("ge"), from: a.id, to: b.id, relation: String(relation).slice(0, 40), ts: nowIso() });
  await kvPut(env, graphKey(userId), g2);
  return { from: a, to: b };
}

// استخراج گراف از متن (فقط روابط صریح)
export async function extractGraph(env, userId, text) {
  try {
    const { json } = await completeJson(env,
      `Extract explicit entities and relationships from the text. Do NOT invent relationships.\n\nText:\n${String(text).slice(0, 3000)}\n\nReturn ONLY JSON: {"relations":[{"from":"name","fromType":"person|project|technology|organization|document","to":"name","toType":"...","relation":"uses|works_on|knows|part_of|depends_on"}]}\nMax 6. Empty if nothing explicit.`,
      { system: "You extract knowledge graphs. Output strict JSON only.", maxTokens: 500, temperature: 0, task: "data" });
    const rels = Array.isArray(json.relations) ? json.relations.slice(0, 6) : [];
    for (const r of rels) {
      if (r?.from && r?.to) await addGraphEdge(env, userId, { from: { name: r.from, type: r.fromType }, to: { name: r.to, type: r.toType }, relation: r.relation });
    }
    return rels;
  } catch { return []; }
}

export async function deleteGraph(env, userId) {
  await kvDel(env, graphKey(userId));
  return { nodes: [], edges: [] };
}

// ── Projects / Workspaces ─────────────────────
export async function listProjects(env, userId) {
  const ids = await kvGet(env, PROJ_INDEX(userId), []);
  return readMany(env, ids.map(projKey));
}

export async function getProject(env, id) { return kvGet(env, projKey(id), null); }

export async function createProject(env, userId, input) {
  const p = {
    id: newId("proj"), userId,
    name: String(input.name || "Project").slice(0, 60),
    description: String(input.description || "").slice(0, 300),
    systemPrompt: String(input.systemPrompt || "").slice(0, 2000),
    preferredModelId: input.preferredModelId || null,
    agentIds: input.agentIds || [],
    tags: input.tags || [],
    createdAt: nowIso(), archived: false
  };
  await kvPut(env, projKey(p.id), p);
  await indexAdd(env, PROJ_INDEX(userId), p.id);
  await audit(env, { userId, action: "project.create", resource: p.id, meta: { name: p.name } });
  return p;
}

export async function updateProject(env, id, patch, userId = 0) {
  const p = await getProject(env, id);
  if (!p) throw new Error("پروژه یافت نشد");
  Object.assign(p, patch, { updatedAt: nowIso() });
  await kvPut(env, projKey(id), p);
  return p;
}

export async function deleteProject(env, id, userId = 0) {
  const p = await getProject(env, id);
  if (!p) return false;
  await kvDel(env, projKey(id));
  await indexRemove(env, PROJ_INDEX(p.userId), id);
  const mems = (await kvGet(env, memKey(p.userId), [])).filter(m => m.projectId !== id);
  await kvPut(env, memKey(p.userId), mems);
  await audit(env, { userId, action: "project.delete", resource: id });
  return true;
}

export async function projectContext(env, userId, projectId, query) {
  const p = await getProject(env, projectId);
  if (!p) return "";
  const mems = await searchMemory(env, userId, query || p.name, { projectId, topK: 6 });
  let kb = [];
  if (ctx.ai.kbSearch && query) {
    try { kb = await ctx.ai.kbSearch(env, userId, query, 4); } catch {}
  }
  const parts = [];
  if (p.systemPrompt) parts.push(`Project instructions: ${p.systemPrompt}`);
  if (mems.length) parts.push(`Project memory:\n${mems.map(m => `- ${m.text}`).join("\n")}`);
  if (kb.length) parts.push(`Knowledge base:\n${kb.map(k => `- ${k.text.slice(0, 400)}`).join("\n")}`);
  return parts.join("\n\n");
}

// ── Prompt Lab ────────────────────────────────
const promptLabKey = uid => `promptlab:${uid}`;

export async function optimizePrompt(env, userId, prompt, { variants = 3 } = {}) {
  const { json } = await completeJson(env,
    `Improve this prompt. Produce ${variants} distinct improved variants with different strategies (explicit role+constraints, structured output, chain-of-steps).\n\nOriginal prompt:\n"""${String(prompt).slice(0, 2000)}"""\n\nReturn ONLY JSON: {"analysis":"one short paragraph of weaknesses","variants":[{"label":"strategy name","prompt":"full improved prompt"}]}`,
    { system: "You are a prompt engineer. Output strict JSON only.", maxTokens: 1600, temperature: 0.4, task: "writing" });
  const record = {
    id: newId("pl"), original: prompt, analysis: json.analysis || "",
    variants: (json.variants || []).slice(0, variants), ts: nowIso(), tests: []
  };
  const rows = await kvGet(env, promptLabKey(userId), []);
  rows.unshift(record);
  await kvPut(env, promptLabKey(userId), rows.slice(0, 30));
  return record;
}

// A/B تست واقعی: هر واریانت روی مدلهای مشخص اجرا و امتیازدهی میشود
export async function abTestPrompt(env, userId, { promptId, variants, modelIds = [], testInput = "", judge = true }) {
  const rows = await kvGet(env, promptLabKey(userId), []);
  const record = promptId ? rows.find(r => r.id === promptId) : null;
  const list = (variants || record?.variants || []).slice(0, 4);
  if (!list.length) throw new Error("واریانتی برای تست نیست");
  const { route } = await import("../gateway/router.js");
  const results = [];
  for (const v of list) {
    const p = typeof v === "string" ? v : v.prompt;
    const label = typeof v === "string" ? "variant" : (v.label || "variant");
    for (const modelId of modelIds.length ? modelIds : [null]) {
      try {
        const res = await route(env, [
          { role: "system", content: p },
          { role: "user", content: testInput || "Proceed with the task described above." }
        ], { modelId: modelId || undefined, maxTokens: 800, text: testInput, userId });
        results.push({ label, prompt: p.slice(0, 400), model: res.model, output: res.text.slice(0, 1500), latency: res.latency, tokens: res.completionTokens, cost: res.cost });
      } catch (e) {
        results.push({ label, prompt: p.slice(0, 400), model: modelId, error: String(e.message || e).slice(0, 200) });
      }
    }
  }
  let ranking = null;
  if (judge && results.filter(r => !r.error).length > 1) {
    try {
      const { json } = await completeJson(env,
        `Score each candidate output for instruction-following, usefulness and clarity (0-100). Be strict.\n\n${results.filter(r => !r.error).map((r, i) => `#${i + 1} [${r.label}]\n${r.output.slice(0, 900)}`).join("\n\n---\n\n")}\n\nReturn ONLY JSON: {"scores":[{"index":1,"score":0,"reason":"short"}],"best":1}`,
        { system: "You are an impartial evaluator. Output strict JSON only.", maxTokens: 700, temperature: 0, task: "reasoning" });
      ranking = json;
      const ok = results.filter(r => !r.error);
      for (const s of json.scores || []) if (ok[s.index - 1]) ok[s.index - 1].score = s.score;
    } catch {}
  }
  if (record) {
    record.tests.unshift({ ts: nowIso(), results, ranking });
    record.tests = record.tests.slice(0, 5);
    await kvPut(env, promptLabKey(userId), rows);
  }
  const best = results.filter(r => !r.error).sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
  return { results, ranking, best };
}

export async function listPromptLab(env, userId) { return kvGet(env, promptLabKey(userId), []); }

// ─────────────────────────────────────────────
// Phase 17: Prompt Versioning & Advanced Prompt Lab
// ─────────────────────────────────────────────

/**
 * Create new prompt version
 */
export async function createPromptVersion(env, promptId, version, userId = 0) {
  const promptKey = `prompt:${promptId}`;
  const prompt = await kvGet(env, promptKey, null);
  
  if (!prompt) {
    // Create new prompt with v1
    const newPrompt = {
      id: promptId,
      userId,
      name: version.name || "Untitled Prompt",
      description: version.description || "",
      currentVersion: "v1",
      versions: {
        v1: {
          version: "v1",
          content: version.content,
          systemPrompt: version.systemPrompt,
          parameters: version.parameters || { temperature: 0.7, maxTokens: 1000 },
          modelId: version.modelId || null,
          tags: version.tags || [],
          createdAt: nowIso(),
          createdBy: userId,
          status: "active"
        }
      },
      versionHistory: ["v1"],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    
    await kvPut(env, promptKey, newPrompt);
    await indexAdd(env, "prompts:index", promptId);
    
    return newPrompt.versions.v1;
  }
  
  // Add new version to existing prompt
  const versionNum = prompt.versionHistory.length + 1;
  const versionId = `v${versionNum}`;
  
  prompt.versions[versionId] = {
    version: versionId,
    content: version.content,
    systemPrompt: version.systemPrompt,
    parameters: version.parameters || prompt.versions[prompt.currentVersion].parameters,
    modelId: version.modelId || prompt.versions[prompt.currentVersion].modelId,
    tags: version.tags || [],
    parentVersion: version.parentVersion || prompt.currentVersion,
    changeLog: version.changeLog || "",
    createdAt: nowIso(),
    createdBy: userId,
    status: "active"
  };
  
  prompt.versionHistory.push(versionId);
  prompt.currentVersion = versionId;
  prompt.updatedAt = nowIso();
  
  await kvPut(env, promptKey, prompt);
  
  await audit(env, {
    userId,
    action: "prompt.version.create",
    resource: promptId,
    meta: { version: versionId, name: prompt.name }
  });
  
  return prompt.versions[versionId];
}

/**
 * Get specific prompt version
 */
export async function getPromptVersion(env, promptId, version = null) {
  const promptKey = `prompt:${promptId}`;
  const prompt = await kvGet(env, promptKey, null);
  
  if (!prompt) return null;
  
  const versionId = version || prompt.currentVersion;
  return prompt.versions[versionId] || null;
}

/**
 * List all versions of a prompt
 */
export async function listPromptVersions(env, promptId) {
  const promptKey = `prompt:${promptId}`;
  const prompt = await kvGet(env, promptKey, null);
  
  if (!prompt) return [];
  
  return prompt.versionHistory.map(v => ({
    version: v,
    ...prompt.versions[v],
    isCurrent: v === prompt.currentVersion
  }));
}

/**
 * Rollback to previous version
 */
export async function rollbackPromptVersion(env, promptId, targetVersion, userId = 0) {
  const promptKey = `prompt:${promptId}`;
  const prompt = await kvGet(env, promptKey, null);
  
  if (!prompt) throw new Error("Prompt not found");
  if (!prompt.versions[targetVersion]) throw new Error("Version not found");
  
  const previousCurrent = prompt.currentVersion;
  prompt.currentVersion = targetVersion;
  prompt.updatedAt = nowIso();
  
  await kvPut(env, promptKey, prompt);
  
  await audit(env, {
    userId,
    action: "prompt.version.rollback",
    resource: promptId,
    meta: { from: previousCurrent, to: targetVersion }
  });
  
  return prompt.versions[targetVersion];
}

/**
 * Compare two prompt versions
 */
export async function comparePromptVersions(env, promptId, version1, version2) {
  const promptKey = `prompt:${promptId}`;
  const prompt = await kvGet(env, promptKey, null);
  
  if (!prompt) throw new Error("Prompt not found");
  
  const v1 = prompt.versions[version1];
  const v2 = prompt.versions[version2];
  
  if (!v1 || !v2) throw new Error("Version not found");
  
  return {
    version1: { version: version1, ...v1 },
    version2: { version: version2, ...v2 },
    differences: {
      content: v1.content !== v2.content,
      systemPrompt: v1.systemPrompt !== v2.systemPrompt,
      parameters: JSON.stringify(v1.parameters) !== JSON.stringify(v2.parameters),
      modelId: v1.modelId !== v2.modelId
    }
  };
}

/**
 * Run A/B test on prompt versions
 */
export async function runPromptABTest(env, promptId, versions, testCases, options = {}) {
  const promptKey = `prompt:${promptId}`;
  const prompt = await kvGet(env, promptKey, null);
  
  if (!prompt) throw new Error("Prompt not found");
  
  const results = {
    promptId,
    promptName: prompt.name,
    versions,
    testCases: testCases.length,
    results: {},
    winner: null,
    startedAt: nowIso()
  };
  
  // Test each version
  for (const versionId of versions) {
    const version = prompt.versions[versionId];
    if (!version) continue;
    
    const versionResults = [];
    
    for (const testCase of testCases) {
      const { route } = await import("../gateway/router.js");
      
      const messages = [
        ...(version.systemPrompt ? [{ role: "system", content: version.systemPrompt }] : []),
        { role: "user", content: testCase.input }
      ];
      
      try {
        const startTime = Date.now();
        const response = await route(env, messages, {
          modelId: version.modelId,
          ...version.parameters,
          userId: options.userId
        });
        
        versionResults.push({
          testCase: testCase.input,
          output: response.text,
          success: true,
          latency: response.latency || (Date.now() - startTime),
          tokens: (response.promptTokens || 0) + (response.completionTokens || 0),
          cost: response.cost || 0
        });
      } catch (e) {
        versionResults.push({
          testCase: testCase.input,
          output: null,
          success: false,
          error: e.message
        });
      }
    }
    
    results.results[versionId] = {
      version: versionId,
      successes: versionResults.filter(r => r.success).length,
      failures: versionResults.filter(r => !r.success).length,
      avgLatency: versionResults.filter(r => r.success).reduce((sum, r) => sum + r.latency, 0) / versionResults.filter(r => r.success).length || 0,
      avgTokens: versionResults.filter(r => r.success).reduce((sum, r) => sum + r.tokens, 0) / versionResults.filter(r => r.success).length || 0,
      totalCost: versionResults.reduce((sum, r) => sum + (r.cost || 0), 0),
      results: versionResults
    };
  }
  
  // Determine winner (highest success rate, then lowest latency)
  const versionsArray = Object.entries(results.results).map(([v, r]) => ({ version: v, ...r }));
  versionsArray.sort((a, b) => {
    const successRateA = a.successes / testCases.length;
    const successRateB = b.successes / testCases.length;
    if (successRateA !== successRateB) return successRateB - successRateA;
    return a.avgLatency - b.avgLatency;
  });
  
  results.winner = versionsArray[0]?.version || null;
  results.finishedAt = nowIso();
  
  return results;
}

/**
 * Model-specific prompt optimization
 */
export async function optimizePromptForModel(env, promptId, modelId, userId = 0) {
  const promptKey = `prompt:${promptId}`;
  const prompt = await kvGet(env, promptKey, null);
  
  if (!prompt) throw new Error("Prompt not found");
  
  const { getModel } = await import("../gateway/models.js");
  const model = await getModel(env, modelId);
  
  if (!model) throw new Error("Model not found");
  
  const currentVersion = prompt.versions[prompt.currentVersion];
  
  // Get model capabilities and optimize prompt accordingly
  const optimization = {
    originalContent: currentVersion.content,
    optimizedContent: currentVersion.content,
    changes: [],
    modelCapabilities: model.capabilities || []
  };
  
  // If model supports structured output, add JSON formatting hints
  if (model.capabilities?.includes("json_mode") || model.capabilities?.includes("structured_output")) {
    if (!currentVersion.content.toLowerCase().includes("json")) {
      optimization.optimizedContent += "\n\nRespond in valid JSON format.";
      optimization.changes.push("Added JSON formatting instruction");
    }
  }
  
  // If model supports tools, mention tool usage
  if (model.capabilities?.includes("function_calling") || model.capabilities?.includes("tool_use")) {
    if (currentVersion.content.toLowerCase().includes("use") || currentVersion.content.toLowerCase().includes("tool")) {
      optimization.changes.push("Model supports tools - no changes needed");
    }
  }
  
  // Adjust max tokens based on model context window
  if (model.contextWindow) {
    const suggestedMaxTokens = Math.min(model.contextWindow * 0.6, 4000);
    if (!currentVersion.parameters.maxTokens || currentVersion.parameters.maxTokens > suggestedMaxTokens) {
      optimization.changes.push(`Adjusted maxTokens to ${suggestedMaxTokens} based on context window`);
    }
  }
  
  // Create optimized version if changes were made
  if (optimization.changes.length > 0) {
    const newVersion = await createPromptVersion(env, promptId, {
      content: optimization.optimizedContent,
      systemPrompt: currentVersion.systemPrompt,
      parameters: {
        ...currentVersion.parameters,
        maxTokens: Math.min(model.contextWindow * 0.6, currentVersion.parameters.maxTokens || 1000)
      },
      modelId,
      changeLog: `Optimized for ${model.displayName || model.apiModelId}: ${optimization.changes.join(", ")}`,
      tags: [...(currentVersion.tags || []), `optimized-for-${modelId}`]
    }, userId);
    
    optimization.newVersion = newVersion.version;
  }
  
  return optimization;
}

/**
 * Test prompt with evaluation dataset
 */
export async function testPromptWithEval(env, promptId, versionId, datasetId, userId = 0) {
  const prompt = await getPromptVersion(env, promptId, versionId);
  if (!prompt) throw new Error("Prompt version not found");
  
  const { runEvaluation } = await import("../ops/evaluation.js");
  
  const run = await runEvaluation(env, datasetId, {
    type: "prompt",
    promptId,
    versionId,
    prompt: prompt.content,
    systemPrompt: prompt.systemPrompt,
    parameters: prompt.parameters,
    modelId: prompt.modelId
  }, { userId });
  
  return run;
}
