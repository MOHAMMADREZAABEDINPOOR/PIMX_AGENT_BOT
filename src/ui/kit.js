// ─────────────────────────────────────────────
// 🧩 PIMXAGENT UI Kit — JavaScript components (Mini App)
// این فایل بعد از تمام فایلهای دیگر تزریق میشود و داخل یک IIFE اجرا میشود؛
// بنابراین میتواند نسخهٔ ارتقایافتهٔ پریمیتیوهای قدیمی را جایگزین کند
// (همان نامها و همان امضاها) تا همهٔ Viewها بدون تغییر ارتقا پیدا کنند.
// ══ بخش ۱: Header / Card / KPI / Badge / List ══
// ─────────────────────────────────────────────
export const UI_KIT = String.raw`
(function () {
  "use strict";
  var W = window;
  function S_(v) { return v === null || v === undefined ? "" : String(v); }

  /* ═══════════ PAGE HEADER ═══════════ */
  function pageHead(o) {
    o = o || {};
    var left = (o.back ? pxText('<button class="btn-icon" onclick="history.back()" aria-label="بازگشت">‹</button>') : "") +
      (o.title ? '<div class="ph-t"><h2>' + (o.rawTitle ? o.title : h(o.title)) + '</h2>' +
        (o.sub ? '<p>' + h(o.sub) + '</p>' : "") + "</div>" : "");
    var acts = o.actions ? '<div class="ph-a">' + o.actions + "</div>" : "";
    return '<div class="ph row wrap">' + left + acts + "</div>";
  }
  W.pageHead = pageHead;

  function sectionHead(o) {
    o = o || {};
    return '<div class="px-sec">' +
      (o.icon ? '<div class="px-sec-i" aria-hidden="true">' + o.icon + "</div>" : "") +
      '<div class="px-sec-t"><b>' + h(o.title) + "</b>" + (o.sub ? "<span>" + h(o.sub) + "</span>" : "") + "</div>" +
      (o.count !== undefined && o.count !== null ? '<span class="px-sec-x">' + h(String(o.count)) + "</span>" : "") +
      (o.actions ? '<div class="px-sec-a">' + o.actions + "</div>" : "") +
      "</div>";
  }
  W.sectionHead = sectionHead;

  /* ═══════════ CARD ═══════════ */
  function card(o) {
    o = o || {};
    var head = o.title !== undefined ? '<div class="card-h"><div>' +
      '<div class="card-t">' + (o.icon ? "<i>" + o.icon + "</i>" : "") + (o.rawTitle ? o.title : h(o.title)) + "</div>" +
      (o.sub ? '<div class="card-sub">' + h(o.sub) + "</div>" : "") + "</div>" +
      (o.actions || "") + "</div>" : "";
    var body = o.body === undefined ? "" : '<div class="card-b">' + o.body + "</div>";
    var foot = o.foot ? '<div class="card-f">' + o.foot + "</div>" : "";
    var cls = "card" + (o.cls ? " " + o.cls : "") + (o.flat ? " flat" : "") + (o.tone ? " tone-" + o.tone : "");
    return '<div class="' + cls + ' px-in">' + head + body + (o.raw || "") + foot + "</div>";
  }
  W.card = card;

  /* ═══════════ STAT / KPI ═══════════ */
  function stat(o) {
    o = o || {};
    var meter = (o.meter !== undefined && o.meter !== null)
      ? '<div class="px-meter ' + (o.meterKind || "") + '"><i style="width:' + Math.max(0, Math.min(100, Math.round(Number(o.meter) || 0))) + '%"></i></div>' : "";
    var spark = o.spark && o.spark.length ? '<div class="spark">' + sparkSvg(o.spark, o.sparkKind || "acc", 200, 26) + "</div>" : "";
    return '<div class="stat-box ' + (o.kind || "") + (o.onclick ? " on" : "") + '"' + (o.onclick || "") + ">" +
      '<div class="lbl"><span>' + h(o.label) + "</span>" + (o.icon ? "<i>" + o.icon + "</i>" : "") + "</div>" +
      '<div class="val">' + (o.value === undefined ? "—" : o.value) + "</div>" +
      meter + spark +
      (o.sub ? '<div class="trend ' + (o.trend || "") + '">' + o.sub + "</div>" : "") +
      "</div>";
  }
  W.stat = stat;

  function metric(label, value, unit) {
    return '<div class="px-metric"><span>' + h(label) + "</span><b>" + (value === undefined ? "—" : value) + "</b>" +
      (unit ? "<span>" + h(unit) + "</span>" : "") + "</div>";
  }
  W.metric = metric;

  /* ═══════════ BADGES ═══════════ */
  var TONE_OF = (W.STATUS_TONE || {});
  function toneFor(st) {
    var k = S_(st).toLowerCase().replace(/\s+/g, "_");
    return TONE_OF[k] || "mut";
  }
  function bdg(text, kind, dot) {
    var k = kind || "mut";
    return '<span class="bdg ' + k + '">' + (dot ? '<span class="dot ' + (k === "bad" ? "err" : k) + '"></span>' : "") + h(text) + "</span>";
  }
  function statusBdg(st) { return bdg(st || "unknown", toneFor(st), true); }
  function modelBdg(name) { return '<span class="bdg model">' + h(short(name || "—", 34)) + "</span>"; }
  function provBdg(name) { return '<span class="bdg prov">' + h(short(name || "—", 22)) + "</span>"; }
  function capBdg(text, icon) { return '<span class="bdg cap">' + (icon ? icon + " " : "") + h(text) + "</span>"; }
  W.bdg = bdg; W.statusBdg = statusBdg;
  W.modelBdg = modelBdg; W.provBdg = provBdg; W.capBdg = capBdg;

  /* ═══════════ LIST / ROW ═══════════ */
  function li(o) {
    o = o || {};
    var badges = o.badges ? " " + o.badges : "";
    var meta = o.meta ? '<div class="li-s">' + o.meta + "</div>" : "";
    return '<div class="li' + (o.onclick ? " clk" : "") + (o.tone ? " tone-" + o.tone : "") + (o.cls ? " " + o.cls : "") + '"' + (o.onclick || "") + ">" +
      (o.icon ? '<div class="li-i" aria-hidden="true">' + o.icon + "</div>" : "") +
      '<div class="sp"><div class="li-t">' + o.title + badges + "</div>" +
      (o.sub ? '<div class="li-s">' + o.sub + "</div>" : "") + meta + "</div>" +
      (o.end ? '<div class="li-e">' + o.end + "</div>" : "") +
      (o.actions ? '<div class="li-a">' + o.actions + "</div>" : "") +
      (o.chev ? '<span class="chev" aria-hidden="true">‹</span>' : "") + "</div>";
  }
  function lst(items, emptyOpts) {
    if (!items || !items.length) return empty(emptyOpts || {});
    return '<div class="lst">' + items.join("") + "</div>";
  }
  W.li = li; W.lst = lst;

  function rowsBlock(rows) {
    if (!rows || !rows.length) return "";
    return '<div class="px-rows">' + rows.join("") + "</div>";
  }
  function dataRow(k, v, opts) {
    opts = opts || {};
    return '<div class="px-row' + (opts.onclick ? " clk" : "") + '"' + (opts.onclick || "") + ">" +
      '<span class="px-row-k">' + h(k) + "</span>" +
      '<span class="px-row-v ' + (opts.cls || "") + '">' + v + "</span></div>";
  }
  W.rowsBlock = rowsBlock; W.dataRow = dataRow;

  /* ═══════════ PROGRESS ═══════════ */
  function bar(label, val, max, displayVal) {
    val = Number(val) || 0; max = Number(max) || 100;
    var p = max > 0 ? Math.min(100, Math.max(0, Math.round((val / max) * 100))) : 0;
    var txt = displayVal !== undefined && displayVal !== null ? displayVal : val;
    var kind = p >= 70 ? "ok" : p >= 35 ? "warn" : "bad";
    return '<div class="px-bar-row">' +
      '<div class="px-bar-lbl"><span>' + h(label) + "</span><b>" + h(txt) + "</b></div>" +
      '<div class="px-meter ' + kind + '"><i style="width:' + p + '%"></i></div></div>';
  }
  function progressBar(val, max, tone) {
    var p = Math.max(0, Math.min(100, Math.round((Number(val) || 0) / (Number(max) || 100) * 100)));
    return '<div class="px-meter ' + (tone || "") + '"><i style="width:' + p + '%"></i></div>';
  }
  function ring(val, size, label) {
    var pctv = Math.max(0, Math.min(100, Number(val) || 0));
    var sz = size || 56, r = (sz / 2) - 4, c = 2 * Math.PI * r;
    var off = c - (pctv / 100) * c;
    var tone = pctv >= 70 ? "var(--px-ok)" : pctv >= 35 ? "var(--px-warn)" : "var(--px-bad)";
    return '<div class="px-ring" style="width:' + sz + "px;height:" + sz + 'px">' +
      '<svg width="' + sz + '" height="' + sz + '" role="img" aria-label="' + pctv + pxText(' درصد">') +
      '<circle class="trk" cx="' + sz / 2 + '" cy="' + sz / 2 + '" r="' + r + '"></circle>' +
      '<circle class="val" cx="' + sz / 2 + '" cy="' + sz / 2 + '" r="' + r + '" style="stroke:' + tone + ";stroke-dasharray:" + c.toFixed(1) + ";stroke-dashoffset:" + off.toFixed(1) + '"></circle>' +
      "</svg>" + '<span class="px-ring-t">' + (label !== undefined ? h(label) : Math.round(pctv) + "%") + "</span></div>";
  }
  W.bar = bar; W.progressBar = progressBar; W.ring = ring;

  /* ═══════════ STATES ═══════════ */
  function pxState(o) {
    o = o || {};
    var acts = o.actions && o.actions.length
      ? '<div class="px-state-a">' + o.actions.map(function (a) {
          return '<button class="btn ' + (a.kind || "sec") + (a.sm === false ? "" : " sm") + '" ' + (a.on || "") + ">" + h(a.t) + "</button>";
        }).join("") + "</div>" : "";
    return '<div class="px-state' + (o.tone ? " " + o.tone : "") + '">' +
      '<div class="px-state-i" aria-hidden="true">' + (o.icon || "◈") + "</div>" +
      '<div class="px-state-t">' + h(o.title || pxText("چیزی برای نمایش نیست")) + "</div>" +
      (o.sub ? '<div class="px-state-s">' + h(o.sub) + "</div>" : "") + acts + "</div>";
  }
  function empty(o) {
    o = o || {};
    var actions = [];
    if (o.btn) actions.push({ t: o.btn.t, on: o.btn.on, kind: "pri" });
    if (o.btns) actions = actions.concat(o.btns);
    return pxState({ icon: o.icon || "◈", title: o.title || pxText("چیزی برای نمایش وجود ندارد"), sub: o.sub || "", tone: o.tone || "", actions: actions });
  }
  function skel(rows) {
    var out = "";
    for (var i = 0; i < (rows || 3); i++) {
      out += '<div class="px-skel-card">' +
        '<div class="skeleton" style="height:14px;width:' + (34 + i * 13) + '%;margin-bottom:10px"></div>' +
        '<div class="skeleton" style="height:10px;width:72%;margin-bottom:7px"></div>' +
        '<div class="skeleton" style="height:10px;width:52%"></div></div>';
    }
    return out;
  }
  function loading(t) {
    return '<div class="loading-box"><div class="spin" role="status" aria-live="polite"></div>' +
      "<span>" + h(t || pxText("در حال آمادهسازی اطلاعات…")) + "</span></div>" + skel(3);
  }
  function errBox(e) {
    var msg = S_((e && e.message) || e);
    var status = e && e.status ? e.status : 0;
    var isAuth = status === 401 || /احراز هویت|initData|توکن/.test(msg);
    if (isAuth) {
      return pxState({
        icon: "🔐", tone: "warn", title: pxText("احراز هویت تلگرام"),
        sub: (e && e.hint) || pxText("برای استفاده از پلتفرم، مینی\u200cاپ را از داخل تلگرام باز کنید."),
        actions: [{ t: pxText("↻ تلاش دوباره"), kind: "pri", on: act("hardRefresh") }, { t: pxText("🏠 داشبورد"), on: act("go", "home") }]
      });
    }
    var isNet = /timeout|طولانی شد|Failed to fetch|network/i.test(msg);
    return pxState({
      icon: isNet ? "⏱" : "⚠", tone: isNet ? "warn" : "bad",
      title: isNet ? pxText("پاسخ سرور با تأخیر بود") : pxText("خطا در دریافت اطلاعات"),
      sub: msg + (status ? pxText(" (کد ") + status + ")" : ""),
      actions: [
        { t: pxText("↻ تلاش دوباره"), kind: "pri", on: act("hardRefresh") },
        { t: pxText("🏠 داشبورد"), on: act("go", "home") }
      ]
    });
  }
  function note(text, kind, ic) {
    var tone = kind === "warn" ? "warn" : (kind === "bad" || kind === "err") ? "bad" : (kind === "ok" ? "ok" : "acc");
    var icon = ic || (tone === "warn" ? "⚠" : tone === "bad" ? "✕" : tone === "ok" ? "✓" : "ⓘ");
    return '<div class="px-alert ' + tone + '"><i aria-hidden="true">' + icon + "</i><div>" + text + "</div></div>";
  }
  function alertBox(o) {
    o = o || {};
    var tone = o.tone || "acc";
    var icon = o.icon || (tone === "warn" ? "⚠" : tone === "bad" ? "✕" : tone === "ok" ? "✓" : "ⓘ");
    var acts = o.actions && o.actions.length
      ? '<div class="px-alert-a">' + o.actions.map(function (a) {
          return '<button class="btn ' + (a.kind || "sec") + ' sm" ' + (a.on || "") + ">" + h(a.t) + "</button>";
        }).join("") + "</div>" : "";
    return '<div class="px-alert ' + tone + '"><i aria-hidden="true">' + icon + "</i><div>" +
      (o.title ? "<b>" + h(o.title) + "</b>" : "") + (o.body || h(o.text || "")) + acts + "</div></div>";
  }
  W.empty = empty; W.pxState = pxState; W.loading = loading; W.skel = skel;
  W.errBox = errBox; W.note = note; W.alertBox = alertBox;

  /* ═══════════ TOAST ═══════════ */
  function toastHost() {
    var box = document.getElementById("toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      box.className = "toasts";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      box.style.cssText = "position:fixed;top:calc(var(--safet) + 12px);inset-inline:16px;z-index:999;display:flex;flex-direction:column;gap:8px;pointer-events:none";
      document.body.appendChild(box);
    }
    return box;
  }
  function toast(msg, kind) {
    var tone = kind === "ok" ? "ok" : (kind === "err" || kind === "bad") ? "err" : (kind === "warn" ? "warn" : "info");
    try { haptic("notification", tone === "err" ? "error" : tone === "warn" ? "warning" : "success"); } catch (e) {}
    var box = toastHost();
    var el = document.createElement("div");
    el.className = "tst " + tone;
    var icon = tone === "ok" ? "✓" : tone === "err" ? "✕" : tone === "warn" ? "⚠" : "ⓘ";
    el.innerHTML = "<i aria-hidden='true'>" + icon + "</i><span class='toast-copy'>" + h(msg) + "</span><button type='button' class='toast-close' aria-label='" + h(pxText('بستن')) + "' title='" + h(pxText('بستن')) + "'>×</button>";
    box.appendChild(el);
    var life = tone === "err" ? 4600 : 2600;
    var timer = setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 260);
    }, life);
    el.querySelector('.toast-close').onclick = function () { clearTimeout(timer); el.remove(); };
    return el;
  }
  W.toast = toast; W.toastHost = toastHost;

  /* ═══════════ SHEET / MODAL ═══════════ */
  var SHEET = null;
  function sheet(o) {
    o = o || {};
    closeSheet();
    try { haptic("impact", "medium"); } catch (e) {}
    SHEET = o;
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "sheetOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    if (o.title) overlay.setAttribute("aria-label", S_(o.title));
    overlay.onclick = function (e) { if (e.target === overlay && !o.sticky) closeSheet(); };

    var s = document.createElement("div");
    s.className = "modal-sheet " + (o.cls || "");
    s.id = "sheet";
    s.innerHTML = '<div class="sheet-handle" aria-hidden="true"></div>' +
      '<div class="flex-between mb-3"><div class="card-t">' + h(o.title || "") + "</div>" +
      pxText('<button class="btn-icon" onclick="closeSheet()" aria-label="بستن">✕</button></div>') +
      (o.sub ? '<div class="card-sub mb-3">' + h(o.sub) + "</div>" : "") +
      '<div id="sheetB" class="sheet-b">' + (o.body || "") + "</div>" +
      (o.foot === null ? "" : '<div class="mt-4 flex-between gap-2 sheet-f" id="sheetF">' +
        (o.foot !== undefined ? o.foot :
          '<button class="btn sec flex-1" onclick="closeSheet()">' + h(o.cancelText || pxText("انصراف")) + "</button>" +
          (o.okText ? '<button class="btn pri flex-1" id="sheetOk">' + h(o.okText) + "</button>" : "")) + "</div>");

    overlay.appendChild(s);
    document.body.appendChild(overlay);
    try { document.body.style.overflow = "hidden"; } catch (e) {}

    var ok = document.getElementById("sheetOk");
    if (ok && o.onOk) {
      ok.onclick = async function () {
        try { haptic("impact", "heavy"); } catch (e) {}
        ok.disabled = true;
        var prev = ok.innerHTML;
        ok.innerHTML = '<span class="px-dots"><i></i><i></i><i></i></span>';
        try { await o.onOk(); }
        catch (e) { toast(e.message || String(e), "err"); ok.disabled = false; ok.innerHTML = prev; return; }
        ok.disabled = false; ok.innerHTML = prev;
      };
    }
    if (o.after) setTimeout(o.after, 50);
    var body = document.getElementById("sheetB");
    if (body && o.focus !== false) {
      var f = body.querySelector("input,textarea,select");
      if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 80);
    }
  }
  function closeSheet() {
    var a = document.getElementById("sheetOverlay");
    if (a) a.remove();
    try { document.body.style.overflow = ""; } catch (e) {}
    SHEET = null;
  }
  function sheetBody(html) { var b = document.getElementById("sheetB"); if (b) b.innerHTML = html; }
  function sheetFoot(html) { var f = document.getElementById("sheetF"); if (f) f.innerHTML = html; }
  function confirmSheet(title, body, onYes, opts) {
    opts = opts || {};
    sheet({
      title: title,
      body: note(h(body), opts.kind || "warn"),
      foot: '<button class="btn sec flex-1" onclick="closeSheet()">' + h(opts.cancelText || pxText("لغو")) + "</button>" +
        '<button class="btn ' + (opts.danger === false ? "pri" : "dan") + ' flex-1" id="sheetOk">' + h(opts.okText || pxText("تأیید و اجرا")) + "</button>",
      onOk: async function () { closeSheet(); await onYes(); }
    });
  }
  function editSheet(o) {
    var ns = "f" + Math.random().toString(36).slice(2, 7);
    sheet({
      title: o.title, sub: o.sub, cls: o.cls,
      body: (o.top || "") + formHtml(o.fields, ns) + (o.bottom || ""),
      okText: o.okText || pxText("ذخیره تغییرات"),
      cancelText: pxText("انصراف"),
      onOk: async function () { await o.onSave(formRead(o.fields, ns)); }
    });
  }
  W.sheet = sheet; W.closeSheet = closeSheet; W.sheetBody = sheetBody; W.sheetFoot = sheetFoot;
  W.pwFoot = sheetFoot; W.confirmSheet = confirmSheet; W.editSheet = editSheet;

  /* ═══════════ TIMELINE / AGENT STEPS ═══════════ */
  function timeline(steps, opts) {
    opts = opts || {};
    if (!steps || !steps.length) return opts.empty ? empty(opts.empty) : "";
    return '<div class="px-tl">' + steps.map(function (s) {
      var st = s.state || (s.ok ? "done" : s.error ? "err" : s.running ? "run" : "");
      return '<div class="px-step ' + st + '">' +
        "<span>" + (s.label ? h(s.label) : "") + (s.detail ? ' <span class="tiny">' + h(s.detail) + "</span>" : "") + "</span>" +
        (s.meta ? '<span class="px-step-m">' + h(s.meta) + "</span>" : "") + "</div>";
    }).join("") + "</div>";
  }
  function agentSteps(steps) {
    return timeline((steps || []).map(function (s) {
      var name = s.tool || s.name || s.action || s.type || "step";
      var state = s.error ? "err" : (s.ok === false && s.done ? "err" : (s.done || s.completed ? "done" : "run"));
      return { label: name, detail: s.detail || s.summary || "", meta: s.ms || s.duration ? ms(s.ms || s.duration) : "", state: state };
    }));
  }
  /* ═══════════ SOURCES / QUOTE / LINK ═══════════ */
  function sourceList(items) {
    if (!items || !items.length) return "";
    return '<div class="px-srcs">' + items.map(function (s, i) {
      var url = typeof s === "string" ? s : (s.url || "");
      var title = typeof s === "string" ? s : (s.title || s.name || s.domain || url);
      var host = "";
      try { host = new URL(url).hostname.replace("www.", ""); } catch (e) { host = s.domain || ""; }
      var inner = '<div class="px-src-a"><b>' + h(short(title, 70)) + "</b>" + (host ? "<span>" + h(host) + "</span>" : "") + "</div>";
      return url
        ? '<a class="px-src" href="' + h(url) + '" target="_blank" rel="noopener noreferrer"><span class="px-src-n">' + (i + 1) + "</span>" + inner + "</a>"
        : '<div class="px-src"><span class="px-src-n">' + (i + 1) + "</span>" + inner + "</div>";
    }).join("") + "</div>";
  }
  function quoteBlock(text) { return '<div class="px-quote">' + text + "</div>"; }
  function linkBlock(url, label) {
    return '<a class="px-link" href="' + h(url) + '" target="_blank" rel="noopener noreferrer">' + h(label || url) + " ↗</a>";
  }
  W.timeline = timeline; W.agentSteps = agentSteps; W.sourceList = sourceList;
  W.quoteBlock = quoteBlock; W.linkBlock = linkBlock;

  /* ═══════════ ACTIVITY FEED ═══════════ */
  function activityFeed(items, opts) {
    opts = opts || {};
    if (!items || !items.length) return opts.empty ? empty(opts.empty) : pxState({ icon: opts.icon || "◷", title: opts.title || pxText("فعالیتی ثبت نشده"), sub: opts.sub || "" });
    return '<div class="px-feed">' + items.map(function (a) {
      return '<div class="px-act">' +
        '<div class="px-act-i" aria-hidden="true">' + (a.icon || "•") + "</div>" +
        '<div class="px-act-b"><b>' + h(a.title || "") + "</b>" +
        (a.sub ? '<div class="tiny">' + h(a.sub) + "</div>" : "") +
        (a.time ? '<div class="px-act-t">' + h(rel(a.time)) + "</div>" : "") + "</div>" +
        (a.end || "") + "</div>";
    }).join("") + "</div>";
  }
  W.activityFeed = activityFeed;

  /* ═══════════ ACTIONS / TOOLBAR / SEGMENTED ═══════════ */
  function actionGroup(actions, opts) {
    opts = opts || {};
    if (!actions || !actions.length) return "";
    return '<div class="px-actions' + (opts.cls ? " " + opts.cls : "") + '" role="group">' +
      actions.map(function (a) {
        return '<button class="btn ' + (a.kind || "sec") + (a.sm ? " sm" : "") + '" ' + (a.on || "") + ">" +
          (a.icon ? a.icon + " " : "") + h(a.t) + "</button>";
      }).join("") + "</div>";
  }
  function segmented(items, cur, onFn) {
    return '<div class="seg" role="tablist">' + items.map(function (it) {
      var id = Array.isArray(it) ? it[0] : it.id, label = Array.isArray(it) ? it[1] : it.label;
      var on = String(id) === String(cur) ? " on" : "";
      return '<button role="tab" aria-selected="' + (on ? "true" : "false") + '" class="seg-btn' + on + '" ' + (onFn || "") + "(" + "'" + id + "'" + ',this)>' + h(label) + "</button>";
    }).join("") + "</div>";
  }
  function searchField(id, placeholder, value, onInput) {
    return '<div class="px-search"><i aria-hidden="true">🔍</i>' +
      '<input id="' + id + '" type="search" placeholder="' + h(placeholder || pxText("جستجو…")) + '" value="' + h(value || "") + '" ' +
      'oninput="' + (onInput || "") + '" autocomplete="off" aria-label="' + h(placeholder || pxText("جستجو")) + '"></div>';
  }
  function toolbar(parts) {
    return '<div class="px-toolbar">' + parts.filter(Boolean).join("") + "</div>";
  }
  W.actionGroup = actionGroup; W.segmented = segmented; W.searchField = searchField; W.toolbar = toolbar;

  /* ═══════════ CODE BLOCK / TABS BAR ═══════════ */
  function codeBox(text, id) {
    return '<div class="code-box"><div class="code-head"><span>OUTPUT</span>' +
      '<button class="btn sm sec" ' + act("copyEl", id || "") + pxText(">کپی</button></div>") +
      '<div class="code-body"' + (id ? ' id="' + id + '"' : "") + ">" + h(text) + "</div></div>";
  }
  function tabsBar(key, items) {
    var cur = S.tab[key] || items[0][0];
    return '<div class="tabs" role="tablist">' + items.map(function (it) {
      var active = String(cur) === String(it[0]);
      return '<button role="tab" aria-selected="' + (active ? "true" : "false") + '" class="' + (active ? "on" : "") + '"' +
        act("setTab", key, it[0]) + ">" + h(it[1]) +
        (it[2] !== undefined && it[2] !== null ? ' <span class="px-sec-x">' + n(it[2]) + "</span>" : "") + "</button>";
    }).join("") + "</div>";
  }
  W.codeBox = codeBox; W.tabsBar = tabsBar;

  /* ═══════════ COMMAND PALETTE (Ctrl/Cmd+K) ═══════════ */
  var PAL = { open: false, sel: 0, items: [], seq: 0, q: "" };
  var TYPE_META = {
    model: { i: "◇", l: pxText("مدل"), route: "model", detail: true },
    provider: { i: "▣", l: pxText("پروایدر"), route: "provider", detail: true },
    agent: { i: "◉", l: pxText("ایجنت"), route: "agent", detail: true },
    project: { i: "◰", l: pxText("پروژه"), route: "projects" },
    workflow: { i: "◷", l: pxText("ورکفلو"), route: "automation" },
    task: { i: "◷", l: pxText("اتوماسیون"), route: "automation" },
    memory: { i: "◫", l: pxText("حافظه"), route: "memory" },
    prompt: { i: "✎", l: pxText("پرامپت"), route: "prompts" },
    knowledge: { i: "▤", l: pxText("دانش"), route: "knowledge" },
    eval: { i: "◎", l: pxText("ارزیابی"), route: "eval" },
    budget: { i: "💰", l: pxText("بودجه"), route: "costs" },
    tenant: { i: "🏢", l: pxText("سازمان"), route: "tenants" },
    webhook: { i: "⇢", l: pxText("وبهوک"), route: "settings" }
  };
  var QUICK = [
    { t: pxText("مکالمه جدید"), s: pxText("چت تازه با مدل پیشفرض"), i: "＋", run: function () { newChat(); } },
    { t: pxText("شورای هوش مصنوعی"), s: pxText("پرسش همزمان از چند مدل"), i: "⚡", run: function () { go("council"); } },
    { t: pxText("آرنا و مقایسه مدلها"), s: pxText("تست مستقیم چند مدل"), i: "⇄", run: function () { go("compare"); } },
    { t: pxText("افزودن پروایدر"), s: pxText("ثبت منبع هوش مصنوعی"), i: "＋", run: function () { providerNew(); } },
    { t: pxText("ایجنت جدید"), s: pxText("تعریف عامل سفارشی"), i: "＋", run: function () { agentNew(); } },
    { t: pxText("ثبت حافظه"), s: pxText("افزودن اطلاعات به حافظه"), i: "◫", run: function () { memNew(); } },
    { t: pxText("پایش سلامت مدلها"), s: pxText("اجرای Health Sweep"), i: "◍", run: function () { healthSweep(); } },
    { t: pxText("تازهسازی کامل"), s: pxText("پاک کردن کش و رندر مجدد"), i: "↻", run: function () { hardRefresh(); } }
  ];
  function localItems(q) {
    var term = S_(q).toLowerCase().trim(), out = [];
    (typeof NAV !== "undefined" ? NAV : []).forEach(function (g) {
      g.items.forEach(function (it) {
        if (it.admin && !S.isAdmin) return;
        if (term && (it.l.toLowerCase().indexOf(term) < 0 && g.g.toLowerCase().indexOf(term) < 0)) return;
        out.push({ g: pxText("صفحات"), i: it.i, t: it.l, s: g.g, run: function () { go(it.id); } });
      });
    });
    QUICK.forEach(function (c) {
      if (term && (c.t.toLowerCase().indexOf(term) < 0 && c.s.toLowerCase().indexOf(term) < 0)) return;
      out.push({ g: pxText("اقدامات"), i: c.i, t: c.t, s: c.s, run: c.run });
    });
    return out;
  }
  function remotePaint(results, q) {
    var box = document.getElementById("palRemote");
    if (!box) return;
    if (!results || !results.length) { box.innerHTML = q ? pxText('<div class="px-cmd-g">در پلتفرم یافت نشد</div>') : ""; return; }
    var byType = {};
    results.forEach(function (r) { (byType[r.type] = byType[r.type] || []).push(r); });
    var html = "";
    Object.keys(byType).forEach(function (tp) {
      var meta = TYPE_META[tp] || { i: "•", l: tp };
      html += '<div class="px-cmd-g">' + h(meta.l) + "</div>";
      byType[tp].slice(0, 6).forEach(function (r) {
        html += '<div class="px-cmd-i" role="button" tabindex="0" data-pxrun="' + h(tp + "|" + r.id) + '">' +
          '<span class="px-cmd-ic">' + meta.i + "</span>" +
          "<div><b>" + h(short(r.title || r.id, 46)) + "</b>" +
          (r.subtitle ? "<span>" + h(short(r.subtitle, 60)) + "</span>" : "") + "</div></div>";
      });
    });
    box.innerHTML = html;
    box.querySelectorAll("[data-pxrun]").forEach(function (el) {
      el.onclick = function () { runRemote(el.getAttribute("data-pxrun")); };
    });
  }
  function runRemote(key) {
    var parts = S_(key).split("|"), tp = parts[0], id = parts.slice(1).join("|");
    var meta = TYPE_META[tp];
    closePalette();
    if (!meta) return;
    if (meta.detail && id) go(meta.route, id); else go(meta.route);
  }
  function paintPalette(q) {
    PAL.q = q || "";
    var listEl = document.getElementById("palList");
    if (!listEl) return;
    var local = localItems(q).slice(0, 12);
    PAL.items = local;
    if (PAL.sel >= local.length) PAL.sel = 0;
    var groups = {};
    local.forEach(function (c, idx) { (groups[c.g] = groups[c.g] || []).push({ c: c, idx: idx }); });
    var html = "";
    Object.keys(groups).forEach(function (g) {
      html += '<div class="px-cmd-g">' + h(g) + "</div>";
      groups[g].forEach(function (row) {
        html += '<div class="px-cmd-i' + (row.idx === PAL.sel ? " sel" : "") + '" role="button" tabindex="0" data-pxcmd="' + row.idx + '">' +
          '<span class="px-cmd-ic">' + row.c.i + "</span>" +
          "<div><b>" + h(row.c.t) + "</b>" + (row.c.s ? "<span>" + h(row.c.s) + "</span>" : "") + "</div>" +
          '<span class="px-cmd-x tiny">↵</span></div>';
      });
    });
    if (!local.length) html = pxText('<div class="px-cmd-g">دستوری یافت نشد</div>');
    listEl.innerHTML = html;
    listEl.querySelectorAll("[data-pxcmd]").forEach(function (el) {
      el.onclick = function () { runLocal(Number(el.getAttribute("data-pxcmd"))); };
    });
    var box = document.getElementById("palRemote");
    if (!S_(q).trim()) { if (box) box.innerHTML = ""; return; }
    if (box) box.innerHTML = pxText('<div class="px-cmd-g">در حال جستجوی پلتفرم…</div>');
    var mySeq = ++PAL.seq;
    api("/search?q=" + encodeURIComponent(q), { timeout: 6000 }).then(function (r) {
      if (mySeq !== PAL.seq) return;
      remotePaint((r && (r.results || r)) || [], q);
    }).catch(function () { if (mySeq === PAL.seq) remotePaint([], q); });
  }
  function runLocal(i) {
    var c = PAL.items[i];
    closePalette();
    if (c && c.run) c.run();
  }
  function closePalette() {
    PAL.open = false;
    var a = document.getElementById("palOverlay");
    if (a) a.remove();
  }
  function palette() {
    if (PAL.open) { closePalette(); return; }
    try { haptic("impact", "medium"); } catch (e) {}
    PAL.open = true; PAL.sel = 0; PAL.seq++;
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.id = "palOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", pxText("جستجو و اجرای سریع"));
    overlay.onclick = function (e) { if (e.target === overlay) closePalette(); };
    var s = document.createElement("div");
    s.className = "modal-sheet px-cmd";
    s.innerHTML = '<div class="px-cmd-head"><i aria-hidden="true">🔍</i>' +
      pxText('<input id="palQ" placeholder="جستجوی مدل، پروایدر، ایجنت، صفحه یا اقدام…" autocomplete="off" spellcheck="false" aria-label="جستجو">') +
      "<kbd>ESC</kbd></div>" +
      '<div class="px-cmd-list"><div id="palList"></div><div id="palRemote"></div></div>';
    overlay.appendChild(s);
    document.body.appendChild(overlay);
    var inp = document.getElementById("palQ");
    paintPalette("");
    inp.oninput = function () { PAL.sel = 0; paintPalette(inp.value); };
    inp.onkeydown = function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); PAL.sel = Math.min(PAL.items.length - 1, PAL.sel + 1); paintPalette(PAL.q); }
      else if (e.key === "ArrowUp") { e.preventDefault(); PAL.sel = Math.max(0, PAL.sel - 1); paintPalette(PAL.q); }
      else if (e.key === "Enter") { e.preventDefault(); runLocal(PAL.sel); }
      else if (e.key === "Escape") { e.preventDefault(); closePalette(); }
    };
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
  }
  W.palette = palette; W.closePalette = closePalette; W.runCmd = runLocal;

  /* ═══════════ INIT ═══════════ */
  try { toastHost(); } catch (e) {}
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && S_(e.key).toLowerCase() === "k") {
      e.preventDefault();
      if (PAL.open) closePalette(); else palette();
    }
  });
})();

`;
