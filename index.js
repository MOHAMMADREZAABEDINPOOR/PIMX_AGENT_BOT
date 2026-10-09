import { pxText, pxTemplate } from './src/i18n/server.js';
import { withLanguage, savedLanguage, saveLanguage, currentLanguage, languageMessages } from './src/i18n/server.js';
import { translateLiteral } from './src/i18n/shared.js';
/**
 * ============================================================
 *  🤖 ربات تلگرام هوش مصنوعی فوق‌پیشرفته — Cloudflare Workers
 *  تک‌فایلی، بدون کتابخانه خارجی، ES Modules
 *
 *  wrangler.toml مورد نیاز:
 *  ------------------------------------------------------------
 *  name = "ai-telegram-bot"
 *  main = "index.js"
 *  compatibility_date = "2024-11-01"
 *
 *  [[kv_namespaces]]
 *  binding = "BOT_KV"
 *  id = "YOUR_KV_NAMESPACE_ID"
 *
 *  [triggers]
 *  crons = ["* * * * *"]
 *  ------------------------------------------------------------
 *  بعد از دیپلوی یک‌بار  GET /setup  را باز کنید تا وبهوک ثبت شود.
 * ============================================================
 */

// ─────────────────────────────────────────────
// 🛰 PIMXAGENT Platform — AI Gateway / Agent Runtime / Mini App
// ماژولهای جدید؛ همهی امکانات قبلی ربات دستنخورده باقی مانده است.
// ─────────────────────────────────────────────
import { initPlatform } from "./src/core/ctx.js";
import { handleApi } from "./src/api/routes.js";
import { miniAppResponse } from "./src/miniapp/index.js";
import {
  handlePlatformCommand, handlePlatformCallback, handlePlatformWizard,
  getPlatformWizard, maybeHandleNaturalOps, handleNaturalOps,
  platformCron, platformMenuKb, PLATFORM_COMMANDS
} from "./src/telegram/platform.js";
import { route as gatewayRoute } from "./src/gateway/router.js";
import { listModels as pfListModels } from "./src/gateway/models.js";
import { trackPlatformUsage } from "./src/ops/monitor.js";
import { extractMemories as pfExtractMemories, extractGraph as pfExtractGraph } from "./src/knowledge/memory.js";
import { seedBuiltins } from "./src/gateway/seed.js";
import { TG, TGM, KB, tgChunks, styleKeyboard } from "./src/ui/tg.js";
import { markdownToTelegram, splitTelegramHtml } from "./src/ui/formatting.js";
import { exportBackup, inspectBackup, restoreBackup, stageRestore, confirmRestore, MAX_BACKUP_BYTES } from "./src/ops/portable-backup.js";
import { kvGet as pfGet, kvPut as pfPut } from "./src/core/kv.js";

// ─────────────────────────────────────────────
// 🔐 پیکربندی امن - استفاده از Cloudflare Secrets
// ─────────────────────────────────────────────
// ⚠️ WARNING: ALL SECRETS MUST BE SET VIA CLOUDFLARE SECRETS
// 
// CRITICAL SECURITY NOTICE:
// The previous hardcoded API keys in this file were EXPOSED and MUST BE REVOKED immediately.
// 
// REQUIRED ACTIONS BEFORE DEPLOYMENT:
// 1. Revoke ALL old keys from their respective providers:
//    - BOT_TOKEN from @BotFather (Telegram)
//    - GEMINI_API_KEYS from Google AI Studio
//    - NVIDIA_KEYS from NVIDIA NIM dashboard
//    - OPENROUTER_API_KEY from openrouter.ai
//    - MISTRAL_API_KEY from console.mistral.ai
// 
// 2. Generate NEW keys from all providers
// 
// 3. Set secrets using wrangler CLI:
//    npx wrangler secret put BOT_TOKEN
//    npx wrangler secret put GEMINI_API_KEYS_JSON
//    npx wrangler secret put NVIDIA_KEYS_JSON
//    npx wrangler secret put OPENROUTER_API_KEY
//    npx wrangler secret put MISTRAL_API_KEY
//    npx wrangler secret put ADMIN_ID
// 
// 4. For GEMINI_API_KEYS_JSON and NVIDIA_KEYS_JSON, paste JSON arrays:
//    Example: ["key1", "key2", "key3"]
// 
// 5. Redeploy: npm run deploy
// ─────────────────────────────────────────────

// These will be populated from environment secrets at runtime
// Fallback values are ONLY for local development with wrangler dev --local
let BOT_TOKEN = null;
let GEMINI_API_KEYS = [];
let NVIDIA_KEYS = [];
let ADMIN_ID = null;
let OPENROUTER_API_KEY = null;
let MISTRAL_API_KEY = null;
let _seedPromise = null;

// Initialize secrets from environment (called in fetch handler)
function initializeSecrets(env) {
  if (!BOT_TOKEN) {
    BOT_TOKEN = env.BOT_TOKEN || null;
    
    // Parse JSON arrays for multi-key configs
    if (env.GEMINI_API_KEYS_JSON) {
      try {
        GEMINI_API_KEYS = JSON.parse(env.GEMINI_API_KEYS_JSON);
      } catch (e) {
        console.error('Failed to parse GEMINI_API_KEYS_JSON:', e);
        GEMINI_API_KEYS = [];
      }
    }
    
    if (env.NVIDIA_KEYS_JSON) {
      try {
        NVIDIA_KEYS = JSON.parse(env.NVIDIA_KEYS_JSON);
      } catch (e) {
        console.error('Failed to parse NVIDIA_KEYS_JSON:', e);
        NVIDIA_KEYS = [];
      }
    }
    
    ADMIN_ID = env.ADMIN_ID ? parseInt(env.ADMIN_ID) : null;
    OPENROUTER_API_KEY = env.OPENROUTER_API_KEY || null;
    MISTRAL_API_KEY = env.MISTRAL_API_KEY || null;
    
    // Validate ONLY critical secrets
    if (!BOT_TOKEN) {
      console.error('❌ CRITICAL: BOT_TOKEN not set in environment secrets!');
      console.error('   Set it with: npx wrangler secret put BOT_TOKEN');
    }
    
    // INFO: Provider keys are optional - users can add them via Mini App
    // No warnings needed for optional providers
  }
}
function loadEnvKeys(env) {
  GLOBAL_ENV = env;
  
  // Initialize all secrets from environment (new secure method)
  initializeSecrets(env);
  
  // Legacy fallback for backwards compatibility during migration
  if (env?.OPENROUTER_API_KEY && !OPENROUTER_API_KEY) OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
  if (env?.MISTRAL_API_KEY && !MISTRAL_API_KEY) MISTRAL_API_KEY = env.MISTRAL_API_KEY;
  
  // ⚠️ IMPORTANT: Update TG_API after BOT_TOKEN is loaded from secrets
  if (BOT_TOKEN) {
    TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
    TG_FILE = `https://api.telegram.org/file/bot${BOT_TOKEN}`;
  }
  
  // تزریق توابع موجود به پلتفرم (بدون تکرار پیادهسازی)
  // SECRET_KEY برای رمزنگاری کلیدهای پروایدر — از BOT_TOKEN بهعنوان مادهٔ رمز استفاده میشود
  const platformEnv = env && typeof env === "object"
    ? new Proxy(env, {
        get(t, p, r) {
          if (p === "BOT_TOKEN" && !t.BOT_TOKEN) return BOT_TOKEN;
          if (p === "SECRET_KEY" && !t.SECRET_KEY) return BOT_TOKEN;
          return Reflect.get(t, p, r);
        }
      })
    : env;
  initPlatform({
    env: platformEnv,
    adminId: ADMIN_ID,
    tg: {
      sendMessage: (chatId, html, kb = null) => sendMessage(chatId, html, kb),
      sendDocument,
      answerCallback: (id, text = "", alert = false) => sendTG("answerCallbackQuery", { callback_query_id: id, text, show_alert: alert }),
      editMessage: async (chatId, msgRes, html, keyboard = null) => {
        const mid = msgRes?.result?.message_id || msgRes?.message_id || (typeof msgRes === "number" ? msgRes : null);
        if (!mid) return sendMessage(chatId, html, keyboard);
        const body = { chat_id: chatId, message_id: mid, text: String(html).slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true };
        if (keyboard) body.reply_markup = keyboard;
        let r = await sendTG("editMessageText", body);
        if (!r.ok) {
          delete body.parse_mode;
          body.text = stripTags(html).slice(0, 4000);
          r = await sendTG("editMessageText", body);
        }
        // اگر ویرایش ممکن نبود (مثلاً پیام خیلی قدیمی) پیام جدید بفرست
        if (!r.ok) return sendMessage(chatId, html, keyboard);
        return r;
      },
      editMessageFull: async (chatId, msgRes, html, keyboard = null) => {
        const mid = msgRes?.result?.message_id || msgRes?.message_id || (typeof msgRes === "number" ? msgRes : null);
        if (!mid) return sendMessage(chatId, html, keyboard);
        const body = { chat_id: chatId, message_id: mid, text: String(html).slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true };
        if (keyboard) body.reply_markup = keyboard;
        let r = await sendTG("editMessageText", body);
        if (!r.ok) {
          delete body.parse_mode;
          body.text = stripTags(html).slice(0, 4000);
          r = await sendTG("editMessageText", body);
        }
        if (!r.ok) return sendMessage(chatId, html, keyboard);
        return r;
      }
    },
    ai: {
      webSearch,
      kbSearch,
      kbAddDocument,
      embed: mistralEmbed,
      callGeminiInline,
      legacyChat: callNvidiaCat
    },
    util: { mdToHtml, escapeHtml, splitMessage }
  });
  // یکبار: seed پروایدر/مدلهای built-in از کلیدهای ربات به رجیستری پلتفرم
  if (!_seedPromise && platformEnv?.BOT_KV) {
    _seedPromise = seedBuiltins(platformEnv, {
      nvidiaKeys: NVIDIA_KEYS,
      openrouterKey: OPENROUTER_API_KEY,
      mistralKey: MISTRAL_API_KEY,
      geminiKeys: GEMINI_API_KEYS
    }).catch(() => null);
  }
}

// آدرس Mini App (روی همان دامنه Worker سرو میشود)
let MINIAPP_URL = "";
function appUrlOf(request) {
  try { return MINIAPP_URL || `https://${new URL(request.url).hostname}/app`; } catch { return MINIAPP_URL; }
}

let TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
let TG_FILE = `https://api.telegram.org/file/bot${BOT_TOKEN}`;
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_EMBED_URL = "https://api.mistral.ai/v1/embeddings";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

// ─────────────────────────────────────────────
// 🌐 نگاشت مدل → پروایدر (معماری چندپروایدری)
// افزودن پروایدر جدید = یک ورودی در PROVIDERS + نگاشت مدل‌ها
// ─────────────────────────────────────────────
const PROVIDERS = {
  nvidia:     { url: () => NVIDIA_URL,     key: () => getNextKey(),        tag: "🟩 NVIDIA" },
  openrouter: { url: () => OPENROUTER_URL, key: () => OPENROUTER_API_KEY,  tag: "🟪 OpenRouter" },
  mistral:    { url: () => MISTRAL_URL,    key: () => MISTRAL_API_KEY,     tag: "🟧 Mistral" }
};

const MODEL_PROVIDERS = {
  // OpenRouter (همه رایگان — تست زنده 2026-07-20 ✅)
  "nvidia/nemotron-3-ultra-550b-a55b:free": "openrouter",
  "poolside/laguna-m.1:free": "openrouter",
  "nvidia/nemotron-3-super-120b-a12b:free": "openrouter",
  "cohere/north-mini-code:free": "openrouter",
  "poolside/laguna-xs-2.1:free": "openrouter",
  "nvidia/nemotron-3-nano-30b-a3b:free": "openrouter",
  "openai/gpt-oss-20b:free": "openrouter",
  "nvidia/nemotron-nano-9b-v2:free": "openrouter",
  "google/gemma-4-26b-a4b-it:free": "openrouter",
  "nvidia/nemotron-3.5-content-safety:free": "openrouter",
  // Mistral (تست زنده ✅)
  "mistral-large-latest": "mistral",
  "codestral-latest": "mistral",
  "mistral-medium-latest": "mistral"
  // بقیه مدل‌ها → nvidia (پیش‌فرض)
};
const providerOf = m => MODEL_PROVIDERS[m] || "nvidia";

// ─────────────────────────────────────────────
// 🧠 دسته‌بندی مدل‌های NVIDIA NIM
// ⚠️ فقط مدل‌های تست‌شده و سالم (تست زنده 2026-07-20)
// ─────────────────────────────────────────────
const MODEL_CATEGORIES = {
  "💬 Chat": [
    "meta/llama-3.3-70b-instruct",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "mistral-medium-latest",
    "poolside/laguna-m.1:free",
    "meta/llama-3.1-70b-instruct"
  ],
  "👨‍💻 Coding": [
    "codestral-latest",
    "cohere/north-mini-code:free",
    "meta/llama-3.3-70b-instruct",
    "nvidia/llama-3.3-nemotron-super-49b-v1"
  ],
  "🖼 Vision": [
    "google/gemma-4-26b-a4b-it:free",
    "mistral-large-latest",
    "meta/llama-3.2-11b-vision-instruct"
  ],
  "🧠 Reasoning": [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-20b:free",
    "nvidia/llama-3.3-nemotron-super-49b-v1"
  ],
  "📄 Documents": [
    "mistral-large-latest",
    "meta/llama-3.3-70b-instruct",
    "nvidia/nemotron-3-super-120b-a12b:free"
  ],
  "🌍 Translation": [
    "mistral-large-latest",
    "meta/llama-3.3-70b-instruct",
    "google/gemma-4-26b-a4b-it:free"
  ],
  "🎨 Creative": [
    "poolside/laguna-m.1:free",
    "mistral-large-latest",
    "meta/llama-3.3-70b-instruct",
    "mistralai/mixtral-8x7b-instruct-v0.1"
  ],
  "📊 Analysis": [
    "meta/llama-3.3-70b-instruct",
    "mistral-large-latest",
    "nvidia/llama-3.3-nemotron-super-49b-v1",
    "nvidia/nemotron-3-ultra-550b-a55b:free"
  ],
  "⚡ Fast": [
    "nvidia/nemotron-nano-9b-v2:free",
    "poolside/laguna-xs-2.1:free",
    "meta/llama-3.1-8b-instruct",
    "nvidia/nemotron-3-nano-30b-a3b:free"
  ]
};

// ─────────────────────────────────────────────
// 🎛 حالت‌های چسبان (Sticky Modes)
// هر پیام کاربر خودکار طبق حالت فعال پردازش می‌شود
// ─────────────────────────────────────────────
const STICKY_MODES = {
  chat: {
    get label(){return pxText("💬 چت هوشمند")},
    get hint(){return pxText("هر پیامی بفرستید تا هوش مصنوعی پاسخ دهد.")},
    wrap: null
  },

  grammar: {
    get label(){return pxText("✍️ اصلاح گرامر انگلیسی")},
    get hint(){return pxText("متن انگلیسی بفرستید؛ نسخه اصلاح‌شده + توضیح خطاها را می‌گیرید.")},
    wrap: t => `Fix all grammar, spelling and style issues in this English text. First output the corrected text, then a short bullet list in Persian explaining the fixes:\n\n${t}`
  },
  summarize: {
    get label(){return pxText("📝 خلاصه‌سازی")},
    get hint(){return pxText("هر متنی بفرستید، خلاصه فهرست‌وار تحویل می‌گیرید.")},
    wrap: t => pxTemplate`این متن را خلاصه کن. نکات اصلی را به‌صورت فهرست فارسی بنویس:\n\n${t}`
  },
  analyze: {
    get label(){return pxText("📊 تحلیل متن")},
    get hint(){return pxText("هر متنی بفرستید، تحلیل حرفه‌ای می‌گیرید.")},
    wrap: t => pxTemplate`این متن را به‌صورت حرفه‌ای و ساختارمند تحلیل کن (نکات کلیدی، لحن، ساختار، نتیجه‌گیری):\n\n${t}`
  },
  code: {
    get label(){return pxText("👨‍💻 دستیار برنامه‌نویسی")},
    get hint(){return pxText("سؤال کدنویسی یا کد خود را بفرستید.")},
    wrap: t => pxTemplate`به‌عنوان برنامه‌نویس حرفه‌ای پاسخ بده. کد تمیز در بلوک کد + توضیح فارسی کوتاه:\n\n${t}`
  },
  creative: {
    get label(){return pxText("🎨 نویسنده خلاق")},
    get hint(){return pxText("موضوع بدهید؛ متن خلاقانه، شعر یا داستان تحویل بگیرید.")},
    wrap: t => pxTemplate`به‌صورت خلاقانه و ادبی بنویس (داستان/شعر/متن خلاقانه بر اساس درخواست):\n\n${t}`
  },
  promptgen: {
    get label(){return pxText("✨ پرامپت‌ساز")},
    get hint(){return pxText("نیاز خود را توضیح دهید؛ پرامپت حرفه‌ای انگلیسی می‌سازم.")},
    wrap: t => pxTemplate`یک پرامپت حرفه‌ای و کامل انگلیسی برای این نیاز بنویس. پرامپت را در بلوک کد قرار بده و توضیح فارسی کوتاهی بده:\n\n${t}`
  },
  research: {
    get label(){return pxText("🧠 تحقیق عمیق")},
    get hint(){return pxText("موضوع بفرستید؛ تحقیق ۴ مرحله‌ای با جستجوی وب انجام می‌شود.")},
    wrap: null // هندل ویژه در handleMessage
  },
  websearch: {
    get label(){return pxText("🔍 جستجوی وب")},
    get hint(){return pxText("هر سؤالی بفرستید؛ با جستجوی زنده وب پاسخ داده می‌شود.")},
    wrap: null // با grounding اجرا می‌شود
  },
  kb: {
    get label(){return pxText("📚 پرسش از دانش من")},
    get hint(){return pxText("هر سؤالی بفرستید؛ فقط از اسناد و دانش شخصی شما پاسخ داده می‌شود (RAG).")},
    wrap: null // هندل ویژه
  }
};

const THINK_CONFIGS = {
  1: { temperature: 0.1,  topP: 0.8,  maxTokens: 512,  get label(){return pxText("⚡ فوری")},   get desc(){return pxText("پاسخ سریع و مستقیم")} },
  2: { temperature: 0.4,  topP: 0.85, maxTokens: 1024, get label(){return pxText("🚀 سریع")},   get desc(){return pxText("پاسخ خوب و سریع")} },
  3: { temperature: 0.7,  topP: 0.9,  maxTokens: 2048, get label(){return pxText("🧠 متعادل")}, get desc(){return pxText("پاسخ متعادل")} },
  4: { temperature: 0.85, topP: 0.95, maxTokens: 4096, get label(){return pxText("🔬 عمیق")},   get desc(){return pxText("تحلیل عمیق")} },
  5: { temperature: 1.0,  topP: 0.99, maxTokens: 8192, get label(){return pxText("🌊 خلاق")},   get desc(){return pxText("خلاقانه و عمیق")} }
};

const BUILT_IN_PERSONAS = {
  get default(){return pxText("دستیار هوشمند فارسی‌زبان هستی، مؤدب، دقیق و کارآمد.")},
  get programmer(){return pxText("متخصص برنامه‌نویسی هستی. کد تمیز و بهینه می‌نویسی. توضیحات فارسی کوتاه می‌دهی.")},
  get poet(){return pxText("شاعر و نویسنده خلاق فارسی‌زبانی. از استعاره‌ها و قالب‌های شعر پارسی استفاده می‌کنی.")},
  get teacher(){return pxText("معلم صبور هستی. مفاهیم را ساده و مرحله‌به‌مرحله توضیح می‌دهی.")},
  get psychologist(){return pxText("روانشناس همدل هستی. با تمرکز بر احساسات کاربر راهنمایی می‌کنی.")},
  get scientist(){return pxText("دانشمند دقیق هستی. با مراجع علمی و آمار پاسخ می‌دهی.")},
  get lawyer(){return pxText("متخصص حقوقی هستی. پاسخ‌هایت دقیق و حقوقی است. (هشدار: مشاوره قانونی نیست)")},
  get chef(){return pxText("سرآشپز حرفه‌ای هستی. دستورالعمل‌های آشپزی دقیق و خوشمزه می‌دهی.")},
  get fitness(){return pxText("مربی تناسب اندام هستی. برنامه‌های ورزشی و تغذیه‌ای علمی ارائه می‌دهی.")},
  get storyteller(){return pxText("داستان‌نویس خلاق هستی. داستان‌های جذاب با شخصیت‌پردازی قوی می‌سازی.")},
  
  // 29 شخصیت جدید
  get comedian(){return pxText("کمدین خلاق هستی. با طنز هوشمندانه و شوخی‌های مناسب پاسخ می‌دهی.")},
  get philosopher(){return pxText("فیلسوف متفکر هستی. درباره معنای زندگی، اخلاق و حقیقت عمیق فکر می‌کنی.")},
  get historian(){return pxText("مورخ دانشمند هستی. رویدادهای تاریخی را با جزئیات و تحلیل دقیق توضیح می‌دهی.")},
  get journalist(){return pxText("روزنامه‌نگار حرفه‌ای هستی. اخبار و رویدادها را بی‌طرفانه و دقیق گزارش می‌دهی.")},
  get detective(){return pxText("کارآگاه تیزبین هستی. جزئیات را بررسی می‌کنی و راز‌ها را حل می‌کنی.")},
  get architect(){return pxText("معمار خلاق هستی. طراحی‌های زیبا و کاربردی ارائه می‌دهی.")},
  get musician(){return pxText("موسیقی‌دان ماهر هستی. درباره موسیقی، سازها و آهنگسازی می‌دانی.")},
  get artist(){return pxText("هنرمند خلاق هستی. درباره نقاشی، مجسمه‌سازی و هنرهای تجسمی صحبت می‌کنی.")},
  get doctor(){return pxText("پزشک متخصص هستی. اطلاعات پزشکی علمی می‌دهی. (هشدار: مشاوره پزشکی نیست)")},
  get engineer(){return pxText("مهندس تحلیلگر هستی. مسائل فنی را با دقت و خلاقیت حل می‌کنی.")},
  get economist(){return pxText("اقتصاددان متخصص هستی. تحلیل‌های اقتصادی و مالی ارائه می‌دهی.")},
  get marketer(){return pxText("بازاریاب حرفه‌ای هستی. استراتژی‌های خلاقانه تبلیغات و فروش می‌دهی.")},
  get designer(){return pxText("طراح گرافیک هستی. درباره رنگ، تایپوگرافی و زیبایی‌شناسی می‌دانی.")},
  get photographer(){return pxText("عکاس حرفه‌ای هستی. درباره نور، ترکیب‌بندی و تکنیک‌های عکاسی می‌دانی.")},
  get gamer(){return pxText("گیمر حرفه‌ای هستی. درباره بازی‌های ویدیویی، استراتژی و e-sports می‌دانی.")},
  get traveler(){return pxText("مسافر باتجربه هستی. درباره مقاصد گردشگری، فرهنگ‌ها و سفر راهنمایی می‌کنی.")},
  get environmentalist(){return pxText("فعال محیط زیست هستی. درباره حفاظت از طبیعت و پایداری صحبت می‌کنی.")},
  get entrepreneur(){return pxText("کارآفرین خلاق هستی. ایده‌های کسب‌وکار و استارتاپ می‌دهی.")},
  get mentor(){return pxText("مربی زندگی هستی. با انگیزه و الهام‌بخش، مسیر موفقیت را نشان می‌دهی.")},
  get librarian(){return pxText("کتابدار دانشمند هستی. درباره کتاب‌ها، نویسندگان و ادبیات می‌دانی.")},
  get debater(){return pxText("مناظره‌کننده ماهر هستی. استدلال‌های قوی و منطقی ارائه می‌دهی.")},
  get negotiator(){return pxText("مذاکره‌کننده حرفه‌ای هستی. راه‌حل‌های برد-برد پیدا می‌کنی.")},
  get analyst(){return pxText("تحلیلگر داده هستی. با آمار، نمودار و داده‌های کمی کار می‌کنی.")},
  get strategist(){return pxText("استراتژیست هستی. برنامه‌ریزی بلندمدت و تاکتیک‌های هوشمندانه ارائه می‌دهی.")},
  get advisor(){return pxText("مشاور تجاری هستی. راهنمایی‌های عملی و مفید برای تصمیم‌گیری می‌دهی.")},
  get critic(){return pxText("منتقد هنری هستی. آثار هنری، فیلم و کتاب را تحلیل و ارزیابی می‌کنی.")},
  get minimalist(){return pxText("مینیمالیست هستی. زندگی ساده، مرتب و بدون اضافات را ترویج می‌کنی.")},
  get futurist(){return pxText("آینده‌نگر هستی. درباره فناوری‌های آینده و تغییرات جهان صحبت می‌کنی.")},
  get inventor(){return pxText("مخترع خلاق هستی. ایده‌های نوآورانه و راه‌حل‌های جدید ارائه می‌دهی.")},
  get translator(){return pxText("مترجم حرفه‌ای هستی. ترجمه دقیق و روان بین زبان‌ها ارائه می‌دهی.")},
  get editor(){return pxText("ویراستار متخصص هستی. متن‌ها را بهبود می‌دهی و اشتباهات را تصحیح می‌کنی.")},
  get researcher(){return pxText("محقق دقیق هستی. اطلاعات را با منابع معتبر جمع‌آوری و ارائه می‌دهی.")},
  get consultant(){return pxText("مشاور مدیریت هستی. راهکارهای بهبود سازمانی و کسب‌وکار ارائه می‌دهی.")},
  get recruiter(){return pxText("کارشناس منابع انسانی هستی. در استخدام و توسعه شغلی راهنمایی می‌کنی.")},
  get accountant(){return pxText("حسابدار متخصص هستی. در مسائل مالی، حسابداری و مالیات کمک می‌کنی.")},
  get salesperson(){return pxText("فروشنده ماهر هستی. تکنیک‌های فروش و ارتباط با مشتری را می‌دانی.")},
  get investor(){return pxText("سرمایه‌گذار باتجربه هستی. تحلیل بازار و فرصت‌های سرمایه‌گذاری ارائه می‌دهی.")},
  get hacker(){return pxText("متخصص امنیت سایبری هستی. درباره هک اخلاقی، امنیت شبکه و رمزنگاری می‌دانی.")},
  get astronomer(){return pxText("ستاره‌شناس هستی. درباره کیهان، سیارات و اسرار فضا می‌دانی.")}
};

const DEFAULT_PLUGINS = {
  Weather: true, Currency: true, Maps: true, Calculator: true,
  Notes: true, Research: true, OCR: true, Vision: true, Voice: true
};

// قیمت تقریبی به دلار برای هر ۱۰۰۰ توکن {input, output}
const PRICES = {
  "gemini-2.0-flash-exp": { in: 0.000075, out: 0.0003 },
  "gemini-1.5-pro":       { in: 0.00125,  out: 0.005 },
  "gemini-pro":           { in: 0.0005,   out: 0.0015 }
  // مدل‌های NVIDIA NIM رایگان → 0
};

// ─────────────────────────────────────────────
// 🛡 Rate Limiter و Round-Robin (در سطح isolate)
// ─────────────────────────────────────────────
const rateLimitMap = new Map();
let nvidiaIdx = 0;

function isRateLimited(userId) {
  const now = Date.now();
  const history = rateLimitMap.get(userId) || [];
  const recent = history.filter(ts => now - ts < 60000);
  if (recent.length >= 15) { rateLimitMap.set(userId, recent); return true; }
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return false;
}

function getNextKey() {
  const key = NVIDIA_KEYS[nvidiaIdx % NVIDIA_KEYS.length];
  nvidiaIdx = (nvidiaIdx + 1) % NVIDIA_KEYS.length;
  return key;
}

// ─────────────────────────────────────────────
// 🗂 KV Helpers
// ─────────────────────────────────────────────
async function getDb(env, key, def = null) {
  try {
    const raw = await env.BOT_KV.get(key);
    if (raw === null || raw === undefined) return def;
    return JSON.parse(raw);
  } catch { return def; }
}
async function putDb(env, key, val, opts = {}) {
  try { await env.BOT_KV.put(key, JSON.stringify(val), opts); } catch {}
}
async function delDb(env, key) { try { await env.BOT_KV.delete(key); } catch {} }

async function getUserSettings(env, userId) {
  const [s, preferences] = await Promise.all([getDb(env, `user:${userId}:settings`, {}), pfGet(env, `preferences:${userId}`, null)]);
  const mode = preferences?.responseMode;
  const levels = ({ speed: [1, 2], balanced: [3], quality: [4, 5] })[mode];
  const defaultLevel = ({ speed: 2, balanced: 3, quality: 4 })[mode];
  const thinkLevel = levels ? (levels.includes(Number(s.thinkLevel)) ? Number(s.thinkLevel) : defaultLevel) : s.thinkLevel || 2;
  return {
    timezone: s.timezone || "Asia/Tehran",
    thinkLevel,
    persona: s.persona || "default",
    folder: s.folder || "default",
    systemPrompt: s.systemPrompt || "",
    model: s.model || "auto",
    language: preferences?.language === 'en' ? 'en' : 'fa'
  };
}
async function saveUserSettings(env, userId, patch) {
  const s = await getUserSettings(env, userId);
  await putDb(env, `user:${userId}:settings`, { ...s, ...patch });
  if (patch.thinkLevel) {
    const preferences = await pfGet(env, `preferences:${userId}`, {});
    await pfPut(env, `preferences:${userId}`, { ...preferences, responseMode: patch.thinkLevel <= 2 ? 'speed' : patch.thinkLevel >= 4 ? 'quality' : 'balanced' });
  }
}

async function registerUser(env, userId) {
  const users = await getDb(env, "global:users", []);
  if (!users.includes(userId)) {
    users.push(userId);
    await putDb(env, "global:users", users);
  }
}

async function isPluginEnabled(env, name) {
  const plugins = await getDb(env, "global:plugins", DEFAULT_PLUGINS);
  return plugins[name] !== false;
}

// ─────────────────────────────────────────────
// 🔧 ابزارهای عمومی
// ─────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function abToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// تبدیل Markdown به HTML تلگرام
function mdToHtml(text) {
  return markdownToTelegram(text);
}

// تقسیم پیام‌های بلند (حداکثر ۴۰۹۶ کاراکتر تلگرام)
function splitMessage(text, max = 3900) {
  return splitTelegramHtml(text, max);
}

function fmtNum(n) { return Number(n || 0).toLocaleString("en-US"); }
function todayStr(offsetDays = 0) {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().split("T")[0];
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// اجزای زمان محلی در یک منطقه زمانی
function tzParts(tz, date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    });
    const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
    return {
      year: +p.year, month: +p.month, day: +p.day,
      hour: +(p.hour === "24" ? 0 : p.hour), minute: +p.minute, second: +p.second
    };
  } catch {
    const d = new Date(date);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds() };
  }
}
function tzOffsetMs(tz, date = new Date()) {
  const p = tzParts(tz, date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}
function tzLocalHHMM(tz, date = new Date()) {
  const p = tzParts(tz, date);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
// تبدیل زمان محلی کاربر (YYYY-MM-DD HH:MM) به epoch UTC
function localToUtcEpoch(tz, y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  return guess - tzOffsetMs(tz, new Date(guess));
}

// ─────────────────────────────────────────────
// ✈️ Telegram API
// ─────────────────────────────────────────────
async function sendTG(method, body) {
  try {
    if (body.reply_markup) body = { ...body, reply_markup: styleKeyboard(body.reply_markup) };
    const res = await fetch(`${TG_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) {
    return { ok: false, description: String(e) };
  }
}

function inlineKb(rows) { return KB.raw(rows); }

async function editOrSend(chatId, html, keyboard = null, msgRef = null) {
  const mid = msgRef?.message_id || msgRef?.result?.message_id || (typeof msgRef === "number" ? msgRef : null);
  if (mid) {
    const body = { chat_id: chatId, message_id: mid, text: String(html).slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true };
    if (keyboard) body.reply_markup = keyboard;
    let r = await sendTG("editMessageText", body);
    if (!r.ok) {
      delete body.parse_mode;
      body.text = stripTags(html).slice(0, 4000);
      r = await sendTG("editMessageText", body);
    }
    if (r.ok) return r;
  }
  return sendMessage(chatId, html, keyboard);
}

async function sendMessage(chatId, html, keyboard = null) {
  const chunks = splitTelegramHtml(html);
  let last = null;
  for (let i = 0; i < chunks.length; i++) {
    const body = {
      chat_id: chatId, text: chunks[i], parse_mode: "HTML",
      disable_web_page_preview: true
    };
    if (i === chunks.length - 1 && keyboard) body.reply_markup = keyboard;
    last = await sendTG("sendMessage", body);
    if (!last.ok) {
      // Fallback: ارسال بدون HTML اگر تگ‌ها خراب باشند
      delete body.parse_mode;
      body.text = stripTags(chunks[i]);
      last = await sendTG("sendMessage", body);
    }
  }
  return last;
}

async function sendChatAction(chatId, action = "typing") {
  await sendTG("sendChatAction", { chat_id: chatId, action });
}

async function sendDocument(chatId, filename, content, caption = "") {
  try {
    const fd = new FormData();
    fd.append("chat_id", String(chatId));
    fd.append("document", new Blob([content], { type: "application/json" }), filename);
    if (caption) fd.append("caption", caption);
    const res = await fetch(`${TG_API}/sendDocument`, { method: "POST", body: fd });
    return await res.json();
  } catch (e) { return { ok: false, description: String(e) }; }
}

async function sendPhotoUrl(chatId, photoUrl, caption = "") {
  return await sendTG("sendPhoto", {
    chat_id: chatId, photo: photoUrl, caption: caption.slice(0, 1000), parse_mode: "HTML"
  });
}

async function downloadTelegramFile(fileId) {
  const info = await sendTG("getFile", { file_id: fileId });
  if (!info.ok) throw new Error("getFile failed");
  const path = info.result.file_path;
  const res = await fetch(`${TG_FILE}/${path}`);
  if (!res.ok) throw new Error("file download failed");
  const buf = await res.arrayBuffer();
  return { base64: abToB64(buf), path, size: buf.byteLength };
}

// ─────────────────────────────────────────────
// 🌊 Message Streamer — ویرایش پیام حین دریافت
// ─────────────────────────────────────────────
class MessageStreamer {
  constructor(chatId) {
    this.chatId = chatId;
    this.msgId = null;
    this.lastUpdate = 0;
    this.lastText = "";
    this.editing = null;
  }
  async init(text = null) {
    text = text || TGM.loading({ title: pxText("در حال پردازش…"), steps: [pxText("◉ بررسی درخواست"), pxText("◉ انتخاب مدل"), pxText("◌ تولید پاسخ")], note: pxText("پاسخ زنده همین‌جا نوشته می‌شود.") });
    const res = await sendTG("sendMessage", {
      chat_id: this.chatId, text, parse_mode: "HTML"
    });
    this.msgId = res.result?.message_id || null;
  }
  async stream(text) {
    if (!this.msgId) return;
    if (this.editing || Date.now() - this.lastUpdate < 1000) return;
    const shown = text.slice(0, 3900);
    if (shown === this.lastText) return;
    this.lastUpdate = Date.now();
    this.lastText = shown;
    // Provider reads keep flowing while Telegram completes this edit.
    this.editing = sendTG("editMessageText", {
      chat_id: this.chatId, message_id: this.msgId, text: shown, parse_mode: "HTML"
    }).finally(() => { this.editing = null; });
  }
  async done(finalHtml, keyboard = null) {
    if (this.editing) await this.editing;
    if (!this.msgId) { await sendMessage(this.chatId, finalHtml, keyboard); return; }
    const chunks = splitTelegramHtml(finalHtml);
    const first = {
      chat_id: this.chatId, message_id: this.msgId, text: chunks[0],
      parse_mode: "HTML", disable_web_page_preview: true
    };
    if (chunks.length === 1 && keyboard) first.reply_markup = keyboard;
    let res = await sendTG("editMessageText", first);
    if (!res.ok) {
      delete first.parse_mode;
      first.text = stripTags(chunks[0]);
      await sendTG("editMessageText", first);
    }
    for (let i = 1; i < chunks.length; i++) {
      await sendMessage(this.chatId, chunks[i], i === chunks.length - 1 ? keyboard : null);
    }
  }
}

// ─────────────────────────────────────────────
// 📦 کش پاسخ‌ها (TTL: ۱ ساعت)
// ─────────────────────────────────────────────
async function getCachedResponse(env, prompt, model) {
  const hash = await sha256(`${prompt}::${model}`);
  return await getDb(env, `cache:${hash}`, null);
}
async function setCachedResponse(env, prompt, model, response) {
  const hash = await sha256(`${prompt}::${model}`);
  await putDb(env, `cache:${hash}`, response, { expirationTtl: 3600 });
}

// ─────────────────────────────────────────────
// 📊 پیگیری مصرف توکن و سرعت
// ─────────────────────────────────────────────
function costOf(model, promptT, completionT) {
  const p = PRICES[model];
  if (!p) return 0; // NVIDIA NIM رایگان
  return (promptT / 1000) * p.in + (completionT / 1000) * p.out;
}

async function trackUsage(env, userId, model, promptTokens, completionTokens) {
  try {
    const key = `user:${userId}:usage:${todayStr()}`;
    const day = await getDb(env, key, []);
    const cost = costOf(model, promptTokens, completionTokens);
    const entry = day.find(e => e.model === model);
    if (entry) {
      entry.promptTokens += promptTokens;
      entry.completionTokens += completionTokens;
      entry.cost += cost;
      entry.count += 1;
    } else {
      day.push({ model, promptTokens, completionTokens, cost, count: 1 });
    }
    await putDb(env, key, day, { expirationTtl: 40 * 86400 });
  } catch {}
}

async function trackSpeed(env, duration, model) {
  try {
    const arr = await getDb(env, "stats:speed", []);
    arr.push({ ts: Date.now(), duration, model });
    await putDb(env, "stats:speed", arr.slice(-50));
  } catch {}
}

// ─────────────────────────────────────────────
// 🤖 Google Gemini
// ─────────────────────────────────────────────
async function callGemini(contents, opts = {}) {
  opts = { ...opts, system: languageMessages([{ role: 'system', content: opts.system || '' }])[0].content };
  const cfg = opts.think || THINK_CONFIGS[3];
  let lastErr = null;
  for (const model of (opts.models || GEMINI_MODELS)) {
    try {
      const body = {
        contents,
        generationConfig: {
          temperature: cfg.temperature,
          topP: cfg.topP,
          maxOutputTokens: cfg.maxTokens
        }
      };
      if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
      if (opts.grounding) body.tools = [{ googleSearch: {} }];
      // ⏱ سقف ۴۵ ثانیه برای هر درخواست Gemini
      const ctrl = new AbortController();
      const killer = setTimeout(() => ctrl.abort(), 45000);
      let res = null;
      try {
        for (const key of GEMINI_API_KEYS) {
          res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
            method: "POST",
            signal: ctrl.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          if (res.status !== 429 && res.status !== 403) break;
        }
      } finally { clearTimeout(killer); }
      if (!res.ok) { lastErr = new Error(`Gemini ${model}: HTTP ${res.status}`); continue; }
      const data = await res.json();
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts || []).map(p => p.text || "").join("");
      if (!text) { lastErr = new Error(`Gemini ${model}: empty`); continue; }
      const sources = (cand?.groundingMetadata?.groundingChunks || [])
        .map(c => c.web).filter(Boolean)
        .map(w => ({ title: w.title || w.uri, uri: w.uri }));
      const usage = data.usageMetadata || {};
      return {
        text, model, sources,
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0
      };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Gemini failed");
}

async function callGeminiText(prompt, opts = {}) {
  return await callGemini([{ role: "user", parts: [{ text: prompt }] }], opts);
}

async function callGeminiInline(prompt, mimeType, base64, opts = {}) {
  return await callGemini([{
    role: "user",
    parts: [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: base64 } }
    ]
  }], opts);
}

async function callGeminiRaw(prompt) {
  const r = await callGeminiText(prompt, { think: THINK_CONFIGS[2] });
  return r.text;
}

// جستجوی وب با Grounding و ضمیمه‌ی منابع
// اگر Grounding گوگل در دسترس نبود (سهمیه/سطح رایگان)، از DuckDuckGo به‌عنوان جایگزین استفاده می‌شود
async function geminiGrounding(query, opts = {}) {
  // opts.budgetMs: سقف زمانی هر فراخوانی Gemini (رویداد وبهوک فقط ~۳۰ ثانیه زنده می‌ماند)
  const race = p => !opts.budgetMs ? p : Promise.race([
    p, new Promise((_, rej) => setTimeout(() => rej(new Error(pxTemplate`⏱ پاسخ‌دهی بیش از ${opts.budgetMs / 1000}s`)), opts.budgetMs))
  ]);
  try {
    return await race(callGeminiText(query, { ...opts, grounding: true }));
  } catch (e) {
    const hits = await webSearch(query);
    if (!hits.length) throw e;
    const context = hits.map((r, i) => `[${i + 1}] ${r.title}\n${r.uri}\n${r.snippet}`).join("\n\n");
    const sources = hits.map(x => ({ title: x.title, uri: x.uri }));
    try {
      const r = await race(callGeminiText(
        `Answer the query using ONLY these web search results. Cite facts naturally.\n\nQuery: ${query}\n\nSearch results:\n${context}`,
        { ...opts, grounding: false }
      ));
      r.sources = sources;
      return r;
    } catch {
      // حتی اگر Gemini کامل قطع باشد، خودِ نتایج خام جستجو را برمی‌گردانیم
      return { text: context, model: "web-search", sources, promptTokens: 0, completionTokens: 0 };
    }
  }
}

// جستجوی DuckDuckGo (بدون نیاز به کلید API)
// entityها را اول decode می‌کنیم، بعد تگ‌ها را حذف می‌کنیم (وگرنه تگ‌های encode-شده به‌صورت متن باقی می‌مانند)
function htmlStrip(s) {
  return (s || "")
    .replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim();
}

function decodeDdgUri(uri) {
  const uddg = /[?&]uddg=([^&]+)/.exec(uri);
  if (uddg) { try { uri = decodeURIComponent(uddg[1]); } catch {} }
  if (uri.startsWith("//")) uri = "https:" + uri;
  return uri;
}

// DuckDuckGo — از نسخه‌ی lite استفاده می‌کنیم؛ endpoint اصلی html از دیتاسنترها با ۲۰۲ (چالش) پاسخ می‌دهد
async function ddgSearch(query, max = 6) {
  try {
    const ctrl = new AbortController();
    const killer = setTimeout(() => ctrl.abort(), 12000);
    // kl=ir-fa → نتایج ایران/فارسی؛ وگرنه دیتاسنتر ممکن است نتایج انگلستان/آمریکا بدهد
    const isFa = /[؀-ۿ]/.test(query);
    const region = isFa ? "&kl=ir-fa" : "";
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}${region}`, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": isFa ? "fa,en;q=0.8" : "en-US,en;q=0.8"
      }
    });
    clearTimeout(killer);
    if (!res.ok) return [];
    const html = await res.text();
    const links = [...html.matchAll(/class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const snips = [...html.matchAll(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g)];
    const out = [];
    for (let i = 0; i < links.length && out.length < max; i++) {
      const uri = decodeDdgUri(links[i][1]);
      const title = htmlStrip(links[i][2]).slice(0, 120);
      if (!title || !uri.startsWith("http")) continue;
      out.push({ title, uri, snippet: htmlStrip(snips[i]?.[1] || "").slice(0, 250) });
    }
    return out;
  } catch { return []; }
}

// Bing RSS — بدون کلید، از دیتاسنتر پایدار است
async function bingSearch(query, max = 6) {
  try {
    const ctrl = new AbortController();
    const killer = setTimeout(() => ctrl.abort(), 12000);
    // بدون پارامتر cc/setlang — افزودن آن‌ها به endpoint نوع RSS نتایج نامرتبط برمی‌گرداند
    const isFa = /[؀-ۿ]/.test(query);
    const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; rss-reader)",
        "Accept-Language": isFa ? "fa,en;q=0.8" : "en-US,en;q=0.8"
      }
    });
    clearTimeout(killer);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml, max);
  } catch { return []; }
}

function parseRssItems(xml, max) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, max);
  return items.map(it => {
    const g = tag => {
      const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`).exec(it[1]);
      return m ? htmlStrip(m[1]) : "";
    };
    return { title: g("title").slice(0, 120), uri: g("link"), snippet: (g("description") || g("pubDate")).slice(0, 250) };
  }).filter(x => x.title && x.uri.startsWith("http"));
}

// Google News RSS — بدون کلید، برای اخبار/قیمت‌ها از دیتاسنتر هم پایدار است
async function gnewsSearch(query, max = 6) {
  try {
    const ctrl = new AbortController();
    const killer = setTimeout(() => ctrl.abort(), 12000);
    const isFa = /[؀-ۿ]/.test(query);
    const loc = isFa ? "hl=fa&gl=IR&ceid=IR:fa" : "hl=en-US&gl=US&ceid=US:en";
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; rss-reader)" }
    });
    clearTimeout(killer);
    if (!res.ok) return [];
    return parseRssItems(await res.text(), max);
  } catch { return []; }
}

// جستجوی وب ترکیبی (اولین موفق). برای فارسی Bing اول است (بهترین نتایج ایران)، برای انگلیسی DDG اول.
async function webSearch(query, max = 6) {
  const isFa = /[؀-ۿ]/.test(query);
  const chain = isFa ? [bingSearch, ddgSearch, gnewsSearch] : [ddgSearch, bingSearch, gnewsSearch];
  for (const fn of chain) {
    try {
      const hits = await fn(query, max);
      if (hits.length) return hits;
    } catch {}
  }
  return [];
}

// ─────────────────────────────────────────────
// 🏥 سلامت مدل‌ها — تشخیص خودکار مدل خراب + غیرفعال‌سازی موقت
// ─────────────────────────────────────────────
let GLOBAL_ENV = null; // در ابتدای هر fetch/scheduled ست می‌شود
const modelHealth = new Map(); // model → {ok, fail, streak, latSum, latN, disabledUntil}

function healthOf(model) {
  if (!modelHealth.has(model)) modelHealth.set(model, { ok: 0, fail: 0, streak: 0, latSum: 0, latN: 0, disabledUntil: 0 });
  return modelHealth.get(model);
}
async function loadPersistedHealth() {
  try {
    const kv = await getDb(GLOBAL_ENV, "global:model_health", {});
    for (const [m, h] of Object.entries(kv)) {
      const cur = healthOf(m);
      if ((h.disabledUntil || 0) > cur.disabledUntil) Object.assign(cur, h);
    }
  } catch {}
}
async function recordModel(model, ok, ms) {
  const h = healthOf(model);
  if (ok) {
    h.ok++; h.latSum += ms; h.latN++;
    if (h.streak >= 3 || h.disabledUntil > Date.now()) { // مدل احیا شد
      h.streak = 0; h.disabledUntil = 0;
      await persistHealth();
    } else h.streak = 0;
  } else {
    h.fail++; h.streak++;
    if (h.streak >= 3) {
      h.disabledUntil = Date.now() + 30 * 60000; // ۳ خطای پیاپی → ۳۰ دقیقه غیرفعال
      await persistHealth();
    }
  }
}
async function persistHealth() {
  try {
    const obj = {};
    for (const [m, h] of modelHealth.entries()) obj[m] = h;
    await putDb(GLOBAL_ENV, "global:model_health", obj, { expirationTtl: 7 * 86400 });
  } catch {}
}
function isModelDisabled(model) {
  return healthOf(model).disabledUntil > Date.now();
}
function healthStats(model) {
  const h = healthOf(model);
  const total = h.ok + h.fail;
  return {
    total,
    successRate: total ? Math.round((h.ok / total) * 100) : null,
    avgLatency: h.latN ? Math.round(h.latSum / h.latN) : null,
    disabled: isModelDisabled(model)
  };
}

// ─────────────────────────────────────────────
// 🌐 فراخوانی چت چندپروایدری (NVIDIA / OpenRouter / Mistral)
// استریم SSE + Round-Robin + ثبت سلامت
// نام تابع برای سازگاری با معماری قبلی حفظ شده است
// ─────────────────────────────────────────────
async function callNvidiaStream(model, messages, cfg, onChunk) {
  messages = languageMessages(messages);
  const provider = PROVIDERS[providerOf(model)];
  const key = provider.key();
  const t0 = Date.now();
  // ⏱ سقف ۶۰ ثانیه برای کل درخواست — مدل کند/هنگ‌کرده کل ربات را قفل نکند
  const ctrl = new AbortController();
  const killer = setTimeout(() => ctrl.abort(), 60000);
  let res;
  try {
    res = await fetch(provider.url(), {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        model, messages, stream: true,
        temperature: cfg.temperature, top_p: cfg.topP, max_tokens: cfg.maxTokens
      })
    });
  } catch (e) {
    clearTimeout(killer);
    await recordModel(model, false, Date.now() - t0);
    throw new Error(`${model}: ${e.name === "AbortError" ? "timeout 60s" : e.message}`);
  }
  if (!res.ok) {
    clearTimeout(killer);
    await recordModel(model, false, Date.now() - t0);
    throw new Error(`${providerOf(model)} ${model}: HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "", usage = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const d = t.slice(5).trim();
        if (d === "[DONE]") continue;
        try {
          const j = JSON.parse(d);
          const delta = j.choices?.[0]?.delta?.content || "";
          if (delta) {
            full += delta;
            if (onChunk) await onChunk(full);
          }
          if (j.usage) usage = j.usage;
        } catch {}
      }
    }
  } catch (e) {
    clearTimeout(killer);
    await recordModel(model, false, Date.now() - t0);
    throw new Error(`${model}: ${e.name === "AbortError" ? "stream timeout 60s" : e.message}`);
  }
  clearTimeout(killer);
  if (!full) {
    await recordModel(model, false, Date.now() - t0);
    throw new Error(`${model}: empty response`);
  }
  await recordModel(model, true, Date.now() - t0);
  return {
    text: full, model,
    promptTokens: usage?.prompt_tokens || Math.ceil(JSON.stringify(messages).length / 4),
    completionTokens: usage?.completion_tokens || Math.ceil(full.length / 4)
  };
}

// فراخوانی یک دسته با fallback تا ۳ مدل، سپس Gemini
async function callNvidiaCat(category, messages, cfg = THINK_CONFIGS[3], onChunk = null) {
  // همه مدل‌های سالم دسته + مدل‌های چت به‌عنوان پشتیبان نهایی
  const models = [...new Set([
    ...(MODEL_CATEGORIES[category] || []),
    ...MODEL_CATEGORIES["💬 Chat"]
  ])];
  await loadPersistedHealth();
  let lastErr = null;
  // اول مدل‌های سالم، بعد (در صورت ناچاری) مدل‌های موقتاً غیرفعال — حداکثر ۴ تلاش
  const ordered = [...models.filter(m => !isModelDisabled(m)), ...models.filter(m => isModelDisabled(m))].slice(0, 4);
  for (const model of ordered) {
    try {
      return await callNvidiaStream(model, messages, cfg, onChunk);
    } catch (e) { lastErr = e; }
  }
  // Fallback نهایی: Gemini
  try {
    const sys = messages.find(m => m.role === "system")?.content || "";
    const contents = messages.filter(m => m.role !== "system").map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
    }));
    return await callGemini(contents, { system: sys, think: cfg });
  } catch (e) {
    throw lastErr || e;
  }
}

async function callNvidiaRaw(model, prompt, key) {
  const provider = PROVIDERS[providerOf(model)];
  const res = await fetch(provider.url(), {
    method: "POST",
    headers: { "Authorization": `Bearer ${key || provider.key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, messages: [{ role: "user", content: prompt }],
      max_tokens: 8, stream: false
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content || "OK";
}

// 🔬 تست زنده همه مدل‌ها + به‌روزرسانی سلامت (دستور ادمین /testmodels)
async function runModelSweep() {
  const all = [...new Set(Object.values(MODEL_CATEGORIES).flat())];
  const results = [];
  for (const model of all) {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const provider = PROVIDERS[providerOf(model)];
      const res = await fetch(provider.url(), {
        method: "POST", signal: ctrl.signal,
        headers: { "Authorization": `Bearer ${provider.key()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "Say OK" }], max_tokens: 8, stream: false })
      });
      clearTimeout(timer);
      const ok = res.ok;
      if (!ok) try { await res.text(); } catch {}
      await recordModel(model, ok, Date.now() - t0);
      results.push({ model, ok, ms: Date.now() - t0, status: res.status });
    } catch (e) {
      await recordModel(model, false, Date.now() - t0);
      results.push({ model, ok: false, ms: Date.now() - t0, status: 0 });
    }
  }
  await persistHealth();
  return results;
}

// ─────────────────────────────────────────────
// 🧭 Auto-Routing هوشمند دسته‌ی مدل
// ─────────────────────────────────────────────
// تشخیص نیاز به جستجوی وب: درخواست صریح جستجو یا اطلاعات لحظه‌ای (قیمت/اخبار/آب‌وهوا)
function detectSearchIntent(text) {
  const t = (text || "").toLowerCase();
  if (t.length > 400) return false; // متن بلند = تحلیل/ترجمه، نه جستجو
  return /(جستجو|سرچ|گوگل|اینترنت بگرد|از وب|قیمت|نرخ ارز|نرخ دلار|دلار|یورو|سکه|طلا|بیت ?کوین|اخبار|خبرهای|تازه‌?ترین|آب و هوا|آب‌وهوا|هوای امروز|امروز چند|الان چند)/.test(t)
    || /(^|\W)(search|google|look up|news|price of|how much is|exchange rate|weather|latest|current price)(\W|$)/.test(t);
}

function detectCategory(text, opts = {}) {
  if (opts.hasImage) return "🖼 Vision";
  if (opts.hasPdf) return "📄 Documents";
  const t = (text || "").toLowerCase();
  if (/(^|\W)(code|function|debug|script|api|bug|error|compile|regex|sql|python|javascript|کد|برنامه|باگ|دیباگ|تابع|اسکریپت)(\W|$)/.test(t))
    return "👨‍💻 Coding";
  if (/(ترجمه|translate|translation|به انگلیسی|به فارسی|به عربی)/.test(t))
    return "🌍 Translation";
  if ((opts.thinkLevel || 3) <= 1) return "⚡ Fast";
  if ((opts.thinkLevel || 3) >= 4) return "🧠 Reasoning";
  if (/(شعر|داستان|قصه|creative|خلاقانه|رمان|متن ادبی|ترانه)/.test(t))
    return "🎨 Creative";
  if (/(تحلیل|analyze|analysis|آمار|خلاصه|بررسی کن|مقایسه|summarize)/.test(t))
    return "📊 Analysis";
  return "💬 Chat";
}

// ─────────────────────────────────────────────
// 🧠 ساخت System Prompt کامل
// ─────────────────────────────────────────────
async function buildSystemPrompt(env, userId, settings) {
  const parts = [];
  const globalPrompt = await getDb(env, "global:prompt", "");
  const globalMemory = await getDb(env, "global:memory", "");
  const userMemory = await getDb(env, `user:${userId}:memory`, "");
  const userData = await getDb(env, `user:${userId}:data`, []);
  const customPersonas = await getDb(env, `user:${userId}:personas`, {});
  const personaText = customPersonas[settings.persona] || BUILT_IN_PERSONAS[settings.persona] || BUILT_IN_PERSONAS.default;

  parts.push(personaText);
  parts.push(settings.language === 'en'
    ? 'Respond in English. Use standard Markdown and suitable emoji. Follow explicit translation requests when another target language is requested.'
    : 'به فارسی پاسخ بده. از Markdown استاندارد و ایموجی‌های مناسب استفاده کن. در درخواست ترجمه، زبان مقصدِ مشخص‌شده را رعایت کن.');
  if (globalPrompt) parts.push(pxTemplate`📌 دستور سراسری: ${globalPrompt}`);
  if (settings.systemPrompt) parts.push(pxTemplate`📌 دستور کاربر: ${settings.systemPrompt}`);
  if (globalMemory) parts.push(pxTemplate`🌐 اطلاعات عمومی: ${globalMemory}`);
  if (userMemory) parts.push(pxTemplate`🧠 حافظه بلندمدت درباره این کاربر: ${userMemory}`);
  if (userData.length) parts.push(pxTemplate`👤 اطلاعات ثبت‌شده کاربر:\n- ${userData.join("\n- ")}`);

  // 👤 پروفایل کاربر → شخصی‌سازی پاسخ‌ها
  const profile = await getProfile(env, userId);
  const profLines = Object.entries(PROFILE_FIELDS)
    .filter(([k]) => profile[k])
    .map(([k, f]) => `${f.label.replace(/^\S+\s/, "")}: ${profile[k]}`);
  if (profLines.length) {
    parts.push(pxTemplate`👤 پروفایل کاربر (پاسخ‌ها را با این تطبیق بده — مثلاً برای حرفه‌ای فنی‌تر، برای مبتدی ساده‌تر):\n${profLines.join("\n")}`);
    if (profile.instructions) parts.push(pxTemplate`📋 دستورالعمل همیشگی کاربر: ${profile.instructions}`);
  }

  // 🧠 حافظه‌های ساختاریافته دسته‌بندی‌شده
  const memories = await getMemories(env, userId);
  if (memories.length) {
    const byCat = {};
    for (const m of memories.slice(-60)) (byCat[m.cat] = byCat[m.cat] || []).push(m.text);
    const memText = Object.entries(byCat)
      .map(([cat, items]) => `${MEMORY_CATS[cat] || cat}: ${items.join(" | ")}`).join("\n");
    parts.push(pxTemplate`🗂 حافظه‌های ثبت‌شده درباره کاربر:\n${memText}`);
  }
  const p = tzParts(settings.timezone);
  parts.push(pxTemplate`🕐 زمان محلی کاربر: ${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${tzLocalHHMM(settings.timezone)} (${settings.timezone})`);
  return (parts.join("\n\n")) + "\n\n[Telegram formatting] Use Markdown freely: **bold**, *italic*, spoiler ||text||, code blocks, and markdown tables when comparing data. Lists with - bullets. Headings with ##." +
    (settings.language === 'en' ? '\n[Account language] Use English for responses unless the user explicitly requests a different target language.' : '\n[Account language] Use Persian for responses unless the user explicitly requests a different target language.');
}

// ─────────────────────────────────────────────
// 📚 مدیریت تاریخچه و حافظه بلندمدت
// ─────────────────────────────────────────────
async function getHistory(env, userId, folder) {
  return await getDb(env, `user:${userId}:history:${folder}`, []);
}
async function pushHistory(env, userId, folder, role, content, model = "") {
  const key = `user:${userId}:history:${folder}`;
  const hist = await getDb(env, key, []);
  hist.push({ role, content: String(content).slice(0, 8000), timestamp: Date.now(), model });
  await putDb(env, key, hist.slice(-100));
  return hist.length;
}

// خلاصه‌سازی خودکار هر ۲۰ پیام → حافظه بلندمدت + استخراج حافظه ساختاریافته
async function maybeUpdateLongTermMemory(env, userId, folder) {
  try {
    const hist = await getHistory(env, userId, folder);
    if (hist.length === 0 || hist.length % 20 !== 0) return;
    await extractStructuredMemories(env, userId,
      hist.slice(-10).map(m => `${m.role}: ${m.content.slice(0, 300)}`).join("\n"));
    const oldMemory = await getDb(env, `user:${userId}:memory`, "");
    const convo = hist.slice(-20).map(m => `${m.role}: ${m.content.slice(0, 400)}`).join("\n");
    const r = await callGeminiText(
      pxTemplate`حافظه قبلی:\n${oldMemory || pxText("(خالی)")}\n\nمکالمه اخیر:\n${convo}\n\n` +
      pxTemplate`واقعیت‌های مهم و پایدار درباره کاربر (نام، علایق، شغل، ترجیحات، پروژه‌ها) را در حداکثر ۱۵ خط خلاصه کن. فقط خلاصه را بنویس.`,
      { think: THINK_CONFIGS[2] }
    );
    if (r.text) await putDb(env, `user:${userId}:memory`, r.text.slice(0, 4000));
  } catch {}
}

// ─────────────────────────────────────────────
// 👤 سیستم پروفایل کاربر
// ─────────────────────────────────────────────
const PROFILE_FIELDS = {
  name:        { get label(){return pxText("📛 نام")},             get q(){return pxText("نام خود را بنویسید:")} },
  language:    { get label(){return pxText("🌍 زبان ترجیحی")},     get q(){return pxText("زبان ترجیحی پاسخ‌ها؟ (مثلاً فارسی)")} },
  profession:  { get label(){return pxText("💼 شغل/تخصص")},        get q(){return pxText("شغل یا تخصص شما چیست؟")} },
  level:       { get label(){return pxText("📈 سطح مهارت")},       get q(){return pxText("سطح مهارت شما؟ (مبتدی / متوسط / حرفه‌ای)")} },
  interests:   { get label(){return pxText("❤️ علایق")},           get q(){return pxText("علایق خود را بنویسید:")} },
  goals:       { get label(){return pxText("🎯 اهداف")},           get q(){return pxText("اهداف خود را بنویسید:")} },
  style:       { get label(){return pxText("🗣 سبک پاسخ")},        get q(){return pxText("چه سبک پاسخی دوست دارید؟ (کوتاه/مفصل/فنی/ساده)")} },
  instructions:{ get label(){return pxText("📋 دستورالعمل سفارشی")}, get q(){return pxText("دستورالعمل همیشگی برای AI بنویسید:")} }
};
async function getProfile(env, userId) {
  return await getDb(env, `user:${userId}:profile`, {});
}
function profileText(p) {
  const lines = Object.entries(PROFILE_FIELDS)
    .map(([k, f]) => `${f.label}: ${p[k] ? `<b>${escapeHtml(p[k])}</b>` : pxText("<i>تنظیم نشده</i>")}`);
  return pxTemplate`👤 <b>پروفایل شما</b>\n\n${lines.join("\n")}`;
}
function profileKb() {
  const keys = Object.keys(PROFILE_FIELDS);
  const rows = [];
  for (let i = 0; i < keys.length; i += 2) {
    rows.push(keys.slice(i, i + 2).map(k => ({ text: PROFILE_FIELDS[k].label, callback_data: `prof:${k}` })));
  }
  rows.push([{ text: pxText("🗑 پاک کردن پروفایل"), callback_data: "prof:clear" }, { text: pxText("🔙 منو"), callback_data: "menu" }]);
  return inlineKb(rows);
}

// ─────────────────────────────────────────────
// 🧠 حافظه ساختاریافته (دسته‌بندی‌شده، قابل مدیریت)
// ─────────────────────────────────────────────
const MEMORY_CATS = {
  get personal(){return pxText("👤 شخصی")}, get work(){return pxText("💼 کاری")}, get education(){return pxText("🎓 تحصیلی")},
  get projects(){return pxText("🚀 پروژه‌ها")}, get preferences(){return pxText("⚙️ ترجیحات")}
};
async function getMemories(env, userId) {
  return await getDb(env, `user:${userId}:memories`, []);
}
async function addMemory(env, userId, cat, text) {
  const mems = await getMemories(env, userId);
  const norm = text.trim().slice(0, 500);
  if (mems.some(m => m.text.toLowerCase() === norm.toLowerCase())) return false; // جلوگیری از تکرار
  mems.push({ id: uid(), cat: MEMORY_CATS[cat] ? cat : "personal", text: norm, ts: Date.now() });
  await putDb(env, `user:${userId}:memories`, mems.slice(-120));
  return true;
}
function memoriesText(mems) {
  if (!mems.length) return pxText("🧠 <i>هنوز حافظه‌ای ثبت نشده. با گفتگو خودکار ساخته می‌شود یا با /remember اضافه کنید.</i>");
  let out = pxTemplate`🧠 <b>حافظه‌های من (${mems.length}):</b>\n`;
  for (const [cat, label] of Object.entries(MEMORY_CATS)) {
    const items = mems.filter(m => m.cat === cat);
    if (!items.length) continue;
    out += `\n<b>${label}:</b>\n`;
    for (const m of items) out += pxTemplate`• ${escapeHtml(m.text)}\n  <i>حذف: /memdel ${m.id} · ویرایش: /memedit ${m.id} متن</i>\n`;
  }
  return out;
}

// استخراج خودکار واقعیت‌های ساختاریافته از مکالمه
async function extractStructuredMemories(env, userId, convo) {
  try {
    const existing = (await getMemories(env, userId)).map(m => m.text).join("\n").slice(0, 2000);
    const r = await callNvidiaCat("⚡ Fast", [
      { role: "system", content: "You extract stable, long-term facts about the user. Output ONLY a JSON array, no prose." },
      {
        role: "user",
        content: `Known facts:\n${existing || "(none)"}\n\nConversation:\n${convo}\n\n` +
          `Extract NEW stable facts about the user (identity, job, projects, preferences, goals). ` +
          `Output JSON array: [{"cat":"personal|work|education|projects|preferences","text":"fact in Persian"}]. ` +
          `Max 5 items. If nothing new, output [].`
      }
    ], THINK_CONFIGS[1]);
    const m = r.text.match(/\[[\s\S]*\]/);
    if (!m) return;
    const facts = JSON.parse(m[0]);
    for (const f of facts.slice(0, 5)) {
      if (f?.text) await addMemory(env, userId, f.cat, f.text);
    }
  } catch {}
}

// ─────────────────────────────────────────────
// 🚀 اپ‌ساز هوش مصنوعی (Custom AI App Builder)
// کاربر یک‌بار پرامپت مادر را می‌سازد، بی‌نهایت بار اجرا می‌کند
// ─────────────────────────────────────────────
async function getApps(env, userId) {
  return await getDb(env, `user:${userId}:apps`, []);
}
async function saveApps(env, userId, apps) {
  await putDb(env, `user:${userId}:apps`, apps.slice(0, 50));
}
function appsListKb(apps) {
  const rows = apps.slice(0, 20).map(a =>
    [{ text: `▶️ ${a.name}`, callback_data: `app:run:${a.id}` },
     { text: "⚙️", callback_data: `app:opt:${a.id}` }]);
  rows.push([{ text: pxText("➕ ساخت اپ جدید"), callback_data: "app:new" }]);
  rows.push([{ text: pxText("🔙 منو"), callback_data: "menu" }]);
  return inlineKb(rows);
}
function appOptionsKb(id) {
  return inlineKb([
    [{ text: pxText("▶️ اجرا"), callback_data: `app:run:${id}` }, { text: pxText("📝 ویرایش پرامپت"), callback_data: `app:editp:${id}` }],
    [{ text: pxText("🤖 تغییر مدل"), callback_data: `app:model:${id}` }, { text: pxText("📑 کپی (Duplicate)"), callback_data: `app:dup:${id}` }],
    [{ text: pxText("📤 اشتراک‌گذاری"), callback_data: `app:share:${id}` }, { text: pxText("🗑 حذف"), callback_data: `app:del:${id}` }],
    [{ text: pxText("🔙 اپ‌ها"), callback_data: "apps" }]
  ]);
}

// ─────────────────────────────────────────────
// 💾 مدیریت پرامپت‌ها با پشتیبانی متغیر {var}
// ─────────────────────────────────────────────
async function getPrompts(env, userId) {
  return await getDb(env, `user:${userId}:prompts`, []);
}
function extractVars(text) {
  return [...new Set([...text.matchAll(/\{([^{}]+)\}/g)].map(m => m[1]))];
}
function promptsListKb(prompts) {
  const rows = prompts.slice(0, 20).map(p =>
    [{ text: `▶️ ${p.name}${extractVars(p.text).length ? " {…}" : ""}`, callback_data: `pr:run:${p.id}` },
     { text: "🗑", callback_data: `pr:del:${p.id}` }]);
  rows.push([{ text: pxText("➕ ذخیره پرامپت جدید"), callback_data: "pr:new" }]);
  rows.push([{ text: pxText("🔙 منو"), callback_data: "menu" }]);
  return inlineKb(rows);
}

// ─────────────────────────────────────────────
// 📚 پایگاه دانش شخصی (RAG با Mistral Embeddings)
// هر کاربر دانش ایزوله و خصوصی خودش را دارد
// ─────────────────────────────────────────────
async function mistralEmbed(texts) {
  const res = await fetch(MISTRAL_EMBED_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "mistral-embed", input: texts })
  });
  if (!res.ok) throw new Error(`Embeddings HTTP ${res.status}`);
  const j = await res.json();
  // گرد کردن به ۴ رقم برای صرفه‌جویی در حجم KV
  return j.data.map(d => d.embedding.map(v => Math.round(v * 10000) / 10000));
}
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
function chunkText(text, size = 900) {
  const chunks = [];
  const paras = text.split(/\n\n+/);
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > size) {
      if (cur) chunks.push(cur.trim());
      if (p.length > size) {
        for (let i = 0; i < p.length; i += size) chunks.push(p.slice(i, i + size));
        cur = "";
      } else cur = p;
    } else cur = cur ? cur + "\n\n" + p : p;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.slice(0, 120); // سقف ۱۲۰ قطعه per سند
}
async function kbAddDocument(env, userId, name, text) {
  const index = await getDb(env, `user:${userId}:kb:index`, []);
  if (index.length >= 10) throw new Error(pxText("حداکثر ۱۰ سند مجاز است. ابتدا یکی را حذف کنید (/kb)."));
  const chunks = chunkText(text);
  if (!chunks.length) throw new Error(pxText("متنی برای ذخیره یافت نشد."));
  // embedding دسته‌ای (هر بار ۲۰ قطعه)
  const stored = [];
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20);
    const vecs = await mistralEmbed(batch);
    batch.forEach((t, j) => stored.push({ t, v: vecs[j] }));
  }
  const docId = uid();
  await putDb(env, `user:${userId}:kb:doc:${docId}`, { name, chunks: stored });
  index.push({ docId, name, chunks: stored.length, ts: Date.now() });
  await putDb(env, `user:${userId}:kb:index`, index);
  return { docId, chunks: stored.length };
}
async function kbSearch(env, userId, query, topK = 5) {
  const index = await getDb(env, `user:${userId}:kb:index`, []);
  if (!index.length) return [];
  const [qv] = await mistralEmbed([query.slice(0, 2000)]);
  const scored = [];
  for (const doc of index.slice(0, 10)) {
    const d = await getDb(env, `user:${userId}:kb:doc:${doc.docId}`, null);
    if (!d) continue;
    for (const c of d.chunks) {
      scored.push({ doc: doc.name, text: c.t, score: cosineSim(qv, c.v) });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}
async function kbAnswer(env, chatId, userId, question) {
  const streamer = new MessageStreamer(chatId);
  await streamer.init(pxText("📚 <b>جستجو در دانش شما...</b>"));
  try {
    const hits = await kbSearch(env, userId, question, 5);
    if (!hits.length) {
      return streamer.done(pxText("📚 <b>پایگاه دانش شما خالی است.</b>\n\nیک فایل PDF یا متنی با کپشن <code>/kb</code> بفرستید تا اضافه شود."), backKb());
    }
    const context = hits.map((h, i) => `[${i + 1}] (${h.doc}):\n${h.text}`).join("\n\n---\n\n");
    streamer.lastUpdate = 0;
    await streamer.stream(pxText("🧠 <b>در حال تولید پاسخ از اسناد شما...</b>"));
    const r = await callNvidiaCat("📄 Documents", [
      { role: "system", content: pxText("فقط بر اساس اسناد داده‌شده پاسخ بده. اگر پاسخ در اسناد نیست، صادقانه بگو. در پایان شماره منابع استفاده‌شده را ذکر کن. فارسی پاسخ بده.") },
      { role: "user", content: pxTemplate`اسناد:\n${context}\n\nسؤال: ${question}` }
    ], THINK_CONFIGS[3]);
    await trackUsage(env, userId, r.model, r.promptTokens, r.completionTokens);
    const srcs = [...new Set(hits.map(h => h.doc))].map(escapeHtml).join(pxText("، "));
    await streamer.done(
      pxTemplate`📚 <b>پاسخ از دانش شما:</b>\n\n${mdToHtml(r.text)}\n\n<i>📎 منابع: ${srcs}\n🤖 ${escapeHtml(r.model.split("/").pop())}</i>`,
      answerKb());
    await putDb(env, `user:${userId}:last_answer`, { q: question, a: r.text, model: r.model, ts: Date.now() });
  } catch (e) {
    await streamer.done(pxTemplate`😔 خطا در جستجوی دانش: <i>${escapeHtml(String(e.message || e)).slice(0, 200)}</i>`, backKb());
  }
}

// ─────────────────────────────────────────────
// 🔐 خروجی کامل داده‌ها و حذف دائمی (حریم خصوصی)
// ─────────────────────────────────────────────
const USER_KEY_SUFFIXES = ["settings", "profile", "memories", "memory", "data", "personas", "presets", "prompts", "apps", "notes", "reminders", "schedules", "favorites", "pinned", "folders", "kb:index", "last_answer", "mode", "pending", "wizard"];
async function exportAllUserData(env, userId) {
  return exportBackup(env, userId);
}
async function sendUserBackup(env, chatId, userId, scope = "account") {
  if (Number(chatId) !== Number(userId)) return sendMessage(chatId, pxText("🔒 پشتیبان فقط در گفتگوی خصوصی خودتان ارسال می‌شود."), backKb());
  try {
    await sendMessage(chatId, pxText("📦 <b>در حال آماده‌سازی پشتیبان…</b>\n<i>گفتگوها، حافظه و اسناد شما در یک فایل قرار می‌گیرند.</i>"));
    const archive = await exportBackup(env, userId, { scope, adminId: ADMIN_ID });
    const result = await sendDocument(userId, `pimx-${scope}-${todayStr()}.json`, JSON.stringify(archive), pxText("پشتیبان PIMX · برای انتقال، این فایل را در حساب مقصد با کپشن /restore ارسال کنید."));
    if (!result?.ok) throw new Error(pxText("ارسال فایل به تلگرام انجام نشد؛ دوباره تلاش کنید."));
    return sendMessage(chatId, pxTemplate`✅ <b>پشتیبان آماده است.</b>\n${archive.recordCount} رکورد ذخیره شد.\n\n<blockquote>در همان حساب، اطلاعات روی همهٔ دستگاه‌ها همگام است. برای حساب دیگری، فایل را آنجا با کپشن <code>/restore</code> بفرستید.</blockquote>`, backKb());
  } catch (e) { return sendMessage(chatId, pxTemplate`⚠️ <b>پشتیبان ساخته نشد</b>\n${escapeHtml(e.message)}`, backKb()); }
}
async function deleteAllUserData(env, userId) {
  const folders = await getDb(env, `user:${userId}:folders`, ["default"]);
  for (const f of folders) {
    await delDb(env, `user:${userId}:history:${f}`);
    await delDb(env, `user:${userId}:foldertitle:${f}`);
  }
  const kbIndex = await getDb(env, `user:${userId}:kb:index`, []);
  for (const d of kbIndex) await delDb(env, `user:${userId}:kb:doc:${d.docId}`);
  for (const suf of USER_KEY_SUFFIXES) await delDb(env, `user:${userId}:${suf}`);
  for (let i = 0; i < 35; i++) await delDb(env, `user:${userId}:usage:${todayStr(i)}`);
  const users = await getDb(env, "global:users", []);
  await putDb(env, "global:users", users.filter(u => u !== userId));
}

// ─────────────────────────────────────────────
// 🏷 عنوان خودکار چت‌ها
// ─────────────────────────────────────────────
async function maybeTitleFolder(env, userId, folder) {
  try {
    const existing = await getDb(env, `user:${userId}:foldertitle:${folder}`, null);
    if (existing) return;
    const hist = await getHistory(env, userId, folder);
    if (hist.length < 2) return;
    const r = await callNvidiaCat("⚡ Fast", [
      { role: "user", content: `Write a title in ${currentLanguage() === 'en' ? 'English' : 'Persian'} for this conversation, at most 5 words. Return only the title:\n\n${hist.slice(0, 4).map(m => m.content.slice(0, 200)).join("\n")}` }
    ], THINK_CONFIGS[1]);
    await putDb(env, `user:${userId}:foldertitle:${folder}`, r.text.trim().slice(0, 60));
  } catch {}
}

// ─────────────────────────────────────────────
// ⌨️ کیبوردها
// ─────────────────────────────────────────────
function mainMenuKb(userId = null) {
  const rows = [
    [{ text: pxText("💾 دانلود اطلاعات من"), callback_data: "backup:account", style: "success" }, { text: pxText("📥 بازیابی و انتقال"), callback_data: "restore", style: "primary" }],
    [{ text: pxText("✨ گفتگوی هوشمند"), callback_data: "mode:chat" }, { text: pxText("🔎 جستجوی زنده"), callback_data: "mode:websearch" }],
    [{ text: "🧠 AI Council", callback_data: "pf:council" }, { text: pxText("🔬 تحقیق عمیق"), callback_data: "mode:research" }],
    [{ text: pxText("🤖 مدل‌ها"), callback_data: "models" }, { text: pxText("🔌 پروایدرها"), callback_data: "pf:providers" }],
    [{ text: pxText("🤝 ایجنت‌ها"), callback_data: "pf:agents" }, { text: pxText("📚 دانش من"), callback_data: "kb" }],
    [{ text: pxText("🛠 جعبه‌ابزار"), callback_data: "tools" }, { text: pxText("⚡ اتوماسیون"), callback_data: "pf:tasks" }],
    [{ text: pxText("📊 مصرف و وضعیت"), callback_data: "usage" }, { text: pxText("⚙️ تنظیمات"), callback_data: "settings" }],
    [{ text: pxText("🪄 حالت‌های تخصصی"), callback_data: "modes" }, { text: pxText("🏗 مرکز زیرساخت"), callback_data: "pf:menu" }]
  ];
  if (Number(userId) === Number(ADMIN_ID) && ADMIN_ID) rows.push([{ text: pxText("🗄 دانلود کل دیتابیس"), callback_data: "backup:database", style: "success" }]);
  if (MINIAPP_URL) {
    rows.unshift([{ text: pxText("✦ باز کردن فضای هوشمند PIMX"), web_app: { url: MINIAPP_URL }, style: "primary" }]);
  }
  return KB.raw(rows);
}

// حالت‌های تخصصی — از منوی اصلی جدا شد تا منو تمیز بماند
function modesKb(cur) {
  const items = Object.entries(STICKY_MODES)
    .filter(([k]) => k !== "chat")
    .map(([k, v]) => KB.btn((cur === k ? "✅ " : "") + v.label, "mode:" + k));
  return KB.raw(KB.merge(KB.grid(items, 2), KB.nav({ back: "menu" })));
}

function toolsKb() {
  return KB.raw(KB.merge(
    [
      [{ text: "📄 PDF", callback_data: "tool:pdf" }, { text: pxText("🎤 رونویسی صدا"), callback_data: "tool:voice" }],
      [{ text: pxText("🔤 OCR عکس"), callback_data: "tool:ocr" }, { text: pxText("🖼 توضیح عکس"), callback_data: "tool:caption" }],
      [{ text: pxText("🌤 آب و هوا"), callback_data: "tool:weather" }, { text: pxText("🧮 ماشین حساب"), callback_data: "tool:calc" }],
      [{ text: pxText("💱 تبدیل ارز"), callback_data: "tool:convert" }, { text: pxText("🗺 مسیریابی"), callback_data: "tool:map" }]
    ],
    KB.nav({ back: "menu" })
  ));
}

function chatMgmtKb() {
  return KB.raw(KB.merge(
    [
      [{ text: pxText("💬 لیست چت‌ها"), callback_data: "chats" }, { text: pxText("🔄 چت جدید"), callback_data: "newchat" }],
      [{ text: pxText("📝 یادداشت‌ها"), callback_data: "notes" }, { text: pxText("⏰ یادآورها"), callback_data: "reminders" }],
      [{ text: pxText("📁 پوشه‌ها"), callback_data: "folders" }, { text: pxText("⭐ علاقه‌مندی‌ها"), callback_data: "showfavs" }],
      [{ text: pxText("📌 پین‌شده‌ها"), callback_data: "showpinned" }, { text: pxText("📤 خروجی چت"), callback_data: "exportchat" }],
      [{ text: pxText("📦 خروجی همه داده‌ها"), callback_data: "exportall" }],
      [{ text: pxText("🗑 حذف دائمی همه داده‌ها"), callback_data: "deleteme" }]
    ],
    KB.nav({ back: "menu" })
  ));
}

function modelsKb(current) {
  const rows = [[{ text: pxTemplate`${current === "auto" ? "✅ " : ""}🤖 خودکار (هوشمند)`, callback_data: "setmodel:auto" }]];
  const nvidiaModels = [...new Set(Object.values(MODEL_CATEGORIES).flat())];
  for (const m of nvidiaModels) {
    const short = m.split("/").pop();
    rows.push([{ text: `${current === m ? "✅ " : "🟩 "}${short}`, callback_data: `setmodel:${m}`.slice(0, 64) }]);
  }
  for (const g of GEMINI_MODELS) {
    rows.push([{ text: `${current === g ? "✅ " : "🔷 "}${g}`, callback_data: `setmodel:${g}` }]);
  }
  rows.push([{ text: pxText("🔙 منو"), callback_data: "menu" }]);
  return inlineKb(rows);
}

function settingsKb() {
  return KB.raw(KB.merge(
    [
      [{ text: '🌐 فارسی / English', callback_data: 'language' }],
      [{ text: pxText("💡 عمق فکر"), callback_data: "think" }, { text: pxText("🎭 شخصیت"), callback_data: "persona" }],
      [{ text: pxText("⚙️ سیستم‌پرامپت"), callback_data: "sysprompt" }, { text: pxText("🌍 منطقه زمانی"), callback_data: "tz" }],
      [{ text: pxText("🧠 حافظه"), callback_data: "memory" }, { text: pxText("📅 زمان‌بندی"), callback_data: "schedules" }],
      [{ text: pxText("📊 مصرف"), callback_data: "usage" }, { text: pxText("📁 پوشه فعال"), callback_data: "folders" }],
      [{ text: pxText("🗑 پاک کردن حافظه"), callback_data: "clearmem" }]
    ],
    KB.nav({ back: "menu" })
  ));
}

function answerKb() {
  return KB.raw(KB.merge(
    [
      [{ text: pxText("📋 کپی"), callback_data: "copy" }, { text: pxText("⭐ ذخیره"), callback_data: "favorite" }],
      [{ text: pxText("🎛 تغییر مدل"), callback_data: "models" }, { text: pxText("📌 پین"), callback_data: "pinchat" }],
      [{ text: pxText("🔄 چت جدید"), callback_data: "newchat" }]
    ],
    KB.nav({ back: "menu" })
  ));
}

function backKb() { return KB.raw(KB.nav({ home: true })); }

// کیبورد دائمی زیر باکس تایپ — همه دکمههای اصلی
function replyKb() {
  return {
    keyboard: [
      [{ text: pxText("📋 منو") }, { text: pxText("💬 چت") }, { text: pxText("🔎 جستجو") }],
      [{ text: pxText("🔬 تحقیق") }, { text: pxText("📌 خلاصه") }, { text: pxText("💻 کد") }],
      [{ text: pxText("🎛 مدلها") }, { text: pxText("🏗 زیرساخت") }, { text: "🖥 Mini App" }],
      [{ text: pxText("📊 مصرف") }, { text: pxText("🛠 ابزارها") }, { text: pxText("⚙️ تنظیمات") }],
      [{ text: pxText("💾 پشتیبان"), style: "success" }, { text: pxText("📥 بازیابی"), style: "primary" }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

// نگاشت دکمههای کیبورد دائمی به اکشن
const REPLY_KB_ACTIONS = {
  "💾 پشتیبان": "backup",
  "📥 بازیابی": "restore",
  "📋 منو": "menu",
  "💬 چت": "mode_chat",
  "🔎 جستجو": "mode_websearch",
  "🔬 تحقیق": "mode_research",
  "📌 خلاصه": "mode_summarize",
  "💻 کد": "mode_code",
  "🎛 مدلها": "models",
  "🏗 زیرساخت": "infra",
  "🖥 Mini App": "miniapp",
  "📊 مصرف": "usage",
  "🛠 ابزارها": "tools",
  "⚙️ تنظیمات": "settings",
  // سازگاری با دکمههای قدیمی
  "منو": "menu",
  "چت": "mode_chat",
  "جستجوی وب": "mode_websearch",
  "تحقیق": "mode_research",
  "خلاصه": "mode_summarize",
  "مدلها": "models",
  "مصرف": "usage",
  "تنظیمات": "settings"
};

// ─────────────────────────────────────────────
// 💬 موتور اصلی پاسخ هوش مصنوعی
// ─────────────────────────────────────────────
async function aiReply(env, chatId, userId, userText, opts = {}) {
  const t0 = Date.now();
  const streamer = new MessageStreamer(chatId);
  const acknowledgement = streamer.init();
  const settings = await getUserSettings(env, userId);
  const cfg = THINK_CONFIGS[settings.thinkLevel] || THINK_CONFIGS[3];
  let [system, history] = await Promise.all([buildSystemPrompt(env, userId, settings), getHistory(env, userId, settings.folder)]);
  if (opts.systemExtra) system += `\n\n${opts.systemExtra}`;
  // مدل مؤثر: مدل اختصاصی اپ > مدل انتخابی کاربر
  const chosenModel = opts.modelOverride || settings.model;

  await acknowledgement;

  let category = detectCategory(userText, { thinkLevel: settings.thinkLevel, ...opts });
  const messages = [
    { role: "system", content: system },
    ...history.slice(-20).map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userText }
  ];

  // 🔍 تشخیص خودکار نیاز به جستجوی وب در چت عادی (قیمت، اخبار، دلار، search و…)
  const wantsSearch = !!opts.grounding || (!!opts.autoSearch && detectSearchIntent(userText));

  let result = null;
  let fellBack = false;
  let gatewayError = null;
  try {
    if (wantsSearch || opts.forceGemini) {
      if (wantsSearch) category = "🔍 Web";
      streamer.lastUpdate = 0;
      await streamer.stream(pxText("🔍 <i>در حال جستجوی وب...</i>"));
      // همان مسیر اثبات‌شده‌ی geminiGrounding (grounding → webSearch → سنتز) که در endpoint دیباگ کار می‌کند
      // سطح تفکر برای جستجو حداکثر ۳ (توکن کمتر = پاسخ سریع‌تر، قبل از پایان عمر ۳۰ثانیه‌ای رویداد)
      try {
        const searchCfg = THINK_CONFIGS[Math.min(settings.thinkLevel || 3, 3)];
        result = await geminiGrounding(userText, { system, think: searchCfg, budgetMs: 15000 });
      } catch (e) {
        // آخرین خط دفاع: زنجیره‌ی مدل‌های چت با نتایج خام جستجو
        const hits = await webSearch(userText).catch(() => []);
        if (!hits.length) throw e;
        const ctx = hits.map((h, i) => `[${i + 1}] ${h.title}\n${h.uri}\n${h.snippet}`).join("\n\n");
        const searchPrompt = pxTemplate`نتایج جستجوی وب برای «${userText}»:\n\n${ctx}\n\nبر اساس این نتایج، به سؤال کاربر پاسخ دقیق و به‌روز بده و در صورت نیاز به منابع اشاره کن.`;
        result = await callNvidiaCat("💬 Chat", [
          { role: "system", content: system },
          { role: "user", content: searchPrompt }
        ], cfg, async full => await streamer.stream(escapeHtml(full.slice(-3800)) + " ▌"));
        result.sources = hits.map(h => ({ title: h.title, uri: h.uri }));
      }
    } else if (chosenModel && chosenModel !== "auto") {
      // مدل انتخابی دستی کاربر یا اپ — با fallback خودکار در صورت خطا
      if (chosenModel.startsWith("gemini")) {
        result = await callGemini(
          messages.filter(m => m.role !== "system").map(m => ({
            role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }]
          })),
          { system, think: cfg, models: [chosenModel, ...GEMINI_MODELS] }
        );
      } else {
        try {
          result = await callNvidiaStream(chosenModel, messages, cfg,
            async full => await streamer.stream(escapeHtml(full.slice(-3800)) + " ▌"));
        } catch (err) {
          // 🔄 مدل انتخابی خراب بود → سوئیچ خودکار به مدل‌های سالم دسته
          fellBack = true;
          streamer.lastUpdate = 0;
          await streamer.stream(pxTemplate`⚠️ <b>مدل ${escapeHtml(chosenModel.split("/").pop())} در دسترس نیست.</b>\n🔄 <i>سوئیچ خودکار به مدل جایگزین...</i>`);
          result = await callNvidiaCat(category, messages, cfg,
            async full => await streamer.stream(escapeHtml(full.slice(-3800)) + " ▌"));
        }
      }
    } else {
      // 🛰 اول رجیستری پلتفرم (پروایدرهای افزودهشده توسط کاربر) — اگر خالی بود، مسیر قدیمی
      let usedGateway = false;
      try {
        const registry = await pfListModels(env, { status: "healthy", enabled: true });
        if (registry.length) {
          const taskMap = { "👨💻 Coding": "coding", "🧠 Reasoning": "reasoning", "🔍 Web": "research", "💬 Chat": "chat" };
          const r = await gatewayRoute(env, messages, {
            task: taskMap[category] || undefined,
            maxTokens: cfg.maxTokens, temperature: cfg.temperature, topP: cfg.topP,
            policy: settings.thinkLevel <= 2 ? 'speed' : settings.thinkLevel >= 4 ? 'quality' : 'balanced',
            text: userText, userId,
            onChunk: async full => await streamer.stream(escapeHtml(full.slice(-3800)) + " ▌")
          });
          result = r;
          fellBack = !!r.failover;
          usedGateway = true;
          await trackPlatformUsage(env, {
            userId, modelId: r.modelId, model: r.model, providerName: r.providerName,
            promptTokens: r.promptTokens, completionTokens: r.completionTokens,
            cost: r.cost || 0, latency: r.latency, ok: true, task: r.task
          });
        }
      } catch (e) {
        gatewayError = String(e.message || e);
      }
      if (!usedGateway) {
        result = await callNvidiaCat(category, messages, cfg,
          async full => await streamer.stream(escapeHtml(full.slice(-3800)) + " ▌"));
      }
    }
  } catch (e) {
    await streamer.done(pxTemplate`😔 <b>متأسفانه خطایی رخ داد.</b>\n\n<i>${escapeHtml(String(e.message || e)).slice(0, 300)}</i>\n\n🔄 لطفاً دوباره تلاش کنید.`, backKb());
    return null;
  }

  const duration = Date.now() - t0;

  // ساخت پاسخ نهایی با قالب استاندارد پیام (Design System تلگرام)
  const shortModel = String(result.model || "").split("/").pop();
  const metaBits = [result.providerName ? TG.provider(result.providerName) : "", category || "", fellBack ? pxText("جایگزین خودکار") : ""]
    .filter(Boolean).join(" · ");
  const html = TGM.answer({
    body: mdToHtml(result.text),
    model: shortModel + (metaBits ? " · " + metaBits : ""),
    latency: (duration / 1000).toFixed(1) + "s",
    sources: (result.sources || []).slice(0, 5).map(s => ({ title: String(s.title || s.uri || "").slice(0, 60), url: s.uri }))
  });

  await streamer.done(html, answerKb());

  // ذخیرهسازیها
  await pushHistory(env, userId, settings.folder, "user", userText);
  await pushHistory(env, userId, settings.folder, "assistant", result.text, result.model);
  await putDb(env, `user:${userId}:last_answer`, { q: userText, a: result.text, model: result.model, ts: Date.now() });
  await trackUsage(env, userId, result.model, result.promptTokens, result.completionTokens);
  await trackSpeed(env, duration, result.model);
  await maybeUpdateLongTermMemory(env, userId, settings.folder);
  await maybeTitleFolder(env, userId, settings.folder);
  // 🧠 حافظه پیشرفته: استخراج واقعیتهای پایدار هر ۶ پیام (بدون کند کردن پاسخ)
  try {
    const hist = await getHistory(env, userId, settings.folder);
    if (hist.length && hist.length % 6 === 0) {
      const convo = hist.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n").slice(0, 4000);
      await pfExtractMemories(env, userId, convo);
      await pfExtractGraph(env, userId, convo);
    }
  } catch {}
  return result;
}

// ─────────────────────────────────────────────
// 📊 داشبورد مصرف
// ─────────────────────────────────────────────
async function usageSummary(env, userId, days) {
  let tokens = 0, cost = 0, count = 0;
  for (let i = 0; i < days; i++) {
    const day = await getDb(env, `user:${userId}:usage:${todayStr(i)}`, []);
    for (const e of day) {
      tokens += (e.promptTokens || 0) + (e.completionTokens || 0);
      cost += e.cost || 0;
      count += e.count || 0;
    }
  }
  return { tokens, cost, count };
}

async function handleUsageDashboard(chatId, userId, env) {
  const yesterday = await (async () => {
    const day = await getDb(env, `user:${userId}:usage:${todayStr(1)}`, []);
    let t = 0, c = 0, n = 0;
    for (const e of day) { t += (e.promptTokens || 0) + (e.completionTokens || 0); c += e.cost || 0; n += e.count || 0; }
    return { tokens: t, cost: c, count: n };
  })();
  const week = await usageSummary(env, userId, 7);
  const month = await usageSummary(env, userId, 30);

  const modelStats = {};
  for (let i = 0; i < 30; i++) {
    const day = await getDb(env, `user:${userId}:usage:${todayStr(i)}`, []);
    for (const e of day) {
      if (!modelStats[e.model]) modelStats[e.model] = { tokens: 0, cost: 0, count: 0 };
      modelStats[e.model].tokens += (e.promptTokens || 0) + (e.completionTokens || 0);
      modelStats[e.model].cost += e.cost || 0;
      modelStats[e.model].count += e.count || 0;
    }
  }
  let table = "";
  const sorted = Object.entries(modelStats).sort((a, b) => b[1].tokens - a[1].tokens).slice(0, 10);
  for (const [model, s] of sorted) {
    const name = model.split("/").pop().slice(0, 18).padEnd(18);
    table += `${name} ${String(fmtNum(s.tokens)).padStart(9)}  $${s.cost.toFixed(4)}  ${s.count}×\n`;
  }

  const msg =
    pxTemplate`📊 <b>گزارش روزانه مصرف</b>\n\n` +
    pxTemplate`📅 <b>دیروز</b>\n${fmtNum(yesterday.tokens)} توکن · $${yesterday.cost.toFixed(4)} · ${yesterday.count} پیام\n\n` +
    pxTemplate`📅 <b>7 روز اخیر</b>\n${fmtNum(week.tokens)} توکن · $${week.cost.toFixed(4)} · ${week.count} پیام\n\n` +
    pxTemplate`📅 <b>30 روز اخیر</b>\n${fmtNum(month.tokens)} توکن · $${month.cost.toFixed(4)} · ${month.count} پیام\n\n` +
    pxTemplate`🔍 <b>تفکیک مدل‌ها (30 روز)</b>\n<pre>${escapeHtml(table || pxText("هنوز مصرفی ثبت نشده"))}</pre>`;
  await sendMessage(chatId, msg, backKb());
}

// ─────────────────────────────────────────────
// 🏥 سلامت API
// ─────────────────────────────────────────────
async function handleHealth(chatId, env) {
  await sendChatAction(chatId);
  const results = [];
  try {
    await callGeminiText("Say OK", { think: THINK_CONFIGS[1] });
    results.push(pxText("🟢 <b>Google Gemini:</b> آنلاین"));
  } catch { results.push(pxText("🔴 <b>Google Gemini:</b> خطا")); }

  let nvidiaOk = 0;
  for (let i = 0; i < 2; i++) {
    try {
      await callNvidiaRaw("meta/llama-3.3-70b-instruct", "Say OK", getNextKey());
      nvidiaOk++;
    } catch {}
  }
  results.push(pxTemplate`${nvidiaOk > 0 ? "🟢" : "🔴"} <b>NVIDIA NIM:</b> ${nvidiaOk}/2 تست موفق (${NVIDIA_KEYS.length} کلید)`);
  try {
    await callNvidiaRaw("nvidia/nemotron-nano-9b-v2:free", "Say OK");
    results.push(pxText("🟢 <b>OpenRouter:</b> آنلاین"));
  } catch { results.push(pxText("🔴 <b>OpenRouter:</b> خطا")); }
  try {
    await callNvidiaRaw("mistral-medium-latest", "Say OK");
    results.push(pxText("🟢 <b>Mistral:</b> آنلاین"));
  } catch { results.push(pxText("🔴 <b>Mistral:</b> خطا")); }
  try {
    const me = await sendTG("getMe", {});
    results.push(me.ok ? `🟢 <b>Telegram:</b> @${me.result.username}` : pxText("🔴 <b>Telegram:</b> خطا"));
  } catch { results.push(pxText("🔴 <b>Telegram:</b> خطا")); }

  // 📈 آمار سلامت مدل‌ها (از داده‌های واقعی مصرف)
  await loadPersistedHealth();
  const allModels = [...new Set(Object.values(MODEL_CATEGORIES).flat())];
  let table = "";
  const disabled = [];
  for (const m of allModels) {
    const s = healthStats(m);
    if (s.disabled) disabled.push(m.split("/").pop());
    if (!s.total) continue;
    table += `${s.disabled ? "🔴" : "🟢"} ${m.split("/").pop().slice(0, 24).padEnd(24)} ${String(s.successRate ?? "-").padStart(3)}%  ${s.avgLatency ?? "-"}ms\n`;
  }
  let msg = pxTemplate`🏥 <b>وضعیت سرویس‌ها:</b>\n\n${results.join("\n")}`;
  if (table) msg += pxTemplate`\n\n📈 <b>آمار مدل‌ها (موفقیت / تأخیر):</b>\n<pre>${escapeHtml(table)}</pre>`;
  if (disabled.length) msg += pxTemplate`\n⛔️ <b>موقتاً غیرفعال:</b> ${disabled.map(escapeHtml).join(pxText("، "))}`;
  await sendMessage(chatId, msg, backKb());
}

// ─────────────────────────────────────────────
// 🔬 تحقیق عمیق چندمرحله‌ای
// ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
// 🔬 تحقیق عمیق — سیستم Job مقاوم
// رویداد وبهوک روی Workers فقط ~۳۰ ثانیه بعد از پاسخ زنده می‌ماند و بعد بی‌صدا kill می‌شود.
// راه‌حل: وضعیت هر مرحله در KV ذخیره می‌شود؛ اگر رویداد وسط کار بمیرد،
// کرانِ هر-دقیقه (که محدودیت ۳۰ثانیه‌ای ندارد) کار را از همان مرحله ادامه می‌دهد.
// ═══════════════════════════════════════════════════════════════
function rjRace(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(pxTemplate`⏱ ${label} بیش از ${ms / 1000} ثانیه طول کشید`)), ms))
  ]);
}

async function rjEdit(job, html, kb = null) {
  const body = { chat_id: job.chatId, message_id: job.msgId, text: html.slice(0, 3900), parse_mode: "HTML", disable_web_page_preview: true };
  if (kb) body.reply_markup = kb;
  await sendTG("editMessageText", body);
}

async function saveJob(env, job) {
  job.updated = Date.now();
  await putDb(env, `rjob:${job.id}`, job, { expirationTtl: 3600 });
}

async function finishJob(env, job) {
  try {
    await delDb(env, `rjob:${job.id}`);
    const ids = await getDb(env, "global:research_jobs", []);
    await putDb(env, "global:research_jobs", ids.filter(x => x !== job.id), { expirationTtl: 3600 });
  } catch {}
}

async function handleResearch(chatId, userId, topic, env) {
  const res = await sendTG("sendMessage", {
    chat_id: chatId, text: pxText("🔬 <b>شروع تحقیق عمیق...</b>\n\n<i>⏱ معمولاً ۳۰ ثانیه تا ۲ دقیقه طول می‌کشد.</i>"), parse_mode: "HTML"
  });
  const msgId = res.result?.message_id;
  if (!msgId) return null;
  const job = {
    id: crypto.randomUUID(), chatId, userId, topic: String(topic).slice(0, 500), msgId,
    stage: 1, created: Date.now(), updated: Date.now(),
    searchText: "", sources: [], subtopics: "", deepText: "", deepModel: ""
  };
  const ids = await getDb(env, "global:research_jobs", []);
  ids.push(job.id);
  await putDb(env, "global:research_jobs", ids.slice(-20), { expirationTtl: 3600 });
  await saveJob(env, job);
  // تلاش اول در همین رویداد؛ اگر Workers آن را kill کند، cron از KV ادامه می‌دهد
  await runResearchJob(env, job);
  return job.id;
}

async function runResearchJob(env, job, isCron = false) {
  try {
    while (job.stage <= 4) {
      if (Date.now() - job.created > 5 * 60000) throw new Error(pxText("کل فرایند بیش از ۵ دقیقه طول کشید"));
      // قفل: جلوی پردازش هم‌زمان همین Job توسط cron را می‌گیرد
      job.lockUntil = Date.now() + (isCron ? 100000 : 40000);
      await saveJob(env, job);
      await runResearchStage(env, job, isCron);
      job.lockUntil = 0;
      await saveJob(env, job);
    }
  } catch (e) {
    const age = Date.now() - job.created;
    // مهلت مرحله ۳ در رویداد وبهوک عمداً کوتاه است؛ شکستش یعنی «بسپار به cron»، نه شکست کل تحقیق
    if (job.stage === 3 && (job.attempts || 0) < 3 && age < 5 * 60000) {
      await rjEdit(job, pxTemplate`🔬 <b>تحقیق: ${escapeHtml(job.topic).slice(0, 100)}</b>\n\n⏳ <b>مرحله ۳/۴:</b> نگارش گزارش کمی طولانی شد — در پس‌زمینه ادامه می‌یابد <i>(تا ~۲ دقیقه)</i>`);
      job.lockUntil = 0;
      await saveJob(env, job);
      return;
    }
    await rjEdit(job, pxTemplate`😔 <b>تحقیق ناموفق (مرحله ${job.stage}/۴):</b>\n<i>${escapeHtml(String(e.message || e)).slice(0, 250)}</i>\n\n🔄 لطفاً دوباره تلاش کنید.`, backKb());
    await finishJob(env, job);
  }
}

async function runResearchStage(env, job, isCron = false) {
  const topic = job.topic;
  if (job.stage === 1) {
    await rjEdit(job, pxTemplate`🔬 <b>تحقیق: ${escapeHtml(topic).slice(0, 100)}</b>\n\n🔍 <b>مرحله ۱/۴:</b> جستجوی وب...`);
    try {
      const g = await rjRace(
        geminiGrounding(`Research this topic thoroughly and report key facts: ${topic}`, { budgetMs: 15000 }),
        20000, pxText("جستجوی وب")
      );
      job.searchText = g.text;
      job.sources = g.sources || [];
      await trackUsage(env, job.userId, g.model, g.promptTokens, g.completionTokens);
    } catch { job.searchText = pxText("(جستجوی وب در دسترس نبود)"); }
    job.stage = 2;
  } else if (job.stage === 2) {
    await rjEdit(job, pxTemplate`🔬 <b>تحقیق: ${escapeHtml(topic).slice(0, 100)}</b>\n\n🧩 <b>مرحله ۲/۴:</b> شناسایی زیرموضوعات...`);
    try {
      job.subtopics = await rjRace(
        callGeminiRaw(`List 5 key subtopics of: ${topic}. Answer in Persian, one per line.`),
        12000, pxText("شناسایی زیرموضوعات")
      );
    } catch { job.subtopics = topic; }
    job.stage = 3;
  } else if (job.stage === 3) {
    job.attempts = (job.attempts || 0) + 1;
    await saveJob(env, job);
    await rjEdit(job, pxTemplate`🔬 <b>تحقیق: ${escapeHtml(topic).slice(0, 100)}</b>\n\n📚 <b>مرحله ۳/۴:</b> نگارش گزارش...`);
    const prompt = pxTemplate`موضوع: ${topic}\n\nیافته‌های جستجوی وب:\n${String(job.searchText).slice(0, 3000)}\n\nزیرموضوعات:\n${job.subtopics}\n\nیک گزارش تحقیقی جامع فارسی با بخش‌بندی، مقدمه، بدنه و نتیجه‌گیری بنویس.`;
    const sys = pxText("تو یک محقق حرفه‌ای فارسی‌زبان هستی. گزارش جامع، ساختارمند و مستند می‌نویسی.");
    const cfgFast = { ...THINK_CONFIGS[3], maxTokens: 1500 };
    let deep;
    try {
      // Gemini: سریع‌ترین گزینه برای تولید متن بلند فارسی
      deep = await rjRace(
        callGeminiText(prompt, { system: sys, think: cfgFast }),
        25000, pxText("نگارش گزارش (Gemini)")
      );
    } catch {
      // fallback: مدل‌های چت سریع
      deep = await rjRace(
        callNvidiaCat("💬 Chat", [
          { role: "system", content: sys },
          { role: "user", content: prompt }
        ], cfgFast),
        isCron ? 70000 : 22000, pxText("نگارش گزارش (Chat)")
      );
    }
    job.deepText = deep.text;
    job.deepModel = deep.model;
    await trackUsage(env, job.userId, deep.model, deep.promptTokens, deep.completionTokens);
    job.stage = 4;
  } else {
    // مرحله ۴: گزارش نهایی
    const report = TGM.research({
      topic,
      summary: mdToHtml(job.deepText || ""),
      sources: (job.sources || []).slice(0, 6).map(s => ({ title: String(s.title || s.uri || "").slice(0, 60), url: s.uri })),
      models: job.deepModel ? String(job.deepModel).split("/").pop() : null,
      note: pxText("تهیه‌شده توسط سیستم تحقیق چندمرحله‌ای (جستجو → زیرموضوعات → نگارش → گزارش)")
    });
    const streamer = new MessageStreamer(job.chatId);
    streamer.msgId = job.msgId;
    await streamer.done(report, answerKb());
    await putDb(env, `user:${job.userId}:last_answer`, { q: `/research ${topic}`, a: job.deepText, model: job.deepModel, ts: Date.now() });
    job.stage = 5;
    await finishJob(env, job);
  }
}

// ─────────────────────────────────────────────
// 🧰 پلاگین‌ها: ماشین حساب، آب‌وهوا، ارز، نقشه
// ─────────────────────────────────────────────
function safeCalc(expr) {
  const clean = String(expr).replace(/[×]/g, "*").replace(/[÷]/g, "/").replace(/\s+/g, "");
  if (!/^[\d+\-*/().%^]*$/.test(clean)) throw new Error(pxText("عبارت نامعتبر"));
  if (clean.length > 200) throw new Error(pxText("عبارت خیلی طولانی"));
  let i = 0;
  const s = clean;
  function num() {
    const st = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (st === i) throw new Error(pxText("عبارت نامعتبر"));
    const v = Number(s.slice(st, i));
    if (!isFinite(v)) throw new Error(pxText("عبارت نامعتبر"));
    return v;
  }
  function primary() {
    if (s[i] === "(") { i++; const v = addsub(); if (s[i] !== ")") throw new Error(pxText("پرانتز بسته نشده")); i++; return v; }
    if (s[i] === "-") { i++; return -primary(); }
    if (s[i] === "+") { i++; return primary(); }
    return num();
  }
  function power() {
    const b = primary();
    if (s[i] === "*" && s[i + 1] === "*") { i += 2; return Math.pow(b, power()); }
    if (s[i] === "^") { i++; return Math.pow(b, power()); }
    return b;
  }
  function muldiv() {
    let v = power();
    for (;;) {
      if (s[i] === "*" && s[i + 1] === "*") break;
      const op = s[i];
      if (op === "*" || op === "/" || op === "%") {
        i++;
        const r = power();
        if ((op === "/" || op === "%") && r === 0) throw new Error(pxText("تقسیم بر صفر"));
        v = op === "*" ? v * r : op === "/" ? v / r : v % r;
      } else break;
    }
    return v;
  }
  function addsub() {
    let v = muldiv();
    for (;;) {
      const op = s[i];
      if (op === "+" || op === "-") { i++; const r = muldiv(); v = op === "+" ? v + r : v - r; }
      else break;
    }
    return v;
  }
  const val = addsub();
  if (i !== s.length) throw new Error(pxText("عبارت نامعتبر"));
  if (typeof val !== "number" || !isFinite(val)) throw new Error(pxText("نتیجه نامعتبر"));
  return val;
}

async function handleWeather(chatId, city, env) {
  if (!(await isPluginEnabled(env, "Weather"))) return sendMessage(chatId, pxText("🔌 پلاگین آب‌وهوا غیرفعال است."));
  await sendChatAction(chatId);
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { headers: { "User-Agent": "curl" } });
    if (!res.ok) throw new Error("wttr error");
    const j = await res.json();
    const c = j.current_condition?.[0];
    const area = j.nearest_area?.[0];
    if (!c) throw new Error("no data");
    const msg =
      pxTemplate`🌤 <b>آب و هوای ${escapeHtml(area?.areaName?.[0]?.value || city)}</b>\n\n` +
      pxTemplate`🌡 <b>دما:</b> ${c.temp_C}°C (احساس: ${c.FeelsLikeC}°C)\n` +
      pxTemplate`☁️ <b>وضعیت:</b> ${escapeHtml(c.weatherDesc?.[0]?.value || "-")}\n` +
      pxTemplate`💧 <b>رطوبت:</b> ${c.humidity}%\n` +
      pxTemplate`💨 <b>باد:</b> ${c.windspeedKmph} km/h\n` +
      pxTemplate`👁 <b>دید:</b> ${c.visibility} km`;
    await sendMessage(chatId, msg, backKb());
  } catch {
    await sendMessage(chatId, pxTemplate`😔 اطلاعات آب‌وهوای <b>${escapeHtml(city)}</b> یافت نشد.`);
  }
}

async function handleConvert(chatId, text, env) {
  if (!(await isPluginEnabled(env, "Currency"))) return sendMessage(chatId, pxText("🔌 پلاگین ارز غیرفعال است."));
  const m = text.match(/([\d.,]+)\s*([A-Za-z]{3})\s+(?:to|به)\s+([A-Za-z]{3})/i);
  if (!m) return sendMessage(chatId, pxText("💱 فرمت: <code>/convert 100 USD to EUR</code>"));
  const [, amtS, from, to] = m;
  const amt = parseFloat(amtS.replace(/,/g, ""));
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`);
    const j = await res.json();
    const rate = j.rates?.[to.toUpperCase()];
    if (!rate) throw new Error("no rate");
    await sendMessage(chatId,
      pxTemplate`💱 <b>تبدیل ارز</b>\n\n` +
      `${fmtNum(amt)} ${from.toUpperCase()} = <b>${fmtNum((amt * rate).toFixed(2))} ${to.toUpperCase()}</b>\n\n` +
      pxTemplate`📈 <i>نرخ: 1 ${from.toUpperCase()} = ${rate} ${to.toUpperCase()}</i>`, backKb());
  } catch {
    await sendMessage(chatId, pxText("😔 خطا در دریافت نرخ ارز."));
  }
}

async function handleMap(chatId, text, env) {
  if (!(await isPluginEnabled(env, "Maps"))) return sendMessage(chatId, pxText("🔌 پلاگین نقشه غیرفعال است."));
  const m = text.match(/(.+?)\s+(?:to|به)\s+(.+)/i);
  if (!m) return sendMessage(chatId, pxText("🗺 فرمت: <code>/map تهران to اصفهان</code>"));
  const [, from, to] = m;
  const url = `https://www.google.com/maps/dir/${encodeURIComponent(from.trim())}/${encodeURIComponent(to.trim())}`;
  let aiNote = "";
  try {
    const r = await callGeminiText(pxTemplate`به‌طور خیلی خلاصه (حداکثر ۴ خط فارسی) مسیر ${from} به ${to} را توضیح بده: مسافت تقریبی، زمان تقریبی با خودرو، و نکته مهم.`, { think: THINK_CONFIGS[2] });
    aiNote = mdToHtml(r.text);
  } catch {}
  await sendMessage(chatId,
    pxTemplate`🗺 <b>مسیریابی: ${escapeHtml(from.trim())} ← ${escapeHtml(to.trim())}</b>\n\n` +
    (aiNote ? aiNote + "\n\n" : "") +
    pxTemplate`📍 <a href="${url}">مشاهده مسیر در Google Maps</a>`, backKb());
}

// ─────────────────────────────────────────────
// 📁 پردازش فایل‌ها
// ─────────────────────────────────────────────
async function handlePhoto(env, chatId, userId, msg, mode = "caption") {
  if (!(await isPluginEnabled(env, "Vision"))) return sendMessage(chatId, pxText("🔌 پلاگین Vision غیرفعال است."));
  const streamer = new MessageStreamer(chatId);
  await streamer.init(pxText("🖼 <b>در حال تحلیل تصویر...</b>"));
  try {
    const photo = msg.photo[msg.photo.length - 1];
    const { base64 } = await downloadTelegramFile(photo.file_id);
    const settings = await getUserSettings(env, userId);
    let prompt;
    if (mode === "ocr") {
      prompt = pxText("تمام متن موجود در این تصویر را دقیقاً استخراج کن (OCR). فقط متن استخراج‌شده را بنویس.");
    } else {
      prompt = msg.caption
        ? pxTemplate`${msg.caption}\n\n(به فارسی و کامل پاسخ بده)`
        : pxText("این تصویر را با جزئیات کامل به فارسی توصیف و تحلیل کن.");
    }
    const r = await callGeminiInline(prompt, "image/jpeg", base64, { think: THINK_CONFIGS[settings.thinkLevel] });
    await trackUsage(env, userId, r.model, r.promptTokens, r.completionTokens);
    const icon = mode === "ocr" ? pxText("🔤 <b>متن استخراج‌شده:</b>") : pxText("🖼 <b>تحلیل تصویر:</b>");
    await streamer.done(`${icon}\n\n${mdToHtml(r.text)}\n\n<i>🤖 ${escapeHtml(r.model)}</i>`, answerKb());
    await putDb(env, `user:${userId}:last_answer`, { q: pxText("[تصویر]"), a: r.text, model: r.model, ts: Date.now() });
    await pushHistory(env, userId, settings.folder, "user", pxTemplate`[تصویر ارسال شد] ${msg.caption || ""}`);
    await pushHistory(env, userId, settings.folder, "assistant", r.text, r.model);
  } catch (e) {
    await streamer.done(pxTemplate`😔 خطا در تحلیل تصویر: <i>${escapeHtml(String(e.message || e)).slice(0, 200)}</i>`, backKb());
  }
}

async function handleVoice(env, chatId, userId, msg) {
  if (!(await isPluginEnabled(env, "Voice"))) return sendMessage(chatId, pxText("🔌 پلاگین صدا غیرفعال است."));
  const streamer = new MessageStreamer(chatId);
  await streamer.init(pxText("🎤 <b>در حال رونویسی صدا...</b>"));
  try {
    const file = msg.voice || msg.audio;
    const mime = file.mime_type || "audio/ogg";
    const { base64 } = await downloadTelegramFile(file.file_id);
    const r = await callGeminiInline(
      pxText("این فایل صوتی را دقیقاً رونویسی کن. فقط متن گفته‌شده را بنویس، به همان زبانی که گفته شده."),
      mime, base64, { think: THINK_CONFIGS[2] }
    );
    await trackUsage(env, userId, r.model, r.promptTokens, r.completionTokens);
    const transcript = r.text.trim();
    await streamer.done(pxTemplate`🎤 <b>متن رونویسی‌شده:</b>\n\n<blockquote>${escapeHtml(transcript)}</blockquote>\n\n💬 <i>در حال پاسخ به این پیام...</i>`);
    // پردازش متن رونویسی به عنوان پیام عادی
    await aiReply(env, chatId, userId, transcript);
  } catch (e) {
    await streamer.done(pxTemplate`😔 خطا در رونویسی صدا: <i>${escapeHtml(String(e.message || e)).slice(0, 200)}</i>`, backKb());
  }
}

async function handleDocument(env, chatId, userId, msg) {
  const doc = msg.document;
  const name = (doc.file_name || "").toLowerCase();
  const mime = doc.mime_type || "";

  if (doc.file_size > 18 * 1024 * 1024) {
    return sendMessage(chatId, pxText("😔 حجم فایل بیشتر از حد مجاز (۱۸ مگابایت) است."));
  }

  // 📄 PDF
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    const streamer = new MessageStreamer(chatId);
    await streamer.init(pxText("📄 <b>در حال پردازش PDF...</b>"));
    try {
      const { base64 } = await downloadTelegramFile(doc.file_id);
      const prompt = msg.caption || pxText("این سند PDF را به فارسی خلاصه کن: موضوع اصلی، نکات کلیدی و نتیجه‌گیری.");
      const r = await callGeminiInline(prompt, "application/pdf", base64, { think: THINK_CONFIGS[4] });
      await trackUsage(env, userId, r.model, r.promptTokens, r.completionTokens);
      await streamer.done(pxTemplate`📄 <b>تحلیل PDF: ${escapeHtml(doc.file_name || "")}</b>\n\n${mdToHtml(r.text)}\n\n<i>🤖 ${escapeHtml(r.model)}</i>`, answerKb());
      await putDb(env, `user:${userId}:last_answer`, { q: `[PDF: ${doc.file_name}]`, a: r.text, model: r.model, ts: Date.now() });
    } catch (e) {
      await streamer.done(pxTemplate`😔 خطا در پردازش PDF: <i>${escapeHtml(String(e.message || e)).slice(0, 200)}</i>`, backKb());
    }
    return;
  }

  // 📊 CSV / Excel
  if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || mime.includes("csv") || mime.includes("spreadsheet")) {
    const streamer = new MessageStreamer(chatId);
    await streamer.init(pxText("📊 <b>در حال تحلیل داده‌ها...</b>"));
    try {
      const info = await sendTG("getFile", { file_id: doc.file_id });
      const res = await fetch(`${TG_FILE}/${info.result.file_path}`);
      let content;
      if (name.endsWith(".csv") || mime.includes("csv")) {
        content = (await res.text()).slice(0, 12000);
      } else {
        content = pxTemplate`فایل اکسل باینری (${doc.file_name}). فقط بر اساس نام فایل و کپشن تحلیل کلی بده.`;
      }
      const r = await callGeminiText(
        pxTemplate`این داده‌ها را تحلیل کن:\n\n${content}\n\n` +
        pxTemplate`۱) تحلیل فارسی ساختار و نکات کلیدی بده.\n` +
        pxTemplate`۲) در انتها یک بلوک JSON معتبر برای Chart.js بین <CHART> و </CHART> بنویس (نوع bar یا line، حداکثر ۱۰ داده).`,
        { think: THINK_CONFIGS[4] }
      );
      await trackUsage(env, userId, r.model, r.promptTokens, r.completionTokens);
      let analysis = r.text;
      const chartMatch = analysis.match(/<CHART>([\s\S]*?)<\/CHART>/);
      if (chartMatch) {
        analysis = analysis.replace(/<CHART>[\s\S]*?<\/CHART>/, "").trim();
        try {
          const cfg = JSON.parse(chartMatch[1].replace(/```json|```/g, "").trim());
          const chartUrl = `https://quickchart.io/chart?w=600&h=400&c=${encodeURIComponent(JSON.stringify(cfg))}`;
          await sendPhotoUrl(chatId, chartUrl, pxText("📊 <b>نمودار داده‌ها</b>"));
        } catch {}
      }
      await streamer.done(pxTemplate`📊 <b>تحلیل ${escapeHtml(doc.file_name || pxText("داده"))}</b>\n\n${mdToHtml(analysis)}`, answerKb());
    } catch (e) {
      await streamer.done(pxTemplate`😔 خطا در تحلیل فایل: <i>${escapeHtml(String(e.message || e)).slice(0, 200)}</i>`, backKb());
    }
    return;
  }

  // فایل متنی عمومی
  if (mime.startsWith("text/") || /\.(txt|md|json|js|py|html|css)$/.test(name)) {
    try {
      const info = await sendTG("getFile", { file_id: doc.file_id });
      const res = await fetch(`${TG_FILE}/${info.result.file_path}`);
      const content = (await res.text()).slice(0, 12000);
      await aiReply(env, chatId, userId, pxTemplate`${msg.caption || pxText("این فایل را تحلیل و خلاصه کن")}:\n\nنام فایل: ${doc.file_name}\n\n${content}`);
    } catch {
      await sendMessage(chatId, pxText("😔 خطا در خواندن فایل."));
    }
    return;
  }

  await sendMessage(chatId, pxTemplate`📎 فرمت فایل <code>${escapeHtml(doc.file_name || mime)}</code> پشتیبانی نمی‌شود.\n\n✅ فرمت‌های مجاز: PDF، CSV، Excel، تصویر، صوت، متن`);
}

// ─────────────────────────────────────────────
// ⏰ یادآور و زمان‌بندی
// ─────────────────────────────────────────────
async function handleRemind(env, chatId, userId, args) {
  const settings = await getUserSettings(env, userId);
  // پشتیبانی: /remind 2026-07-21 14:30 متن  یا  /remind 15m متن  یا  /remind 2h متن
  let time = null, text = "";
  const rel = args.match(/^(\d+)\s*(m|min|h|hour|د|ساعت|دقیقه)\s+([\s\S]+)/i);
  const abs = args.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s+([\s\S]+)/);
  const timeOnly = args.match(/^(\d{1,2}):(\d{2})\s+([\s\S]+)/);
  if (rel) {
    const n = +rel[1];
    const isHour = /^(h|hour|ساعت)/i.test(rel[2]);
    time = Date.now() + n * (isHour ? 3600000 : 60000);
    text = rel[3];
  } else if (abs) {
    const [y, mo, d] = abs[1].split("-").map(Number);
    time = localToUtcEpoch(settings.timezone, y, mo, d, +abs[2], +abs[3]);
    text = abs[4];
  } else if (timeOnly) {
    const p = tzParts(settings.timezone);
    time = localToUtcEpoch(settings.timezone, p.year, p.month, p.day, +timeOnly[1], +timeOnly[2]);
    if (time <= Date.now()) time += 86400000; // فردا
    text = timeOnly[3];
  } else {
    return sendMessage(chatId,
      pxTemplate`⏰ <b>فرمت یادآور:</b>\n\n` +
      pxTemplate`<code>/remind 2026-07-21 14:30 جلسه کاری</code>\n` +
      pxTemplate`<code>/remind 18:00 ورزش</code>\n` +
      pxTemplate`<code>/remind 15m چای دم کن</code>\n` +
      pxTemplate`<code>/remind 2h تماس با مدیر</code>`);
  }
  const reminders = await getDb(env, `user:${userId}:reminders`, []);
  reminders.push({ id: uid(), time, text: text.trim(), status: "pending" });
  await putDb(env, `user:${userId}:reminders`, reminders);
  const p = tzParts(settings.timezone, new Date(time));
  await sendMessage(chatId,
    pxTemplate`✅ <b>یادآور ثبت شد!</b>\n\n` +
    `📝 <i>${escapeHtml(text.trim())}</i>\n` +
    pxTemplate`🕐 ${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ساعت ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} (${settings.timezone})`, backKb());
}

async function handleSchedule(env, chatId, userId, args) {
  if (/^cancel/i.test(args.trim()) || args.trim() === "لغو") {
    await putDb(env, `user:${userId}:schedules`, []);
    return sendMessage(chatId, pxText("🗑 <b>همه زمان‌بندی‌ها لغو شد.</b>"), backKb());
  }
  const m = args.match(/^(\d{1,2}):(\d{2})\s+([\s\S]+)/);
  if (!m) {
    return sendMessage(chatId,
      pxTemplate`📅 <b>فرمت زمان‌بندی روزانه:</b>\n\n` +
      pxTemplate`<code>/schedule 08:00 صبح بخیر! برنامه امروزت چیه؟</code>\n` +
      pxTemplate`<code>/schedule cancel</code> — لغو همه`);
  }
  const time = `${m[1].padStart(2, "0")}:${m[2]}`;
  const schedules = await getDb(env, `user:${userId}:schedules`, []);
  schedules.push({ id: uid(), time, text: m[3].trim(), lastSent: "" });
  await putDb(env, `user:${userId}:schedules`, schedules);
  await sendMessage(chatId, pxTemplate`✅ <b>پیام روزانه ثبت شد!</b>\n\n⏰ هر روز ساعت <b>${time}</b>\n📝 <i>${escapeHtml(m[3].trim())}</i>`, backKb());
}

async function handleCalendar(env, chatId, userId) {
  const settings = await getUserSettings(env, userId);
  const reminders = (await getDb(env, `user:${userId}:reminders`, []))
    .filter(r => r.status === "pending").sort((a, b) => a.time - b.time).slice(0, 15);
  const schedules = await getDb(env, `user:${userId}:schedules`, []);
  let msg = pxText("📅 <b>تقویم شما</b>\n\n");
  if (reminders.length) {
    msg += pxText("🔔 <b>یادآورهای پیش رو:</b>\n");
    for (const r of reminders) {
      const p = tzParts(settings.timezone, new Date(r.time));
      msg += `• ${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} — <i>${escapeHtml(r.text)}</i>\n`;
    }
  } else msg += pxText("🔕 یادآور فعالی ندارید.\n");
  msg += "\n";
  if (schedules.length) {
    msg += pxText("⏰ <b>پیام‌های روزانه:</b>\n");
    for (const s of schedules) msg += pxTemplate`• هر روز ${s.time} — <i>${escapeHtml(s.text)}</i>\n`;
  } else msg += pxText("⏰ پیام زمان‌بندی‌شده‌ای ندارید.");
  await sendMessage(chatId, msg, backKb());
}

// ─────────────────────────────────────────────
// ⏰ Cron هر ۱ دقیقه
// ─────────────────────────────────────────────
async function handleCronTrigger(env) {
  const now = new Date();

  // �� نجات تحقیقهای ناتمام — رویداد وبهوک ~۳۰ ثانیه بعد از پاسخ kill میشود؛
  // اینجا (بدون آن محدودیت) کار از آخرین مرحلهی ذخیرهشده ادامه مییابد
  try {
    const jobIds = await getDb(env, "global:research_jobs", []);
    for (const id of jobIds) {
      const job = await getDb(env, `rjob:${id}`, null);
      if (!job || job.stage >= 5) continue;
      if ((job.lockUntil || 0) > Date.now()) continue; // هنوز در رویداد دیگری در حال پردازش است
      await withLanguage(await savedLanguage(env, job.userId), () => runResearchJob(env, job, true));
    }
  } catch {}

  // �� Platform: automations, alerts, health sweep
  try {
    if (_seedPromise) await _seedPromise;
    await platformCron(env, { adminId: ADMIN_ID });
  } catch {}

  const users = await getDb(env, "global:users", []);

  for (const userId of users) {
    await withLanguage(await savedLanguage(env, userId), async () => { try {
      const settings = await getUserSettings(env, userId);
      const tz = settings.timezone || "Asia/Tehran";
      const localTime = tzLocalHHMM(tz, now);
      const localDate = `${todayStr()}T${localTime}`;

      // 🔔 یادآورها
      const remKey = `user:${userId}:reminders`;
      const reminders = await getDb(env, remKey, []);
      let remChanged = false;
      for (const rem of reminders) {
        if (!rem.paused && rem.status === "pending" && rem.time <= now.getTime()) {
          await sendTG("sendMessage", {
            chat_id: userId,
            text: pxTemplate`🔔 <b>یادآور:</b>\n\n${escapeHtml(rem.text)}`,
            parse_mode: "HTML"
          });
          rem.status = "sent";
          remChanged = true;
        }
      }
      if (remChanged) {
        await putDb(env, remKey, reminders.filter(r => r.status !== "sent" || now.getTime() - r.time < 7 * 86400000));
      }

      // ⏰ پیام‌های زمان‌بندی‌شده روزانه
      const schKey = `user:${userId}:schedules`;
      const schedules = await getDb(env, schKey, []);
      let schChanged = false;
      for (const sch of schedules) {
        if (!sch.paused && sch.enabled !== false && sch.time === localTime && sch.lastSent !== localDate) {
          await sendTG("sendMessage", {
            chat_id: userId,
            text: pxTemplate`⏰ <b>پیام زمان‌بندی‌شده:</b>\n\n${escapeHtml(sch.text)}`,
            parse_mode: "HTML"
          });
          sch.lastSent = localDate;
          schChanged = true;
        }
      }
      if (schChanged) await putDb(env, schKey, schedules);
    } catch {} });
  }
}

// ─────────────────────────────────────────────
// 📖 متن‌های راهنما
// ─────────────────────────────────────────────
function helpText() {
  const S = (icon, title) => TG.section(icon + " " + title);
  const rows = (lines) => lines.map(l => "• " + l).join("\n");
  return [
    TG.title("📖", pxText("راهنمای PIMXAGENT")),
    TG.i(pxText("همهٔ قابلیت‌ها — دستور بزنید یا از منو استفاده کنید")),
    TG.divider(),
    S("💬", pxText("گفتگو")),
    pxText("هر پیامی بفرستید؛ متن، عکس، ویس، PDF و فایل داده پشتیبانی می‌شوند."),
    S("🧠", pxText("هوش مصنوعی")),
    rows([
      TG.mono("/think [1-5]") + pxText(" — عمق تفکر"),
      TG.mono(pxText("/model [نام|auto]")) + pxText(" — انتخاب مدل"),
      TG.mono("/models") + pxText(" — فهرست مدل‌ها"),
      TG.mono("/mode") + pxText(" — حالت کاری"),
      TG.mono("/persona") + pxText(" — شخصیت"),
      TG.mono("/preset") + pxText(" — پرامپت آماده"),
      TG.mono("/setprompt") + pxText(" و ") + TG.mono("/getprompt") + pxText(" — سیستم‌پرامپت")
    ]),
    S("🔍", pxText("ابزارها")),
    rows([
      TG.mono(pxText("/search [عبارت]")) + pxText(" — جستجوی وب"),
      TG.mono(pxText("/research [موضوع]")) + pxText(" — تحقیق عمیق"),
      TG.mono("/analyze") + " · " + TG.mono("/summarize") + " · " + TG.mono("/translate"),
      TG.mono(pxText("/prompt [توضیح]")) + pxText(" — پرامپت‌ساز"),
      TG.mono("/calc") + " · " + TG.mono("/weather") + " · " + TG.mono("/convert") + " · " + TG.mono("/map"),
      TG.mono("/ocr") + pxText(" و ") + TG.mono("/caption") + pxText(" — پردازش تصویر")
    ]),
    S("⏰", pxText("زمان و یادآور")),
    rows([
      TG.mono(pxText("/remind [زمان] [متن]")) + pxText(" — یادآور"),
      TG.mono(pxText("/schedule [ساعت] [متن]")) + pxText(" — پیام روزانه"),
      TG.mono("/calendar") + " · " + TG.mono("/timezone")
    ]),
    S("🧠", pxText("حافظه و پروفایل")),
    rows([
      TG.mono(pxText("/remember [دسته] [متن]")) + " · " + TG.mono("/memories"),
      TG.mono("/memdel") + " · " + TG.mono("/memedit"),
      TG.mono("/profile") + " · " + TG.mono("/mydata") + " · " + TG.mono("/forget")
    ]),
    S("📚", pxText("دانش و پرامپت")),
    rows([
      pxText("فایل + کپشن ") + TG.mono("/kb") + pxText(" برای افزودن سند"),
      TG.mono(pxText("/ask [سؤال]")) + pxText(" — پرسش از اسناد"),
      TG.mono("/myprompts") + " · " + TG.mono(pxText("/psave نام | دسته | متن"))
    ]),
    S("🚀", pxText("اپ‌ساز و سازمان‌دهی")),
    rows([
      TG.mono("/apps") + " · " + TG.mono("/newapp") + " · " + TG.mono("/appimport"),
      TG.mono("/note") + " · " + TG.mono("/folder") + " · " + TG.mono("/pin") + " · " + TG.mono("/historyfind"),
      TG.mono("/chats") + " · " + TG.mono("/summary") + " · " + TG.mono("/export") + " · " + TG.mono("/import")
    ]),
    S("📊", pxText("آمار و سلامت")),
    rows([
      TG.mono("/usage") + " · " + TG.mono("/stats") + " · " + TG.mono("/cost") + " · " + TG.mono("/speed"),
      TG.mono("/health") + " · " + TG.mono("/plugins")
    ]),
    S("🔐", pxText("داده‌ها")),
    rows([TG.mono("/exportall") + pxText(" — خروجی کامل"), TG.mono("/deleteme") + pxText(" — حذف دائمی"), TG.mono("/cancel") + pxText(" — لغو ویزارد")]),
    TG.divider(),
    pxText("🏗 مرکز کنترل زیرساخت: ") + TG.mono("/infra") + "\n🖥 Mini App: " + TG.mono("/app")
  ].join("\n\n");
}

function aboutText() {
  return pxTemplate`🤖 <b>درباره ربات</b>

✨ ربات هوش مصنوعی فوق‌پیشرفته با:
• 🧠 بیش از ۳۰ مدل AI (Gemini + NVIDIA NIM)
• 🔀 مسیریابی هوشمند خودکار مدل‌ها
• 🖼 تحلیل تصویر (Vision)
• 🎤 رونویسی صدا
• 📄 پردازش PDF و Excel
• 🔍 جستجوی وب زنده
• 🧠 حافظه کوتاه‌مدت و بلندمدت
• ⏰ یادآور و زمان‌بندی هوشمند
• 📊 داشبورد کامل مصرف

⚡ <i>ساخته‌شده روی Cloudflare Workers</i>`;
}

// ─────────────────────────────────────────────
// 🎛 مدیریت Callback Query
// ─────────────────────────────────────────────
async function handleCallback(env, cq) {
  return withLanguage(await savedLanguage(env, cq.from.id), () => handleLocalizedCallback(env, cq));
}

async function handleLocalizedCallback(env, cq) {
  const chatId = cq.message?.chat?.id;
  const userId = cq.from.id;
  const data = cq.data || "";
  const ack = (text = "", alert = false) =>
    sendTG("answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: alert });

  if (data === 'language:en' || data === 'language:fa') {
    if (!chatId) return ack();
    const language = data.slice('language:'.length);
    await saveLanguage(env, userId, language);
    await ack(language === 'en' ? 'Language saved: English' : 'زبان ذخیره شد: فارسی');
    await sendTG('editMessageReplyMarkup', { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
    return handleCommand(env, chatId, userId, '/start');
  }
  if (data === 'language') { await ack(); return askLanguage(chatId); }

  if (data === "backup:account" || data === "backup:database" || data === "exportall") {
    await ack(pxText("در حال ساخت پشتیبان…"));
    return sendUserBackup(env, chatId, userId, data === "backup:database" ? "database" : "account");
  }
  if (data === "restore") { await ack(); return handleCommand(env, chatId, userId, "/restore"); }
  if (data === "formatting") { await ack(); return handleCommand(env, chatId, userId, "/format"); }
  if (data.startsWith("restore:confirm:")) {
    await ack(pxText("در حال بازیابی…"));
    if (Number(chatId) !== Number(userId)) return;
    try {
      const result = await confirmRestore(env, userId, data.slice("restore:confirm:".length));
      return sendMessage(chatId, pxTemplate`✅ <b>اطلاعات منتقل شد.</b>\n${result.imported} رکورد در حساب شما ذخیره شد.\n<i>اطلاعات قبلی حفظ شده و کارهای زمان‌بندی‌شدهٔ واردشده متوقف‌اند.</i>`, backKb());
    } catch (e) { return sendMessage(chatId, `⚠️ ${escapeHtml(e.message)}`, backKb()); }
  }

  // 🛰 callbackهای پلتفرم زیرساخت
  if (data.startsWith("pf:")) {
    if (await handlePlatformCallback(env, cq, { appUrl: MINIAPP_URL })) return;
  }

  if (data === "menu") {
    await ack();
    await delDb(env, `user:${userId}:pending`);
    await delDb(env, `user:${userId}:mode`);
    return editOrSend(chatId, TG.title("📋", pxText("منوی اصلی PIMXAGENT")) + "\n\n" + TG.i(pxText("یک گزینه را انتخاب کنید یا مستقیم پیام بفرستید:")), mainMenuKb(userId), cq.message);
  }
  if (data === "settings") {
    await ack();
    const s = await getUserSettings(env, userId);
    return editOrSend(chatId,
      pxTemplate`⚙️ <b>تنظیمات</b>\n\n` +
      pxTemplate`💡 عمق فکر: <b>${THINK_CONFIGS[s.thinkLevel].label}</b>\n` +
      pxTemplate`🎭 شخصیت: <b>${escapeHtml(s.persona)}</b>\n` +
      pxTemplate`🌍 منطقه زمانی: <b>${escapeHtml(s.timezone)}</b>\n` +
      pxTemplate`📁 پوشه فعال: <b>${escapeHtml(s.folder)}</b>\n` +
      pxTemplate`🤖 مدل: <b>${escapeHtml(s.model)}</b>`, settingsKb(), cq.message);
  }
  if (data === "help") { await ack(); return editOrSend(chatId, helpText(), backKb(), cq.message); }
  if (data === "usage") { await ack(); return handleUsageDashboard(chatId, userId, env); }
  if (data === "health") { await ack(pxText("در حال بررسی...")); return handleHealth(chatId, env); }

  // 🪄 فهرست حالت‌های تخصصی (Progressive Disclosure)
  if (data === "modes") {
    await ack();
    const cur = await getDb(env, `user:${userId}:mode`, null);
    return editOrSend(chatId,
      TGM.listPage({
        icon: "🪄", title: pxText("حالت‌های تخصصی"),
        sub: pxText("تا وقتی خارج نشوید، همهٔ پیام‌ها با حالت انتخابی پردازش می‌شوند."),
        body: TG.kv(pxText("حالت فعلی"), cur && STICKY_MODES[cur] ? STICKY_MODES[cur].label : pxText("چت هوشمند"))
      }),
      modesKb(cur), cq.message);
  }

  if (data.startsWith("mode:")) {
    await ack();
    const mode = data.slice(5);
    const info = STICKY_MODES[mode];
    if (!info) return;
    if (mode === "chat") {
      await delDb(env, `user:${userId}:mode`);
      return editOrSend(chatId, pxText("💬 <b>چت هوشمند فعال شد!</b>\n\nهر پیامی بفرستید تا هوش مصنوعی پاسخ دهد."), backKb(), cq.message);
    }
    // حالت چسبان: تا وقتی کاربر خارج نشود، همه پیام‌ها با این حالت پردازش می‌شوند
    await putDb(env, `user:${userId}:mode`, mode);
    return editOrSend(chatId,
      pxTemplate`${info.label} <b>فعال شد!</b> 🔒\n\n<i>${info.hint}</i>\n\n` +
      pxTemplate`💡 این حالت روی <b>همه پیام‌های بعدی</b> اعمال می‌شود تا وقتی خارج شوید.`,
      inlineKb([[{ text: pxText("❌ خروج از این حالت"), callback_data: "mode:chat" }], [{ text: pxText("‹ منو"), callback_data: "menu" }]]), cq.message);
  }

  if (data === "tools") { await ack(); return editOrSend(chatId, pxText("🧰 <b>جعبه‌ابزار</b>\n\n👇 ابزار مورد نظر را انتخاب کنید:"), toolsKb(), cq.message); }
  if (data === "chatmgmt") { await ack(); return editOrSend(chatId, pxText("🗂 <b>مدیریت چت</b>\n\n👇 انتخاب کنید:"), chatMgmtKb(), cq.message); }

  if (data === "models") {
    await ack();
    const s = await getUserSettings(env, userId);
    return sendMessage(chatId,
      pxTemplate`🤖 <b>انتخاب مدل هوش مصنوعی</b>\n\nمدل فعلی: <b>${escapeHtml(s.model)}</b>\n\n` +
      pxTemplate`🟩 = NVIDIA (رایگان) · 🔷 = Gemini\n` +
      pxTemplate`💡 <i>اگر مدل انتخابی خطا بدهد، خودکار به مدل سالم بعدی سوئیچ می‌شود.</i>`, modelsKb(s.model));
  }
  if (data.startsWith("setmodel:")) {
    const m = data.slice(9);
    await saveUserSettings(env, userId, { model: m });
    await ack(pxTemplate`✅ مدل: ${m === "auto" ? pxText("خودکار") : m.split("/").pop()}`);
    return sendMessage(chatId, pxTemplate`✅ مدل فعال: <b>${escapeHtml(m)}</b>`, backKb());
  }

  if (data.startsWith("tool:")) {
    await ack();
    const tool = data.slice(5);
    const toolInfo = {
      weather: pxText("🌤 <b>آب و هوا</b>\n\nنام شهر را بفرستید:\n<code>/weather Tehran</code>"),
      calc: pxText("🧮 <b>ماشین حساب</b>\n\nفرمول را بفرستید:\n<code>/calc (25*4)+100/2</code>"),
      convert: pxText("💱 <b>تبدیل ارز</b>\n\n<code>/convert 100 USD to EUR</code>"),
      map: pxText("🗺 <b>مسیریابی</b>\n\n<code>/map تهران to اصفهان</code>"),
      ocr: null, caption: null,
      voice: pxText("🎤 <b>رونویسی صدا</b>\n\nفقط یک ویس یا فایل صوتی بفرستید — خودکار رونویسی و پاسخ داده می‌شود."),
      pdf: pxText("📄 <b>خلاصه PDF</b>\n\nفقط فایل PDF را بفرستید — خودکار خلاصه می‌شود.\n(با کپشن می‌توانید سؤال خاصی بپرسید)")
    };
    if (tool === "ocr") {
      await putDb(env, `user:${userId}:pending`, "ocr");
      return sendMessage(chatId, pxText("🔤 <b>حالت OCR فعال شد!</b>\n\n📷 عکس حاوی متن را بفرستید..."), backKb());
    }
    if (tool === "caption") {
      await putDb(env, `user:${userId}:pending`, "caption");
      return sendMessage(chatId, pxText("🖼 <b>حالت توضیح عکس فعال شد!</b>\n\n📷 عکس را بفرستید..."), backKb());
    }
    return sendMessage(chatId, toolInfo[tool] || "🧰", backKb());
  }

  if (data === "showfavs") {
    await ack();
    const favs = await getDb(env, `user:${userId}:favorites`, []);
    if (!favs.length) return sendMessage(chatId, pxText("⭐ <i>لیست علاقه‌مندی‌ها خالی است.</i>"), backKb());
    let m = pxTemplate`⭐ <b>علاقه‌مندی‌ها (${favs.length}):</b>\n\n`;
    favs.slice(-10).forEach((p, i) => { m += `<b>${i + 1}.</b> ${escapeHtml(p.a.slice(0, 150))}...\n\n`; });
    return sendMessage(chatId, m, backKb());
  }
  if (data === "showpinned") {
    await ack();
    const pinned = await getDb(env, `user:${userId}:pinned`, []);
    if (!pinned.length) return sendMessage(chatId, pxText("📌 <i>چیزی پین نشده است.</i>"), backKb());
    let m = pxTemplate`📌 <b>پین‌شده‌ها (${pinned.length}):</b>\n\n`;
    pinned.slice(-10).forEach((p, i) => { m += `<b>${i + 1}.</b> ❓ <i>${escapeHtml(p.q.slice(0, 60))}</i>\n💬 ${escapeHtml(p.a.slice(0, 120))}...\n\n`; });
    return sendMessage(chatId, m, backKb());
  }
  if (data === "exportchat") {
    await ack(pxText("📤 در حال آماده‌سازی..."));
    const s = await getUserSettings(env, userId);
    const hist = await getHistory(env, userId, s.folder);
    if (!hist.length) return sendMessage(chatId, pxText("📤 <i>تاریخچه‌ای برای خروجی وجود ندارد.</i>"), backKb());
    const payload = JSON.stringify({ folder: s.folder, exported: new Date().toISOString(), messages: hist }, null, 2);
    return sendDocument(chatId, `history_${s.folder}_${todayStr()}.json`, payload, pxText("📤 خروجی تاریخچه چت"));
  }

  if (data === "copy") {
    return ack(pxText("📋 روی پیام نگه دارید و Copy را بزنید"), true);
  }
  if (data === "newchat") {
    await ack(pxText("🔄 چت جدید شروع شد"));
    const s = await getUserSettings(env, userId);
    await putDb(env, `user:${userId}:history:${s.folder}`, []);
    return sendMessage(chatId, pxText("🔄 <b>چت جدید شروع شد!</b>\n\nتاریخچه این پوشه پاک شد. پیام بفرستید..."), backKb());
  }
  if (data === "favorite") {
    const last = await getDb(env, `user:${userId}:last_answer`, null);
    if (!last) return ack(pxText("⚠️ پاسخی برای ذخیره نیست"), true);
    const favs = await getDb(env, `user:${userId}:favorites`, []);
    favs.push(last);
    await putDb(env, `user:${userId}:favorites`, favs.slice(-50));
    return ack(pxText("⭐ به علاقه‌مندی‌ها اضافه شد!"));
  }
  if (data === "pinchat") {
    const last = await getDb(env, `user:${userId}:last_answer`, null);
    if (!last) return ack(pxText("⚠️ چیزی برای پین نیست"), true);
    const pinned = await getDb(env, `user:${userId}:pinned`, []);
    pinned.push(last);
    await putDb(env, `user:${userId}:pinned`, pinned.slice(-30));
    return ack(pxText("📌 پین شد!"));
  }

  if (data === "think") {
    await ack();
    const s = await getUserSettings(env, userId);
    const rows = Object.entries(THINK_CONFIGS).map(([lvl, c]) =>
      [{ text: `${+lvl === s.thinkLevel ? "✅ " : ""}${c.label} — ${c.desc}`, callback_data: `think:${lvl}` }]);
    rows.push([{ text: pxText("🔙 بازگشت"), callback_data: "settings" }]);
    return sendMessage(chatId, pxText("💡 <b>سطح عمق تفکر را انتخاب کنید:</b>"), inlineKb(rows));
  }
  if (data.startsWith("think:")) {
    const lvl = +data.slice(6);
    await saveUserSettings(env, userId, { thinkLevel: lvl });
    return ack(pxTemplate`✅ عمق فکر: ${THINK_CONFIGS[lvl].label}`);
  }

  if (data === "persona") {
    await ack();
    const s = await getUserSettings(env, userId);
    const custom = await getDb(env, `user:${userId}:personas`, {});
    const all = [...Object.keys(BUILT_IN_PERSONAS), ...Object.keys(custom)];
    const rows = [];
    for (let i = 0; i < all.length; i += 2) {
      rows.push(all.slice(i, i + 2).map(p =>
        ({ text: `${p === s.persona ? "✅ " : "🎭 "}${p}`, callback_data: `persona:${p}` })));
    }
    rows.push([{ text: pxText("🔙 بازگشت"), callback_data: "settings" }]);
    return sendMessage(chatId, pxText("🎭 <b>شخصیت ربات را انتخاب کنید:</b>\n\n<i>افزودن شخصیت جدید:</i>\n<code>/persona add نام | توضیح شخصیت</code>"), inlineKb(rows));
  }
  if (data.startsWith("persona:")) {
    const p = data.slice(8);
    await saveUserSettings(env, userId, { persona: p });
    return ack(pxTemplate`✅ شخصیت: ${p}`);
  }

  if (data === "tz") {
    await ack();
    const zones = ["Asia/Tehran", "Asia/Dubai", "Europe/Istanbul", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"];
    const rows = [];
    for (let i = 0; i < zones.length; i += 2) {
      rows.push(zones.slice(i, i + 2).map(z => ({ text: z, callback_data: `tz:${z}` })));
    }
    rows.push([{ text: pxText("🔙 بازگشت"), callback_data: "settings" }]);
    return sendMessage(chatId, pxText("🌍 <b>منطقه زمانی را انتخاب کنید:</b>\n\n<i>یا دستی:</i> <code>/timezone Asia/Tehran</code>"), inlineKb(rows));
  }
  if (data.startsWith("tz:")) {
    const tz = data.slice(3);
    await saveUserSettings(env, userId, { timezone: tz });
    return ack(pxTemplate`✅ منطقه زمانی: ${tz}`);
  }

  if (data === "memory") {
    await ack();
    const mem = await getDb(env, `user:${userId}:memory`, "");
    const userData = await getDb(env, `user:${userId}:data`, []);
    return sendMessage(chatId,
      pxTemplate`🧠 <b>حافظه بلندمدت:</b>\n\n${mem ? `<blockquote>${escapeHtml(mem.slice(0, 2000))}</blockquote>` : pxText("<i>هنوز خالی است — با ادامه گفتگو خودکار پر می‌شود.</i>")}\n\n` +
      pxTemplate`👤 <b>اطلاعات ثبت‌شده شما:</b>\n${userData.length ? userData.map(d => `• ${escapeHtml(d)}`).join("\n") : pxText("<i>خالی — با /remember اضافه کنید</i>")}`,
      inlineKb([[{ text: pxText("🗑 پاک کردن حافظه"), callback_data: "clearmem" }], [{ text: pxText("🔙 بازگشت"), callback_data: "settings" }]]));
  }
  if (data === "clearmem") {
    await ack(pxText("🗑 حافظه پاک شد"));
    const s = await getUserSettings(env, userId);
    await delDb(env, `user:${userId}:memory`);
    await putDb(env, `user:${userId}:history:${s.folder}`, []);
    return sendMessage(chatId, pxText("🗑 <b>حافظه و تاریخچه این پوشه پاک شد.</b>"), backKb());
  }
  if (data === "sysprompt") {
    await ack();
    const s = await getUserSettings(env, userId);
    return sendMessage(chatId,
      pxTemplate`⚙️ <b>سیستم‌پرامپت فعلی:</b>\n\n${s.systemPrompt ? `<blockquote>${escapeHtml(s.systemPrompt)}</blockquote>` : pxText("<i>تنظیم نشده</i>")}\n\n` +
      pxTemplate`📝 تنظیم: <code>/setprompt متن دلخواه</code>\n🗑 حذف: <code>/setprompt clear</code>`, backKb());
  }
  if (data === "schedules") { await ack(); return handleCalendar(env, chatId, userId); }
  if (data === "reminders") { await ack(); return handleCalendar(env, chatId, userId); }
  if (data === "notes") {
    await ack();
    const notes = await getDb(env, `user:${userId}:notes`, []);
    return sendMessage(chatId,
      pxTemplate`📝 <b>یادداشت‌های شما (${notes.length}):</b>\n\n` +
      (notes.length ? notes.map((n, i) => `<b>${i + 1}.</b> ${escapeHtml(n.text)} <i>(${new Date(n.ts).toISOString().split("T")[0]})</i>`).join("\n") : pxText("<i>خالی است</i>")) +
      pxTemplate`\n\n➕ <code>/note add متن</code>\n🗑 <code>/note delete شماره</code>`, backKb());
  }
  if (data === "folders") {
    await ack();
    const s = await getUserSettings(env, userId);
    const folders = await getDb(env, `user:${userId}:folders`, ["default"]);
    const rows = folders.map(f => [{ text: `${f === s.folder ? "✅ " : "📁 "}${f}`, callback_data: `folder:${f}` }]);
    rows.push([{ text: pxText("🔙 منو"), callback_data: "menu" }]);
    return sendMessage(chatId, pxTemplate`📁 <b>پوشه‌های چت:</b>\n\n➕ ساخت پوشه: <code>/folder create نام</code>`, inlineKb(rows));
  }
  if (data.startsWith("folder:")) {
    const f = data.slice(7);
    await saveUserSettings(env, userId, { folder: f });
    return ack(pxTemplate`✅ پوشه فعال: ${f}`);
  }
  if (data.startsWith("model:")) {
    const m = data.slice(6);
    await saveUserSettings(env, userId, { model: m });
    return ack(pxTemplate`✅ مدل: ${m.split("/").pop()}`);
  }

  // ── 👤 پروفایل ──
  if (data === "profile") {
    await ack();
    const p = await getProfile(env, userId);
    return sendMessage(chatId, profileText(p) + pxText("\n\n👇 برای ویرایش هر فیلد روی آن بزنید:"), profileKb());
  }
  if (data.startsWith("prof:")) {
    const field = data.slice(5);
    if (field === "clear") {
      await delDb(env, `user:${userId}:profile`);
      await ack(pxText("🗑 پروفایل پاک شد"));
      return sendMessage(chatId, pxText("🗑 <b>پروفایل شما پاک شد.</b>"), backKb());
    }
    if (!PROFILE_FIELDS[field]) return ack();
    await ack();
    await putDb(env, `user:${userId}:wizard`, { type: "profile", field });
    return sendMessage(chatId, pxTemplate`✏️ ${PROFILE_FIELDS[field].label}\n\n<i>${PROFILE_FIELDS[field].q}</i>\n\n(لغو: /cancel)`);
  }

  // ── 🧠 حافظه‌های ساختاریافته ──
  if (data === "memories") {
    await ack();
    const mems = await getMemories(env, userId);
    return sendMessage(chatId, memoriesText(mems) + pxTemplate`\n\n➕ افزودن: <code>/remember work متن</code>\nدسته‌ها: personal, work, education, projects, preferences`,
      inlineKb([[{ text: pxText("🗑 پاک کردن همه حافظه‌ها"), callback_data: "mems:clear" }], [{ text: pxText("🔙 منو"), callback_data: "menu" }]]));
  }
  if (data === "mems:clear") {
    await delDb(env, `user:${userId}:memories`);
    await ack(pxText("🗑 همه حافظه‌ها پاک شد"));
    return sendMessage(chatId, pxText("🗑 <b>همه حافظه‌های ساختاریافته پاک شدند.</b>"), backKb());
  }

  // ── 🚀 اپ‌ساز ──
  if (data === "apps") {
    await ack();
    const apps = await getApps(env, userId);
    return sendMessage(chatId,
      pxTemplate`🚀 <b>اپ‌های هوش مصنوعی شما (${apps.length}):</b>\n\n` +
      (apps.length
        ? apps.map(a => pxTemplate`▪️ <b>${escapeHtml(a.name)}</b> — <i>${escapeHtml((a.desc || "").slice(0, 50))}</i> (${a.runs || 0} اجرا)`).join("\n")
        : pxText("<i>هنوز اپی نساخته‌اید. یک‌بار پرامپت مادر را بسازید، بی‌نهایت بار اجرا کنید!</i>")),
      appsListKb(apps));
  }
  if (data === "app:new") {
    await ack();
    await putDb(env, `user:${userId}:wizard`, { type: "app", step: "name", draft: {} });
    return sendMessage(chatId,
      pxTemplate`🚀 <b>ساخت اپ جدید — قدم ۱ از ۴</b>\n\n📛 <b>نام اپ</b> را بنویسید:\n<i>مثلاً: مترجم فارسی، تولید کپشن اینستاگرام، بازنویس ایمیل</i>\n\n(لغو: /cancel)`);
  }
  if (data.startsWith("app:")) {
    const [, action, id] = data.split(":");
    const apps = await getApps(env, userId);
    const app = apps.find(a => a.id === id);
    if (!app) { await ack(pxText("⚠️ اپ یافت نشد"), true); return; }
    if (action === "run") {
      await ack(`▶️ ${app.name}`);
      await putDb(env, `user:${userId}:mode`, `app:${id}`);
      return sendMessage(chatId,
        pxTemplate`▶️ <b>اپ «${escapeHtml(app.name)}» فعال شد!</b> 🔒\n\n` +
        `<i>${escapeHtml(app.desc || "")}</i>\n` +
        (app.input ? pxTemplate`\n📥 <b>ورودی:</b> ${escapeHtml(app.input)}\n` : "") +
        pxTemplate`\n💡 هر پیامی بفرستید با پرامپت این اپ پردازش می‌شود.`,
        inlineKb([[{ text: pxText("❌ خروج از اپ"), callback_data: "mode:chat" }], [{ text: pxText("🔙 منو"), callback_data: "menu" }]]));
    }
    if (action === "opt") {
      await ack();
      return sendMessage(chatId,
        pxTemplate`⚙️ <b>${escapeHtml(app.name)}</b>\n\n📝 ${escapeHtml(app.desc || "—")}\n🤖 مدل: <b>${escapeHtml(app.model || "auto")}</b>\n🔁 اجراها: ${app.runs || 0}\n\n<b>پرامپت مادر:</b>\n<blockquote>${escapeHtml(app.prompt.slice(0, 500))}</blockquote>`,
        appOptionsKb(id));
    }
    if (action === "del") {
      await saveApps(env, userId, apps.filter(a => a.id !== id));
      await ack(pxText("🗑 اپ حذف شد"));
      return sendMessage(chatId, pxTemplate`🗑 اپ <b>${escapeHtml(app.name)}</b> حذف شد.`, backKb());
    }
    if (action === "dup") {
      const copy = { ...app, id: uid(), name: app.name + pxText(" (کپی)"), runs: 0, ts: Date.now() };
      apps.push(copy);
      await saveApps(env, userId, apps);
      await ack(pxText("📑 کپی شد"));
      return sendMessage(chatId, pxTemplate`📑 اپ <b>${escapeHtml(copy.name)}</b> ساخته شد.`, appsListKb(apps));
    }
    if (action === "share") {
      await ack();
      const payload = JSON.stringify({ name: app.name, desc: app.desc, prompt: app.prompt, model: app.model, input: app.input, output: app.output });
      return sendMessage(chatId,
        pxTemplate`📤 <b>کد اشتراک اپ «${escapeHtml(app.name)}»:</b>\n\n<pre>${escapeHtml(payload)}</pre>\n\n` +
        pxTemplate`گیرنده کافی است بفرستد:\n<code>/appimport کد بالا</code>`, backKb());
    }
    if (action === "editp") {
      await ack();
      await putDb(env, `user:${userId}:wizard`, { type: "app_editp", id });
      return sendMessage(chatId, pxTemplate`📝 <b>پرامپت مادر جدید برای «${escapeHtml(app.name)}» را بفرستید:</b>\n\n<i>فعلی:</i>\n<blockquote>${escapeHtml(app.prompt.slice(0, 400))}</blockquote>\n\n(لغو: /cancel)`);
    }
    if (action === "model") {
      await ack();
      const models = ["auto", ...new Set(Object.values(MODEL_CATEGORIES).flat())];
      const rows = models.map(m => [{ text: `${(app.model || "auto") === m ? "✅ " : ""}${m === "auto" ? pxText("🤖 خودکار") : m.split("/").pop()}`, callback_data: `appm:${id}:${m}`.slice(0, 64) }]);
      rows.push([{ text: pxText("🔙 بازگشت"), callback_data: `app:opt:${id}` }]);
      return sendMessage(chatId, pxTemplate`🤖 <b>مدل اختصاصی اپ «${escapeHtml(app.name)}»:</b>`, inlineKb(rows));
    }
  }
  if (data.startsWith("appm:")) {
    const parts = data.split(":");
    const id = parts[1];
    const model = parts.slice(2).join(":");
    const apps = await getApps(env, userId);
    const app = apps.find(a => a.id === id);
    if (!app) return ack(pxText("⚠️ اپ یافت نشد"), true);
    app.model = model;
    await saveApps(env, userId, apps);
    return ack(pxTemplate`✅ مدل اپ: ${model === "auto" ? pxText("خودکار") : model.split("/").pop()}`);
  }

  // ── 💾 مدیریت پرامپت‌ها ──
  if (data === "myprompts") {
    await ack();
    const prompts = await getPrompts(env, userId);
    return sendMessage(chatId,
      pxTemplate`💾 <b>پرامپت‌های ذخیره‌شده (${prompts.length}):</b>\n\n` +
      (prompts.length
        ? prompts.map(p => `▪️ <b>${escapeHtml(p.name)}</b> [${escapeHtml(p.cat || pxText("عمومی"))}]${extractVars(p.text).length ? pxTemplate` — متغیرها: {${extractVars(p.text).join("}, {")}}` : ""}`).join("\n")
        : pxText("<i>خالی. پرامپت با متغیر هم می‌توانید بسازید:\n«پست لینکدین درباره {موضوع} بنویس»</i>")),
      promptsListKb(prompts));
  }
  if (data === "pr:new") {
    await ack();
    await putDb(env, `user:${userId}:wizard`, { type: "prompt_new", step: "name", draft: {} });
    return sendMessage(chatId,
      pxTemplate`💾 <b>ذخیره پرامپت — قدم ۱ از ۲</b>\n\n📛 نام پرامپت (و در صورت تمایل دسته با |):\n<code>پست لینکدین | کاری</code>\n\n(لغو: /cancel)`);
  }
  if (data.startsWith("pr:")) {
    const [, action, id] = data.split(":");
    const prompts = await getPrompts(env, userId);
    const pr = prompts.find(p => p.id === id);
    if (!pr) return ack(pxText("⚠️ یافت نشد"), true);
    if (action === "del") {
      await putDb(env, `user:${userId}:prompts`, prompts.filter(p => p.id !== id));
      return ack(pxText("🗑 حذف شد"));
    }
    if (action === "run") {
      const vars = extractVars(pr.text);
      if (!vars.length) { await ack(pxText("▶️ اجرا...")); return aiReply(env, chatId, userId, pr.text); }
      await ack();
      await putDb(env, `user:${userId}:wizard`, { type: "prompt_vars", promptId: id, vars, idx: 0, values: {} });
      return sendMessage(chatId, pxTemplate`▶️ <b>${escapeHtml(pr.name)}</b>\n\n✏️ مقدار <b>{${escapeHtml(vars[0])}}</b> را بنویسید:\n\n(لغو: /cancel)`);
    }
  }

  // ── 📚 پایگاه دانش ──
  if (data === "kb") {
    await ack();
    const index = await getDb(env, `user:${userId}:kb:index`, []);
    const rows = index.map(d => [{ text: pxTemplate`🗑 ${d.name.slice(0, 30)} (${d.chunks} قطعه)`, callback_data: `kbdel:${d.docId}` }]);
    rows.push([{ text: pxText("❓ پرسش از دانش"), callback_data: "mode:kb" }], [{ text: pxText("🔙 منو"), callback_data: "menu" }]);
    return sendMessage(chatId,
      pxTemplate`📚 <b>پایگاه دانش شخصی شما (${index.length}/10 سند):</b>\n\n` +
      (index.length ? index.map(d => pxTemplate`📄 <b>${escapeHtml(d.name)}</b> — ${d.chunks} قطعه`).join("\n") : pxText("<i>خالی است.</i>")) +
      pxTemplate`\n\n➕ <b>افزودن سند:</b> فایل PDF یا متنی را با کپشن <code>/kb</code> بفرستید.\n❓ <b>پرسش:</b> <code>/ask سؤال شما</code>\n\n🔒 <i>دانش شما کاملاً خصوصی و ایزوله است.</i>`,
      inlineKb(rows));
  }
  if (data.startsWith("kbdel:")) {
    const docId = data.slice(6);
    const index = await getDb(env, `user:${userId}:kb:index`, []);
    await delDb(env, `user:${userId}:kb:doc:${docId}`);
    await putDb(env, `user:${userId}:kb:index`, index.filter(d => d.docId !== docId));
    await ack(pxText("🗑 سند حذف شد"));
    return sendMessage(chatId, pxText("🗑 <b>سند از پایگاه دانش حذف شد.</b>"), backKb());
  }

  // ── 🔐 داده‌ها ──
  if (data === "deleteme") {
    await ack();
    return sendMessage(chatId,
      pxTemplate`⚠️ <b>حذف دائمی همه داده‌ها</b>\n\nهمه چیز پاک می‌شود: تاریخچه، حافظه‌ها، پروفایل، اپ‌ها، پرامپت‌ها، دانش، یادآورها.\n\n<b>این عمل برگشت‌ناپذیر است!</b>`,
      inlineKb([[{ text: pxText("❌ انصراف"), callback_data: "menu" }, { text: pxText("🗑 بله، همه را پاک کن"), callback_data: "delme:yes" }]]));
  }
  if (data === "delme:yes") {
    await ack(pxText("در حال حذف..."));
    await deleteAllUserData(env, userId);
    return sendMessage(chatId, pxText("✅ <b>همه داده‌های شما برای همیشه حذف شدند.</b>\n\nبرای شروع دوباره: /start"));
  }

  // ── 💬 لیست چت‌ها با عنوان خودکار ──
  if (data === "chats") {
    await ack();
    const s = await getUserSettings(env, userId);
    const folders = await getDb(env, `user:${userId}:folders`, ["default"]);
    const rows = [];
    let txt = pxTemplate`💬 <b>چت‌های شما:</b>\n\n`;
    for (const f of folders) {
      const title = await getDb(env, `user:${userId}:foldertitle:${f}`, null);
      const hist = await getHistory(env, userId, f);
      txt += pxTemplate`${f === s.folder ? "✅" : "📁"} <b>${escapeHtml(f)}</b>${title ? ` — <i>${escapeHtml(title)}</i>` : ""} (${hist.length} پیام)\n`;
      rows.push([{ text: `${f === s.folder ? "✅ " : "📁 "}${title || f}`.slice(0, 40), callback_data: `folder:${f}` }]);
    }
    rows.push([{ text: pxText("🔙 منو"), callback_data: "menu" }]);
    return sendMessage(chatId, txt + pxTemplate`\n➕ چت جدید: <code>/folder create نام</code>`, inlineKb(rows));
  }

  await ack();
}

// ─────────────────────────────────────────────
// 👑 دستورات ادمین
// ─────────────────────────────────────────────
async function handleAdminCommand(env, chatId, userId, cmd, args) {
  if (userId !== ADMIN_ID) {
    await sendMessage(chatId, pxText("⛔️ <b>این دستور مخصوص ادمین است.</b>"));
    return true;
  }
  switch (cmd) {
    case "/broadcast": {
      if (!args) return sendMessage(chatId, pxText("📢 فرمت: <code>/broadcast متن پیام</code>")), true;
      const users = await getDb(env, "global:users", []);
      let ok = 0, fail = 0;
      for (const u of users) {
        const r = await sendTG("sendMessage", { chat_id: u, text: pxTemplate`📢 <b>اطلاعیه:</b>\n\n${mdToHtml(args)}`, parse_mode: "HTML" });
        r.ok ? ok++ : fail++;
      }
      await sendMessage(chatId, pxTemplate`📢 <b>ارسال همگانی انجام شد!</b>\n\n✅ موفق: ${ok}\n❌ ناموفق: ${fail}`);
      return true;
    }
    case "/ban": {
      const id = parseInt(args);
      if (!id) return sendMessage(chatId, pxText("فرمت: <code>/ban 123456</code>")), true;
      const banned = await getDb(env, "global:banned", []);
      if (!banned.includes(id)) banned.push(id);
      await putDb(env, "global:banned", banned);
      await sendMessage(chatId, pxTemplate`🚫 کاربر <code>${id}</code> مسدود شد.`);
      return true;
    }
    case "/unban": {
      const id = parseInt(args);
      const banned = await getDb(env, "global:banned", []);
      await putDb(env, "global:banned", banned.filter(b => b !== id));
      await sendMessage(chatId, pxTemplate`✅ کاربر <code>${id}</code> رفع مسدودیت شد.`);
      return true;
    }
    case "/listusers": {
      const users = await getDb(env, "global:users", []);
      const banned = await getDb(env, "global:banned", []);
      await sendMessage(chatId,
        pxTemplate`👥 <b>آمار کاربران:</b>\n\n` +
        pxTemplate`📊 کل کاربران: <b>${users.length}</b>\n🚫 مسدود: <b>${banned.length}</b>\n\n` +
        `<pre>${users.slice(-50).join("\n")}</pre>`);
      return true;
    }
    case "/setglobalprompt": {
      await putDb(env, "global:prompt", args || "");
      await sendMessage(chatId, args ? pxText("✅ پرامپت سراسری ثبت شد.") : pxText("🗑 پرامپت سراسری پاک شد."));
      return true;
    }
    case "/setglobalmemory": {
      await putDb(env, "global:memory", args || "");
      await sendMessage(chatId, args ? pxText("✅ حافظه سراسری ثبت شد.") : pxText("🗑 حافظه سراسری پاک شد."));
      return true;
    }
    case "/plugin": {
      const m = args.match(/^(enable|disable)\s+(\w+)/i);
      if (!m) return sendMessage(chatId, pxText("فرمت: <code>/plugin enable Weather</code>")), true;
      const plugins = await getDb(env, "global:plugins", DEFAULT_PLUGINS);
      const name = Object.keys(DEFAULT_PLUGINS).find(p => p.toLowerCase() === m[2].toLowerCase());
      if (!name) return sendMessage(chatId, pxTemplate`⚠️ پلاگین <code>${escapeHtml(m[2])}</code> وجود ندارد.`), true;
      plugins[name] = m[1].toLowerCase() === "enable";
      await putDb(env, "global:plugins", plugins);
      await sendMessage(chatId, pxTemplate`${plugins[name] ? "✅" : "🔌"} پلاگین <b>${name}</b> ${plugins[name] ? pxText("فعال") : pxText("غیرفعال")} شد.`);
      return true;
    }
    case "/clearallhistory": {
      const users = await getDb(env, "global:users", []);
      for (const u of users) {
        const folders = await getDb(env, `user:${u}:folders`, ["default"]);
        for (const f of folders) await delDb(env, `user:${u}:history:${f}`);
        await delDb(env, `user:${u}:memory`);
      }
      await sendMessage(chatId, pxTemplate`🗑 <b>تاریخچه و حافظه همه ${users.length} کاربر پاک شد.</b>`);
      return true;
    }
    case "/testmodels": {
      await sendMessage(chatId, pxText("🔬 <b>تست زنده همه مدل‌ها شروع شد...</b>\n<i>حدود ۱ دقیقه صبر کنید.</i>"));
      const results = await runModelSweep();
      const okList = results.filter(r => r.ok);
      const badList = results.filter(r => !r.ok);
      let msg = pxTemplate`🔬 <b>نتیجه تست ${results.length} مدل:</b>\n\n`;
      msg += pxTemplate`🟢 <b>سالم (${okList.length}):</b>\n` + okList.map(r => `• <code>${escapeHtml(r.model)}</code> — ${r.ms}ms`).join("\n");
      if (badList.length) {
        msg += pxTemplate`\n\n🔴 <b>خراب — خودکار غیرفعال شدند (${badList.length}):</b>\n` +
          badList.map(r => `• <code>${escapeHtml(r.model)}</code> [${r.status}]`).join("\n");
      }
      await sendMessage(chatId, msg, backKb());
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────
// 📋 مدیریت دستورات کاربر
// ─────────────────────────────────────────────
function askLanguage(chatId) {
  return sendMessage(chatId, '🌐 <b>Choose your language / زبان خود را انتخاب کن</b>\n\nEnglish or فارسی؟\nYour choice will be saved. / انتخابت ذخیره می‌شود.', inlineKb([
    [{ text: '🇬🇧 English', callback_data: 'language:en' }, { text: '🇮🇷 فارسی', callback_data: 'language:fa' }]
  ]));
}

async function configureLanguageMenu(chatId, language) {
  const result = await sendTG('getMyCommands', {});
  const fallback = [
    { command: 'start', description: 'شروع' },
    { command: 'app', description: 'مینی‌اپ' },
    { command: 'menu', description: 'منوی اصلی' },
    { command: 'models', description: 'مدل‌ها' },
    { command: 'settings', description: 'تنظیمات' },
    { command: 'backup', description: 'پشتیبان' },
    { command: 'restore', description: 'بازیابی' },
    { command: 'help', description: 'راهنما' }
  ];
  const commands = (Array.isArray(result.result) ? result.result : fallback)
    .filter(c => c.command !== 'language')
    .map(c => ({ command: c.command, description: translateLiteral(c.description, language).slice(0, 256) }));
  commands.push({ command: 'language', description: language === 'en' ? 'Change language' : 'تغییر زبان' });
  await sendTG('setMyCommands', { scope: { type: 'chat', chat_id: chatId }, commands });
  await sendTG('setChatMenuButton', { chat_id: chatId, menu_button: { type: 'web_app', text: language === 'en' ? 'Open workspace' : 'مینی‌اپ', web_app: { url: MINIAPP_URL } } });
}

async function handleCommand(env, chatId, userId, text) {
  const space = text.indexOf(" ");
  const cmd = (space === -1 ? text : text.slice(0, space)).toLowerCase().replace(/@\w+$/, "");
  const args = space === -1 ? "" : text.slice(space + 1).trim();
  const isAdmin = userId === ADMIN_ID;
  const settings = await getUserSettings(env, userId);

  // 🛰 دستورات پلتفرم زیرساخت (اگر مدیریت کرد، خارج شو)
  if (PLATFORM_COMMANDS.includes(cmd)) {
    if (await handlePlatformCommand(env, chatId, userId, cmd, args, { appUrl: MINIAPP_URL })) return;
  }

  switch (cmd) {
    case '/language':
    case '/lang':
      return askLanguage(chatId);
    case "/backup":
    case "/backupdb":
      return sendUserBackup(env, chatId, userId, cmd === "/backupdb" ? "database" : "account");
    case "/restore":
      if (Number(chatId) !== Number(userId)) return sendMessage(chatId, pxText("🔒 بازیابی را در گفتگوی خصوصی انجام دهید."));
      await putDb(env, `user:${userId}:pending`, "restore");
      return sendMessage(chatId, pxText("📥 <b>اطلاعاتت را همراهت بیاور</b>\n\nفایل <code>pimx-account-…json</code> یا پشتیبان دیتابیس را بفرست؛ می‌توانی کپشن <code>/restore</code> بگذاری.\n\n<blockquote>اول خلاصهٔ فایل را می‌بینی، بعد انتقال را تأیید می‌کنی. گفتگوها و اطلاعات فعلی‌ات حفظ می‌شوند.</blockquote>\n\n<i>لغو: /cancel</i>"), backKb());
    case "/format":
      return sendMessage(chatId, pxText("✦ <b>قالب‌بندی بومی تلگرام</b>\n\n<b>متن برجسته</b> · <i>متن مورب</i> · <u>زیرخط</u>\n<s>خط‌خورده</s> · <code>متن تک‌عرض</code> · <tg-spoiler>متن مخفی؛ لمس کن</tg-spoiler>\n\n<blockquote>نقل‌قول برای نکته‌های مهم و خلاصهٔ نتیجه</blockquote>\n<blockquote expandable>نقل‌قول بازشونده\nجزئیات بیشتر با لمس پیام نمایش داده می‌شود.\nپیام‌های بلند هم قالب‌بندی خود را حفظ می‌کنند.</blockquote>\n\n<a href=\"https://core.telegram.org/bots/api#formatting-options\">لینک قابل کلیک</a>\n") + TG.date(Date.now() / 1000, pxText("زمان فعلی"), "wDT"), backKb());
    case "/start": {
      if (!await savedLanguage(env, userId)) return askLanguage(chatId);
      if (Number(chatId) === Number(userId)) await configureLanguageMenu(chatId, settings.language);
      await delDb(env, `user:${userId}:pending`);
      await delDb(env, `user:${userId}:mode`);
      const welcomeText = [
        TG.title("✦", pxText("PIMX · فضای هوشمند تو")),
        TG.i(pxText("از یک سؤال ساده تا ایده‌های بزرگ.")),
        "",
        pxText("<blockquote>بنویس، ویس بفرست یا فایلت را به من بده؛ با هم جلو می‌رویم.</blockquote>"),
        "",
        pxText("💬 <b>گفتگو و جستجو</b> با انتخاب مدل دلخواه"),
        pxText("🧠 <b>حافظهٔ شخصی</b> و پاسخ از اسناد تو"),
        pxText("⚡ <b>ابزارهای کاربردی</b>، شورا و کارهای خودکار"),
        pxText("💾 <b>اطلاعات همراهت</b>؛ پشتیبان و انتقال به حساب دیگر"),
        "",
        TG.i(pxText("مینی‌اپ را باز کن یا همین‌جا پیام بده.")),
        pxText("<code>/format</code> نمونهٔ قالب‌بندی · <code>/help</code> راهنما")
      ].join("\n");
      await sendMessage(chatId, welcomeText, replyKb());
      return sendMessage(chatId, TG.title("📋", pxText("منوی اصلی PIMXAGENT")), mainMenuKb(userId));
    }
    case "/menu":
      await delDb(env, `user:${userId}:pending`);
      await delDb(env, `user:${userId}:mode`);
      return sendMessage(chatId, TG.title("📋", pxText("منوی اصلی PIMXAGENT")), mainMenuKb(userId));
    case "/mode": {
      const cur = await getDb(env, `user:${userId}:mode`, null);
      const rows = Object.entries(STICKY_MODES).map(([k, v]) =>
        [{ text: `${cur === k || (!cur && k === "chat") ? "✅ " : ""}${v.label}`, callback_data: `mode:${k}` }]);
      rows.push([{ text: pxText("🔙 منو"), callback_data: "menu" }]);
      return sendMessage(chatId, pxText("🎛 <b>حالت کاری ربات را انتخاب کنید:</b>\n\n<i>حالت انتخابی روی همه پیام‌های بعدی اعمال می‌شود.</i>"), inlineKb(rows));
    }
    case "/grammar": {
      const m = cmd.slice(1);
      if (args) return aiReply(env, chatId, userId, STICKY_MODES[m].wrap(args));
      await putDb(env, `user:${userId}:mode`, m);
      return sendMessage(chatId, pxTemplate`${STICKY_MODES[m].label} <b>فعال شد!</b> 🔒\n\n<i>${STICKY_MODES[m].hint}</i>`,
        inlineKb([[{ text: pxText("❌ خروج از این حالت"), callback_data: "mode:chat" }]]));
    }
    case "/help": return sendMessage(chatId, helpText(), backKb());
    case "/about": return sendMessage(chatId, aboutText(), backKb());

    case "/setprompt": {
      if (!args) return sendMessage(chatId, pxText("⚙️ فرمت: <code>/setprompt متن سیستم‌پرامپت</code>\nحذف: <code>/setprompt clear</code>"));
      await saveUserSettings(env, userId, { systemPrompt: args === "clear" ? "" : args });
      return sendMessage(chatId, args === "clear" ? pxText("🗑 سیستم‌پرامپت پاک شد.") : pxText("✅ <b>سیستم‌پرامپت ثبت شد!</b>"), backKb());
    }
    case "/getprompt":
      return sendMessage(chatId,
        pxTemplate`⚙️ <b>سیستم‌پرامپت فعلی:</b>\n\n${settings.systemPrompt ? `<blockquote>${escapeHtml(settings.systemPrompt)}</blockquote>` : pxText("<i>تنظیم نشده</i>")}`, backKb());

    case "/think": {
      const lvl = parseInt(args);
      if (lvl >= 1 && lvl <= 5) {
        await saveUserSettings(env, userId, { thinkLevel: lvl });
        return sendMessage(chatId, pxTemplate`✅ عمق فکر: <b>${THINK_CONFIGS[lvl].label}</b> — <i>${THINK_CONFIGS[lvl].desc}</i>`, backKb());
      }
      const rows = Object.entries(THINK_CONFIGS).map(([l, c]) =>
        [{ text: `${+l === settings.thinkLevel ? "✅ " : ""}${c.label} — ${c.desc}`, callback_data: `think:${l}` }]);
      rows.push([{ text: pxText("🔙 منو"), callback_data: "menu" }]);
      return sendMessage(chatId, pxText("💡 <b>سطح تفکر را انتخاب کنید:</b>"), inlineKb(rows));
    }

    case "/persona": {
      const custom = await getDb(env, `user:${userId}:personas`, {});
      if (args.startsWith("list") || !args) {
        const all = { ...BUILT_IN_PERSONAS, ...custom };
        return sendMessage(chatId,
          pxTemplate`🎭 <b>شخصیت‌ها:</b> (فعلی: <b>${escapeHtml(settings.persona)}</b>)\n\n` +
          Object.entries(all).map(([k, v]) => `${k === settings.persona ? "✅" : "•"} <b>${escapeHtml(k)}</b>: <i>${escapeHtml(v.slice(0, 60))}...</i>`).join("\n") +
          pxTemplate`\n\n📝 <code>/persona set نام</code>\n➕ <code>/persona add نام | توضیح</code>`, backKb());
      }
      if (args.startsWith("set ")) {
        const name = args.slice(4).trim();
        if (!BUILT_IN_PERSONAS[name] && !custom[name]) return sendMessage(chatId, pxTemplate`⚠️ شخصیت <code>${escapeHtml(name)}</code> وجود ندارد.`);
        await saveUserSettings(env, userId, { persona: name });
        return sendMessage(chatId, pxTemplate`✅ شخصیت فعال: <b>${escapeHtml(name)}</b> 🎭`, backKb());
      }
      if (args.startsWith("add ")) {
        const m = args.slice(4).split("|");
        if (m.length < 2) return sendMessage(chatId, pxText("فرمت: <code>/persona add نام | توضیح شخصیت</code>"));
        const name = m[0].trim();
        custom[name] = m.slice(1).join("|").trim();
        await putDb(env, `user:${userId}:personas`, custom);
        return sendMessage(chatId, pxTemplate`✅ شخصیت <b>${escapeHtml(name)}</b> ساخته شد!\nفعال‌سازی: <code>/persona set ${escapeHtml(name)}</code>`, backKb());
      }
      return sendMessage(chatId, "🎭 <code>/persona list|set|add</code>");
    }

    case "/preset": {
      const presets = await getDb(env, `user:${userId}:presets`, {});
      if (args.startsWith("save ")) {
        const m = args.slice(5).split("|");
        if (m.length < 2) return sendMessage(chatId, pxText("فرمت: <code>/preset save نام | متن پرامپت</code>"));
        presets[m[0].trim()] = m.slice(1).join("|").trim();
        await putDb(env, `user:${userId}:presets`, presets);
        return sendMessage(chatId, pxTemplate`✅ پریست <b>${escapeHtml(m[0].trim())}</b> ذخیره شد!`, backKb());
      }
      if (args.startsWith("use ")) {
        const name = args.slice(4).trim();
        if (!presets[name]) return sendMessage(chatId, pxTemplate`⚠️ پریست <code>${escapeHtml(name)}</code> یافت نشد.`);
        return aiReply(env, chatId, userId, presets[name]);
      }
      return sendMessage(chatId,
        pxTemplate`📋 <b>پریست‌های شما (${Object.keys(presets).length}):</b>\n\n` +
        (Object.keys(presets).length ? Object.entries(presets).map(([k, v]) => `• <b>${escapeHtml(k)}</b>: <i>${escapeHtml(v.slice(0, 50))}...</i>`).join("\n") : pxText("<i>خالی</i>")) +
        pxTemplate`\n\n💾 <code>/preset save نام | متن</code>\n▶️ <code>/preset use نام</code>`, backKb());
    }

    case "/timezone": {
      if (!args) return sendMessage(chatId, pxTemplate`🌍 منطقه زمانی فعلی: <b>${escapeHtml(settings.timezone)}</b>\n\nتغییر: <code>/timezone Asia/Tehran</code>`);
      try {
        new Intl.DateTimeFormat("en", { timeZone: args });
        await saveUserSettings(env, userId, { timezone: args });
        return sendMessage(chatId, pxTemplate`✅ منطقه زمانی: <b>${escapeHtml(args)}</b>\n🕐 ساعت محلی شما: <b>${tzLocalHHMM(args)}</b>`, backKb());
      } catch {
        return sendMessage(chatId, pxTemplate`⚠️ منطقه زمانی <code>${escapeHtml(args)}</code> نامعتبر است.\nمثال: <code>Asia/Tehran</code>`);
      }
    }

    case "/remind": return handleRemind(env, chatId, userId, args);
    case "/schedule": return handleSchedule(env, chatId, userId, args);
    case "/calendar": return handleCalendar(env, chatId, userId);

    case "/remember": {
      if (!args) return sendMessage(chatId,
        pxTemplate`🧠 <b>ثبت حافظه:</b>\n\n<code>/remember من برنامه‌نویس هستم</code>\n` +
        pxTemplate`<code>/remember work پروژه فعلی‌ام ربات تلگرام است</code>\n\n` +
        pxTemplate`دسته‌ها: personal، work، education، projects، preferences`);
      const firstWord = args.split(/\s+/)[0].toLowerCase();
      const cat = MEMORY_CATS[firstWord] ? firstWord : "personal";
      const memText = MEMORY_CATS[firstWord] ? args.slice(firstWord.length).trim() : args;
      await addMemory(env, userId, cat, memText);
      return sendMessage(chatId,
        pxTemplate`✅ <b>در حافظه ${MEMORY_CATS[cat]} ثبت شد!</b> 🧠\n\n<i>«${escapeHtml(memText)}»</i>\n\nمشاهده همه: /memories`, backKb());
    }
    case "/memories": {
      const mems = await getMemories(env, userId);
      return sendMessage(chatId, memoriesText(mems),
        inlineKb([[{ text: pxText("🗑 پاک کردن همه"), callback_data: "mems:clear" }], [{ text: pxText("🔙 منو"), callback_data: "menu" }]]));
    }
    case "/memdel": {
      const mems = await getMemories(env, userId);
      const filtered = mems.filter(m => m.id !== args.trim());
      if (filtered.length === mems.length) return sendMessage(chatId, pxText("⚠️ حافظه با این شناسه یافت نشد. /memories را ببینید."));
      await putDb(env, `user:${userId}:memories`, filtered);
      return sendMessage(chatId, pxText("🗑 <b>حافظه حذف شد.</b>"), backKb());
    }
    case "/memedit": {
      const m2 = args.match(/^(\S+)\s+([\s\S]+)/);
      if (!m2) return sendMessage(chatId, pxText("فرمت: <code>/memedit شناسه متن جدید</code>"));
      const mems = await getMemories(env, userId);
      const mem = mems.find(m => m.id === m2[1]);
      if (!mem) return sendMessage(chatId, pxText("⚠️ حافظه یافت نشد. /memories را ببینید."));
      mem.text = m2[2].slice(0, 500);
      await putDb(env, `user:${userId}:memories`, mems);
      return sendMessage(chatId, pxTemplate`✅ <b>حافظه ویرایش شد:</b>\n<i>«${escapeHtml(mem.text)}»</i>`, backKb());
    }

    case "/profile": {
      const p = await getProfile(env, userId);
      return sendMessage(chatId, profileText(p) + pxText("\n\n👇 برای ویرایش هر فیلد روی آن بزنید:"), profileKb());
    }

    case "/apps": {
      const apps = await getApps(env, userId);
      return sendMessage(chatId,
        pxTemplate`🚀 <b>اپ‌های هوش مصنوعی شما (${apps.length}):</b>\n\n` +
        (apps.length ? apps.map(a => pxTemplate`▪️ <b>${escapeHtml(a.name)}</b> (${a.runs || 0} اجرا)`).join("\n")
          : pxText("<i>یک‌بار پرامپت مادر را بسازید، بی‌نهایت بار اجرا کنید!</i>")),
        appsListKb(apps));
    }
    case "/newapp": {
      await putDb(env, `user:${userId}:wizard`, { type: "app", step: "name", draft: {} });
      return sendMessage(chatId,
        pxTemplate`🚀 <b>ساخت اپ جدید — قدم ۱ از ۴</b>\n\n📛 <b>نام اپ</b> را بنویسید:\n<i>مثلاً: مترجم فارسی، کپشن‌ساز اینستاگرام</i>\n\n(لغو: /cancel)`);
    }
    case "/appimport": {
      try {
        const obj = JSON.parse(args);
        if (!obj.name || !obj.prompt) throw new Error("bad");
        const apps = await getApps(env, userId);
        apps.push({ id: uid(), name: String(obj.name).slice(0, 50), desc: String(obj.desc || "").slice(0, 150), prompt: String(obj.prompt).slice(0, 3000), model: obj.model || "auto", input: String(obj.input || ""), output: String(obj.output || ""), runs: 0, ts: Date.now() });
        await saveApps(env, userId, apps);
        return sendMessage(chatId, pxTemplate`✅ اپ <b>${escapeHtml(obj.name)}</b> وارد شد! 📥`, appsListKb(apps));
      } catch {
        return sendMessage(chatId, pxText("⚠️ کد اشتراک نامعتبر است. فرمت: <code>/appimport {JSON}</code>"));
      }
    }

    case "/myprompts": {
      const prompts = await getPrompts(env, userId);
      return sendMessage(chatId, pxTemplate`💾 <b>پرامپت‌های ذخیره‌شده (${prompts.length}):</b>`, promptsListKb(prompts));
    }
    case "/psave": {
      const parts2 = args.split("|").map(s => s.trim());
      if (parts2.length < 2) return sendMessage(chatId,
        pxTemplate`💾 فرمت: <code>/psave نام | دسته | متن پرامپت</code>\n(دسته اختیاری)\n\n💡 متغیر: <code>{موضوع}</code>`);
      const [name2, ...rest] = parts2;
      const cat2 = rest.length > 1 ? rest[0] : pxText("عمومی");
      const text2 = rest.length > 1 ? rest.slice(1).join("|") : rest[0];
      const prompts = await getPrompts(env, userId);
      prompts.push({ id: uid(), name: name2.slice(0, 50), cat: cat2.slice(0, 30), text: text2.slice(0, 3000), ts: Date.now() });
      await putDb(env, `user:${userId}:prompts`, prompts.slice(0, 60));
      return sendMessage(chatId, pxTemplate`✅ پرامپت <b>${escapeHtml(name2)}</b> ذخیره شد! 💾`, promptsListKb(prompts));
    }

    case "/ask": {
      if (!args) return sendMessage(chatId, pxText("❓ فرمت: <code>/ask سؤال از اسناد شما</code>\n\nافزودن سند: فایل با کپشن <code>/kb</code>"));
      return kbAnswer(env, chatId, userId, args);
    }
    case "/kb": {
      const index = await getDb(env, `user:${userId}:kb:index`, []);
      const rows = index.map(d => [{ text: `🗑 ${d.name.slice(0, 30)}`, callback_data: `kbdel:${d.docId}` }]);
      rows.push([{ text: pxText("❓ پرسش از دانش"), callback_data: "mode:kb" }], [{ text: pxText("🔙 منو"), callback_data: "menu" }]);
      return sendMessage(chatId,
        pxTemplate`📚 <b>پایگاه دانش شما (${index.length}/10 سند):</b>\n\n` +
        (index.length ? index.map(d => pxTemplate`📄 <b>${escapeHtml(d.name)}</b> — ${d.chunks} قطعه`).join("\n") : pxText("<i>خالی است.</i>")) +
        pxTemplate`\n\n➕ فایل PDF/متنی را با کپشن <code>/kb</code> بفرستید.\n🔒 <i>کاملاً خصوصی و ایزوله.</i>`, inlineKb(rows));
    }

    case "/exportall": {
      return sendUserBackup(env, chatId, userId);
    }
    case "/deleteme": {
      return sendMessage(chatId,
        pxTemplate`⚠️ <b>حذف دائمی همه داده‌ها — برگشت‌ناپذیر!</b>`,
        inlineKb([[{ text: pxText("❌ انصراف"), callback_data: "menu" }, { text: pxText("🗑 بله، پاک کن"), callback_data: "delme:yes" }]]));
    }
    case "/cancel": {
      await delDb(env, `user:${userId}:wizard`);
      await delDb(env, `user:${userId}:pending`);
      await delDb(env, `user:${userId}:mode`);
      return sendMessage(chatId, pxText("✅ <b>لغو شد.</b> به حالت چت عادی برگشتید."), backKb());
    }
    case "/chats": {
      const folders = await getDb(env, `user:${userId}:folders`, ["default"]);
      let txt2 = pxTemplate`💬 <b>چت‌های شما:</b>\n\n`;
      for (const f of folders) {
        const title = await getDb(env, `user:${userId}:foldertitle:${f}`, null);
        const hist = await getHistory(env, userId, f);
        txt2 += `${f === settings.folder ? "✅" : "📁"} <b>${escapeHtml(f)}</b>${title ? ` — <i>${escapeHtml(title)}</i>` : ""} (${hist.length})\n`;
      }
      return sendMessage(chatId, txt2 + pxTemplate`\n🔀 <code>/folder switch نام</code>`, backKb());
    }
    case "/summary": {
      const hist = await getHistory(env, userId, settings.folder);
      if (hist.length < 4) return sendMessage(chatId, pxText("📝 <i>این چت هنوز چیزی برای خلاصه‌کردن ندارد.</i>"));
      return aiReply(env, chatId, userId,
        pxTemplate`این گفتگو را خلاصه کن (تصمیم‌ها، نکات کلیدی، کارهای باقی‌مانده):\n\n` +
        hist.slice(-40).map(m => `${m.role === "user" ? pxText("کاربر") : "AI"}: ${m.content.slice(0, 250)}`).join("\n"));
    }
    case "/mydata": {
      const data = await getDb(env, `user:${userId}:data`, []);
      return sendMessage(chatId,
        pxTemplate`👤 <b>اطلاعات ثبت‌شده شما (${data.length}):</b>\n\n` +
        (data.length ? data.map((d, i) => `${i + 1}. ${escapeHtml(d)}`).join("\n") : pxText("<i>خالی — با /remember اضافه کنید</i>")), backKb());
    }
    case "/forget": {
      await delDb(env, `user:${userId}:data`);
      return sendMessage(chatId, pxText("🗑 <b>همه اطلاعات شخصی شما پاک شد.</b>"), backKb());
    }
    case "/clearmemory": {
      await putDb(env, `user:${userId}:history:${settings.folder}`, []);
      await delDb(env, `user:${userId}:memory`);
      return sendMessage(chatId, pxText("🗑 <b>تاریخچه و حافظه بلندمدت پاک شد.</b>\n\n🔄 چت تازه‌ای شروع کنید!"), backKb());
    }

    case "/usage": return handleUsageDashboard(chatId, userId, env);
    case "/stats": {
      const period = /weekly/.test(args) ? 7 : /monthly/.test(args) ? 30 : 1;
      const label = period === 1 ? pxText("امروز") : period === 7 ? pxText("۷ روز اخیر") : pxText("۳۰ روز اخیر");
      const s = await usageSummary(env, userId, period);
      let msg = pxTemplate`📊 <b>آمار ${label}:</b>\n\n🔢 توکن: <b>${fmtNum(s.tokens)}</b>\n💰 هزینه: <b>$${s.cost.toFixed(4)}</b>\n💬 پیام: <b>${s.count}</b>`;
      if (isAdmin) {
        const users = await getDb(env, "global:users", []);
        msg += pxTemplate`\n\n👑 <b>آمار سیستم:</b>\n👥 کاربران: ${users.length}`;
      }
      return sendMessage(chatId, msg, backKb());
    }
    case "/health": return handleHealth(chatId, env);
    case "/speed": {
      const arr = await getDb(env, "stats:speed", []);
      if (!arr.length) return sendMessage(chatId, pxText("📉 هنوز داده‌ای ثبت نشده."));
      const avg = arr.reduce((a, b) => a + b.duration, 0) / arr.length;
      const fastest = Math.min(...arr.map(a => a.duration));
      return sendMessage(chatId,
        pxTemplate`⚡ <b>سرعت پاسخ‌دهی (${arr.length} درخواست اخیر):</b>\n\n` +
        pxTemplate`📊 میانگین: <b>${(avg / 1000).toFixed(1)}s</b>\n🚀 سریع‌ترین: <b>${(fastest / 1000).toFixed(1)}s</b>\n🐢 کندترین: <b>${(Math.max(...arr.map(a => a.duration)) / 1000).toFixed(1)}s</b>`, backKb());
    }
    case "/cost": {
      const month = await usageSummary(env, userId, 30);
      return sendMessage(chatId,
        pxTemplate`💰 <b>هزینه تقریبی ۳۰ روز اخیر:</b>\n\n` +
        pxTemplate`💵 <b>$${month.cost.toFixed(4)}</b>\n🔢 ${fmtNum(month.tokens)} توکن\n\n` +
        pxTemplate`<i>💡 مدل‌های NVIDIA NIM رایگان‌اند؛ فقط Gemini هزینه تقریبی دارد.</i>`, backKb());
    }

    case "/search": {
      if (!args) return sendMessage(chatId, pxText("🔍 فرمت: <code>/search آخرین اخبار هوش مصنوعی</code>"));
      return aiReply(env, chatId, userId, args, { grounding: true, forceGemini: true });
    }
    case "/research": {
      if (!(await isPluginEnabled(env, "Research"))) return sendMessage(chatId, pxText("🔌 پلاگین تحقیق غیرفعال است."));
      if (!args) { await putDb(env, `user:${userId}:pending`, "research"); return sendMessage(chatId, pxText("🧠 موضوع تحقیق را بنویسید...")); }
      return handleResearch(chatId, userId, args, env);
    }
    case "/analyze": {
      if (!args) { await putDb(env, `user:${userId}:pending`, "analyze"); return sendMessage(chatId, pxText("📊 متن مورد نظر برای تحلیل را بفرستید...")); }
      return aiReply(env, chatId, userId, pxTemplate`این متن را به‌صورت حرفه‌ای و ساختارمند تحلیل کن (نکات کلیدی، لحن، ساختار، نتیجه‌گیری):\n\n${args}`);
    }
    case "/translate": {
      if (!args) { await putDb(env, `user:${userId}:pending`, "translate"); return sendMessage(chatId, pxText("🌍 متن را بفرستید (مثلاً: «سلام to English»)...")); }
      return aiReply(env, chatId, userId, pxTemplate`ترجمه کن: ${args}`);
    }
    case "/summarize": {
      if (!args) return sendMessage(chatId, pxText("📝 فرمت: <code>/summarize متن طولانی...</code>"));
      return aiReply(env, chatId, userId, pxTemplate`این متن را خلاصه کن (نکات اصلی به‌صورت فهرست):\n\n${args}`);
    }
    case "/prompt": {
      if (!args) { await putDb(env, `user:${userId}:pending`, "promptgen"); return sendMessage(chatId, pxText("✨ توضیح دهید چه پرامپتی می‌خواهید...")); }
      return aiReply(env, chatId, userId,
        pxTemplate`یک پرامپت حرفه‌ای و کامل انگلیسی برای این نیاز بنویس. پرامپت را در بلوک کد قرار بده و توضیح فارسی کوتاهی هم بده:\n\n${args}`);
    }

    case "/calc": {
      if (!(await isPluginEnabled(env, "Calculator"))) return sendMessage(chatId, pxText("🔌 پلاگین ماشین حساب غیرفعال است."));
      if (!args) return sendMessage(chatId, pxText("🧮 فرمت: <code>/calc (25*4)+100/2</code>"));
      try {
        const val = safeCalc(args);
        return sendMessage(chatId, pxTemplate`🧮 <b>نتیجه:</b>\n\n<code>${escapeHtml(args)} = ${fmtNum(val)}</code>`, backKb());
      } catch (e) {
        return sendMessage(chatId, pxTemplate`⚠️ خطا در محاسبه: <i>${escapeHtml(e.message)}</i>`);
      }
    }
    case "/weather": {
      if (!args) return sendMessage(chatId, pxText("🌤 فرمت: <code>/weather Tehran</code>"));
      return handleWeather(chatId, args, env);
    }
    case "/convert": return handleConvert(chatId, args, env);
    case "/map": return handleMap(chatId, args, env);

    case "/note": {
      if (!(await isPluginEnabled(env, "Notes"))) return sendMessage(chatId, pxText("🔌 پلاگین یادداشت غیرفعال است."));
      const notes = await getDb(env, `user:${userId}:notes`, []);
      if (args.startsWith("add ")) {
        notes.push({ text: args.slice(4).trim(), ts: Date.now() });
        await putDb(env, `user:${userId}:notes`, notes.slice(-100));
        return sendMessage(chatId, pxTemplate`✅ یادداشت #${notes.length} ثبت شد! 📝`, backKb());
      }
      if (args.startsWith("delete ")) {
        const i = parseInt(args.slice(7)) - 1;
        if (i < 0 || i >= notes.length) return sendMessage(chatId, pxText("⚠️ شماره نامعتبر."));
        notes.splice(i, 1);
        await putDb(env, `user:${userId}:notes`, notes);
        return sendMessage(chatId, pxText("🗑 یادداشت حذف شد."), backKb());
      }
      return sendMessage(chatId,
        pxTemplate`📝 <b>یادداشت‌ها (${notes.length}):</b>\n\n` +
        (notes.length ? notes.map((n, i) => `<b>${i + 1}.</b> ${escapeHtml(n.text)}`).join("\n") : pxText("<i>خالی</i>")) +
        pxTemplate`\n\n➕ <code>/note add متن</code>\n🗑 <code>/note delete شماره</code>`, backKb());
    }

    case "/pin": {
      const last = await getDb(env, `user:${userId}:last_answer`, null);
      if (!last) return sendMessage(chatId, pxText("⚠️ پاسخی برای پین کردن وجود ندارد."));
      const pinned = await getDb(env, `user:${userId}:pinned`, []);
      pinned.push(last);
      await putDb(env, `user:${userId}:pinned`, pinned.slice(-30));
      return sendMessage(chatId, pxText("📌 <b>آخرین گفتگو پین شد!</b>"), backKb());
    }
    case "/pinned": {
      const pinned = await getDb(env, `user:${userId}:pinned`, []);
      if (!pinned.length) return sendMessage(chatId, pxText("📌 <i>چیزی پین نشده است.</i>"), backKb());
      let msg = pxTemplate`📌 <b>پین‌شده‌ها (${pinned.length}):</b>\n\n`;
      pinned.slice(-10).forEach((p, i) => {
        msg += `<b>${i + 1}.</b> ❓ <i>${escapeHtml(p.q.slice(0, 60))}</i>\n💬 ${escapeHtml(p.a.slice(0, 120))}...\n\n`;
      });
      return sendMessage(chatId, msg, backKb());
    }
    case "/favorites": {
      const favs = await getDb(env, `user:${userId}:favorites`, []);
      if (!favs.length) return sendMessage(chatId, pxText("⭐ <i>لیست علاقه‌مندی‌ها خالی است.</i>"), backKb());
      let msg = pxTemplate`⭐ <b>علاقه‌مندی‌ها (${favs.length}):</b>\n\n`;
      favs.slice(-10).forEach((p, i) => {
        msg += `<b>${i + 1}.</b> ${escapeHtml(p.a.slice(0, 150))}...\n\n`;
      });
      return sendMessage(chatId, msg, backKb());
    }

    case "/folder": {
      const folders = await getDb(env, `user:${userId}:folders`, ["default"]);
      if (args.startsWith("create ")) {
        const name = args.slice(7).trim().replace(/[^\w؀-ۿ-]/g, "_").slice(0, 30);
        if (!folders.includes(name)) folders.push(name);
        await putDb(env, `user:${userId}:folders`, folders);
        await saveUserSettings(env, userId, { folder: name });
        return sendMessage(chatId, pxTemplate`✅ پوشه <b>${escapeHtml(name)}</b> ساخته و فعال شد! 📁`, backKb());
      }
      if (args.startsWith("switch ")) {
        const name = args.slice(7).trim();
        if (!folders.includes(name)) return sendMessage(chatId, pxTemplate`⚠️ پوشه <code>${escapeHtml(name)}</code> وجود ندارد.`);
        await saveUserSettings(env, userId, { folder: name });
        return sendMessage(chatId, pxTemplate`✅ پوشه فعال: <b>${escapeHtml(name)}</b> 📁`, backKb());
      }
      return sendMessage(chatId,
        pxTemplate`📁 <b>پوشه‌ها:</b> (فعال: <b>${escapeHtml(settings.folder)}</b>)\n\n` +
        folders.map(f => `${f === settings.folder ? "✅" : "📁"} ${escapeHtml(f)}`).join("\n") +
        pxTemplate`\n\n➕ <code>/folder create نام</code>\n🔀 <code>/folder switch نام</code>`, backKb());
    }

    case "/historyfind": {
      if (!args) return sendMessage(chatId, pxText("🔍 فرمت: <code>/historyfind کلمه</code>"));
      const hist = await getHistory(env, userId, settings.folder);
      const found = hist.filter(m => m.content.toLowerCase().includes(args.toLowerCase())).slice(-8);
      if (!found.length) return sendMessage(chatId, pxTemplate`🔍 <i>«${escapeHtml(args)}» در تاریخچه یافت نشد.</i>`);
      let msg = pxTemplate`🔍 <b>نتایج جستجو (${found.length}):</b>\n\n`;
      for (const m of found) {
        msg += `${m.role === "user" ? "👤" : "🤖"} <i>${escapeHtml(m.content.slice(0, 150))}</i>\n\n`;
      }
      return sendMessage(chatId, msg, backKb());
    }

    case "/export": {
      const hist = await getHistory(env, userId, settings.folder);
      if (!hist.length) return sendMessage(chatId, pxText("📤 <i>تاریخچه‌ای برای خروجی وجود ندارد.</i>"));
      const payload = JSON.stringify({ folder: settings.folder, exported: new Date().toISOString(), messages: hist }, null, 2);
      const r = await sendDocument(chatId, `history_${settings.folder}_${todayStr()}.json`, payload, pxText("📤 خروجی تاریخچه چت"));
      if (!r.ok) await sendMessage(chatId, pxText("😔 خطا در ارسال فایل خروجی."));
      return;
    }
    case "/import": {
      return sendMessage(chatId, pxText("📥 <b>وارد کردن تاریخچه:</b>\n\nفایل JSON خروجی‌گرفته‌شده را با کپشن <code>/import</code> ارسال کنید."));
    }

    case "/plugins": {
      const plugins = await getDb(env, "global:plugins", DEFAULT_PLUGINS);
      return sendMessage(chatId,
        pxTemplate`🔌 <b>وضعیت پلاگین‌ها:</b>\n\n` +
        Object.entries({ ...DEFAULT_PLUGINS, ...plugins }).map(([k, v]) => `${v ? "🟢" : "🔴"} <b>${k}</b>`).join("\n") +
        (isAdmin ? pxTemplate`\n\n👑 <code>/plugin enable|disable نام</code>` : ""), backKb());
    }

    case "/model": {
      if (!args) return sendMessage(chatId, pxTemplate`🤖 مدل فعلی: <b>${escapeHtml(settings.model)}</b>\n\nتغییر: <code>/model auto</code> یا <code>/model meta/llama-3.3-70b-instruct</code>\nلیست: /models`);
      const all = [...new Set(Object.values(MODEL_CATEGORIES).flat()), ...GEMINI_MODELS, "auto"];
      const match = all.find(m => m === args || m.endsWith("/" + args) || m.includes(args));
      if (!match) return sendMessage(chatId, pxTemplate`⚠️ مدل <code>${escapeHtml(args)}</code> یافت نشد. /models را ببینید.`);
      await saveUserSettings(env, userId, { model: match });
      return sendMessage(chatId, pxTemplate`✅ مدل فعال: <b>${escapeHtml(match)}</b>\n\n<i>بازگشت به حالت هوشمند: /model auto</i>`, backKb());
    }
    case "/models": {
      return sendMessage(chatId,
        pxTemplate`🤖 <b>انتخاب مدل هوش مصنوعی</b>\n\nمدل فعلی: <b>${escapeHtml(settings.model)}</b>\n\n` +
        pxTemplate`🟩 = NVIDIA (رایگان، تست‌شده) · 🔷 = Gemini\n` +
        pxTemplate`💡 <i>اگر مدل انتخابی خطا بدهد، خودکار به مدل سالم بعدی سوئیچ می‌شود.</i>\n\n` +
        pxTemplate`👇 روی مدل مورد نظر بزنید:`, modelsKb(settings.model));
    }

    case "/ocr": {
      if (!(await isPluginEnabled(env, "OCR"))) return sendMessage(chatId, pxText("🔌 پلاگین OCR غیرفعال است."));
      await putDb(env, `user:${userId}:pending`, "ocr");
      return sendMessage(chatId, pxText("🔤 <b>حالت OCR فعال شد!</b>\n\n📷 حالا عکس حاوی متن را بفرستید..."));
    }
    case "/caption": {
      await putDb(env, `user:${userId}:pending`, "caption");
      return sendMessage(chatId, pxText("🖼 <b>حالت توضیح عکس فعال شد!</b>\n\n📷 حالا عکس را بفرستید..."));
    }

    // 👑 دستورات ادمین
    case "/broadcast": case "/ban": case "/unban": case "/listusers":
    case "/setglobalprompt": case "/setglobalmemory": case "/plugin": case "/clearallhistory":
    case "/testmodels":
      return handleAdminCommand(env, chatId, userId, cmd, args);

    default:
      return sendMessage(chatId, pxTemplate`❓ دستور <code>${escapeHtml(cmd)}</code> شناخته نشد.\n\n📖 راهنما: /help`);
  }
}

// ─────────────────────────────────────────────
// 🧙 ویزاردهای چندمرحله‌ای (اپ‌ساز، پروفایل، پرامپت‌ها)
// ─────────────────────────────────────────────
async function handleWizardInput(env, chatId, userId, text, wizard) {
  const wKey = `user:${userId}:wizard`;

  // 👤 پروفایل: ذخیره فیلد
  if (wizard.type === "profile") {
    const p = await getProfile(env, userId);
    p[wizard.field] = text.slice(0, 300);
    await putDb(env, `user:${userId}:profile`, p);
    await delDb(env, wKey);
    return sendMessage(chatId, pxTemplate`✅ <b>${PROFILE_FIELDS[wizard.field].label}</b> ذخیره شد!\n\n${profileText(p)}`, profileKb());
  }

  // 🚀 اپ‌ساز: ۴ قدم
  if (wizard.type === "app") {
    const d = wizard.draft;
    if (wizard.step === "name") {
      d.name = text.slice(0, 50);
      await putDb(env, wKey, { ...wizard, step: "prompt", draft: d });
      return sendMessage(chatId,
        pxTemplate`🚀 <b>قدم ۲ از ۴ — پرامپت مادر</b>\n\n📝 دستورالعمل اصلی اپ <b>«${escapeHtml(d.name)}»</b> را بنویسید:\n<i>مثلاً: «متن فارسی را به انگلیسی طبیعی و روان ترجمه کن»</i>`);
    }
    if (wizard.step === "prompt") {
      d.prompt = text.slice(0, 3000);
      await putDb(env, wKey, { ...wizard, step: "desc", draft: d });
      return sendMessage(chatId, pxTemplate`🚀 <b>قدم ۳ از ۴ — توضیح کوتاه</b>\n\n📄 یک خط توضیح بنویسید (یا <code>-</code> برای رد شدن):`);
    }
    if (wizard.step === "desc") {
      d.desc = text === "-" ? "" : text.slice(0, 150);
      await putDb(env, wKey, { ...wizard, step: "input", draft: d });
      return sendMessage(chatId, pxTemplate`🚀 <b>قدم ۴ از ۴ — فرمت ورودی</b>\n\n📥 کاربر چه چیزی باید بفرستد؟ (یا <code>-</code> برای رد شدن)\n<i>مثلاً: «متن فارسی»</i>`);
    }
    if (wizard.step === "input") {
      d.input = text === "-" ? "" : text.slice(0, 150);
      const apps = await getApps(env, userId);
      const app = { id: uid(), ...d, model: "auto", output: "", runs: 0, ts: Date.now() };
      apps.push(app);
      await saveApps(env, userId, apps);
      await delDb(env, wKey);
      return sendMessage(chatId,
        pxTemplate`🎉 <b>اپ «${escapeHtml(app.name)}» ساخته شد!</b>\n\n` +
        pxTemplate`▶️ همین حالا اجرا کنید یا از ⚙️ مدل اختصاصی بدهید.\n💡 از این به بعد فقط ورودی را می‌فرستید — بدون تکرار پرامپت!`,
        inlineKb([
          [{ text: pxText("▶️ اجرای اپ"), callback_data: `app:run:${app.id}` }, { text: pxText("⚙️ تنظیمات اپ"), callback_data: `app:opt:${app.id}` }],
          [{ text: pxText("🚀 همه اپ‌ها"), callback_data: "apps" }]
        ]));
    }
  }

  // 📝 ویرایش پرامپت اپ
  if (wizard.type === "app_editp") {
    const apps = await getApps(env, userId);
    const app = apps.find(a => a.id === wizard.id);
    await delDb(env, wKey);
    if (!app) return sendMessage(chatId, pxText("⚠️ اپ یافت نشد."));
    app.prompt = text.slice(0, 3000);
    await saveApps(env, userId, apps);
    return sendMessage(chatId, pxTemplate`✅ پرامپت اپ <b>${escapeHtml(app.name)}</b> به‌روزرسانی شد!`, appOptionsKb(app.id));
  }

  // 💾 ذخیره پرامپت جدید (۲ قدم)
  if (wizard.type === "prompt_new") {
    if (wizard.step === "name") {
      const [name, cat] = text.split("|").map(s => s.trim());
      await putDb(env, wKey, { ...wizard, step: "text", draft: { name: name.slice(0, 50), cat: (cat || pxText("عمومی")).slice(0, 30) } });
      return sendMessage(chatId,
        pxTemplate`💾 <b>قدم ۲ از ۲ — متن پرامپت</b>\n\n📝 متن کامل پرامپت را بنویسید.\n💡 متغیر هم می‌توانید بگذارید: <code>{موضوع}</code>\n\n<i>مثلاً: «یک پست لینکدین حرفه‌ای درباره {موضوع} بنویس»</i>`);
    }
    if (wizard.step === "text") {
      const prompts = await getPrompts(env, userId);
      prompts.push({ id: uid(), name: wizard.draft.name, cat: wizard.draft.cat, text: text.slice(0, 3000), ts: Date.now() });
      await putDb(env, `user:${userId}:prompts`, prompts.slice(0, 60));
      await delDb(env, wKey);
      const vars = extractVars(text);
      return sendMessage(chatId,
        pxTemplate`✅ <b>پرامپت «${escapeHtml(wizard.draft.name)}» ذخیره شد!</b>` +
        (vars.length ? pxTemplate`\n\n🔤 متغیرها: {${vars.map(escapeHtml).join("}, {")}}\nموقع اجرا فقط مقدارشان را می‌پرسم.` : ""),
        inlineKb([[{ text: pxText("💾 پرامپت‌های من"), callback_data: "myprompts" }], [{ text: pxText("🔙 منو"), callback_data: "menu" }]]));
    }
  }

  // 🔤 پر کردن متغیرهای پرامپت
  if (wizard.type === "prompt_vars") {
    const prompts = await getPrompts(env, userId);
    const pr = prompts.find(p => p.id === wizard.promptId);
    if (!pr) { await delDb(env, wKey); return sendMessage(chatId, pxText("⚠️ پرامپت یافت نشد.")); }
    wizard.values[wizard.vars[wizard.idx]] = text.trim();
    wizard.idx++;
    if (wizard.idx < wizard.vars.length) {
      await putDb(env, wKey, wizard);
      return sendMessage(chatId, pxTemplate`✏️ مقدار <b>{${escapeHtml(wizard.vars[wizard.idx])}}</b> را بنویسید:`);
    }
    await delDb(env, wKey);
    let filled = pr.text;
    for (const [k, v] of Object.entries(wizard.values)) filled = filled.split(`{${k}}`).join(v);
    return aiReply(env, chatId, userId, filled);
  }

  await delDb(env, wKey);
  return sendMessage(chatId, pxText("⚠️ ویزارد نامعتبر بود و لغو شد."));
}

// ─────────────────────────────────────────────
// 📚 افزودن سند به پایگاه دانش (از فایل تلگرام)
// ─────────────────────────────────────────────
async function handleKbUpload(env, chatId, userId, doc) {
  const streamer = new MessageStreamer(chatId);
  await streamer.init(pxText("📚 <b>در حال پردازش سند برای پایگاه دانش...</b>"));
  try {
    const name = (doc.file_name || pxText("سند")).slice(0, 60);
    const mime = doc.mime_type || "";
    let textContent = "";
    if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      streamer.lastUpdate = 0;
      await streamer.stream(pxText("📄 <b>استخراج متن از PDF...</b>"));
      const { base64 } = await downloadTelegramFile(doc.file_id);
      const r = await callGeminiInline(
        "Extract ALL text content from this PDF verbatim. Output only the extracted text.",
        "application/pdf", base64, { think: THINK_CONFIGS[3] });
      textContent = r.text;
    } else {
      const info = await sendTG("getFile", { file_id: doc.file_id });
      const res = await fetch(`${TG_FILE}/${info.result.file_path}`);
      textContent = await res.text();
    }
    textContent = (textContent || "").slice(0, 100000);
    streamer.lastUpdate = 0;
    await streamer.stream(pxText("🧮 <b>ساخت بردارهای معنایی (Embedding)...</b>"));
    const { chunks } = await kbAddDocument(env, userId, name, textContent);
    await streamer.done(
      pxTemplate`✅ <b>سند «${escapeHtml(name)}» به پایگاه دانش اضافه شد!</b>\n\n` +
      pxTemplate`🧩 ${chunks} قطعه ایندکس شد.\n\n❓ حالا بپرسید:\n<code>/ask سؤال شما</code>\nیا حالت «❓ پرسش از دانش» را فعال کنید.`,
      inlineKb([[{ text: pxText("❓ پرسش از دانش"), callback_data: "mode:kb" }], [{ text: pxText("📚 دانش من"), callback_data: "kb" }]]));
  } catch (e) {
    await streamer.done(pxTemplate`😔 خطا در افزودن سند: <i>${escapeHtml(String(e.message || e)).slice(0, 200)}</i>`, backKb());
  }
}

// ─────────────────────────────────────────────
// 📩 مدیریت پیام‌های ورودی
// ─────────────────────────────────────────────
async function handleMessage(env, msg) {
  if (!msg.from?.id) return;
  return withLanguage(await savedLanguage(env, msg.from.id), () => handleLocalizedMessage(env, msg));
}

async function handleLocalizedMessage(env, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;

  // 🚫 بررسی مسدودیت
  const banned = await getDb(env, "global:banned", []);
  if (banned.includes(userId) && userId !== ADMIN_ID) return;

  // 🛡 محدودیت نرخ
  if (isRateLimited(userId)) {
    return sendMessage(chatId, pxText("⏳ <b>کمی آهسته‌تر!</b>\n\nحداکثر ۱۵ پیام در دقیقه مجاز است. لطفاً چند لحظه صبر کنید. 🙏"));
  }

  await registerUser(env, userId);

  const text = (msg.text || "").trim();
  const pending = await getDb(env, `user:${userId}:pending`, null);

  if (msg.document && (/^\/(?:restore|importall)\b/.test((msg.caption || "").trim()) || pending === "restore")) {
    if (Number(chatId) !== Number(userId)) return sendMessage(chatId, pxText("🔒 فایل را در گفتگوی خصوصی ارسال کنید."));
    try {
      if ((msg.document.file_size || 0) > MAX_BACKUP_BYTES) throw new Error(pxText("فایل باید کمتر از ۱۸ مگابایت باشد."));
      const info = await sendTG("getFile", { file_id: msg.document.file_id });
      if (!info.ok || !info.result?.file_path) throw new Error(pxText("فایل از تلگرام دریافت نشد."));
      const res = await fetch(`${TG_FILE}/${info.result.file_path}`);
      if (!res.ok) throw new Error(pxText("دانلود فایل انجام نشد."));
      const raw = await res.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error(pxText("فایل بیش از حد بزرگ است."));
      const { token, summary } = await stageRestore(env, JSON.parse(raw), userId);
      await delDb(env, `user:${userId}:pending`);
      return sendMessage(chatId, pxTemplate`📥 <b>پیش‌نمایش بازیابی</b>\n\n${summary.records} رکورد · ${summary.conversations} گفتگو · ${summary.documents} سند\nحساب مقصد: <code>${userId}</code>\n\n<blockquote>اطلاعات به حساب فعلی منتقل می‌شود. اطلاعات قبلی حفظ می‌شود و خودکارسازی‌های واردشده غیرفعال می‌مانند.</blockquote>`, inlineKb([[{ text: pxText("✅ انتقال به حساب من"), callback_data: `restore:confirm:${token}`, style: "success" }, { text: pxText("انصراف"), callback_data: "menu" }]]));
    } catch (e) { return sendMessage(chatId, pxTemplate`⚠️ <b>فایل قابل بازیابی نیست</b>\n${escapeHtml(e.message)}`, backKb()); }
  }

  // 📥 وارد کردن تاریخچه با فایل + کپشن /import
  if (msg.document && (msg.caption || "").trim().startsWith("/import")) {
    try {
      const info = await sendTG("getFile", { file_id: msg.document.file_id });
      const res = await fetch(`${TG_FILE}/${info.result.file_path}`);
      const j = await res.json();
      if (!Array.isArray(j.messages)) throw new Error("invalid format");
      const settings = await getUserSettings(env, userId);
      await putDb(env, `user:${userId}:history:${settings.folder}`, j.messages.slice(-100));
      return sendMessage(chatId, pxTemplate`✅ <b>${j.messages.length} پیام</b> به پوشه <b>${escapeHtml(settings.folder)}</b> وارد شد! 📥`, backKb());
    } catch {
      return sendMessage(chatId, pxText("😔 فایل نامعتبر است. فقط فایل خروجی /export قابل import است."));
    }
  }

  // 📚 افزودن سند به پایگاه دانش (کپشن /kb یا حالت انتظار kb)
  if (msg.document && ((msg.caption || "").trim().startsWith("/kb") || pending === "kb")) {
    if (pending === "kb") await delDb(env, `user:${userId}:pending`);
    return handleKbUpload(env, chatId, userId, msg.document);
  }

  // 📷 عکس
  if (msg.photo) {
    const mode = pending === "ocr" ? "ocr" : "caption";
    if (pending === "ocr" || pending === "caption") await delDb(env, `user:${userId}:pending`);
    return handlePhoto(env, chatId, userId, msg, mode);
  }
  // 🎤 صدا
  if (msg.voice || msg.audio) return handleVoice(env, chatId, userId, msg);
  // 📎 فایل
  if (msg.document) return handleDocument(env, chatId, userId, msg);

  if (!text) return;

  // ⌨️ دکمه‌های کیبورد دائمی
  const kbAction = REPLY_KB_ACTIONS[text] || Object.entries(REPLY_KB_ACTIONS).find(([label]) => translateLiteral(label, 'en') === text)?.[1];
  if (kbAction) {
    await delDb(env, `user:${userId}:pending`);
    if (kbAction === "backup") return sendUserBackup(env, chatId, userId);
    if (kbAction === "restore") return handleCommand(env, chatId, userId, "/restore");
    if (kbAction === "menu") {
      await delDb(env, `user:${userId}:mode`);
      return sendMessage(chatId, pxText("📋 <b>منوی اصلی</b>\n\nانتخاب کنید یا مستقیم پیام بفرستید:"), mainMenuKb(userId));
    }
    if (kbAction === "infra") {
      return handlePlatformCommand(env, chatId, userId, "/infra", "", { appUrl: MINIAPP_URL });
    }
    if (kbAction === "miniapp") {
      return handlePlatformCommand(env, chatId, userId, "/app", "", { appUrl: MINIAPP_URL });
    }
    if (kbAction === "tools") {
      return sendMessage(chatId, pxText("🛠 <b>جعبهابزار</b>"), toolsKb());
    }
    if (kbAction.startsWith("mode_")) {
      const m = kbAction.slice(5);
      if (m === "chat") {
        await delDb(env, `user:${userId}:mode`);
        return sendMessage(chatId, pxText("💬 <b>چت هوشمند فعال شد!</b>\n\nپیام بفرستید…"), backKb());
      }
      if (!STICKY_MODES[m]) return sendMessage(chatId, pxText("⚠️ این حالت موجود نیست."), backKb());
      await putDb(env, `user:${userId}:mode`, m);
      return sendMessage(chatId, pxTemplate`${STICKY_MODES[m].label} <b>فعال شد!</b>\n\n<i>${STICKY_MODES[m].hint}</i>`,
        inlineKb([[{ text: pxText("❌ خروج از این حالت"), callback_data: "mode:chat" }]]));
    }
    if (kbAction === "models") {
      const s2 = await getUserSettings(env, userId);
      return sendMessage(chatId, pxTemplate`🎛 <b>انتخاب مدل</b>\n\nمدل فعلی: <b>${escapeHtml(s2.model)}</b>`, modelsKb(s2.model));
    }
    if (kbAction === "usage") return handleUsageDashboard(chatId, userId, env);
    if (kbAction === "settings") {
      const s2 = await getUserSettings(env, userId);
      return sendMessage(chatId,
        pxTemplate`⚙️ <b>تنظیمات</b>\n\nعمق فکر: <b>${THINK_CONFIGS[s2.thinkLevel].label}</b>\nشخصیت: <b>${escapeHtml(s2.persona)}</b>\nمنطقه زمانی: <b>${escapeHtml(s2.timezone)}</b>\nمدل: <b>${escapeHtml(s2.model)}</b>`, settingsKb());
    }
  }

  if (text.startsWith("/")) {
    await delDb(env, `user:${userId}:pending`);
    return handleCommand(env, chatId, userId, text);
  }

  // 🎛 حالت‌های یک‌باره در انتظار (OCR و ...)
  if (pending) {
    await delDb(env, `user:${userId}:pending`);
    switch (pending) {
      case "research": return handleResearch(chatId, userId, text, env);
      case "analyze": return aiReply(env, chatId, userId, STICKY_MODES.analyze.wrap(text));
      case "translate": return aiReply(env, chatId, userId, pxTemplate`ترجمه کن: ${text}`);
      case "promptgen": return aiReply(env, chatId, userId, STICKY_MODES.promptgen.wrap(text));
    }
  }

  // 🧙 ویزارد فعال (اپ‌ساز، پروفایل، پرامپت)
  const wizard = await getDb(env, `user:${userId}:wizard`, null);
  if (wizard) return handleWizardInput(env, chatId, userId, text, wizard);

  // 🛰 Platform wizard (add provider, bulk import, doctor, agent, automation)
  const pfWiz = await getPlatformWizard(env, userId);
  if (pfWiz) {
    if (await handlePlatformWizard(env, chatId, userId, text, pfWiz)) return;
  }

  // 🗣 Natural-language infrastructure control (high-confidence only)
  if (!(await getDb(env, `user:${userId}:mode`, null))) {
    if (await maybeHandleNaturalOps(env, chatId, userId, text)) return;
  }

  // 🔒 حالت چسبان فعال (ترجمه خودکار، گرامر، خلاصه، اپ سفارشی و ...)
  const mode = await getDb(env, `user:${userId}:mode`, null);
  if (mode && mode.startsWith("app:")) {
    // 🚀 اجرای اپ سفارشی کاربر
    const appId = mode.slice(4);
    const apps = await getApps(env, userId);
    const app = apps.find(a => a.id === appId);
    if (app) {
      app.runs = (app.runs || 0) + 1;
      await saveApps(env, userId, apps);
      return aiReply(env, chatId, userId, text, {
        systemExtra: pxTemplate`🎯 تو الان اپ سفارشی «${app.name}» هستی. دستورالعمل اصلی:\n${app.prompt}` +
          (app.output ? pxTemplate`\nفرمت خروجی: ${app.output}` : "") +
          pxTemplate`\nورودی کاربر را دقیقاً طبق این دستورالعمل پردازش کن.`,
        modelOverride: app.model && app.model !== "auto" ? app.model : undefined
      });
    }
    await delDb(env, `user:${userId}:mode`);
  }
  if (mode && STICKY_MODES[mode]) {
    if (mode === "research") return handleResearch(chatId, userId, text, env);
    if (mode === "websearch") return aiReply(env, chatId, userId, text, { grounding: true, forceGemini: true });
    if (mode === "kb") return kbAnswer(env, chatId, userId, text);
    const wrap = STICKY_MODES[mode].wrap;
    if (wrap) return aiReply(env, chatId, userId, wrap(text));
  }

  // 💬 چت عادی با هوش مصنوعی (با تشخیص خودکار نیاز به جستجوی وب)
  await aiReply(env, chatId, userId, text, { autoSearch: true });
}

// ─────────────────────────────────────────────
// 🌐 Router اصلی Worker
// ─────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    loadEnvKeys(env);
    const url = new URL(request.url);
    MINIAPP_URL = env.MINIAPP_URL || `https://${url.hostname}/app`;
    // Seeding/purging is idempotent and irrelevant to the response — never block on it.
    // (This used to race a 2.5s timer on every cold isolate, adding up to 2.5s to the
    //  first API call the Mini App made after any scale-out.)
    if (_seedPromise && ctx && ctx.waitUntil) {
      try { ctx.waitUntil(_seedPromise); } catch {}
    }

    try {
      // �� Mini App (HTML سبک، بدون build)
      if (url.pathname === "/app" || url.pathname === "/app/" || url.pathname === "/miniapp") {
        return miniAppResponse();
      }

      // �� REST API برای Mini App
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        // Handle OPTIONS for CORS preflight
        if (request.method === "OPTIONS") {
          const origin = request.headers.get("origin");
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": origin || "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Telegram-Init-Data, X-Admin-Token, X-PIMX-Language",
              "Access-Control-Max-Age": "86400",
              "Vary": "Origin"
            }
          });
        }
        
        const res = await handleApi(request, env, BOT_TOKEN, ADMIN_ID);
        const origin = request.headers.get("origin");
        if (origin) {
          res.headers.set("Access-Control-Allow-Origin", origin);
          res.headers.set("Access-Control-Allow-Credentials", "true");
        }
        res.headers.set("Vary", "Origin");
        return res;
      }

      // 📨 وبهوک تلگرام
      if (url.pathname === "/webhook" && request.method === "POST") {
        // The sender ID in an update is trustworthy only after Telegram's
        // webhook secret is verified, particularly for database export.
        if (!BOT_TOKEN) return new Response("bot unavailable", { status: 503 });
        const secret = env.TELEGRAM_WEBHOOK_SECRET || await sha256('pimx-webhook:' + BOT_TOKEN);
        if (request.headers.get('x-telegram-bot-api-secret-token') !== secret) return new Response("forbidden", { status: 403 });
        let update;
        try { update = await request.json(); } catch { return new Response("bad request", { status: 400 }); }
        ctx.waitUntil((async () => {
          try {
            if (update.message) await handleMessage(env, update.message);
            else if (update.callback_query) await handleCallback(env, update.callback_query);
            else if (update.edited_message?.text) await handleMessage(env, update.edited_message);
          } catch (e) {
            try {
              const cid = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
              const uid = update.message?.from?.id || update.callback_query?.from?.id || update.edited_message?.from?.id;
              if (cid) await withLanguage(await savedLanguage(env, uid), () => sendMessage(cid, TGM.error({ title: pxText("خطای غیرمنتظره"), message: String(e.message || e).slice(0, 200), hint: pxText("اگر تکرار شد، /health را بررسی کنید."), retriable: true })));
            } catch {}
          }
        })());
        return new Response("ok");
      }

      // ⚙️ ثبت وبهوک
      if (url.pathname === "/setup") {
        const webhookUrl = `https://${url.hostname}/webhook`;
        const appUrl = `https://${url.hostname}/app`;
        const res = await sendTG("setWebhook", {
          url: webhookUrl,
          secret_token: env.TELEGRAM_WEBHOOK_SECRET || await sha256('pimx-webhook:' + BOT_TOKEN),
          allowed_updates: ["message", "callback_query", "edited_message"],
          drop_pending_updates: false
        });
        // دکمه منوی Mini App + لیست دستورات
        const menu = await sendTG("setChatMenuButton", {
          menu_button: { type: "web_app", text: "PIMXAGENT", web_app: { url: appUrl } }
        });
        const commands = await sendTG("setMyCommands", {
          commands: [
            { command: "start", description: pxText("شروع") },
            { command: "menu", description: pxText("منوی اصلی") },
            { command: "infra", description: pxText("مرکز کنترل زیرساخت") },
            { command: "app", description: pxText("باز کردن Mini App") },
            { command: "chats", description: pxText("تاریخچه چتها") },
            { command: "provider", description: pxText("مدیریت پروایدرها") },
            { command: "models", description: pxText("مدلها") },
            { command: "testmodel", description: pxText("تست مدل") },
            { command: "doctor", description: pxText("عیبیابی API") },
            { command: "benchmark", description: pxText("بنچمارک مدلها") },
            { command: "routing", description: pxText("مسیریابی هوشمند") },
            { command: "monitor", description: pxText("مانیتورینگ") },
            { command: "agents", description: pxText("عاملهای هوشمند") },
            { command: "automate", description: pxText("اتوماسیون جدید") },
            { command: "council", description: pxText("شورای چندمدلی AI") },
            { command: "backup", description: pxText("دانلود اطلاعات و حافظهٔ من") },
            { command: "backupdb", description: pxText("پشتیبان کل دیتابیس (ادمین)") },
            { command: "restore", description: pxText("بازیابی و انتقال از حساب دیگر") },
            { command: "format", description: pxText("نمونهٔ قالب‌بندی تلگرام") },
            { command: "help", description: pxText("راهنما") }
          ]
        });
        return new Response(JSON.stringify({
          webhook: webhookUrl, miniapp: appUrl, telegram: res, menuButton: menu.ok, commands: commands.ok
        }, null, 2), { headers: { "Content-Type": "application/json" } });
      }

      // 📊 وضعیت سیستم
      if (url.pathname === "/status") {
        const users = await getDb(env, "global:users", []);
        const banned = await getDb(env, "global:banned", []);
        const speed = await getDb(env, "stats:speed", []);
        const avgSpeed = speed.length ? speed.reduce((a, b) => a + b.duration, 0) / speed.length : 0;
        const wh = await sendTG("getWebhookInfo", {});
        return new Response(JSON.stringify({
          status: "🟢 online",
          users: users.length,
          banned: banned.length,
          nvidia_keys: NVIDIA_KEYS.length,
          avg_response_ms: Math.round(avgSpeed),
          webhook: wh.result?.url || null,
          pending_updates: wh.result?.pending_update_count || 0
        }, null, 2), { headers: { "Content-Type": "application/json" } });
      }

      // 🔬 تست جستجوی وب از خودِ محیط Workers (برای عیب‌یابی)
      if (url.pathname === "/debug-search") {
        const q = url.searchParams.get("q") || "test";
        const out = { query: q };
        try { out.ddg = await ddgSearch(q, 3); } catch (e) { out.ddg_error = String(e.message || e); }
        try { out.bing = await bingSearch(q, 3); } catch (e) { out.bing_error = String(e.message || e); }
        try { out.gnews = await gnewsSearch(q, 3); } catch (e) { out.gnews_error = String(e.message || e); }
        if (url.searchParams.get("raw")) {
          const probe = async (name, u, headers) => {
            try {
              const r = await fetch(u, { headers });
              const body = await r.text();
              out[name] = { status: r.status, len: body.length, head: body.slice(0, 150).replace(/\s+/g, " ") };
            } catch (e) { out[name] = { error: String(e.message || e) }; }
          };
          await probe("raw_ddg", `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0" });
          await probe("raw_ddg_lite", `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0" });
          await probe("raw_gnews", `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fa&gl=IR&ceid=IR:fa`, { "User-Agent": "Mozilla/5.0 (compatible; rss-reader)" });
          await probe("raw_bing", `https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss`, { "User-Agent": "Mozilla/5.0 (compatible; rss-reader)" });
          await probe("raw_wiki", `https://fa.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&format=json`, {});
        }
        if (url.searchParams.get("full")) {
          try {
            const g = await geminiGrounding(q);
            out.answer = { model: g.model, text: g.text.slice(0, 500), sources: (g.sources || []).length };
          } catch (e) { out.answer_error = String(e.message || e); }
        }
        return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
      }

      // 🔬 تست کامل تحقیق: یک Job واقعی برای چت ادمین می‌سازد (رفتار وبهوک شبیه‌سازی می‌شود)
      if (url.pathname === "/debug-research") {
        const topic = url.searchParams.get("topic") || pxText("هوش مصنوعی");
        let jobId = null;
        const p = (async () => { jobId = await handleResearch(ADMIN_ID, ADMIN_ID, topic, env); })();
        // مثل وبهوک: پردازش در waitUntil ادامه می‌یابد، ولی برای گرفتن jobId کمی صبر می‌کنیم
        await Promise.race([p, new Promise(r => setTimeout(r, 3000))]);
        ctx.waitUntil(p);
        return new Response(JSON.stringify({ started: true, topic, jobId }), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/debug-job") {
        const id = url.searchParams.get("id");
        const job = id ? await getDb(env, `rjob:${id}`, null) : null;
        const list = await getDb(env, "global:research_jobs", []);
        return new Response(JSON.stringify({
          job: job ? { stage: job.stage, updated: new Date(job.updated).toISOString(), topic: job.topic, sources: (job.sources || []).length, deepLen: (job.deepText || "").length } : null,
          activeJobs: list
        }, null, 2), { headers: { "Content-Type": "application/json" } });
      }

      return new Response(
        "🤖 AI Telegram Bot is running!\n\n/setup — register webhook\n/status — system status",
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    } catch (e) {
      return new Response(`error: ${String(e)}`, { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    loadEnvKeys(env);
    ctx.waitUntil(handleCronTrigger(env));
  }
};
