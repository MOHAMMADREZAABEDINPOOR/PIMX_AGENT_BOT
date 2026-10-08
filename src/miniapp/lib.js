export const APP_LIB = String.raw`
/* ═══════════ STATE ═══════════ */
/* Telegram SDK loads async — resolve it lazily so nothing captures a null. */
function tgApp() { return (window.Telegram && window.Telegram.WebApp) || null; }
function tgInitData() {
  try {
    const t = tgApp();
    if (t && t.initData && typeof t.initData === "string" && t.initData.length > 5) return t.initData;
    const hash = (window.location.hash || "").slice(1);
    if (hash.indexOf("tgWebAppData=") >= 0) {
      const p = new URLSearchParams(hash);
      const d = p.get("tgWebAppData");
      if (d) return d;
    }
    const search = (window.location.search || "").slice(1);
    if (search.indexOf("tgWebAppData=") >= 0) {
      const p = new URLSearchParams(search);
      const d = p.get("tgWebAppData");
      if (d) return d;
    }
  } catch (e) {}
  return "";
}
window.tgApp = tgApp; window.tgInitData = tgInitData;

/* Haptic Feedback Helper */
function haptic(type, style) {
  try {
    const tg = tgApp();
    if (!tg || !tg.HapticFeedback) return;
    if (type === "impact") tg.HapticFeedback.impactOccurred(style || "medium");
    else if (type === "notification") tg.HapticFeedback.notificationOccurred(style || "success");
    else if (type === "selection") tg.HapticFeedback.selectionChanged();
  } catch (e) {}
}
window.haptic = haptic;

const S = {
  token: null, user: null, isAdmin: false, meta: {}, ready: false,
  route: "home", params: {}, query: {},
  cache: {}, inflight: {}, tab: {}, deadConvs: {},
  chat: { id: null, messages: [], modelId: "", sending: false, sideOpen: false, creating: false, search: "" },
  council: { mode: "judge", count: 3, rounds: 2, question: "", running: false, last: null, modelIds: [] },
  arena: { models: ["gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct"], prompt: "", running: false, results: {}, winner: null },
  navOpen: false, palOpen: false, palSel: 0, theme: "dark"
};
window.S = S;

/* ═══════════ API ═══════════ */
async function api(path, opts) {
  opts = opts || {};
  const headers = { "Content-Type": "application/json" };
  if (S.token) headers.Authorization = "Bearer " + S.token;
  else if (tgInitData()) headers["X-Telegram-Init-Data"] = tgInitData();
  const ctrl = new AbortController();
  const to = opts.timeout || (opts.long ? 240000 : 30000);
  const timer = setTimeout(function () { ctrl.abort(); }, to);
  try {
    const res = await fetch("/api" + path, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal
    });
    let j = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.indexOf("json") >= 0) j = await res.json().catch(function () { return null; });
    else { const t = await res.text().catch(function () { return ""; }); j = { ok: res.ok, data: t }; }
    if (!res.ok || (j && j.ok === false)) {
      const e = new Error((j && j.error) || ("HTTP " + res.status));
      e.hint = j && j.hint; e.status = res.status; e.data = j && j.data;
      throw e;
    }
    if (!j) throw new Error("پاسخ نامعتبر از سرور");
    return j.data;
  } catch (err) {
    if (err.name === "AbortError") {
      const e = new Error("درخواست طولانی شد (timeout)");
      e.hint = "سرور در " + Math.round(to / 1000) + " ثانیه پاسخ نداد";
      throw e;
    }
    throw err;
  } finally { clearTimeout(timer); }
}
window.api = api;

/* Cached GET with in-flight de-duplication */
async function cached(key, fn) {
  if (S.cache[key] !== undefined) return S.cache[key];
  if (S.inflight[key]) return S.inflight[key];
  S.inflight[key] = (async function () {
    try {
      const v = await fn();
      S.cache[key] = v;
      return v;
    } finally { delete S.inflight[key]; }
  })();
  return S.inflight[key];
}
function bust(prefix) {
  Object.keys(S.cache).forEach(function (k) { if (!prefix || k.indexOf(prefix) === 0) delete S.cache[k]; });
  Object.keys(S.inflight).forEach(function (k) { if (!prefix || k.indexOf(prefix) === 0) delete S.inflight[k]; });
}
window.bust = bust; window.cached = cached;

/* ═══════════ FORMAT ═══════════ */
function h(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
window.h = h;
window.esc = h;
function n(v) { return v === null || v === undefined || isNaN(v) ? "—" : Number(v).toLocaleString("en-US"); }
function ms(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  v = Number(v);
  if (v >= 60000) return (v / 60000).toFixed(1) + "m";
  if (v >= 1000) return (v / 1000).toFixed(2) + "s";
  return Math.round(v) + "ms";
}
function usd(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  v = Number(v);
  if (v === 0) return "$0.00";
  if (v < 0.001) return "$" + v.toFixed(6);
  if (v < 1) return "$" + v.toFixed(4);
  return "$" + v.toFixed(2);
}
function price(v, free) {
  if (free) return "رایگان";
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v) === 0 ? "رایگان" : usd(v);
}
function pct(v) { return v === null || v === undefined || isNaN(v) ? "—" : Math.round(Number(v)) + "%"; }
function bytes(v) {
  if (!v) return "0 B";
  const u = ["B", "KB", "MB", "GB"]; let i = 0; v = Number(v);
  while (v >= 1024 && i < 3) { v /= 1024; i++; }
  return v.toFixed(i ? 1 : 0) + " " + u[i];
}
function dt(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fa-IR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function rel(v) {
  if (!v) return "—";
  const t = new Date(v).getTime();
  if (isNaN(t)) return "—";
  const d = Date.now() - t;
  if (d < 0) return "به‌زودی";
  const s = Math.floor(d / 1000);
  if (s < 60) return "همین الان";
  if (s < 3600) return Math.floor(s / 60) + " دقیقه پیش";
  if (s < 86400) return Math.floor(s / 3600) + " ساعت پیش";
  if (s < 2592000) return Math.floor(s / 86400) + " روز پیش";
  return dt(v);
}
function short(s, len) { s = String(s || ""); return s.length > (len || 40) ? s.slice(0, len || 40) + "…" : s; }
function tail(s) { const p = String(s || "").split("/"); return p[p.length - 1]; }
function bar(label, val, max, displayVal) {
  val = Number(val) || 0;
  max = Number(max) || 100;
  const p = max > 0 ? Math.min(100, Math.max(0, Math.round((val / max) * 100))) : 0;
  const txt = displayVal !== undefined && displayVal !== null ? displayVal : val;
  return '<div class="bar-row" style="margin-bottom:8px;">' +
    '<div class="flex-between text-xs mb-1"><span style="color:var(--text2);font-weight:600;">' + h(label) + '</span><span class="mono font-bold" style="color:var(--text);">' + h(txt) + '</span></div>' +
    '<div style="height:6px;border-radius:99px;background:rgba(255,255,255,0.08);overflow:hidden;">' +
      '<div style="width:' + p + '%;height:100%;border-radius:99px;background:var(--grad);transition:width 0.3s ease;"></div>' +
    '</div>' +
  '</div>';
}
window.h = h; window.n = n; window.ms = ms; window.usd = usd; window.pct = pct; window.price = price;
window.dt = dt; window.rel = rel; window.short = short; window.bytes = bytes; window.tail = tail; window.bar = bar;

/* ═══════════ VECTOR SPARKLINE SVG ═══════════ */
function sparkSvg(arr, kind, width, height) {
  if (!arr || !arr.length) return "";
  width = width || 120; height = height || 32;
  const max = Math.max.apply(null, arr.concat([1]));
  const min = Math.min.apply(null, arr);
  const range = max - min || 1;
  const pts = arr.map(function(val, idx) {
    const x = (idx / (arr.length - 1 || 1)) * (width - 8) + 4;
    const y = height - 6 - ((val - min) / range) * (height - 12);
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const fillPts = "4," + (height - 2) + " " + pts + " " + (width - 4) + "," + (height - 2);
  const color = kind === "ok" ? "#10b981" : kind === "bad" ? "#f43f5e" : kind === "warn" ? "#f59e0b" : "#7c8cff";
  return '<svg class="sparkline ' + (kind || "acc") + '" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none">' +
    '<polygon points="' + fillPts + '" fill="' + color + '" fill-opacity="0.12" />' +
    '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />' +
    '</svg>';
}
window.sparkSvg = sparkSvg;

/* ═══════════ ADVANCED MARKDOWN PARSER ═══════════ */
function md(t) {
  let s = h(t || "");
  const CB = String.fromCharCode(96, 96, 96);
  const C1 = String.fromCharCode(96);
  // Code blocks
  s = s.split(CB).map(function (part, i) {
    if (i % 2 === 1) {
      const nl = part.indexOf("\n");
      const lang = nl >= 0 ? part.slice(0, nl).trim() : "";
      const code = nl >= 0 ? part.slice(nl + 1) : part;
      const codeId = "code_" + Math.random().toString(36).slice(2, 8);
      return '<div class="code-box"><div class="code-head"><span>' + (lang || "CODE") + '</span>' +
        '<button class="copy-btn" onclick="copyCode(this, \'' + codeId + '\')">کپی کد</button></div>' +
        '<pre class="code-body"><code id="' + codeId + '">' + code.replace(/\n$/, "") + '</code></pre></div>';
    }
    return part;
  }).join("");

  s = s.split(/<div class="code-box">[\s\S]*?<\/div>/).reduce(function (acc, chunk, idx) {
    // preserve code-boxes
    return acc;
  }, s);

  return inlineMd(s, C1);
}

function inlineMd(s, C1) {
  s = s.replace(new RegExp(C1 + "([^" + C1 + "\n]+)" + C1, "g"), "<code class=\"inline-code\">$1</code>");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/(^|\n)#{3}\s+(.+)/g, "$1<h4 class=\"md-h4\">$2</h4>");
  s = s.replace(/(^|\n)#{2}\s+(.+)/g, "$1<h3 class=\"md-h3\">$2</h3>");
  s = s.replace(/(^|\n)#{1}\s+(.+)/g, "$1<h2 class=\"md-h2\">$2</h2>");
  s = s.replace(/(^|\n)[-*]\s+(.+)/g, "$1<li class=\"md-li\">$2</li>");
  s = s.replace(/(^|\n)&gt;\s+(.+)/g, "$1<blockquote class=\"md-quote\">$2</blockquote>");
  s = s.replace(/\n{2,}/g, "</p><p>");
  s = s.replace(/\n/g, "<br>");
  return s;
}
window.md = md;

window.copyCode = function(btn, id) {
  haptic("impact", "light");
  const el = document.getElementById(id);
  if (!el) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(el.textContent).then(function() {
      btn.textContent = "✓ کپی شد";
      btn.style.background = "var(--ok)";
      setTimeout(function() { btn.textContent = "کپی کد"; btn.style.background = ""; }, 2000);
      toast("کد در کلیپ‌بورد کپی شد", "ok");
    });
  }
};

/* ═══════════ ATTR / ACTION ═══════════ */
function q(v) { return "'" + String(v === null || v === undefined ? "" : v).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'"; }
function act(fn) {
  const args = [];
  for (let i = 1; i < arguments.length; i++) args.push(q(arguments[i]));
  return ' onclick="haptic(\'selection\');event.stopPropagation();' + fn + "(" + args.join(",") + ')"';
}
window.act = act; window.qs = q;

/* ═══════════ VIEWPORT ═══════════ */
function vw() { return window.innerWidth || 360; }
function isNarrow() { return vw() < 700; }
function isWide() { return vw() >= 1001; }
window.vw = vw; window.isNarrow = isNarrow; window.isWide = isWide;

/* ═══════════ COMPONENTS ═══════════ */
function icon(x) { return '<i class="ic">' + x + "</i>"; }

function bdg(text, kind, withDot) {
  const dotHtml = withDot ? '<span class="pulse-dot ' + (kind === "ok" ? "ok" : kind === "bad" ? "bad" : kind === "warn" ? "warn" : "") + '"></span>' : '';
  return '<span class="badge badge-' + (kind || "acc") + '">' + dotHtml + h(text) + "</span>";
}
function statusBdg(st) {
  const k = st === "healthy" || st === "active" || st === "done" || st === "completed" || st === "delivered" || st === "approved" ? "ok"
    : st === "failed" || st === "invalid" || st === "rejected" || st === "fail" ? "bad"
      : st === "degraded" || st === "rate_limited" || st === "pending" || st === "running" ? "warn" : "info";
  return bdg(st || "unknown", k, true);
}
window.bdg = bdg; window.statusBdg = statusBdg;

function stat(o) {
  return '<div class="stat-box ' + (o.kind || "") + '">' +
    '<div class="lbl"><span>' + h(o.label) + '</span>' + (o.icon ? '<i>' + o.icon + '</i>' : '') + '</div>' +
    '<div class="val">' + (o.value === undefined ? "—" : o.value) + '</div>' +
    (o.spark ? sparkSvg(o.spark, o.sparkKind || "acc", 120, 28) : "") +
    (o.sub ? '<div class="trend ' + (o.trend || "") + '">' + o.sub + '</div>' : "") +
    '</div>';
}
window.stat = stat;

function card(o) {
  const head = o.title !== undefined ? '<div class="card-h">' +
    '<div><div class="card-t">' + (o.icon ? '<i>' + o.icon + '</i>' : '') + h(o.title) + '</div>' +
    (o.sub ? '<div class="card-sub">' + h(o.sub) + '</div>' : '') + '</div>' +
    (o.actions || "") + '</div>' : "";
  const body = o.body === undefined ? "" : '<div class="card-b">' + o.body + '</div>';
  const raw = o.raw || "";
  const foot = o.foot ? '<div class="card-f mt-3">' + o.foot + '</div>' : "";
  return '<div class="card ' + (o.cls || "") + '"><div class="card-glow"></div>' + head + body + raw + foot + '</div>';
}
window.card = card;

function kv(k, v, opts) {
  opts = opts || {};
  return '<div class="flex-between py-2 border-b ' + (opts.onclick ? "cursor-pointer" : "") + '" ' + (opts.onclick || "") + '>' +
    '<span class="text-muted text-xs">' + h(k) + '</span><div class="font-mono text-sm ' + (opts.cls || "") + '">' + v + '</div></div>';
}
window.kv = kv;

function li(o) {
  return '<div class="li' + (o.onclick ? " clk" : "") + '" ' + (o.onclick || "") + '>' +
    (o.icon ? '<div class="li-i">' + o.icon + '</div>' : '') +
    '<div class="sp"><div class="li-t">' + o.title + '</div>' +
    (o.sub ? '<div class="li-s">' + o.sub + '</div>' : '') + '</div>' +
    (o.end ? '<div class="li-e">' + o.end + '</div>' : '') +
    (o.actions ? '<div class="li-a">' + o.actions + '</div>' : '') +
    (o.chev ? '<span class="chev">‹</span>' : '') + '</div>';
}
function lst(items, emptyOpts) {
  if (!items || !items.length) return empty(emptyOpts || {});
  return '<div class="lst">' + items.join("") + '</div>';
}
window.li = li; window.lst = lst;

function tbl(cols, rows, emptyOpts) {
  if (!rows || !rows.length) return empty(emptyOpts || {});
  return '<div class="tblw"><table class="tbl"><thead><tr>' +
    cols.map(function (c) { return '<th style="text-align:' + (c.align || "start") + '">' + h(c.t) + '</th>'; }).join("") +
    '</tr></thead><tbody>' + rows.join("") + '</tbody></table></div>';
}
function tr(cells, opts) {
  opts = opts || {};
  return '<tr ' + (opts.onclick ? opts.onclick : "") + '>' +
    cells.map(function (c) {
      return typeof c === "string" ? '<td>' + c + '</td>' : '<td style="text-align:' + (c.align || "start") + '">' + c.v + '</td>';
    }).join("") + '</tr>';
}
window.tbl = tbl; window.tr = tr;

function dataView(o) {
  if (!o.rows || !o.rows.length) return empty(o.empty || {});
  if (isNarrow() && o.li) return '<div class="lst">' + o.rows.map(o.li).join("") + '</div>';
  return tbl(o.cols, o.rows.map(o.tr), o.empty || {});
}
window.dataView = dataView;

function empty(o) {
  o = o || {};
  return '<div class="empty">' +
    '<div class="ei">' + (o.icon || "◈") + '</div>' +
    '<div class="et">' + h(o.title || "چیزی برای نمایش وجود ندارد") + '</div>' +
    (o.sub ? '<div class="es">' + h(o.sub) + '</div>' : '') +
    (o.btn ? '<button class="btn pri sm"' + o.btn.on + '>' + h(o.btn.t) + '</button>' : '') + '</div>';
}
function loading(t) {
  return '<div class="loading-box"><div class="spin"></div><span>' + h(t || "در حال آماده‌سازی اطلاعات…") + '</span></div>' + skel(3);
}
function skel(rows) {
  let s = "";
  for (let i = 0; i < (rows || 3); i++) {
    s += '<div class="card" style="padding:14px;margin-bottom:10px">' +
      '<div class="skeleton" style="height:18px;width:' + (35 + i * 15) + '%;margin-bottom:10px"></div>' +
      '<div class="skeleton" style="height:12px;width:75%"></div></div>';
  }
  return s;
}
function errBox(e) {
  const isAuth = (e && (e.status === 401 || (e.message && e.message.includes("احراز هویت"))));
  if (isAuth) {
    return '<div class="card" style="border-color:var(--acc-line);background:rgba(99,102,241,0.08);text-align:center;padding:24px 16px">' +
      '<div style="font-size:36px;margin-bottom:12px">🔐</div>' +
      '<div class="card-t" style="color:var(--text);font-size:16px">احراز هویت تلگرام</div>' +
      '<div style="font-size:13px;margin:8px auto;color:var(--text2);max-width:320px;line-height:1.6">' +
      (e.hint || 'برای استفاده از پلتفرم، مینی‌اپ را از داخل تلگرام باز کنید.') + '</div>' +
      '<div class="row wrap" style="justify-content:center;gap:10px;margin-top:16px">' +
      '<button class="btn pri" onclick="hardRefresh()">↻ تلاش دوباره</button>' +
      '</div></div>';
  }
  return '<div class="card" style="border-color:var(--bad-soft);background:rgba(244,63,94,0.06)">' +
    '<div class="card-t" style="color:var(--bad)">⚠ خطا در دریافت اطلاعات</div>' +
    '<div style="font-size:13px;margin:8px 0;color:var(--text)">' + h(e.message || e) + '</div>' +
    (e.hint ? '<div class="text-xs text-muted mb-2">' + h(e.hint) + '</div>' : '') +
    '<button class="btn gho sm" onclick="render()">تلاش دوباره</button></div>';
}
function note(text, kind, ic) {
  const bg = kind === "warn" ? "var(--warn-soft)" : kind === "bad" ? "var(--bad-soft)" : "var(--acc-soft)";
  const clr = kind === "warn" ? "var(--warn)" : kind === "bad" ? "var(--bad)" : "var(--acc)";
  return '<div class="card p-3 mb-3" style="background:' + bg + ';border-color:' + clr + ';display:flex;gap:10px;align-items:flex-start">' +
    '<i style="font-style:normal;font-size:16px;color:' + clr + '">' + (ic || "ⓘ") + '</i>' +
    '<div style="font-size:13px;color:var(--text)">' + text + '</div></div>';
}
window.empty = empty; window.loading = loading; window.skel = skel; window.errBox = errBox; window.note = note;

function codeBox(text, id) {
  return '<div class="code-box"><div class="code-head"><span>OUTPUT</span><button class="copy-btn"' + act("copyEl", id || "") + '>کپی</button></div>' +
    '<div class="code-body"' + (id ? ' id="' + id + '"' : "") + '>' + h(text) + '</div></div>';
}
window.copyEl = function (id) {
  haptic("impact", "light");
  const el = id ? document.getElementById(id) : null;
  const t = el ? el.textContent : "";
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("در کلیپ‌بورد کپی شد", "ok"); });
};
window.codeBox = codeBox;

function tabsBar(key, items) {
  const cur = S.tab[key] || items[0][0];
  return '<div style="display:flex;gap:6px;background:rgba(255,255,255,0.03);padding:4px;border-radius:var(--r2);margin-bottom:14px;overflow-x:auto">' +
    items.map(function (it) {
      const active = cur === it[0];
      return '<button class="btn btn-sm ' + (active ? "btn-primary" : "btn-secondary") + '"' + act("setTab", key, it[0]) + '>' +
        h(it[1]) + (it[2] !== undefined && it[2] !== null ? ' <span class="badge">' + n(it[2]) + '</span>' : '') + '</button>';
    }).join("") + '</div>';
}
window.setTab = function (key, val) { haptic("selection"); S.tab[key] = val; render(); };
window.curTab = function (key, def) { return S.tab[key] || def; };
window.tabsBar = tabsBar;

/* ═══════════ TOAST ═══════════ */
function toast(msg, kind) {
  haptic("notification", kind === "err" || kind === "bad" ? "error" : "success");
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    box.style.cssText = "position:fixed;top:calc(var(--safet) + 16px);inset-inline:16px;z-index:999;display:flex;flex-direction:column;gap:8px;pointer-events:none";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = "card";
  el.style.cssText = "padding:10px 16px;box-shadow:var(--sh2);display:flex;align-items:center;gap:10px;pointer-events:auto;animation:msgIn 0.3s ease";
  const icon = kind === "ok" ? "✓" : kind === "bad" || kind === "err" ? "✕" : "ⓘ";
  const badgeCls = kind === "ok" ? "badge-ok" : kind === "bad" || kind === "err" ? "badge-bad" : "badge-info";
  el.innerHTML = '<span class="badge ' + badgeCls + '">' + icon + '</span><span style="font-size:13px;font-weight:650">' + h(msg) + '</span>';
  box.appendChild(el);
  setTimeout(function () {
    el.style.opacity = "0"; el.style.transform = "translateY(-10px)"; el.style.transition = "all 0.25s ease";
    setTimeout(function () { el.remove(); }, 250);
  }, kind === "err" || kind === "bad" ? 4500 : 2500);
}
window.toast = toast;

/* ═══════════ MODALS & SHEETS ═══════════ */
let SHEET = null;
function sheet(o) {
  closeSheet();
  haptic("impact", "medium");
  SHEET = o;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay open";
  overlay.id = "sheetOverlay";
  overlay.onclick = function (e) { if (e.target === overlay && !o.sticky) closeSheet(); };

  const s = document.createElement("div");
  s.className = "modal-sheet " + (o.cls || "");
  s.id = "sheet";
  s.innerHTML = '<div class="sheet-handle"></div>' +
    '<div class="flex-between mb-3"><div class="card-t">' + h(o.title) + '</div><button class="btn-icon" onclick="closeSheet()">✕</button></div>' +
    '<div id="sheetB" class="sheet-b">' + (o.body || "") + '</div>' +
    (o.foot === null ? "" : '<div class="mt-4 flex-between gap-2 sheet-f" id="sheetF">' +
      (o.foot !== undefined ? o.foot :
        '<button class="btn btn-secondary flex-1" onclick="closeSheet()">' + h(o.cancelText || "انصراف") + '</button>' +
        (o.okText ? '<button class="btn btn-primary flex-1" id="sheetOk">' + h(o.okText) + '</button>' : '')) + '</div>');

  overlay.appendChild(s);
  document.body.appendChild(overlay);

  const ok = document.getElementById("sheetOk");
  if (ok && o.onOk) {
    ok.onclick = async function () {
      haptic("impact", "heavy");
      ok.disabled = true;
      const prev = ok.innerHTML;
      ok.innerHTML = "در حال پردازش…";
      try { await o.onOk(); }
      catch (e) { toast(e.message || String(e), "err"); ok.disabled = false; ok.innerHTML = prev; return; }
      ok.disabled = false; ok.innerHTML = prev;
    };
  }
  if (o.after) setTimeout(o.after, 50);
}
function closeSheet() {
  haptic("selection");
  const a = document.getElementById("sheetOverlay");
  if (a) a.remove();
  SHEET = null;
}
window.closeSheet = closeSheet;

function sheetBody(html) {
  const b = document.getElementById("sheetB") || document.querySelector(".modal-sheet .sheet-b") || document.querySelector("#sheetB");
  if (b) b.innerHTML = html;
}
window.sheetBody = sheetBody;

function sheetFoot(html) {
  const f = document.getElementById("sheetF") || document.querySelector(".modal-sheet .sheet-f") || document.querySelector("#sheetF");
  if (f) f.innerHTML = html;
}
window.sheetFoot = sheetFoot;
window.pwFoot = sheetFoot;
window.sheet = sheet; window.closeSheet = closeSheet;

function confirmSheet(title, body, onYes, opts) {
  opts = opts || {};
  sheet({
    title: title,
    body: note(h(body), opts.kind || "warn"),
    foot: '<button class="btn btn-secondary flex-1" onclick="closeSheet()">لغو</button>' +
      '<button class="btn ' + (opts.danger === false ? "btn-primary" : "btn-danger") + ' flex-1" id="sheetOk">' + h(opts.okText || "تأیید و اجرا") + '</button>',
    onOk: async function () { closeSheet(); await onYes(); }
  });
}
window.confirmSheet = confirmSheet;

/* ═══════════ FORM SYSTEM ═══════════ */
function setSegVal(id, val, btn) {
  const inp = document.getElementById(id);
  if (inp) inp.value = val;
  if (btn && btn.parentNode) {
    btn.parentNode.querySelectorAll("button").forEach(function (b) { b.classList.remove("on"); });
    btn.classList.add("on");
  }
}
window.setSegVal = setSegVal;

function fieldHtml(f, ns) {
  const id = ns + "_" + f.k;
  const lab = f.l === null ? "" : '<label class="input-label" for="' + id + '">' + h(f.l || f.k) + (f.req ? ' <span style="color:var(--bad)">*</span>' : "") + '</label>';
  let inp = "";
  const v = f.v === undefined || f.v === null ? "" : f.v;
  if (f.t === "area" || f.t === "code") {
    inp = '<textarea id="' + id + '" class="textarea font-mono" rows="' + (f.rows || 4) + '" placeholder="' + h(f.ph || "") + '">' + h(v) + '</textarea>';
  } else if (f.t === "select") {
    inp = '<select id="' + id + '" class="select">' + (f.opts || []).map(function (o) {
      const ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o;
      return '<option value="' + h(ov) + '"' + (String(ov) === String(v) ? " selected" : "") + '>' + h(ol) + '</option>';
    }).join("") + '</select>';
  } else if (f.t === "seg") {
    inp = '<div class="seg" id="' + id + '_box">' +
      '<input type="hidden" id="' + id + '" value="' + h(v) + '">' +
      (f.opts || []).map(function (o) {
        const ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o;
        const on = String(ov) === String(v) ? " on" : "";
        return '<button type="button" class="seg-btn' + on + '" onclick="setSegVal(\'' + id + '\',\'' + h(ov) + '\',this)">' + h(ol) + '</button>';
      }).join("") + '</div>';
  } else if (f.t === "switch") {
    return '<div class="input-group flex-between"><div><div class="font-bold text-sm">' + h(f.l) + '</div>' +
      (f.hint ? '<div class="text-xs text-muted">' + h(f.hint) + '</div>' : '') + '</div>' +
      '<input type="checkbox" id="' + id + '"' + (v ? " checked" : "") + ' style="width:20px;height:20px;accent-color:var(--acc)"></div>';
  } else {
    const type = f.t === "num" ? "number" : f.t === "pass" ? "password" : f.t === "url" ? "url" : "text";
    inp = '<input type="' + type + '" id="' + id + '" class="input" value="' + h(v) + '" placeholder="' + h(f.ph || "") + '">';
  }
  return '<div class="input-group">' + lab + inp + (f.hint ? '<div class="text-xs text-muted mt-1">' + h(f.hint) + '</div>' : '') + '</div>';
}

function formHtml(fields, ns, cls) {
  let html = '<div class="' + (cls || "") + '">';
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.t === "hr") { html += '<hr style="border:0;border-top:1px solid var(--line);margin:14px 0">'; continue; }
    if (f.t === "note") { html += note(f.v, f.kind); continue; }
    if (f.t === "rowStart") { html += '<div class="inline-f">'; continue; }
    if (f.t === "rowEnd") { html += '</div>'; continue; }
    html += fieldHtml(f, ns);
  }
  html += '</div>';
  return html;
}

function formRead(fields, ns) {
  const out = {};
  fields.forEach(function (f) {
    if (!f.k || f.t === "note" || f.t === "hr" || f.t === "rowStart" || f.t === "rowEnd") return;
    const el = document.getElementById(ns + "_" + f.k);
    if (!el) return;
    if (f.t === "switch") out[f.k] = !!el.checked;
    else if (f.t === "num") { const x = el.value.trim(); out[f.k] = x === "" ? null : Number(x); }
    else out[f.k] = el.value;
    if (f.req && (out[f.k] === "" || out[f.k] === null || out[f.k] === undefined)) throw new Error((f.l || f.k) + " الزامی است");
  });
  return out;
}
window.formHtml = formHtml; window.formRead = formRead;

function editSheet(o) {
  const ns = "f" + Math.random().toString(36).slice(2, 7);
  sheet({
    title: o.title, sub: o.sub, cls: o.cls,
    body: (o.top || "") + formHtml(o.fields, ns) + (o.bottom || ""),
    okText: o.okText || "ذخیره تغییرات",
    cancelText: "انصراف",
    onOk: async function () {
      const vals = formRead(o.fields, ns);
      await o.onSave(vals);
    }
  });
}
window.editSheet = editSheet;

async function doAct(fn, okMsg, opts) {
  opts = opts || {};
  try {
    const r = await fn();
    if (okMsg) toast(okMsg, "ok");
    if (opts.bust !== false) bust(opts.bust);
    if (opts.close !== false) closeSheet();
    if (opts.go) go(opts.go, opts.goParams);
    else if (opts.render !== false) render();
    return r;
  } catch (e) { toast(e.message || String(e), "err"); throw e; }
}
window.doAct = doAct;

window.delEntity = function (label, path, opts) {
  if (typeof opts === "string") opts = { go: opts, bust: true };
  opts = opts || {};
  if (!opts.go) {
    if (path.indexOf("/providers") >= 0) opts.go = "providers";
    else if (path.indexOf("/models") >= 0) opts.go = "models";
    else if (path.indexOf("/agents") >= 0) opts.go = "agents";
    else if (path.indexOf("/tasks") >= 0 || path.indexOf("/automation") >= 0) opts.go = "automation";
    else if (path.indexOf("/prompts") >= 0) opts.go = "prompts";
    else if (path.indexOf("/projects") >= 0) opts.go = "projects";
  }
  confirmSheet("حذف " + label + "؟", opts.warn || "این عملیات غیرقابل بازگشت است.", async function () {
    await doAct(function () { return api(path, { method: "DELETE" }); }, "با موفقیت حذف شد", { ...opts, bust: true, close: true });
  });
};
`;
