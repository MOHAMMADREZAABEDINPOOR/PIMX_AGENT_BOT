// ─────────────────────────────────────────────
// 🧱 PIMXAGENT UI Kit — CSS
// لایه دوم طراحی: کامپوننتهای مشترک + بازپرداخت بصری کلاسهای موجود.
// بعد از CSS قدیمی تزریق میشود، پس قواعدش اولویت دارد.
// ══ بخش ۱: Header / Card / KPI / Progress ══
// ─────────────────────────────────────────────
export const KIT_CSS = `
/* ══ PAGE HEADER ═══════════════════════════ */
.ph{align-items:flex-start;gap:var(--px-s4);padding-bottom:var(--px-s4);margin-bottom:var(--px-s4);border-bottom:1px solid var(--px-line)}
.ph-t h2{font-size:19px;font-weight:800;letter-spacing:-.35px;line-height:1.25}
.ph-t p{font-size:12.5px;color:var(--px-muted);margin-top:3px;line-height:1.5}
.ph-a{gap:var(--px-s2)}
.px-kicker{font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--px-acc);margin-bottom:6px}

/* ══ SECTION HEADER ════════════════════════ */
.px-sec{display:flex;align-items:center;gap:var(--px-s3);margin:var(--px-s5) 0 var(--px-s3)}
.px-sec-t{flex:1;min-width:0}
.px-sec-t b{display:block;font-size:13.5px;font-weight:750;letter-spacing:-.1px}
.px-sec-t span{display:block;font-size:11.5px;color:var(--px-muted);margin-top:1px}
.px-sec-i{width:26px;height:26px;border-radius:var(--px-r-xs);display:grid;place-items:center;background:var(--px-acc-soft);border:1px solid var(--px-line-acc);color:var(--px-acc);font-size:13px;flex-shrink:0}
.px-sec-a{display:flex;align-items:center;gap:6px;flex-shrink:0}
.px-sec-x{font-size:11.5px;color:var(--px-muted);font-family:var(--px-mono);background:rgba(255,255,255,.04);border:1px solid var(--px-line);padding:1px 8px;border-radius:var(--px-r-pill)}

/* ══ CARDS ═════════════════════════════════ */
.card{
  background:linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,0)) , var(--px-surface);
  border:1px solid var(--px-line);border-radius:var(--px-r-lg);
  padding:var(--px-s5);box-shadow:none;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  transition:border-color var(--px-d) var(--px-ease), transform var(--px-d) var(--px-ease);
}
.card:hover{border-color:var(--px-line-2)}
.card-glow{display:none}
.card.flat{background:var(--px-surface);border-color:var(--px-line);box-shadow:none}
.card.tone-acc{border-color:var(--px-line-acc);background:linear-gradient(180deg,var(--px-acc-soft),transparent 60%),var(--px-surface)}
.card.tone-ok{border-color:rgba(18,185,129,.3)}
.card.tone-warn{border-color:rgba(240,160,32,.3)}
.card.tone-bad{border-color:rgba(244,63,94,.32)}
.card-h{margin-bottom:var(--px-s4)}
.card-h h3,.card-t{font-size:14.5px;font-weight:750}
.card-t i{font-style:normal;color:var(--px-acc);font-size:14px}
.card-sub{max-width:52ch;line-height:1.45}
.card-b{padding:0}
.card-f{padding-top:var(--px-s3);margin-top:var(--px-s3);border-top:1px solid var(--px-line)}

/* ══ KPI / STATS ═══════════════════════════ */
.g.g4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--px-s3)}
@media(min-width:860px){.g.g4{grid-template-columns:repeat(4,minmax(0,1fr))}}
.stat,.stat-box{
  border-radius:var(--px-r-md);padding:var(--px-s3) var(--px-s4);min-height:86px;
  background:var(--px-surface);border:1px solid var(--px-line);
  display:flex;flex-direction:column;gap:2px;justify-content:center;position:relative;overflow:hidden;
}
.stat:hover,.stat-box:hover{border-color:var(--px-line-2);transform:translateY(-1px)}
.sl,.stat-box .lbl{font-size:11px;font-weight:650;color:var(--px-muted);letter-spacing:.2px;margin-bottom:2px}
.stat-box .lbl i{font-style:normal;opacity:.6;font-size:12px}
.sv,.sv.num,.stat-box .val{font-size:21px;font-weight:800;font-family:var(--px-mono);letter-spacing:-.5px;line-height:1.15;font-variant-numeric:tabular-nums}
.sd,.stat-box .trend{font-size:11px;font-weight:600;color:var(--px-muted);margin-top:3px;display:flex;align-items:center;gap:5px}
.stat-box.acc{background:linear-gradient(180deg,var(--px-acc-soft),transparent 70%),var(--px-surface);border-color:var(--px-line-acc)}
.stat-box.acc .sv{color:var(--px-acc)}
.stat-box.on{cursor:pointer}
.stat-box .spark{position:absolute;inset-inline:0;bottom:0;opacity:.5;height:26px;pointer-events:none}
.px-metric{display:flex;align-items:baseline;gap:6px}
.px-metric b{font-family:var(--px-mono);font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}
.px-metric span{font-size:11px;color:var(--px-muted)}

/* ══ METER / PROGRESS ══════════════════════ */
.px-meter{height:5px;border-radius:var(--px-r-pill);background:rgba(255,255,255,.07);overflow:hidden;margin-top:6px}
.px-meter>i{display:block;height:100%;border-radius:var(--px-r-pill);background:var(--grad);transition:width var(--px-d-slow) var(--px-ease)}
.px-meter.ok>i{background:linear-gradient(90deg,var(--px-ok),#34d399)}
.px-meter.warn>i{background:linear-gradient(90deg,var(--px-warn),#fbbf24)}
.px-meter.bad>i{background:linear-gradient(90deg,var(--px-bad),#fb7185)}
.px-bar-row{margin-bottom:var(--px-s3)}
.px-bar-lbl{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px;color:var(--px-text-2)}
.px-bar-lbl b{font-family:var(--px-mono);color:var(--px-text);font-variant-numeric:tabular-nums}
.px-ring{position:relative;display:inline-grid;place-items:center;flex-shrink:0}
.px-ring svg{transform:rotate(-90deg)}
.px-ring circle{fill:none;stroke-width:5;stroke-linecap:round}
.px-ring .trk{stroke:rgba(255,255,255,.08)}
.px-ring .val{stroke:var(--px-acc);transition:stroke-dashoffset var(--px-d-slow) var(--px-ease)}
.px-ring-t{position:absolute;font-size:11.5px;font-weight:800;font-family:var(--px-mono)}

/* ══ BUTTONS ═══════════════════════════════ */
.btn{border-radius:var(--px-r-sm);padding:8px 14px;font-size:12.5px;font-weight:650;gap:7px;border:1px solid transparent}
.btn:active{transform:scale(.975)}
.btn.pri,.btn-primary{background:var(--px-acc);color:#fff;box-shadow:0 2px 10px -2px rgba(99,102,241,.5)}
.btn.pri:hover,.btn-primary:hover{background:#8b96ff}
.btn.sec,.btn.gho,.btn-secondary{background:rgba(255,255,255,.045);border-color:var(--px-line);color:var(--px-text)}
.btn.sec:hover,.btn.gho:hover{background:rgba(255,255,255,.08);border-color:var(--px-line-2)}
.btn.dan,.btn-danger{background:var(--px-bad-soft);color:var(--px-bad);border-color:rgba(244,63,94,.28)}
.btn.dan:hover{background:rgba(244,63,94,.2)}
.btn.ok{background:var(--px-ok-soft);color:var(--px-ok);border-color:rgba(18,185,129,.28)}
.btn.sm,.btn-sm{padding:5px 10px;font-size:11.5px;border-radius:var(--px-r-xs)}
.btn.lg{padding:11px 18px;font-size:13.5px}
.btn.blk{width:100%;justify-content:center}
.btn[disabled],.btn.dis{opacity:.5;pointer-events:none}
.px-actions{display:flex;flex-wrap:wrap;gap:var(--px-s2);align-items:center}
.px-actions.end{justify-content:flex-end}
.px-actions.between{justify-content:space-between}
.px-fab{position:fixed;inset-inline-end:var(--px-s4);bottom:calc(var(--px-tab) + var(--safe) + 14px);width:48px;height:48px;border-radius:var(--px-r-lg);background:var(--px-acc);color:#fff;display:grid;place-items:center;font-size:20px;box-shadow:var(--px-e3);z-index:60}
@media(min-width:961px){.px-fab{bottom:calc(var(--safe) + 20px)}}

/* ══ BADGES & CHIPS ════════════════════════ */
.bdg,.badge{border-radius:var(--px-r-xs);padding:2px 7px;font-size:10.5px;font-weight:700;gap:4px;line-height:1.5;background:rgba(255,255,255,.05);border:1px solid var(--px-line);color:var(--px-text-2)}
.bdg.ok{background:var(--px-ok-soft);color:var(--px-ok);border-color:rgba(18,185,129,.26)}
.bdg.err,.bdg.bad{background:var(--px-bad-soft);color:var(--px-bad);border-color:rgba(244,63,94,.26)}
.bdg.warn{background:var(--px-warn-soft);color:var(--px-warn);border-color:rgba(240,160,32,.26)}
.bdg.info{background:var(--px-info-soft);color:var(--px-info);border-color:rgba(14,165,233,.26)}
.bdg.acc{background:var(--px-acc-soft);color:var(--px-acc);border-color:var(--px-line-acc)}
.bdg.mut{color:var(--px-muted)}
.bdg.model{background:var(--px-acc-soft);color:var(--px-acc);border-color:var(--px-line-acc);font-family:var(--px-mono);font-size:10px}
.bdg.prov{background:rgba(255,255,255,.05);color:var(--px-text-2);font-family:var(--px-mono);font-size:10px}
.bdg.cap{background:rgba(255,255,255,.04);color:var(--px-muted);font-weight:600}
.bdg.free{background:var(--px-ok-soft);color:var(--px-ok);border-color:rgba(18,185,129,.26)}
.dot{width:6px;height:6px;box-shadow:none!important}
.dot.ok{background:var(--px-ok)}.dot.err{background:var(--px-bad)}.dot.warn{background:var(--px-warn)}.dot.mut{background:var(--px-dim)}
.chip{border-radius:var(--px-r-sm);padding:6px 11px;font-size:11.5px;font-weight:600;gap:6px}
.chip.on{background:var(--px-acc-soft)!important;border-color:var(--px-acc)!important;color:var(--px-text)!important;box-shadow:none!important}
.px-chips{display:flex;gap:var(--px-s2);overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.px-chips::-webkit-scrollbar{display:none}

/* ══ LISTS & ROWS ══════════════════════════ */
.lst{gap:2px}
.li{border-radius:var(--px-r-sm);padding:9px 10px;gap:var(--px-s3);border:1px solid transparent}
.li.clk:hover{background:rgba(255,255,255,.045);border-color:var(--px-line)}
.li.clk:active{background:rgba(255,255,255,.07)}
.li-i{width:32px;height:32px;border-radius:var(--px-r-xs);font-size:14px;background:rgba(255,255,255,.045);border:1px solid var(--px-line);color:var(--px-text-2)}
.li-t{font-size:13px;font-weight:650;line-height:1.35}
.li-s{font-size:11px;color:var(--px-muted);line-height:1.45;margin-top:2px}
.li-e{font-size:11.5px}
.li.tone-bad .li-i{background:var(--px-bad-soft);border-color:rgba(244,63,94,.25);color:var(--px-bad)}
.li.tone-warn .li-i{background:var(--px-warn-soft);border-color:rgba(240,160,32,.25);color:var(--px-warn)}
.li.tone-ok .li-i{background:var(--px-ok-soft);border-color:rgba(18,185,129,.25);color:var(--px-ok)}
.chev{color:var(--px-dim);font-size:15px;flex-shrink:0}
.px-rows{border:1px solid var(--px-line);border-radius:var(--px-r-md);overflow:hidden;background:var(--px-surface)}
.px-row{display:flex;align-items:center;gap:var(--px-s3);padding:9px 12px;border-bottom:1px solid var(--px-line);font-size:12.5px}
.px-row:last-child{border-bottom:0}
.px-row.clk{cursor:pointer}
.px-row.clk:hover{background:rgba(255,255,255,.035)}
.px-row-k{color:var(--px-muted);flex-shrink:0;min-width:96px}
.px-row-v{flex:1;min-width:0;text-align:end;font-family:var(--px-mono);font-size:12px;word-break:break-word}
.kv{border-bottom:1px solid var(--px-line)}
.kv span{font-size:11.5px}

/* ══ STATES: EMPTY / LOADING / ERROR / ALERT ═ */
.px-state{display:flex;flex-direction:column;align-items:center;text-align:center;padding:var(--px-s6) var(--px-s4);gap:6px}
.px-state-i{width:52px;height:52px;border-radius:var(--px-r-lg);display:grid;place-items:center;font-size:23px;background:rgba(255,255,255,.04);border:1px solid var(--px-line);color:var(--px-muted);margin-bottom:4px}
.px-state-t{font-size:14.5px;font-weight:750;color:var(--px-text)}
.px-state-s{font-size:12.5px;color:var(--px-muted);max-width:340px;line-height:1.6}
.px-state-a{display:flex;flex-wrap:wrap;gap:var(--px-s2);justify-content:center;margin-top:var(--px-s3)}
.px-state.bad .px-state-i{background:var(--px-bad-soft);border-color:rgba(244,63,94,.25);color:var(--px-bad)}
.px-state.warn .px-state-i{background:var(--px-warn-soft);border-color:rgba(240,160,32,.25);color:var(--px-warn)}
.empty{padding:var(--px-s6) var(--px-s4);color:var(--px-muted)}
.ei{font-size:30px;opacity:.75;margin-bottom:10px}
.et{font-size:14.5px;font-weight:750;color:var(--px-text)}
.es{font-size:12.5px;line-height:1.6;margin-top:5px}
.px-alert{display:flex;gap:var(--px-s3);align-items:flex-start;padding:11px 13px;border-radius:var(--px-r-md);font-size:12.5px;line-height:1.55;border:1px solid var(--px-line-acc);background:var(--px-acc-soft);color:var(--px-text)}
.px-alert>i{font-style:normal;font-size:15px;flex-shrink:0;line-height:1.4}
.px-alert b{display:block;font-size:12.5px;font-weight:750;margin-bottom:2px}
.px-alert.ok{border-color:rgba(18,185,129,.28);background:var(--px-ok-soft)}
.px-alert.ok>i{color:var(--px-ok)}
.px-alert.warn{border-color:rgba(240,160,32,.28);background:var(--px-warn-soft)}
.px-alert.warn>i{color:var(--px-warn)}
.px-alert.bad{border-color:rgba(244,63,94,.28);background:var(--px-bad-soft)}
.px-alert.bad>i{color:var(--px-bad)}
.px-alert.acc>i{color:var(--px-acc)}
.px-alert-a{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.loading-box{padding:var(--px-s6) var(--px-s4);gap:10px;font-size:12.5px;color:var(--px-muted);flex-direction:column}
.spin,.sp8{border-width:2px;border-color:rgba(255,255,255,.12);border-top-color:var(--px-acc);width:18px;height:18px}
.skeleton{background:linear-gradient(90deg,rgba(255,255,255,.035) 25%,rgba(255,255,255,.075) 50%,rgba(255,255,255,.035) 75%);background-size:200% 100%;border-radius:var(--px-r-xs)}
.px-skel-card{border:1px solid var(--px-line);border-radius:var(--px-r-lg);padding:var(--px-s4);background:var(--px-surface);margin-bottom:var(--px-s3)}
.px-dots{display:inline-flex;gap:3px}
.px-dots i{width:5px;height:5px;border-radius:50%;background:var(--px-acc);animation:pxPulse 1.1s infinite ease-in-out}
.px-dots i:nth-child(2){animation-delay:.15s}.px-dots i:nth-child(3){animation-delay:.3s}
.px-prog{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--px-text-2)}
@keyframes pxPulse{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}

/* ══ TIMELINE / AGENT STEPS ════════════════ */
.px-tl{position:relative;padding-inline-start:22px;margin:var(--px-s3) 0}
.px-tl::before{content:"";position:absolute;inset-inline-start:7px;top:8px;bottom:8px;width:2px;background:var(--px-line);border-radius:2px}
.px-step{position:relative;padding:5px 0;font-size:12.5px;color:var(--px-muted);display:flex;gap:8px;align-items:flex-start}
.px-step::before{content:"";position:absolute;inset-inline-start:-20px;top:10px;width:10px;height:10px;border-radius:50%;background:var(--px-bg);border:2px solid var(--px-dim);box-sizing:border-box}
.px-step.done{color:var(--px-text-2)}
.px-step.done::before{background:var(--px-ok);border-color:var(--px-ok)}
.px-step.run{color:var(--px-text)}
.px-step.run::before{background:var(--px-acc);border-color:var(--px-acc);box-shadow:0 0 0 3px var(--px-acc-soft);animation:pxPulse 1.4s infinite}
.px-step.err::before{background:var(--px-bad);border-color:var(--px-bad)}
.px-step .px-step-m{margin-inline-start:auto;font-size:10.5px;font-family:var(--px-mono);color:var(--px-dim)}

/* ══ SOURCES / QUOTE / LINK ════════════════ */
.px-srcs{display:flex;flex-direction:column;gap:6px}
.px-src{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border:1px solid var(--px-line);border-radius:var(--px-r-sm);background:rgba(255,255,255,.02);font-size:12px;transition:border-color var(--px-d-fast) var(--px-ease)}
.px-src:hover{border-color:var(--px-line-2)}
.px-src-n{width:20px;height:20px;border-radius:6px;background:var(--px-acc-soft);color:var(--px-acc);display:grid;place-items:center;font-size:10.5px;font-weight:800;flex-shrink:0}
.px-src-a{flex:1;min-width:0}
.px-src-a b{display:block;font-weight:650;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.px-src-a span{display:block;font-size:10.5px;color:var(--px-dim);font-family:var(--px-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.px-quote{border-inline-start:3px solid var(--px-acc);background:rgba(255,255,255,.025);padding:9px 12px;border-radius:0 var(--px-r-sm) var(--px-r-sm) 0;font-size:12.5px;line-height:1.65;color:var(--px-text-2)}
.px-link{display:inline-flex;align-items:center;gap:5px;color:var(--px-acc);font-size:12px;font-weight:600;border-bottom:1px solid transparent}
.px-link:hover{border-bottom-color:var(--px-acc)}

/* ══ ACTIVITY FEED ═════════════════════════ */
.px-feed{display:flex;flex-direction:column}
.px-act{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--px-line);font-size:12.5px}
.px-act:last-child{border-bottom:0}
.px-act-i{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:12px;background:rgba(255,255,255,.04);border:1px solid var(--px-line);flex-shrink:0}
.px-act-b{flex:1;min-width:0}
.px-act-b b{font-weight:650}
.px-act-t{font-size:10.5px;color:var(--px-dim);margin-top:1px;font-family:var(--px-mono)}

/* ══ TABLES ════════════════════════════════ */
.tblw{border-radius:var(--px-r-md);background:var(--px-surface)}
.tbl{font-size:12.5px}
.tbl th{padding:9px 12px;font-size:10.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--px-muted);background:rgba(255,255,255,.02)}
.tbl td{padding:9px 12px}
.tbl tbody tr:last-child td{border-bottom:0}

/* ══ TOOLBAR / TABS / SEGMENTED ════════════ */
.px-toolbar{display:flex;align-items:center;gap:var(--px-s2);flex-wrap:wrap;margin-bottom:var(--px-s4)}
.px-search{flex:1;min-width:170px;display:flex;align-items:center;gap:8px;padding:0 11px;height:38px;border-radius:var(--px-r-sm);background:var(--px-surface);border:1px solid var(--px-line)}
.px-search:focus-within{border-color:var(--px-acc);box-shadow:0 0 0 3px var(--px-acc-soft)}
.px-search input{flex:1;min-width:0;background:none;border:0;outline:none;font-size:13px;height:100%}
.px-search i{font-style:normal;color:var(--px-dim);font-size:13px}
.tabs{border-radius:var(--px-r-sm);background:rgba(255,255,255,.03);padding:3px;gap:2px;margin-bottom:var(--px-s4)}
.tabs button{border-radius:var(--px-r-xs);padding:6px 11px;font-size:12px}
.tabs button.on{background:rgba(255,255,255,.09);color:var(--px-text);font-weight:700;box-shadow:none}
.seg{border-radius:var(--px-r-sm);padding:3px;gap:2px;background:rgba(255,255,255,.03)}
.seg button,.seg-btn{border-radius:var(--px-r-xs);font-size:12px;padding:6px 10px}
.seg button.on,.seg-btn.on{background:rgba(255,255,255,.09);color:var(--px-text);font-weight:750;box-shadow:none}

/* ══ SHELL: SIDEBAR / TOPBAR / BOTTOM NAV ══ */
.side{background:var(--px-bg-soft);border-inline-end:1px solid var(--px-line);backdrop-filter:blur(20px)}
.side-h{padding:2px 14px 14px;border-bottom:1px solid var(--px-line);gap:10px}
.logo{width:34px;height:34px;border-radius:11px;font-size:14px;box-shadow:none;background:var(--px-acc)}
.side-h .nm{font-size:14px;font-weight:800;letter-spacing:-.2px}
.side-h .tg{font-size:10px;color:var(--px-muted);font-weight:650;letter-spacing:.4px}
.side-s{padding:10px 8px 6px}
.navg{margin-bottom:14px}
.navg-t{font-size:9.5px;letter-spacing:1.1px;color:var(--px-dim);padding:0 10px 7px}
.navi{border-radius:var(--px-r-sm);padding:8px 10px;font-size:13px;font-weight:600;gap:10px;margin-bottom:1px;color:var(--px-text-2)}
.navi:hover{background:rgba(255,255,255,.045);color:var(--px-text)}
.navi.on{background:var(--px-acc-soft);border:1px solid var(--px-line-acc);color:var(--px-text);font-weight:700}
.navi i{font-size:14px;opacity:.7}
.navi.on i{opacity:1;color:var(--px-acc)}
.side-f{padding:10px;border-top:1px solid var(--px-line)}
.uchip{border-radius:var(--px-r-sm);border-color:var(--px-line);background:rgba(255,255,255,.025);padding:7px 9px}
.uav{border-radius:9px;font-size:12px}
.head{height:var(--px-head);background:rgba(6,8,15,.82);border-bottom:1px solid var(--px-line);padding:0 var(--px-s4);gap:8px}
html[data-px-theme="light"] .head{background:rgba(255,255,255,.86)}
.head-t h1,.head-t .h1{font-size:14.5px;font-weight:750;letter-spacing:-.15px}
.head-t .sub,.head-t .hsub{font-size:10.5px;margin-top:1px}
.ibtn,.btn-icon{width:34px;height:34px;border-radius:var(--px-r-sm);background:rgba(255,255,255,.04);border-color:var(--px-line);color:var(--px-text-2)}
.ibtn:hover,.btn-icon:hover{background:rgba(255,255,255,.08);color:var(--px-text)}
.tabbar{height:var(--px-tab);background:rgba(6,8,15,.92);border-top:1px solid var(--px-line);padding-bottom:var(--safe)}
html[data-px-theme="light"] .tabbar{background:rgba(255,255,255,.94)}
.tabi{font-size:9.5px;font-weight:650;color:var(--px-dim);gap:3px}
.tabi i{font-size:18px;font-style:normal}
.tabi.on{color:var(--px-acc)}
.tabi.on::after{display:none}
.main{padding:var(--px-s4) var(--px-s4) calc(var(--px-tab) + var(--safe) + 16px)}

/* ══ SHEET / MODAL / TOAST ═════════════════ */
.mask,.modal-overlay{background:rgba(2,4,10,.7);backdrop-filter:blur(6px)}
.sheet,.modal-sheet{border-radius:var(--px-r-xl) var(--px-r-xl) 0 0;border-color:var(--px-line);background:var(--px-bg-soft);padding:var(--px-s4);box-shadow:var(--px-e4)}
@media(min-width:640px){.sheet,.modal-sheet{border-radius:var(--px-r-xl);border:1px solid var(--px-line);width:460px}}
.sheet-handle{background:rgba(255,255,255,.16);width:34px;height:4px;margin-bottom:var(--px-s3)}
.toasts{inset-inline:var(--px-s4);top:calc(var(--safet) + 10px)}
.tst{border-radius:var(--px-r-sm);padding:9px 13px;font-size:12.5px;font-weight:600;background:var(--px-surface-3);border-color:var(--px-line);box-shadow:var(--px-e3)}
.tst.ok{border-color:rgba(18,185,129,.4)}
.tst.err{border-color:rgba(244,63,94,.4)}
.tst.warn{border-color:rgba(240,160,32,.4)}

/* ══ COMMAND PALETTE ═══════════════════════ */
.px-cmd{padding:0;overflow:hidden;max-width:560px}
.px-cmd-head{display:flex;align-items:center;gap:9px;padding:12px 14px;border-bottom:1px solid var(--px-line)}
.px-cmd-head input{flex:1;min-width:0;background:none;border:0;outline:none;font-size:14px}
.px-cmd-head kbd{font-family:var(--px-mono);font-size:10px;color:var(--px-dim);border:1px solid var(--px-line);border-radius:5px;padding:1px 5px}
.px-cmd-list{max-height:52vh;overflow-y:auto;padding:6px}
.px-cmd-g{font-size:9.5px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:var(--px-dim);padding:9px 10px 5px}
.px-cmd-i{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--px-r-sm);cursor:pointer;font-size:13px}
.px-cmd-i:hover,.px-cmd-i.sel{background:var(--px-acc-soft)}
.px-cmd-i .px-cmd-ic{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:rgba(255,255,255,.045);border:1px solid var(--px-line);font-size:13px;flex-shrink:0}
.px-cmd-i b{font-weight:650;display:block;font-size:12.5px}
.px-cmd-i span{font-size:10.5px;color:var(--px-muted);display:block;margin-top:1px}
.px-cmd-i .px-cmd-x{margin-inline-start:auto;flex-shrink:0}

/* ══ CODE / ENTRANCE ANIMATION ═════════════ */
.code-box{border:1px solid var(--px-line);border-radius:var(--px-r-md);overflow:hidden;background:rgba(0,0,0,.28)}
.code-head{display:flex;align-items:center;justify-content:space-between;padding:7px 11px;border-bottom:1px solid var(--px-line);font-size:10px;letter-spacing:.6px;color:var(--px-muted);font-family:var(--px-mono)}
.code-body{padding:11px;font-family:var(--px-mono);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:340px;overflow:auto}
@keyframes pxIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.px-in{animation:pxIn var(--px-d-slow) var(--px-ease) both}
.px-in-1{animation-delay:.03s}.px-in-2{animation-delay:.06s}.px-in-3{animation-delay:.09s}.px-in-4{animation-delay:.12s}

/* ══ LIGHT THEME FIXES (legacy classes) ═════ */
html[data-px-theme="light"] body::before{opacity:.45}
html[data-px-theme="light"] .side{background:#fff}
html[data-px-theme="light"] .navi:hover,html[data-px-theme="light"] .li.clk:hover,html[data-px-theme="light"] .chip,html[data-px-theme="light"] .btn.sec,html[data-px-theme="light"] .btn.gho,html[data-px-theme="light"] .ibtn,html[data-px-theme="light"] .btn-icon,html[data-px-theme="light"] .px-row.clk:hover,html[data-px-theme="light"] .tabs,html[data-px-theme="light"] .seg,html[data-px-theme="light"] .px-search,html[data-px-theme="light"] .li-i,html[data-px-theme="light"] .px-cmd-ic,html[data-px-theme="light"] .px-act-i,html[data-px-theme="light"] .px-sec-x,html[data-px-theme="light"] .stat-box .lbl i{background:rgba(15,23,42,.035)}
html[data-px-theme="light"] .px-meter{background:rgba(15,23,42,.08)}
html[data-px-theme="light"] .px-quote,html[data-px-theme="light"] .px-src,html[data-px-theme="light"] .px-state-i,html[data-px-theme="light"] .px-rows{background:rgba(15,23,42,.025)}
html[data-px-theme="light"] .fld input,html[data-px-theme="light"] .fld textarea,html[data-px-theme="light"] .fld select,html[data-px-theme="light"] .input,html[data-px-theme="light"] .textarea,html[data-px-theme="light"] .select{background:#fff;color:var(--px-text)}
html[data-px-theme="light"] select,html[data-px-theme="light"] .select,html[data-px-theme="light"] select option{background-color:#fff!important;color:#0f172a!important;color-scheme:light!important}
html[data-px-theme="light"] .code-box{background:rgba(15,23,42,.04)}
html[data-px-theme="light"] .tbl th{background:rgba(15,23,42,.03)}
html[data-px-theme="light"] .card{background:linear-gradient(180deg,rgba(255,255,255,.6),rgba(255,255,255,0)),var(--px-surface)}

/* ══ RESPONSIVE POLISH ═════════════════════ */
@media(max-width:520px){
  :root{--px-head:52px;--px-tab:58px}
  .card{padding:var(--px-s4);border-radius:var(--px-r-md)}
  .ph-t h2{font-size:17px}
  .g.g4{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--px-s2)}
  .stat,.stat-box{padding:10px 12px;min-height:78px}
  .sv,.sv.num,.stat-box .val{font-size:18px}
  .px-cmd-list{max-height:56vh}
  .btn{padding:7px 12px}
}
@media(min-width:1100px){.main{padding:var(--px-s5) var(--px-s6)}}
`;
