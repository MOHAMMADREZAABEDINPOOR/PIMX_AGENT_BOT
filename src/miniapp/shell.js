export const APP_SHELL = String.raw`
/* ═══════════ NAV STRUCTURE ═══════════ */
function pxBuildNav() { return [
  { g: pxText("فضای من"), items: [
    { id: "home", i: "🏠", l: pxText("شروع") },
    { id: "chat", i: "💬", l: pxText("گفتگوها") },
    { id: "backup", i: "💾", l: pxText("پشتیبان و انتقال") },
    { id: "council", i: "🧠", l: pxText("شورای هوش مصنوعی") },
    { id: "playground", i: "▶", l: pxText("آزمایشگاه پارامتریک") }
  ]},
  { g: pxText("گیت‌وی و مدل‌ها"), items: [
    { id: "providers", i: "🔌", l: pxText("پروایدرها") },
    { id: "models", i: "🤖", l: pxText("مدل‌ها") },
    { id: "compare", i: "⚖", l: pxText("آرنا و مقایسه") },
    { id: "routing", i: "⇄", l: pxText("مسیریابی هوشمند") }
  ]},
  { g: pxText("دانش و استودیو"), items: [
    { id: "memory", i: "🧠", l: pxText("حافظه ساختاریافته") },
    { id: "knowledge", i: "📚", l: pxText("پایگاه دانش RAG") },
    { id: "prompts", i: "🧪", l: pxText("استودیو پرامپت") },
    { id: "projects", i: "📁", l: pxText("پروژه‌ها") }
  ]},
  { g: pxText("عامل‌ها و ابزارها"), items: [
    { id: "agents", i: "🤝", l: pxText("عامل‌های هوشمند") },
    { id: "tools", i: "🛠", l: pxText("ابزارها و MCP") },
    { id: "automation", i: "⚡", l: pxText("اتوماسیون و سناریوها") }
  ]},
  { g: pxText("عملیات و پایش"), items: [
    { id: "monitor", i: "📡", l: pxText("سلامت و تلمتری") },
    { id: "costs", i: "📊", l: pxText("مصرف و هزینه‌ها") },
    { id: "eval", i: "◎", l: pxText("ارزیابی کیفیت") },
    { id: "alerts", i: "🔔", l: pxText("هشدارها") },
    { id: "approvals", i: "🛡", l: pxText("تأییدیه‌ها") }
  ]},
  { g: pxText("سیستم"), items: [
    { id: "settings", i: "⚙️", l: pxText("تنظیمات پلتفرم") }
  ]}
]; }
let NAV = pxBuildNav();

function pxBuildTabs() { return [
  { id: "home", i: "🏠", l: pxText("شروع") },
  { id: "chat", i: "💬", l: pxText("چت") },
  { id: "council", i: "🧠", l: pxText("شورا") },
  { id: "backup", i: "💾", l: pxText("پشتیبان") },
  { id: "__more", i: "☰", l: pxText("منو") }
]; }
let TABS = pxBuildTabs();

function pxBuildTitles() { return {
  home: [pxText("فضای هوشمند تو"), pxText("ایده‌ها از همین‌جا شروع می‌شوند")],
  chat: [pxText("گفتگوها"), pxText("پاسخ زنده، با حافظهٔ شخصی تو")],
  backup: [pxText("پشتیبان و انتقال"), pxText("گفتگو و حافظه‌ات را همراهت ببر")],
  council: [pxText("شورای هوش مصنوعی"), pxText("هم‌اندیشی و داوری چند مدل")],
  playground: ["Playground", pxText("تست مستقیم و پارامتریک مدل")],
  providers: [pxText("پروایدرهای هوش مصنوعی"), pxText("مدیریت کلیدها و منابع API")],
  provider: [pxText("جزئیات پروایدر"), pxText("پیکربندی و سلامت اتصال")],
  models: [pxText("فهرست مدل‌ها"), pxText("مدل‌های در دسترس و وضعیت")],
  model: [pxText("مشخصات مدل"), pxText("عملکرد، هزینه و پیکربندی")],
  compare: [pxText("آرنای مقایسه زنده"), pxText("تست همزمان چند مدل")],
  routing: [pxText("مسیریابی هوشمند"), pxText("قوانین انتخاب خودکار مدل")],
  agents: [pxText("عامل‌های هوشمند"), pxText("ایجنت‌های خودکار و ابزارها")],
  agent: [pxText("پیکربندی ایجنت"), pxText("پرامپت، ابزارها و تاریخچه")],
  runs: [pxText("تاریخچه اجرا"), pxText("لاگ اجراهای خودکار ایجنت")],
  run: [pxText("جزئیات اجرا"), pxText("بررسی مراحل و ابزارهای صدازده شده")],
  tools: [pxText("ابزارها و MCP"), pxText("توابع و یکپارچگی‌های خارجی")],
  memory: [pxText("حافظه بلندمدت"), pxText("پروفایل و دانش استخراج‌شده")],
  knowledge: [pxText("پایگاه دانش RAG"), pxText("مدیریت اسناد و وکتورها")],
  prompts: [pxText("استودیو پرامپت"), pxText("قالب‌ها، نسخه‌ها و A/B Test")],
  projects: [pxText("پروژه‌ها"), pxText("گروه‌بندی کارهای تیمی و شخصی")],
  automation: [pxText("اتوماسیون و سناریوها"), pxText("زمان‌بندی و ورودی‌های خودکار")],
  monitor: [pxText("مانیتورینگ و تلمتری"), pxText("سلامت سرویس‌ها و لتنسی")],
  costs: [pxText("مدیریت هزینه‌ها"), pxText("بودجه و پایش توکن‌ها")],
  eval: [pxText("ارزیابی کیفیت"), pxText("سنجش و بنچمارک هوشمند")],
  alerts: [pxText("هشدارهای سیستمی"), pxText("مانیتورینگ خطاهای سرویس")],
  approvals: [pxText("تأییدیه‌های حساس"), pxText("کنترل اقدامات امنیتی")],
  settings: [pxText("تنظیمات پلتفرم"), pxText("سکرت‌ها، توکن‌ها و تم")],
  tenants: [pxText("سازمان‌ها و مستأجرین"), pxText("مدیریت دسترسی چندگانه")]
}; }
let TITLES = pxBuildTitles();
window.pxRefreshNavigationLanguage = function() {
  NAV = pxBuildNav(); TABS = pxBuildTabs(); TITLES = pxBuildTitles();
};

const PARENT = {
  provider: "providers", model: "models", agent: "agents", run: "runs", runs: "agents", tenants: "settings"
};

/* ═══════════ ROUTER ═══════════ */
const VIEWS = {
  home: viewHome, chat: viewChat, council: viewCouncil, playground: viewPlayground,
  providers: viewProviders, provider: viewProvider, models: viewModels, model: viewModel,
  compare: viewCompare, routing: viewRouting,
  agents: viewAgents, agent: viewAgent, runs: viewRuns, run: viewRun, tools: viewTools,
  memory: viewMemory, knowledge: viewKnowledge, prompts: viewPrompts, projects: viewProjects,
  automation: viewAutomation, monitor: viewMonitor, costs: viewCosts, eval: viewEval,
  alerts: viewAlerts, approvals: viewApprovals, settings: viewSettings, tenants: viewTenants
};
const FLUSH = { chat: true };
const NAV_SESSION = Math.random().toString(36).slice(2);
let NAV_INDEX = -1;
let TG_BACK_BUTTON = null;

function goBack() {
  if (document.getElementById("workspaceChoiceOverlay")) { window.closeWorkspaceChoice(); return; }
  if (document.getElementById("modelPickerOverlay")) { window.closeModelPicker(); return; }
  if (document.getElementById("sheetOverlay")) { window.closeSheet(); return; }
  if (document.getElementById("palOverlay")) { window.closePalette(); return; }
  if (S.navOpen) { closeNav(); return; }
  if (S.route === "home") return;
  haptic("impact", "light");
  // Only use browser history when the previous entry belongs to this Mini App.
  if (NAV_INDEX > 0) history.back();
  else {
    history.replaceState(history.state, "", hashFor(PARENT[S.route] || "home"));
    applyHash();
  }
}
window.goBack = goBack;

function syncBackButton() {
  const visible = S.route !== "home";
  const button = document.getElementById("headBack");
  if (button) button.hidden = !visible;
  try {
    const t = tgApp();
    const back = t && t.BackButton;
    if (!back) return;
    if (TG_BACK_BUTTON !== back) {
      if (TG_BACK_BUTTON) TG_BACK_BUTTON.offClick(goBack);
      back.onClick(goBack);
      TG_BACK_BUTTON = back;
    }
    if (visible) back.show(); else back.hide();
  } catch (e) { console.warn("[TG BackButton]", e); }
}

function hashFor(route, params, query) {
  let s = "#" + route;
  if (params && params.id) s += "/" + encodeURIComponent(params.id);
  const qk = Object.keys(query || {}).filter(function (k) { return query[k] !== "" && query[k] !== undefined && query[k] !== null; });
  if (qk.length) s += "?" + qk.map(function (k) { return k + "=" + encodeURIComponent(query[k]); }).join("&");
  return s;
}

function parseHash() {
  let raw = (location.hash || "#home").slice(1);
  if (raw.indexOf("tgWebAppData=") >= 0 || raw.indexOf("tgWebApp") >= 0) {
    try {
      const p = new URLSearchParams(raw);
      const sp = p.get("tgWebAppStartParam") || p.get("start_param");
      raw = sp || "home";
    } catch (e) {
      raw = "home";
    }
  }
  const qi = raw.indexOf("?");
  const pathPart = qi >= 0 ? raw.slice(0, qi) : raw;
  const queryPart = qi >= 0 ? raw.slice(qi + 1) : "";
  const seg = pathPart.split("/");
  const query = {};
  if (queryPart) queryPart.split("&").forEach(function (kv2) {
    const i = kv2.indexOf("=");
    if (i > 0) query[kv2.slice(0, i)] = decodeURIComponent(kv2.slice(i + 1));
  });
  const rName = seg[0] || "home";
  const finalRoute = (VIEWS && VIEWS[rName]) ? rName : "home";
  return {
    route: finalRoute,
    params: seg[1] ? { id: decodeURIComponent(seg[1]) } : {},
    query: query
  };
}

function go(route, params, query) {
  haptic("impact", "light");
  if (typeof params === "string" || typeof params === "number") params = { id: params };
  const target = hashFor(route, params, query);
  closeNav();
  if (location.hash === target) { applyHash(); return; }
  location.hash = target;
}
window.go = go;

function applyHash() {
  const p = parseHash();
  const entry = history.state;
  if (entry && entry.pimxNavigation === NAV_SESSION) NAV_INDEX = entry.pimxIndex;
  else {
    NAV_INDEX++;
    history.replaceState(Object.assign({}, entry, { pimxNavigation: NAV_SESSION, pimxIndex: NAV_INDEX }), "");
  }
  S.route = p.route; S.params = p.params; S.query = p.query;
  render();
}

/* ═══════════ SHELL HTML ═══════════ */
function navHtml() {
  const uname = userLabel();
  return '<aside class="side' + (S.navOpen ? " open" : "") + '" id="side">' +
    '<div class="side-h"><div class="logo">P</div>' +
    pxText('<div><div class="nm">PIMX<span>AGENT</span></div><div class="tg">فضای هوشمند تو</div></div></div>') +
    '<button class="side-new" onclick="newChat()">' + pxIcon('spark') + pxText('<span>یک گفتگوی تازه</span><span class="side-plus">＋</span></button>') +
    '<div class="side-s">' +
    NAV.map(function (g) {
      const items = g.items.filter(function (it) { return !it.admin || S.isAdmin; });
      if (!items.length) return "";
      return '<div class="navg"><div class="navg-t">' + h(g.g) + '</div>' +
        items.map(function (it) {
          const on = S.route === it.id || PARENT[S.route] === it.id;
          return '<button class="navi' + (on ? " on" : "") + '" data-route="' + h(it.id) + '" aria-current="' + (on ? "page" : "false") + '"' + act("navGo", it.id) + '>' +
            '<i aria-hidden="true">' + pxIcon(it.id) + '</i><span>' + h(it.l) + '</span></button>';
        }).join("") + '</div>';
    }).join("") +
    '</div>' +
    '<div class="side-f"><button class="uchip"' + act("navGo", "settings") + '>' +
    avatarHtml(32) +
    '<div style="flex:1;min-width:0;text-align:start"><div class="font-bold text-sm text-truncate">' + h(uname) + '</div>' +
    '<div class="text-xs text-muted">' + (S.user && S.user.username ? "@" + h(S.user.username) : (S.isAdmin ? "👑 Admin" : "User")) + '</div></div></button></div>' +
    '</aside>';

}

function userLabel() {
  const u = S.user || {};
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return full || u.name || u.username || pxText("کاربر PIMX");
}
function userInitials() {
  const u = S.user || {};
  const a = String(u.firstName || u.name || u.username || "P").trim();
  const b = String(u.lastName || "").trim();
  if (b) return (a.slice(0, 1) + b.slice(0, 1)).toUpperCase();
  return a.slice(0, 2).toUpperCase();
}
function avatarHtml(size) {
  const px = size || 32;
  const src = S.avatarOk ? "/api/me/avatar" : (S.user && S.user.photoUrl) || "";
  if (src) {
    return '<img class="uav" src="' + h(src) + '" alt="" width="' + px + '" height="' + px + '" ' +
      'onerror="this.outerHTML=window.avatarFallback(' + px + ')">';
  }
  return avatarFallback(px);
}
function avatarFallback(px) {
  return '<div class="uav" style="width:' + px + 'px;height:' + px + 'px">' + h(userInitials()) + '</div>';
}
function probeAvatar() {
  fetch("/api/me/avatar", {
    headers: S.token ? { Authorization: "Bearer " + S.token } : (tgInitData() ? { "X-Telegram-Init-Data": tgInitData() } : {})
  }).then(function (r) {
    if (!r.ok) return;
    S.avatarOk = true;
    const hb = document.querySelector(".avbtn");
    if (hb) hb.innerHTML = avatarHtml(32);
  }).catch(function () { });
}
window.probeAvatar = probeAvatar;
window.userLabel = userLabel; window.avatarHtml = avatarHtml; window.avatarFallback = avatarFallback; window.userInitials = userInitials;
window.navGo = function (id) { closeNav(); go(id); };

function tabsHtml() {
  return pxText('<nav class="tabbar" role="navigation" aria-label="ناوبری اصلی">') + TABS.map(function (t) {
    if (t.id === "__more") {
      const on = ["home", "chat", "council", "backup"].indexOf(S.route) < 0;
      return '<button class="tabi' + (on ? " on" : "") + pxText('" data-route="__more" onclick="openNav()" aria-label="منوی کامل">') +
        '<i aria-hidden="true">' + pxIcon('menu') + '</i><span>' + h(t.l) + '</span></button>';
    }
    const on = S.route === t.id || PARENT[S.route] === t.id;
    return '<button class="tabi' + (on ? " on" : "") + '" data-route="' + h(t.id) + '" aria-current="' + (on ? "page" : "false") + '"' + act("go", t.id) + '>' +
      '<i aria-hidden="true">' + pxIcon(t.id) + '</i><span>' + h(t.l) + '</span></button>';
  }).join("") + '</nav>';
}


function shell(content) {
  const meta = TITLES[S.route] || [S.route, ""];
  const isLight = document.documentElement.getAttribute("data-px-theme") === "light";
  return navHtml() +
    '<div class="side-overlay' + (S.navOpen ? " open" : "") + '" id="scrim" onclick="closeNav()"></div>' +
    '<div class="main-wrap">' +
    '<header class="head">' +
    pxText('<button class="btn-icon head-menu" onclick="openNav()" aria-label="منوی اصلی">') + pxIcon('menu') + '</button>' +
    pxText('<button class="btn-icon head-back" id="headBack" onclick="goBack()" aria-label="بازگشت" title="بازگشت"') + (S.route === "home" ? ' hidden' : '') + '><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>' +
    '<div class="head-t"><h1>' + h(meta[0]) + '</h1><div class="sub">' + h(meta[1]) + '</div></div>' +
    '<div class="head-actions">' +
    '<button class="btn-icon language-toggle" id="languageToggle" onclick="pxToggleLanguage()" aria-label="' + (PX_LANGUAGE === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی') + '" title="' + (PX_LANGUAGE === 'fa' ? 'English' : 'فارسی') + '">' + (PX_LANGUAGE === 'fa' ? 'EN' : 'فا') + '</button>' +
    pxText('<button class="btn-icon" onclick="palette()" title="جستجو و اجرای سریع (Ctrl+K)" aria-label="جستجو">') + pxIcon('search') + '</button>' +
    pxText('<button class="btn-icon theme-toggle" onclick="pxToggleTheme()" title="تغییر تم" aria-label="تغییر تم">') + pxIcon(isLight ? 'moon' : 'sun') + '</button>' +
    pxText('<button class="btn-icon head-refresh" onclick="hardRefresh()" title="بروزرسانی داده‌ها" aria-label="بروزرسانی">') + pxIcon('restore') + '</button>' +
    pxText('<button class="btn-icon avbtn" onclick="go(\'settings\')" aria-label="پروفایل و تنظیمات">') + avatarHtml(28) + '</button>' +
    '</div>' +
    '</header>' +
    '<main class="main" id="main"><div id="view">' + content + '</div></main>' +
    tabsHtml() +
    '</div>';
}


window.openNav = function () {
  haptic("impact", "light");
  S.navOpen = true;
  const s = document.getElementById("side"), sc = document.getElementById("scrim");
  if (s) s.className = "side open";
  if (sc) sc.className = "side-overlay open";
};
window.closeNav = function () {
  S.navOpen = false;
  const s = document.getElementById("side"), sc = document.getElementById("scrim");
  if (s) s.className = "side";
  if (sc) sc.className = "side-overlay";
};
window.hardRefresh = function () { haptic("impact", "medium"); bust(); render(); };

function paintNavActive() {
  syncBackButton();
  document.querySelectorAll(".navi").forEach(function (b) {
    const id = b.getAttribute("data-route");
    const on = S.route === id || PARENT[S.route] === id;
    b.className = "navi" + (on ? " on" : "");
  });
  document.querySelectorAll(".tabi").forEach(function (a) {
    const id = a.getAttribute("data-route");
    const on = id === "__more"
      ? ["home", "chat", "council", "backup"].indexOf(S.route) < 0
      : (S.route === id || PARENT[S.route] === id);
    if (on) a.classList.add("on"); else a.classList.remove("on");
  });
  const meta = TITLES[S.route] || [S.route, ""];
  const t = document.querySelector(".head-t");
  if (t) t.innerHTML = '<h1>' + h(meta[0]) + '</h1><div class="sub">' + h(meta[1]) + '</div>';
  const themeButton = document.querySelector('.theme-toggle');
  if (themeButton) themeButton.innerHTML = pxIcon(pxTheme() === 'light' ? 'moon' : 'sun');
  const main = document.getElementById('main');
  if (main) main.classList.toggle('chat-page', S.route === 'chat');
}

let RENDERING = 0;
let LAST_ROUTE = null;
async function render() {
  const app = document.getElementById("app");
  if (!app) return;
  const token = ++RENDERING;

  if (!document.getElementById("view")) {
    app.className = "shell";
    app.innerHTML = shell(loading());
    paintNavActive();
  } else {
    paintNavActive();
    const v = document.getElementById("view");
    if (LAST_ROUTE !== S.route) v.innerHTML = loading();
    else v.setAttribute("aria-busy", "true");
  }
  LAST_ROUTE = S.route;

  try {
    const fn = VIEWS[S.route] || viewHome;
    const html = await fn();
    if (token !== RENDERING) return;
    const v = document.getElementById("view");
    if (v) { v.classList.remove('workspace-view'); delete v.dataset.workspace; v.innerHTML = html; v.removeAttribute("aria-busy"); }
    if (window.pxRestoreLanguageDraft) window.pxRestoreLanguageDraft();
    if (window.AFTER && window.AFTER[S.route]) {
      try { await window.AFTER[S.route](); } catch (e) { console.warn("[AFTER]", e); }
    }
    const main = document.getElementById("main");
    if (main && !FLUSH[S.route]) main.scrollTop = 0;
  } catch (e) {
    if (token !== RENDERING) return;
    console.error("[render]", S.route, e);
    const v = document.getElementById("view");
    if (v) { v.innerHTML = errBox(e); v.removeAttribute("aria-busy"); }
  }
}
window.render = render;

function warm() {
  try {
    cached("models", function () { return api("/models?size=300"); });
    cached("provList", function () { return api("/providers"); });
    cached("convs", function () { return api("/conversations"); });
  } catch (e) { }
}
window.warm = warm;

/* ═══════════ COMMAND PALETTE ═══════════ */
const CMDS = [];
NAV.forEach(function (g) {
  g.items.forEach(function (it) {
    CMDS.push({ g: g.g, i: it.i, t: it.l, s: pxText("رفتن به ") + it.l, run: function () { go(it.id); } });
  });
});
CMDS.push(
  { g: pxText("اقدامات سریع"), i: "＋", t: pxText("مکالمه جدید"), s: pxText("چت تازه با مدل پیش‌فرض"), run: function () { newChat(); } },
  { g: pxText("اقدامات سریع"), i: "＋", t: pxText("افزودن پروایدر"), s: pxText("تنظیم منبع هوش مصنوعی"), run: function () { providerNew(); } },
  { g: pxText("اقدامات سریع"), i: "＋", t: pxText("ایجنت هوشمند جدید"), s: pxText("تعریف عامل سفارشی"), run: function () { agentNew(); } },
  { g: pxText("اقدامات سریع"), i: "＋", t: pxText("ثبت حافظه جدید"), s: pxText("افزودن اطلاعات شخصی"), run: function () { memNew(); } },
  { g: pxText("اقدامات سریع"), i: "⚡", t: pxText("شورای هم‌فکری AI"), s: pxText("پرسش همزمان از چند مدل"), run: function () { go("council"); } },
  { g: pxText("اقدامات سریع"), i: "⇄", t: pxText("آرنا و مقایسه"), s: pxText("تست مستقیم چند مدل"), run: function () { go("compare"); } },
  { g: pxText("عملیات"), i: "◍", t: pxText("پایش سلامت مدل‌ها"), s: pxText("اجرای Health Check کامل"), run: function () { healthSweep(); } },
  { g: pxText("عملیات"), i: "↻", t: pxText("پاکسازی کش"), s: pxText("تازه کردن تمام داده‌ها"), run: function () { hardRefresh(); } }
);

function palette() {
  haptic("impact", "medium");
  S.palOpen = true; S.palSel = 0;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  overlay.id = "palOverlay";
  overlay.onclick = function(e) { if (e.target === overlay) closePalette(); };

  const s = document.createElement("div");
  s.className = "modal-sheet";
  s.innerHTML = '<div class="sheet-handle"></div>' +
    pxText('<div class="flex-between mb-3"><div class="card-t">🔍 جستجوی سریع در پلتفرم</div><button class="btn-icon" onclick="closePalette()">✕</button></div>') +
    pxText('<input id="palQ" class="input mb-3" placeholder="جستجوی صفحه، مدل، دستور یا پروایدر…" autocomplete="off">') +
    '<div id="palL" style="max-height:50vh;overflow-y:auto"></div>';

  overlay.appendChild(s);
  document.body.appendChild(overlay);

  const inp = document.getElementById("palQ");
  paintPalette("");
  inp.oninput = function () { S.palSel = 0; paintPalette(inp.value); };
  setTimeout(function () { inp.focus(); }, 60);
}

function paintPalette(qv) {
  const box = document.getElementById("palL");
  if (!box) return;
  const term = String(qv || "").toLowerCase().trim();
  const local = CMDS.filter(function (c) {
    return !term || c.t.toLowerCase().indexOf(term) >= 0 || (c.s || "").toLowerCase().indexOf(term) >= 0;
  }).slice(0, 10);

  let html = "";
  local.forEach(function (c, idx) {
    const ci = CMDS.indexOf(c);
    html += '<div class="uchip mb-2 cursor-pointer" onclick="runCmd(' + ci + ')">' +
      '<div class="uav">' + c.i + '</div>' +
      '<div style="flex:1"><div class="font-bold text-sm">' + h(c.t) + '</div><div class="text-xs text-muted">' + h(c.s) + '</div></div>' +
      '</div>';
  });
  if (!local.length) html = pxText('<div class="text-muted text-center py-4">نتیجه‌ای یافت نشد</div>');
  box.innerHTML = html;
}
window.runCmd = function (i) { const c = CMDS[i]; closePalette(); if (c) c.run(); };
function closePalette() {
  haptic("selection");
  S.palOpen = false;
  const a = document.getElementById("palOverlay");
  if (a) a.remove();
}
window.palette = palette; window.closePalette = closePalette;

document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "k") { e.preventDefault(); if (S.palOpen) closePalette(); else palette(); }
  else if (e.key === "Escape") { if (S.palOpen) closePalette(); else if (document.getElementById("sheetOverlay")) closeSheet(); else if (S.navOpen) closeNav(); }
});

/* ═══════════ BOOT PROCESS ═══════════ */
function applyTgChrome() {
  try {
    const t = tgApp();
    if (!t) return;
    t.ready();
    t.expand();
    const color = pxTheme() === 'light' ? '#f7f6fb' : '#101016';
    if (t.setHeaderColor) t.setHeaderColor(color);
    if (t.setBackgroundColor) t.setBackgroundColor(color);
    if (t.enableClosingConfirmation) t.enableClosingConfirmation();
  } catch (e) { console.warn("[TG]", e); }
}

function waitForTG(ms) {
  return new Promise(function (resolve) {
    const t0 = Date.now();
    (function poll() {
      const wa = tgApp();
      if (wa && (wa.initData || Date.now() - t0 > 1200)) return resolve(wa);
      if (Date.now() - t0 > ms) return resolve(wa || null);
      setTimeout(poll, 25);
    })();
  });
}

function setBootMsg(msg) {
  try {
    const el = document.getElementById("bootMsg");
    if (el) el.textContent = msg;
  } catch (e) {}
}

(async function boot() {
  const app = document.getElementById("app");
  try { S.token = localStorage.getItem("pimx_token") || null; } catch (e) { }
  // A Telegram account switch must never reuse a different account's session.
  if (tgInitData()) S.token = null;
  applyTgChrome();

  let authed = false;
  if (S.token) {
    try {
      setBootMsg(pxText("بازیابی نشست کاربری…"));
      const me = await api("/me", { timeout: 3500 });
      S.user = {
        id: me.userId, name: me.name,
        firstName: me.firstName || me.name, lastName: me.lastName,
        username: me.username, photoUrl: me.photoUrl
      };
      S.isAdmin = !!me.isAdmin;
      authed = true;
    } catch (e) {
      S.token = null;
      try { localStorage.removeItem("pimx_token"); } catch (err) {}
    }
  }

  if (!authed) {
    setBootMsg(pxText("اتصال به تلگرام…"));
    const wa = await waitForTG(1500);
    applyTgChrome();
    const initData = (wa && wa.initData) || tgInitData();
    if (initData) {
      try {
        setBootMsg(pxText("احراز هویت ایمن…"));
        const r = await api("/auth", { body: { initData: initData }, timeout: 6000 });
        S.token = r.token;
        S.user = r.user;
        S.isAdmin = !!(r.user && r.user.isAdmin);
        try { localStorage.setItem("pimx_token", r.token); } catch (e) {}
        authed = true;
        if (r.startParam && VIEWS[r.startParam]) {
          try { location.hash = "#" + r.startParam; } catch (e) {}
        }
      } catch (e) {
        console.error("[auth error]", e);
      }
    }
  }

  if (!authed) {
    app.innerHTML = pxText('<div class="boot auth-gate"><div class="boot-logo">P</div><h1>فضای شخصی تو، در تلگرام</h1><p>برای دیدن گفتگوها و حافظه، این صفحه را از دکمهٔ مینی‌اپ داخل بات باز کن.</p><button class="btn pri" onclick="location.reload()">اتصال دوباره</button><span class="tiny">نشست منقضی شده؟ مینی‌اپ را ببند و دوباره باز کن.</span></div>');
    return;
  }
  setBootMsg(pxText("بارگذاری فضای شخصی…"));
  try {
    const preferences = await api('/preferences', { timeout: 2000 });
    S.cache.preferences = preferences;
    const chosen = preferences && preferences.language;
    const previousUser = localStorage.getItem('pimx_language_user');
    const desired = chosen === 'en' ? 'en' : 'fa';
    if (previousUser !== String(S.user.id) || chosen === 'en' || chosen === 'fa') {
      localStorage.setItem('pimx_language_user', String(S.user.id));
      localStorage.setItem('pimx_language', desired);
      if (desired !== PX_LANGUAGE) {
        PX_LANGUAGE = desired;
        pxApplyLanguage();
        pxRefreshNavigationLanguage();
        setBootMsg(pxText('بارگذاری فضای شخصی…'));
      }
    }
  } catch (e) { console.error('[language preferences]', e); }
  try {
    S.meta = await api("/meta", { timeout: 3500 }).catch(function () { return {}; });
  } catch (e) {}

  try { probeAvatar(); } catch (e) {}
  S.ready = true;

  window.addEventListener("hashchange", applyHash);
  applyHash();
  setTimeout(warm, 150);
})();
`;
