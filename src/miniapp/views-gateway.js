export const VIEWS_GATEWAY = String.raw`
/* ═══════════ PROVIDERS ═══════════ */
function provIcon(baseUrl, format, name) {
  const s = ((baseUrl || "") + " " + (format || "") + " " + (name || "")).toLowerCase();
  if (s.includes("openai") || s.includes("chatgpt")) return "🤖";
  if (s.includes("anthropic") || s.includes("claude")) return "🧠";
  if (s.includes("gemini") || s.includes("google")) return "✨";
  if (s.includes("deepseek")) return "🔍";
  if (s.includes("groq")) return "⚡";
  if (s.includes("openrouter")) return "🌐";
  if (s.includes("mistral")) return "🌪️";
  if (s.includes("grok") || s.includes("x.ai")) return "🚀";
  if (s.includes("cohere")) return "🧬";
  if (s.includes("together")) return "🤝";
  if (s.includes("ollama")) return "🦙";
  return "🔮";
}
window.provIcon = provIcon;

async function viewProviders() {
  const list = await api("/providers");
  const healthy = list.filter(function (p) { return p.status === "healthy"; }).length;
  const totalModels = list.reduce(function (a, p) { return a + (p.modelCount || 0); }, 0);

  const head = '<div class="ph"><div class="ph-t">' +
    '<h2>پروایدرهای هوش مصنوعی</h2>' +
    '<p>' + n(list.length) + ' پروایدر · ' + n(totalModels) + ' مدل · ' + n(healthy) + ' سالم</p>' +
    '</div>' +
    '<div class="ph-a">' +
    '<button class="btn sm gho" onclick="providerBulk()">⧉ Bulk Import</button>' +
    '<button class="btn sm gho" onclick="providerDiagnose()">◍ عیب‌یابی</button>' +
    '<button class="btn pri sm" onclick="providerNew()">＋ افزودن</button>' +
    '</div></div>';

  if (!list.length) {
    return head + '<div class="card" style="text-align:center;padding:48px 20px;border-radius:20px;border:1px dashed var(--line);background:var(--surface);margin-top:12px;">' +
      '<div style="width:72px;height:72px;border-radius:22px;background:linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.18) 100%);border:1px solid var(--acc-line);display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px;">🤖</div>' +
      '<div style="font-size:18px;font-weight:800;margin-bottom:6px;color:var(--text)">هیچ Provider ثبت نشده</div>' +
      '<div style="font-size:13px;color:var(--muted);max-width:360px;margin:0 auto 20px;line-height:1.6;">برای استفاده از مدل‌های هوش مصنوعی (OpenAI, Claude, Gemini, DeepSeek و...) یک پروایدر آماده یا سفارشی اضافه کنید.</div>' +
      '<button class="btn pri" style="padding:10px 24px;font-size:14px;box-shadow:var(--sh2);" onclick="providerNew()">＋ افزودن اولین Provider</button>' +
      '</div>';
  }

  const cards = list.map(function (p) {
    const icon = provIcon(p.baseUrl, p.format, p.name);
    return '<div class="card prov-card mb-3" style="padding:14px;border-radius:16px;overflow:hidden;">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
        '<div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;cursor:pointer;" onclick="go(\'provider\',\'' + p.id + '\')">' +
          '<div style="width:42px;height:42px;border-radius:12px;background:rgba(99,102,241,0.12);border:1px solid var(--acc-line);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">' + icon + '</div>' +
          '<div style="min-width:0;flex:1;">' +
            '<div style="font-weight:700;font-size:15px;color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
              '<span>' + h(p.name) + '</span>' +
              (p.enabled === false ? '<span class="badge badge-mut" style="font-size:10px;">غیرفعال</span>' : '') +
            '</div>' +
            '<div class="mono ltr text-xs text-muted" style="margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">' + h(p.baseUrl) + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="flex-shrink:0;">' + statusBdg(p.status) + '</div>' +
      '</div>' +

      '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;background:var(--surface2);padding:8px 12px;border-radius:10px;border:1px solid var(--line);margin-bottom:12px;align-items:center;">' +
        '<div class="text-xs" style="color:var(--text2);display:flex;align-items:center;gap:4px;"><span style="color:var(--muted);">پروتکل:</span> <span class="badge badge-acc">' + h(p.format) + '</span></div>' +
        '<div class="text-xs" style="color:var(--text2);display:flex;align-items:center;gap:4px;"><span style="color:var(--muted);">کلیدها:</span> <b>' + n(p.keyCount) + '</b></div>' +
        '<div class="text-xs" style="color:var(--text2);display:flex;align-items:center;gap:4px;"><span style="color:var(--muted);">مدل‌ها:</span> <b style="color:' + (p.healthyModels ? 'var(--ok)' : 'var(--text)') + ';">' + n(p.healthyModels) + '/' + n(p.modelCount) + ' سالم</b></div>' +
        (p.health && p.health.successRate !== null && p.health.successRate !== undefined ? '<div class="text-xs" style="color:var(--text2);display:flex;align-items:center;gap:4px;"><span style="color:var(--muted);">موفقیت:</span> <b style="color:' + (p.health.successRate > 70 ? 'var(--ok)' : 'var(--warn)') + ';">' + pct(p.health.successRate) + '</b></div>' : '') +
        (p.health && p.health.avgLatency ? '<div class="text-xs" style="color:var(--text2);display:flex;align-items:center;gap:4px;"><span style="color:var(--muted);">تاخیر:</span> <b>' + ms(p.health.avgLatency) + '</b></div>' : '') +
      '</div>' +

      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn sm pri" style="flex:1;min-width:140px;" onclick="go(\'provider\',\'' + p.id + '\')">⚙ مدیریت و مدل‌ها</button>' +
        '<div style="display:flex;gap:6px;flex-shrink:0;">' +
          '<button class="btn sm" onclick="provTest(\'' + p.id + '\')">🧪 تست</button>' +
          '<button class="btn sm gho" onclick="provDiscover(\'' + p.id + '\')">↻ کشف مدل</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join("");

  return head + '<div class="prov-list">' + cards + '</div>';
}

async function viewProvider() {
  const id = S.params.id;
  const p = await api("/providers/" + id);
  const models = p.models || [];
  const tab = curTab("prov", "models");

  const head = '<div class="ph"><div class="ph-t">' +
    '<button class="btn sm gho mb8"' + act("go", "providers") + ">‹ Providers</button>" +
    "<h2>" + h(p.name) + " " + statusBdg(p.status) + "</h2>" +
    '<p class="mono ltr">' + h(p.baseUrl) + "</p></div>" +
    '<div class="ph-a">' +
    '<button class="btn sm"' + act("provTest", id) + ">◍ تست</button>" +
    '<button class="btn sm gho"' + act("provDiscover", id) + ">↻ کشف مدل</button>" +
    '<button class="btn sm gho"' + act("providerEdit", id) + ">✎ ویرایش</button>" +
    '<button class="btn sm dan"' + act("delEntity", "Provider", "/providers/" + id, "providers") + ">🗑</button>" +
    "</div></div>";

  const stats = '<div class="g g4 mb16">' +
    stat({ label: "Models", value: n(models.length), sub: n(models.filter(function (m) { return m.status === "healthy"; }).length) + " سالم", icon: "◆" }) +
    stat({ label: "Requests", value: n((p.health || {}).requests), sub: n((p.health || {}).errors) + " error", icon: "↗" }) +
    stat({ label: "Success", value: pct((p.health || {}).successRate), icon: "✓", kind: (p.health || {}).successRate > 90 ? "ok" : "warn" }) +
    stat({ label: "Latency", value: ms((p.health || {}).avgLatency), icon: "◷" }) +
    "</div>";

  const tabs = tabsBar("prov", [["models", "Models", models.length], ["keys", "API Keys", (p.keys || []).length], ["config", "Config"]]);

  let bodyHtml = "";
  if (tab === "models") {
    var enabledCount = models.filter(function(m){ return m.enabled !== false; }).length;
    var healthyCount = models.filter(function(m){ return m.status === "healthy"; }).length;
    var bulkBar = '<div class="bulk-bar mb-3" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 14px;border-radius:12px;background:var(--surface);border:1px solid var(--line);">' +
      '<button class="btn sm pri" onclick="modelNew(\'' + id + '\')">＋ افزودن مدل</button>' +
      '<div class="sp"></div>' +
      (models.length ? (
        '<button class="btn sm gho" onclick="bulkModels(\'' + id + '\',\'test\')">🧪 تست همه</button>' +
        '<button class="btn sm gho" onclick="bulkModels(\'' + id + '\',\'enable\')">✅ فعال همه</button>' +
        '<button class="btn sm gho" onclick="bulkModels(\'' + id + '\',\'disable\')">⛔ غیرفعال همه</button>' +
        '<button class="btn sm gho" onclick="enableHealthy(\'' + id + '\')">♻️ فعال سالم‌ها</button>'
      ) : '') +
      '</div>';
    var modelCards = models.length ? models.map(function(m) {
      var isEnabled = m.enabled !== false;
      var icon = m.status === "healthy" ? "🟢" : m.status === "degraded" ? "🟡" : m.status === "failed" ? "🔴" : "⚪";
      return '<div class="card model-card" style="padding:12px 14px;margin-bottom:8px;transition:all 0.15s ease;">' +
        '<div class="flex-between" style="align-items:center;gap:8px;">' +
          '<div style="flex:1;min-width:0;cursor:pointer;" onclick="go(\'model\',\'' + m.id + '\')">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
              '<span>' + icon + '</span>' +
              '<span class="font-bold" style="font-size:14px;color:' + (isEnabled ? 'var(--text)' : 'var(--muted)') + ';' + (!isEnabled ? 'text-decoration:line-through;opacity:0.6;' : '') + '">' + h(short(m.name || m.apiModelId, 32)) + '</span>' +
              statusBdg(m.status) +
              (!isEnabled ? '<span class="badge badge-mut" style="font-size:10px;">غیرفعال</span>' : '') +
            '</div>' +
            '<div class="mono ltr text-xs text-muted" style="margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;">' + h(m.apiModelId) + '</div>' +
            (m.latency || m.context ? '<div class="text-xs text-muted" style="margin-top:2px;">' + (m.latency ? ms(m.latency) : '') + (m.context ? ' · ' + n(m.context) + ' ctx' : '') + '</div>' : '') +
          '</div>' +
          '<div class="model-actions" style="display:flex;gap:4px;flex-shrink:0;">' +
            '<button class="btn sm gho" onclick="event.stopPropagation();modelCopyName(\'' + h(m.apiModelId).replace(/'/g, "\\'") + '\')" title="کپی نام مدل" style="padding:5px 7px;font-size:12px;">📋</button>' +
            '<button class="btn sm gho" onclick="event.stopPropagation();modelTestSingle(\'' + m.id + '\')" title="تست مدل" style="padding:5px 7px;font-size:12px;">🧪</button>' +
            '<button class="btn sm gho" onclick="event.stopPropagation();modelToggle(\'' + m.id + '\',' + (isEnabled ? 'true' : 'false') + ')" title="' + (isEnabled ? 'غیرفعال کردن' : 'فعال کردن') + '" style="padding:5px 7px;font-size:12px;">' + (isEnabled ? '⛔' : '✅') + '</button>' +
            '<button class="btn sm dan" onclick="event.stopPropagation();modelDelete(\'' + m.id + '\',\'' + h(short(m.name || m.apiModelId, 30)).replace(/'/g, "\\'") + '\')" title="حذف مدل" style="padding:5px 7px;font-size:12px;">🗑</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') : '<div class="empty" style="padding:32px 16px;text-align:center;"><div class="ei" style="font-size:36px;">◆</div><div class="et" style="margin:8px 0;">مدلی ثبت نشده</div><div class="es">با «کشف مدل» مدل‌های این Provider را خودکار پیدا کنید</div><button class="btn pri mt-3" onclick="provDiscover(\'' + id + '\')">↻ کشف مدل</button></div>';
    var summary = '<div class="text-xs text-muted mb-2" style="padding:0 4px;">' + n(models.length) + ' مدل · ' + n(enabledCount) + ' فعال · ' + n(healthyCount) + ' سالم</div>';
    bodyHtml = bulkBar + summary + '<div class="model-list">' + modelCards + '</div>';
  } else if (tab === "keys") {
    bodyHtml = card({
      title: "API Keys", sub: "کلیدها هرگز بهصورت کامل نمایش داده نمیشوند", flat: true,
      actions: '<button class="btn sm pri"' + act("keyAdd", id) + ">＋ کلید</button>" +
        '<button class="btn sm gho"' + act("keyRotate", id) + ">↻ Rotate</button>",
      body: lst((p.keys || []).map(function (k) {
        return li({
          icon: "🔑",
          title: '<span class="mono">' + h(k.mask) + "</span> " + statusBdg(k.status) +
            (k.inCooldown ? " " + bdg("cooldown " + n(k.cooldownRemaining) + "s", "warn") : ""),
          sub: n(k.requests) + " req · " + n(k.errors) + " err · " + pct(k.successRate) + " success" +
            (k.rateLimits ? " · " + n(k.rateLimits) + " rate-limit" : "") +
            (k.lastUsed ? " · " + rel(k.lastUsed) : ""),
          actions: (k.inCooldown ? '<button class="btn sm gho"' + act("keyReset", id, k.id) + ">reset</button>" : "") +
            '<button class="btn sm dan"' + act("keyDel", id, k.id) + ">🗑</button>"
        });
      }), { icon: "🔑", title: "کلیدی ثبت نشده", btn: { t: "＋ افزودن کلید", on: act("keyAdd", id) } })
    });
  } else {
    bodyHtml = card({
      title: "Configuration", icon: "⚙",
      body: kv("Format", bdg(p.format, "acc")) +
        kv("Auth Method", bdg(p.auth || "bearer", "mut")) +
        (p.authHeader ? kv("Auth Header", '<span class="mono">' + h(p.authHeader) + "</span>") : "") +
        (p.authQuery ? kv("Auth Query", '<span class="mono">' + h(p.authQuery) + "</span>") : "") +
        kv("Enabled", p.enabled === false ? bdg("no", "err") : bdg("yes", "ok")) +
        kv("Priority", n(p.priority)) + kv("Weight", n(p.weight)) +
        (p.org ? kv("Organization", h(p.org)) : "") +
        kv("Created", dt(p.createdAt)) +
        kv("Last Checked", rel(p.lastChecked)) +
        (p.lastError ? kv("Last Error", '<span style="color:var(--bad)">' + h(short(p.lastError, 60)) + "</span>") : "") +
        ((p.tags || []).length ? '<div class="chips mt12">' + p.tags.map(function (t) { return '<span class="chip">' + h(t) + "</span>"; }).join("") + "</div>" : "") +
        (Object.keys(p.headers || {}).length ? '<h4 class="mt16 mb8">Custom Headers</h4>' + Object.keys(p.headers).map(function (k) { return kv(k, '<span class="mono">' + h(short(p.headers[k], 30)) + "</span>"); }).join("") : "")
    });
  }
  return head + stats + tabs + bodyHtml;
}

function providerFields(p) {
  p = p || {};
  const isNew = !p.id;
  return [
    { k: "name", l: "نام نمایشی", v: p.name, ph: "My AI Provider (اختیاری)" },
    { k: "baseUrl", l: "Base URL", t: "url", req: true, v: p.baseUrl, ph: "https://api.openai.com/v1", hint: "آدرس پایه API بدون /chat/completions" },
    {
      k: "format", l: "فرمت و پروتکل API", t: "select", v: p.format || "auto",
      opts: [
        ["auto", "⚡ خودکار (تشخیص هوشمند پروتکل از آدرس و پاسخ سرور)"],
        ["openai", "🤖 OpenAI سازگار (ChatGPT, DeepSeek, Qwen, Llama, Ollama, vLLM)"],
        ["anthropic", "🧠 Claude (Anthropic Messages API)"],
        ["gemini", "✨ Google Gemini (Google AI Studio)"]
      ],
      hint: "در حالت «خودکار»، پروتکل مناسب بر اساس دامنه و پاسخ تست تشخیص داده می‌شود."
    },
    {
      k: "apiKey", l: isNew ? "API Key — می‌توانید چند کلید بدهید" : "افزودن کلید جدید",
      t: "area", rows: 3, v: "", ph: "sk-xxxx\nsk-yyyy\nsk-zzzz",
      hint: isNew
        ? "هر کلید در یک خط (یا با کاما جدا کنید). همه ثبت می‌شوند و چرخشی استفاده می‌شوند."
        : "خالی بگذارید تا کلیدهای فعلی حفظ شوند. برای افزودن کلیدهای جدید، هر خط یک کلید."
    },
    { t: "hr" },
    { t: "rowStart" },
    { k: "priority", l: "اولویت (Priority)", t: "num", v: p.priority === undefined ? 0 : p.priority },
    { k: "weight", l: "وزن توزیع بار (Weight)", t: "num", v: p.weight === undefined ? 1 : p.weight },
    { t: "rowEnd" },
    { k: "tags", l: "برچسب‌ها (Tags)", t: "csv", v: (p.tags || []).join(", "), ph: "prod, fast, backup" },
    { k: "description", l: "توضیح اختیاری", t: "area", rows: 2, v: p.description },
    { k: "enabled", l: "فعال بودن پروایدر", t: "switch", v: p.enabled !== false }
  ];
}

const READY_PRESETS = [
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", format: "openai", icon: "🤖", desc: "ChatGPT, GPT-4o, o1, o3-mini", ph: "sk-proj-...", hint: "کلید API را از platform.openai.com دریافت کنید" },
  { id: "claude", name: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", format: "anthropic", icon: "🧠", desc: "Claude 3.5 Sonnet, Claude 3.7", ph: "sk-ant-...", hint: "کلید را از console.anthropic.com دریافت کنید" },
  { id: "gemini", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", format: "gemini", icon: "✨", desc: "Gemini 2.5 Flash و Pro (رایگان)", ph: "AIzaSy...", hint: "کلید را از aistudio.google.com دریافت کنید" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", format: "openai", icon: "🔍", desc: "DeepSeek V3, DeepSeek R1 (استدلال)", ph: "sk-...", hint: "کلید را از platform.deepseek.com دریافت کنید" },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", format: "openai", icon: "⚡", desc: "سرعت فوق‌العاده با چیپ LPU (Llama 3.3)", ph: "gsk_...", hint: "کلید رایگان را از console.groq.com دریافت کنید" },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", format: "openai", icon: "🌐", desc: "هاب دسترسی به بیش از ۲۰۰ مدل مختلف", ph: "sk-or-...", hint: "کلید را از openrouter.ai دریافت کنید" },
  { id: "mistral", name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", format: "openai", icon: "🌪️", desc: "مدل‌های میسترال Large و Codestral", ph: "...", hint: "کلید را از console.mistral.ai دریافت کنید" },
  { id: "grok", name: "xAI Grok", baseUrl: "https://api.x.ai/v1", format: "openai", icon: "🚀", desc: "Grok 2 و Grok Vision", ph: "xai-...", hint: "کلید را از console.x.ai دریافت کنید" },
  { id: "together", name: "Together AI", baseUrl: "https://api.together.xyz/v1", format: "openai", icon: "🤝", desc: "مدل‌های ابری متن‌باز لاما، کوئن، دیپ‌سیک", ph: "...", hint: "کلید را از together.ai دریافت کنید" },
  { id: "custom", name: "➕ پروایدر سفارشی (Custom)", isCustom: true, icon: "⚙️", desc: "سرور محلی (Ollama/vLLM) یا پراکسی دلخواه", ph: "", hint: "تنظیم دستی Base URL، فرمت پروتکل و کلید" }
];
window.READY_PRESETS = READY_PRESETS;

/* Main provider addition router: shows preset catalog or opens custom form */
window.providerNew = function (preset) {
  if (preset && preset.isCustom) return providerCustomForm();
  if (preset && preset.id) return selectReadyPreset(preset.id);

  // Catalog Sheet
  const items = READY_PRESETS.map(function (p) {
    const isC = !!p.isCustom;
    return '<div class="card p-3 mb-2" style="cursor:pointer;border-radius:12px;border:1px solid ' + (isC ? 'var(--acc-line)' : 'var(--line)') + ';background:' + (isC ? 'var(--acc-soft)' : 'var(--surface)') + ';transition:all 0.18s ease;" onclick="selectReadyPreset(\'' + p.id + '\')">' +
      '<div class="flex-between" style="align-items:center;">' +
        '<div class="row gap12" style="align-items:center;">' +
          '<div style="width:40px;height:40px;border-radius:10px;background:var(--surface2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">' + p.icon + '</div>' +
          '<div>' +
            '<div class="font-bold" style="font-size:14.5px;color:var(--text);">' + h(p.name) + '</div>' +
            '<div class="text-xs text-muted" style="margin-top:2px;">' + h(p.desc) + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="color:var(--muted);font-size:18px;margin-inline-start:8px;">‹</div>' +
      '</div>' +
    '</div>';
  }).join("");

  sheet({
    title: "افزودن Provider",
    sub: "سرویس مدنظرتان را انتخاب کنید:",
    cls: "wide",
    body: '<div class="presets-list">' + items + '</div>',
    foot: '<button class="btn gho" onclick="closeSheet()">انصراف</button>'
  });
};

/* Simplified sheet for ready providers — ONLY asks API Key and optional name! */
window.selectReadyPreset = function (presetId) {
  const p = READY_PRESETS.find(function (x) { return x.id === presetId; });
  if (!p) return;
  if (p.isCustom) return providerCustomForm();

  const ns = "pw" + Math.random().toString(36).slice(2, 7);
  const fields = [
    { k: "apiKey", l: "API Key (کلید دسترسی)", t: "area", rows: 3, req: true, ph: p.ph, hint: (p.hint ? p.hint + " · " : "") + "می‌توانید چند کلید در خطوط جداگانه وارد کنید (استفاده چرخشی)." },
    { k: "name", l: "نام نمایشی دلخواه (اختیاری)", v: p.name, ph: p.name }
  ];

  sheet({
    title: "اتصال به " + p.name,
    sub: "آدرس و پروتکل این سرویس به صورت خودکار تنظیم شده است",
    cls: "wide",
    body: '<div class="card p-3 mb-3" style="background:rgba(99,102,241,0.08);border:1px solid var(--acc-line);display:flex;align-items:center;gap:12px;">' +
      '<div style="font-size:32px;flex-shrink:0;">' + p.icon + '</div>' +
      '<div>' +
        '<div style="font-weight:750;font-size:15px;color:var(--text);">' + h(p.name) + '</div>' +
        '<div style="font-size:12px;color:var(--text2);">' + h(p.desc) + '</div>' +
        '<div class="mono text-xs text-muted ltr" style="margin-top:2px;">' + h(p.baseUrl) + '</div>' +
      '</div>' +
    '</div>' +
    '<div id="pwStep">' + formHtml(fields, ns) + '</div>',
    foot: '<button class="btn gho" onclick="providerNew()">‹ بازگشت به لیست</button>' +
      '<div class="sp"></div>' +
      '<button class="btn pri" id="pwGo" onclick="pwCreatePreset(\'' + p.id + '\',\'' + ns + '\')">افزودن و کشف مدل</button>',
    after: function () {
      S.wiz = { fields: fields, ns: ns, preset: p };
      const first = document.getElementById(ns + "_apiKey");
      if (first) first.focus();
    }
  });
};

window.pwCreatePreset = async function (presetId, ns) {
  const p = READY_PRESETS.find(function (x) { return x.id === presetId; });
  if (!p) return;
  const keyEl = document.getElementById(ns + "_apiKey");
  const nameEl = document.getElementById(ns + "_name");
  const rawKey = keyEl ? keyEl.value.trim() : "";
  if (!rawKey) return toast("لطفاً کلید API را وارد کنید", "err");
  const keys = rawKey.split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  const provName = (nameEl && nameEl.value.trim()) ? nameEl.value.trim() : p.name;

  const btn = document.getElementById("pwGo");
  if (btn) { btn.disabled = true; btn.textContent = "در حال ثبت…"; }

  const body = {
    name: provName,
    baseUrl: p.baseUrl,
    format: p.format,
    enabled: true
  };
  if (keys.length === 1) body.apiKey = keys[0];
  else if (keys.length > 1) body.apiKeys = keys;

  sheetBody(loading("در حال ثبت " + p.name + " در سیستم…"));
  pwFoot("");
  try {
    const created = await api("/providers", { body: body });
    bust();
    sheetBody(loading("پروایدر ثبت شد! در حال کشف خودکار مدل‌ها…"));
    pwFoot('<button class="btn gho" id="pwSkip" onclick="pwSkipDiscovery(\'' + created.id + '\',\'' + h(created.name) + '\',' + keys.length + ')">عبور از کشف خودکار</button>');
    window._pwPending = { pid: created.id };

    let disc = { found: 0, created: 0, models: [] };
    try {
      disc = await api("/providers/" + created.id + "/discover-models", { body: {}, timeout: 15000 });
    } catch (e) {
      disc = { found: 0, created: 0, models: [], error: e.message };
    }
    bust();
    if (window._pwPending && window._pwPending.pid === created.id) {
      delete window._pwPending;
      pwModelStep(created.id, created.name, disc, keys.length);
    }
  } catch (e) {
    sheetBody(errBox(e));
    pwFoot('<button class="btn gho" onclick="closeSheet()">بستن</button><div class="sp"></div><button class="btn pri" onclick="selectReadyPreset(\'' + presetId + '\')">تلاش دوباره</button>');
  }
};

/* Full custom provider form for local models / proxies / custom endpoints */
window.providerCustomForm = function () {
  const fields = providerFields();
  const ns = "pw" + Math.random().toString(36).slice(2, 7);
  sheet({
    title: "پروایدر سفارشی (Custom)",
    sub: "آدرس و پروتکل دلخواه خود را وارد کنید",
    cls: "wide",
    body: '<div id="pwStep">' + formHtml(fields, ns) + '</div>',
    foot: '<button class="btn gho" onclick="providerNew()">‹ بازگشت به لیست</button>' +
      '<div class="sp"></div>' +
      '<button class="btn" id="pwTest" onclick="pwTestOnly()">◍ فقط تست</button>' +
      '<button class="btn pri" id="pwGo" onclick="pwCreate()">افزودن و کشف مدل</button>',
    after: function () {
      S.wiz = { fields: fields, ns: ns, isCustom: true };
      const t = document.getElementById("pwTest");
      const g = document.getElementById("pwGo");
      if (t) t.onclick = function () { pwTestOnly(); };
      if (g) g.onclick = function () { pwCreate(); };
      const first = document.getElementById(ns + "_baseUrl");
      if (first && !first.value) first.focus();
    }
  });
};

function pwRead() {
  if (!S.wiz || !S.wiz.fields) throw new Error("اطلاعات فرم بارگذاری نشده است");
  const v = formRead(S.wiz.fields, S.wiz.ns);
  const keys = String(v.apiKey || "").split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  return { vals: v, keys: keys };
}
function pwFoot(html) {
  const f = document.getElementById("sheetF") || document.querySelector(".modal-sheet .sheet-f") || document.querySelector("#sheet .sheet-f");
  if (f) f.innerHTML = html;
}
window.pwFoot = pwFoot;

window.pwSkipDiscovery = function (pid, pname, keyCount) {
  if (window._pwPending) delete window._pwPending;
  pwModelStep(pid, pname, { models: [] }, keyCount);
};

window.pwTestOnly = async function () {
  let r;
  try { r = pwRead(); } catch (e) { return toast(e.message || String(e), "err"); }
  if (!r.vals.baseUrl) return toast("Base URL الزامی است", "err");
  const btn = document.getElementById("pwTest");
  if (btn) { btn.disabled = true; btn.textContent = "در حال تست…"; }
  sheetBody(loading("در حال تست اتصال، احراز هویت و سازگاری…"));
  pwFoot('<button class="btn gho" onclick="closeSheet()">بستن</button>');
  try {
    let fmt = r.vals.format || "auto";
    if (fmt === "claude") fmt = "anthropic";
    const d = await api("/providers/diagnose", {
      body: { baseUrl: r.vals.baseUrl, apiKey: r.keys[0] || "", format: fmt },
      long: true
    });
    sheetBody(diagnoseHtml(d));
    pwFoot('<button class="btn gho" onclick="closeSheet()">بستن</button><div class="sp"></div>' +
      '<button class="btn pri" onclick="pwCreate()">→ ادامه و ثبت</button>');
  } catch (e) {
    sheetBody(errBox(e));
    pwFoot('<button class="btn gho" onclick="closeSheet()">بستن</button><div class="sp"></div><button class="btn" onclick="providerCustomForm()">تلاش مجدد</button>');
  }
};

window.pwCreate = async function () {
  let r;
  try {
    r = pwRead();
  } catch (e) {
    return toast(e.message || String(e), "err");
  }
  if (!r.vals.baseUrl) return toast("Base URL الزامی است", "err");

  const btn = document.getElementById("pwGo");
  if (btn) { btn.disabled = true; btn.textContent = "در حال ثبت…"; }

  let fmt = r.vals.format || "auto";
  if (fmt === "claude") fmt = "anthropic";

  const rawTags = r.vals.tags;
  const tags = Array.isArray(rawTags) ? rawTags : String(rawTags || "").split(/[\s,]+/).filter(Boolean);

  const body = {
    name: r.vals.name || undefined,
    baseUrl: r.vals.baseUrl,
    format: fmt,
    priority: r.vals.priority !== undefined && r.vals.priority !== null ? Number(r.vals.priority) : 0,
    weight: r.vals.weight !== undefined && r.vals.weight !== null ? Number(r.vals.weight) : 1,
    tags: tags,
    description: r.vals.description || "",
    enabled: r.vals.enabled !== false
  };
  if (r.keys.length === 1) body.apiKey = r.keys[0];
  else if (r.keys.length > 1) body.apiKeys = r.keys;

  sheetBody(loading("در حال ثبت پروایدر در سیستم…"));
  pwFoot("");
  try {
    const p = await api("/providers", { body: body });
    bust();
    sheetBody(loading("پروایدر ثبت شد! در حال کشف خودکار مدل‌ها…"));
    pwFoot('<button class="btn gho" id="pwSkip" onclick="pwSkipDiscovery(\'' + p.id + '\',\'' + h(p.name) + '\',' + r.keys.length + ')">عبور از کشف خودکار</button>');
    window._pwPending = { pid: p.id };

    let disc = { found: 0, created: 0, models: [] };
    try {
      disc = await api("/providers/" + p.id + "/discover-models", { body: {}, timeout: 15000 });
    } catch (e) {
      disc = { found: 0, created: 0, models: [], error: e.message };
    }
    bust();
    if (window._pwPending && window._pwPending.pid === p.id) {
      delete window._pwPending;
      pwModelStep(p.id, p.name, disc, r.keys.length);
    }
  } catch (e) {
    sheetBody(errBox(e));
    pwFoot('<button class="btn gho" onclick="closeSheet()">بستن</button><div class="sp"></div><button class="btn pri" onclick="providerNew()">تلاش دوباره</button>');
  }
};
function pwModelStep(pid, pname, disc, keyCount) {
  const found = (disc.models || []);
  S.wiz.pid = pid;
  S.wiz.discovered = found.map(function (m) { return m.id; });
  sheetBody(
    note("Provider <b>" + h(pname) + "</b> ساخته شد" + (keyCount ? " با <b>" + n(keyCount) + "</b> کلید" : "") + "." +
      (found.length ? " <b>" + n(found.length) + "</b> مدل کشف شد." : " مدلی خودکار پیدا نشد — دستی اضافه کنید."),
      found.length ? "" : "warn") +
    (disc.error ? '<div class="mt8">' + note("کشف خودکار ناموفق: " + h(short(disc.error, 70)), "warn") + "</div>" : "") +
    '<div class="fld mt16"><label>افزودن مدل' + (found.length ? " دستی (اختیاری)" : "") + '</label>' +
    '<textarea id="pwModels" class="code" rows="4" placeholder="gpt-4o&#10;claude-3-5-sonnet&#10;meta/llama-3.3-70b-instruct"></textarea>' +
    '<div class="hint">هر مدل در یک خط — چند مدل با هم اضافه میشود</div></div>' +
    (found.length
      ? '<h4 class="mt16 mb8">مدلهای کشفشده (' + n(found.length) + ")</h4>" +
      '<div class="chips">' + found.slice(0, 40).map(function (m) {
        return '<span class="chip mono">' + h(short(m.apiModelId || m.name, 26)) + "</span>";
      }).join("") + (found.length > 40 ? '<span class="chip">+' + n(found.length - 40) + "</span>" : "") + "</div>"
      : "")
  );
  pwFoot(
    '<button class="btn gho" onclick="closeSheet();bust();go(\'provider\',{id:' + qs(pid) + "})\">پایان</button>" +
    '<div class="sp"></div>' +
    '<button class="btn" id="pwAddModels">＋ افزودن مدلها</button>' +
    (found.length ? '<button class="btn pri" id="pwTestModels">🧪 تست مدلها</button>' : "")
  );
  const a = document.getElementById("pwAddModels");
  if (a) a.onclick = function () { pwAddModels(pid); };
  const t = document.getElementById("pwTestModels");
  if (t) t.onclick = function () { pwTestModels(pid); };
}
window.pwModelStep = pwModelStep;
window.pwAddModels = async function (pid) {
  const el = document.getElementById("pwModels");
  const raw = el ? el.value : "";
  const list = raw.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  if (!list.length) return toast("شناسه مدل وارد نشده", "warn");
  sheetBody(loading("افزودن و تست " + n(list.length) + " مدل…"));
  pwFoot("");
  try {
    const r = await api("/models", { body: { providerId: pid, models: list, test: true }, long: true, timeout: 300000 });
    bust();
    sheetBody(note("<b>" + n(r.created) + "</b> مدل اضافه شد · <b>" + n(r.healthy) + "</b> سالم", r.healthy ? "" : "warn") +
      '<div class="mt12">' + (r.models || []).map(function (m) {
        return li({ icon: "◆", title: h(short(m.name || m.apiModelId, 32)) + " " + statusBdg(m.status), sub: ms(m.latency) });
      }).join("") + "</div>");
    pwFoot('<button class="btn pri" onclick="closeSheet();bust();go(\'provider\',{id:' + qs(pid) + "})\">مشاهده Provider</button>");
  } catch (e) {
    sheetBody(errBox(e));
    pwFoot('<button class="btn gho" onclick="closeSheet();bust();render()">بستن</button>');
  }
};
window.pwTestModels = async function (pid) {
  sheetBody(loading("تست مدلهای این Provider… ممکن است چند دقیقه طول بکشد"));
  pwFoot("");
  try {
    const r = await api("/providers/" + pid + "/test", { body: {}, long: true, timeout: 300000 });
    bust();
    sheetBody(diagnoseHtml(r));
    pwFoot('<button class="btn pri" onclick="closeSheet();bust();go(\'provider\',{id:' + qs(pid) + "})\">مشاهده Provider</button>");
  } catch (e) {
    sheetBody(errBox(e));
    pwFoot('<button class="btn gho" onclick="closeSheet();bust();render()">بستن</button>');
  }
};
window.providerEdit = async function (id) {
  const p = await api("/providers/" + id);
  editSheet({
    title: "ویرایش Provider", sub: p.name, fields: providerFields(p),
    onSave: async function (v) {
      const keys = String(v.apiKey || "").split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      delete v.apiKey;
      if (keys.length === 1) v.apiKey = keys[0];
      else if (keys.length > 1) v.apiKeys = keys;
      await doAct(function () { return api("/providers/" + id, { method: "PATCH", body: v }); }, "ذخیره شد");
    }
  });
};
window.providerPresets = async function () {
  const d = await api("/providers/predefined");
  sheet({
    title: "Provider Presets", sub: "تنظیمات آماده — فقط کلید را وارد کنید",
    body: lst((d.providers || []).map(function (p) {
      return li({
        icon: p.icon || "▣", onclick: act("presetPick", p.key, p.name, p.baseUrl, p.format),
        title: h(p.name), sub: '<span class="mono ltr">' + h(short(p.baseUrl, 40)) + "</span>", chev: true
      });
    })), foot: null
  });
};
window.presetPick = function (key, name, baseUrl, format) {
  closeSheet();
  setTimeout(function () { providerNew({ name: name, baseUrl: baseUrl, format: format }); }, 60);
};
window.providerBulk = function () {
  editSheet({
    title: "Bulk Import", sub: "چند کلید → چند Provider جداگانه",
    fields: [
      { k: "baseUrl", l: "Base URL", t: "url", req: true, ph: "https://api.example.com/v1" },
      { k: "keys", l: "کلیدها", t: "code", rows: 7, req: true, ph: "key1\nkey2\nkey3", hint: "هر کلید در یک خط (یا با کاما) — برای هر کلید یک Provider ساخته میشود" },
      { k: "nameTemplate", l: "الگوی نام", v: "Provider-{n}", hint: "{n} شماره صفرپیشوند، {i} شماره خام" },
      { k: "format", l: "Format", t: "seg", v: "openai", opts: [["openai", "OpenAI"], ["gemini", "Gemini"], ["anthropic", "Anthropic"]] }
    ],
    okText: "ایمپورت",
    onSave: async function (v) {
      sheetBody(loading("ساخت Providerها…"));
      const r = await api("/providers/bulk", { body: v, long: true, timeout: 300000 });
      closeSheet(); bust(); toast(n((r || []).length) + " Provider اضافه شد", "ok"); go("providers");
    }
  });
};
window.providerDiagnose = function () {
  editSheet({
    title: "Diagnose Endpoint", sub: "بررسی سلامت یک API بدون ذخیره کردن",
    fields: [
      { k: "baseUrl", l: "Base URL", t: "url", req: true },
      { k: "apiKey", l: "API Key", t: "pass" },
      { k: "format", l: "Format", t: "seg", v: "openai", opts: [["openai", "OpenAI"], ["gemini", "Gemini"], ["anthropic", "Anthropic"]] },
      { k: "model", l: "Model (اختیاری)", ltr: true }
    ],
    okText: "◍ اجرای تست",
    onSave: async function (v) {
      sheetBody(loading("در حال بررسی…"));
      const r = await api("/providers/diagnose", { body: v, long: true });
      sheetBody(diagnoseHtml(r));
    }
  });
};
function diagnoseHtml(r) {
  return '<div class="mb12">' + (r.ok ? note("✓ " + h(r.summary), "") : note("✕ " + h(r.summary), "err")) + "</div>" +
    '<div class="steps">' + (r.steps || []).map(function (s) {
      return '<div class="step ' + (s.ok ? "done" : "fail") + '"><i class="step-i">' + (s.ok ? "✓" : "✕") + "</i>" +
        '<div class="sp"><div class="step-t">' + h(s.name) + (s.ms ? ' <span class="tny mono">' + ms(s.ms) + "</span>" : "") + "</div>" +
        '<div class="step-d">' + h(s.detail || "") + "</div></div></div>";
    }).join("") + "</div>" +
    (r.info ? '<h4 class="mt16 mb8">Info</h4>' + kv("Format", bdg(r.info.format, "acc")) +
      kv("Discovered Models", n(r.info.discovered)) +
      kv("Chat", r.info.chatOk ? bdg("ok", "ok") : bdg("fail", "err")) +
      kv("Streaming", r.info.streamOk === null ? bdg("unknown", "mut") : r.info.streamOk ? bdg("ok", "ok") : bdg("fail", "err")) +
      ((r.info.modelSample || []).length ? '<div class="chips mt8">' + r.info.modelSample.slice(0, 8).map(function (m) { return '<span class="chip mono">' + h(short(m, 26)) + "</span>"; }).join("") + "</div>" : "") : "") +
    (r.diagnosis && r.diagnosis.fix ? '<div class="mt12">' + note("<b>راهحل:</b> " + h(r.diagnosis.fix), "warn") + "</div>" : "");
}
window.provTest = async function (id) {
  sheet({
    title: "تست اتصال پروایدر",
    body: loading("در حال ارسال درخواست تست به API پروایدر…"),
    foot: '<button class="btn gho" onclick="closeSheet()">لغو</button>'
  });
  try {
    const r = await api("/providers/" + id + "/test", { body: {}, long: true, timeout: 60000 });
    bust();
    var statusIcon = r.ok ? '✅' : '❌';
    var statusText = r.ok ? 'پروایدر سالم و آماده استفاده است' : 'مشکلی در اتصال به پروایدر وجود دارد';
    var header = '<div style="text-align:center;padding:12px 0;">' +
      '<div style="font-size:48px;margin-bottom:8px;">' + statusIcon + '</div>' +
      '<div style="font-size:16px;font-weight:700;color:' + (r.ok ? 'var(--ok)' : 'var(--bad)') + ';">' + statusText + '</div>' +
      '</div>';
    sheetBody(header + diagnoseHtml(r));
    pwFoot('<button class="btn gho" onclick="closeSheet();bust();render()">بستن</button>' +
      '<div class="sp"></div>' +
      '<button class="btn pri" onclick="closeSheet();go(\'provider\',\'' + id + '\')">مشاهده پروایدر</button>');
  } catch (e) {
    sheetBody(errBox(e));
    pwFoot('<button class="btn gho" onclick="closeSheet()">بستن</button>');
  }
};
window.provDiscover = async function (id) {
  toast("در حال کشف مدل…");
  try {
    const r = await api("/providers/" + id + "/discover-models", { body: {}, long: true });
    bust(); toast(n(r.found) + " مدل یافت شد · " + n(r.created) + " جدید", "ok"); render();
  } catch (e) { toast(e.message, "err"); }
};
/* ═══════════ BULK MODEL OPS ═══════════ */
window.bulkModels = async function (providerId, action) {
  var labels = { enable: "فعال کردن همه مدل‌ها", disable: "غیرفعال کردن همه مدل‌ها", test: "تست همه مدل‌ها", delete: "حذف همه مدل‌ها" };
  var filter = providerId ? { providerId: providerId } : {};
  if (action === "delete") {
    var scopeText = providerId ? "تمام مدل‌های این پروایدر" : "تمام مدل‌های سیستم";
    return confirmSheet("حذف همه مدل‌ها؟", scopeText + " حذف خواهند شد. این عمل قابل بازگشت نیست.", async function () {
      toast("در حال حذف…");
      try {
        var r = await api("/models/bulk", { body: { action: "delete", filter: filter }, long: true, timeout: 120000 });
        bust(); toast(n(r.count) + " مدل حذف شد", "ok"); render();
      } catch (e) { toast(e.message, "err"); }
    });
  }
  toast(labels[action] || action);
  try {
    if (action === "test") {
      sheet({
        title: "🧪 تست همه مدل‌ها",
        body: loading("در حال تست مدل‌ها — ممکن است چند دقیقه طول بکشد…"),
        foot: '<button class="btn gho" onclick="closeSheet()">لغو</button>'
      });
      var r = await api("/models/bulk", { body: { action: "test", filter: filter }, long: true, timeout: 300000 });
      bust();
      var ok = (r.results || []).filter(function(x){ return x.status === "healthy"; }).length;
      var fail = (r.results || []).filter(function(x){ return x.status === "failed"; }).length;
      var testCards = (r.results || []).map(function(x) {
        var ico = x.status === "healthy" ? "✅" : x.status === "degraded" ? "⚠️" : "❌";
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);">' +
          '<span>' + ico + '</span>' +
          '<span class="mono text-xs ltr" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + h(x.id ? x.id.split(":").pop() : "?") + '</span>' +
          '<span class="text-xs text-muted">' + (x.latency ? ms(x.latency) : "") + '</span>' +
          (x.error ? '<span class="text-xs" style="color:var(--bad);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + h(short(x.error, 30)) + '</span>' : '') +
          '</div>';
      }).join("");
      sheetBody('<div style="text-align:center;padding:12px 0;">' +
        '<div style="font-size:16px;font-weight:700;">' + n(r.count) + ' مدل تست شد</div>' +
        '<div class="text-xs text-muted mt-1">' + n(ok) + ' سالم · ' + n(fail) + ' ناموفق</div>' +
        '</div>' +
        '<div style="max-height:300px;overflow-y:auto;padding:0 4px;">' + testCards + '</div>');
      pwFoot('<button class="btn gho" onclick="closeSheet();bust();render()">بستن</button>' +
        '<div class="sp"></div>' +
        '<button class="btn pri" onclick="closeSheet();enableHealthy(' + (providerId ? "'" + providerId + "'" : "null") + ')">♻️ فعال سالم‌ها</button>');
      return;
    }
    var r = await api("/models/bulk", { body: { action: action, filter: filter }, long: true });
    bust(); toast(n(r.count) + " مدل " + (action === "enable" ? "فعال" : "غیرفعال") + " شد", "ok"); render();
  } catch (e) { toast(e.message, "err"); }
};
window.enableHealthy = async function (providerId) {
  toast("در حال فعال‌سازی مدل‌های سالم…");
  try {
    var models = [];
    if (providerId) {
      var p = await api("/providers/" + providerId);
      models = p.models || [];
    } else {
      var d = await api("/models?size=500");
      models = d.models || [];
    }
    var healthyIds = models.filter(function(m){ return m.status === "healthy"; }).map(function(m){ return m.id; });
    var unhealthyIds = models.filter(function(m){ return m.status !== "healthy"; }).map(function(m){ return m.id; });
    if (healthyIds.length) await api("/models/bulk", { body: { action: "enable", ids: healthyIds } });
    if (unhealthyIds.length) await api("/models/bulk", { body: { action: "disable", ids: unhealthyIds } });
    bust();
    toast(n(healthyIds.length) + " مدل فعال · " + n(unhealthyIds.length) + " غیرفعال شد", "ok");
    render();
  } catch (e) { toast(e.message, "err"); }
};

/* ═══════════ PER-MODEL OPS ═══════════ */
window.modelCopyName = function (apiModelId) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(apiModelId).then(function () {
      toast("📋 " + apiModelId + " کپی شد", "ok");
    }).catch(function () {
      prompt("نام مدل:", apiModelId);
    });
  } else {
    prompt("نام مدل:", apiModelId);
  }
};
window.modelTestSingle = async function (modelId) {
  toast("🧪 در حال تست مدل…");
  try {
    var r = await api("/models/" + modelId + "/test", { body: {}, long: true, timeout: 60000 });
    bust();
    var ico = r.model && r.model.status === "healthy" ? "✅" : "❌";
    var name = r.model ? (r.model.name || r.model.apiModelId || modelId) : modelId;
    var results = (r.results || []).map(function(t) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);">' +
        '<span>' + (t.ok ? "✅" : "❌") + '</span>' +
        '<span class="text-xs" style="flex:1;">' + h(t.label || t.test) + '</span>' +
        '<span class="mono text-xs text-muted">' + (t.ms ? ms(t.ms) : "") + '</span>' +
        (t.error ? '<span class="text-xs" style="color:var(--bad);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + h(short(t.error, 40)) + '</span>' : '') +
        '</div>';
    }).join("");
    sheet({
      title: ico + " نتیجه تست: " + short(name, 24),
      body: '<div style="text-align:center;padding:8px 0;">' +
        '<div style="font-size:14px;font-weight:700;">' + n(r.passed) + '/' + n(r.total) + ' تست پاس شد</div>' +
        '</div>' +
        '<div style="max-height:260px;overflow-y:auto;padding:0 4px;">' + results + '</div>',
      foot: '<button class="btn gho" onclick="closeSheet();bust();render()">بستن</button>'
    });
  } catch (e) { toast(e.message, "err"); }
};
window.modelToggle = async function (modelId, currentEnabled) {
  var newState = !currentEnabled;
  try {
    await api("/models/" + modelId, { method: "PATCH", body: { enabled: newState } });
    bust();
    toast(newState ? "✅ مدل فعال شد" : "⛔ مدل غیرفعال شد", "ok");
    render();
  } catch (e) { toast(e.message, "err"); }
};
window.modelDelete = function (modelId, modelName) {
  confirmSheet("حذف مدل «" + modelName + "»؟", "این مدل از سیستم حذف خواهد شد. در صورت نیاز دوباره با کشف مدل اضافه کنید.", async function () {
    try {
      await api("/models/" + modelId, { method: "DELETE" });
      bust(); toast("🗑 مدل حذف شد", "ok"); render();
    } catch (e) { toast(e.message, "err"); }
  });
};

window.keyAdd = function (id) {
  editSheet({
    title: "افزودن API Key", sub: "چند کلید را همزمان اضافه کنید", cls: "narrow",
    fields: [{
      k: "keys", l: "کلیدها", t: "code", rows: 6, req: true,
      ph: "sk-xxxx\nsk-yyyy\nsk-zzzz",
      hint: "هر کلید در یک خط (یا با کاما جدا کنید). کلیدها چرخشی استفاده میشوند و اگر یکی rate-limit شود بعدی امتحان میشود."
    }],
    okText: "افزودن کلیدها",
    onSave: async function (v) {
      const keys = String(v.keys || "").split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!keys.length) throw new Error("کلیدی وارد نشده");
      await doAct(function () { return api("/providers/" + id + "/keys", { body: { keys: keys } }); }, n(keys.length) + " کلید اضافه شد");
    }
  });
};
window.keyDel = function (pid, kid) {
  confirmSheet("حذف کلید؟", "این کلید از Provider حذف میشود.", async function () {
    await doAct(function () { return api("/providers/" + pid + "/keys/" + kid, { method: "DELETE" }); }, "حذف شد");
  });
};
window.keyRotate = async function (id) {
  try { const r = await api("/providers/" + id + "/rotate-key", { body: {} }); bust(); toast("کلید بعدی: " + r.nextKey, "ok"); render(); }
  catch (e) { toast(e.message, "err"); }
};
window.keyReset = async function (pid, kid) {
  await doAct(function () { return api("/providers/" + pid + "/keys/" + kid + "/reset-cooldown", { body: {} }); }, "cooldown پاک شد");
};

/* ═══════════ MODELS ═══════════ */
async function viewModels() {
  const provs = await cached("provList", function () { return api("/providers"); });
  if (!(provs || []).length) {
    return '<div class="ph"><div class="ph-t"><h2>مدل‌های هوش مصنوعی</h2><p>هیچ مدلی موجود نیست</p></div></div>' + setupGate("Models");
  }

  const d = await api("/models?size=500");
  const models = d.models || [];
  const enabledCount = models.filter(function (m) { return m.enabled !== false; }).length;
  const healthyCount = models.filter(function (m) { return m.status === "healthy"; }).length;

  const head = '<div class="ph"><div class="ph-t">' +
    '<h2>مدل‌های هوش مصنوعی</h2>' +
    '<p id="mcount">' + n(models.length) + ' مدل · ' + n(enabledCount) + ' فعال · ' + n(healthyCount) + ' سالم</p>' +
    '</div>' +
    '<div class="ph-a">' +
    '<button class="btn sm gho"' + act("go", "compare") + '>⇄ مقایسه</button>' +
    '<button class="btn pri sm"' + act("modelNew", "") + '>＋ افزودن مدل</button>' +
    '</div></div>';

  const searchBox = '<div class="mb-3" style="position:relative;">' +
    '<input type="search" id="modelSearch" class="input" style="padding-inline-start:38px;border-radius:12px;font-size:13.5px;" placeholder="جستجوی سریع مدل‌ها (نام، شناسه یا پروایدر)..." oninput="filterModelsList(this.value)">' +
    '<span style="position:absolute;inset-inline-start:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:15px;pointer-events:none;">🔍</span>' +
    '</div>';

  const bulkBar = '<div class="bulk-bar mb-3" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 14px;border-radius:12px;background:var(--surface);border:1px solid var(--line);">' +
    '<button class="btn sm pri" onclick="bulkModels(null,\'test\')">🧪 تست همه مدل‌ها</button>' +
    '<button class="btn sm gho" onclick="bulkModels(null,\'enable\')">✅ فعال همه</button>' +
    '<button class="btn sm gho" onclick="bulkModels(null,\'disable\')">⛔ غیرفعال همه</button>' +
    '<button class="btn sm gho" onclick="enableHealthy(null)">♻️ فعال سالم‌ها</button>' +
    '<div class="sp"></div>' +
    '<button class="btn sm gho" onclick="modelNew(\'\')">＋ افزودن</button>' +
    '</div>';

  if (!models.length) {
    return head + searchBox + bulkBar +
      '<div class="empty" style="padding:48px 16px;text-align:center;">' +
      '<div class="ei" style="font-size:40px;">◆</div>' +
      '<div class="et" style="margin:8px 0;font-size:16px;">هیچ مدلی ثبت نشده</div>' +
      '<div class="es">از صفحه پروایدرها گزینه «کشف مدل» را بزنید یا پروایدر جدید اضافه کنید.</div>' +
      '<button class="btn pri mt-3" onclick="go(\'providers\')">▣ رفتن به Providers</button>' +
      '</div>';
  }

  const cards = models.map(function (m) {
    const isEnabled = m.enabled !== false;
    const icon = m.status === "healthy" ? "🟢" : m.status === "degraded" ? "🟡" : m.status === "failed" ? "🔴" : "⚪";
    const searchData = (m.name + " " + m.apiModelId + " " + (m.provider || "") + " " + (m.tags || []).join(" ")).toLowerCase();
    return '<div class="card model-card" data-search="' + h(searchData) + '" style="padding:12px 14px;margin-bottom:8px;transition:all 0.15s ease;">' +
      '<div class="flex-between" style="align-items:center;gap:8px;">' +
        '<div style="flex:1;min-width:0;cursor:pointer;" onclick="go(\'model\',\'' + m.id + '\')">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<span>' + icon + '</span>' +
            '<span class="font-bold" style="font-size:14px;color:' + (isEnabled ? 'var(--text)' : 'var(--muted)') + ';' + (!isEnabled ? 'text-decoration:line-through;opacity:0.6;' : '') + '">' + h(short(m.name || m.apiModelId, 32)) + '</span>' +
            statusBdg(m.status) +
            (!isEnabled ? '<span class="badge badge-mut" style="font-size:10px;">غیرفعال</span>' : '') +
          '</div>' +
          '<div class="mono ltr text-xs text-muted" style="margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px;">' + h(m.apiModelId) + '</div>' +
          '<div class="row gap8 wrap text-xs text-muted" style="margin-top:4px;">' +
            (m.provider ? '<span class="badge badge-acc" style="font-size:10px;">' + h(m.provider) + '</span>' : '') +
            (m.latency ? '<span class="mono">' + ms(m.latency) + '</span>' : '') +
            (m.context ? '<span>' + n(m.context) + ' ctx</span>' : '') +
            (m.costPer1M ? '<span>' + price(m.costPer1M, m.pricing && m.pricing.free) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="model-actions" style="display:flex;gap:4px;flex-shrink:0;">' +
          '<button class="btn sm gho" onclick="event.stopPropagation();modelCopyName(\'' + h(m.apiModelId).replace(/'/g, "\\'") + '\')" title="کپی نام مدل" style="padding:6px 8px;font-size:12px;">📋</button>' +
          '<button class="btn sm gho" onclick="event.stopPropagation();modelTestSingle(\'' + m.id + '\')" title="تست مدل" style="padding:6px 8px;font-size:12px;">🧪</button>' +
          '<button class="btn sm gho" onclick="event.stopPropagation();modelToggle(\'' + m.id + '\',' + (isEnabled ? 'true' : 'false') + ')" title="' + (isEnabled ? 'غیرفعال کردن' : 'فعال کردن') + '" style="padding:6px 8px;font-size:12px;">' + (isEnabled ? '⛔' : '✅') + '</button>' +
          '<button class="btn sm dan" onclick="event.stopPropagation();modelDelete(\'' + m.id + '\',\'' + h(short(m.name || m.apiModelId, 30)).replace(/'/g, "\\'") + '\')" title="حذف مدل" style="padding:6px 8px;font-size:12px;">🗑</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join("");

  return head + searchBox + bulkBar + '<div class="model-list" id="modelList">' + cards + '</div>';
}

window.filterModelsList = function (query) {
  query = (query || "").toLowerCase().trim();
  const cards = document.querySelectorAll(".model-card");
  let visible = 0;
  cards.forEach(function (card) {
    const text = (card.getAttribute("data-search") || card.textContent || "").toLowerCase();
    const match = !query || text.includes(query);
    card.style.display = match ? "" : "none";
    if (match) visible++;
  });
  const countEl = document.getElementById("mcount");
  if (countEl) countEl.textContent = visible + " مدل نمایش داده شده";
};
window.clearModelFilter = function () { go("models", {}, {}); };

async function viewModel() {
  const id = S.params.id;
  const m = await api("/models/" + id);
  const sc = m.score || {};
  const caps = m.capabilityDetail || {};
  const tab = curTab("model", "overview");

  const head = '<div class="ph"><div class="ph-t">' +
    '<button class="btn sm gho mb8"' + act("go", "models") + ">‹ Models</button>" +
    "<h2>" + h(m.name || m.apiModelId) + " " + statusBdg(m.status) + (m.favorite ? " ★" : "") + "</h2>" +
    '<p class="mono ltr">' + h(m.apiModelId) + " · " + h(m.provider || "") + "</p></div>" +
    '<div class="ph-a">' +
    '<button class="btn sm pri"' + act("modelTest", id) + ">◍ تست</button>" +
    '<button class="btn sm gho"' + act("modelBench", id) + ">▤ Benchmark</button>" +
    '<button class="btn sm gho"' + act("modelEdit", id) + ">✎ ویرایش</button>" +
    '<button class="btn sm gho"' + act("modelFav", id, String(!m.favorite)) + ">" + (m.favorite ? "★" : "☆") + "</button>" +
    '<button class="btn sm dan"' + act("delEntity", "Model", "/models/" + id, "models") + ">🗑</button>" +
    "</div></div>";

  const stats = '<div class="g g4 mb16">' +
    stat({ label: "Score", value: sc.overall === null || sc.overall === undefined ? "—" : Math.round(sc.overall), icon: "◎", kind: "acc", meter: sc.overall }) +
    stat({ label: "Latency", value: ms(m.latency), icon: "◷" }) +
    stat({ label: "Requests", value: n(m.requests), sub: pct(m.errorRate) + " error", icon: "↗" }) +
    stat({ label: "Cost", value: price(m.costPer1M, m.pricing && m.pricing.free), sub: "per 1M tokens", icon: "$" }) +
    "</div>";

  const tabs = tabsBar("model", [["overview", "Overview"], ["caps", "Capabilities", Object.keys(caps).length], ["tests", "Tests", (m.tests || []).length], ["bench", "Benchmarks", (m.benchmarks || []).length], ["raw", "Raw"]]);

  let body = "";
  if (tab === "overview") {
    body = '<div class="side-by">' +
      card({
        title: "مشخصات", icon: "◆",
        body: kv("Provider", '<a' + act("go", "provider", m.providerId) + ' style="color:var(--acc);cursor:pointer">' + h(m.providerName || m.provider) + "</a>") +
          kv("API Model ID", '<span class="mono ltr">' + h(m.apiModelId) + "</span>") +
          kv("Context Window", m.context ? n(m.context) + " tokens" : "—") +
          kv("Enabled", m.enabled === false ? bdg("no", "err") : bdg("yes", "ok")) +
          kv("Default Model", m.isDefault ? bdg("yes", "acc") : "—") +
          (m.pricing ? kv("Input / Output", price(m.pricing.inputPer1M, m.pricing.free) + " / " + price(m.pricing.outputPer1M, m.pricing.free) + " per 1M") : "") +
          kv("Last Checked", rel(m.lastChecked)) +
          (m.lastError ? kv("Last Error", '<span style="color:var(--bad)" class="tiny">' + h(short(m.lastError, 70)) + "</span>") : "") +
          ((m.tags || []).length ? '<div class="chips mt12">' + m.tags.map(function (t) { return '<span class="chip">' + h(t) + "</span>"; }).join("") + "</div>" : "")
      }) +
      card({
        title: "Score Breakdown", icon: "◎",
        body: ["quality", "speed", "reliability", "cost", "capabilities"].map(function (k) {
          return sc[k] === null || sc[k] === undefined ? "" : bar(k, sc[k], 100, Math.round(sc[k]));
        }).join("") +
          ((m.routingRules || []).length ? '<h4 class="mt16 mb8">Routing Rules</h4>' + m.routingRules.map(function (r) {
            return kv(r.task || "—", bdg(r.enabled ? "enabled" : "disabled", r.enabled ? "ok" : "mut"));
          }).join("") : "")
      }) + "</div>";
  } else if (tab === "caps") {
    body = card({
      title: "Capabilities", sub: "برای تغییر دستی روی هر مورد کلیک کنید", icon: "◈",
      body: '<div class="chips">' + Object.keys(caps).map(function (k) {
        const c = caps[k];
        return '<span class="chip clk ' + (c.supported ? "on" : "") + '"' + act("toggleCap", id, k, String(!c.supported)) + ">" +
          (c.supported ? "✓ " : "○ ") + h(k) + (c.source === "manual" ? " ✎" : "") + "</span>";
      }).join("") + "</div>" +
        note("منبع تشخیص: خودکار از تست مدل یا دستی. تغییر دستی روی routing تأثیر میگذارد.")
    });
  } else if (tab === "tests") {
    body = card({
      title: "Test History", flat: true, icon: "◍",
      actions: '<button class="btn sm pri"' + act("modelTest", id) + ">اجرای تست</button>",
      body: lst((m.tests || []).slice(0, 40).map(function (t) {
        return li({
          icon: t.ok ? "✓" : "✕",
          title: h(t.label || t.test) + " " + (t.ok ? bdg("pass", "ok") : bdg("fail", "err")),
          sub: (t.error ? h(short(t.error, 60)) : h(short(t.sample, 60))) + " · " + rel(t.ts),
          end: '<span class="tny mono">' + ms(t.latency) + "</span>"
        });
      }), { icon: "◍", title: "تستی اجرا نشده", btn: { t: "◍ اجرای تست", on: act("modelTest", id) } })
    });
  } else if (tab === "bench") {
    body = card({
      title: "Benchmarks", flat: true, icon: "▤",
      actions: '<button class="btn sm pri"' + act("modelBench", id) + ">اجرای Benchmark</button>",
      body: lst((m.benchmarks || []).slice(0, 20).map(function (b) {
        return li({
          title: "Quality " + n(b.qualityScore) + " · Success " + pct(b.successRate),
          sub: Object.keys(b.byTask || {}).map(function (k) { return k + ":" + Math.round(b.byTask[k]); }).join(" · ") + " · " + rel(b.ts),
          end: '<span class="tny mono">' + ms(b.avgLatency) + " · " + usd(b.cost) + "</span>"
        });
      }), { icon: "▤", title: "Benchmark اجرا نشده" })
    });
  } else {
    body = card({ title: "Raw Data", icon: "{}", body: codeBox(JSON.stringify(m.raw || m, null, 2), "mraw") });
  }
  return head + stats + tabs + body + '<div class="card mt12" id="mtestout"></div>';
}
window.toggleCap = async function (id, cap, val) {
  const caps = {}; caps[cap] = val === "true";
  await doAct(function () { return api("/models/" + id, { method: "PATCH", body: { capabilities: caps } }); }, "بهروزرسانی شد", { close: false });
};
window.modelFav = async function (id, val) {
  await doAct(function () { return api("/models/" + id, { method: "PATCH", body: { favorite: val === "true" } }); }, "بهروزرسانی شد", { close: false });
};
window.modelNew = async function (providerId) {
  const provs = await cached("provList", function () { return api("/providers"); });
  if (!(provs || []).length) {
    return confirmSheet("اول Provider لازم است", "برای افزودن مدل باید حداقل یک Provider داشته باشید.", function () {
      closeSheet(); providerNew();
    }, { danger: false, okText: "＋ افزودن Provider", kind: "" });
  }
  editSheet({
    title: "افزودن مدل", sub: "چند مدل را همزمان اضافه کنید",
    fields: [
      { k: "providerId", l: "Provider", t: "select", req: true, v: providerId || (provs[0] || {}).id, opts: provs.map(function (p) { return [p.id, p.name]; }) },
      {
        k: "models", l: "Model IDs", t: "code", rows: 7, req: true,
        ph: "gpt-4o\nclaude-3-5-sonnet\nmeta/llama-3.3-70b-instruct\ngemini-2.0-flash",
        hint: "هر مدل در یک خط (یا با کاما جدا کنید) — همه با هم اضافه میشوند"
      },
      { k: "test", l: "تست خودکار بعد از افزودن", t: "switch", v: true, hint: "وضعیت سلامت و تأخیر هر مدل سنجیده میشود" }
    ],
    okText: "افزودن",
    onSave: async function (v) {
      const list = String(v.models || "").split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!list.length) throw new Error("شناسه مدلی وارد نشده");
      sheetBody(loading("افزودن " + n(list.length) + " مدل" + (v.test ? " و تست…" : "…")));
      const r = await api("/models", { body: { providerId: v.providerId, models: list, test: v.test }, long: true, timeout: 300000 });
      bust();
      sheetBody(note("<b>" + n(r.created) + "</b> مدل اضافه شد" + (v.test ? " · <b>" + n(r.healthy) + "</b> سالم" : ""), r.created ? "" : "warn") +
        '<div class="mt12">' + (r.models || []).map(function (m) {
          return li({ icon: "◆", title: h(short(m.name || m.apiModelId, 32)) + " " + statusBdg(m.status), sub: ms(m.latency) });
        }).join("") + "</div>");
      const f = document.querySelector("#sheet .sheet-f");
      if (f) f.innerHTML = '<button class="btn pri" onclick="closeSheet();bust();render()">بستن</button>';
    }
  });
};
window.modelEdit = async function (id) {
  const m = await api("/models/" + id);
  editSheet({
    title: "ویرایش مدل", sub: m.apiModelId,
    fields: [
      { k: "displayName", l: "نام نمایشی", v: m.name },
      { k: "contextWindow", l: "Context Window", t: "num", v: m.context },
      { t: "h", l: "Pricing (per 1M tokens)" },
      { t: "rowStart" },
      { k: "inputPer1M", l: "Input", t: "num", step: 0.01, v: m.pricing ? m.pricing.inputPer1M : null },
      { k: "outputPer1M", l: "Output", t: "num", step: 0.01, v: m.pricing ? m.pricing.outputPer1M : null },
      { t: "rowEnd" },
      { k: "free", l: "رایگان", t: "switch", v: !!(m.pricing && m.pricing.free) },
      { t: "hr" },
      { k: "tags", l: "Tags", t: "csv", v: (m.tags || []).join(", ") },
      { k: "weight", l: "Weight", t: "num", v: m.weight === undefined ? 1 : m.weight },
      { k: "enabled", l: "فعال", t: "switch", v: m.enabled !== false },
      { k: "favorite", l: "Favorite", t: "switch", v: !!m.favorite }
    ],
    onSave: async function (v) {
      const body = {
        displayName: v.displayName, contextWindow: v.contextWindow, tags: v.tags,
        weight: v.weight, enabled: v.enabled, favorite: v.favorite,
        pricing: { inputPer1M: v.inputPer1M, outputPer1M: v.outputPer1M, currency: "USD", free: v.free }
      };
      await doAct(function () { return api("/models/" + id, { method: "PATCH", body: body }); }, "ذخیره شد");
    }
  });
};
window.modelTest = async function (id) {
  const meta = S.meta || {};
  const tests = meta.tests || { basic: "Basic Chat", streaming: "Streaming", json: "JSON Output" };
  sheet({
    title: "اجرای تست", cls: "narrow",
    body: '<div class="chips" id="tsel">' + Object.keys(tests).map(function (k) {
      const on = ["basic", "streaming", "json"].indexOf(k) >= 0;
      return '<span class="chip clk ' + (on ? "on" : "") + '" data-k="' + h(k) + '" onclick="this.className=this.className.indexOf(\'on\')>=0?\'chip clk\':\'chip clk on\'">' + h(tests[k]) + "</span>";
    }).join("") + "</div>",
    okText: "◍ اجرا",
    onOk: async function () {
      const sel = [].filter.call(document.querySelectorAll("#tsel .chip"), function (c) { return c.className.indexOf("on") >= 0; })
        .map(function (c) { return c.getAttribute("data-k"); });
      sheetBody(loading("در حال تست…"));
      const r = await api("/models/" + id + "/test", { body: { tests: sel.length ? sel : ["basic"] }, long: true });
      bust();
      sheetBody('<div class="mb12">' + note("نتیجه: " + n(r.passed) + " از " + n(r.total) + " موفق", r.passed === r.total ? "" : "warn") + "</div>" +
        (r.results || []).map(function (x) {
          return li({
            icon: x.ok ? "✓" : "✕", title: h(x.label || x.test) + " " + (x.ok ? bdg("pass", "ok") : bdg("fail", "err")),
            sub: x.error ? h(short(x.error, 70)) : h(short(x.sample, 70)),
            end: '<span class="tny mono">' + ms(x.latency) + "</span>"
          });
        }).join(""));
    }
  });
};
window.modelBench = async function (id) {
  const meta = S.meta || {};
  const tasks = meta.benchTasks || { factual: "Factual", json: "JSON", instruction: "Instruction" };
  editSheet({
    title: "Benchmark", cls: "narrow",
    fields: [
      { k: "tasks", l: "Tasks", t: "select", v: "quick", opts: [["quick", "Quick (3 tasks)"], ["full", "Full (all tasks)"]] },
      { t: "note", v: "Benchmark چند پرامپت استاندارد اجرا و امتیازدهی میکند. ممکن است چند دقیقه طول بکشد.", kind: "warn" }
    ],
    okText: "▶ اجرا",
    onSave: async function (v) {
      const list = v.tasks === "full" ? (meta.fullTasks || Object.keys(tasks)) : (meta.quickTasks || ["factual", "json", "instruction"]);
      sheetBody(loading("در حال اجرای benchmark…"));
      const r = await api("/models/" + id + "/benchmark", { body: { tasks: list }, long: true, timeout: 300000 });
      bust();
      sheetBody(kv("Quality Score", '<b>' + n(r.qualityScore) + "</b>") + kv("Success Rate", pct(r.successRate)) +
        kv("Avg Latency", ms(r.avgLatency)) + kv("Cost", usd(r.cost)) +
        '<h4 class="mt16 mb8">By Task</h4>' + Object.keys(r.byTask || {}).map(function (k) { return bar(k, r.byTask[k], 100, Math.round(r.byTask[k])); }).join(""));
    }
  });
};

/* ═══════════ COMPARE ═══════════ */
async function viewCompare() {
  const head = '<div class="ph"><div class="ph-t"><h2>⇄ مقایسه مدل‌ها</h2><p>۲ تا ۵ مدل را برای مقایسه عملکرد و امتیاز انتخاب کنید</p></div>';
  const list = await usableModels();
  if (list.length < 2) {
    return head + "</div>" + (list.length ?
      '<div class="card"><div class="empty"><i class="ei">⇄</i><div class="et">حداقل ۲ مدل لازم است</div>' +
      '<div class="es">برای مقایسه باید بیش از یک مدل در سیستم ثبت شده باشد.</div>' +
      '<button class="btn pri sm" style="margin-top:12px"' + act("go", "providers") + ">▣ Providers</button></div></div>" :
      setupGate("مقایسه"));
  }
  const sel = (S.cache.cmpSel || []).filter(function (id) { return list.some(function (m) { return m.id === id; }); });
  S.cache.cmpSel = sel;

  const searchBox = '<div class="mb-3" style="position:relative;">' +
    '<input type="search" id="cmpSearch" class="input" style="padding-inline-start:36px;border-radius:12px;font-size:13px;" placeholder="جستجوی مدل برای انتخاب..." oninput="filterCmpChips(this.value)">' +
    '<span style="position:absolute;inset-inline-start:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none;">🔍</span>' +
    '</div>';

  const chipsHtml = list.map(function (m) {
    const isSelected = sel.indexOf(m.id) >= 0;
    const searchData = (m.name + " " + m.apiModelId + " " + (m.provider || "")).toLowerCase();
    return '<div class="cmp-chip chip clk ' + (isSelected ? "on" : "") + '" data-search="' + h(searchData) + '" onclick="cmpToggle(\'' + m.id + '\')" style="padding:8px 12px;border-radius:10px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">' +
      '<span>' + (isSelected ? "✓" : "○") + '</span>' +
      '<span class="font-bold">' + h(short(m.name || m.apiModelId, 28)) + '</span>' +
      (m.provider ? '<span class="badge badge-mut" style="font-size:10px;padding:1px 5px;">' + h(m.provider) + '</span>' : '') +
      '</div>';
  }).join("");

  return head +
    '<div class="ph-a"><button class="btn pri sm" id="cmpRunBtn" onclick="runCompare()"' + (sel.length < 2 ? " disabled" : "") + ">▶ مقایسه (" + sel.length + " مدل)</button></div></div>" +
    '<div class="card pad mb-3">' +
      '<div class="flex-between mb-2" style="align-items:center;flex-wrap:wrap;gap:8px;">' +
        '<div class="font-bold" style="font-size:14px;">انتخاب مدل‌ها <span class="text-xs text-muted">(' + n(list.length) + ' مدل موجود)</span></div>' +
        '<div class="text-xs text-muted" id="cmpSelCount">' + sel.length + ' از ۵ مدل انتخاب شده</div>' +
      '</div>' +
      searchBox +
      '<div class="chips" id="cmpChipsList" style="display:flex;flex-wrap:wrap;gap:8px;max-height:280px;overflow-y:auto;padding:4px 0;">' +
      chipsHtml +
      '</div>' +
    '</div>' +
    '<div id="cmpout" class="mt12"></div>';
}

window.filterCmpChips = function (q) {
  q = (q || "").toLowerCase().trim();
  const chips = document.querySelectorAll(".cmp-chip");
  chips.forEach(function (c) {
    const text = (c.getAttribute("data-search") || c.textContent || "").toLowerCase();
    c.style.display = !q || text.includes(q) ? "inline-flex" : "none";
  });
};

window.cmpToggle = function (id) {
  const sel = S.cache.cmpSel || [];
  const i = sel.indexOf(id);
  if (i >= 0) sel.splice(i, 1);
  else { if (sel.length >= 5) return toast("حداکثر ۵ مدل می‌توانید انتخاب کنید", "warn"); sel.push(id); }
  S.cache.cmpSel = sel;

  document.querySelectorAll(".cmp-chip").forEach(function (c) {
    const oc = c.getAttribute("onclick") || "";
    const on = sel.some(function (x) { return oc.indexOf("'" + x + "'") >= 0; });
    c.className = "cmp-chip chip clk" + (on ? " on" : "");
    const iconSpan = c.querySelector("span");
    if (iconSpan) iconSpan.textContent = on ? "✓" : "○";
  });

  const countEl = document.getElementById("cmpSelCount");
  if (countEl) countEl.textContent = sel.length + " از ۵ مدل انتخاب شده";

  const btn = document.getElementById("cmpRunBtn");
  if (btn) {
    btn.disabled = sel.length < 2;
    btn.textContent = "▶ مقایسه (" + sel.length + " مدل)";
  }
};
window.runCompare = async function () {
  const sel = S.cache.cmpSel || [];
  if (sel.length < 2) return toast("حداقل ۲ مدل", "err");
  const out = document.getElementById("cmpout");
  out.innerHTML = loading("در حال مقایسه…");
  try {
    const r = await api("/models/compare", { body: { ids: sel }, long: true, timeout: 300000 });
    out.innerHTML = card({
      title: "نتیجه مقایسه", icon: "⇄",
      raw: dataView({
        rows: r,
        empty: { title: "نتیجهای نیست" },
        cols: [{ t: "Model" }, { t: "Provider" }, { t: "Quality", align: "num" }, { t: "Latency", align: "num" }, { t: "Cost/1M", align: "num" }, { t: "Score", align: "num" }],
        tr: function (x) {
          return tr([
            "<b>" + h(short(x.displayName || x.model, 26)) + "</b>",
            '<span class="tiny">' + h(short(x.provider, 16)) + "</span>",
            { v: '<b class="mono">' + n(x.quality) + "</b>", align: "num" },
            { v: '<span class="mono tiny">' + ms(x.latency) + "</span>", align: "num" },
            { v: '<span class="mono tiny">' + price(x.cost ? x.cost.inputPer1M : null, x.cost && x.cost.free) + "</span>", align: "num" },
            { v: '<span class="mono">' + (x.score && x.score.overall !== null ? Math.round(x.score.overall) : "—") + "</span>", align: "num" }
          ]);
        },
        li: function (x) {
          return li({
            icon: "◆", title: "<b>" + h(short(x.displayName || x.model, 26)) + "</b>",
            sub: h(short(x.provider, 16)) + " · quality " + n(x.quality) + " · " + ms(x.latency) + " · " + price(x.cost ? x.cost.inputPer1M : null, x.cost && x.cost.free),
            end: '<b class="mono tiny">' + (x.score && x.score.overall !== null ? Math.round(x.score.overall) : "—") + "</b>"
          });
        }
      })
    }) + '<div class="g g2 mt12">' + r.map(function (x) {
      return card({
        title: short(x.displayName || x.model, 28), sub: x.provider,
        body: Object.keys(x.byTask || {}).map(function (k) { return bar(k, x.byTask[k], 100, Math.round(x.byTask[k])); }).join("") +
          '<div class="chips mt8">' + Object.keys(x.capabilities || {}).filter(function (c) { return x.capabilities[c]; }).slice(0, 8).map(function (c) { return '<span class="chip">' + h(c) + "</span>"; }).join("") + "</div>"
      });
    }).join("") + "</div>";
  } catch (e) { out.innerHTML = errBox(e); }
};

/* ═══════════ ROUTING ═══════════ */
async function viewRouting() {
  const cfg = await api("/routing");
  const tab = curTab("routing", "policy");
  const head = '<div class="ph"><div class="ph-t"><h2>Routing</h2><p>انتخاب خودکار مدل بر اساس سیاست و وزنها</p></div>' +
    '<div class="ph-a"><button class="btn sm gho"' + act("routePreview") + ">◍ Preview</button></div></div>" +
    tabsBar("routing", [["policy", "Policy"], ["weights", "Weights"], ["rules", "Rules", (cfg.rules || []).length], ["cache", "Cache & Budget"]]);

  if (tab === "weights") {
    const w = cfg.weights || {};
    return head + card({
      title: "Scoring Weights", sub: "تأثیر هر معیار در انتخاب مدل", icon: "⚖",
      body: ["quality", "speed", "reliability", "cost", "capabilities"].map(function (k) {
        return '<div class="fld"><label>' + k + ' <span class="mono tny">' + n(w[k]) + '</span></label>' +
          '<input type="number" id="w_' + k + '" value="' + (w[k] === undefined ? 0 : w[k]) + '" min="0" max="100"></div>';
      }).join("") + note("مجموع لازم نیست ۱۰۰ باشد؛ نسبتها مهم است."),
      foot: '<div class="sp"></div><button class="btn pri"' + act("saveWeights") + ">ذخیره وزنها</button>"
    });
  }
  if (tab === "rules") {
    return head + card({
      title: "Routing Rules", sub: "برای هر task یک مدل ثابت تعیین کنید", flat: true, icon: "⇉",
      actions: '<button class="btn sm pri"' + act("ruleNew") + ">＋ Rule</button>",
      body: lst((cfg.rulesResolved || cfg.rules || []).map(function (r) {
        return li({
          icon: "⇉",
          title: bdg(r.task || "chat", "acc") + " → " + h(r.modelName || r.modelId || "auto") + (r.enabled === false ? " " + bdg("disabled", "mut") : ""),
          sub: (r.providerName ? "provider: " + h(r.providerName) + " · " : "") +
            ((r.fallbackNames || []).length ? "fallback: " + h((r.fallbackNames || []).join(", ")) : "بدون fallback") +
            " · priority " + n(r.priority),
          actions: '<button class="btn sm dan"' + act("delEntity", "Rule", "/routing/rules/" + r.id, "routing") + ">🗑</button>"
        });
      }), { icon: "⇉", title: "Rule تعریف نشده", sub: "بدون Rule، انتخاب مدل کاملاً خودکار است", btn: { t: "＋ ساخت Rule", on: act("ruleNew") } })
    });
  }
  if (tab === "cache") {
    return head + card({
      title: "Cache & Budget", icon: "⚡",
      body: '<div class="fld"><label class="swt"><div><div class="sl">Response Cache</div><div class="sd">پاسخهای مشابه از cache خوانده شوند</div></div>' +
        '<input type="checkbox" id="r_cache"' + (cfg.enableCache !== false ? " checked" : "") + '><span class="swt-b"></span></label></div>' +
        '<div class="fld"><label>Cache TTL (ثانیه)</label><input type="number" id="r_ttl" value="' + n(cfg.cacheTTL || 3600).replace(/,/g, "") + '"></div>' +
        '<div class="fld"><label>Latency Limit (ms)</label><input type="number" id="r_lat" value="' + (cfg.latencyLimitMs || 0) + '"><div class="hint">۰ = بدون محدودیت</div></div>' +
        '<div class="fld"><label>Monthly Budget (USD)</label><input type="number" id="r_bud" step="0.01" value="' + (cfg.monthlyBudget || 0) + '"><div class="hint">۰ = بدون سقف</div></div>' +
        '<div class="fld"><label>Max Fallbacks</label><input type="number" id="r_fb" value="' + (cfg.maxFallbacks === undefined ? 3 : cfg.maxFallbacks) + '" min="0" max="10"></div>',
      foot: '<div class="sp"></div>' +
        '<button class="btn gho"' + act("clearCache") + ">پاک کردن Cache</button>" +
        '<button class="btn pri"' + act("saveRoutingCache") + ">ذخیره</button>"
    }) + '<div class="mt12" id="cacheStats"></div>';
  }

  const pols = cfg.policies || {};
  return head +
    card({
      title: "Policy", sub: "استراتژی کلی انتخاب مدل", icon: "◎",
      body: '<div class="g g2 tight">' + Object.keys(pols).map(function (k) {
        const p = pols[k];
        return '<div class="card hov pad ' + (cfg.policy === k ? "acc" : "") + '"' + act("setPolicy", k) + ">" +
          '<div class="row"><b>' + h(k) + "</b><div class=\"sp\"></div>" + (cfg.policy === k ? bdg("فعال", "acc") : "") + "</div>" +
          '<div class="tiny mb8">' + h(p.label || "") + "</div>" +
          Object.keys(p.weights || {}).map(function (w) { return bar(w, p.weights[w], 100, p.weights[w]); }).join("") +
          "</div>";
      }).join("") + "</div>"
    }) +
    card({
      title: "Load Balancing", icon: "⚖", cls: "mt12",
      body: '<div class="fld"><label>Strategy</label><div class="seg">' +
        (cfg.strategies || []).map(function (s) {
          return "<button" + (cfg.strategy === s ? ' class="on"' : "") + act("setStrategy", s) + ">" + h(s) + "</button>";
        }).join("") + "</div></div>" +
        '<div class="fld"><label>Default Model</label><select id="r_def">' +
        '<option value="">هیچکدام (Auto)</option>' +
        (await defaultModelOpts(cfg.defaultModelId)) + "</select></div>",
      foot: '<div class="sp"></div><button class="btn pri"' + act("saveDefaultModel") + ">ذخیره Default</button>"
    });
}
async function defaultModelOpts(cur) {
  try {
    const list = await usableModels();
    return list.map(function (m) {
      return '<option value="' + h(m.id) + '"' + (cur === m.id ? " selected" : "") + ">" + h(short(m.name || m.apiModelId, 40)) + "</option>";
    }).join("");
  } catch (e) { return ""; }
}
window.setPolicy = async function (p) {
  await doAct(function () { return api("/routing", { method: "PATCH", body: { policy: p } }); }, "Policy = " + p, { close: false });
};
window.setStrategy = async function (s) {
  await doAct(function () { return api("/routing", { method: "PATCH", body: { strategy: s } }); }, "Strategy = " + s, { close: false });
};
window.saveDefaultModel = async function () {
  const v = (document.getElementById("r_def") || {}).value;
  await doAct(function () { return api("/routing", { method: "PATCH", body: { defaultModelId: v || null } }); }, "ذخیره شد", { close: false });
};
window.saveWeights = async function () {
  const b = {};
  ["quality", "speed", "reliability", "cost", "capabilities"].forEach(function (k) {
    const e = document.getElementById("w_" + k);
    if (e) b[k] = Number(e.value) || 0;
  });
  await doAct(function () { return api("/routing/weights", { body: b }); }, "وزنها ذخیره شد", { close: false });
};
window.saveRoutingCache = async function () {
  const g = function (id) { const e = document.getElementById(id); return e ? e.value : null; };
  const b = {
    enableCache: !!(document.getElementById("r_cache") || {}).checked,
    cacheTTL: Number(g("r_ttl")) || 3600,
    latencyLimitMs: Number(g("r_lat")) || 0,
    monthlyBudget: Number(g("r_bud")) || 0,
    maxFallbacks: Number(g("r_fb")) || 0
  };
  await doAct(function () { return api("/routing", { method: "PATCH", body: b }); }, "ذخیره شد", { close: false });
};
window.clearCache = function () {
  confirmSheet("پاک کردن Cache؟", "همه پاسخهای cache شده حذف میشوند.", async function () {
    await doAct(function () { return api("/cache/clear", { body: {} }); }, "Cache پاک شد");
  });
};
window.ruleNew = async function () {
  const models = await usableModels();
  if (!models.length) return toast("اول یک Provider اضافه کنید", "warn");
  editSheet({
    title: "Routing Rule جدید",
    fields: [
      { k: "task", l: "Task", v: "chat", hint: "مثل chat, coding, reasoning" },
      { k: "modelId", l: "Model", t: "select", opts: [["", "Auto"]].concat(models.map(function (m) { return [m.id, short(m.name || m.apiModelId, 40)]; })) },
      { k: "priority", l: "Priority", t: "num", v: 0 },
      { k: "enabled", l: "فعال", t: "switch", v: true }
    ],
    onSave: async function (v) { await doAct(function () { return api("/routing/rules", { body: v }); }, "Rule ساخته شد"); }
  });
};
window.routePreview = function () {
  editSheet({
    title: "Routing Preview", sub: "ببینید برای یک درخواست چه مدلی انتخاب میشود",
    fields: [
      { k: "text", l: "متن نمونه", t: "area", rows: 3, ph: "یک تابع پایتون بنویس که…" },
      { k: "task", l: "Task", ph: "chat" }
    ],
    okText: "◍ Preview",
    onSave: async function (v) {
      sheetBody(loading());
      const r = await api("/routing/preview", { body: v });
      sheetBody(kv("Task", bdg(r.task, "acc")) + kv("مدلهای واجد شرایط", n(r.total)) +
        '<h4 class="mt16 mb8">Chain (به ترتیب)</h4>' +
        (r.chain || []).map(function (c, i) {
          return '<div class="node"><span class="node-n">' + (i + 1) + "</span>" +
            '<div class="sp"><div style="font-weight:600;font-size:12.5px">' + h(short(c.name, 34)) + "</div>" +
            '<div class="tny">' + h(c.provider) + " · " + ms(c.latency) + "</div></div>" + statusBdg(c.status) + "</div>";
        }).join("") +
        '<h4 class="mt16 mb8">Weights</h4>' + Object.keys(r.weights || {}).map(function (k) { return bar(k, r.weights[k], 100, r.weights[k]); }).join(""));
    }
  });
};
`;
