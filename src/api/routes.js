// ─────────────────────────────────────────────
// 🌐 REST API for the Mini App — روی همان دادههای ربات
// همه پاسخها: { ok, data } یا { ok:false, error, hint }
// ─────────────────────────────────────────────
import { authenticate, verifyInitData, issueSession, rateLimitApi } from "./auth.js";
import { kvGet, kvPut } from "../core/kv.js";
import { exportBackup, inspectBackup, restoreBackup } from "../ops/portable-backup.js";
import { responseOptions } from "../core/preferences.js";
import { auditRead, audit } from "../core/audit.js";
import { ctx, isAdmin } from "../core/ctx.js";
import {
  listProviders, getProvider, createProvider, updateProvider, deleteProvider, saveProvider,
  bulkCreateProviders, publicProvider, providerHealth, parseKeys, removeProviderKey,
  pickKey, API_FORMATS, AUTH_METHODS, renderNameTemplate
} from "../gateway/providers.js";
import {
  listModels, getModel, saveModel, deleteModel, deleteModelsByProvider, upsertModel,
  discoverModels, testModel, testModels, TEST_SUITE, DEFAULT_TESTS, scoreModel,
  getWeights, setWeights, costPer1M, CAPABILITIES,
  recordModelUsage, getModelReliability, getProviderReliability, getTopReliableModels
} from "../gateway/models.js";
import { diagnose } from "../gateway/doctor.js";
import { runBenchmark, listBenchmarks, getBenchmark, compareModels, BENCH_TASKS, QUICK_TASKS, FULL_TASKS, benchmarkModel } from "../gateway/benchmark.js";
import { getRoutingConfig, setRoutingConfig, addRule, deleteRule, POLICIES, LB_STRATEGIES, selectModels, route } from "../gateway/router.js";
import { snapshot, monitorHistory, healthOverview, usageRange, listAlertRules, addAlertRule, deleteAlertRule, listAlertEvents, evaluateAlerts, healthSweep } from "../ops/monitor.js";
import { listTools, runTool, listMcpServers, addMcpServer, deleteMcpServer, syncMcpTools } from "../agents/tools.js";
import { listAgents, getAgent, createAgent, updateAgent, deleteAgent, duplicateAgent, runAgent, listRuns, getRun, BUILTIN_AGENTS } from "../agents/runtime.js";
import { parseIntent, execute, needsConfirmation } from "../agents/nlops.js";
import {
  listTasks, createTask, updateTask, deleteTask, runTask, getTask, taskFromNaturalLanguage,
  listWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, runWorkflow, getWorkflow, workflowFromNaturalLanguage, NODE_TYPES
} from "../ops/automation.js";
import {
  listMemories, addMemory, updateMemory, deleteMemory, clearMemories, searchMemory,
  listMemoriesScoped, addMemoryScoped, updateMemoryScoped, deleteMemoryScoped,
  clearMemoriesScoped, searchMemoryScoped, getMemoryStats, mergeConversationMemories,
  MEMORY_SCOPES,
  getGraph, addGraphEdge, deleteGraph, listProjects, createProject, updateProject, deleteProject,
  optimizePrompt, abTestPrompt, listPromptLab, MEMORY_KINDS
} from "../knowledge/memory.js";
import {
  runCouncil, getCouncilRun, listCouncilRuns, saveCouncilConfig, listCouncilConfigs,
  deleteCouncilConfig, estimateCouncil, COUNCIL_MODES, PANEL_ROLES, pickCouncilModels,
  calculateDiversityMetrics, planCouncil,
  listCouncilTemplates, getCouncilTemplate, createCouncilTemplate, updateCouncilTemplate,
  deleteCouncilTemplate, duplicateCouncilTemplate, instantiateFromTemplate, getTemplateStats,
  COUNCIL_TEMPLATES
} from "../gateway/council.js";
import { newId, nowIso, kvDel, indexAdd, indexRemove, readMany } from "../core/kv.js";
import {
  createEvalDataset, getEvalDataset, listEvalDatasets, deleteEvalDataset,
  addEvalCase, updateEvalCase, deleteEvalCase, runEvaluation, getEvalRun,
  listEvalRuns, compareEvalRuns, autoRunRegression, EVAL_CRITERIA
} from "../ops/evaluation.js";
import {
  createPromptVersion, getPromptVersion, listPromptVersions, rollbackPromptVersion,
  comparePromptVersions, runPromptABTest, optimizePromptForModel, testPromptWithEval
} from "../knowledge/memory.js";
import {
  exportPlatformData, importPlatformData, exportResource, importResource
} from "../ops/backup.js";
import {
  advancedSelectModels, setModelPolicy, getModelPolicy, routeAdvanced, getRouterStats
} from "../gateway/router.js";
import {
  startSpan, endSpan, addSpanEvent, getTrace, listTraces, recordMetric, getMetricAggregations,
  getMetricTimeSeries, writeLog, queryLogs, recordPerformance, getPerformanceSummary,
  getObservabilityDashboard, METRIC_TYPES, LOG_LEVELS
} from "../ops/observability.js";
import {
  createBudget, getBudget, listBudgets, updateBudget, deleteBudget, resetBudget,
  recordCost, getCostAlerts, getCostSummary, getTopSpenders, getCostForecast, exportCosts
} from "../ops/costs.js";
import {
  checkRateLimit, getUserQuotas, incrementQuota, checkQuotas, acquireConcurrentSlot,
  releaseConcurrentSlot, getAdaptiveRateLimit, updateSystemLoad, checkIpRateLimit,
  getRateLimitStats, getUserTier, setUserTier, USER_TIERS
} from "../core/ratelimit.js";
import {
  advancedSearch, getSearchFacets, getSearchSuggestions, recordSearch, getSearchHistory,
  getPopularSearches
} from "../ops/search.js";
import {
  createTenant, getTenant, getTenantBySlug, listTenants, updateTenant, deleteTenant,
  addTenantMember, removeTenantMember, listTenantMembers, getUserTenants, getTenantMemberRole,
  updateMemberRole, createTenantInvite, acceptTenantInvite, getTenantStats, TENANT_PLANS
} from "../core/tenancy.js";
import {
  createRole, getRole, listRoles, updateRole, deleteRole, assignRole, getUserRole,
  getUserPermissions, hasPermission, hasAllPermissions, hasAnyPermission,
  grantResourcePermission, revokeResourcePermission, hasResourcePermission,
  listResourcePermissions, createPolicy, checkAccessWithPolicies, PERMISSIONS, BUILTIN_ROLES
} from "../core/rbac.js";
import {
  createSsoConfig, getSsoConfig, listSsoConfigs, updateSsoConfig, deleteSsoConfig,
  initiateSsoLogin, completeSsoLogin, getUserExternalIdentities, unlinkExternalIdentity,
  OAUTH_PROVIDERS
} from "../core/sso.js";
import {
  setTenantResidency, getTenantResidency, validateDataResidency, checkDataTransfer,
  createDataTransferRequest, approveDataTransferRequest, rejectDataTransferRequest,
  getResidencyReport, getComplianceStatus, DATA_REGIONS, DATA_CLASSIFICATIONS
} from "../core/residency.js";
import {
  auditEnhanced, auditExport, auditStats, generateComplianceReport, auditSearch
} from "../core/audit.js";
import {
  createVectorIndex, getVectorIndex, listVectorIndexes, deleteVectorIndex,
  insertVectors, queryVectors, getVector, deleteVector, updateVectorMetadata,
  generateEmbedding, generateEmbeddings, indexDocuments, semanticSearch,
  findSimilarDocuments, clusterVectors, getVectorStats
} from "../knowledge/vectorize.js";
import {
  createKnowledgeBase, getKnowledgeBase, listKnowledgeBases, deleteKnowledgeBase,
  addDocument as addKbDocument, getDocument as getKbDocument, listDocuments as listKbDocuments,
  deleteDocument as deleteKbDocument, ragQuery, multiHopRagQuery, ragQueryWithCitations, getRagStats
} from "../knowledge/rag.js";
import {
  uploadDocument, getDocument as getUploadedDocument, getDocumentContent, listDocuments as listUploadedDocuments,
  deleteDocument as deleteUploadedDocument, processDocument, batchProcessDocuments,
  analyzeDocument, extractEntities, compareDocuments, getDocumentStats, SUPPORTED_FORMATS
} from "../knowledge/documents.js";
import {
  semanticCacheGet, semanticCacheSet, semanticCacheInvalidate, getSemanticCacheStats,
  hybridCacheGet, hybridCacheSet
} from "../gateway/cache.js";
import {
  analyzeQueryComplexity, detectQueryType, decomposeQuery, executeParallelQueries,
  synthesizeResults, optimizePrompt as optimizeQueryPrompt, suggestPromptImprovements, rewriteQuery,
  expandAbbreviations, optimizeQueryExecution, getOptimizationStats, recommendStrategy
} from "../gateway/optimizer.js";
import {
  streamCompletion, createSSEResponse, getActiveStreams, cancelStream, getStreamStatus, getStreamingStats
} from "../gateway/streaming.js";
import {
  createWebhook, getWebhook, listWebhooks, updateWebhook, deleteWebhook, rotateWebhookSecret,
  triggerWebhookEvent, getWebhookDelivery, listWebhookDeliveries, retryWebhookDelivery,
  getWebhookStats, testWebhook, processWebhookRetries, WEBHOOK_EVENTS
} from "../ops/webhooks.js";
import {
  registerPlugin, listPlugins, enablePlugin, disablePlugin, executePlugin, PLUGIN_TYPES
} from "../ops/plugins.js";
import { generateCLISpec, CLI_COMMANDS } from "../ops/cli.js";
import { generateSDKSpec, generateTypeScriptSDK, generatePythonSDK, SDK_LANGUAGES } from "../ops/sdk.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function ok(data, extra = {}) {
  return new Response(JSON.stringify({ ok: true, data, ...extra }), { headers: JSON_HEADERS });
}
function fail(error, status = 400, hint = null) {
  return new Response(JSON.stringify({ ok: false, error: String(error?.message || error), ...(hint ? { hint } : {}) }), { status, headers: JSON_HEADERS });
}

function match(pathname, pattern) {
  const p = pathname.split("/").filter(Boolean);
  const t = pattern.split("/").filter(Boolean);
  if (p.length !== t.length) return null;
  const params = {};
  for (let i = 0; i < t.length; i++) {
    if (t[i].startsWith(":")) params[t[i].slice(1)] = decodeURIComponent(p[i]);
    else if (t[i] !== p[i]) return null;
  }
  return params;
}

function sanitizeSsoConfig(config) {
  const safe = { ...config };
  if (safe.settings) {
    const { clientSecret, certificate, privateKey, ...safeSettings } = safe.settings;
    safe.settings = safeSettings;
  }
  const { clientSecret, certificate, privateKey, ...rest } = safe;
  return rest;
}

function stripWebhookSecret(webhook) {
  if (!webhook) return webhook;
  const { secret, ...safe } = webhook;
  return safe;
}

export async function handleApi(request, env, botToken, adminId) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("origin") || "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Telegram-Init-Data,X-Admin-Token",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  // ورود: initData → session token
  if (path === "/auth" && method === "POST") {
    const body = await readBody(request);
    const v = await verifyInitData(body.initData, botToken);
    if (!v.ok) return fail(v.error, 401, "Mini App را از داخل تلگرام باز کنید (دکمه منو یا /app)");
    const token = await issueSession(env, v.user);
    await kvPut(env, `profile:${v.user.id}`, {
      firstName: v.user.first_name || "",
      lastName: v.user.last_name || "",
      username: v.user.username || "",
      photoUrl: v.user.photo_url || null,
      isPremium: !!v.user.is_premium,
      ts: Date.now()
    }, { expirationTtl: 2592000 });
    return ok({
      token,
      user: {
        id: v.user.id,
        firstName: v.user.first_name,
        lastName: v.user.last_name,
        username: v.user.username,
        languageCode: v.user.language_code,
        isPremium: !!v.user.is_premium,
        photoUrl: v.user.photo_url || null,
        isAdmin: Number(v.user.id) === Number(adminId)
      },
      startParam: v.startParam
    });
  }

  // health for miniapp (no auth) — تشخیص زنده بودن API
  if (path === "/ping" && method === "GET") {
    return ok({ pong: true, t: Date.now() });
  }

  const auth = await authenticate(request, env, botToken);
  if (!auth.ok) return fail(auth.error, auth.status || 401, "برای دسترسی، Mini App را از تلگرام باز کنید");
  const userId = auth.userId;
  const admin = Number(userId) === Number(adminId);
  if (rateLimitApi(userId)) return fail("تعداد درخواستها زیاد است — یک دقیقه صبر کنید", 429);

  const body = ["POST", "PATCH", "PUT", "DELETE"].includes(method) ? await readBody(request) : {};
  const q = Object.fromEntries(url.searchParams.entries());
  let m;

  try {
    // Portable account archives are available to every authenticated user.
    // Raw database snapshots remain restricted to the configured admin.
    if (path === "/backup/export" && method === "POST") {
      const scope = body.scope === "database" ? "database" : "account";
      if (scope === "database" && !admin) return fail("فقط ادمین می‌تواند کل دیتابیس را دریافت کند.", 403);
      const archive = await exportBackup(env, userId, { scope, adminId });
      if (body.delivery === "telegram") {
        const result = await ctx.tg.sendDocument(userId, `pimx-${scope}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(archive), "پشتیبان PIMX · برای بازیابی روی حساب دیگر از /restore استفاده کنید.");
        if (!result?.ok) return fail("ارسال فایل به تلگرام ناموفق بود. بات را استارت کنید و دوباره تلاش کنید.", 502);
        return ok({ sent: true, recordCount: archive.recordCount });
      }
      return ok(archive);
    }
    if (path === "/backup/inspect" && method === "POST") return ok(await inspectBackup(body.archive));
    if (path === "/backup/restore" && method === "POST") {
      if (body.confirm !== true) return fail("ابتدا پیش‌نمایش بازیابی را تأیید کنید.", 400);
      return ok(await restoreBackup(env, body.archive, userId));
    }
    if (path === "/preferences" && method === "GET") return ok(await kvGet(env, `preferences:${userId}`, { responseMode: "speed" }));
    if (path === "/preferences" && method === "PATCH") {
      const current = await kvGet(env, `preferences:${userId}`, { responseMode: "speed" });
      const next = { ...current, responseMode: ["speed", "balanced", "quality"].includes(body.responseMode) ? body.responseMode : current.responseMode };
      await kvPut(env, `preferences:${userId}`, next);
      return ok(next);
    }
    // ── meta ────────────────────────────────
    if (path === "/me") {
      const prof = await kvGet(env, `profile:${userId}`, null);
      return ok({
        userId, name: auth.name, isAdmin: admin, via: auth.via,
        firstName: (prof && prof.firstName) || auth.name || "",
        lastName: (prof && prof.lastName) || "",
        username: (prof && prof.username) || "",
        photoUrl: (prof && prof.photoUrl) || null,
        avatarUrl: "/api/me/avatar"
      });
    }
    // Telegram profile photo proxied through the Worker (getUserProfilePhotos → getFile).
    // Cached both ways: a resolved file_path for 24h, and a "no photo" marker for 1h so
    // we never re-pay two Telegram round trips on every app open.
    if (path === "/me/avatar" && method === "GET") {
      const cacheKey = `avatarfile:${userId}`;
      let filePath = await kvGet(env, cacheKey, null);
      if (filePath === "none") return new Response(null, { status: 404, headers: { "Cache-Control": "private, max-age=3600" } });
      if (!filePath) {
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 4000);
          const r = await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`, { signal: ctrl.signal });
          const j = await r.json();
          const sizes = j?.result?.photos?.[0] || [];
          const pick = sizes[Math.min(1, sizes.length - 1)] || sizes[0];
          if (pick?.file_id) {
            const f = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(pick.file_id)}`, { signal: ctrl.signal });
            const fj = await f.json();
            filePath = fj?.result?.file_path || null;
          }
          clearTimeout(to);
        } catch (e) { filePath = null; }
        if (filePath) await kvPut(env, cacheKey, filePath, { expirationTtl: 86400 });
        else await kvPut(env, cacheKey, "none", { expirationTtl: 3600 });
      }
      if (!filePath) return new Response(null, { status: 404, headers: { "Cache-Control": "private, max-age=3600" } });
      const img = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
      if (!img.ok) return new Response(null, { status: 404 });
      return new Response(img.body, {
        headers: {
          "Content-Type": img.headers.get("content-type") || "image/jpeg",
          "Cache-Control": "private, max-age=86400"
        }
      });
    }
    if (path === "/meta") {
      return ok({
        formats: API_FORMATS, auths: AUTH_METHODS, capabilities: CAPABILITIES,
        tests: Object.fromEntries(Object.entries(TEST_SUITE).map(([k, v]) => [k, v.label])),
        benchTasks: Object.fromEntries(Object.entries(BENCH_TASKS).map(([k, v]) => [k, v.label])),
        quickTasks: QUICK_TASKS, fullTasks: FULL_TASKS,
        policies: POLICIES, strategies: LB_STRATEGIES,
        nodeTypes: NODE_TYPES, memoryKinds: MEMORY_KINDS,
        builtinAgents: Object.keys(BUILTIN_AGENTS),
        weights: await getWeights(env)
      });
    }

    // ── dashboard ───────────────────────────
    if (path === "/dashboard") {
      const [snap, usage, health, runs, alerts, tasks] = await Promise.all([
        snapshot(env), usageRange(env, 7), healthOverview(env), listRuns(env, 6), listAlertEvents(env, 6),
        listTasks(env, admin ? null : userId)
      ]);
      return ok({
        snapshot: snap,
        usage,
        providers: health.providers,
        models: health.models.slice(0, 12),
        failures: health.models.filter(m => m.status === "failed").slice(0, 8),
        recentRuns: runs,
        alerts,
        automations: tasks.filter(t => t.enabled).map(t => ({ id: t.id, name: t.name, cron: t.cron, lastRun: t.lastRun }))
      });
    }

    // ── providers ───────────────────────────
    // GET /providers/predefined - لیست پروایدرهای از پیش تعریف شده
    if (path === "/providers/predefined" && method === "GET") {
      const { PREDEFINED_PROVIDERS } = await import("../gateway/providers.js");
      const list = Object.entries(PREDEFINED_PROVIDERS).map(([key, provider]) => ({
        key,
        ...provider,
        isConfigured: false // می‌توانیم بعداً چک کنیم که آیا کاربر این پروایدر را اضافه کرده یا نه
      }));
      return ok({ providers: list, count: list.length });
    }

    if (path === "/providers" && method === "GET") {
      const providers = await listProviders(env);
      const models = await listModels(env);
      return ok(providers.map(p => ({
        ...publicProvider(p),
        modelCount: models.filter(x => x.providerId === p.id).length,
        healthyModels: models.filter(x => x.providerId === p.id && x.status === "healthy").length,
        health: providerHealth(p)
      })));
    }
    if (path === "/providers" && method === "POST") {
      if (!body.baseUrl) return fail("Base URL لازم است");
      const p = await createProvider(env, body, userId);
      return ok(publicProvider(p));
    }
    if (path === "/providers/bulk" && method === "POST") {
      const keys = Array.isArray(body.keys) ? body.keys : parseKeys(body.keys || "");
      if (!body.baseUrl) return fail("Base URL لازم است");
      if (!keys.length) return fail("هیچ کلید معتبری پیدا نشد");
      const created = await bulkCreateProviders(env, { ...body, keys }, userId);
      return ok(created.map(publicProvider));
    }
    if (path === "/providers/bulk/preview" && method === "POST") {
      const keys = Array.isArray(body.keys) ? body.keys : parseKeys(body.keys || "");
      return ok({
        count: keys.length,
        names: keys.map((_, i) => renderNameTemplate(body.nameTemplate || "Provider-{n}", i + 1, keys.length))
      });
    }
    if (path === "/providers/diagnose" && method === "POST") {
      if (!body.baseUrl) return fail("Base URL لازم است");
      return ok(await diagnose(body));
    }
    if ((m = match(path, "/providers/:id")) && method === "GET") {
      const p = await getProvider(env, m.id);
      if (!p) return fail("پروایدر یافت نشد", 404);
      const models = await listModels(env, { providerId: p.id });
      return ok({ ...publicProvider(p), health: providerHealth(p), models: models.map(slimModel) });
    }
    if ((m = match(path, "/providers/:id")) && method === "PATCH") {
      const p = await updateProvider(env, m.id, body, userId);
      return ok(publicProvider(p));
    }
    if ((m = match(path, "/providers/:id")) && method === "DELETE") {
      const p = await getProvider(env, m.id);
      if (!p) return fail("پروایدر یافت نشد", 404);
      if (q.cascade !== "false") await deleteModelsByProvider(env, m.id, userId);
      await deleteProvider(env, m.id, userId);
      return ok({ deleted: true, provider: p.name });
    }
    if ((m = match(path, "/providers/:id/test")) && method === "POST") {
      const p = await getProvider(env, m.id);
      if (!p) return fail("پروایدر یافت نشد", 404);
      const { plain } = await pickKey(env, p);
      const report = await diagnose({ baseUrl: p.baseUrl, apiKey: plain, format: p.format, auth: p.auth, authHeader: p.authHeader, authQuery: p.authQuery, headers: p.headers, model: body.model });
      const fresh = await getProvider(env, m.id);
      fresh.status = report.ok ? "healthy" : (report.info?.compatible ? "degraded" : "failed");
      fresh.lastChecked = new Date().toISOString();
      fresh.lastError = report.ok ? null : (report.diagnosis?.cause || null);
      await kvPut(env, `provider:${m.id}`, fresh);
      return ok(report);
    }
    if ((m = match(path, "/providers/:id/discover-models")) && method === "POST") {
      const r = await discoverModels(env, m.id, userId);
      return ok({ found: r.found, created: r.created, path: r.path, attempts: r.attempts, models: r.models.map(slimModel) });
    }
    if ((m = match(path, "/providers/:id/authenticate")) && method === "POST") {
      const { authenticateProvider } = await import("../gateway/providers.js");
      const result = await authenticateProvider(env, m.id);
      return ok(result);
    }
    if ((m = match(path, "/providers/:id/health")) && method === "POST") {
      const { checkProviderHealth } = await import("../gateway/providers.js");
      const result = await checkProviderHealth(env, m.id);
      return ok(result);
    }
    if ((m = match(path, "/providers/:id/adapter/models")) && method === "POST") {
      const { listModelsViaAdapter } = await import("../gateway/providers.js");
      const result = await listModelsViaAdapter(env, m.id);
      return ok(result);
    }
    if ((m = match(path, "/providers/:id/adapter/capabilities/:modelId")) && method === "POST") {
      const { detectModelCapabilities } = await import("../gateway/providers.js");
      const result = await detectModelCapabilities(env, m.id, m.modelId);
      return ok(result);
    }
    if ((m = match(path, "/providers/:id/keys")) && method === "POST") {
      const keys = Array.isArray(body.keys) ? body.keys : parseKeys(body.keys || body.apiKey || "");
      if (!keys.length) return fail("کلیدی ارسال نشد");
      const p = await updateProvider(env, m.id, { apiKeys: keys }, userId);
      return ok(publicProvider(p));
    }
    if ((m = match(path, "/providers/:id/keys/:keyId")) && method === "DELETE") {
      const p = await removeProviderKey(env, m.id, m.keyId, userId);
      return ok(publicProvider(p));
    }
    if ((m = match(path, "/providers/:id/keys/:keyId/health")) && method === "GET") {
      const { getKeyHealth } = await import("../gateway/providers.js");
      const p = await getProvider(env, m.id);
      if (!p) return fail("پروایدر یافت نشد", 404);
      const key = p.keys.find(k => k.id === m.keyId);
      if (!key) return fail("کلید یافت نشد", 404);
      return ok(getKeyHealth(key));
    }
    if ((m = match(path, "/providers/:id/keys/health")) && method === "GET") {
      const { getKeyHealth } = await import("../gateway/providers.js");
      const p = await getProvider(env, m.id);
      if (!p) return fail("پروایدر یافت نشد", 404);
      const healthStats = (p.keys || []).map(k => getKeyHealth(k));
      return ok({ provider: m.id, keys: healthStats });
    }
    if ((m = match(path, "/providers/:id/rotate-key")) && method === "POST") {
      const { rotateProviderKey } = await import("../gateway/providers.js");
      const result = await rotateProviderKey(env, m.id);
      return ok(result);
    }
    if ((m = match(path, "/providers/:id/keys/:keyId/reset-cooldown")) && method === "POST") {
      const p = await getProvider(env, m.id);
      if (!p) return fail("پروایدر یافت نشد", 404);
      const key = p.keys.find(k => k.id === m.keyId);
      if (!key) return fail("کلید یافت نشد", 404);
      key.cooldownUntil = null;
      key.status = key.status === "rate_limited" ? "unknown" : key.status;
      await saveProvider(env, p);
      return ok({ reset: true, key: { id: key.id, mask: key.mask, status: key.status } });
    }

    // ─────────────────────────────────────────────
    // Cache Management
    // ─────────────────────────────────────────────
    if ((m = match(path, "/cache/stats")) && method === "GET") {
      const { getCacheStats } = await import("../gateway/cache.js");
      const stats = await getCacheStats(env, { limit: 1000 });
      return ok(stats || { error: "Failed to get cache stats" });
    }
    if ((m = match(path, "/cache/clear")) && method === "POST") {
      const { clearAllCache } = await import("../gateway/cache.js");
      const result = await clearAllCache(env);
      return ok(result);
    }
    if ((m = match(path, "/cache/invalidate")) && method === "POST") {
      const { invalidateCacheEntries } = await import("../gateway/cache.js");
      const criteria = body || {};
      const result = await invalidateCacheEntries(env, criteria);
      return ok(result);
    }
    if ((m = match(path, "/cache/entry/:key")) && method === "GET") {
      const { getCacheEntry } = await import("../gateway/cache.js");
      const entry = await getCacheEntry(env, m.key);
      if (!entry) return fail("Cache entry not found", 404);
      return ok(entry);
    }
    if ((m = match(path, "/cache/entry/:key")) && method === "DELETE") {
      const { deleteCacheEntry } = await import("../gateway/cache.js");
      const result = await deleteCacheEntry(env, m.key);
      return ok({ deleted: result });
    }

    // ─────────────────────────────────────────────
    // Approval Management
    // ─────────────────────────────────────────────
    if ((m = match(path, "/approvals")) && method === "GET") {
      const { listPendingApprovals } = await import("../core/approval.js");
      const options = {
        category: q.category,
        risk: q.risk,
        userId: q.userId ? Number(q.userId) : undefined,
        limit: q.limit ? Number(q.limit) : 50
      };
      const approvals = await listPendingApprovals(env, options);
      return ok(approvals);
    }
    if ((m = match(path, "/approvals/stats")) && method === "GET") {
      const { getApprovalStats } = await import("../core/approval.js");
      const stats = await getApprovalStats(env);
      return ok(stats);
    }
    if ((m = match(path, "/approvals/:id")) && method === "GET") {
      const { getApprovalRequest } = await import("../core/approval.js");
      const request = await getApprovalRequest(env, m.id);
      if (!request) return fail("Approval request not found", 404);
      return ok(request);
    }
    if ((m = match(path, "/approvals/:id/approve")) && method === "POST") {
      const { approveRequest } = await import("../core/approval.js");
      const { reason } = body || {};
      const request = await approveRequest(env, m.id, userId, reason);
      return ok(request);
    }
    if ((m = match(path, "/approvals/:id/reject")) && method === "POST") {
      const { rejectRequest } = await import("../core/approval.js");
      const { reason } = body || {};
      const request = await rejectRequest(env, m.id, userId, reason);
      return ok(request);
    }
    if ((m = match(path, "/approvals/:id/cancel")) && method === "POST") {
      const { cancelRequest } = await import("../core/approval.js");
      const request = await cancelRequest(env, m.id, userId);
      return ok(request);
    }
    if ((m = match(path, "/approvals/cleanup")) && method === "POST") {
      const { cleanupExpiredRequests } = await import("../core/approval.js");
      const result = await cleanupExpiredRequests(env);
      return ok(result);
    }

    // ─────────────────────────────────────────────
    // Tool Security
    // ─────────────────────────────────────────────
    if (path === "/tools" && method === "GET") return ok(listTools({ includeDangerous: q.includeDangerous === "true" }));
    if (path === "/tools/run" && method === "POST") {
      if (!body.tool) return fail("نام ابزار لازم است");
      const r = await runTool(env, body.tool, body.args || {}, { userId, confirmed: !!body.confirmed });
      return r.ok ? ok(r) : fail(r.error, r.needsConfirmation ? 428 : 400);
    }
    if ((m = match(path, "/tools/risk-levels")) && method === "GET") {
      const { TOOL_RISK_LEVELS, RISK_POLICIES } = await import("../agents/tools.js");
      return ok({
        levels: TOOL_RISK_LEVELS,
        policies: RISK_POLICIES
      });
    }
    if ((m = match(path, "/tools/:name/security")) && method === "GET") {
      const { getTool, TOOL_RISK_LEVELS, RISK_POLICIES } = await import("../agents/tools.js");
      const tool = getTool(m.name);
      if (!tool) return fail("Tool not found", 404);
      return ok({
        name: tool.name,
        riskLevel: tool.riskLevel,
        policy: RISK_POLICIES[tool.riskLevel],
        security: tool.security,
        requiresAuth: tool.requiresAuth,
        requiresApproval: tool.requiresApproval,
        maxExecutionsPerMinute: tool.maxExecutionsPerMinute
      });
    }
    if ((m = match(path, "/tools/:name")) && method === "GET") {
      const { getTool } = await import("../agents/tools.js");
      const tool = getTool(m.name);
      if (!tool) return fail("Tool not found", 404);
      // Don't expose the run function
      const { run, ...toolInfo } = tool;
      return ok(toolInfo);
    }

    // ── models ──────────────────────────────
    if (path === "/models" && method === "GET") {
      const all = await listModels(env);
      let rows = all;
      if (q.providerId) rows = rows.filter(m => m.providerId === q.providerId);
      if (q.status) rows = rows.filter(m => m.status === q.status);
      if (q.enabled !== undefined) rows = rows.filter(m => !!m.enabled === (q.enabled === "true"));
      if (q.capability) rows = rows.filter(m => m.capabilities?.[q.capability]?.supported);
      if (q.tag) rows = rows.filter(m => (m.tags || []).includes(q.tag));
      if (q.q) {
        const needle = String(q.q).toLowerCase();
        rows = rows.filter(m => `${m.displayName} ${m.apiModelId} ${m.providerName}`.toLowerCase().includes(needle));
      }
      const weights = await getWeights(env);
      const sort = q.sort || "score";
      let out = rows.map(mm => ({ ...slimModel(mm), score: scoreModel(mm, weights, all) }));
      out.sort((a, b) => {
        if (sort === "latency") return (a.latency || 9e9) - (b.latency || 9e9);
        if (sort === "cost") return (a.costPer1M ?? 9e9) - (b.costPer1M ?? 9e9);
        if (sort === "name") return String(a.name).localeCompare(String(b.name));
        if (sort === "errors") return (b.errorRate || 0) - (a.errorRate || 0);
        return (b.score?.overall || 0) - (a.score?.overall || 0);
      });
      const page = Math.max(1, Number(q.page || 1));
      const size = Math.min(300, Number(q.size || 50));
      return ok({ total: out.length, page, size, models: out.slice((page - 1) * size, page * size) });
    }
    if (path === "/models" && method === "POST") {
      const p = await getProvider(env, body.providerId);
      if (!p) return fail("providerId نامعتبر است");
      const ids = body.models?.length ? body.models : (body.apiModelId ? [body.apiModelId] : parseLines(body.bulk));
      if (!ids.length) return fail("شناسه مدل لازم است");
      const created = [];
      for (const id of ids) {
        const { model } = await upsertModel(env, p, id, {
          displayName: ids.length === 1 ? body.displayName : undefined,
          contextWindow: body.contextWindow, capabilities: body.capabilities, pricing: body.pricing, tags: body.tags
        });
        created.push(model);
      }
      let tested = [];
      if (body.test !== false) tested = await testModels(env, created.map(x => x.id), ["basic"], { userId });
      return ok({
        created: created.length,
        healthy: tested.filter(t => t.model?.status === "healthy").length,
        models: created.map(slimModel)
      });
    }
    if (path === "/models/bulk" && method === "POST") {
      const action = body.action;
      const ids = body.ids || [];
      if (!ids.length && !body.filter) return fail("مدلی انتخاب نشده");
      let targets = ids.length ? (await Promise.all(ids.map(id => getModel(env, id)))).filter(Boolean) : await listModels(env, body.filter || {});
      if (body.filter?.unhealthy) targets = targets.filter(x => x.status === "failed" || (x.errorRate || 0) > 50);
      if (!targets.length) return fail("مدلی مطابق انتخاب پیدا نشد");
      switch (action) {
        case "enable": case "disable": {
          for (const t of targets) { t.enabled = action === "enable"; await saveModel(env, t); }
          await audit(env, { userId, action: `model.${action}`, resource: "bulk", meta: { count: targets.length } });
          return ok({ action, count: targets.length });
        }
        case "delete": {
          for (const t of targets) await deleteModel(env, t.id, userId);
          return ok({ action, count: targets.length });
        }
        case "test": {
          const res = await testModels(env, targets.map(t => t.id), body.tests || DEFAULT_TESTS, { userId });
          return ok({ action, count: res.length, healthy: res.filter(r => r.model?.status === "healthy").length, results: res.map(r => ({ id: r.model?.id, status: r.model?.status, passed: r.passed, total: r.total, latency: r.model?.latency, error: r.model?.lastError })) });
        }
        case "benchmark": {
          const run = await runBenchmark(env, { modelIds: targets.slice(0, 12).map(t => t.id), tasks: body.tasks || QUICK_TASKS, userId, label: body.label });
          return ok({ action, runId: run.id, winner: run.winner, reports: run.reports });
        }
        case "tag": {
          for (const t of targets) { t.tags = [...new Set([...(t.tags || []), ...(body.tags || [])])]; await saveModel(env, t); }
          return ok({ action, count: targets.length });
        }
        case "untag": {
          for (const t of targets) { t.tags = (t.tags || []).filter(x => !(body.tags || []).includes(x)); await saveModel(env, t); }
          return ok({ action, count: targets.length });
        }
        case "favorite": {
          for (const t of targets) { t.favorite = body.value !== false; await saveModel(env, t); }
          return ok({ action, count: targets.length });
        }
        case "priority": {
          for (const t of targets) { t.weight = Number(body.weight || 1); await saveModel(env, t); }
          return ok({ action, count: targets.length });
        }
        case "export":
          return ok({ action, models: targets.map(t => ({ providerId: t.providerId, apiModelId: t.apiModelId, displayName: t.displayName, contextWindow: t.contextWindow, pricing: t.pricing, tags: t.tags })) });
        default:
          return fail(`action نامعتبر: ${action}`);
      }
    }
    if (path === "/models/benchmark" && method === "POST") {
      const ids = body.ids || body.modelIds || [];
      if (!ids.length) return fail("مدلی انتخاب نشده");
      const run = await runBenchmark(env, { modelIds: ids.slice(0, 12), tasks: body.tasks || QUICK_TASKS, label: body.label, userId });
      return ok(run);
    }
    if (path === "/models/compare" && method === "POST") {
      const ids = body.ids || [];
      if (ids.length < 2) return fail("حداقل دو مدل لازم است");
      return ok(await compareModels(env, ids.slice(0, 5), body.tasks || QUICK_TASKS));
    }
    if ((m = match(path, "/models/:id")) && method === "GET") {
      const model = await getModel(env, m.id);
      if (!model) return fail("مدل یافت نشد", 404);
      const weights = await getWeights(env);
      const all = await listModels(env);
      const cfg = await getRoutingConfig(env);
      return ok({
        ...slimModel(model),
        capabilityDetail: model.capabilities,
        score: scoreModel(model, weights, all),
        tests: model.tests || [],
        benchmarks: model.benchmarks || [],
        stats: model.stats,
        raw: model.raw,
        routingRules: cfg.rules.filter(r => r.modelId === model.id || (r.fallbackModelIds || []).includes(model.id)),
        isDefault: cfg.defaultModelId === model.id
      });
    }
    if ((m = match(path, "/models/:id")) && method === "PATCH") {
      const model = await getModel(env, m.id);
      if (!model) return fail("مدل یافت نشد", 404);
      for (const k of ["displayName", "enabled", "contextWindow", "tags", "pricing", "favorite", "weight"]) {
        if (body[k] !== undefined) model[k] = body[k];
      }
      if (body.capabilities) {
        for (const [k, v] of Object.entries(body.capabilities)) {
          if (model.capabilities[k]) model.capabilities[k] = { supported: !!v, confidence: 100, source: "manual" };
        }
      }
      await saveModel(env, model);
      return ok(slimModel(model));
    }
    if ((m = match(path, "/models/:id")) && method === "DELETE") {
      const done = await deleteModel(env, m.id, userId);
      return done ? ok({ deleted: true }) : fail("مدل یافت نشد", 404);
    }
    if ((m = match(path, "/models/:id/test")) && method === "POST") {
      const r = await testModel(env, m.id, body.tests || DEFAULT_TESTS, userId);
      return ok({ model: slimModel(r.model), results: r.results, passed: r.passed, total: r.total });
    }
    if ((m = match(path, "/models/:id/capabilities")) && method === "GET") {
      const model = await getModel(env, m.id);
      if (!model) return fail("مدل یافت نشد", 404);
      // Return capabilities organized by category
      const { CAPABILITY_CATEGORIES } = await import("../gateway/models.js");
      const organized = {};
      for (const [category, capList] of Object.entries(CAPABILITY_CATEGORIES)) {
        organized[category] = {};
        for (const cap of capList) {
          if (model.capabilities && model.capabilities[cap]) {
            organized[category][cap] = model.capabilities[cap];
          }
        }
      }
      return ok({ modelId: model.id, modelName: model.displayName, capabilities: model.capabilities, organized, contextWindow: model.contextWindow });
    }
    if ((m = match(path, "/models/:id/benchmark")) && method === "POST") {
      return ok(await benchmarkModel(env, m.id, body.tasks || QUICK_TASKS));
    }
    if ((m = match(path, "/models/:id/run")) && method === "POST") {
      const model = await getModel(env, m.id);
      if (!model) return fail("مدل یافت نشد", 404);
      const messages = body.messages || [
        ...(body.system ? [{ role: "system", content: body.system }] : []),
        { role: "user", content: body.prompt || "سلام" }
      ];
      const t0 = Date.now();
      try {
        const res = await route(env, messages, {
          modelId: model.id, maxTokens: body.maxTokens || 500, temperature: body.temperature ?? 0.7,
          json: !!body.json, userId, text: body.prompt
        });
        return ok({ text: res.text, model: res.model, latency: res.latency, promptTokens: res.promptTokens, completionTokens: res.completionTokens, cost: res.cost, failover: res.failover, attempts: res.attempts });
      } catch (e) {
        return fail(e, 502, `${Date.now() - t0}ms طول کشید — جزئیات خطا در پیام آمده`);
      }
    }

    // ── Model & Provider Reliability (Phase 13) ───────────────────
    if (path === "/models/reliability/top" && method === "GET") {
      const limit = Math.min(50, Number(q.limit || 10));
      const models = await getTopReliableModels(env, limit);
      return ok(models);
    }
    if (path === "/models/reliability/providers" && method === "GET") {
      const reliability = await getProviderReliability(env);
      return ok(reliability);
    }
    if ((m = match(path, "/models/:id/reliability")) && method === "GET") {
      const model = await getModel(env, m.id);
      if (!model) return fail("مدل یافت نشد", 404);
      const reliabilityScore = getModelReliability(model);
      return ok({
        modelId: model.id,
        modelName: model.displayName || model.apiModelId,
        reliability: reliabilityScore,
        stats: model.reliability || null
      });
    }

    // ── weights / routing ───────────────────
    if (path === "/routing" && method === "GET") {
      const cfg = await getRoutingConfig(env);
      const all = await listModels(env);
      const providers = await listProviders(env);
      return ok({
        ...cfg, policies: POLICIES, strategies: LB_STRATEGIES,
        weights: await getWeights(env),
        rulesResolved: cfg.rules.map(r => ({
          ...r,
          modelName: all.find(x => x.id === r.modelId)?.displayName || null,
          providerName: providers.find(p => p.id === r.providerId)?.name || null,
          fallbackNames: (r.fallbackModelIds || []).map(id => all.find(x => x.id === id)?.displayName || id)
        }))
      });
    }
    if (path === "/routing" && method === "PATCH") {
      return ok(await setRoutingConfig(env, body, userId));
    }
    if (path === "/routing/weights" && method === "POST") {
      return ok(await setWeights(env, body));
    }
    if (path === "/routing/rules" && method === "POST") {
      return ok(await addRule(env, body, userId));
    }
    if ((m = match(path, "/routing/rules/:id")) && method === "DELETE") {
      return ok(await deleteRule(env, m.id, userId));
    }
    if (path === "/routing/preview" && method === "POST") {
      const sel = await selectModels(env, { text: body.text || "", task: body.task, opts: body });
      return ok({
        task: sel.task, weights: sel.weights, total: sel.total,
        chain: sel.chain.map(x => ({ id: x.id, name: x.displayName, provider: x.providerName, latency: x.latency, status: x.status, cost: costPer1M(x) }))
      });
    }

    // ── chat ────────────────────────────────
    if (path === "/chat" && method === "POST") {
      const response = await responseOptions(env, userId, body);
      const messages = body.messages?.length ? body.messages : [{ role: "user", content: body.prompt || "" }];
      if (!messages.some(x => x.content)) return fail("پیام خالی است");
      // optional conversation persistence for Mini App
      let convId = body.conversationId || null;
      if (body.save !== false) {
        convId = convId || newId("conv");
        const ckey = `conv:${userId}:${convId}`;
        const conv = await kvGet(env, ckey, null) || {
          id: convId, userId, title: "گفتگوی جدید", messages: [], createdAt: nowIso(), updatedAt: nowIso(),
          pinned: false, favorite: false, folder: body.folder || "default", archived: false
        };
        const userMsg = messages.filter(x => x.role === "user").slice(-1)[0];
        if (userMsg) conv.messages.push({ id: newId("msg"), role: "user", content: typeof userMsg.content === "string" ? userMsg.content : JSON.stringify(userMsg.content), ts: nowIso() });
        await kvPut(env, ckey, conv);
        await indexAdd(env, `convindex:${userId}`, convId);
      }
      const res = await route(env, messages, {
        modelId: body.modelId, task: body.task, policy: response.policy,
        maxTokens: response.maxTokens, temperature: body.temperature ?? 0.7, userId,
        text: messages.filter(x => x.role === "user").map(x => typeof x.content === "string" ? x.content : "").join(" ")
      });
      const { trackPlatformUsage } = await import("../ops/monitor.js");
      await trackPlatformUsage(env, { userId, modelId: res.modelId, model: res.model, providerName: res.providerName, promptTokens: res.promptTokens, completionTokens: res.completionTokens, cost: res.cost, latency: res.latency, ok: true, task: res.task });
      if (convId && body.save !== false) {
        const ckey = `conv:${userId}:${convId}`;
        const conv = await kvGet(env, ckey, null);
        if (conv) {
          conv.messages.push({
            id: newId("msg"), role: "assistant", content: res.text || "",
            model: res.model, modelId: res.modelId, provider: res.providerName,
            latency: res.latency, ts: nowIso()
          });
          if (conv.title === "گفتگوی جدید" && conv.messages.length >= 2) {
            const first = conv.messages.find(m => m.role === "user")?.content || "";
            conv.title = String(first).replace(/\s+/g, " ").slice(0, 48) || "گفتگو";
          }
          conv.updatedAt = nowIso();
          await kvPut(env, ckey, conv);
        }
      }
      return ok({ ...res, conversationId: convId });
    }

    // ── chat/stream (SSE streaming for Mini App) ────────────────
    if (path === "/chat/stream" && method === "POST") {
      const response = await responseOptions(env, userId, body);
      const { streamCompletion, createSSEResponse } = await import("../gateway/streaming.js");
      const messages = body.messages?.length ? body.messages : [{ role: "user", content: body.prompt || "" }];
      if (!messages.some(x => x.content)) return fail("پیام خالی است");
      
      // Handle conversation persistence
      let convId = body.conversationId || null;
      if (body.save !== false) {
        convId = convId || newId("conv");
        const ckey = `conv:${userId}:${convId}`;
        const conv = await kvGet(env, ckey, null) || {
          id: convId, userId, title: "گفتگوی جدید", messages: [], createdAt: nowIso(), updatedAt: nowIso(),
          pinned: false, favorite: false, folder: body.folder || "default", archived: false
        };
        const userMsg = messages.filter(x => x.role === "user").slice(-1)[0];
        if (userMsg) conv.messages.push({ id: newId("msg"), role: "user", content: typeof userMsg.content === "string" ? userMsg.content : JSON.stringify(userMsg.content), ts: nowIso() });
        await kvPut(env, ckey, conv);
        await indexAdd(env, `convindex:${userId}`, convId);
      }
      
      // Create streaming response with conversation ID.
      // onComplete persists the assistant reply + usage once the model returns,
      // so streamed chats show up in history exactly like non-streamed ones.
      const stream = await streamCompletion(env, {
        messages,
        modelId: body.modelId,
        userId,
        options: {
          task: body.task,
          policy: response.policy,
          maxTokens: response.maxTokens,
          temperature: body.temperature ?? 0.7,
          conversationId: convId,
          text: messages.filter(x => x.role === "user").map(x => typeof x.content === "string" ? x.content : "").join(" "),
          onComplete: async (res) => {
            try {
              const { trackPlatformUsage } = await import("../ops/monitor.js");
              await trackPlatformUsage(env, {
                userId, modelId: res.modelId, model: res.model, providerName: res.providerName,
                promptTokens: res.promptTokens, completionTokens: res.completionTokens,
                cost: res.cost, latency: res.latency, ok: true, task: res.task
              });
            } catch (e) { }
            if (!convId || body.save === false) return;
            const ckey = `conv:${userId}:${convId}`;
            const conv = await kvGet(env, ckey, null);
            if (!conv) return;
            conv.messages.push({
              id: newId("msg"), role: "assistant", content: res.text || "",
              model: res.model, modelId: res.modelId, provider: res.providerName,
              latency: res.latency, ts: nowIso()
            });
            if (conv.title === "گفتگوی جدید" && conv.messages.length >= 2) {
              const first = conv.messages.find(x => x.role === "user")?.content || "";
              conv.title = String(first).replace(/\s+/g, " ").slice(0, 48) || "گفتگو";
            }
            conv.updatedAt = nowIso();
            await kvPut(env, ckey, conv);
          }
        }
      });

      return createSSEResponse(stream);
    }

    // ── conversations (Mini App chat history) ─
    // KV reads can be served stale for up to 60s after a write, so deletes are
    // recorded as tombstones and filtered out of the listing. Without this a
    // just-deleted conversation reappears on the next refresh.
    if (path === "/conversations" && method === "GET") {
      const [ids, tombs] = await Promise.all([
        kvGet(env, `convindex:${userId}`, []),
        kvGet(env, `convtomb:${userId}`, [])
      ]);
      const dead = new Set(tombs || []);
      const live = (ids || []).filter(id => !dead.has(id));
      const rows = await readMany(env, live.map(id => `conv:${userId}:${id}`));
      const list = rows
        .filter(c => c && !c.archived && !c.deleted && !dead.has(c.id))
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
        .map(c => ({
          id: c.id, title: c.title, folder: c.folder, pinned: !!c.pinned, favorite: !!c.favorite,
          updatedAt: c.updatedAt, createdAt: c.createdAt,
          preview: (c.messages || []).filter(m => m.role === "user").slice(-1)[0]?.content?.slice(0, 80) || "",
          count: (c.messages || []).length
        }));
      return ok(list);
    }
    if (path === "/conversations" && method === "POST") {
      // Reuse the newest still-empty conversation instead of piling up blanks.
      if (body.reuseEmpty !== false) {
        const [ids, tombs] = await Promise.all([
          kvGet(env, `convindex:${userId}`, []),
          kvGet(env, `convtomb:${userId}`, [])
        ]);
        const dead = new Set(tombs || []);
        const rows = await readMany(env, (ids || []).filter(id => !dead.has(id)).map(id => `conv:${userId}:${id}`));
        const blank = rows
          .filter(c => c && !c.archived && !c.deleted && !dead.has(c.id) && !(c.messages || []).length)
          .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0];
        if (blank) return ok(blank);
      }
      const id = newId("conv");
      const conv = {
        id, userId, title: String(body.title || "گفتگوی جدید").slice(0, 80),
        messages: [], createdAt: nowIso(), updatedAt: nowIso(),
        pinned: false, favorite: false, folder: body.folder || "default", archived: false
      };
      await kvPut(env, `conv:${userId}:${id}`, conv);
      await indexAdd(env, `convindex:${userId}`, id);
      return ok(conv);
    }
    // Remove every empty conversation (cleanup for older blank rows)
    if (path === "/conversations/prune" && method === "POST") {
      const ids = await kvGet(env, `convindex:${userId}`, []);
      const rows = await readMany(env, ids.map(id => `conv:${userId}:${id}`));
      const blanks = rows.filter(c => c && !(c.messages || []).length);
      const tombs = await kvGet(env, `convtomb:${userId}`, []);
      const dead = new Set(tombs || []);
      for (const c of blanks) {
        dead.add(c.id);
        await kvPut(env, `conv:${userId}:${c.id}`, { id: c.id, userId, deleted: true, ts: nowIso() }, { expirationTtl: 300 });
        await indexRemove(env, `convindex:${userId}`, c.id);
      }
      if (blanks.length) await kvPut(env, `convtomb:${userId}`, [...dead].slice(-500), { expirationTtl: 604800 });
      return ok({ pruned: blanks.length });
    }
    // Delete every conversation at once (literal path must precede /conversations/:id)
    if (path === "/conversations/wipe" && method === "POST") {
      const ids = await kvGet(env, `convindex:${userId}`, []);
      const tombs = await kvGet(env, `convtomb:${userId}`, []);
      const dead = new Set(tombs || []);
      for (const id of ids || []) {
        dead.add(id);
        await kvPut(env, `conv:${userId}:${id}`, { id, userId, deleted: true, ts: nowIso() }, { expirationTtl: 300 });
      }
      await kvPut(env, `convtomb:${userId}`, [...dead].slice(-500), { expirationTtl: 604800 });
      await kvPut(env, `convindex:${userId}`, []);
      return ok({ deleted: (ids || []).length });
    }
    if ((m = match(path, "/conversations/:id")) && method === "GET") {
      const tombs = await kvGet(env, `convtomb:${userId}`, []);
      if ((tombs || []).indexOf(m.id) >= 0) return fail("گفتگو یافت نشد", 404);
      const conv = await kvGet(env, `conv:${userId}:${m.id}`, null);
      if (!conv || conv.deleted) return fail("گفتگو یافت نشد", 404);
      return ok(conv);
    }
    if ((m = match(path, "/conversations/:id")) && method === "PATCH") {
      const conv = await kvGet(env, `conv:${userId}:${m.id}`, null);
      if (!conv || conv.deleted) return fail("گفتگو یافت نشد", 404);
      if (body.title !== undefined) conv.title = String(body.title).slice(0, 80);
      if (body.pinned !== undefined) conv.pinned = !!body.pinned;
      if (body.favorite !== undefined) conv.favorite = !!body.favorite;
      if (body.folder !== undefined) conv.folder = String(body.folder).slice(0, 40);
      if (body.archived !== undefined) conv.archived = !!body.archived;
      if (body.clear) conv.messages = [];
      conv.updatedAt = nowIso();
      await kvPut(env, `conv:${userId}:${m.id}`, conv);
      return ok(conv);
    }
    if ((m = match(path, "/conversations/:id")) && method === "DELETE") {
      // Tombstone first: a stale read of the index or the row can't resurrect it.
      const tombs = await kvGet(env, `convtomb:${userId}`, []);
      const dead = new Set(tombs || []);
      dead.add(m.id);
      await kvPut(env, `convtomb:${userId}`, [...dead].slice(-500), { expirationTtl: 604800 });
      // Overwrite (not just delete) so any cached read returns a deleted marker.
      await kvPut(env, `conv:${userId}:${m.id}`, { id: m.id, userId, deleted: true, ts: nowIso() }, { expirationTtl: 300 });
      await indexRemove(env, `convindex:${userId}`, m.id);
      return ok({ deleted: true, id: m.id });
    }

    // ── AI Council ──────────────────────────
    if (path === "/council/modes" && method === "GET") {
      return ok({ modes: COUNCIL_MODES, roles: PANEL_ROLES });
    }
    if (path === "/council/estimate" && method === "POST") {
      return ok(await estimateCouncil(env, body));
    }
    if (path === "/council/run" && method === "POST") {
      if (!body.question && !body.goal) return fail("سوال لازم است");
      try {
        const run = await runCouncil(env, {
          question: body.question || body.goal,
          mode: body.mode || "independent",
          count: body.count || body.modelIds?.length || 3,
          modelIds: body.modelIds,
          rounds: body.rounds,
          judgeModelId: body.judgeModelId,
          userId,
          maxTokens: body.maxTokens,
          concurrency: body.concurrency || 4,
          task: body.task,
          autoPlan: body.autoPlan,
          costBudget: body.costBudget,
          maxCost: body.maxCost,
          maxModels: body.maxModels,
          maxRounds: body.maxRounds,
          ensureDiversity: body.ensureDiversity
        });
        return ok(run);
      } catch (e) {
        if (e?.needsApproval) {
          return new Response(JSON.stringify({
            ok: false,
            error: "Council run requires approval",
            data: {
              needsApproval: true,
              approvalRequestId: e.approvalRequestId,
              request: e.request,
              estimatedCost: e.estimatedCost,
              autoPlan: e.autoPlan
            }
          }), { status: 402, headers: JSON_HEADERS });
        }
        throw e;
      }
    }
    if (path === "/council/runs" && method === "GET") {
      return ok(await listCouncilRuns(env, userId, Number(q.limit || 20)));
    }
    if ((m = match(path, "/council/runs/:id")) && method === "GET") {
      const r = await getCouncilRun(env, m.id);
      return r ? ok(r) : fail("اجرای Council یافت نشد", 404);
    }
    if (path === "/council/configs" && method === "GET") return ok(await listCouncilConfigs(env, userId));
    if (path === "/council/configs" && method === "POST") return ok(await saveCouncilConfig(env, body, userId));
    if ((m = match(path, "/council/configs/:id")) && method === "DELETE") {
      return ok({ deleted: await deleteCouncilConfig(env, m.id) });
    }
    if (path === "/council/pick" && method === "POST") {
      const models = await pickCouncilModels(env, { count: body.count || 3, modelIds: body.modelIds, text: body.text || "", task: body.task });
      return ok(models.map(x => ({ id: x.id, name: x.displayName || x.apiModelId, provider: x.providerName, status: x.status })));
    }
    if (path === "/council/diversity" && method === "POST") {
      const models = body.modelIds ? (await Promise.all(body.modelIds.map(id => getModel(env, id)))).filter(Boolean) : [];
      const diversity = calculateDiversityMetrics(models);
      return ok(diversity);
    }
    if (path === "/council/plan" && method === "POST") {
      if (!body.question) return fail("سوال برای برنامه‌ریزی لازم است");
      const plan = planCouncil(body.question, {
        maxCost: body.maxCost || body.costBudget,
        maxModels: body.maxModels,
        maxRounds: body.maxRounds,
        timeout: body.timeout
      });
      return ok(plan);
    }
    if ((m = match(path, "/council/runs/:id/quality")) && method === "GET") {
      const run = await getCouncilRun(env, m.id);
      if (!run) return fail("اجرای Council یافت نشد", 404);
      if (!run.synthesis || !run.synthesis.quality) {
        return fail("تحلیل کیفیت برای این اجرا موجود نیست", 404);
      }
      return ok({
        runId: run.id,
        mode: run.mode,
        models: run.models.length,
        diversity: run.diversity,
        quality: run.synthesis.quality,
        synthesis: {
          consensus: run.synthesis.consensus,
          confidence: run.synthesis.confidence,
          agreement: run.synthesis.agreement,
          winner: run.synthesis.winner
        }
      });
    }

    // ── Council Templates (Phase 14) ────────────────────────
    if (path === "/council/templates" && method === "GET") {
      const templates = await listCouncilTemplates(env, userId);
      return ok(templates);
    }
    if (path === "/council/templates/builtin" && method === "GET") {
      return ok(Object.values(COUNCIL_TEMPLATES));
    }
    if ((m = match(path, "/council/templates/:id")) && method === "GET") {
      const template = await getCouncilTemplate(env, m.id);
      if (!template) return fail("Template not found", 404);
      return ok(template);
    }
    if (path === "/council/templates" && method === "POST") {
      if (!body.name) return fail("نام template لازم است");
      const template = await createCouncilTemplate(env, body, userId);
      return ok(template);
    }
    if ((m = match(path, "/council/templates/:id")) && method === "PATCH") {
      const template = await updateCouncilTemplate(env, m.id, body, userId);
      return ok(template);
    }
    if ((m = match(path, "/council/templates/:id")) && method === "DELETE") {
      const deleted = await deleteCouncilTemplate(env, m.id, userId);
      return ok({ deleted });
    }
    if ((m = match(path, "/council/templates/:id/duplicate")) && method === "POST") {
      const duplicate = await duplicateCouncilTemplate(env, m.id, userId, body);
      return ok(duplicate);
    }
    if ((m = match(path, "/council/templates/:id/instantiate")) && method === "POST") {
      const template = await getCouncilTemplate(env, m.id);
      if (!template) return fail("Template not found", 404);
      const config = instantiateFromTemplate(template, body);
      return ok(config);
    }
    if ((m = match(path, "/council/templates/:id/stats")) && method === "GET") {
      const stats = await getTemplateStats(env, m.id);
      return ok(stats);
    }
    if ((m = match(path, "/council/templates/:id/run")) && method === "POST") {
      const template = await getCouncilTemplate(env, m.id);
      if (!template) return fail("Template not found", 404);
      
      const config = instantiateFromTemplate(template, body);
      const run = await runCouncil(env, {
        question: body.question || body.goal,
        ...config,
        userId,
        templateId: m.id,
        metadata: { ...body.metadata, templateId: m.id }
      });
      return ok(run);
    }

    // ── NL infrastructure control ───────────
    if (path === "/nl" && method === "POST") {
      if (!body.text) return fail("متن دستور لازم است");
      const parsed = body.intent ? { intent: body.intent, args: body.args || {} } : await parseIntent(env, body.text);
      if (parsed.intent === "none") return ok({ intent: "none", message: "دستور زیرساختی تشخیص داده نشد" });
      const result = await execute(env, parsed, { userId, confirmed: !!body.confirmed });
      return ok({ intent: parsed.intent, confidence: parsed.confidence, result, needsConfirmation: result?.type === "confirm" });
    }

    // ── agents ──────────────────────────────
    if (path === "/agents" && method === "GET") return ok(await listAgents(env));
    if (path === "/agents" && method === "POST") return ok(await createAgent(env, body, userId));
    if (path === "/agents/runs" && method === "GET") return ok(await listRuns(env, Number(q.limit || 20)));
    if ((m = match(path, "/agents/:id")) && method === "GET") {
      const a = await getAgent(env, m.id);
      return a ? ok(a) : fail("عامل یافت نشد", 404);
    }
    if ((m = match(path, "/agents/:id")) && method === "PATCH") return ok(await updateAgent(env, m.id, body, userId));
    if ((m = match(path, "/agents/:id")) && method === "DELETE") return ok({ deleted: await deleteAgent(env, m.id, userId) });
    if ((m = match(path, "/agents/:id/duplicate")) && method === "POST") return ok(await duplicateAgent(env, m.id, userId));
    if ((m = match(path, "/agents/:id/run")) && method === "POST") {
      if (!body.goal) return fail("goal لازم است");
      const r = await runAgent(env, { agentId: m.id, goal: body.goal, userId, context: body.context, maxSteps: body.maxSteps, confirmDangerous: !!body.confirmDangerous });
      return ok(r);
    }
    if ((m = match(path, "/agents/runs/:id")) && method === "GET") {
      const r = await getRun(env, m.id);
      return r ? ok(r) : fail("اجرا یافت نشد", 404);
    }

    // ── tools & MCP ─────────────────────────
    if (path === "/mcp" && method === "GET") {
      const servers = await listMcpServers(env);
      return ok(servers.map(s => { const { enc, ...safe } = s; return safe; }));
    }
    if (path === "/mcp" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      return ok(await addMcpServer(env, body));
    }
    if ((m = match(path, "/mcp/:id")) && method === "DELETE") {
      if (!admin) return fail("فقط ادمین", 403);
      return ok(await deleteMcpServer(env, m.id));
    }
    if (path === "/mcp/sync" && method === "POST") return ok(await syncMcpTools(env));

    // ── knowledge / memory ──────────────────
    if (path === "/memory" && method === "GET") return ok(await listMemories(env, userId, q));
    if (path === "/memory" && method === "POST") {
      await addMemory(env, userId, body);
      return ok(await listMemories(env, userId));
    }
    if (path === "/memory/search" && method === "POST") return ok(await searchMemory(env, userId, body.query || "", body));
    if ((m = match(path, "/memory/:id")) && method === "PATCH") return ok(await updateMemory(env, userId, m.id, body.text));
    if ((m = match(path, "/memory/:id")) && method === "DELETE") return ok(await deleteMemory(env, userId, m.id));
    if (path === "/memory" && method === "DELETE") return ok(await clearMemories(env, userId, q.kind || null));

    // ── memory scoped (Phase 10) ────────────
    if (path === "/memory/scoped" && method === "GET") {
      const { listMemoriesScoped, MEMORY_SCOPES } = await import("../knowledge/memory.js");
      const scope = body.scope || q.scope || MEMORY_SCOPES.USER;
      const options = {
        scope,
        userId,
        conversationId: body.conversationId || q.conversationId,
        projectId: body.projectId || q.projectId,
        agentId: body.agentId || q.agentId,
        kind: body.kind || q.kind,
        q: body.q || q.q,
        role: admin ? "admin" : "user"
      };
      return ok(await listMemoriesScoped(env, options));
    }
    if (path === "/memory/scoped" && method === "POST") {
      const { addMemoryScoped, MEMORY_SCOPES } = await import("../knowledge/memory.js");
      const scope = body.scope || MEMORY_SCOPES.USER;
      const item = await addMemoryScoped(env, {
        scope,
        text: body.text,
        kind: body.kind,
        userId,
        conversationId: body.conversationId,
        projectId: body.projectId,
        agentId: body.agentId,
        source: body.source || "user",
        embed: body.embed !== false,
        role: admin ? "admin" : "user"
      });
      return ok(item);
    }
    if ((m = match(path, "/memory/scoped/:id")) && method === "PATCH") {
      const { updateMemoryScoped, MEMORY_SCOPES } = await import("../knowledge/memory.js");
      const scope = body.scope || MEMORY_SCOPES.USER;
      const updated = await updateMemoryScoped(env, m.id, body.text, {
        scope,
        userId,
        conversationId: body.conversationId,
        projectId: body.projectId,
        agentId: body.agentId,
        role: admin ? "admin" : "user"
      });
      return ok(updated);
    }
    if ((m = match(path, "/memory/scoped/:id")) && method === "DELETE") {
      const { deleteMemoryScoped, MEMORY_SCOPES } = await import("../knowledge/memory.js");
      const scope = body.scope || q.scope || MEMORY_SCOPES.USER;
      const result = await deleteMemoryScoped(env, m.id, {
        scope,
        userId,
        conversationId: body.conversationId || q.conversationId,
        projectId: body.projectId || q.projectId,
        agentId: body.agentId || q.agentId,
        role: admin ? "admin" : "user"
      });
      return ok(result);
    }
    if (path === "/memory/scoped/clear" && method === "POST") {
      const { clearMemoriesScoped, MEMORY_SCOPES } = await import("../knowledge/memory.js");
      const scope = body.scope || MEMORY_SCOPES.USER;
      const result = await clearMemoriesScoped(env, {
        scope,
        userId,
        conversationId: body.conversationId,
        projectId: body.projectId,
        agentId: body.agentId,
        kind: body.kind,
        role: admin ? "admin" : "user"
      });
      return ok(result);
    }
    if (path === "/memory/scoped/search" && method === "POST") {
      const { searchMemoryScoped, MEMORY_SCOPES } = await import("../knowledge/memory.js");
      const scopes = body.scopes || [MEMORY_SCOPES.USER, MEMORY_SCOPES.PROJECT, MEMORY_SCOPES.KNOWLEDGE_BASE];
      const results = await searchMemoryScoped(env, body.query || "", {
        scopes,
        topK: body.topK || 5,
        userId,
        conversationId: body.conversationId,
        projectId: body.projectId,
        agentId: body.agentId,
        role: admin ? "admin" : "user"
      });
      return ok(results);
    }
    if (path === "/memory/scoped/stats" && method === "GET") {
      const { getMemoryStats, MEMORY_SCOPES } = await import("../knowledge/memory.js");
      const scope = q.scope || MEMORY_SCOPES.USER;
      const stats = await getMemoryStats(env, {
        scope,
        userId,
        conversationId: q.conversationId,
        projectId: q.projectId,
        agentId: q.agentId,
        role: admin ? "admin" : "user"
      });
      return ok(stats);
    }
    if (path === "/memory/scoped/merge" && method === "POST") {
      const { mergeConversationMemories } = await import("../knowledge/memory.js");
      if (!body.conversationId) return fail("conversationId required");
      const result = await mergeConversationMemories(env, body.conversationId, userId, {
        role: admin ? "admin" : "user"
      });
      return ok(result);
    }
    if (path === "/memory/scopes" && method === "GET") {
      const { MEMORY_SCOPES } = await import("../knowledge/memory.js");
      return ok({ scopes: MEMORY_SCOPES });
    }
    if (path === "/graph" && method === "GET") return ok(await getGraph(env, userId));
    if (path === "/graph" && method === "POST") return ok(await addGraphEdge(env, userId, body));
    if (path === "/graph" && method === "DELETE") return ok(await deleteGraph(env, userId));

    if (path === "/knowledge" && method === "GET") {
      const docs = await kvGet(env, `kbindex:${userId}`, []);
      return ok(Array.isArray(docs) ? docs.map(d => ({ id: d.id, name: d.name, chunks: d.chunks, ts: d.ts })) : []);
    }
    if (path === "/knowledge" && method === "POST") {
      if (!ctx.ai.kbAddDocument) return fail("ماژول دانش در دسترس نیست", 501);
      if (!body.text) return fail("متن سند لازم است");
      const r = await ctx.ai.kbAddDocument(env, userId, String(body.name || "doc").slice(0, 60), String(body.text).slice(0, 200000));
      return ok(r);
    }
    if ((m = match(path, "/knowledge/:id")) && method === "DELETE") {
      const docs = await kvGet(env, `kbindex:${userId}`, []);
      const next = docs.filter(d => d.id !== m.id);
      await kvPut(env, `kbindex:${userId}`, next);
      await kvDel(env, `kb:doc:${userId}:${m.id}`);
      return ok({ deleted: docs.length - next.length });
    }
    if (path === "/knowledge/search" && method === "POST") {
      if (!ctx.ai.kbSearch) return fail("ماژول دانش در دسترس نیست", 501);
      return ok(await ctx.ai.kbSearch(env, userId, body.query || "", Number(body.topK || 5)));
    }

    // ── projects ────────────────────────────
    if (path === "/projects" && method === "GET") return ok(await listProjects(env, userId));
    if (path === "/projects" && method === "POST") return ok(await createProject(env, userId, body));
    if ((m = match(path, "/projects/:id")) && method === "PATCH") return ok(await updateProject(env, m.id, body, userId));
    if ((m = match(path, "/projects/:id")) && method === "DELETE") return ok({ deleted: await deleteProject(env, m.id, userId) });

    // ── prompt lab ──────────────────────────
    if (path === "/promptlab" && method === "GET") return ok(await listPromptLab(env, userId));
    if (path === "/promptlab/optimize" && method === "POST") {
      if (!body.prompt) return fail("پرامپت لازم است");
      return ok(await optimizePrompt(env, userId, body.prompt, body));
    }
    if (path === "/promptlab/abtest" && method === "POST") return ok(await abTestPrompt(env, userId, body));

    // ── automations & workflows ─────────────
    if (path === "/tasks" && method === "GET") return ok(await listTasks(env, admin && q.all === "true" ? null : userId));
    if (path === "/tasks" && method === "POST") {
      if (body.naturalLanguage) return ok(await taskFromNaturalLanguage(env, body.naturalLanguage, { userId, chatId: body.chatId || userId, tzOffsetMin: body.tzOffsetMin || 0 }));
      return ok(await createTask(env, { ...body, chatId: body.chatId || userId }, userId));
    }
    if ((m = match(path, "/tasks/:id")) && method === "PATCH") return ok(await updateTask(env, m.id, body, userId));
    if ((m = match(path, "/tasks/:id")) && method === "DELETE") return ok({ deleted: await deleteTask(env, m.id, userId) });
    if ((m = match(path, "/tasks/:id/run")) && method === "POST") {
      const t = await getTask(env, m.id);
      if (!t) return fail("تسک یافت نشد", 404);
      return ok(await runTask(env, t, { notify: ctx.tg.sendMessage }));
    }
    if (path === "/workflows" && method === "GET") return ok(await listWorkflows(env, admin && q.all === "true" ? null : userId));
    if (path === "/workflows" && method === "POST") {
      if (body.naturalLanguage) return ok(await workflowFromNaturalLanguage(env, body.naturalLanguage, userId));
      return ok(await createWorkflow(env, body, userId));
    }
    if ((m = match(path, "/workflows/:id")) && method === "GET") {
      const wf = await getWorkflow(env, m.id);
      return wf ? ok(wf) : fail("workflow یافت نشد", 404);
    }
    if ((m = match(path, "/workflows/:id")) && method === "PATCH") return ok(await updateWorkflow(env, m.id, body, userId));
    if ((m = match(path, "/workflows/:id")) && method === "DELETE") return ok({ deleted: await deleteWorkflow(env, m.id, userId) });
    if ((m = match(path, "/workflows/:id/run")) && method === "POST") {
      return ok(await runWorkflow(env, m.id, { userId, input: body.input || "", notify: ctx.tg.sendMessage, chatId: body.chatId || userId }));
    }

    // ── monitoring / usage / alerts / audit ──
    if (path === "/monitoring") {
      return ok({ snapshot: await snapshot(env), history: await monitorHistory(env, Number(q.days || 7)), ...(await healthOverview(env)) });
    }
    if (path === "/monitoring/sweep" && method === "POST") return ok(await healthSweep(env, { batch: Number(body.batch || 5) }));
    if (path === "/usage") return ok(await usageRange(env, Number(q.days || 7)));
    if (path === "/alerts" && method === "GET") return ok({ rules: await listAlertRules(env), events: await listAlertEvents(env, 50) });
    if (path === "/alerts" && method === "POST") return ok(await addAlertRule(env, { ...body, chatId: body.chatId || userId }, userId));
    if ((m = match(path, "/alerts/:id")) && method === "DELETE") return ok(await deleteAlertRule(env, m.id, userId));
    if (path === "/alerts/evaluate" && method === "POST") return ok(await evaluateAlerts(env, { notify: ctx.tg.sendMessage, adminChatId: adminId }));
    if (path === "/audit") {
      if (!admin) return fail("فقط ادمین", 403);
      return ok(await auditRead(env, Number(q.days || 7), Number(q.limit || 200)));
    }

    // ── global search ───────────────────────
    if (path === "/search") {
      const needle = String(q.q || "").toLowerCase();
      if (!needle) return ok({ results: [] });
      const [models, providers, agents, projects, workflows, mems] = await Promise.all([
        listModels(env), listProviders(env), listAgents(env), listProjects(env, userId), listWorkflows(env, userId), listMemories(env, userId)
      ]);
      const hit = (type, id, title, subtitle) => ({ type, id, title, subtitle });
      const results = [
        ...models.filter(x => `${x.displayName} ${x.apiModelId}`.toLowerCase().includes(needle)).slice(0, 10).map(x => hit("model", x.id, x.displayName, `${x.providerName} · ${x.status}`)),
        ...providers.filter(x => `${x.name} ${x.baseUrl}`.toLowerCase().includes(needle)).slice(0, 6).map(x => hit("provider", x.id, x.name, x.baseUrl)),
        ...agents.filter(x => `${x.name} ${x.description}`.toLowerCase().includes(needle)).slice(0, 6).map(x => hit("agent", x.id, x.name, x.description)),
        ...projects.filter(x => x.name.toLowerCase().includes(needle)).slice(0, 5).map(x => hit("project", x.id, x.name, x.description)),
        ...workflows.filter(x => x.name.toLowerCase().includes(needle)).slice(0, 5).map(x => hit("workflow", x.id, x.name, x.description)),
        ...mems.filter(x => x.text.toLowerCase().includes(needle)).slice(0, 5).map(x => hit("memory", x.id, x.text.slice(0, 60), x.kind))
      ];
      return ok({ results });
    }

    // ── benchmarks list ─────────────────────
    if (path === "/benchmarks" && method === "GET") return ok(await listBenchmarks(env, Number(q.limit || 20)));
    if ((m = match(path, "/benchmarks/:id")) && method === "GET") {
      const b = await getBenchmark(env, m.id);
      return b ? ok(b) : fail("بنچمارک یافت نشد", 404);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 35: SSE Streaming
    // ──────────────────────────────────────────────────────────────
    if (path === "/stream/completion" && method === "POST") {
      const stream = await streamCompletion(env, {
        messages: body.messages,
        modelId: body.modelId,
        userId,
        options: body.options || {}
      });
      return createSSEResponse(stream);
    }
    if (path === "/stream/active" && method === "GET") {
      const streams = await getActiveStreams(env, userId);
      return ok(streams);
    }
    if ((m = match(path, "/stream/:id/cancel")) && method === "POST") {
      await cancelStream(env, m.id);
      return ok({ cancelled: true });
    }
    if ((m = match(path, "/stream/:id/status")) && method === "GET") {
      const status = await getStreamStatus(env, m.id);
      if (!status) return fail("Stream یافت نشد", 404);
      return ok(status);
    }
    if (path === "/stream/stats" && method === "GET") {
      const stats = await getStreamingStats(env, { hours: Number(q.hours || 24) });
      return ok(stats);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 36: Webhooks
    // ──────────────────────────────────────────────────────────────
    if (path === "/webhooks" && method === "GET") {
      const webhooks = await listWebhooks(env, {
        userId: admin ? q.userId : userId,
        event: q.event
      });
      return ok(webhooks.map(stripWebhookSecret));
    }
    if (path === "/webhooks" && method === "POST") {
      const webhook = await createWebhook(env, {
        url: body.url,
        events: body.events,
        secret: body.secret,
        enabled: body.enabled !== false,
        description: body.description,
        userId
      });
      return ok(webhook);
    }
    if (path === "/webhooks/events" && method === "GET") {
      return ok({ events: WEBHOOK_EVENTS });
    }
    if ((m = match(path, "/webhooks/:id")) && method === "GET") {
      const webhook = await getWebhook(env, m.id);
      if (!webhook) return fail("Webhook یافت نشد", 404);
      return ok(stripWebhookSecret(webhook));
    }
    if ((m = match(path, "/webhooks/:id")) && method === "PATCH") {
      const webhook = await updateWebhook(env, m.id, body, userId);
      return ok(stripWebhookSecret(webhook));
    }
    if ((m = match(path, "/webhooks/:id")) && method === "DELETE") {
      await deleteWebhook(env, m.id, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/webhooks/:id/rotate-secret")) && method === "POST") {
      const result = await rotateWebhookSecret(env, m.id, userId);
      return ok(result);
    }
    if ((m = match(path, "/webhooks/:id/test")) && method === "POST") {
      const result = await testWebhook(env, m.id, userId);
      return ok(result);
    }
    if ((m = match(path, "/webhooks/:id/deliveries")) && method === "GET") {
      const deliveries = await listWebhookDeliveries(env, {
        webhookId: m.id,
        limit: Number(q.limit || 50)
      });
      return ok(deliveries);
    }
    if ((m = match(path, "/webhooks/:id/stats")) && method === "GET") {
      const stats = await getWebhookStats(env, {
        webhookId: m.id,
        days: Number(q.days || 7)
      });
      return ok(stats);
    }
    if ((m = match(path, "/webhook-deliveries/:id/retry")) && method === "POST") {
      const result = await retryWebhookDelivery(env, m.id, userId);
      return ok(result);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 37: Plugin System
    // ──────────────────────────────────────────────────────────────
    if (path === "/plugins" && method === "GET") {
      if (!admin) return fail("فقط ادمین", 403);
      const plugins = await listPlugins(env);
      return ok(plugins);
    }
    if (path === "/plugins" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const plugin = await registerPlugin(env, {
        name: body.name,
        type: body.type,
        code: body.code,
        manifest: body.manifest,
        userId
      });
      return ok(plugin);
    }
    if ((m = match(path, "/plugins/:id/enable")) && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const plugin = await enablePlugin(env, m.id);
      return ok(plugin);
    }
    if ((m = match(path, "/plugins/:id/disable")) && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const plugin = await disablePlugin(env, m.id);
      return ok(plugin);
    }
    if ((m = match(path, "/plugins/:id/execute")) && method === "POST") {
      const result = await executePlugin(env, m.id, body.input);
      return ok(result);
    }
    if (path === "/plugins/types" && method === "GET") {
      return ok({ types: PLUGIN_TYPES });
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 38: CLI Tool
    // ──────────────────────────────────────────────────────────────
    if (path === "/cli/spec" && method === "GET") {
      const spec = generateCLISpec();
      return ok(spec);
    }
    if (path === "/cli/commands" && method === "GET") {
      return ok({ commands: CLI_COMMANDS });
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 39: SDK Generation
    // ──────────────────────────────────────────────────────────────
    if (path === "/sdk/spec" && method === "GET") {
      const spec = generateSDKSpec([]);
      return ok(spec);
    }
    if (path === "/sdk/typescript" && method === "GET") {
      const sdk = generateTypeScriptSDK();
      return new Response(sdk, { headers: { "Content-Type": "text/plain" } });
    }
    if (path === "/sdk/python" && method === "GET") {
      const sdk = generatePythonSDK();
      return new Response(sdk, { headers: { "Content-Type": "text/plain" } });
    }
    if (path === "/sdk/languages" && method === "GET") {
      return ok({ languages: SDK_LANGUAGES });
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 30: Vector Search (Vectorize Integration)
    // ──────────────────────────────────────────────────────────────
    if (path === "/vector/indexes" && method === "GET") {
      const indexes = await listVectorIndexes(env);
      return ok(indexes);
    }
    if (path === "/vector/indexes" && method === "POST") {
      const index = await createVectorIndex(env, {
        name: body.name,
        dimensions: body.dimensions || 1536,
        metric: body.metric || "cosine",
        description: body.description,
        userId
      });
      return ok(index);
    }
    if ((m = match(path, "/vector/indexes/:id")) && method === "GET") {
      const index = await getVectorIndex(env, m.id);
      if (!index) return fail("Vector index یافت نشد", 404);
      return ok(index);
    }
    if ((m = match(path, "/vector/indexes/:id")) && method === "DELETE") {
      await deleteVectorIndex(env, m.id, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/vector/indexes/:id/vectors")) && method === "POST") {
      const result = await insertVectors(env, m.id, body.vectors);
      return ok(result);
    }
    if ((m = match(path, "/vector/indexes/:id/query")) && method === "POST") {
      const results = await queryVectors(env, m.id, {
        vector: body.vector,
        topK: body.topK || 10,
        includeMetadata: body.includeMetadata !== false,
        filter: body.filter
      });
      return ok(results);
    }
    if ((m = match(path, "/vector/indexes/:indexId/vectors/:vectorId")) && method === "GET") {
      const vector = await getVector(env, m.indexId, m.vectorId);
      if (!vector) return fail("Vector یافت نشد", 404);
      return ok(vector);
    }
    if ((m = match(path, "/vector/indexes/:indexId/vectors/:vectorId")) && method === "DELETE") {
      await deleteVector(env, m.indexId, m.vectorId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/vector/indexes/:id/stats")) && method === "GET") {
      const stats = await getVectorStats(env, m.id);
      return ok(stats);
    }
    if ((m = match(path, "/vector/indexes/:id/cluster")) && method === "POST") {
      const result = await clusterVectors(env, m.id, {
        k: body.k || 5,
        maxIterations: body.maxIterations || 100
      });
      return ok(result);
    }
    if (path === "/vector/embed" && method === "POST") {
      const embedding = await generateEmbedding(env, {
        text: body.text,
        modelId: body.modelId,
        userId
      });
      return ok({ embedding });
    }
    if (path === "/vector/semantic-search" && method === "POST") {
      const results = await semanticSearch(env, {
        indexId: body.indexId,
        query: body.query,
        embeddingModelId: body.embeddingModel,
        topK: body.topK || 10,
        filter: body.filter,
        userId
      });
      return ok(results);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 31: RAG Pipeline
    // ──────────────────────────────────────────────────────────────
    if (path === "/rag/knowledge-bases" && method === "GET") {
      const kbs = await listKnowledgeBases(env, { userId: admin ? null : userId });
      return ok(kbs);
    }
    if (path === "/rag/knowledge-bases" && method === "POST") {
      const kb = await createKnowledgeBase(env, {
        name: body.name,
        description: body.description,
        embeddingModel: body.embeddingModel,
        userId
      });
      return ok(kb);
    }
    if ((m = match(path, "/rag/knowledge-bases/:id")) && method === "GET") {
      const kb = await getKnowledgeBase(env, m.id);
      if (!kb) return fail("Knowledge base یافت نشد", 404);
      return ok(kb);
    }
    if ((m = match(path, "/rag/knowledge-bases/:id")) && method === "DELETE") {
      await deleteKnowledgeBase(env, m.id, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/rag/knowledge-bases/:id/documents")) && method === "GET") {
      const docs = await listKbDocuments(env, m.id);
      return ok(docs);
    }
    if ((m = match(path, "/rag/knowledge-bases/:id/documents")) && method === "POST") {
      const result = await addKbDocument(env, {
        kbId: m.id,
        content: body.content,
        title: body.title,
        source: body.source,
        metadata: body.metadata,
        chunkingStrategy: body.chunkingStrategy || "smart",
        userId
      });
      return ok(result);
    }
    if ((m = match(path, "/rag/knowledge-bases/:kbId/documents/:docId")) && method === "DELETE") {
      await deleteKbDocument(env, m.kbId, m.docId, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/rag/knowledge-bases/:id/query")) && method === "POST") {
      const result = await ragQuery(env, {
        kbId: m.id,
        query: body.query,
        topK: body.topK || 5,
        generationModel: body.generationModel,
        systemPrompt: body.systemPrompt,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        userId
      });
      return ok(result);
    }
    if ((m = match(path, "/rag/knowledge-bases/:id/query/multihop")) && method === "POST") {
      const result = await multiHopRagQuery(env, {
        kbId: m.id,
        query: body.query,
        maxHops: body.maxHops || 3,
        topKPerHop: body.topKPerHop || 3,
        generationModel: body.generationModel,
        userId
      });
      return ok(result);
    }
    if ((m = match(path, "/rag/knowledge-bases/:id/stats")) && method === "GET") {
      const stats = await getRagStats(env, m.id);
      return ok(stats);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 32: Document Processing
    // ──────────────────────────────────────────────────────────────
    if (path === "/documents" && method === "GET") {
      const docs = await listUploadedDocuments(env, {
        format: q.format,
        userId: admin ? q.userId : userId,
        limit: Number(q.limit || 100)
      });
      return ok(docs);
    }
    if (path === "/documents" && method === "POST") {
      const doc = await uploadDocument(env, {
        filename: body.filename,
        content: body.content,
        mimeType: body.mimeType,
        metadata: body.metadata,
        userId
      });
      return ok(doc);
    }
    if (path === "/documents/stats" && method === "GET") {
      const stats = await getDocumentStats(env);
      return ok(stats);
    }
    if (path === "/documents/formats" && method === "GET") {
      return ok({ formats: SUPPORTED_FORMATS });
    }
    if ((m = match(path, "/documents/:id")) && method === "GET") {
      const doc = await getUploadedDocument(env, m.id);
      if (!doc) return fail("Document یافت نشد", 404);
      return ok(doc);
    }
    if ((m = match(path, "/documents/:id")) && method === "DELETE") {
      await deleteUploadedDocument(env, m.id, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/documents/:id/content")) && method === "GET") {
      const content = await getDocumentContent(env, m.id);
      if (!content) return fail("Content یافت نشد", 404);
      return new Response(content, { headers: { "Content-Type": "application/octet-stream" } });
    }
    if ((m = match(path, "/documents/:id/process")) && method === "POST") {
      const doc = await processDocument(env, m.id, userId);
      return ok(doc);
    }
    if (path === "/documents/batch-process" && method === "POST") {
      const result = await batchProcessDocuments(env, {
        docIds: body.docIds,
        userId
      });
      return ok(result);
    }
    if ((m = match(path, "/documents/:id/analyze")) && method === "GET") {
      const analysis = await analyzeDocument(env, m.id);
      return ok(analysis);
    }
    if ((m = match(path, "/documents/:id/entities")) && method === "GET") {
      const entities = await extractEntities(env, m.id);
      return ok(entities);
    }
    if (path === "/documents/compare" && method === "POST") {
      const comparison = await compareDocuments(env, body.docId1, body.docId2);
      return ok(comparison);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 33: Semantic Cache
    // ──────────────────────────────────────────────────────────────
    if (path === "/cache/semantic/stats" && method === "GET") {
      const stats = await getSemanticCacheStats(env);
      return ok(stats);
    }
    if (path === "/cache/semantic/invalidate" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const result = await semanticCacheInvalidate(env, {
        pattern: body.pattern,
        olderThan: body.olderThan
      });
      return ok(result);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 34: Query Optimizer
    // ──────────────────────────────────────────────────────────────
    if (path === "/optimizer/analyze" && method === "POST") {
      const complexity = analyzeQueryComplexity(body.query);
      const types = detectQueryType(body.query);
      const suggestions = suggestPromptImprovements(body.query);
      return ok({ complexity, types, suggestions });
    }
    if (path === "/optimizer/decompose" && method === "POST") {
      const result = await decomposeQuery(env, {
        query: body.query,
        modelId: body.modelId,
        userId
      });
      return ok(result);
    }
    if (path === "/optimizer/rewrite" && method === "POST") {
      const result = await rewriteQuery(env, {
        query: body.query,
        context: body.context,
        modelId: body.modelId,
        userId
      });
      return ok(result);
    }
    if (path === "/optimizer/optimize-prompt" && method === "POST") {
      const result = await optimizeQueryPrompt(env, {
        prompt: body.prompt,
        objective: body.objective || "clarity",
        modelId: body.modelId,
        userId
      });
      return ok(result);
    }
    if (path === "/optimizer/expand-abbreviations" && method === "POST") {
      const result = expandAbbreviations(body.query);
      return ok(result);
    }
    if (path === "/optimizer/strategy" && method === "POST") {
      const result = await optimizeQueryExecution(env, {
        query: body.query,
        modelId: body.modelId,
        userId
      });
      return ok(result);
    }
    if (path === "/optimizer/stats" && method === "GET") {
      const stats = await getOptimizationStats(env);
      return ok(stats);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 25: Multi-Tenancy
    // ──────────────────────────────────────────────────────────────
    if (path === "/tenants" && method === "GET") {
      if (!admin) return fail("فقط ادمین", 403);
      const tenants = await listTenants(env, {
        status: q.status,
        plan: q.plan,
        limit: Number(q.limit || 100)
      });
      return ok(tenants);
    }
    if (path === "/tenants" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const tenant = await createTenant(env, {
        name: body.name,
        slug: body.slug,
        ownerId: body.ownerId || userId,
        settings: body.settings,
        metadata: body.metadata
      });
      return ok(tenant);
    }
    if (path === "/tenants/plans" && method === "GET") {
      return ok({ plans: TENANT_PLANS });
    }
    if ((m = match(path, "/tenants/:id")) && method === "GET") {
      const tenant = await getTenant(env, m.id);
      if (!tenant) return fail("Tenant یافت نشد", 404);
      return ok(tenant);
    }
    if ((m = match(path, "/tenants/:id")) && method === "PATCH") {
      if (!admin) return fail("فقط ادمین", 403);
      const tenant = await updateTenant(env, m.id, body, userId);
      return ok(tenant);
    }
    if ((m = match(path, "/tenants/:id")) && method === "DELETE") {
      if (!admin) return fail("فقط ادمین", 403);
      await deleteTenant(env, m.id, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/tenants/:id/stats")) && method === "GET") {
      const stats = await getTenantStats(env, m.id);
      return ok(stats);
    }
    if ((m = match(path, "/tenants/:id/members")) && method === "GET") {
      const members = await listTenantMembers(env, m.id, { role: q.role });
      return ok(members);
    }
    if ((m = match(path, "/tenants/:id/members")) && method === "POST") {
      const member = await addTenantMember(env, {
        tenantId: m.id,
        userId: body.userId,
        role: body.role || "member",
        invitedBy: userId
      });
      return ok(member);
    }
    if ((m = match(path, "/tenants/:id/members/:userId")) && method === "DELETE") {
      await removeTenantMember(env, m.id, m.userId, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/tenants/:id/members/:userId/role")) && method === "PUT") {
      const member = await updateMemberRole(env, m.id, m.userId, body.role, userId);
      return ok(member);
    }
    if ((m = match(path, "/tenants/:id/invites")) && method === "POST") {
      const invite = await createTenantInvite(env, {
        tenantId: m.id,
        email: body.email,
        role: body.role || "member",
        invitedBy: userId
      });
      return ok(invite);
    }
    if (path === "/tenants/accept-invite" && method === "POST") {
      const result = await acceptTenantInvite(env, body.token, userId);
      return ok(result);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 26: RBAC
    // ──────────────────────────────────────────────────────────────
    if ((m = match(path, "/tenants/:tenantId/roles")) && method === "GET") {
      const roles = await listRoles(env, m.tenantId);
      return ok(roles);
    }
    if ((m = match(path, "/tenants/:tenantId/roles")) && method === "POST") {
      const role = await createRole(env, {
        tenantId: m.tenantId,
        name: body.name,
        description: body.description,
        permissions: body.permissions || [],
        createdBy: userId
      });
      return ok(role);
    }
    if ((m = match(path, "/tenants/:tenantId/roles/:roleId")) && method === "GET") {
      const role = await getRole(env, m.tenantId, m.roleId);
      if (!role) return fail("Role یافت نشد", 404);
      return ok(role);
    }
    if ((m = match(path, "/tenants/:tenantId/roles/:roleId")) && method === "PATCH") {
      const role = await updateRole(env, m.tenantId, m.roleId, body, userId);
      return ok(role);
    }
    if ((m = match(path, "/tenants/:tenantId/roles/:roleId")) && method === "DELETE") {
      await deleteRole(env, m.tenantId, m.roleId, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/tenants/:tenantId/users/:userId/role")) && method === "PUT") {
      const assignment = await assignRole(env, {
        tenantId: m.tenantId,
        userId: m.userId,
        roleId: body.roleId,
        assignedBy: userId
      });
      return ok(assignment);
    }
    if ((m = match(path, "/tenants/:tenantId/users/:userId/permissions")) && method === "GET") {
      const permissions = await getUserPermissions(env, m.tenantId, m.userId);
      return ok({ permissions });
    }
    if ((m = match(path, "/tenants/:tenantId/resources/:resourceType/:resourceId/permissions")) && method === "GET") {
      const permissions = await listResourcePermissions(env, m.tenantId, m.resourceType, m.resourceId);
      return ok(permissions);
    }
    if ((m = match(path, "/tenants/:tenantId/resources/:resourceType/:resourceId/permissions")) && method === "POST") {
      const grant = await grantResourcePermission(env, {
        tenantId: m.tenantId,
        resourceType: m.resourceType,
        resourceId: m.resourceId,
        userId: body.userId,
        permission: body.permission,
        grantedBy: userId
      });
      return ok(grant);
    }
    if ((m = match(path, "/tenants/:tenantId/resources/:resourceType/:resourceId/permissions")) && method === "DELETE") {
      await revokeResourcePermission(env, {
        tenantId: m.tenantId,
        resourceType: m.resourceType,
        resourceId: m.resourceId,
        userId: body.userId,
        permission: body.permission,
        revokedBy: userId
      });
      return ok({ deleted: true });
    }
    if (path === "/rbac/permissions" && method === "GET") {
      return ok({ permissions: PERMISSIONS, roles: BUILTIN_ROLES });
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 27: SSO
    // ──────────────────────────────────────────────────────────────
    if ((m = match(path, "/tenants/:tenantId/sso")) && method === "GET") {
      const configs = await listSsoConfigs(env, m.tenantId);
      return ok(configs);
    }
    if ((m = match(path, "/tenants/:tenantId/sso")) && method === "POST") {
      const config = await createSsoConfig(env, {
        tenantId: m.tenantId,
        provider: body.provider,
        protocol: body.protocol,
        settings: body.settings,
        createdBy: userId
      });
      return ok(sanitizeSsoConfig(config));
    }
    if ((m = match(path, "/tenants/:tenantId/sso/:configId")) && method === "GET") {
      const config = await getSsoConfig(env, m.tenantId, m.configId);
      if (!config) return fail("SSO config یافت نشد", 404);
      return ok(sanitizeSsoConfig(config));
    }
    if ((m = match(path, "/tenants/:tenantId/sso/:configId")) && method === "PATCH") {
      const config = await updateSsoConfig(env, m.tenantId, m.configId, body, userId);
      return ok(sanitizeSsoConfig(config));
    }
    if ((m = match(path, "/tenants/:tenantId/sso/:configId")) && method === "DELETE") {
      await deleteSsoConfig(env, m.tenantId, m.configId, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/tenants/:tenantId/sso/:configId/initiate")) && method === "POST") {
      const result = await initiateSsoLogin(env, m.tenantId, m.configId, body.callbackUrl);
      return ok(result);
    }
    if (path === "/sso/callback" && method === "POST") {
      const result = await completeSsoLogin(env, {
        state: body.state,
        code: body.code,
        samlResponse: body.samlResponse
      });
      return ok(result);
    }
    if (path === "/sso/providers" && method === "GET") {
      return ok({ providers: OAUTH_PROVIDERS });
    }
    if ((m = match(path, "/users/:userId/identities")) && method === "GET") {
      if (!admin && m.userId !== String(userId)) return fail("فقط ادمین", 403);
      const identities = await getUserExternalIdentities(env, m.userId);
      return ok(identities);
    }
    if ((m = match(path, "/users/:userId/identities/:provider")) && method === "DELETE") {
      if (!admin && m.userId !== String(userId)) return fail("فقط ادمین", 403);
      await unlinkExternalIdentity(env, m.userId, m.provider);
      return ok({ deleted: true });
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 28: Data Residency
    // ──────────────────────────────────────────────────────────────
    if ((m = match(path, "/tenants/:tenantId/residency")) && method === "GET") {
      const residency = await getTenantResidency(env, m.tenantId);
      return ok(residency);
    }
    if ((m = match(path, "/tenants/:tenantId/residency")) && method === "PUT") {
      const residency = await setTenantResidency(env, m.tenantId, body.regionId, userId);
      return ok(residency);
    }
    if ((m = match(path, "/tenants/:tenantId/residency/report")) && method === "GET") {
      const report = await getResidencyReport(env, m.tenantId);
      return ok(report);
    }
    if ((m = match(path, "/tenants/:tenantId/compliance")) && method === "GET") {
      const status = await getComplianceStatus(env, m.tenantId);
      return ok(status);
    }
    if (path === "/residency/regions" && method === "GET") {
      return ok({ regions: DATA_REGIONS, classifications: DATA_CLASSIFICATIONS });
    }
    if (path === "/residency/transfer-check" && method === "POST") {
      const result = await checkDataTransfer(env, body.fromRegion, body.toRegion, body.dataClassification);
      return ok(result);
    }
    if (path === "/residency/transfer-requests" && method === "POST") {
      const request = await createDataTransferRequest(env, {
        tenantId: body.tenantId,
        fromRegion: body.fromRegion,
        toRegion: body.toRegion,
        dataType: body.dataType,
        dataClassification: body.dataClassification,
        justification: body.justification,
        requestedBy: userId
      });
      return ok(request);
    }
    if ((m = match(path, "/residency/transfer-requests/:id/approve")) && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const request = await approveDataTransferRequest(env, m.id, userId);
      return ok(request);
    }
    if ((m = match(path, "/residency/transfer-requests/:id/reject")) && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const request = await rejectDataTransferRequest(env, m.id, userId, body.reason);
      return ok(request);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 29: Compliance Audit Trails
    // ──────────────────────────────────────────────────────────────
    if (path === "/audit/export" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const exportData = await auditExport(env, {
        startDate: body.startDate,
        endDate: body.endDate,
        tenantId: body.tenantId,
        format: body.format || "json"
      });
      
      if (body.format === "csv") {
        return new Response(exportData, {
          headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=audit-logs.csv" }
        });
      }
      
      return ok(exportData);
    }
    if (path === "/audit/stats" && method === "GET") {
      if (!admin) return fail("فقط ادمین", 403);
      const stats = await auditStats(env, Number(q.days || 30), q.tenantId);
      return ok(stats);
    }
    if (path === "/audit/search" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const results = await auditSearch(env, {
        query: body.query,
        startDate: body.startDate,
        endDate: body.endDate,
        limit: body.limit || 100
      });
      return ok(results);
    }
    if (path === "/audit/compliance-report" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const report = await generateComplianceReport(env, {
        tenantId: body.tenantId,
        startDate: body.startDate,
        endDate: body.endDate,
        regulations: body.regulations || []
      });
      return ok(report);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 20: Observability Stack (OpenTelemetry)
    // ──────────────────────────────────────────────────────────────
    if (path === "/observability/dashboard" && method === "GET") {
      const hours = Number(q.hours || 24);
      const dashboard = await getObservabilityDashboard(env, { hours });
      return ok(dashboard);
    }
    if (path === "/observability/traces" && method === "GET") {
      const traces = await listTraces(env, {
        limit: Number(q.limit || 50),
        status: q.status,
        userId: admin ? q.userId : userId
      });
      return ok(traces);
    }
    if ((m = match(path, "/observability/traces/:id")) && method === "GET") {
      const trace = await getTrace(env, m.id);
      if (!trace) return fail("Trace یافت نشد", 404);
      return ok(trace);
    }
    if (path === "/observability/metrics" && method === "GET") {
      const metrics = await getMetricAggregations(env, {
        name: q.name,
        labels: q.labels ? JSON.parse(q.labels) : {}
      });
      return ok(metrics);
    }
    if (path === "/observability/metrics/timeseries" && method === "GET") {
      const timeSeries = await getMetricTimeSeries(env, {
        name: q.name,
        labels: q.labels ? JSON.parse(q.labels) : {},
        startTime: q.startTime ? Number(q.startTime) : undefined,
        endTime: q.endTime ? Number(q.endTime) : undefined,
        granularity: Number(q.granularity || 60000)
      });
      return ok(timeSeries);
    }
    if (path === "/observability/logs" && method === "GET") {
      const logs = await queryLogs(env, {
        level: q.level,
        startTime: q.startTime ? Number(q.startTime) : undefined,
        endTime: q.endTime ? Number(q.endTime) : undefined,
        traceId: q.traceId,
        userId: admin ? q.userId : userId,
        limit: Number(q.limit || 100)
      });
      return ok(logs);
    }
    if (path === "/observability/performance" && method === "GET") {
      const operations = q.operations ? q.operations.split(",") : ["completion", "chat", "embedding"];
      const summary = await getPerformanceSummary(env, { operations });
      return ok(summary);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 21: Cost Governance
    // ──────────────────────────────────────────────────────────────
    if (path === "/budgets" && method === "GET") {
      const budgets = await listBudgets(env, {
        scope: q.scope,
        scopeId: q.scopeId || userId
      });
      return ok(budgets);
    }
    if (path === "/budgets" && method === "POST") {
      if (!admin && body.scope === "global") return fail("فقط ادمین", 403);
      const budget = await createBudget(env, {
        name: body.name,
        scope: body.scope || "user",
        scopeId: body.scopeId || userId,
        limit: body.limit,
        period: body.period || "monthly",
        alertThresholds: body.alertThresholds || [75, 90, 100],
        userId
      });
      return ok(budget);
    }
    if ((m = match(path, "/budgets/:id")) && method === "GET") {
      const budget = await getBudget(env, m.id);
      if (!budget) return fail("Budget یافت نشد", 404);
      return ok(budget);
    }
    if ((m = match(path, "/budgets/:id")) && method === "PATCH") {
      const budget = await updateBudget(env, m.id, body, userId);
      return ok(budget);
    }
    if ((m = match(path, "/budgets/:id")) && method === "DELETE") {
      await deleteBudget(env, m.id, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/budgets/:id/reset")) && method === "POST") {
      const budget = await resetBudget(env, m.id);
      return ok(budget);
    }
    if (path === "/costs/summary" && method === "GET") {
      const summary = await getCostSummary(env, {
        scope: q.scope || "user",
        scopeId: q.scopeId || userId,
        startDate: q.startDate,
        endDate: q.endDate
      });
      return ok(summary);
    }
    if (path === "/costs/top-spenders" && method === "GET") {
      if (!admin) return fail("فقط ادمین", 403);
      const spenders = await getTopSpenders(env, {
        scope: q.scope || "user",
        period: Number(q.period || 7),
        limit: Number(q.limit || 10)
      });
      return ok(spenders);
    }
    if (path === "/costs/forecast" && method === "GET") {
      const forecast = await getCostForecast(env, {
        scope: q.scope || "user",
        scopeId: q.scopeId || userId,
        days: Number(q.days || 30)
      });
      return ok(forecast);
    }
    if (path === "/costs/alerts" && method === "GET") {
      const alerts = await getCostAlerts(env, {
        severity: q.severity,
        limit: Number(q.limit || 50)
      });
      return ok(alerts);
    }
    if (path === "/costs/export" && method === "GET") {
      const csv = await exportCosts(env, {
        scope: q.scope || "user",
        scopeId: q.scopeId || userId,
        startDate: q.startDate,
        endDate: q.endDate
      });
      return new Response(csv, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=costs.csv" }
      });
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 22: Smart Rate Limiting
    // ──────────────────────────────────────────────────────────────
    if (path === "/ratelimit/check" && method === "POST") {
      const tier = await getUserTier(env, userId);
      const result = await checkRateLimit(env, userId, {
        tier,
        cost: body.cost || 1
      });
      return ok(result);
    }
    if (path === "/ratelimit/quotas" && method === "GET") {
      const target = q.userId || userId;
      if (!admin && String(target) !== String(userId)) return fail("فقط ادمین", 403);
      const tier = await getUserTier(env, target);
      const quotas = await getUserQuotas(env, target, tier);
      return ok(quotas);
    }
    if (path === "/ratelimit/stats" && method === "GET") {
      if (!admin) return fail("فقط ادمین", 403);
      const stats = await getRateLimitStats(env, { hours: Number(q.hours || 24) });
      return ok(stats);
    }
    if (path === "/ratelimit/tiers" && method === "GET") {
      return ok({ tiers: USER_TIERS });
    }
    if ((m = match(path, "/users/:userId/tier")) && method === "GET") {
      if (!admin && m.userId !== String(userId)) return fail("فقط ادمین", 403);
      const tier = await getUserTier(env, m.userId);
      return ok({ userId: m.userId, tier });
    }
    if ((m = match(path, "/users/:userId/tier")) && method === "PUT") {
      if (!admin) return fail("فقط ادمین", 403);
      const tier = await setUserTier(env, m.userId, body.tier);
      return ok({ userId: m.userId, tier });
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 23: Enhanced Global Search
    // ──────────────────────────────────────────────────────────────
    if (path === "/search/advanced" && method === "POST") {
      const result = await advancedSearch(env, {
        query: body.query,
        userId,
        filters: body.filters || {},
        sort: body.sort || "relevance",
        limit: body.limit || 50,
        fuzzy: body.fuzzy !== false,
        includeTypes: body.includeTypes
      });
      
      // Record search
      await recordSearch(env, {
        query: body.query,
        userId,
        resultCount: result.results.length
      });
      
      return ok(result);
    }
    if (path === "/search/facets" && method === "GET") {
      const facets = await getSearchFacets(env, userId);
      return ok(facets);
    }
    if (path === "/search/suggestions" && method === "GET") {
      const suggestions = await getSearchSuggestions(env, {
        query: q.q || "",
        userId,
        limit: Number(q.limit || 10)
      });
      return ok(suggestions);
    }
    if (path === "/search/history" && method === "GET") {
      const history = await getSearchHistory(env, userId, {
        limit: Number(q.limit || 20)
      });
      return ok(history);
    }
    if (path === "/search/popular" && method === "GET") {
      const popular = await getPopularSearches(env, {
        limit: Number(q.limit || 10)
      });
      return ok(popular);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 15: Evaluation & Regression Testing
    // ──────────────────────────────────────────────────────────────
    if (path === "/eval/datasets" && method === "GET") {
      const datasets = await listEvalDatasets(env, userId);
      return ok(datasets);
    }
    if (path === "/eval/datasets" && method === "POST") {
      const dataset = await createEvalDataset(env, {
        name: body.name,
        description: body.description,
        category: body.category,
        tags: body.tags
      }, userId);
      return ok(dataset);
    }
    if ((m = match(path, "/eval/datasets/:id")) && method === "GET") {
      const dataset = await getEvalDataset(env, m.id);
      if (!dataset) return fail("Dataset یافت نشد", 404);
      return ok(dataset);
    }
    if ((m = match(path, "/eval/datasets/:id")) && method === "DELETE") {
      await deleteEvalDataset(env, m.id, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/eval/datasets/:id/cases")) && method === "POST") {
      const testCase = await addEvalCase(env, m.id, {
        question: body.question,
        input: body.input,
        expectedBehavior: body.expectedBehavior,
        expectedOutput: body.expectedOutput,
        criteria: body.criteria,
        context: body.context,
        tags: body.tags
      }, userId);
      return ok(testCase);
    }
    if ((m = match(path, "/eval/datasets/:datasetId/cases/:caseId")) && method === "PATCH") {
      const testCase = await updateEvalCase(env, m.datasetId, m.caseId, body, userId);
      return ok(testCase);
    }
    if ((m = match(path, "/eval/datasets/:datasetId/cases/:caseId")) && method === "DELETE") {
      await deleteEvalCase(env, m.datasetId, m.caseId, userId);
      return ok({ deleted: true });
    }
    if ((m = match(path, "/eval/datasets/:id/run")) && method === "POST") {
      const run = await runEvaluation(env, m.id, {
        type: body.type || (body.agentId ? "agent" : "model"),
        modelId: body.modelId,
        agentId: body.agentId,
        promptVersion: body.promptVersion,
        ...body.config
      }, { userId, batchSize: Number(body.batchSize) || undefined });
      return ok(run);
    }
    if (path === "/eval/runs" && method === "GET") {
      const runs = await listEvalRuns(env, {
        datasetId: q.datasetId,
        modelId: q.modelId,
        limit: Number(q.limit || 50)
      });
      return ok(runs);
    }
    if (path === "/eval/runs/compare" && method === "POST") {
      const comparison = await compareEvalRuns(env, body.runIds || []);
      return ok(comparison);
    }
    if ((m = match(path, "/eval/runs/:id")) && method === "GET") {
      const run = await getEvalRun(env, m.id);
      if (!run) return fail("Eval run یافت نشد", 404);
      return ok(run);
    }
    if (path === "/eval/criteria" && method === "GET") {
      return ok({ criteria: EVAL_CRITERIA });
    }
    if (path === "/eval/regression/auto" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const result = await autoRunRegression(env, body.triggerType || "model", body.triggerData || {
        modelIds: body.modelIds,
        datasetIds: body.datasetIds,
        threshold: body.threshold
      }, { userId, batchSize: Number(body.batchSize) || undefined });
      return ok(result);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 16: Prompt Versioning & A/B Testing
    // ──────────────────────────────────────────────────────────────
    if ((m = match(path, "/prompts/:id/versions")) && method === "GET") {
      const versions = await listPromptVersions(env, m.id);
      return ok(versions);
    }
    if ((m = match(path, "/prompts/:id/versions")) && method === "POST") {
      const version = await createPromptVersion(env, m.id, {
        content: body.content,
        systemPrompt: body.systemPrompt,
        parameters: body.parameters,
        modelId: body.modelId,
        tags: body.tags,
        changeLog: body.changeLog || body.changes,
        name: body.name,
        description: body.description
      }, userId);
      return ok(version);
    }
    if ((m = match(path, "/prompts/:id/versions/:version")) && method === "GET") {
      const version = await getPromptVersion(env, m.id, m.version);
      if (!version) return fail("Prompt version یافت نشد", 404);
      return ok(version);
    }
    if ((m = match(path, "/prompts/:id/rollback")) && method === "POST") {
      const result = await rollbackPromptVersion(env, m.id, body.targetVersion, userId);
      return ok(result);
    }
    if ((m = match(path, "/prompts/:id/compare")) && method === "POST") {
      const comparison = await comparePromptVersions(env, m.id, body.versionA, body.versionB);
      return ok(comparison);
    }
    if ((m = match(path, "/prompts/:id/abtest")) && method === "POST") {
      const result = await runPromptABTest(env, m.id, body.versions || [body.versionA, body.versionB].filter(Boolean), body.testCases || [], { userId, modelId: body.modelId });
      return ok(result);
    }
    if ((m = match(path, "/prompts/:id/optimize")) && method === "POST") {
      const result = await optimizePromptForModel(env, m.id, body.modelId, userId);
      return ok(result);
    }
    if ((m = match(path, "/prompts/:promptId/versions/:versionId/eval")) && method === "POST") {
      const result = await testPromptWithEval(env, m.promptId, m.versionId, body.datasetId, userId);
      return ok(result);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 17: Export/Import & Backup
    // ──────────────────────────────────────────────────────────────
    if (path === "/platform/export" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const exclude = [];
      if (body.includeProviders === false) exclude.push("providers");
      if (body.includeModels === false) exclude.push("models");
      if (body.includeAgents === false) exclude.push("agents");
      if (body.includeMemory === false) exclude.push("knowledge", "projects");
      if (body.includeAutomation === false) exclude.push("automation", "councils");
      if (body.includeConfig === false) exclude.push("routing", "settings");
      const exportData = await exportPlatformData(env, userId, { exclude });
      return ok(exportData);
    }
    if (path === "/platform/import" && method === "POST") {
      if (!admin) return fail("فقط ادمین", 403);
      const result = await importPlatformData(env, body.data, userId, {
        overwrite: body.mergeStrategy === "overwrite"
      });
      return ok(result);
    }
    if (path === "/resources/export" && method === "POST") {
      const exportData = await exportResource(env, body.resourceType, body.resourceIds || (body.resourceId ? [body.resourceId] : []), userId);
      return ok(exportData);
    }
    if (path === "/resources/import" && method === "POST") {
      const result = await importResource(env, body.resourceType, body.resources || body.data?.resources || [], userId, {
        overwrite: body.mergeStrategy === "overwrite"
      });
      return ok(result);
    }

    // ──────────────────────────────────────────────────────────────
    // Phase 18: Advanced Router with Multi-Factor Scoring
    // ──────────────────────────────────────────────────────────────
    if (path === "/router/advanced/select" && method === "POST") {
      const models = await advancedSelectModels(env, {
        ...(body.requirements || {}),
        ...(body.constraints || {}),
        userId
      });
      return ok(models);
    }
    if (path === "/router/policy" && method === "GET") {
      const policy = await getModelPolicy(env, {
        type: q.projectId ? "project" : "user",
        id: q.projectId || q.userId || userId
      });
      return ok(policy);
    }
    if (path === "/router/policy" && method === "POST") {
      const policy = await setModelPolicy(env, {
        type: body.projectId ? "project" : "user",
        id: body.projectId || body.targetUserId || userId
      }, body.policy || {}, userId);
      return ok(policy);
    }
    if (path === "/router/stats" && method === "GET") {
      const stats = await getRouterStats(env, admin && q.userId ? q.userId : userId);
      return ok(stats);
    }
    if (path === "/router/advanced" && method === "POST") {
      const result = await routeAdvanced(env, body.messages || [], {
        ...(body.requirements || {}),
        ...(body.constraints || {}),
        useAdvancedSelection: body.useAdvancedSelection !== false,
        userId
      });
      return ok(result);
    }

    return fail(`مسیر ${method} /api${path} وجود ندارد`, 404);
  } catch (e) {
    return fail(e, 500, "جزئیات در پیام خطا آمده — اگر تکرار شد لاگ Worker را ببینید");
  }
}

function slimModel(m) {
  return {
    id: m.id, name: m.displayName, apiModelId: m.apiModelId,
    providerId: m.providerId, provider: m.providerName,
    status: m.status, enabled: m.enabled, favorite: !!m.favorite,
    latency: m.latency ?? null, errorRate: m.errorRate ?? null,
    context: m.contextWindow ?? null, pricing: m.pricing || null, costPer1M: costPer1M(m),
    capabilities: Object.entries(m.capabilities || {}).filter(([, v]) => v.supported).map(([k]) => k),
    requests: m.stats?.req || 0, tokens: (m.stats?.tokensIn || 0) + (m.stats?.tokensOut || 0),
    tokensIn: m.stats?.tokensIn || 0, tokensOut: m.stats?.tokensOut || 0,
    cost: m.stats?.cost || 0, tags: m.tags || [],
    lastChecked: m.lastChecked || null, lastError: m.lastError || null,
    lastBenchmark: m.benchmarks?.[0]?.qualityScore ?? null
  };
}

function parseLines(text) {
  return String(text || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
}

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}
