import { CSS } from "./css.js";
import { pxTemplate } from '../i18n/server.js';
import { APP_LIB } from "./lib.js";
import { UI_KIT } from "../ui/kit.js";
import { themeInitScript } from "../ui/theme.js";
import { VIEWS_CORE } from "./views-core.js";
import { VIEWS_GATEWAY } from "./views-gateway.js";
import { VIEWS_AGENTS } from "./views-agents.js";
import { VIEWS_OPS } from "./views-ops.js";
import { APP_SHELL } from "./shell.js";
import { VIEW_HOME } from "./views-home.js";
import { VIEWS_POLISH } from "./views-polish.js";
import { VIEWS_PERSONAL } from "./views-personal.js";
import { MODEL_PICKER } from "./model-picker.js";
import { WORKSPACE_JS } from "./workspace.js";
import { APP_I18N } from './i18n.js';

// ترتیب مهم است: Shell قبل از UI Kit میآید تا Kit نسخهٔ ارتقایافتهٔ
// کامپوننتها (Toast/Sheet/Palette/States) را روی همان نامهای عمومی بنشاند.
export const APP_JS = [
  APP_I18N,
  themeInitScript(),
  APP_LIB,
  VIEWS_CORE, VIEWS_GATEWAY, VIEWS_AGENTS, VIEWS_OPS,
  APP_SHELL,
  VIEW_HOME,
  VIEWS_POLISH,
  UI_KIT,
  VIEWS_PERSONAL,
  MODEL_PICKER,
  WORKSPACE_JS
].join("\n");


export function miniAppHtml() {
  return pxTemplate`<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07080c">
<meta name="color-scheme" content="dark light">
<meta name="robots" content="noindex,nofollow">
<title>PIMXAGENT</title>
<link rel="preconnect" href="https://telegram.org">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div id="app">
  <div class="boot">
    <div class="boot-glow"></div>
    <div class="boot-logo">P</div>
    <div class="boot-t">PIMXAGENT</div>
    <div class="px-kicker" style="margin:2px 0 6px">فضای هوشمند تو</div>
    <div class="boot-sub" id="bootMsg">در حال راه‌اندازی و اتصال به پلتفرم هوش مصنوعی…</div>
    <div class="boot-bar"></div>
  </div>
</div>
<script async src="https://telegram.org/js/telegram-web-app.js"></script>
<script>
(function(){
  window.addEventListener("error", function(e){ console.error("[uncaught]", e.message, e.filename + ":" + e.lineno); });
  window.addEventListener("unhandledrejection", function(e){ console.error("[unhandled]", e.reason); });
})();
${APP_JS}
</script>
</body>
</html>`;
}

export function miniAppResponse(request) {
  const html = miniAppHtml();
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    // Short private cache: instant re-open inside Telegram, still fresh after a deploy.
    "Cache-Control": "private, max-age=60, stale-while-revalidate=600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  };
  return new Response(html, { headers });
}
