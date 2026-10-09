import { pxText, pxTemplate } from '../i18n/server.js';
// ─────────────────────────────────────────────
// 🧰 Tool Registry — ابزارهای قابلکشف برای عاملها (+ آمادگی MCP)
// ─────────────────────────────────────────────
import { kvGet, kvPut, nowIso, newId } from "../core/kv.js";
import { ctx } from "../core/ctx.js";
import { httpJson } from "../gateway/client.js";
import { listModels } from "../gateway/models.js";

const registry = new Map();

// Tool risk levels for security classification
export const TOOL_RISK_LEVELS = {
  safe: "safe",           // No side effects, read-only, no external calls
  low: "low",             // Read-only external calls, minimal risk
  medium: "medium",       // Can make external requests, moderate risk
  high: "high",           // Can modify data or execute code
  critical: "critical"    // Can execute arbitrary code or access secrets
};

// Security policy for each risk level
export const RISK_POLICIES = {
  safe: {
    requiresAuth: false,
    requiresApproval: false,
    auditLog: false,
    maxExecutionsPerMinute: 100,
    description: "No side effects, completely safe"
  },
  low: {
    requiresAuth: true,
    requiresApproval: false,
    auditLog: true,
    maxExecutionsPerMinute: 60,
    description: "Read-only operations, minimal risk"
  },
  medium: {
    requiresAuth: true,
    requiresApproval: false,
    auditLog: true,
    maxExecutionsPerMinute: 30,
    description: "External requests, moderate risk"
  },
  high: {
    requiresAuth: true,
    requiresApproval: true,
    auditLog: true,
    maxExecutionsPerMinute: 10,
    description: "Data modification or code execution"
  },
  critical: {
    requiresAuth: true,
    requiresApproval: true,
    auditLog: true,
    maxExecutionsPerMinute: 5,
    description: "System-level operations, highest risk"
  }
};

export function registerTool(def) {
  if (!def?.name || typeof def.run !== "function") throw new Error(pxText("tool نامعتبر"));
  
  // Assign risk level (default to medium if not specified)
  const riskLevel = def.riskLevel || (def.dangerous ? "high" : "medium");
  if (!TOOL_RISK_LEVELS[riskLevel]) {
    throw new Error(`Invalid risk level: ${riskLevel}`);
  }
  
  const policy = RISK_POLICIES[riskLevel];
  
  registry.set(def.name, {
    name: def.name,
    description: def.description || "",
    input: def.input || { type: "object", properties: {} },
    output: def.output || { type: "object" },
    permissions: def.permissions || ["read"],
    riskLevel,
    dangerous: policy.requiresApproval, // Backward compatibility
    requiresAuth: policy.requiresAuth,
    requiresApproval: policy.requiresApproval,
    auditLog: policy.auditLog,
    maxExecutionsPerMinute: def.maxExecutionsPerMinute || policy.maxExecutionsPerMinute,
    timeout: def.timeout || 25000,
    enabled: def.enabled !== false,
    source: def.source || "builtin",
    // Security metadata
    security: {
      canReadFiles: def.security?.canReadFiles || false,
      canWriteFiles: def.security?.canWriteFiles || false,
      canExecuteCode: def.security?.canExecuteCode || false,
      canAccessNetwork: def.security?.canAccessNetwork || false,
      canAccessDatabase: def.security?.canAccessDatabase || false,
      canAccessSecrets: def.security?.canAccessSecrets || false,
      dataExfiltrationRisk: def.security?.dataExfiltrationRisk || (riskLevel === "high" || riskLevel === "critical"),
      inputValidation: def.security?.inputValidation || "basic",
      outputSanitization: def.security?.outputSanitization || "basic"
    },
    run: def.run
  });
  return registry.get(def.name);
}

export function getTool(name) { return registry.get(name); }

export function listTools({ includeDangerous = true } = {}) {
  return [...registry.values()]
    .filter(t => t.enabled && (includeDangerous || !t.dangerous))
    .map(({ run, ...rest }) => rest);
}

export function toolSchemas({ includeDangerous = false, only = null } = {}) {
  return listTools({ includeDangerous })
    .filter(t => !only || only.includes(t.name))
    .map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input } }));
}

export async function runTool(env, name, args = {}, meta = {}) {
  const tool = registry.get(name);
  if (!tool) return { ok: false, error: pxTemplate`ابزار ${name} وجود ندارد` };
  if (!tool.enabled) return { ok: false, error: pxTemplate`ابزار ${name} غیرفعال است` };
  
  // Rate limiting check
  const rateLimitKey = `tool:ratelimit:${name}:${meta.userId || 0}`;
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const rateLimitData = await kvGet(env, rateLimitKey, { minute: 0, count: 0 });
  
  if (rateLimitData.minute === minute) {
    if (rateLimitData.count >= tool.maxExecutionsPerMinute) {
      return {
        ok: false,
        error: `Rate limit exceeded: ${tool.maxExecutionsPerMinute} executions per minute`,
        rateLimit: true
      };
    }
  }
  
  // Update rate limit counter
  const newRateLimitData = rateLimitData.minute === minute
    ? { minute, count: rateLimitData.count + 1 }
    : { minute, count: 1 };
  await kvPut(env, rateLimitKey, newRateLimitData, { expirationTtl: 120 });
  
  // Authentication check
  if (tool.requiresAuth && !meta.userId) {
    return {
      ok: false,
      error: `Tool ${name} requires authentication`,
      requiresAuth: true
    };
  }
  
  // Check approval for high-risk tools
  if (tool.requiresApproval && !meta.confirmed && !meta.approvalGranted) {
    const { checkPermission } = await import("../core/approval.js");
    
    const operation = {
      type: "AGENT_TOOL_DANGEROUS",
      user: {
        id: meta.userId || 0,
        name: meta.userName || "Unknown",
        role: meta.userRole || "user"
      },
      details: {
        tool: name,
        riskLevel: tool.riskLevel,
        args: JSON.stringify(args).slice(0, 500),
        description: tool.description
      },
      context: {
        agentId: meta.agentId,
        runId: meta.runId,
        security: tool.security
      },
      metadata: {
        toolPermissions: tool.permissions,
        canExecuteCode: tool.security.canExecuteCode,
        canAccessNetwork: tool.security.canAccessNetwork,
        canAccessDatabase: tool.security.canAccessDatabase
      }
    };
    
    const permission = await checkPermission(env, operation);
    
    if (!permission.allowed && permission.requiresApproval) {
      return {
        ok: false,
        needsApproval: true,
        approvalRequestId: permission.approvalRequestId,
        error: `Tool ${name} requires approval (${tool.riskLevel} risk)`,
        request: permission.request,
        riskLevel: tool.riskLevel
      };
    }
  }
  
  // Input validation
  if (tool.security.inputValidation === "strict") {
    const validationResult = validateToolInput(tool, args);
    if (!validationResult.valid) {
      return {
        ok: false,
        error: `Input validation failed: ${validationResult.error}`,
        validationError: true
      };
    }
  }
  
  const t0 = Date.now();
  let result;
  
  try {
    result = await Promise.race([
      tool.run({ env, args, meta, ctx }),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${tool.timeout}ms`)), tool.timeout))
    ]);
    
    // Output sanitization for high-risk tools
    if (tool.security.outputSanitization === "strict" && result) {
      result = sanitizeToolOutput(result, tool);
    }
    
  } catch (e) {
    const error = String(e.message || e).slice(0, 300);
    
    // Audit log for failures on critical tools
    if (tool.auditLog && tool.riskLevel === "critical") {
      const { audit } = await import("../core/audit.js");
      await audit(env, {
        userId: meta.userId || 0,
        action: "tool.execute.fail",
        resource: name,
        result: "fail",
        meta: {
          riskLevel: tool.riskLevel,
          error: error,
          args: JSON.stringify(args).slice(0, 200)
        }
      });
    }
    
    return { ok: false, tool: name, ms: Date.now() - t0, error, riskLevel: tool.riskLevel };
  }
  
  const ms = Date.now() - t0;
  
  // Audit log for successful high-risk operations
  if (tool.auditLog && (tool.riskLevel === "high" || tool.riskLevel === "critical")) {
    const { audit } = await import("../core/audit.js");
    await audit(env, {
      userId: meta.userId || 0,
      action: "tool.execute",
      resource: name,
      result: "success",
      meta: {
        riskLevel: tool.riskLevel,
        executionTime: ms,
        args: JSON.stringify(args).slice(0, 200)
      }
    });
  }
  
  return { ok: true, tool: name, ms, result, riskLevel: tool.riskLevel };
}

// Input validation helper
function validateToolInput(tool, args) {
  // Check required fields
  const required = tool.input.required || [];
  for (const field of required) {
    if (args[field] === undefined || args[field] === null) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  
  // Check for suspicious patterns in string inputs
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") {
      // Check for script injection attempts
      if (/<script|javascript:|onerror=/i.test(value)) {
        return { valid: false, error: `Suspicious pattern detected in ${key}` };
      }
      
      // Check for SQL injection attempts in database tools
      if (tool.security.canAccessDatabase && /(\b(union|select|insert|update|delete|drop|exec|execute)\b.*\b(from|into|table|database)\b)/i.test(value)) {
        return { valid: false, error: `Suspicious SQL pattern detected in ${key}` };
      }
    }
  }
  
  return { valid: true };
}

// Output sanitization helper
function sanitizeToolOutput(output, tool) {
  if (!output || typeof output !== "object") return output;
  
  const sanitized = { ...output };
  
  // Remove potential secrets from output
  const secretPatterns = [
    /sk-[A-Za-z0-9]{16,}/g,
    /nvapi-[A-Za-z0-9_-]{16,}/g,
    /AIza[0-9A-Za-z_-]{30,}/g,
    /ghp_[A-Za-z0-9]{20,}/g,
    /[A-Za-z0-9]{32,}/g // Generic long alphanumeric strings
  ];
  
  function redactSecrets(obj) {
    if (typeof obj === "string") {
      let redacted = obj;
      for (const pattern of secretPatterns) {
        redacted = redacted.replace(pattern, "[REDACTED]");
      }
      return redacted;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => redactSecrets(item));
    }
    
    if (obj && typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        // Always redact fields that might contain secrets
        if (/api[-_]?key|secret|token|password|credential/i.test(key)) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = redactSecrets(value);
        }
      }
      return result;
    }
    
    return obj;
  }
  
  return redactSecrets(sanitized);
}

// ─────────────────────────────────────────────
// ابزارهای پایه
// ─────────────────────────────────────────────
registerTool({
  name: "web_search",
  get description(){return pxText("جستجوی وب و بازگرداندن نتایج با عنوان، لینک و خلاصه")},
  input: { type: "object", properties: { query: { type: "string" }, max: { type: "number" } }, required: ["query"] },
  riskLevel: "low",
  security: {
    canAccessNetwork: true,
    inputValidation: "basic",
    outputSanitization: "basic"
  },
  run: async ({ args }) => {
    if (!ctx.ai.webSearch) throw new Error(pxText("web search در دسترس نیست"));
    const hits = await ctx.ai.webSearch(args.query, Math.min(10, args.max || 6));
    return { results: hits.map(h => ({ title: h.title, url: h.uri, snippet: h.snippet })) };
  }
});

registerTool({
  name: "ai_council",
  description: "Ask multiple AI models (Council) and synthesize a final answer. Use for hard, high-stakes, or multi-perspective questions.",
  input: {
    type: "object",
    properties: {
      question: { type: "string" },
      count: { type: "number" },
      mode: { type: "string", description: "independent|debate|panel|judge|iterative" },
      rounds: { type: "number" }
    },
    required: ["question"]
  },
  timeout: 120000,
  riskLevel: "medium",
  security: {
    canAccessNetwork: true,
    inputValidation: "basic",
    outputSanitization: "basic"
  },
  run: async ({ env, args, meta }) => {
    const { runCouncil } = await import("../gateway/council.js");
    const run = await runCouncil(env, {
      question: args.question,
      count: Math.max(2, Math.min(12, Number(args.count) || 3)),
      mode: args.mode || "judge",
      rounds: args.rounds,
      userId: meta?.userId || 0
    });
    return {
      final: run.synthesis?.final,
      confidence: run.synthesis?.confidence,
      agreement: run.synthesis?.agreement,
      winner: run.synthesis?.winner,
      models: (run.answers || []).map(a => ({ name: a.displayName, ok: a.ok, error: a.error || null })),
      cost: run.totals?.cost,
      runId: run.id
    };
  }
});

registerTool({
  name: "fetch_page",
  get description(){return pxText("دریافت محتوای متنی یک صفحه وب از طریق URL")},
  input: { type: "object", properties: { url: { type: "string" }, maxChars: { type: "number" } }, required: ["url"] },
  timeout: 20000,
  riskLevel: "medium",
  security: {
    canAccessNetwork: true,
    dataExfiltrationRisk: true,
    inputValidation: "strict",
    outputSanitization: "basic"
  },
  run: async ({ args }) => {
    const u = new URL(args.url);
    if (!/^https?:$/.test(u.protocol)) throw new Error(pxText("فقط http/https"));
    // Block localhost and private IPs to prevent SSRF
    if (/^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1|fc00:)/i.test(u.hostname)) {
      throw new Error("Cannot access private/localhost addresses");
    }
    const res = await fetch(u.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; PIMXAGENT/1.0)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ").trim();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || u.hostname;
    return { url: u.toString(), title, text: text.slice(0, Math.min(20000, args.maxChars || 8000)), length: text.length };
  }
});

function evalExpression(src) {
  const s = String(src).replace(/\s+/g, "");
  let i = 0;
  function peek() { return s[i]; }
  function eat(ch) { if (s[i] === ch) { i++; return true; } return false; }
  function parseNumber() {
    const start = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (start === i) throw new Error(pxText("عبارت نامعتبر"));
    const v = Number(s.slice(start, i));
    if (!isFinite(v)) throw new Error(pxText("عبارت نامعتبر"));
    return v;
  }
  function parsePrimary() {
    if (eat("(")) {
      const v = parseAddSub();
      if (!eat(")")) throw new Error(pxText("پرانتز بسته نشده"));
      return v;
    }
    if (eat("-")) return -parsePrimary();
    if (eat("+")) return parsePrimary();
    return parseNumber();
  }
  function parsePower() {
    const base = parsePrimary();
    if (s[i] === "*" && s[i + 1] === "*") {
      i += 2;
      return Math.pow(base, parsePower());
    }
    if (s[i] === "^") { i++; return Math.pow(base, parsePower()); }
    return base;
  }
  function parseMulDiv() {
    let v = parsePower();
    for (;;) {
      if (s[i] === "*" && s[i + 1] === "*") break;
      const op = peek();
      if (op === "*" || op === "/" || op === "%") {
        i++;
        const r = parsePower();
        if ((op === "/" || op === "%") && r === 0) throw new Error(pxText("تقسیم بر صفر"));
        v = op === "*" ? v * r : op === "/" ? v / r : v % r;
      } else break;
    }
    return v;
  }
  function parseAddSub() {
    let v = parseMulDiv();
    for (;;) {
      const op = peek();
      if (op === "+" || op === "-") {
        i++;
        const r = parseMulDiv();
        v = op === "+" ? v + r : v - r;
      } else break;
    }
    return v;
  }
  const out = parseAddSub();
  if (i !== s.length) throw new Error(pxText("عبارت نامعتبر"));
  return out;
}

registerTool({
  name: "calculator",
  get description(){return pxText("محاسبه یک عبارت ریاضی امن")},
  input: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] },
  riskLevel: "safe",
  security: {
    inputValidation: "strict",
    outputSanitization: "basic"
  },
  run: async ({ args }) => {
    const expr = String(args.expression || "").replace(/[^0-9+\-*/().%,\s^]/g, "");
    if (!expr.trim()) throw new Error(pxText("عبارت نامعتبر"));
    if (expr.length > 200) throw new Error("Expression too long");
    const val = evalExpression(expr.replace(/,/g, ""));
    if (typeof val !== "number" || !isFinite(val)) throw new Error(pxText("نتیجه نامعتبر"));
    return { expression: expr, value: val };
  }
});

registerTool({
  name: "http_request",
  get description(){return pxText("ارسال درخواست HTTP فقط-خواندنی (GET) به یک API عمومی")},
  input: { type: "object", properties: { url: { type: "string" }, headers: { type: "object" } }, required: ["url"] },
  riskLevel: "high",
  security: {
    canAccessNetwork: true,
    dataExfiltrationRisk: true,
    inputValidation: "strict",
    outputSanitization: "strict"
  },
  run: async ({ args }) => {
    // Validate URL to prevent SSRF
    const u = new URL(args.url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("Only http/https allowed");
    if (/^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1|fc00:)/i.test(u.hostname)) {
      throw new Error("Cannot access private/localhost addresses");
    }
    const r = await httpJson(args.url, { headers: args.headers || {}, timeout: 15000 });
    return { status: r.status, ok: r.ok, body: r.json ?? r.text?.slice(0, 4000) };
  }
});

registerTool({
  name: "list_models",
  get description(){return pxText("لیست مدلهای رجیستری با فیلتر وضعیت/قابلیت — دادهی واقعی")},
  input: { type: "object", properties: { status: { type: "string" }, capability: { type: "string" }, providerId: { type: "string" }, q: { type: "string" } } },
  riskLevel: "safe",
  security: {
    inputValidation: "basic",
    outputSanitization: "basic"
  },
  run: async ({ env, args }) => {
    const rows = await listModels(env, args || {});
    return {
      count: rows.length,
      models: rows.slice(0, 40).map(m => ({
        id: m.id, name: m.displayName, api: m.apiModelId, provider: m.providerName,
        status: m.status, latency: m.latency, errorRate: m.errorRate,
        pricing: m.pricing, context: m.contextWindow,
        capabilities: Object.entries(m.capabilities || {}).filter(([, v]) => v.supported).map(([k]) => k)
      }))
    };
  }
});

registerTool({
  name: "memory_search",
  get description(){return pxText("جستجو در حافظه بلندمدت و پایگاه دانش کاربر")},
  input: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  riskLevel: "low",
  security: {
    inputValidation: "basic",
    outputSanitization: "basic"
  },
  run: async ({ env, args, meta }) => {
    if (!ctx.ai.kbSearch) return { results: [] };
    const hits = await ctx.ai.kbSearch(env, meta.userId, args.query, 5);
    return { results: hits.map(h => ({ doc: h.docName, text: h.text.slice(0, 600), score: h.score })) };
  }
});

registerTool({
  name: "code_analysis",
  get description(){return pxText("تحلیل ایستا و امنیتی قطعه کد (secret، injection، الگوهای ناامن)")},
  input: { type: "object", properties: { code: { type: "string" }, language: { type: "string" } }, required: ["code"] },
  riskLevel: "low",
  security: {
    inputValidation: "basic",
    outputSanitization: "basic"
  },
  run: async ({ args }) => {
    const code = String(args.code || "");
    if (code.length > 50000) throw new Error("Code too large (max 50KB)");
    const findings = [];
    const rules = [
      { id: "secret", re: /(sk-[A-Za-z0-9]{16,}|nvapi-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{20,})/g, sev: "critical", msg: pxText("کلید/توکن hard-coded") },
      { id: "sqli", re: /(query|execute)\s*\(\s*[`"'][^`"']*\$\{|\+\s*req\.(body|query|params)/g, sev: "high", msg: pxText("احتمال SQL Injection (کوئری الحاقی)") },
      { id: "xss", re: /innerHTML\s*=|document\.write\(|dangerouslySetInnerHTML/g, sev: "high", msg: pxText("احتمال XSS") },
      { id: "eval", re: /\beval\s*\(|new\s+Function\s*\(/g, sev: "high", msg: pxText("اجرای کد داینامیک") },
      { id: "ssrf", re: /fetch\(\s*(req|request)\.(body|query|params)/g, sev: "high", msg: pxText("احتمال SSRF") },
      { id: "weakhash", re: /createHash\(\s*['"](md5|sha1)['"]/g, sev: "medium", msg: pxText("هش ضعیف") },
      { id: "cors", re: /Access-Control-Allow-Origin['"]\s*[:,]\s*['"]\*/g, sev: "medium", msg: pxText("CORS بازِ کامل") },
      { id: "http", re: /http:\/\/(?!localhost|127\.)/g, sev: "low", msg: pxText("ارتباط بدون TLS") }
    ];
    for (const r of rules) {
      const matches = code.match(r.re);
      if (matches) findings.push({ rule: r.id, severity: r.sev, message: r.msg, count: matches.length });
    }
    return {
      language: args.language || "auto",
      lines: code.split("\n").length,
      findings,
      risk: findings.some(f => f.severity === "critical") ? "critical"
        : findings.some(f => f.severity === "high") ? "high"
          : findings.length ? "medium" : "low"
    };
  }
});

registerTool({
  name: "data_analyze",
  get description(){return pxText("تحلیل آماری داده CSV/JSON: میانگین، میانه، انحراف معیار، ناهنجاری")},
  input: { type: "object", properties: { data: { type: "string" }, format: { type: "string" } }, required: ["data"] },
  riskLevel: "safe",
  security: {
    inputValidation: "basic",
    outputSanitization: "basic"
  },
  run: async ({ args }) => {
    const rows = parseTabular(args.data, args.format);
    if (!rows.length) throw new Error(pxText("داده قابل تجزیه نبود"));
    if (rows.length > 10000) throw new Error("Too many rows (max 10,000)");
    const cols = Object.keys(rows[0]);
    const stats = {};
    for (const c of cols) {
      const nums = rows.map(r => Number(String(r[c]).replace(/[,\s]/g, ""))).filter(n => isFinite(n));
      if (nums.length < Math.max(2, rows.length * 0.6)) { stats[c] = { type: "text", unique: new Set(rows.map(r => r[c])).size }; continue; }
      const sorted = [...nums].sort((a, b) => a - b);
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const sd = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
      const outliers = nums.filter(n => sd > 0 && Math.abs(n - mean) > 3 * sd);
      stats[c] = {
        type: "number", count: nums.length, min: sorted[0], max: sorted[sorted.length - 1],
        mean: round(mean), median: round(sorted[Math.floor(sorted.length / 2)]), sd: round(sd), outliers: outliers.length
      };
    }
    return { rows: rows.length, columns: cols, stats, sample: rows.slice(0, 5) };
  }
});

function round(n) { return Math.round(n * 10000) / 10000; }

export function parseTabular(text, format) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  if (format === "json" || /^[[{]/.test(raw)) {
    try {
      const j = JSON.parse(raw);
      const arr = Array.isArray(j) ? j : (j.data || j.rows || j.items || []);
      return arr.filter(x => x && typeof x === "object");
    } catch {}
  }
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const delim = (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length ? "\t" : (lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",");
  const head = splitCsv(lines[0], delim);
  return lines.slice(1).map(l => {
    const cells = splitCsv(l, delim);
    const o = {};
    head.forEach((h, i) => { o[h || `col${i}`] = cells[i] ?? ""; });
    return o;
  });
}

function splitCsv(line, delim) {
  const out = []; let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === delim && !q) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

registerTool({
  name: "github_repo",
  get description(){return pxText("تحلیل یک ریپوی GitHub عمومی: metadata، زبانها، فایلها، README")},
  input: { type: "object", properties: { repo: { type: "string", description: "owner/name" }, path: { type: "string" } }, required: ["repo"] },
  riskLevel: "low",
  security: {
    canAccessNetwork: true,
    inputValidation: "strict",
    outputSanitization: "basic"
  },
  run: async ({ env, args }) => {
    const repo = String(args.repo).replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
    // Validate repo format
    if (!/^[\w-]+\/[\w.-]+$/.test(repo)) throw new Error("Invalid repo format");
    const headers = { "User-Agent": "PIMXAGENT", Accept: "application/vnd.github+json" };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const info = await httpJson(`https://api.github.com/repos/${repo}`, { headers, timeout: 15000 });
    if (!info.ok) throw new Error(`GitHub HTTP ${info.status}`);
    const langs = await httpJson(`https://api.github.com/repos/${repo}/languages`, { headers, timeout: 12000 });
    const tree = await httpJson(`https://api.github.com/repos/${repo}/contents/${args.path || ""}`, { headers, timeout: 12000 });
    return {
      repo, stars: info.json.stargazers_count, forks: info.json.forks_count, issues: info.json.open_issues_count,
      description: info.json.description, license: info.json.license?.spdx_id, pushedAt: info.json.pushed_at,
      languages: langs.json || {},
      files: Array.isArray(tree.json) ? tree.json.slice(0, 60).map(f => ({ name: f.name, type: f.type, size: f.size })) : []
    };
  }
});

registerTool({
  name: "d1_query",
  get description(){return pxText("اجرای کوئری فقط-خواندنی SELECT روی دیتابیس D1 (اگر متصل باشد)")},
  input: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
  riskLevel: "high",
  security: {
    canAccessDatabase: true,
    dataExfiltrationRisk: true,
    inputValidation: "strict",
    outputSanitization: "strict"
  },
  run: async ({ env, args }) => {
    if (!env.DB) throw new Error(pxText("دیتابیس D1 متصل نیست (binding DB)"));
    const sql = String(args.sql || "").trim();
    // Strict validation: only SELECT, no multiple statements, no comments
    if (!/^select\b/i.test(sql)) throw new Error("Only SELECT queries allowed");
    if (/;\s*\S/.test(sql)) throw new Error("Multiple statements not allowed");
    if (/--|\*\/|\/\*/.test(sql)) throw new Error("Comments not allowed");
    if (/\b(exec|execute|call|create|drop|alter|insert|update|delete|truncate|replace)\b/i.test(sql)) {
      throw new Error("Only SELECT queries allowed");
    }
    const res = await env.DB.prepare(sql).all();
    return { rows: res.results?.slice(0, 100) || [], count: res.results?.length || 0 };
  }
});

registerTool({
  name: "provider_diagnose",
  get description(){return pxText("اجرای API Doctor روی یک Base URL و کلید برای عیبیابی")},
  input: { type: "object", properties: { baseUrl: { type: "string" }, apiKey: { type: "string" }, format: { type: "string" } }, required: ["baseUrl"] },
  riskLevel: "medium",
  security: {
    canAccessNetwork: true,
    canAccessSecrets: true,
    inputValidation: "strict",
    outputSanitization: "strict"
  },
  run: async ({ args }) => {
    // Validate URL
    const u = new URL(args.baseUrl);
    if (!/^https?:$/.test(u.protocol)) throw new Error("Only http/https allowed");
    const { diagnose } = await import("../gateway/doctor.js");
    const r = await diagnose(args);
    return { ok: r.ok, summary: r.summary, steps: r.steps.map(s => ({ name: s.name, ok: s.ok, detail: s.detail })), diagnosis: r.diagnosis };
  }
});

// ─────────────────────────────────────────────
// 🔌 MCP — ثبت سرورهای خارجی و expose ابزارهایشان
// ─────────────────────────────────────────────
export async function listMcpServers(env) { return kvGet(env, "mcp:servers", []); }

export async function addMcpServer(env, { name, url, apiKey = "", enabled = true }) {
  const servers = await listMcpServers(env);
  const s = { id: newId("mcp"), name: String(name || "MCP").slice(0, 50), url: String(url), hasKey: !!apiKey, enabled, createdAt: nowIso() };
  if (apiKey) {
    const { encryptSecret } = await import("../core/secrets.js");
    s.enc = await encryptSecret(env, apiKey);
  }
  servers.push(s);
  await kvPut(env, "mcp:servers", servers);
  return s;
}

export async function deleteMcpServer(env, id) {
  const servers = (await listMcpServers(env)).filter(s => s.id !== id);
  await kvPut(env, "mcp:servers", servers);
  return servers;
}

// ابزارهای MCP از طریق JSON-RPC over HTTP فراخوانی میشوند
export async function syncMcpTools(env) {
  const servers = (await listMcpServers(env)).filter(s => s.enabled);
  let added = 0;
  for (const s of servers) {
    const headers = { "Content-Type": "application/json" };
    if (s.enc) {
      const { decryptSecret } = await import("../core/secrets.js");
      headers.Authorization = `Bearer ${await decryptSecret(env, s.enc)}`;
    }
    const r = await httpJson(s.url, { method: "POST", headers, body: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }, timeout: 15000 });
    const tools = r.json?.result?.tools || [];
    for (const t of tools) {
      registerTool({
        name: `mcp_${s.name.toLowerCase().replace(/\W+/g, "_")}_${t.name}`,
        description: `[MCP:${s.name}] ${t.description || t.name}`,
        input: t.inputSchema || { type: "object", properties: {} },
        source: `mcp:${s.id}`,
        run: async ({ args }) => {
          const call = await httpJson(s.url, { method: "POST", headers, body: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: t.name, arguments: args } }, timeout: 30000 });
          if (call.json?.error) throw new Error(call.json.error.message || "MCP error");
          return call.json?.result ?? call.text;
        }
      });
      added++;
    }
  }
  return { servers: servers.length, tools: added };
}
