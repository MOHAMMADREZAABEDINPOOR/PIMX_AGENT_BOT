// ─────────────────────────────────────────────
// 🧪 PIMXAGENT Smoke Test — بدون نیاز به شبکه یا کلید
// اجرا: node tools/smoke.mjs
//  1) اعتبارسنجی syntax باندل Mini App
//  2) یکپارچگی onclick/inline-handlerها
//  3) اعتبارسنجی HTML پیامهای تلگرام + محدودیتهای تلگرام
//  4) امنیت: نبود کلید/توکن در باندل فرانتاند
//  5) Design System: توکنها و کلاسهای UI Kit
// ─────────────────────────────────────────────
import { APP_JS } from "../src/miniapp/index.js";
import { CSS } from "../src/miniapp/css.js";
import { TG, TGM, KB, tgChunks } from "../src/ui/tg.js";

let failures = 0;
const ok = (name) => console.log(`  ✅ ${name}`);
const bad = (name, detail) => { failures++; console.log(`  ❌ ${name}\n     ${detail}`); };
const section = (t) => console.log(`\n${t}`);

/* ── 1) syntax باندل ────────────────────── */
section("۱) اعتبارسنجی باندل Mini App");
try {
  new Function(APP_JS);
  ok(`باندل بدون خطای syntax (${(APP_JS.length / 1024).toFixed(1)} KB)`);
} catch (e) { bad("syntax باندل", e.message); }

/* ── 2) یکپارچگی handlerها ──────────────── */
section("۲) یکپارچگی توابع فراخوانیشده در HTML");
const defined = new Set();
for (const m of APP_JS.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
for (const m of APP_JS.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) defined.add(m[1]);
const BUILTIN = new Set(["event", "this", "String", "Number", "Boolean", "Array", "Object", "JSON", "Math", "Date", "parseInt", "parseFloat", "isNaN", "encodeURIComponent", "decodeURIComponent", "alert", "open", "close", "print", "return", "if", "for", "while", "catch", "function", "typeof", "new", "await", "async", "setTimeout", "clearTimeout", "console", "localStorage", "location", "document", "window", "history", "fetch", "URL", "URLSearchParams", "RegExp", "Promise", "Error", "Set", "Map", "do", "else", "switch", "try"]);
const called = new Set();
for (const m of APP_JS.matchAll(/on(?:click|input|change|submit|keydown)\s*=\\?["']([^"']+)["']/g)) {
  for (const c of m[1].matchAll(/(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(/g)) called.add(c[1]);
}
const missing = [...called].filter(n => !defined.has(n) && !BUILTIN.has(n));
if (missing.length) bad("توابع تعریفنشده در handlerها", missing.join(", "));
else ok(`همهٔ ${called.size} تابع فراخوانیشده تعریف شدهاند`);

/* ── 3) HTML پیامهای تلگرام ─────────────── */
section("۳) اعتبارسنجی پیامهای تلگرام");
const VOID = new Set(["br", "hr", "img"]);
function tagBalance(html) {
  const stack = [];
  for (const m of html.matchAll(/<\/?([a-z-]+)(?:\s[^>]*)?>/gi)) {
    const name = m[1].toLowerCase();
    if (VOID.has(name)) continue;
    if (m[0].startsWith("</")) {
      if (stack.pop() !== name) return `بستن نامنطبق </${name}>`;
    } else if (!m[0].endsWith("/>")) stack.push(name);
  }
  return stack.length ? `تگ باز بدون بستن: <${stack.join("><")}>` : null;
}
const samples = {
  answer: TGM.answer({ body: "متن <تست> & نمونه", model: "gemini-flash", latency: "1.8s", tokens: "120", cost: "$0.0002", sources: [{ title: "منبع", url: "https://example.com" }] }),
  research: TGM.research({ topic: "هوش مصنوعی <X>", summary: "خلاصه", findings: ["یافته ۱", "یافته ۲"], sources: [{ title: "s", url: "https://a.example" }], models: 4, duration: "24.8s" }),
  council: TGM.council({ question: "پرسش", mode: "مناظره", panel: [{ role: "Researcher", model: "m1", tone: "ok" }], consensus: 82, synthesis: "نتیجه", cost: "$0.1", duration: "12s" }),
  agent: TGM.agent({ name: "Research Agent", goal: "هدف", steps: [{ label: "search", state: "done", meta: "1.2s" }], result: "نتیجه", duration: "9s" }),
  wizard: TGM.wizard({ step: 2, total: 4, title: "افزودن پروایدر", hint: "راهنما", current: "x", body: "متن" }),
  list: TGM.listPage({ icon: "▣", title: "لیست", sub: "زیرعنوان", body: "• آیتم", page: 1, pages: 3, total: 25 }),
  error: TGM.error({ title: "خطا", message: "پیام <bad>", reason: "TIMEOUT", hint: "دوباره تلاش کنید", retriable: true }),
  success: TGM.success({ title: "انجام شد", body: "بدنه", id: "wf_82a91", next: "اجرا کنید" }),
  loading: TGM.loading({ title: "پردازش", steps: ["◉ مرحله"], note: "صبر کنید" }),
  empty: TGM.listPage({ title: "خالی", empty: "هیچ موردی نیست" })
};
let tagErrors = 0;
for (const [k, v] of Object.entries(samples)) {
  const err = tagBalance(v);
  if (err) { tagErrors++; bad(`HTML پیام ${k}`, err); }
  if (v.length > TG.MAX_LEN) { tagErrors++; bad(`طول پیام ${k}`, `${v.length} > ${TG.MAX_LEN}`); }
}
if (!tagErrors) ok(`${Object.keys(samples).length} نمونهٔ پیام: تگها متوازن و طول مجاز`);

const inj = TGM.answer({ body: "<script>alert(1)</script>", model: "m" });
if (inj.includes("<script>")) bad("XSS در پیام", "تگ escape نشد");
else ok("escape کردن ورودی کاربر در پیامها");

const kb = KB.raw(KB.merge(KB.nav({ back: "pf:menu", appUrl: "https://x/app" }), KB.grid([KB.btn("بسیار طولانی ".repeat(12), "x".repeat(120))])));
let kbBad = 0;
kb.inline_keyboard.forEach((row, i) => {
  if (row.length > 3) { kbBad++; bad("چیدمان کیبورد", `ردیف ${i} بیش از ۳ دکمه دارد`); }
  row.forEach(b => {
    if (b.callback_data && b.callback_data.length > 64) { kbBad++; bad("callback_data", `> 64 کاراکتر در ردیف ${i}`); }
    if (b.text && b.text.length > 64) { kbBad++; bad("متن دکمه", `> 64 کاراکتر در ردیف ${i}`); }
  });
});
if (!kbBad) ok("چیدمان و طول دکمههای Inline Keyboard");

const chunks = tgChunks("خط\n".repeat(3000));
if (chunks.every(c => c.length <= 3900) && chunks.length > 1) ok(`تکهتکهکردن پیام بلند (${chunks.length} تکه)`);
else bad("تکهتکهکردن پیام بلند", `chunks=${chunks.length}`);

/* ── 4) امنیت فرانت‌اند ─────────────────── */
section("۴) امنیت: عدم لو رفتن Secret در فرانت‌اند");
const SECRET_PATTERNS = [
  [/nvapi-[A-Za-z0-9_-]{10,}/, "NVIDIA API key"],
  [/sk-[A-Za-z0-9]{16,}/, "OpenAI/OpenRouter key"],
  [/AIza[0-9A-Za-z_-]{20,}/, "Google API key"],
  [/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/, "Telegram Bot Token"],
  [/gsk_[A-Za-z0-9]{20,}/, "Groq key"],
  [/qpw[a-zA-Z0-9]{10,}/, "Mistral key"]
];
let leaked = 0;
for (const [re, label] of SECRET_PATTERNS) {
  if (re.test(APP_JS) || re.test(CSS)) { leaked++; bad("Secret در باندل فرانت‌اند", label); }
}
if (!leaked) ok("هیچ کلید/توکنی در JS و CSS فرانت‌اند نیست");

/* ── 5) Design System ───────────────────── */
section("۵) Design System");
const tokenNames = ["--px-bg", "--px-surface", "--px-line", "--px-text", "--px-acc", "--px-ok", "--px-warn", "--px-bad", "--px-r-md", "--px-e2", "--px-s4"];
const missingTokens = tokenNames.filter(t => !CSS.includes(t + ":"));
if (missingTokens.length) bad("توکن‌های گمشده در CSS", missingTokens.join(", "));
else ok(tokenNames.length + " توکن کلیدی در CSS موجود است");
const kitClasses = [".px-state", ".px-alert", ".px-tl", ".px-step", ".px-src", ".px-cmd", ".px-meter", ".px-row", ".px-sec", ".px-kicker"];
const missClass = kitClasses.filter(c => !CSS.includes(c + "{") && !CSS.includes(c + " ") && !CSS.includes(c + ","));
if (missClass.length) bad("کلاس‌های UI Kit در CSS نیستند", missClass.join(", "));
else ok(kitClasses.length + " کلاس کلیدی UI Kit در CSS تعریف شده‌اند");
if (!CSS.includes('html[data-px-theme="light"]')) bad("تم روشن", "استایل light theme یافت نشد");
else ok("تم روشن (light theme) تعریف شده است");
if (!CSS.includes("prefers-reduced-motion")) bad("دسترس‌پذیری", "reduced-motion رعایت نشده");
else ok("احترام به prefers-reduced-motion");
const kitFns = ["card", "stat", "li", "lst", "empty", "errBox", "toast", "sheet", "timeline", "sourceList", "activityFeed", "pageHead", "sectionHead", "progressBar", "ring", "palette", "alertBox"];
const missFns = kitFns.filter(f => !APP_JS.includes("W." + f + " ="));
if (missFns.length) bad("کامپوننت‌های UI Kit ثبت نشده‌اند", missFns.join(", "));
else ok(kitFns.length + " کامپوننت روی window ثبت شده است");

/* ── 6) یکپارچگی Callbackها (کیبوردهای بازطراحیشده) ── */
section("۶) یکپارچگی Callback Buttonها");
import { readFileSync } from "node:fs";
const idxSrc = readFileSync(new URL("../index.js", import.meta.url), "utf8");
const pltSrc = readFileSync(new URL("../src/telegram/platform.js", import.meta.url), "utf8");
const both = idxSrc + "\n" + pltSrc;

// هندلرها: مقایسههای ===، startsWith، case، و اکشنهای pf
const handlers = new Set();
for (const m of both.matchAll(/(?:===|!==|startsWith\()\s*"([^"]+)"/g)) handlers.add(m[1]);
for (const m of both.matchAll(/case\s+"([^"]+)"/g)) handlers.add(m[1]);
for (const m of both.matchAll(/action\s*===\s*"([^"]+)"/g)) handlers.add(m[1]);

const KB_FNS = ["mainMenuKb", "modesKb", "toolsKb", "chatMgmtKb", "settingsKb", "answerKb"];
const orphans = [];
for (const fn of KB_FNS) {
  const re = new RegExp("function " + fn + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}", "g");
  for (const block of idxSrc.matchAll(re)) {
    for (const m of block[0].matchAll(/callback_data:\s*"([^"]+)"/g)) {
      const v = m[1];
      const prefix = v.includes(":") ? v.split(":")[0] : v;
      if (handlers.has(v) || handlers.has(prefix) || handlers.has(prefix + ":")) continue;
      orphans.push(fn + " → " + v);
    }
  }
}
for (const m of pltSrc.matchAll(/callback_data:\s*"pf:([a-zA-Z0-9_-]+)"/g)) {
  if (!handlers.has(m[1])) orphans.push("platformMenuKb → pf:" + m[1]);
}
if (orphans.length) bad("Callback بدون هندلر", orphans.join(" | "));
else ok("همهٔ Callbackهای منوهای بازطراحیشده هندلر دارند");

/* ── 7) Regression: هیچ Command/Route حذف نشده باشد ── */
section("۷) Regression — Commandها و Routeها");
const cmdCount = (idxSrc.match(/case\s+"\//g) || []).length;
const viewsBlock = (APP_JS.match(/const VIEWS = \{[\s\S]*?\n\};/) || [""])[0];
const viewsCount = (viewsBlock.match(/\b[a-z]+:\s*view/g) || []).length;
if (cmdCount < 75) bad("Commandهای ربات", `تعداد caseهای دستور از ۷۵ کمتر شد (${cmdCount})`);
else ok(`${cmdCount} دستور ربات حفظ شده است`);
if (viewsCount < 27) bad("Viewهای Mini App", `تعداد View از ۲۷ کمتر شد (${viewsCount})`);
else ok(`رجیستری روتر سالم است (${viewsCount} View)`);
const NEEDED_VIEWS = ["home", "chat", "council", "playground", "providers", "models", "compare", "routing", "agents", "tools", "memory", "knowledge", "prompts", "projects", "automation", "monitor", "costs", "eval", "alerts", "approvals", "settings", "tenants"];
const missingViews = NEEDED_VIEWS.filter(v => !new RegExp("\\b" + v + ":\\s*view").test(viewsBlock));
if (missingViews.length) bad("Viewهای گمشده", missingViews.join(", "));
else ok(`${NEEDED_VIEWS.length} صفحهٔ اصلی Mini App در روتر موجود است`);
const missingTitles = NEEDED_VIEWS.filter(v => !new RegExp("^\\s{2}" + v + ": \\[", "m").test(APP_JS));
if (missingTitles.length) bad("عنوان صفحه‌های گمشده", missingTitles.join(", "));
else ok("عنوان و زیرعنوان همهٔ صفحه‌ها تعریف شده است");
if (!APP_JS.includes("VIEWS.home = viewHomeV2")) bad("داشبورد جدید", "override داشبورد ثبت نشده");
else ok("داشبورد جدید روی روتر ثبت شده است");

/* ── خلاصه ──────────────────────────────── */
section("—");
if (failures) { console.log("❌ " + failures + " تست ناموفق"); process.exit(1); }
console.log("✅ همهٔ تست‌های Smoke موفق بودند");

