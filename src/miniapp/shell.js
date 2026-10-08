export const APP_SHELL = String.raw`
/* ═══════════ NAV STRUCTURE ═══════════ */
const NAV = [
  { g: "فضای من", items: [
    { id: "home", i: "🏠", l: "شروع" },
    { id: "chat", i: "💬", l: "گفتگوها" },
    { id: "backup", i: "💾", l: "پشتیبان و انتقال" },
    { id: "council", i: "🧠", l: "شورای هوش مصنوعی" },
    { id: "playground", i: "▶", l: "آزمایشگاه پارامتریک" }
  ]},
  { g: "گیت‌وی و مدل‌ها", items: [
    { id: "providers", i: "🔌", l: "پروایدرها" },
    { id: "models", i: "🤖", l: "مدل‌ها" },
    { id: "compare", i: "⚖", l: "آرنا و مقایسه" },
    { id: "routing", i: "⇄", l: "مسیریابی هوشمند" }
  ]},
  { g: "دانش و استودیو", items: [
    { id: "memory", i: "🧠", l: "حافظه ساختاریافته" },
    { id: "knowledge", i: "📚", l: "پایگاه دانش RAG" },
    { id: "prompts", i: "🧪", l: "استودیو پرامپت" },
    { id: "projects", i: "📁", l: "پروژه‌ها" }
  ]},
  { g: "عامل‌ها و ابزارها", items: [
    { id: "agents", i: "🤝", l: "عامل‌های هوشمند" },
    { id: "tools", i: "🛠", l: "ابزارها و MCP" },
    { id: "automation", i: "⚡", l: "اتوماسیون و سناریوها" }
  ]},
  { g: "عملیات و پایش", items: [
    { id: "monitor", i: "📡", l: "سلامت و تلمتری" },
    { id: "costs", i: "📊", l: "مصرف و هزینه‌ها" },
    { id: "eval", i: "◎", l: "ارزیابی کیفیت" },
    { id: "alerts", i: "🔔", l: "هشدارها" },
    { id: "approvals", i: "🛡", l: "تأییدیه‌ها" }
  ]},
  { g: "سیستم", items: [
    { id: "settings", i: "⚙️", l: "تنظیمات پلتفرم" }
  ]}
];

const TABS = [
  { id: "home", i: "🏠", l: "شروع" },
  { id: "chat", i: "💬", l: "چت" },
  { id: "council", i: "🧠", l: "شورا" },
  { id: "backup", i: "💾", l: "پشتیبان" },
  { id: "__more", i: "☰", l: "منو" }
];

const TITLES = {
  home: ["فضای هوشمند تو", "ایده‌ها از همین‌جا شروع می‌شوند"],
  chat: ["گفتگوها", "پاسخ زنده، با حافظهٔ شخصی تو"],
  backup: ["پشتیبان و انتقال", "گفتگو و حافظه‌ات را همراهت ببر"],
  council: ["شورای هوش مصنوعی", "هم‌اندیشی و داوری چند مدل"],
  playground: ["Playground", "تست مستقیم و پارامتریک مدل"],
  providers: ["پروایدرهای هوش مصنوعی", "مدیریت کلیدها و منابع API"],
  provider: ["جزئیات پروایدر", "پیکربندی و سلامت اتصال"],
  models: ["فهرست مدل‌ها", "مدل‌های در دسترس و وضعیت"],
  model: ["مشخصات مدل", "عملکرد، هزینه و پیکربندی"],
  compare: ["آرنای مقایسه زنده", "تست همزمان چند مدل"],
  routing: ["مسیریابی هوشمند", "قوانین انتخاب خودکار مدل"],
  agents: ["عامل‌های هوشمند", "ایجنت‌های خودکار و ابزارها"],
  agent: ["پیکربندی ایجنت", "پرامپت، ابزارها و تاریخچه"],
  runs: ["تاریخچه اجرا", "لاگ اجراهای خودکار ایجنت"],
  run: ["جزئیات اجرا", "بررسی مراحل و ابزارهای صدازده شده"],
  tools: ["ابزارها و MCP", "توابع و یکپارچگی‌های خارجی"],
  memory: ["حافظه بلندمدت", "پروفایل و دانش استخراج‌شده"],
  knowledge: ["پایگاه دانش RAG", "مدیریت اسناد و وکتورها"],
  prompts: ["استودیو پرامپت", "قالب‌ها، نسخه‌ها و A/B Test"],
  projects: ["پروژه‌ها", "گروه‌بندی کارهای تیمی و شخصی"],
  automation: ["اتوماسیون و سناریوها", "زمان‌بندی و ورودی‌های خودکار"],
  monitor: ["مانیتورینگ و تلمتری", "سلامت سرویس‌ها و لتنسی"],
  costs: ["مدیریت هزینه‌ها", "بودجه و پایش توکن‌ها"],
  eval: ["ارزیابی کیفیت", "سنجش و بنچمارک هوشمند"],
  alerts: ["هشدارهای سیستمی", "مانیتورینگ خطاهای سرویس"],
  approvals: ["تأییدیه‌های حساس", "کنترل اقدامات امنیتی"],
  settings: ["تنظیمات پلتفرم", "سکرت‌ها، توکن‌ها و تم"],
  tenants: ["سازمان‌ها و مستأجرین", "مدیریت دسترسی چندگانه"]
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
    '<div><div class="nm">PIMX<span>AGENT</span></div><div class="tg">فضای هوشمند تو</div></div></div>' +
    '<button class="side-new" onclick="newChat()">' + pxIcon('spark') + '<span>یک گفتگوی تازه</span><span class="side-plus">＋</span></button>' +
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
  return full || u.name || u.username || "کاربر PIMX";
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
  return '<nav class="tabbar" role="navigation" aria-label="ناوبری اصلی">' + TABS.map(function (t) {
    if (t.id === "__more") {
      const on = ["home", "chat", "council", "backup"].indexOf(S.route) < 0;
      return '<button class="tabi' + (on ? " on" : "") + '" data-route="__more" onclick="openNav()" aria-label="منوی کامل">' +
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
    '<button class="btn-icon head-menu" onclick="openNav()" aria-label="منوی اصلی">' + pxIcon('menu') + '</button>' +
    '<button class="btn-icon head-back" id="headBack" onclick="goBack()" aria-label="بازگشت" title="بازگشت"' + (S.route === "home" ? ' hidden' : '') + '><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>' +
    '<div class="head-t"><h1>' + h(meta[0]) + '</h1><div class="sub">' + h(meta[1]) + '</div></div>' +
    '<div class="head-actions">' +
    '<button class="btn-icon" onclick="palette()" title="جستجو و اجرای سریع (Ctrl+K)" aria-label="جستجو">' + pxIcon('search') + '</button>' +
    '<button class="btn-icon theme-toggle" onclick="pxToggleTheme()" title="تغییر تم" aria-label="تغییر تم">' + pxIcon(isLight ? 'moon' : 'sun') + '</button>' +
    '<button class="btn-icon head-refresh" onclick="hardRefresh()" title="بروزرسانی داده‌ها" aria-label="بروزرسانی">' + pxIcon('restore') + '</button>' +
    '<button class="btn-icon avbtn" onclick="go(\'settings\')" aria-label="پروفایل و تنظیمات">' + avatarHtml(28) + '</button>' +
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
    if (v) { v.innerHTML = html; v.removeAttribute("aria-busy"); }
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
    CMDS.push({ g: g.g, i: it.i, t: it.l, s: "رفتن به " + it.l, run: function () { go(it.id); } });
  });
});
CMDS.push(
  { g: "اقدامات سریع", i: "＋", t: "مکالمه جدید", s: "چت تازه با مدل پیش‌فرض", run: function () { newChat(); } },
  { g: "اقدامات سریع", i: "＋", t: "افزودن پروایدر", s: "تنظیم منبع هوش مصنوعی", run: function () { providerNew(); } },
  { g: "اقدامات سریع", i: "＋", t: "ایجنت هوشمند جدید", s: "تعریف عامل سفارشی", run: function () { agentNew(); } },
  { g: "اقدامات سریع", i: "＋", t: "ثبت حافظه جدید", s: "افزودن اطلاعات شخصی", run: function () { memNew(); } },
  { g: "اقدامات سریع", i: "⚡", t: "شورای هم‌فکری AI", s: "پرسش همزمان از چند مدل", run: function () { go("council"); } },
  { g: "اقدامات سریع", i: "⇄", t: "آرنا و مقایسه", s: "تست مستقیم چند مدل", run: function () { go("compare"); } },
  { g: "عملیات", i: "◍", t: "پایش سلامت مدل‌ها", s: "اجرای Health Check کامل", run: function () { healthSweep(); } },
  { g: "عملیات", i: "↻", t: "پاکسازی کش", s: "تازه کردن تمام داده‌ها", run: function () { hardRefresh(); } }
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
    '<div class="flex-between mb-3"><div class="card-t">🔍 جستجوی سریع در پلتفرم</div><button class="btn-icon" onclick="closePalette()">✕</button></div>' +
    '<input id="palQ" class="input mb-3" placeholder="جستجوی صفحه، مدل، دستور یا پروایدر…" autocomplete="off">' +
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
  if (!local.length) html = '<div class="text-muted text-center py-4">نتیجه‌ای یافت نشد</div>';
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
      setBootMsg("بازیابی نشست کاربری…");
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
    setBootMsg("اتصال به تلگرام…");
    const wa = await waitForTG(1500);
    applyTgChrome();
    const initData = (wa && wa.initData) || tgInitData();
    if (initData) {
      try {
        setBootMsg("احراز هویت ایمن…");
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
    app.innerHTML = '<div class="boot auth-gate"><div class="boot-logo">P</div><h1>فضای شخصی تو، در تلگرام</h1><p>برای دیدن گفتگوها و حافظه، این صفحه را از دکمهٔ مینی‌اپ داخل بات باز کن.</p><button class="btn pri" onclick="location.reload()">اتصال دوباره</button><span class="tiny">نشست منقضی شده؟ مینی‌اپ را ببند و دوباره باز کن.</span></div>';
    return;
  }
  setBootMsg("بارگذاری فضای شخصی…");
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
