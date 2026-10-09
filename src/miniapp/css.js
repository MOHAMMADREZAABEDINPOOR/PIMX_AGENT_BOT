import { tokensCss, lightThemeCss, a11yCss } from "../ui/theme.js";
import { KIT_CSS } from "../ui/kit-css.js";
import { PERSONAL_CSS } from "./personal-css.js";
import { MODEL_PICKER_CSS } from "./model-picker-css.js";
import { WORKSPACE_CSS } from "./workspace-css.js";

// ساختار استایل: پایهٔ قدیمی (سازگاری کامل) + توکنهای مرکزی + تم روشن + دسترسپذیری + UI Kit
export const CSS = (function () {
  const base = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#05070d;
  --bg2:#090d18;
  --surface:rgba(15, 20, 36, 0.75);
  --surface2:rgba(22, 30, 52, 0.85);
  --surface3:rgba(30, 41, 69, 0.95);
  --glass:rgba(15, 22, 40, 0.65);
  --glass-border:rgba(124, 140, 255, 0.16);
  --glass-border-hover:rgba(160, 107, 255, 0.35);
  --line:rgba(255, 255, 255, 0.08);
  --line2:rgba(255, 255, 255, 0.14);
  --text:#f1f5fd;
  --text2:#b8c4db;
  --muted:#7d8ba7;
  --dim:#55607a;
  --acc:#7c8cff;
  --acc2:#a06bff;
  --acc-soft:rgba(124, 140, 255, 0.14);
  --acc-line:rgba(124, 140, 255, 0.35);
  --ok:#10b981;
  --ok-soft:rgba(16, 185, 129, 0.14);
  --good:#10b981;
  --bad:#f43f5e;
  --bad-soft:rgba(244, 63, 94, 0.14);
  --warn:#f59e0b;
  --warn-soft:rgba(245, 158, 11, 0.14);
  --info:#0ea5e9;
  --grad:linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
  --r:16px;--r2:12px;--r3:24px;--r-pill:9999px;
  --sb:0 2px 4px rgba(0,0,0,0.3);
  --sh:0 12px 32px -8px rgba(0,0,0,0.65), 0 0 0 1px var(--glass-border);
  --sh2:0 24px 60px -12px rgba(0,0,0,0.85), 0 0 1px 1px var(--glass-border);
  --safe:env(safe-area-inset-bottom, 0px);
  --safet:env(safe-area-inset-top, 0px);
  --font:"Vazirmatn", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --mono:"JetBrains Mono", "Fira Code", ui-monospace, Menlo, Consolas, monospace;
  --nav:270px;--head:58px;--tab:62px;
  --t:.18s cubic-bezier(.4, 0, .2, 1);
  --t-spring:0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --pad:16px;
}
html,body{height:100%;overflow:hidden;background:var(--bg)}
body{
  color:var(--text);font:14px/1.65 var(--font);
  -webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;
  overscroll-behavior:none;position:fixed;inset:0;
}
body::before{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(1000px 600px at 90% -10%, rgba(99, 102, 241, 0.16), transparent 70%),
    radial-gradient(800px 500px at 10% 15%, rgba(139, 92, 246, 0.12), transparent 60%);
}
button,input,select,textarea{font:inherit;color:inherit;font-family:inherit}
button{background:none;border:0;cursor:pointer;user-select:none;touch-action:manipulation}
a{color:inherit;text-decoration:none}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-thumb{background:var(--line2);border-radius:99px}
::selection{background:var(--acc-soft);color:#fff}
:focus-visible{outline:2px solid var(--acc);outline-offset:2px}

/* ══ UTILITIES ══ */
.row{display:flex;align-items:center}
.row.wrap{flex-wrap:wrap}
.gap4{gap:4px}.gap8{gap:8px}.gap12{gap:12px}.gap16{gap:16px}
.sp{flex:1;min-width:0}
.trunc{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mono{font-family:var(--mono)}
.ltr{direction:ltr;text-align:left}
.tiny{font-size:11.5px;color:var(--muted)}
.tny{font-size:10.5px;color:var(--muted)}
.hide{display:none!important}
.mb4{margin-bottom:4px}.mb8{margin-bottom:8px}.mb12{margin-bottom:12px}.mb16{margin-bottom:16px}
.mt4{margin-top:4px}.mt8{margin-top:8px}.mt12{margin-top:12px}.mt16{margin-top:16px}
.pad{padding:14px}

/* ══ SHELL & SIDEBAR ══ */
#app{height:100%;overflow:hidden}
.shell{display:flex;height:100%;overflow:hidden}
.side{
  position:fixed;inset-block:0;inset-inline-start:0;width:var(--nav);z-index:90;
  display:flex;flex-direction:column;
  background:rgba(9, 13, 24, 0.95);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  border-inline-end:1px solid var(--glass-border);
  padding-block:calc(14px + var(--safet)) calc(12px + var(--safe));
  transition:transform var(--t-spring);
}
@media(max-width:960px){
  .side{transform:translateX(-105%)}
  html[dir="rtl"] .side{transform:translateX(105%)}
  .side.open{transform:translateX(0)!important}
}
.side-overlay,.scrim{
  position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);
  z-index:80;opacity:0;pointer-events:none;transition:opacity var(--t);
}
.side-overlay.open,.scrim.open{opacity:1;pointer-events:auto;display:block}
.side-h{display:flex;align-items:center;gap:12px;padding:4px 16px 16px;border-bottom:1px solid var(--line)}
.logo{
  width:38px;height:38px;border-radius:12px;background:var(--grad);
  display:grid;place-items:center;font-weight:900;font-size:16px;color:#fff;
  box-shadow:0 4px 18px rgba(99,102,241,0.45);flex-shrink:0;
}
.side-h .nm{font-weight:800;font-size:15px;line-height:1.2}
.side-h .tg{font-size:10.5px;color:var(--acc);font-weight:600}
.side-s{flex:1;overflow-y:auto;overflow-x:hidden;padding:12px 10px 8px}
.navg{margin-bottom:16px}
.navg-t{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--dim);padding:0 10px 8px}
.navi{
  display:flex;align-items:center;gap:11px;width:100%;padding:9px 12px;border-radius:var(--r2);
  color:var(--text2);font-size:13.5px;font-weight:550;transition:var(--t);text-align:start;margin-bottom:2px;
}
.navi:hover{background:rgba(255,255,255,0.05);color:var(--text)}
.navi.on{background:var(--acc-soft);color:#fff;font-weight:700;border:1px solid var(--acc-line)}
.navi i{font-style:normal;width:20px;text-align:center;font-size:15px;opacity:0.85;flex-shrink:0}
.navi.on i{opacity:1;color:var(--acc)}
.side-f{padding:12px;border-top:1px solid var(--line);margin-top:auto}
.uchip{
  display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;
  border-radius:var(--r2);background:rgba(255,255,255,0.03);border:1px solid var(--line);
  transition:var(--t);text-align:start;
}
.uchip:hover{background:rgba(255,255,255,0.07);border-color:var(--glass-border)}
.uav{
  width:32px;height:32px;border-radius:10px;background:var(--surface3);
  display:grid;place-items:center;font-weight:800;font-size:13px;
  color:var(--acc);border:1px solid var(--glass-border);flex-shrink:0;overflow:hidden;
}

/* ══ HEADER & TOPBAR ══ */
.main-wrap,.body{flex:1;display:flex;flex-direction:column;height:100%;overflow:hidden;min-width:0}
@media(min-width:961px){.main-wrap,.body{margin-inline-start:var(--nav)}}

.head{
  height:var(--head);display:flex;align-items:center;gap:10px;padding:0 var(--pad);
  padding-top:var(--safet);background:rgba(9, 13, 24, 0.85);
  backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  border-bottom:1px solid var(--glass-border);z-index:40;flex-shrink:0;
}
.burger,.ibtn.burger{font-size:18px;flex-shrink:0}
.head-t{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
.head-t h1,.head-t .h1{font-size:15px;font-weight:800;letter-spacing:-0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
.head-t .sub,.head-t .hsub{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
.head-actions{display:flex;align-items:center;gap:6px;margin-inline-start:auto;flex-shrink:0}
.ibtn,.btn-icon{
  width:36px;height:36px;border-radius:10px;display:grid;place-items:center;
  background:rgba(255,255,255,0.04);border:1px solid var(--line);color:var(--text2);
  font-size:15px;transition:var(--t);flex-shrink:0;
}
.ibtn:hover,.btn-icon:hover{background:rgba(255,255,255,0.09);color:var(--text)}
.ibtn:active,.btn-icon:active{transform:scale(0.92)}
.srch{
  display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--r-pill);
  background:rgba(255,255,255,0.04);border:1px solid var(--line);color:var(--muted);
  font-size:12px;cursor:pointer;transition:var(--t);
}
.srch:hover{background:rgba(255,255,255,0.08);color:var(--text)}
.srch kbd{font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.08)}

/* ══ PAGE HEADER (.ph) ══ */
.ph{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-bottom:16px;flex-wrap:wrap;
}
.ph-t{flex:1;min-width:180px}
.ph-t h2{font-size:18px;font-weight:800;letter-spacing:-0.3px;color:var(--text)}
.ph-t p{font-size:12px;color:var(--muted);margin-top:2px}
.ph-a{display:flex;align-items:center;gap:6px;flex-wrap:wrap}

/* ══ CONTENT SCROLLER ══ */
.main{
  flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;
  padding:var(--pad);padding-bottom:calc(var(--tab) + var(--safe) + 16px);
}
.main.flush{padding:0;overflow:hidden}
.main-in{width:100%;height:100%}
@media(min-width:961px){.main{padding-bottom:calc(var(--safe) + 24px)}}

/* ══ CARDS & PANELS ══ */
.card{
  background:var(--surface);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid var(--glass-border);border-radius:var(--r);padding:16px;margin-bottom:14px;
  box-shadow:var(--sh);position:relative;overflow:hidden;transition:border-color var(--t);
}
.card:hover{border-color:var(--glass-border-hover)}
.card-glow{position:absolute;top:0;inset-inline-end:0;width:120px;height:120px;background:radial-gradient(circle, rgba(124,140,255,0.1) 0%, transparent 70%);pointer-events:none;border-radius:50%}
.card-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.card-h h3,.card-t{font-size:15px;font-weight:750;display:flex;align-items:center;gap:8px;color:var(--text)}
.card-h .sub,.card-sub{font-size:11.5px;color:var(--muted);font-weight:normal}
.card-b{font-size:13.5px}
.card-b.flat{margin:-16px;padding:0}
.card-f{margin-top:12px;display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid var(--line)}

/* ══ STATS & GRIDS ══ */
.g,.stat-grid{display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;margin-bottom:14px}
@media(min-width:640px){.g.g4,.stat-grid{grid-template-columns:repeat(4, 1fr)}}
.side-by{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:860px){.side-by{grid-template-columns:1fr 1fr}}

.stat,.stat-box{
  background:linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
  border:1px solid var(--line);border-radius:var(--r2);padding:12px;position:relative;transition:var(--t);
}
.stat:hover,.stat-box:hover{border-color:var(--glass-border);transform:translateY(-1px)}
.sl,.stat-box .lbl{font-size:11.5px;color:var(--muted);font-weight:600;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between}
.sv,.sv.num,.stat-box .val{font-size:20px;font-weight:850;color:var(--text);font-family:var(--mono);line-height:1.2}
.sd,.stat-box .trend{font-size:11px;font-weight:600;margin-top:4px;color:var(--muted)}
.mtr{height:4px;border-radius:99px;background:rgba(255,255,255,0.08);overflow:hidden;margin-top:6px}
.mtr i{display:block;height:100%;border-radius:99px;background:var(--acc);transition:width 0.3s ease}
.mtr.ok i{background:var(--ok)}.mtr.warn i{background:var(--warn)}.mtr.bad i{background:var(--bad)}

/* ══ LISTS & LIST ITEMS ══ */
.lst{display:flex;flex-direction:column;gap:3px}
.li{
  display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--r2);
  background:rgba(255,255,255,0.02);border:1px solid var(--line);transition:var(--t);
}
.li.clk{cursor:pointer}
.li.clk:hover{background:rgba(255,255,255,0.05);border-color:var(--glass-border)}
.li-i{
  width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,0.05);
  display:grid;place-items:center;font-size:14px;flex-shrink:0;color:var(--acc);
}
.li-t{font-weight:650;font-size:13.5px;line-height:1.3}
.li-s{font-size:11.5px;color:var(--muted);line-height:1.3;margin-top:1px}
.li-e{margin-inline-start:auto;font-size:12px;display:flex;align-items:center;gap:6px;flex-shrink:0}
.li-a{display:flex;align-items:center;gap:6px;flex-shrink:0}
.chev{font-size:16px;opacity:0.4;margin-inline-start:4px}
.kv{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px}
.kv.clk{cursor:pointer}
.kv span{color:var(--muted);font-size:12.5px}

/* ══ BUTTONS & BADGES ══ */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:8px 14px;border-radius:var(--r2);font-size:13px;font-weight:650;
  transition:all var(--t);position:relative;cursor:pointer;white-space:nowrap;
}
.btn:active{transform:scale(0.96)}
.btn.pri,.btn-primary{background:var(--grad);color:#fff;box-shadow:0 4px 16px rgba(99,102,241,0.35);border:none}
.btn.pri:hover{filter:brightness(1.08)}
.btn.gho,.btn.sec,.btn-secondary{background:rgba(255,255,255,0.06);color:var(--text);border:1px solid var(--line2)}
.btn.gho:hover,.btn.sec:hover{background:rgba(255,255,255,0.1);border-color:var(--glass-border)}
.btn.dan,.btn-danger{background:var(--bad-soft);color:var(--bad);border:1px solid rgba(244,63,94,0.3)}
.btn.sm,.btn-sm{padding:5px 10px;font-size:11.5px;border-radius:8px}
.btn.ico{width:36px;height:36px;padding:0;border-radius:10px}

.bdg,.badge{
  display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:var(--r-pill);
  font-size:11px;font-weight:650;background:var(--surface2);border:1px solid var(--line);color:var(--text);
}
.bdg.ok,.badge-ok{background:var(--ok-soft);color:var(--ok);border-color:rgba(16,185,129,0.3)}
.bdg.err,.badge-bad{background:var(--bad-soft);color:var(--bad);border-color:rgba(244,63,94,0.3)}
.bdg.warn,.badge-warn{background:var(--warn-soft);color:var(--warn);border-color:rgba(245,158,11,0.3)}
.bdg.mut,.badge-mut{background:var(--surface2);color:var(--muted);border:1px solid var(--line)}
.bdg.acc,.badge-acc{background:var(--acc-soft);color:var(--acc);border-color:var(--acc-line)}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.dot.ok{background:var(--ok);box-shadow:0 0 6px var(--ok)}
.dot.err{background:var(--bad);box-shadow:0 0 6px var(--bad)}
.dot.warn{background:var(--warn);box-shadow:0 0 6px var(--warn)}
.pulse-dot{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0;background:currentColor}
.pulse-dot.ok{background:var(--ok)}
.pulse-dot.bad,.pulse-dot.err{background:var(--bad)}
.pulse-dot.warn{background:var(--warn)}
.model-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);transition:all var(--t)}
.model-card:hover{background:var(--surface2);border-color:var(--glass-border)}

/* ══ CHIPS & TAGS ══ */
.chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.chip{
  display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:10px;
  font-size:12px;font-weight:600;background:rgba(255,255,255,0.05);border:1px solid var(--line);
  color:var(--text2);transition:all 0.15s ease;white-space:nowrap;user-select:none;
}
.chip.clk{cursor:pointer}
.chip.clk:hover{background:rgba(255,255,255,0.1);color:var(--text);border-color:var(--glass-border);transform:translateY(-1px)}
.chip.clk:active{transform:scale(0.96)}
.chip.on,.chip.clk.on{
  background:linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(168,85,247,0.3) 100%) !important;
  border-color:var(--acc) !important;color:#fff !important;box-shadow:0 0 12px rgba(99,102,241,0.3);
  font-weight:700;
}

/* ══ FORMS & INPUTS ══ */
.fld,.input-group{margin-bottom:12px;display:flex;flex-direction:column;gap:5px}
.fld label,.input-label{font-size:12px;font-weight:650;color:var(--text2);display:flex;align-items:center;gap:6px}
.fld input,.fld textarea,.fld select,.input,.textarea,.select{
  width:100%;padding:9px 12px;border-radius:var(--r2);
  background:var(--bg2);border:1px solid var(--line2);
  color:var(--text);font-size:13.5px;transition:var(--t);
}
select, .select, select option, select optgroup {
  background-color: var(--bg2);
  color: var(--text);
}
select option {
  background-color: var(--bg2);
  color: var(--text);
  padding: 10px 14px;
}
select option:checked, select option:hover {
  background-color: var(--acc-soft);
  color: var(--acc);
}
select optgroup {
  background-color: var(--bg2);
  color: var(--acc);
  font-weight: 700;
  padding: 6px 10px;
}
.fld input:focus,.fld textarea:focus,.fld select:focus,.input:focus,.textarea:focus,.select:focus{
  border-color:var(--acc);background:var(--surface);box-shadow:0 0 0 3px var(--acc-soft);outline:none;
}
.fld textarea,.textarea{min-height:80px;resize:vertical}
.inline-f{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.seg{display:flex;gap:4px;background:rgba(255,255,255,0.04);padding:4px;border-radius:var(--r2);border:1px solid var(--line);flex-wrap:wrap}
.seg button{flex:1;min-width:60px;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:600;color:var(--text2);text-align:center;transition:var(--t)}
.seg button.on{background:var(--grad);color:#fff;font-weight:700;box-shadow:0 2px 10px rgba(99,102,241,0.35)}
.swt{display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:6px 0}
.swt input{display:none}
.swt-b{width:44px;height:24px;border-radius:99px;background:rgba(255,255,255,0.12);position:relative;transition:var(--t);flex-shrink:0}
.swt-b::after{content:"";position:absolute;top:3px;inset-inline-start:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:var(--t)}
.swt input:checked + .swt-b{background:var(--acc)}
.swt input:checked + .swt-b::after{transform:translateX(20px)}
html[dir="rtl"] .swt input:checked + .swt-b::after{transform:translateX(-20px)}
.hint{font-size:11px;color:var(--muted)}
.req{color:var(--bad);font-weight:bold}

/* ══ COUNCIL & MODEL PICKER ══ */
.picker{
  display:grid;grid-template-columns:1fr;gap:6px;max-height:220px;overflow-y:auto;
  padding:6px;border:1px solid var(--line);border-radius:var(--r2);background:rgba(8,11,20,0.8);
}
@media(min-width:560px){.picker{grid-template-columns:1fr 1fr}}
.pick{
  display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;border:1px solid var(--line);
  background:var(--surface);color:var(--text2);font-size:12px;font-weight:600;text-align:start;transition:var(--t);cursor:pointer;
}
.pick:hover{background:var(--surface2);color:var(--text);border-color:var(--glass-border)}
.pick.on{background:var(--acc-soft);border-color:var(--acc-line);color:#fff;font-weight:700}
.ans{border:1px solid var(--line);border-radius:var(--r2);margin-bottom:8px;overflow:hidden;background:var(--surface)}
.ans-h{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;background:var(--surface2);transition:var(--t)}
.ans-h:hover{background:var(--surface3)}
.ans-b{padding:12px;border-top:1px solid var(--line);font-size:13px;line-height:1.6;background:var(--bg2)}
.ans-b.hide{display:none}

/* ══ TABS BAR ══ */
.tabs{
  display:flex;gap:4px;background:var(--surface2);padding:4px;
  border-radius:var(--r2);margin-bottom:14px;overflow-x:auto;border:1px solid var(--line);
}
.tabs button{padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:600;color:var(--text2);transition:var(--t);white-space:nowrap}
.tabs button:hover{color:var(--text);background:var(--surface)}
.tabs button.on{background:var(--grad);color:#fff;font-weight:700;box-shadow:0 2px 10px rgba(99,102,241,0.35)}
.tabs .cnt{margin-inline-start:6px;font-size:10px;background:var(--line2);color:var(--muted);padding:1px 6px;border-radius:99px}

/* ══ CHAT VIEW FULL LAYOUT ══ */
.cmain{
  display:flex;flex-direction:column;height:calc(100dvh - var(--head) - var(--tab) - var(--safe));
  margin:-16px;overflow:hidden;position:relative;
}
@media(min-width:961px){.cmain{height:calc(100dvh - var(--head) - var(--safe) - 24px);margin:0;border-radius:var(--r);border:1px solid var(--glass-border)}}
.cbar{
  height:48px;display:flex;align-items:center;gap:8px;padding:0 12px;
  background:var(--bg2);backdrop-filter:blur(20px);border-bottom:1px solid var(--line);flex-shrink:0;
}
.cbar select#cmodel{
  flex:1;max-width:280px;padding:7px 12px;border-radius:10px;
  background:var(--surface);border:1px solid var(--line2);
  color:var(--text);font-size:13px;font-weight:600;
  outline:none;cursor:pointer;
}
.cbar select#cmodel:focus{border-color:var(--acc);box-shadow:0 0 0 2px var(--acc-soft)}
.cwrap{display:flex;flex:1;overflow:hidden;position:relative}
.cside{
  width:260px;background:rgba(9,13,24,0.95);backdrop-filter:blur(20px);
  border-inline-end:1px solid var(--line);display:flex;flex-direction:column;flex-shrink:0;
}
@media(max-width:768px){
  .cside{position:absolute;inset-block:0;inset-inline-start:0;z-index:45;transform:translateX(-105%);transition:transform var(--t-spring)}
  html[dir="rtl"] .cside{transform:translateX(105%)}
  .cside.mob{transform:translateX(0)!important}
}
.cscrim{display:none;position:absolute;inset:0;background:rgba(0,0,0,0.6);z-index:40}
.cscrim.on{display:block}
.cside-h{padding:10px;border-bottom:1px solid var(--line)}
.cside-l{flex:1;overflow-y:auto;padding:6px}
.citem{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;margin-bottom:2px;cursor:pointer;transition:var(--t);color:var(--text2)}
.citem:hover{background:rgba(255,255,255,0.04);color:var(--text)}
.citem.on{background:var(--acc-soft);color:#fff;border:1px solid var(--acc-line)}
.citem .t{font-size:13px;font-weight:650;max-width:170px}
.citem .s{font-size:11px;color:var(--muted);max-width:170px}
.citem .cmore{opacity:0.5;padding:2px 6px;border-radius:4px}
.citem:hover .cmore{opacity:1}
.cbody{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
.msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;-webkit-overflow-scrolling:touch}
.msg{display:flex;gap:10px;max-width:88%;animation:msgIn 0.2s ease}
@keyframes msgIn{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}
.msg.u{align-self:flex-end;flex-direction:row-reverse}
.msg.a{align-self:flex-start}
.msg-av{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:13px;color:#fff;background:var(--grad);flex-shrink:0}
.msg.u .msg-av{background:var(--surface3);border:1px solid var(--line2)}
.bub{padding:10px 14px;border-radius:16px;font-size:13.5px;line-height:1.6;position:relative}
.msg.u .bub{background:var(--grad);color:#fff;border-bottom-right-radius:4px}
html[dir="rtl"] .msg.u .bub{border-bottom-right-radius:16px;border-bottom-left-radius:4px}
.msg.a .bub{background:var(--surface2);color:var(--text);border:1px solid var(--glass-border);border-bottom-left-radius:4px}
html[dir="rtl"] .msg.a .bub{border-bottom-left-radius:16px;border-bottom-right-radius:4px}
.mmeta{display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--muted);margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap}
.comp{padding:10px 14px;background:rgba(10,14,26,0.92);backdrop-filter:blur(20px);border-top:1px solid var(--line);flex-shrink:0}
.comp-in{display:flex;align-items:flex-end;gap:8px;background:rgba(255,255,255,0.04);border:1px solid var(--line2);border-radius:16px;padding:4px 8px 4px 12px}
.comp-in textarea#cinput{flex:1;border:none;background:transparent;color:var(--text);font-size:13.5px;resize:none;max-height:120px;padding:6px 0;outline:none;line-height:1.4}
.comp-in button#csend{width:36px;height:36px;border-radius:12px;background:var(--grad);color:#fff;display:grid;place-items:center;flex-shrink:0;border:none;cursor:pointer;box-shadow:0 2px 10px rgba(99,102,241,0.4)}
.comp-hint{font-size:10.5px;color:var(--muted);margin-top:4px;text-align:center}

/* ══ BOTTOM TAB BAR ══ */
.tabbar{
  position:fixed;inset-inline:0;bottom:0;height:calc(var(--tab) + var(--safe));
  padding-bottom:var(--safe);background:rgba(9, 13, 24, 0.92);
  backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  border-top:1px solid var(--glass-border);display:flex;align-items:center;justify-content:space-around;z-index:50;
}
@media(min-width:961px){.tabbar{display:none}}
.tabi,.tabbar a{
  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3px;height:100%;color:var(--muted);font-size:11px;font-weight:600;transition:all var(--t);position:relative;
}
.tabi.on,.tabbar a.on{color:var(--acc);font-weight:750}
.tabi i,.tabbar a i{font-style:normal;font-size:19px;line-height:1}
.tabi.on i,.tabbar a.on i{transform:translateY(-2px);filter:drop-shadow(0 2px 8px rgba(124,140,255,0.6))}
.tabi.on::after,.tabbar a.on::after{content:"";position:absolute;top:0;width:32px;height:3px;background:var(--grad);border-radius:0 0 4px 4px;box-shadow:0 2px 8px var(--acc)}

/* ══ SHEETS & MODALS ══ */
.mask,.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:100;animation:fadeIn .2s ease}
.sheet,.modal-sheet{
  position:fixed;bottom:0;inset-inline:0;max-height:85vh;background:rgba(14,19,34,0.98);
  backdrop-filter:blur(30px);border:1px solid var(--glass-border);border-radius:24px 24px 0 0;
  padding:18px;z-index:101;overflow-y:auto;box-shadow:var(--sh2);display:flex;flex-direction:column;animation:slideUp .25s var(--t-spring);
}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@media(min-width:640px){.sheet,.modal-sheet{width:480px;inset-inline:auto;left:50%;transform:translateX(-50%);border-radius:24px;bottom:auto;top:50%;transform:translate(-50%, -50%)}}
.sheet-handle{width:36px;height:4px;border-radius:99px;background:rgba(255,255,255,0.18);margin:0 auto 12px;flex-shrink:0}
.flex-between{display:flex;align-items:center;justify-content:space-between}
.flex-1{flex:1;min-width:0}
.text-truncate{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cursor-pointer{cursor:pointer}
.border-b{border-bottom:1px solid var(--line)}
.py-2{padding-top:8px;padding-bottom:8px}
.p-3{padding:12px}
.text-xs{font-size:11.5px}
.text-sm{font-size:13.5px}
.text-muted{color:var(--muted)}
.font-mono{font-family:var(--mono)}
.font-bold{font-weight:750}
.loading-box{
  display:flex;align-items:center;justify-content:center;gap:12px;
  padding:36px 16px;color:var(--text2);font-weight:600;font-size:13.5px;
}
.skeleton{
  background:linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
  background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:var(--r2);
}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* ══ TABLES, EMPTY, TOAST ══ */
.tblw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r2);background:var(--surface)}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{padding:10px 12px;text-align:start;color:var(--muted);font-size:11.5px;font-weight:700;border-bottom:1px solid var(--line2);background:rgba(255,255,255,0.02)}
.tbl td{padding:10px 12px;border-bottom:1px solid var(--line);color:var(--text)}
.tbl tr:hover td{background:rgba(255,255,255,0.03)}
.empty{text-align:center;padding:32px 16px;color:var(--muted)}
.ei{font-size:32px;margin-bottom:8px;opacity:0.6;display:block}
.et{font-weight:750;font-size:15px;color:var(--text);margin-bottom:4px}
.es{font-size:12px;margin-bottom:14px;max-width:380px;margin-inline:auto;line-height:1.5}
.note{padding:10px 12px;border-radius:var(--r2);font-size:12.5px;line-height:1.5;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start;background:var(--acc-soft);border:1px solid var(--acc-line);color:var(--text)}
.note.warn{background:var(--warn-soft);border-color:rgba(245,158,11,0.3)}
.note.err{background:var(--bad-soft);border-color:rgba(244,63,94,0.3)}
.toasts{position:fixed;top:calc(var(--safet) + 12px);inset-inline:16px;z-index:999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.tst{padding:10px 14px;border-radius:var(--r2);background:rgba(16,22,40,0.95);backdrop-filter:blur(20px);border:1px solid var(--glass-border);box-shadow:var(--sh2);display:flex;align-items:center;gap:8px;pointer-events:auto;font-size:13px;font-weight:650;animation:msgIn 0.25s ease;color:var(--text)}
.tst.ok{border-color:rgba(16,185,129,0.4)}.tst.err{border-color:rgba(244,63,94,0.4)}.tst.warn{border-color:rgba(245,158,11,0.4)}
.tst i{font-style:normal;font-weight:800}
.toast-copy{flex:1;min-width:0;overflow-wrap:anywhere}
.toast-close{display:grid;place-items:center;flex-shrink:0;width:32px;height:32px;margin-inline-start:auto;border:0;border-radius:8px;background:transparent;color:var(--text2);font:22px/1 sans-serif;cursor:pointer}
.toast-close:hover{background:var(--acc-soft);color:var(--text)}
.toast-close:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.tst.out{opacity:0;transform:translateY(-10px);transition:all 0.25s ease}
.spin,.sp8{width:16px;height:16px;border:2px solid rgba(255,255,255,0.15);border-top-color:var(--acc);border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}

/* ══ BOOT / SPLASH SCREEN ══ */
.boot{
  position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:16px;background:var(--bg);z-index:1000;padding:24px;text-align:center;
}
.boot-glow{
  position:absolute;width:280px;height:280px;border-radius:50%;
  background:radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 70%);
  filter:blur(40px);pointer-events:none;animation:bootGlow 3s ease-in-out infinite alternate;
}
@keyframes bootGlow{0%{transform:scale(0.85);opacity:0.5}100%{transform:scale(1.2);opacity:1}}
.boot-logo{
  position:relative;width:76px;height:76px;border-radius:24px;background:var(--grad);
  display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:900;color:#fff;
  box-shadow:0 12px 36px -6px rgba(99, 102, 241, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.4);
  animation:bootPulse 2.4s ease-in-out infinite;
}
@keyframes bootPulse{
  0%,100%{transform:translateY(0);box-shadow:0 12px 36px -6px rgba(99, 102, 241, 0.5)}
  50%{transform:translateY(-5px);box-shadow:0 20px 48px -4px rgba(160, 107, 255, 0.7)}
}
.boot-t{
  font-size:22px;font-weight:800;letter-spacing:2px;
  background:linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
}
.boot-sub{font-size:12.5px;color:var(--muted);max-width:280px;line-height:1.6;transition:all 0.3s ease}
.boot-bar{width:160px;height:4px;border-radius:99px;background:rgba(255, 255, 255, 0.08);overflow:hidden;position:relative}
.boot-bar::after{
  content:"";position:absolute;inset-block:0;width:45%;border-radius:99px;
  background:var(--grad);animation:bootBar 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes bootBar{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
html[dir="rtl"] @keyframes bootBar{0%{transform:translateX(100%)}100%{transform:translateX(-260%)}}

/* ══ SEGMENTED SELECTOR & FORM HELPERS ══ */
.seg-btn{
  flex:1;min-width:70px;padding:8px 12px;border-radius:8px;font-size:12.5px;font-weight:600;
  color:var(--text2);background:transparent;border:0;cursor:pointer;transition:all 0.18s ease;text-align:center;
}
.seg-btn:hover{color:#fff;background:rgba(255,255,255,0.06)}
.seg-btn.on{background:var(--grad);color:#fff;font-weight:750;box-shadow:0 2px 10px rgba(99,102,241,0.35)}
/* English layouts use logical alignment; content keeps its own direction. */
.language-toggle{font:700 11px/1 var(--font);min-width:30px}
html[dir="ltr"] .head-back svg{transform:rotate(180deg)}
html[dir="ltr"] .model-trigger-copy,html[dir="ltr"] .model-trigger-copy>bdi,
html[dir="ltr"] .model-option-name,html[dir="ltr"] .model-option-id{text-align:left}
html[dir="ltr"] .model-picker-search input{direction:ltr}
html[dir="ltr"] .workspace-choice-search input{direction:ltr}
html[dir="ltr"] .tool-arrow{left:auto;right:16px}
html[dir="ltr"] .carry-icon{left:auto;right:25px}
html[dir="ltr"] .hero-models button svg,html[dir="ltr"] .studio-send svg,
html[dir="ltr"] .tool-arrow svg,html[dir="ltr"] .recent-chat>svg,
html[dir="ltr"] .carry-card button svg{transform:rotate(180deg)}
html[dir="ltr"] input:not([dir]),html[dir="ltr"] textarea:not([dir]){direction:ltr;text-align:start}
html[dir="ltr"] select.select{background-position:right 12px center}
@media(max-width:400px){.head-actions{gap:2px}.head-actions .btn-icon{width:30px;min-width:30px}.head-t .sub{max-width:145px}}
select.select{
  appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%237d8ba7' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:left 12px center;padding-inline-end:36px;
}
html[dir="rtl"] select.select{background-position:left 12px center}
`;
  return base + tokensCss() + lightThemeCss() + KIT_CSS + PERSONAL_CSS + MODEL_PICKER_CSS + WORKSPACE_CSS + a11yCss();
})();

