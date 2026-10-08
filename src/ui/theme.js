// ─────────────────────────────────────────────
// 🎨 PIMXAGENT Design System — Tokens (single source of truth)
// همه رنگ/فاصله/سایه/حرکت از اینجا میآید؛ هیچجای دیگری هاردکد نشود.
// این توکنها هم برای Mini App (CSS Variables) و هم برای تلگرام مرجعاند.
// ─────────────────────────────────────────────

export const TOKENS = {
  // ── Surfaces ─────────────────────────────
  bg: "#06080f",
  bgSoft: "#0a0e19",
  surface: "rgba(16,21,36,0.72)",
  surface2: "rgba(23,30,50,0.82)",
  surface3: "rgba(31,40,64,0.94)",
  glass: "rgba(16,22,38,0.62)",
  line: "rgba(255,255,255,0.075)",
  line2: "rgba(255,255,255,0.13)",
  lineAcc: "rgba(124,140,255,0.32)",

  // ── Text ─────────────────────────────────
  text: "#f2f5fd",
  text2: "#b6c1d9",
  muted: "#7b87a3",
  dim: "#4f5a72",

  // ── Accent & semantics ───────────────────
  acc: "#7c8cff",
  acc2: "#a06bff",
  accSoft: "rgba(124,140,255,0.13)",
  ok: "#12b981",
  okSoft: "rgba(18,185,129,0.13)",
  warn: "#f0a020",
  warnSoft: "rgba(240,160,32,0.13)",
  bad: "#f43f5e",
  badSoft: "rgba(244,63,94,0.13)",
  info: "#0ea5e9",
  infoSoft: "rgba(14,165,233,0.13)",

  // ── Spacing scale (4px base) ─────────────
  sp: [0, 4, 8, 12, 16, 20, 24, 32, 40],

  // ── Radius scale ─────────────────────────
  rXs: "8px", rSm: "10px", rMd: "14px", rLg: "18px", rXl: "24px", rPill: "999px",

  // ── Elevation (subtle, controlled) ───────
  elev1: "0 1px 2px rgba(0,0,0,0.28)",
  elev2: "0 6px 20px -8px rgba(0,0,0,0.55)",
  elev3: "0 16px 40px -14px rgba(0,0,0,0.7)",
  elev4: "0 28px 64px -18px rgba(0,0,0,0.8)",

  // ── Motion ───────────────────────────────
  durFast: "0.14s", durBase: "0.2s", durSlow: "0.3s",
  ease: "cubic-bezier(.4,0,.2,1)",
  easeSpring: "cubic-bezier(.16,.84,.44,1)",

  // ── Layout ───────────────────────────────
  nav: "268px", head: "56px", tab: "60px", pad: "16px",
  font: '"Vazirmatn", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", "Fira Code", ui-monospace, Menlo, Consolas, monospace'
};

// رنگ وضعیت → نام توکن (برای Badge/Status)
export const TONE = {
  ok: { color: "var(--ok)", soft: "var(--ok-soft)", label: "سالم" },
  warn: { color: "var(--warn)", soft: "var(--warn-soft)", label: "هشدار" },
  bad: { color: "var(--bad)", soft: "var(--bad-soft)", label: "خطا" },
  info: { color: "var(--info)", soft: "var(--info-soft)", label: "اطلاع" },
  acc: { color: "var(--acc)", soft: "var(--acc-soft)", label: "فعال" },
  mut: { color: "var(--muted)", soft: "rgba(255,255,255,0.05)", label: "نامشخص" }
};

// نگاشت وضعیتهای واقعی بکاند → tone (بدون داده جعلی)
export const STATUS_TONE = {
  healthy: "ok", active: "ok", done: "ok", completed: "ok", success: "ok", delivered: "ok",
  approved: "ok", enabled: "ok", online: "ok", sent: "ok",
  failed: "bad", invalid: "bad", rejected: "bad", fail: "bad", error: "bad", revoked: "bad",
  disabled: "mut", deleted: "mut", archived: "mut", draft: "mut", unknown: "mut",
  degraded: "warn", rate_limited: "warn", pending: "warn", running: "warn", queued: "warn",
  retry: "warn", throttled: "warn", suspended: "warn", partial: "warn"
};

const px = n => TOKENS.sp[n];


// ─────────────────────────────────────────────
// توکنهای CSS — همراه با Alias های قدیمی تا کل استایل موجود سازگار بماند
// ─────────────────────────────────────────────
export function tokensCss() {
  return `
:root{
  color-scheme:dark;
  --px-bg:${TOKENS.bg};--px-bg-soft:${TOKENS.bgSoft};
  --px-surface:${TOKENS.surface};--px-surface-2:${TOKENS.surface2};--px-surface-3:${TOKENS.surface3};
  --px-glass:${TOKENS.glass};
  --px-line:${TOKENS.line};--px-line-2:${TOKENS.line2};--px-line-acc:${TOKENS.lineAcc};
  --px-text:${TOKENS.text};--px-text-2:${TOKENS.text2};--px-muted:${TOKENS.muted};--px-dim:${TOKENS.dim};
  --px-acc:${TOKENS.acc};--px-acc-2:${TOKENS.acc2};--px-acc-soft:${TOKENS.accSoft};
  --px-ok:${TOKENS.ok};--px-ok-soft:${TOKENS.okSoft};
  --px-warn:${TOKENS.warn};--px-warn-soft:${TOKENS.warnSoft};
  --px-bad:${TOKENS.bad};--px-bad-soft:${TOKENS.badSoft};
  --px-info:${TOKENS.info};--px-info-soft:${TOKENS.infoSoft};
  --px-r-xs:${TOKENS.rXs};--px-r-sm:${TOKENS.rSm};--px-r-md:${TOKENS.rMd};--px-r-lg:${TOKENS.rLg};--px-r-xl:${TOKENS.rXl};--px-r-pill:${TOKENS.rPill};
  --px-e1:${TOKENS.elev1};--px-e2:${TOKENS.elev2};--px-e3:${TOKENS.elev3};--px-e4:${TOKENS.elev4};
  --px-d-fast:${TOKENS.durFast};--px-d:${TOKENS.durBase};--px-d-slow:${TOKENS.durSlow};
  --px-ease:${TOKENS.ease};--px-ease-spring:${TOKENS.easeSpring};
  --px-s1:${px(1)}px;--px-s2:${px(2)}px;--px-s3:${px(3)}px;--px-s4:${px(4)}px;--px-s5:${px(5)}px;--px-s6:${px(6)}px;--px-s7:${px(7)}px;--px-s8:${px(8)}px;
  --px-nav:${TOKENS.nav};--px-head:${TOKENS.head};--px-tab:${TOKENS.tab};--px-pad:${TOKENS.pad};
  --px-font:${TOKENS.font};--px-mono:${TOKENS.mono};
  --px-z-nav:90;--px-z-scrim:80;--px-z-head:40;--px-z-sheet:101;--px-z-toast:999;

  /* legacy aliases (backward compatibility) */
  --bg:var(--px-bg);--bg2:var(--px-bg-soft);
  --surface:var(--px-surface);--surface2:var(--px-surface-2);--surface3:var(--px-surface-3);
  --glass:var(--px-glass);--glass-border:var(--px-line-acc);--glass-border-hover:rgba(160,107,255,0.35);
  --line:var(--px-line);--line2:var(--px-line-2);
  --text:var(--px-text);--text2:var(--px-text-2);--muted:var(--px-muted);--dim:var(--px-dim);
  --acc:var(--px-acc);--acc2:var(--px-acc-2);--acc-soft:var(--px-acc-soft);--acc-line:var(--px-line-acc);
  --ok:var(--px-ok);--ok-soft:var(--px-ok-soft);--good:var(--px-ok);
  --bad:var(--px-bad);--bad-soft:var(--px-bad-soft);
  --warn:var(--px-warn);--warn-soft:var(--px-warn-soft);
  --info:var(--px-info);
  --grad:linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #c026d3 100%);
  --r:var(--px-r-md);--r2:var(--px-r-sm);--r3:var(--px-r-xl);--r-pill:var(--px-r-pill);
  --sb:var(--px-e1);--sh:var(--px-e2);--sh2:var(--px-e3);
  --safe:env(safe-area-inset-bottom, 0px);--safet:env(safe-area-inset-top, 0px);
  --font:var(--px-font);--mono:var(--px-mono);
  --nav:var(--px-nav);--head:var(--px-head);--tab:var(--px-tab);--pad:var(--px-pad);
  --t:var(--px-d) var(--px-ease);--t-spring:var(--px-d-slow) var(--px-ease-spring);
}
html[data-px-theme="light"]{
  --good:var(--px-ok);
}`;
}

// ─────────────────────────────────────────────
// Light theme — روی همان توکنها (سازگاری کامل با CSS قدیمی)
// ─────────────────────────────────────────────
export function lightThemeCss() {
  return `
html[data-px-theme="light"]{
  color-scheme:light;
  --px-bg:#f6f7fb;--px-bg-soft:#ffffff;
  --px-surface:rgba(255,255,255,0.92);--px-surface-2:rgba(244,246,252,0.96);--px-surface-3:#eef1f8;
  --px-glass:rgba(255,255,255,0.75);
  --px-line:rgba(15,23,42,0.09);--px-line-2:rgba(15,23,42,0.16);--px-line-acc:rgba(99,102,241,0.35);
  --px-text:#0f172a;--px-text-2:#3f4a61;--px-muted:#64708a;--px-dim:#8892a6;
  --px-acc:#5457e6;--px-acc-2:#7c3aed;--px-acc-soft:rgba(84,87,230,0.1);
  --px-ok:#0f9d6b;--px-ok-soft:rgba(15,157,107,0.12);
  --good:#0f9d6b;
  --px-warn:#b45309;--px-warn-soft:rgba(180,83,9,0.12);
  --px-bad:#dc2743;--px-bad-soft:rgba(220,39,67,0.1);
  --px-info:#0284c7;--px-info-soft:rgba(2,132,199,0.1);
  --px-e1:0 1px 2px rgba(15,23,42,0.08);--px-e2:0 6px 20px -10px rgba(15,23,42,0.22);
  --px-e3:0 16px 40px -16px rgba(15,23,42,0.28);--px-e4:0 28px 64px -20px rgba(15,23,42,0.32);
  --glass-border:rgba(99,102,241,0.28);
  --grad:linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #a21caf 100%);
}`;
}

// ─────────────────────────────────────────────
// Accessibility & motion preferences
// ─────────────────────────────────────────────
export function a11yCss() {
  return `
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
}
@media (prefers-contrast: more){
  :root{--px-line:rgba(255,255,255,0.22);--px-line-2:rgba(255,255,255,0.32);--px-muted:#a9b4cc}
}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}`;
}

// ─────────────────────────────────────────────
// همگامسازی تم با تلگرام (Color Scheme + Theme Params)
// خروجی: اسنیپت JS که قبل از رندر اجرا میشود.
// ─────────────────────────────────────────────
export function themeInitScript() {
  return `
(function(){
  var KEY = "pimx_theme";
  function tgSafe(){ try{ return (window.Telegram && window.Telegram.WebApp) || null; }catch(e){ return null; } }
  function paint(mode){
    document.documentElement.setAttribute("data-px-theme", mode);
    var t = tgSafe();
    try{
      if(t && t.themeParams){
        var p = t.themeParams, r = document.documentElement.style;
        if(p.bg_color) r.setProperty("--tg-bg", p.bg_color);
        if(p.secondary_bg_color) r.setProperty("--tg-bg-2", p.secondary_bg_color);
        if(p.text_color) r.setProperty("--tg-text", p.text_color);
        if(p.hint_color) r.setProperty("--tg-hint", p.hint_color);
      }
      if(t && t.setHeaderColor) t.setHeaderColor(mode === "light" ? "#f6f7fb" : "#06080f");
      if(t && t.setBackgroundColor) t.setBackgroundColor(mode === "light" ? "#f6f7fb" : "#06080f");
    }catch(e){}
    try{
      var metaTheme = document.querySelector('meta[name="theme-color"]');
      if(metaTheme) metaTheme.setAttribute("content", mode === "light" ? "#f6f7fb" : "#06080f");
    }catch(e){}
    if(window.S) window.S.theme = mode;
  }
  function resolve(){
    var saved = "";
    try{ saved = localStorage.getItem(KEY) || ""; }catch(e){}
    var t = tgSafe();
    return saved || ((t && t.colorScheme === "light") ? "light" : "dark");
  }
  window.pxTheme = function(){ return document.documentElement.getAttribute("data-px-theme") || "dark"; };
  window.pxSetTheme = function(mode){
    mode = mode === "light" ? "light" : "dark";
    try{ localStorage.setItem(KEY, mode); }catch(e){}
    paint(mode);
    if(window.toast) try{ window.toast(mode === "light" ? "تم روشن فعال شد" : "تم تیره فعال شد", "ok"); }catch(e){}
    if(window.render) try{ window.render(); }catch(e){}
  };
  window.pxToggleTheme = function(){ window.pxSetTheme(window.pxTheme() === "light" ? "dark" : "light"); };
  paint(resolve());
  document.addEventListener("DOMContentLoaded", function(){ paint(resolve()); });
  var t = tgSafe();
  if(t && t.onEvent){ try{ t.onEvent("themeChanged", function(){ paint(resolve()); }); }catch(e){} }
})();`;
}


