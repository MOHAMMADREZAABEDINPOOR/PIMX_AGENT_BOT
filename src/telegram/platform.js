// ─────────────────────────────────────────────
// 💬 Telegram interface for the platform
// همه امکانات Mini App از تلگرام هم قابل دسترسی است
// ─────────────────────────────────────────────
import { ctx, isAdmin } from "../core/ctx.js";
import { kvGet, kvPut, kvDel, readMany, indexRemove } from "../core/kv.js";
import { auditRead } from "../core/audit.js";
import {
  listProviders, getProvider, createProvider, updateProvider, deleteProvider,
  publicProvider, providerHealth, parseKeys, bulkCreateProviders, pickKey, renderNameTemplate
} from "../gateway/providers.js";
import {
  listModels, getModel, deleteModel, discoverModels, testModel, testModels,
  saveModel, costPer1M, scoreModel, getWeights, TEST_SUITE, DEFAULT_TESTS
} from "../gateway/models.js";
import { diagnose } from "../gateway/doctor.js";
import { runBenchmark, QUICK_TASKS, FULL_TASKS, compareModels } from "../gateway/benchmark.js";
import { getRoutingConfig, setRoutingConfig, POLICIES, selectModels, route } from "../gateway/router.js";
import { snapshot, usageRange, healthOverview, evaluateAlerts, healthSweep, trackPlatformUsage, listAlertRules, addAlertRule } from "../ops/monitor.js";
import { listAgents, runAgent, researchReport, factCheck } from "../agents/runtime.js";
import { listTools, runTool } from "../agents/tools.js";
import { parseIntent, execute, stagePending, takePending, quickIntent } from "../agents/nlops.js";
import { listTasks, createTask, deleteTask, taskFromNaturalLanguage, tickTasks, listWorkflows, runWorkflow, workflowFromNaturalLanguage } from "../ops/automation.js";
import { listMemories, addMemory, searchMemory, optimizePrompt } from "../knowledge/memory.js";
import { runCouncil, estimateCouncil, detectCouncilIntent, COUNCIL_MODES } from "../gateway/council.js";
import { TG, TGM, KB } from "../ui/tg.js";

const WKEY = uid => `tgwiz:${uid}`;

function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function kb(rows) { return { inline_keyboard: rows }; }
function backKb() { return kb([[{ text: "‹ زیرساخت", callback_data: "pf:menu" }]]); }
const fmtMs = v => v === null || v === undefined ? "—" : (v >= 1000 ? (v / 1000).toFixed(1) + "s" : Math.round(v) + "ms");
const fmtUsd = v => v === null || v === undefined ? "—" : v === 0 ? "رایگان" : "$" + Number(v).toFixed(Number(v) < 0.01 ? 5 : 3);
const num = v => Number(v || 0).toLocaleString("en-US");
const shortId = id => String(id || "").slice(0, 40);

// ارسال یا ویرایش همان پیام (جلوگیری از انباشت منوها)
async function send(chatId, html, keyboard = null, editMsg = null) {
  if (editMsg && ctx.tg.editMessageFull) {
    const r = await ctx.tg.editMessageFull(chatId, editMsg, html, keyboard);
    if (r?.ok !== false) return r;
  }
  if (editMsg && ctx.tg.editMessage) {
    try {
      const r = await ctx.tg.editMessage(chatId, editMsg, html, keyboard);
      if (r?.ok !== false) return r;
    } catch {}
  }
  return ctx.tg.sendMessage(chatId, html, keyboard);
}

export function platformMenuKb(appUrl) {
  const rows = [
    [{ text: "▣ پروایدرها", callback_data: "pf:providers" }, { text: "◉ مدل‌ها", callback_data: "pf:models" }],
    [{ text: "＋ افزودن پروایدر", callback_data: "pf:addprov" }, { text: "📦 ایمپورت گروهی", callback_data: "pf:bulk" }],
    [{ text: "🩺 Doctor", callback_data: "pf:doctor" }, { text: "🧪 تست همه مدل‌ها", callback_data: "pf:testall" }],
    [{ text: "📊 بنچمارک", callback_data: "pf:bench" }, { text: "⇄ مسیریابی", callback_data: "pf:routing" }],
    [{ text: "◎ مانیتورینگ", callback_data: "pf:monitor" }, { text: "💬 چت‌های Mini App", callback_data: "pf:chats" }],
    [{ text: "✦ ایجنت‌ها", callback_data: "pf:agents" }, { text: "⏱ اتوماسیون", callback_data: "pf:tasks" }],
    [{ text: "▥ مصرف و هزینه", callback_data: "pf:usage" }]
  ];
  if (appUrl) rows.unshift([{ text: "🖥 Mini App", web_app: { url: appUrl } }]);
  rows.push([{ text: "‹ منوی اصلی", callback_data: "menu" }]);
  return KB.raw(rows);
}

// ─────────────────────────────────────────────
// دستورات
// ─────────────────────────────────────────────
export async function handlePlatformCommand(env, chatId, userId, cmd, args, opts = {}) {
  switch (cmd) {
    case "/infra": case "/platform": case "/panel":
      await send(chatId, infraHeader(), platformMenuKb(opts.appUrl));
      return true;

    case "/app": case "/miniapp": case "/dashboard":
      if (!opts.appUrl) { await send(chatId, "⚠️ آدرس Mini App تنظیم نشده است.", backKb()); return true; }
      await send(chatId,
        "🚀 <b>PIMXAGENT Mini App</b>\n\nکنترل کامل زیرساخت هوش مصنوعی: پروایدرها، مدلها، آزمایشگاه، بنچمارک، مانیتورینگ و اتوماسیون.",
        kb([[{ text: "باز کردن داشبورد", web_app: { url: opts.appUrl } }], [{ text: "🔙 منو", callback_data: "menu" }]]));
      return true;

    case "/provider": case "/providers": {
      if (args.startsWith("add")) return startAddProvider(env, chatId, userId, args.slice(3).trim());
      if (args.startsWith("bulk")) return startBulkImport(env, chatId, userId);
      if (args.startsWith("del") || args.startsWith("remove")) {
        const r = await execute(env, { intent: "provider.delete", args: { name: args.replace(/^(del|delete|remove)\s*/i, "").trim() } }, { userId });
        return renderResult(env, chatId, userId, "provider.delete", r);
      }
      return listProvidersMsg(env, chatId);
    }

    case "/models": case "/model": {
      // اگر آرگومان مدل قدیمی بود، به هندلر اصلی برگردان
      if (args && !/^(list|healthy|failed|all|test|delete)/i.test(args)) return false;
      return listModelsMsg(env, chatId, args.trim() || "");
    }
    case "/chats": case "/chat_history": case "/convs":
      return chatsMsg(env, chatId, userId, 0);
    case "/pmodels":
      return listModelsMsg(env, chatId, args.trim());

    case "/testmodel": {
      if (!args) { await send(chatId, "🧪 فرمت: <code>/testmodel نام-مدل</code>\nیا <code>/testmodel all</code>", backKb()); return true; }
      if (/^all$/i.test(args)) return testAll(env, chatId, userId);
      const r = await execute(env, { intent: "model.test", args: { model: args } }, { userId });
      return renderResult(env, chatId, userId, "model.test", r);
    }

    case "/discover": {
      const r = await execute(env, { intent: "model.discover", args: { name: args } }, { userId, onProgress: () => {} });
      return renderResult(env, chatId, userId, "model.discover", r);
    }

    case "/doctor": {
      if (!args) { await putDbWiz(env, userId, { type: "doctor", step: "url" }); await send(chatId, "🩺 <b>API Doctor</b>\n\nBase URL را بفرستید:", cancelKb()); return true; }
      return runDoctor(env, chatId, userId, args, "");
    }

    case "/benchmark": {
      const r = await execute(env, { intent: "model.benchmark", args: { names: args ? args.split(/[\s,]+/) : [], limit: 5 } },
        { userId, onProgress: m => send(chatId, m) });
      return renderResult(env, chatId, userId, "model.benchmark", r);
    }

    case "/compare": {
      const names = args.split(/\s+(?:vs|با|,)\s+|[,]/).map(s => s.trim()).filter(Boolean);
      if (names.length < 2) { await send(chatId, "⚖️ فرمت: <code>/compare مدل۱ vs مدل۲</code>", backKb()); return true; }
      const r = await execute(env, { intent: "model.compare", args: { names } }, { userId });
      return renderResult(env, chatId, userId, "model.compare", r);
    }

    case "/routing": {
      if (args && POLICIES[args.trim()]) {
        await setRoutingConfig(env, { policy: args.trim() }, userId);
        await send(chatId, `⇄ سیاست مسیریابی: <b>${esc(POLICIES[args.trim()].label)}</b>`, backKb());
        return true;
      }
      return routingMsg(env, chatId);
    }

    case "/monitor": return monitorMsg(env, chatId);

    case "/pusage": {
      const days = Number(args) || 7;
      const u = await usageRange(env, days);
      const rows = [
        ["درخواست‌ها", num(u.totals.requests)],
        ["خطاها", num(u.totals.errors)],
        ["توکن‌ها", num(u.totals.tokens)],
        ["هزینه تخمینی", fmtUsd(u.totals.cost)],
        ["میانگین تأخیر", fmtMs(u.totals.avgLatency)]
      ];
      const modelList = u.byModel.length
        ? "\n\n" + TG.section("پرمصرف‌ترین مدل‌ها") + "\n" +
          u.byModel.slice(0, 8).map(m => `• <code>${esc(m.name)}</code> — ${num(m.requests)} req · ${fmtMs(m.avgLatency)}`).join("\n")
        : "";
      const text = TGM.stats({
        title: `مصرف و هزینه (${days} روز)`,
        sub: `آمار ثبت‌شده پلتفرم هوش مصنوعی`,
        rows
      }) + modelList;
      await send(chatId, text, backKb());
      return true;
    }

    case "/agents": {
      const agents = await listAgents(env);
      const text = TGM.card({
        icon: "🤝",
        title: `عامل‌های هوشمند (${agents.length})`,
        sub: "ایجنت‌های خودکار با دسترسی به ابزار و وب",
        items: agents.slice(0, 12).map(a => `<b>${esc(a.name)}</b>: <i>${esc((a.description || "").slice(0, 60))}</i>`),
        footer: "▶️ اجرای ایجنت: /agent research موضوع شما"
      });
      await send(chatId, text,
        kb([...agents.slice(0, 8).map(a => [{ text: `▶️ ${a.name}`, callback_data: `pf:agrun:${a.id}`.slice(0, 64) }]), [{ text: "🏠 منوی زیرساخت", callback_data: "pf:menu" }]]));
      return true;
    }

    case "/agent": {
      const sp = args.indexOf(" ");
      const key = sp === -1 ? args : args.slice(0, sp);
      const goal = sp === -1 ? "" : args.slice(sp + 1);
      if (!key || !goal) { await send(chatId, "✦ فرمت: <code>/agent research آخرین وضعیت مدلهای open-source</code>", backKb()); return true; }
      const agents = await listAgents(env);
      const agent = agents.find(a => a.id === key || a.key === key || a.name.toLowerCase().includes(key.toLowerCase())) || agents[0];
      return runAgentTg(env, chatId, userId, agent.id, goal);
    }

    case "/factcheck": {
      if (!args) { await send(chatId, "🔎 فرمت: <code>/factcheck ادعای مورد بررسی</code>", backKb()); return true; }
      return runAgentTg(env, chatId, userId, "builtin:factcheck", `Fact-check: ${args}`);
    }

    case "/tools": {
      const tools = listTools();
      await send(chatId, `⚒ <b>ابزارها (${tools.length})</b>\n\n` +
        tools.map(t => `• <code>${esc(t.name)}</code> — <i>${esc(t.description.slice(0, 60))}</i>`).join("\n") +
        `\n\n▶️ <code>/tool web_search {"query":"AI news"}</code>`, backKb());
      return true;
    }

    case "/tool": {
      const sp = args.indexOf(" ");
      const name = sp === -1 ? args : args.slice(0, sp);
      let toolArgs = {};
      if (sp !== -1) { try { toolArgs = JSON.parse(args.slice(sp + 1)); } catch { toolArgs = { query: args.slice(sp + 1) }; } }
      if (!name) { await send(chatId, "⚒ فرمت: <code>/tool نام {\"arg\":\"value\"}</code>", backKb()); return true; }
      const r = await runTool(env, name, toolArgs, { userId, confirmed: isAdmin(userId) });
      await send(chatId, r.ok
        ? `✅ <b>${esc(name)}</b> (${fmtMs(r.ms)})\n\n<pre>${esc(JSON.stringify(r.result, null, 1).slice(0, 3000))}</pre>`
        : `⚠️ اجرای <b>${esc(name)}</b> ناموفق: <i>${esc(r.error)}</i>`, backKb());
      return true;
    }

    case "/automate": {
      if (!args) { await putDbWiz(env, userId, { type: "automate" }); await send(chatId, "⏱ <b>اتوماسیون جدید</b>\n\nبه زبان طبیعی بنویسید:\n<i>«هر روز ۸ صبح اخبار AI را جستجو کن، ۵ خبر مهم را خلاصه کن و بفرست»</i>", cancelKb()); return true; }
      return createAutomation(env, chatId, userId, args);
    }

    case "/tasks": {
      const tasks = await listTasks(env, userId);
      await send(chatId, tasks.length
        ? `⏱ <b>اتوماسیونها (${tasks.length})</b>\n\n` + tasks.map(t =>
          `${t.enabled ? "🟢" : "⚪️"} <b>${esc(t.name)}</b>\n   <code>${esc(t.cron)}</code>${t.lastRun ? ` · آخرین اجرا: ${t.lastResult?.ok ? "موفق" : "ناموفق"}` : ""}`).join("\n")
        : "⏱ <i>اتوماسیونی ندارید.</i>\n\nبسازید: <code>/automate هر روز ۸ صبح…</code>",
        kb([...tasks.slice(0, 8).map(t => [{ text: `🗑 ${t.name}`, callback_data: `pf:taskdel:${t.id}`.slice(0, 64) }]), [{ text: "＋ اتوماسیون جدید", callback_data: "pf:newtask" }], [{ text: "🏠 منوی زیرساخت", callback_data: "pf:menu" }]]));
      return true;
    }

    case "/workflows": {
      const wfs = await listWorkflows(env, userId);
      await send(chatId, wfs.length
        ? `⋔ <b>ورکفلوها (${wfs.length})</b>\n\n` + wfs.map(w => `• <b>${esc(w.name)}</b> — ${w.nodes.length} گره\n   <i>${w.nodes.map(n => n.type).join(" → ")}</i>`).join("\n")
        : "⋔ <i>ورکفلویی ندارید.</i>\n\nبسازید: <code>/workflow اخبار AI را جستجو، تحلیل و ارسال کن</code>",
        kb([...wfs.slice(0, 8).map(w => [{ text: `▶️ ${w.name}`, callback_data: `pf:wfrun:${w.id}`.slice(0, 64) }]), [{ text: "🏠 منوی زیرساخت", callback_data: "pf:menu" }]]));
      return true;
    }

    case "/workflow": {
      if (!args) { await send(chatId, "⋔ فرمت: <code>/workflow توضیح ورکفلو به زبان طبیعی</code>", backKb()); return true; }
      const wf = await workflowFromNaturalLanguage(env, args, userId);
      await send(chatId, `⋔ <b>ورکفلو «${esc(wf.name)}» ساخته شد</b>\n\n${wf.nodes.map((n, i) => `${i + 1}. ${esc(n.label)} <i>(${n.type})</i>`).join("\n")}`,
        kb([[{ text: "▶️ اجرا", callback_data: `pf:wfrun:${wf.id}`.slice(0, 64) }], [{ text: "🏠 منوی زیرساخت", callback_data: "pf:menu" }]]));
      return true;
    }

    case "/promptlab": {
      if (!args) { await send(chatId, "✎ فرمت: <code>/promptlab متن پرامپت شما</code>", backKb()); return true; }
      const r = await optimizePrompt(env, userId, args);
      await send(chatId, `✎ <b>پرامپتلب</b>\n\n<b>تحلیل:</b> <i>${esc(r.analysis)}</i>\n\n` +
        r.variants.map((v, i) => `<b>${i + 1}. ${esc(v.label)}</b>\n<pre>${esc(v.prompt.slice(0, 700))}</pre>`).join("\n"), backKb());
      return true;
    }

    case "/alert": {
      if (!args) {
        const rules = await listAlertRules(env);
        await send(chatId, `🚨 <b>هشدارها (${rules.length})</b>\n\n` +
          (rules.length ? rules.map(r => `• ${esc(r.type)}${r.threshold ? ` > ${r.threshold}` : ""} → ${esc(r.target)}`).join("\n") : "<i>تنظیم نشده</i>") +
          `\n\nافزودن: <code>/alert latency 3000</code>\nانواع: providerDown, modelDown, latency, errorRate, rateLimit, cost, healthDegraded`, backKb());
        return true;
      }
      const [type, threshold] = args.split(/\s+/);
      const r = await addAlertRule(env, { type, threshold: Number(threshold) || 0, chatId }, userId);
      await send(chatId, `🚨 هشدار <b>${esc(r.type)}</b> ثبت شد.`, backKb());
      return true;
    }

    case "/audit": {
      if (!isAdmin(userId)) { await send(chatId, "⛔️ مخصوص ادمین"); return true; }
      const rows = await auditRead(env, 3, 30);
      await send(chatId, `📜 <b>لاگ حسابرسی</b>\n\n` + (rows.length
        ? rows.map(a => `• <code>${esc(a.action)}</code> ${esc(a.resource || "")} — ${a.result}`).join("\n")
        : "<i>خالی</i>"), backKb());
      return true;
    }

    case "/council": {
      const raw = String(args || "").trim();
      if (!raw) {
        await send(chatId,
          "⚡ <b>AI Council</b>\n\nچند مدل همزمان به یک سوال پاسخ میدهند.\n\n" +
          `<code>/council سوال شما</code>\n` +
          `<code>/council 4 debate سوال</code>\n` +
          `<code>/council 3 judge سوال</code>\n\n` +
          `حالتها: independent · debate · panel · judge · iterative`,
          backKb());
        return true;
      }
      let count = 3, mode = "independent", question = raw;
      const mNum = raw.match(/^(\d{1,2})\s+/);
      if (mNum) { count = Math.max(2, Math.min(20, Number(mNum[1]))); question = raw.slice(mNum[0].length).trim(); }
      const mMode = question.match(/^(independent|debate|panel|judge|iterative)\s+/i);
      if (mMode) { mode = mMode[1].toLowerCase(); question = question.slice(mMode[0].length).trim(); }
      if (!question) { await send(chatId, "⚠️ سوال را بعد از دستور بنویسید.", backKb()); return true; }
      return runCouncilTg(env, chatId, userId, { question, count, mode });
    }

    case "/research": case "/research2": case "/deepresearch": {
      if (!args) { await send(chatId, "🧠 <b>تحقیق هوشمند و عمیق وب</b>\n\nفرمت: <code>/research موضوع تحقیق</code>\n\n<i>مثال: /research آخرین پیشرفت‌های مدل‌های استدلال عمیق و هوش مصنوعی در سال جاری</i>", backKb()); return true; }
      return runAgentTg(env, chatId, userId, "builtin:research", `Produce a comprehensive, structured research report with web citations about: ${args}`);
    }

    case "/mindmap": case "/diagram": {
      if (!args) { await send(chatId, "🗺 <b>تولید نقشه ذهنی و دیاگرام</b>\n\nفرمت:\n<code>/mindmap معماری مایکروسرویس‌ها</code>\nیا <code>/diagram مراحل احراز هویت با JWT</code>", backKb()); return true; }
      return handleMindmapTg(env, chatId, userId, args, cmd === "/diagram");
    }

    case "/dailybrief": case "/digest": {
      return handleDailyBriefTg(env, chatId, userId, args);
    }

    case "/exportchat": case "/export": {
      return handleExportChatTg(env, chatId, userId);
    }

    case "/shortcuts": case "/macros": {
      return handleShortcutsTg(env, chatId);
    }

    case "/voice": case "/transcribe": {
      await send(chatId,
        "🎙 <b>استودیوی صوتی و تبدیل ویس به متن</b>\n\n" +
        "کافیست هر فایل صوتی یا Voice Note را در همین چت ارسال کنید تا به صورت خودکار متن آن پیاده‌سازی و تحلیل شود.\n\n" +
        "💡 <i>پشتیبانی از فایل‌های صوتی فارسی و انگلیسی با دقت بالا.</i>",
        backKb());
      return true;
    }

    default:
      return false;
  }
}

async function runCouncilTg(env, chatId, userId, { question, count = 3, mode = "independent", rounds } = {}) {
  const est = await estimateCouncil(env, { question, count, mode, rounds }).catch(() => null);
  const msg = await ctx.tg.sendMessage(chatId,
    `⚡ <b>AI Council شروع شد</b>\n` +
    `مدل: <b>${count}</b> · حالت: <b>${esc(COUNCIL_MODES[mode]?.label || mode)}</b>\n` +
    (est ? `در دسترس: <b>${est.available}</b> · فراخوانی تقریبی: <b>${est.modelCalls}</b>\n` : "") +
    `<i>${esc(String(question).slice(0, 200))}</i>\n\n⏳ در حال اجرای مدلها…`);
  try {
    const run = await runCouncil(env, {
      question, count, mode, rounds, userId,
      onProgress: async (p) => {
        try {
          await ctx.tg.editMessage(chatId, msg,
            `⚡ <b>Council</b> — ${esc(p.phase || "")}\n${p.done || 0}/${p.total || "?"} · <i>${esc(String(question).slice(0, 120))}</i>`);
        } catch {}
      }
    });
    const syn = run.synthesis || {};
    const finalText = syn.final || syn.synthesis || run.finalAnswer || "";
    const panel = (run.answers || []).map(a => ({
      role: a.role || "",
      model: String(a.displayName || a.model || "").slice(0, 28),
      tone: a.ok ? "ok" : "bad"
    }));
    const extra = [
      (syn.strong && syn.strong.length ? "<b>نقاط قوت</b>\n" + syn.strong.map(x => "• " + esc(x)).join("\n") : ""),
      (syn.disagreements && syn.disagreements.length ? "<b>اختلاف‌ها</b>\n" + syn.disagreements.map(x => "• " + esc(x)).join("\n") : "")
    ].filter(Boolean).join("\n\n");
    const body = TGM.council({
      question,
      mode: [run.mode, syn.winner ? "برنده: " + syn.winner : ""].filter(Boolean).join(" · "),
      panel,
      consensus: typeof syn.agreement === "number" ? syn.agreement : null,
      synthesis: (ctx.util.mdToHtml ? ctx.util.mdToHtml(finalText) : esc(finalText)) + (extra ? "\n\n" + extra : ""),
      cost: syn.confidence !== undefined && syn.confidence !== null ? "اطمینان " + syn.confidence + "%" : null,
      duration: "موفق " + (run.totals?.ok || 0) + " · ناموفق " + (run.totals?.fail || 0)
    });
    await ctx.tg.editMessage(chatId, msg, body.slice(0, 3900));
  } catch (e) {
    try { await ctx.tg.editMessage(chatId, msg, `⚠️ Council ناموفق:\n<i>${esc(String(e.message || e))}</i>`); }
    catch { await send(chatId, `⚠️ Council ناموفق: <i>${esc(String(e.message || e))}</i>`, backKb()); }
  }
  return true;
}

function infraHeader() {
  return [
    TG.title("🛰", "مرکز کنترل زیرساخت"),
    TG.i("مدیریت پروایدر، مدل، مسیریابی، پایش و هزینه — همه از تلگرام"),
    TG.divider(),
    "💡 " + TG.b("با زبان طبیعی هم می‌توانید کار کنید:"),
    "• " + TG.mono("ارزان‌ترین مدل vision را پیدا کن"),
    "• " + TG.mono("همه مدل‌های ناسالم را حذف کن"),
    "• " + TG.mono("این ۱۰ کلید را ایمپورت کن")
  ].join("\n");
}
function cancelKb() { return kb([[{ text: "❌ لغو", callback_data: "pf:cancel" }]]); }

// ─────────────────────────────────────────────
// 💬 تاریخچه چت Mini App — مشاهده، تغییر نام، حذف از داخل ربات
// ─────────────────────────────────────────────
const CONV_KEY = (uid, id) => `conv:${uid}:${id}`;
const CONV_INDEX = uid => `convindex:${uid}`;
const CONV_TOMB = uid => `convtomb:${uid}`;

// Deletes are tombstoned because KV reads can be stale for up to a minute.
async function convTombs(env, userId) {
  return new Set(await kvGet(env, CONV_TOMB(userId), []) || []);
}
async function tombConv(env, userId, ids) {
  const dead = await convTombs(env, userId);
  for (const id of [].concat(ids)) {
    dead.add(id);
    await kvPut(env, CONV_KEY(userId, id), { id, userId, deleted: true, ts: new Date().toISOString() }, { expirationTtl: 300 });
  }
  await kvPut(env, CONV_TOMB(userId), [...dead].slice(-500), { expirationTtl: 604800 });
}

async function listConvs(env, userId) {
  const [ids, dead] = await Promise.all([kvGet(env, CONV_INDEX(userId), []), convTombs(env, userId)]);
  const live = (ids || []).filter(id => !dead.has(id));
  const rows = await readMany(env, live.map(id => CONV_KEY(userId, id)));
  return rows
    .filter(c => c && !c.archived && !c.deleted && !dead.has(c.id))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

async function getConv(env, userId, id) {
  const dead = await convTombs(env, userId);
  if (dead.has(id)) return null;
  const c = await kvGet(env, CONV_KEY(userId, id), null);
  return c && !c.deleted ? c : null;
}

async function chatsMsg(env, chatId, userId, page = 0, editMsg = null) {
  const all = await listConvs(env, userId);
  const PAGE = 8;
  const start = page * PAGE;
  const slice = all.slice(start, start + PAGE);
  const msgCount = all.reduce((a, c) => a + (c.messages || []).length, 0);

  if (!all.length) {
    await send(chatId,
      "💬 <b>تاریخچه چتها</b>\n\n<i>گفتگویی ثبت نشده است.</i>\n\nاز Mini App یا همینجا چت کنید تا تاریخچه ساخته شود.",
      kb([[{ text: "‹ زیرساخت", callback_data: "pf:menu" }]]), editMsg);
    return true;
  }

  const text =
    `💬 <b>تاریخچه چتها</b>\n\n` +
    `گفتگو: <b>${all.length}</b> · پیام: <b>${num(msgCount)}</b>\n\n` +
    slice.map(c => {
      const last = (c.messages || []).filter(m => m.role === "user").slice(-1)[0];
      return `${c.pinned ? "📌" : "💬"} <b>${esc(String(c.title || "گفتگو").slice(0, 40))}</b>\n` +
        `   ${(c.messages || []).length} پیام · ${esc(relTime(c.updatedAt))}` +
        (last ? `\n   <i>${esc(String(last.content || "").replace(/\s+/g, " ").slice(0, 50))}</i>` : "");
    }).join("\n\n");

  const rows = slice.map(c => [{
    text: `${c.pinned ? "📌 " : ""}${String(c.title || "گفتگو").slice(0, 30)} (${(c.messages || []).length})`,
    callback_data: `pf:cv:${c.id}`.slice(0, 64)
  }]);
  const nav = [];
  if (page > 0) nav.push({ text: "‹ قبلی", callback_data: `pf:chats:${page - 1}` });
  if (start + PAGE < all.length) nav.push({ text: "بعدی ›", callback_data: `pf:chats:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: "🗑 حذف همه گفتگوها", callback_data: "pf:cvwipe" }]);
  rows.push([{ text: "‹ زیرساخت", callback_data: "pf:menu" }]);
  await send(chatId, text.slice(0, 3900), kb(rows), editMsg);
  return true;
}

function relTime(iso) {
  if (!iso) return "—";
  const d = Date.now() - new Date(iso).getTime();
  if (isNaN(d)) return "—";
  const s = Math.floor(d / 1000);
  if (s < 60) return "الان";
  if (s < 3600) return Math.floor(s / 60) + " دقیقه پیش";
  if (s < 86400) return Math.floor(s / 3600) + " ساعت پیش";
  return Math.floor(s / 86400) + " روز پیش";
}

async function convDetail(env, chatId, userId, convId, editMsg = null) {
  const c = await getConv(env, userId, convId);
  if (!c) { await send(chatId, "⚠️ گفتگو یافت نشد.", kb([[{ text: "‹ چتها", callback_data: "pf:chats:0" }]]), editMsg); return true; }
  const msgs = c.messages || [];
  const tail = msgs.slice(-6);
  const text =
    `💬 <b>${esc(String(c.title || "گفتگو").slice(0, 60))}</b>\n` +
    `${msgs.length} پیام · ساخت ${esc(relTime(c.createdAt))} · آخرین ${esc(relTime(c.updatedAt))}\n\n` +
    (tail.length
      ? tail.map(m => {
        const who = m.role === "user" ? "🧑" : "🤖";
        const meta = m.role === "assistant" && m.model ? ` <i>(${esc(String(m.model).split("/").pop().slice(0, 22))})</i>` : "";
        return `${who}${meta}\n${esc(String(m.content || "").replace(/\s+/g, " ").slice(0, 320))}`;
      }).join("\n\n")
      : "<i>پیامی نیست.</i>") +
    (msgs.length > 6 ? `\n\n<i>… ${msgs.length - 6} پیام قبلتر</i>` : "");

  await send(chatId, text.slice(0, 3900), kb([
    [
      { text: "✏️ تغییر نام", callback_data: `pf:cvren:${convId}`.slice(0, 64) },
      { text: c.pinned ? "📌 برداشتن پین" : "📌 پین", callback_data: `pf:cvpin:${convId}`.slice(0, 64) }
    ],
    [
      { text: "📄 خروجی متنی", callback_data: `pf:cvexp:${convId}`.slice(0, 64) },
      { text: "🧹 پاک کردن پیامها", callback_data: `pf:cvclr:${convId}`.slice(0, 64) }
    ],
    [{ text: "🗑 حذف گفتگو", callback_data: `pf:cvdel:${convId}`.slice(0, 64) }],
    [{ text: "‹ چتها", callback_data: "pf:chats:0" }, { text: "‹ زیرساخت", callback_data: "pf:menu" }]
  ]), editMsg);
  return true;
}

async function exportConv(env, chatId, userId, convId) {
  const c = await getConv(env, userId, convId);
  if (!c) { await send(chatId, "⚠️ گفتگو یافت نشد."); return true; }
  const lines = (c.messages || []).map(m =>
    `[${m.role === "user" ? "USER" : "ASSISTANT"}${m.model ? " · " + String(m.model) : ""}] ${m.ts || ""}\n${m.content || ""}`
  ).join("\n\n" + "-".repeat(48) + "\n\n");
  const body = `# ${c.title || "گفتگو"}\n# ${(c.messages || []).length} messages · created ${c.createdAt}\n\n${lines}`;
  if (ctx.tg.sendDocument) {
    await ctx.tg.sendDocument(chatId, `chat_${String(c.title || "conv").replace(/[^\w\u0600-\u06FF-]+/g, "_").slice(0, 24)}.txt`, body, "📄 خروجی گفتگو");
  } else {
    await send(chatId, `<pre>${esc(body.slice(0, 3500))}</pre>`);
  }
  return true;
}

// ─────────────────────────────────────────────
// ویزاردها
// ─────────────────────────────────────────────
async function putDbWiz(env, userId, w) { await kvPut(env, WKEY(userId), w, { expirationTtl: 1800 }); }
export async function getPlatformWizard(env, userId) { return kvGet(env, WKEY(userId), null); }
async function clearWiz(env, userId) { await kvDel(env, WKEY(userId)); }

async function startAddProvider(env, chatId, userId, seed = "") {
  const url = (seed.match(/https?:\/\/\S+/) || [])[0];
  if (url) {
    await putDbWiz(env, userId, { type: "addprov", step: "key", data: { baseUrl: url } });
    await send(chatId, `▣ <b>افزودن پروایدر</b>\n\nBase URL: <code>${esc(url)}</code>\n\n🔑 کلید(های) API را بفرستید — <b>میتوانید چند کلید بدهید</b>: هر خط یک کلید، یا با کاما جدا کنید.\n<i>یا <code>-</code> اگر کلید لازم نیست.</i>`, cancelKb());
    return true;
  }
  await putDbWiz(env, userId, { type: "addprov", step: "url", data: {} });
  await send(chatId, "▣ <b>افزودن پروایدر — قدم ۱ از ۳</b>\n\n🌐 Base URL را بفرستید:\n<i>مثال: https://api.example.com/v1</i>\n\n💡 مسیر /chat/completions را وارد نکنید.", cancelKb());
  return true;
}

async function startBulkImport(env, chatId, userId) {
  await putDbWiz(env, userId, { type: "bulk", step: "url", data: {} });
  await send(chatId, "📦 <b>ایمپورت گروهی — قدم ۱ از ۳</b>\n\n🌐 Base URL مشترک را بفرستید:", cancelKb());
  return true;
}

export async function handlePlatformWizard(env, chatId, userId, text, wizard) {
  const t = String(text || "").trim();
  if (wizard.type === "convrename") {
    await clearWiz(env, userId);
    const c = await getConv(env, userId, wizard.convId);
    if (!c) { await send(chatId, "⚠️ گفتگو یافت نشد.", kb([[{ text: "‹ چتها", callback_data: "pf:chats:0" }]])); return true; }
    c.title = t.slice(0, 80) || c.title;
    c.updatedAt = new Date().toISOString();
    await kvPut(env, CONV_KEY(userId, wizard.convId), c);
    await send(chatId, `✅ نام گفتگو به <b>${esc(c.title)}</b> تغییر کرد.`);
    return convDetail(env, chatId, userId, wizard.convId);
  }
  if (wizard.type === "addprov") {
    if (wizard.step === "url") {
      wizard.data.baseUrl = t;
      wizard.step = "key";
      await putDbWiz(env, userId, wizard);
      await send(chatId, "▣ <b>قدم ۲ از ۳</b>\n\n🔑 کلید(های) API را بفرستید.\n\n<b>چند کلید؟</b> هر خط یک کلید بگذارید (یا با کاما جدا کنید) — همه روی همین پروایدر ثبت میشوند و بهصورت چرخشی استفاده میشوند.\n<i>یا <code>-</code> اگر کلید لازم نیست.</i>", cancelKb());
      return true;
    }
    if (wizard.step === "key") {
      if (t === "-") {
        wizard.data.apiKeys = [];
      } else {
        const keys = parseKeys(t);
        wizard.data.apiKeys = keys.length ? keys : [t];
      }
      wizard.step = "fmt";
      await putDbWiz(env, userId, wizard);
      const kc = wizard.data.apiKeys.length;
      await send(chatId, `▣ <b>قدم ۳ از ۴</b>\n\n${kc ? `🔑 <b>${kc}</b> کلید شناسایی شد.\n\n` : ""}⚙️ فرمت و پروتکل API را انتخاب کنید (یا نام ارسال کنید):`,
        kb([
          [
            { text: "⚡ خودکار (Auto)", callback_data: "pf:provfmt:auto" },
            { text: "🤖 OpenAI سازگار", callback_data: "pf:provfmt:openai" }
          ],
          [
            { text: "🧠 Claude (Anthropic)", callback_data: "pf:provfmt:claude" },
            { text: "✨ Google Gemini", callback_data: "pf:provfmt:gemini" }
          ],
          [{ text: "❌ انصراف", callback_data: "pf:cancel" }]
        ])
      );
      return true;
    }
    if (wizard.step === "fmt") {
      const low = t.toLowerCase();
      if (["openai", "claude", "anthropic", "gemini", "auto"].includes(low)) {
        wizard.data.format = low;
      } else if (t !== "-") {
        wizard.data.name = t;
      }
      wizard.step = "name";
      await putDbWiz(env, userId, wizard);
      await send(chatId, `▣ <b>قدم ۴ از ۴</b>\n\n🏷 نام نمایشی پروایدر را بفرستید (یا <code>-</code> برای نام خودکار):`, cancelKb());
      return true;
    }
    if (wizard.step === "name") {
      await clearWiz(env, userId);
      if (t !== "-") wizard.data.name = t;
      return finishAddProvider(env, chatId, userId, wizard.data);
    }
  }
  if (wizard.type === "bulk") {
    if (wizard.step === "url") {
      wizard.data.baseUrl = t;
      wizard.step = "keys";
      await putDbWiz(env, userId, wizard);
      await send(chatId, "📦 <b>قدم ۲ از ۳</b>\n\n🔑 کلیدها را بفرستید — هر خط یک کلید، یا با کاما، یا JSON:", cancelKb());
      return true;
    }
    if (wizard.step === "keys") {
      const keys = parseKeys(t);
      if (!keys.length) { await send(chatId, "⚠️ کلید معتبری پیدا نشد. دوباره بفرستید:", cancelKb()); return true; }
      wizard.data.keys = keys;
      wizard.step = "tpl";
      await putDbWiz(env, userId, wizard);
      await send(chatId, `📦 <b>قدم ۳ از ۳</b>\n\n${keys.length} کلید شناسایی شد.\n\n🏷 الگوی نامگذاری را بفرستید (یا <code>-</code>):\n<i>مثال: Provider-{n} · OpenRouter-{n} · Backup-{n}</i>`, cancelKb());
      return true;
    }
    if (wizard.step === "tpl") {
      await clearWiz(env, userId);
      const tpl = t === "-" ? "Provider-{n}" : t;
      return finishBulk(env, chatId, userId, { ...wizard.data, nameTemplate: tpl });
    }
  }
  if (wizard.type === "doctor") {
    if (wizard.step === "url") {
      wizard.data = { baseUrl: t };
      wizard.step = "key";
      await putDbWiz(env, userId, wizard);
      await send(chatId, "🩺 کلید API را بفرستید (یا <code>-</code>):", cancelKb());
      return true;
    }
    if (wizard.step === "key") {
      await clearWiz(env, userId);
      return runDoctor(env, chatId, userId, wizard.data.baseUrl, t === "-" ? "" : t);
    }
  }
  if (wizard.type === "addmodel") {
    await clearWiz(env, userId);
    const r = await execute(env, { intent: "model.add", args: { providerId: wizard.providerId, models: t.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) } },
      { userId, onProgress: m => send(chatId, m) });
    return renderResult(env, chatId, userId, "model.add", r);
  }
  if (wizard.type === "automate") {
    await clearWiz(env, userId);
    return createAutomation(env, chatId, userId, t);
  }
  if (wizard.type === "agent") {
    await clearWiz(env, userId);
    return runAgentTg(env, chatId, userId, wizard.agentId, t);
  }
  if (wizard.type === "nlkeys") {
    await clearWiz(env, userId);
    const keys = parseKeys(t);
    if (!keys.length) { await send(chatId, "⚠️ کلید معتبری پیدا نشد.", backKb()); return true; }
    return finishBulk(env, chatId, userId, { baseUrl: wizard.baseUrl, keys, nameTemplate: wizard.nameTemplate || "Provider-{n}" });
  }
  await clearWiz(env, userId);
  return false;
}

async function finishAddProvider(env, chatId, userId, data) {
  const msg = await ctx.tg.sendMessage(chatId, "⏳ <b>در حال بررسی پروایدر…</b>\n<i>DNS · TLS · احراز هویت · سازگاری · کشف مدل</i>");
  const edit = (html, keyboard) => send(chatId, html, keyboard, msg);
  try {
    const r = await execute(env, { intent: "provider.add", args: data }, { userId, onProgress: t => edit(typeof t === "string" ? t : "⏳ …") });
    if (r.error) { await edit(`⚠️ ${esc(r.error)}`, backKb()); return true; }
    const p = r.provider;
    return showProviderModels(env, chatId, p.id, {
      editMsg: msg,
      header:
        `🟢 <b>پروایدر اضافه شد</b>\n` +
        `<b>${esc(p.name)}</b> · <code>${esc(p.baseUrl)}</code>\n` +
        (r.keyCount ? `کلیدها: <b>${r.keyCount}</b>\n` : "") +
        `کشف: <b>${r.discovered}</b> · ایمپورت: <b>${r.imported}</b> · سالم: <b>${r.healthy}</b> · ناموفق: <b>${r.failed}</b> · ${fmtMs(r.avgLatency)}\n` +
        (Object.keys(r.capabilities || {}).length
          ? `قابلیتها: ${Object.keys(r.capabilities).map(c => `✓${c}`).join(" ")}\n`
          : "") +
        `\n<i>روی هر مدل بزنید: حذف / غیرفعال / تست</i>`
    });
  } catch (e) {
    await edit(`⚠️ <b>افزودن پروایدر ناموفق بود.</b>\n\n<i>${esc(String(e.message || e))}</i>`, backKb());
  }
  return true;
}

// لیست مدلهای یک پروایدر با اکشن روی هر مدل
async function showProviderModels(env, chatId, providerId, { editMsg = null, page = 0, header = null } = {}) {
  const p = await getProvider(env, providerId);
  if (!p) { await send(chatId, "⚠️ پروایدر یافت نشد.", backKb(), editMsg); return true; }
  const rows = await listModels(env, { providerId });
  const PAGE = 10;
  const start = page * PAGE;
  const slice = rows.slice(start, start + PAGE);
  const healthy = rows.filter(m => m.status === "healthy").length;
  const text = (header || `◉ <b>مدلهای ${esc(p.name)}</b> (${rows.length}) — ${healthy} سالم\n`) +
    (slice.length
      ? "\n" + slice.map((m, i) => {
        const icon = m.enabled === false ? "⚪️" : m.status === "healthy" ? "🟢" : m.status === "failed" ? "🔴" : m.status === "degraded" ? "🟡" : "⚪️";
        return `${icon} <b>${esc((m.displayName || m.apiModelId).slice(0, 36))}</b>\n   <code>${esc(m.apiModelId.slice(0, 42))}</code> · ${fmtMs(m.latency)}`;
      }).join("\n")
      : "\n<i>مدلی نیست — دستی اضافه کنید.</i>");
  const buttons = slice.map(m => [{
    text: `${m.enabled === false ? "⚪️" : m.status === "healthy" ? "🟢" : m.status === "failed" ? "🔴" : "🟡"} ${(m.displayName || m.apiModelId).slice(0, 28)}`,
    callback_data: `pf:mview:${m.id}`.slice(0, 64)
  }]);
  const nav = [];
  if (page > 0) nav.push({ text: "‹ قبلی", callback_data: `pf:pmodels:${providerId}:${page - 1}`.slice(0, 64) });
  if (start + PAGE < rows.length) nav.push({ text: "بعدی ›", callback_data: `pf:pmodels:${providerId}:${page + 1}`.slice(0, 64) });
  if (nav.length) buttons.push(nav);
  buttons.push([
    { text: "＋ مدل دستی", callback_data: `pf:madd:${providerId}`.slice(0, 64) },
    { text: "🧪 تست همه", callback_data: `pf:ptest:${providerId}`.slice(0, 64) }
  ]);
  buttons.push([
    { text: "🗑 حذف ناسالمها", callback_data: `pf:pdelbad:${providerId}`.slice(0, 64) },
    { text: "↻ تازهسازی", callback_data: `pf:pmodels:${providerId}:${page}`.slice(0, 64) }
  ]);
  buttons.push([{ text: "‹ پروایدرها", callback_data: "pf:providers" }, { text: "‹ زیرساخت", callback_data: "pf:menu" }]);
  await send(chatId, text.slice(0, 3900), kb(buttons), editMsg);
  return true;
}

async function showModelDetail(env, chatId, modelId, editMsg = null) {
  const m = await getModel(env, modelId);
  if (!m) { await send(chatId, "⚠️ مدل یافت نشد.", backKb(), editMsg); return true; }
  const caps = Object.entries(m.capabilities || {})
    .filter(([, v]) => v?.supported)
    .map(([k, v]) => `✓ ${k}${v.confidence ? ` (${v.confidence}%)` : ""}`)
    .join("\n") || "<i>نامشخص</i>";
  const icon = m.enabled === false ? "⚪️" : m.status === "healthy" ? "🟢" : m.status === "failed" ? "🔴" : "🟡";
  const text =
    `${icon} <b>${esc(m.displayName || m.apiModelId)}</b>\n` +
    `<code>${esc(m.apiModelId)}</code>\n\n` +
    `پروایدر: <b>${esc(m.providerName)}</b>\n` +
    `وضعیت: <b>${esc(m.status)}</b> · ${m.enabled === false ? "غیرفعال" : "فعال"}\n` +
    `تأخیر: <b>${fmtMs(m.latency)}</b>\n` +
    `خطا: <b>${m.errorRate ?? 0}%</b>\n` +
    `Context: <b>${m.contextWindow ? num(m.contextWindow) : "—"}</b>\n` +
    `هزینه/1M: <b>${costPer1M(m) === null ? "—" : costPer1M(m) === 0 ? "رایگان" : fmtUsd(costPer1M(m))}</b>\n` +
    (m.lastError ? `\n⚠️ <i>${esc(String(m.lastError).slice(0, 120))}</i>\n` : "") +
    `\n<b>قابلیتها:</b>\n${caps}`;
  await send(chatId, text, kb([
    [
      { text: m.enabled === false ? "✅ فعالسازی" : "⏸ غیرفعال", callback_data: `pf:mtog:${m.id}`.slice(0, 64) },
      { text: "🧪 تست", callback_data: `pf:mtest:${m.id}`.slice(0, 64) }
    ],
    [
      { text: "🗑 حذف مدل", callback_data: `pf:mdel:${m.id}`.slice(0, 64) },
      { text: "⭐ پیشفرض", callback_data: `pf:mdef:${m.id}`.slice(0, 64) }
    ],
    [{ text: "‹ مدلهای پروایدر", callback_data: `pf:pmodels:${m.providerId}`.slice(0, 64) }],
    [{ text: "‹ زیرساخت", callback_data: "pf:menu" }]
  ]), editMsg);
  return true;
}

async function modelsBrowser(env, chatId, editMsg = null) {
  const providers = await listProviders(env);
  const all = await listModels(env);
  const healthy = all.filter(m => m.status === "healthy").length;
  const text =
    `◉ <b>مدلها</b>\n\n` +
    `کل: <b>${all.length}</b> · سالم: <b>${healthy}</b> · پروایدر: <b>${providers.length}</b>\n\n` +
    `<i>اول پروایدر را انتخاب کنید (یا همه):</i>`;
  const rows = [[{ text: `📋 همه مدلها (${all.length})`, callback_data: "pf:mall" }]];
  for (const p of providers.slice(0, 20)) {
    const n = all.filter(m => m.providerId === p.id).length;
    const h = all.filter(m => m.providerId === p.id && m.status === "healthy").length;
    rows.push([{ text: `${p.enabled ? "🟢" : "⚪️"} ${p.name.slice(0, 28)} (${h}/${n})`, callback_data: `pf:pmodels:${p.id}`.slice(0, 64) }]);
  }
  rows.push([{ text: "＋ پروایدر جدید", callback_data: "pf:addprov" }, { text: "‹ زیرساخت", callback_data: "pf:menu" }]);
  await send(chatId, text, kb(rows), editMsg);
  return true;
}

async function finishBulk(env, chatId, userId, data) {
  const msg = await ctx.tg.sendMessage(chatId, `📦 <b>ایمپورت ${data.keys.length} کلید…</b>`);
  const edit = (html) => ctx.tg.editMessage(chatId, msg, html).catch(() => {});
  const preview = data.keys.map((_, i) => renderNameTemplate(data.nameTemplate, i + 1, data.keys.length));
  await edit(`📦 <b>ساخت ${data.keys.length} پروایدر</b>\n\n<code>${esc(preview.slice(0, 12).join("\n"))}</code>${preview.length > 12 ? "\n…" : ""}`);
  try {
    const r = await execute(env, { intent: "provider.bulkAdd", args: data }, { userId, onProgress: edit });
    if (r.error) { await edit(`⚠️ ${esc(r.error)}`); return true; }
    await edit(
      `📦 <b>ایمپورت گروهی کامل شد</b>\n\n` +
      `ساختهشده: <b>${r.created}</b>\nسالم: <b>${r.healthy}</b>\nنامعتبر: <b>${r.invalid}</b>\nمحدودشده (rate limit): <b>${r.rateLimited}</b>\n\n` +
      r.report.slice(0, 15).map(x => `${x.status === "healthy" ? "🟢" : x.status === "rateLimited" ? "🟡" : "🔴"} ${esc(x.name)}${x.status !== "healthy" ? ` — <i>${esc((x.detail || "").slice(0, 40))}</i>` : ""}`).join("\n"),
      kb([[{ text: "◉ همه مدلها", callback_data: "pf:models" }], [{ text: "🧪 تست همه", callback_data: "pf:testall" }], [{ text: "🏠 منوی زیرساخت", callback_data: "pf:menu" }]]));
  } catch (e) {
    await edit(`⚠️ ${esc(String(e.message || e))}`);
  }
  return true;
}

async function runDoctor(env, chatId, userId, baseUrl, apiKey) {
  const msg = await ctx.tg.sendMessage(chatId, "🩺 <b>API Doctor در حال اجرا…</b>");
  try {
    const r = await diagnose({ baseUrl, apiKey });
    await ctx.tg.editMessage(chatId, msg,
      `🩺 <b>API DOCTOR</b>\n<code>${esc(r.baseUrl)}</code>\n\n` +
      r.steps.map(s => `${s.ok ? "✓" : "✗"} <b>${esc(s.name)}</b>${s.detail ? ` — <i>${esc(s.detail.slice(0, 70))}</i>` : ""}`).join("\n") +
      (r.info ? `\n\nمدل کشفشده: <b>${r.info.discovered}</b>${r.info.modelSample?.length ? `\n<i>${esc(r.info.modelSample.join(", ").slice(0, 120))}</i>` : ""}` : "") +
      (r.diagnosis?.cause
        ? `\n\n<b>علت احتمالی:</b>\n${esc(r.diagnosis.cause)}\n\n<b>راهحل پیشنهادی:</b>\n${esc(r.diagnosis.fix)}`
        : `\n\n✅ <b>${esc(r.diagnosis?.fix || "همه بررسیها موفق")}</b>`),
      kb([[{ text: "＋ افزودن این پروایدر", callback_data: "pf:addprov" }], [{ text: "🏠 منوی زیرساخت", callback_data: "pf:menu" }]]));
  } catch (e) {
    await ctx.tg.editMessage(chatId, msg, `⚠️ ${esc(String(e.message || e))}`);
  }
  return true;
}

// ─────────────────────────────────────────────
// نمایشها
// ─────────────────────────────────────────────
async function listProvidersMsg(env, chatId, editMsg = null) {
  const providers = await listProviders(env);
  const models = await listModels(env);
  if (!providers.length) {
    await send(chatId, "▣ <b>هنوز پروایدری اضافه نکردهاید.</b>\n\nفقط Base URL و کلید API را بدهید — مدلها خودکار کشف، تست و دستهبندی میشوند.",
      kb([[{ text: "＋ افزودن پروایدر", callback_data: "pf:addprov" }], [{ text: "📦 ایمپورت گروهی", callback_data: "pf:bulk" }], [{ text: "🏠 منوی زیرساخت", callback_data: "pf:menu" }]]));
    return true;
  }
  const rows = providers.map(p => {
    const mine = models.filter(m => m.providerId === p.id);
    const h = providerHealth(p);
    return `${p.enabled ? (p.status === "failed" ? "🔴" : p.status === "degraded" ? "🟡" : "🟢") : "⚪️"} <b>${esc(p.name)}</b>\n` +
      `   <code>${esc(p.baseUrl.slice(0, 46))}</code>\n` +
      `   مدل: ${mine.length} (${mine.filter(m => m.status === "healthy").length} سالم) · کلید: ${(p.keys || []).length} · ${fmtMs(h.avgLatency)}`;
  }).join("\n\n");
  await send(chatId, `▣ <b>پروایدرها (${providers.length})</b>\n\n${rows}`,
    kb([...providers.slice(0, 12).map(p => [
      { text: `◉ ${p.name.slice(0, 22)}`, callback_data: `pf:pmodels:${p.id}`.slice(0, 64) },
      { text: "🧪", callback_data: `pf:ptest:${p.id}`.slice(0, 64) },
      { text: "🗑", callback_data: `pf:pdel:${p.id}`.slice(0, 64) }
    ]), [{ text: "＋ افزودن", callback_data: "pf:addprov" }, { text: "📦 گروهی", callback_data: "pf:bulk" }], [{ text: "‹ زیرساخت", callback_data: "pf:menu" }]]), editMsg);
  return true;
}

async function listModelsMsg(env, chatId, filterArg = "", providerId = null, editMsg = null, page = 0) {
  if (providerId) return showProviderModels(env, chatId, providerId, { editMsg, page: Number(page) || 0 });
  if (!filterArg || filterArg === "all") return modelsBrowser(env, chatId, editMsg);

  const filter = {};
  if (filterArg === "all-list") { /* no status filter — full list */ }
  else if (/healthy|سالم/i.test(filterArg)) filter.status = "healthy";
  else if (/failed|خراب/i.test(filterArg)) filter.status = "failed";
  const rows = await listModels(env, filter);
  if (!rows.length) {
    await send(chatId, "◉ <b>مدلی در رجیستری نیست.</b>\n\nیک پروایدر اضافه کنید تا مدلها خودکار کشف شوند.",
      kb([[{ text: "＋ افزودن پروایدر", callback_data: "pf:addprov" }], [{ text: "‹ زیرساخت", callback_data: "pf:menu" }]]), editMsg);
    return true;
  }
  const weights = await getWeights(env);
  const all = await listModels(env);
  const sorted = rows.map(m => ({ m, s: scoreModel(m, weights, all) })).sort((a, b) => (b.s.overall || 0) - (a.s.overall || 0));
  const PAGE = 12;
  const pnum = Number(page) || 0;
  const startI = pnum * PAGE;
  const slice = sorted.slice(startI, startI + PAGE);
  const healthy = rows.filter(m => m.status === "healthy").length;
  const text = `◉ <b>مدلها (${rows.length})</b> — ${healthy} سالم\n\n` +
    slice.map(({ m, s }) =>
      `${m.enabled === false ? "⚪️" : m.status === "healthy" ? "🟢" : m.status === "failed" ? "🔴" : "🟡"} <b>${esc((m.displayName || m.apiModelId).slice(0, 30))}</b>\n` +
      `   ${esc(m.providerName)} · ${fmtMs(m.latency)} · ${s.overall ?? "—"}`
    ).join("\n");
  const buttons = slice.map(({ m }) => [{
    text: `${m.enabled === false ? "⚪️" : m.status === "healthy" ? "🟢" : m.status === "failed" ? "🔴" : "🟡"} ${(m.displayName || m.apiModelId).slice(0, 30)}`,
    callback_data: `pf:mview:${m.id}`.slice(0, 64)
  }]);
  const nav = [];
  if (pnum > 0) nav.push({ text: "‹ قبلی", callback_data: `pf:mall:${pnum - 1}` });
  if (startI + PAGE < sorted.length) nav.push({ text: "بعدی ›", callback_data: `pf:mall:${pnum + 1}` });
  if (nav.length) buttons.push(nav);
  buttons.push(
    [{ text: "📂 بر اساس پروایدر", callback_data: "pf:models" }, { text: "🧪 تست همه", callback_data: "pf:testall" }],
    [{ text: "🟢 فقط سالم", callback_data: "pf:mhealthy" }, { text: "🗑 ناسالمها", callback_data: "pf:delbad" }],
    [{ text: "‹ زیرساخت", callback_data: "pf:menu" }]
  );
  await send(chatId, text.slice(0, 3900), kb(buttons), editMsg);
  return true;
}

async function routingMsg(env, chatId) {
  const cfg = await getRoutingConfig(env);
  const all = await listModels(env);
  const def = all.find(m => m.id === cfg.defaultModelId);
  const body = [
    `سیاست فعال: ${TG.b(esc(POLICIES[cfg.policy]?.label || cfg.policy))}`,
    `استراتژی توزیع: ${TG.b(esc(cfg.strategy))}`,
    `سقف جایگزین (Fallback): ${TG.b(cfg.maxFallbacks)}`,
    `مدل پیشفرض: ${TG.b(def ? esc(def.displayName) : "انتخاب خودکار")}`,
    `تعداد قوانین اختصاصی: ${TG.b(cfg.rules.length)}`
  ].join("\n");

  const rulesList = cfg.rules.length
    ? "\n\n" + TG.b("قوانین فعال:") + "\n" + cfg.rules.map(r => {
        const m = all.find(x => x.id === r.modelId);
        return `• ${esc(r.task)} → ${TG.code(esc(m?.displayName || r.providerId || "—"))}`;
      }).join("\n")
    : "\n\n" + TG.i("قانونی تعریف نشده — سیستم با ارزیابی درخواست مدل بهینه را انتخاب می‌کند.");

  await send(chatId,
    TGM.card("⇄", "مسیریابی هوشمند گیت‌وی", body + rulesList, [
      { k: "سیاست", v: POLICIES[cfg.policy]?.label || cfg.policy },
      { k: "مدل", v: (def?.displayName || "خودکار").slice(0, 16) }
    ]),
    kb([
      Object.keys(POLICIES).map(p => ({ text: (cfg.policy === p ? "✅ " : "") + POLICIES[p].label, callback_data: `pf:pol:${p}` })),
      [{ text: "‹ منوی زیرساخت", callback_data: "pf:menu" }]
    ]));
  return true;
}

async function monitorMsg(env, chatId) {
  const snap = await snapshot(env);
  const ov = await healthOverview(env);
  const statsList = [
    { k: "پروایدر فعال", v: `${snap.providersHealthy}/${snap.providers}` },
    { k: "مدل سالم", v: `${snap.modelsHealthy}/${snap.models}` },
    { k: "مدل ناموفق", v: `${snap.modelsFailed}` },
    { k: "میانگین تأخیر", v: fmtMs(snap.avgLatency) },
    { k: "درخواست امروز", v: num(snap.requests) },
    { k: "خطاهای امروز", v: num(snap.errors) },
    { k: "هزینه تخمینی", v: fmtUsd(snap.cost) }
  ];

  let provSection = "";
  if (ov.providers.length) {
    provSection = "\n\n" + TG.b("وضعیت پروایدرها:") + "\n" + ov.providers.slice(0, 8).map(p => {
      const dot = p.status === "healthy" ? "🟢" : p.status === "failed" ? "🔴" : "🟡";
      return `${dot} ${TG.b(esc(p.name))} — ${p.healthyModels}/${p.models} · ${TG.code(fmtMs(p.avgLatency))}`;
    }).join("\n");
  }

  await send(chatId,
    TGM.stats("پایش و سلامت زیرساخت PIMXAGENT", statsList) + provSection,
    kb([
      [{ text: "🔄 تست چرخشی", callback_data: "pf:sweep" }, { text: "🚨 هشدارها", callback_data: "pf:alerts" }],
      [{ text: "‹ منوی زیرساخت", callback_data: "pf:menu" }]
    ]));
  return true;
}

async function testAll(env, chatId, userId, providerId = null) {
  const msg = await ctx.tg.sendMessage(chatId, "🧪 <b>آمادهسازی تست…</b>");
  const edit = (html) => ctx.tg.editMessage(chatId, msg, html).catch(() => {});
  let rows = await listModels(env);
  if (providerId) rows = rows.filter(m => m.providerId === providerId);
  rows = rows.filter(m => m.enabled).slice(0, 60);
  if (!rows.length) { await edit("⚠️ مدلی برای تست وجود ندارد."); return true; }
  let done = 0, healthy = 0, failed = 0;
  const results = await testModels(env, rows.map(m => m.id), ["basic"], {
    userId, concurrency: 4,
    onProgress: async p => {
      done = p.done;
      const bars = Math.round((done / rows.length) * 20);
      await edit(`🧪 <b>تست ${rows.length} مدل</b>\n\n<code>[${"█".repeat(bars)}${"░".repeat(20 - bars)}] ${Math.round((done / rows.length) * 100)}%</code>\n\n${done} تست شد`);
    }
  });
  for (const r of results) r.model?.status === "healthy" ? healthy++ : failed++;
  const bad = results.filter(r => r.model?.status !== "healthy");
  await edit(
    `🧪 <b>تست کامل شد</b>\n\n` +
    `کل: <b>${results.length}</b>\n🟢 سالم: <b>${healthy}</b>\n🔴 ناموفق: <b>${failed}</b>\n\n` +
    (bad.length ? `<b>ناموفقها:</b>\n${bad.slice(0, 12).map(r => `• ${esc((r.model?.apiModelId || "").slice(0, 30))} — <i>${esc((r.model?.lastError || "").slice(0, 34))}</i>`).join("\n")}` : "همه مدلها سالماند ✓"),
    kb([[{ text: "🗑 حذف ناسالمها", callback_data: "pf:delbad" }], [{ text: "🏁 بنچمارک سالمها", callback_data: "pf:bench" }], [{ text: "🏠 منوی زیرساخت", callback_data: "pf:menu" }]]));
  return true;
}

async function runAgentTg(env, chatId, userId, agentId, goal) {
  const msg = await ctx.tg.sendMessage(chatId, "✦ <b>عامل شروع کرد…</b>");
  let last = 0;
  try {
    const r = await runAgent(env, {
      agentId, goal, userId,
      onUpdate: async (timeline) => {
        if (Date.now() - last < 1600) return;
        last = Date.now();
        await ctx.tg.editMessage(chatId, msg, `✦ <b>در حال اجرا</b>\n\n<code>${esc(timeline)}</code>`).catch(() => {});
      }
    });
    const body = r.answer.length > 3200 ? r.answer.slice(0, 3200) + "…" : r.answer;
    await ctx.tg.editMessage(chatId, msg, `✦ <b>اجرا کامل شد</b>\n\n<code>${esc(r.timeline)}</code>`).catch(() => {});
    const agentBody = (ctx.util.mdToHtml ? ctx.util.mdToHtml(body) : esc(body)) +
      (r.sources && r.sources.length
        ? "\n\n" + TG.section("منابع") + "\n" + TG.numbered(r.sources.slice(0, 6).map((s, i) => TG.source(i + 1, String(s.title || "").slice(0, 50), esc(s.uri))))
        : "");
    await send(chatId, TGM.agent({
      name: r.displayName || r.model || "ایجنت",
      goal,
      steps: String(r.timeline || "").split("\n").filter(Boolean).map(l => ({ label: l.replace(/^[^\w\u0600-\u06FF]+/, ""), state: "done" })),
      result: agentBody,
      duration: fmtMs(r.latency) + " · " + (r.toolCalls ? r.toolCalls.length : 0) + " ابزار"
    }), backKb());
    await trackPlatformUsage(env, { userId, model: r.model, promptTokens: 0, completionTokens: r.tokens, cost: r.cost, latency: r.latency, ok: true, task: "agent" });
  } catch (e) {
    await ctx.tg.editMessage(chatId, msg, `⚠️ <b>اجرای عامل ناموفق بود.</b>\n\n<i>${esc(String(e.message || e).slice(0, 300))}</i>`).catch(() => {});
  }
  return true;
}

async function createAutomation(env, chatId, userId, text) {
  try {
    const t = await taskFromNaturalLanguage(env, text, { userId, chatId, tzOffsetMin: 210 });
    await send(chatId,
      `⏱ <b>اتوماسیون ساخته شد</b>\n\n<b>${esc(t.name)}</b>\nزمانبندی: <code>${esc(t.cron)}</code>\nدستور: <i>${esc(t.prompt.slice(0, 200))}</i>\n\nهر دقیقه بررسی میشود و در زمان مقرر اجرا و برایتان ارسال میگردد.`,
      kb([[{ text: "▶️ اجرای آزمایشی", callback_data: `pf:taskrun:${t.id}`.slice(0, 64) }], [{ text: "⏱ همه اتوماسیونها", callback_data: "pf:tasks" }]]));
  } catch (e) {
    await send(chatId, `⚠️ ساخت اتوماسیون ناموفق: <i>${esc(String(e.message || e))}</i>`, backKb());
  }
  return true;
}

// ─────────────────────────────────────────────
// callbackها
// ─────────────────────────────────────────────
export async function handlePlatformCallback(env, cq, opts = {}) {
  const data = cq.data || "";
  if (!data.startsWith("pf:")) return false;
  const chatId = cq.message?.chat?.id;
  const userId = cq.from.id;
  const ack = (text = "", alert = false) => ctx.tg.answerCallback(cq.id, text, alert);
  const [, action, arg] = data.split(":");

  const editMsg = cq.message || null;
  if (action === "menu") { await ack(); await send(chatId, infraHeader(), platformMenuKb(opts.appUrl), editMsg); return true; }
  if (action === "cancel") { await ack("لغو شد"); await kvDel(env, WKEY(userId)); await send(chatId, "❌ لغو شد.", backKb(), editMsg); return true; }
  if (action === "provfmt") {
    await ack();
    const wiz = await getPlatformWizard(env, userId);
    if (!wiz || wiz.type !== "addprov") return true;
    wiz.data = wiz.data || {};
    wiz.data.format = arg || "auto";
    wiz.step = "name";
    await putDbWiz(env, userId, wiz);
    await send(chatId, `✅ فرمت پروتکل: <b>${esc(arg)}</b>\n\n🏷 <b>قدم آخر:</b> نام دلخواه پروایدر را بفرستید (یا <code>-</code> برای نام خودکار):`, cancelKb(), editMsg);
    return true;
  }
  if (action === "providers") { await ack(); return listProvidersMsg(env, chatId, editMsg); }
  if (action === "models") { await ack(); return modelsBrowser(env, chatId, editMsg); }
  if (action === "mall") { await ack(); return listModelsMsg(env, chatId, "all-list", null, editMsg, Number(arg) || 0); }
  if (action === "mhealthy") { await ack(); return listModelsMsg(env, chatId, "healthy", null, editMsg); }
  if (action === "pmodels") {
    await ack();
    const parts = data.split(":");
    const pid = parts[2];
    const page = Number(parts[3] || 0) || 0;
    return showProviderModels(env, chatId, pid, { editMsg, page });
  }
  if (action === "mview") { await ack(); return showModelDetail(env, chatId, arg, editMsg); }
  if (action === "mtest") {
    await ack("تست…");
    try {
      const r = await testModel(env, arg, ["basic", "streaming"], userId);
      await send(chatId, `🧪 <b>نتیجه تست</b>\n\n${r.results.map(x => `${x.ok ? "✓" : "✗"} ${esc(x.label)} · ${fmtMs(x.latency)}${x.error ? " — <i>" + esc(x.error.slice(0, 40)) + "</i>" : ""}`).join("\n")}`, null, editMsg);
      return showModelDetail(env, chatId, arg, editMsg);
    } catch (e) { await send(chatId, `⚠️ ${esc(String(e.message || e))}`, backKb(), editMsg); return true; }
  }
  if (action === "mtog") {
    await ack();
    const m = await getModel(env, arg);
    if (!m) { await send(chatId, "⚠️ مدل یافت نشد", backKb(), editMsg); return true; }
    m.enabled = m.enabled === false;
    await saveModel(env, m);
    return showModelDetail(env, chatId, arg, editMsg);
  }
  if (action === "mdel") {
    await ack();
    const m = await getModel(env, arg);
    if (!m) { await send(chatId, "⚠️ مدل یافت نشد", backKb(), editMsg); return true; }
    const pid = m.providerId;
    await deleteModel(env, arg, userId);
    await send(chatId, `🗑 مدل <b>${esc(m.displayName || m.apiModelId)}</b> حذف شد.`, null, editMsg);
    return showProviderModels(env, chatId, pid, { editMsg });
  }
  if (action === "mdef") {
    await ack("تنظیم شد");
    await setRoutingConfig(env, { defaultModelId: arg }, userId);
    return showModelDetail(env, chatId, arg, editMsg);
  }
  if (action === "madd") {
    await ack();
    await kvPut(env, WKEY(userId), { type: "addmodel", providerId: arg }, { expirationTtl: 1800 });
    await send(chatId,
      "＋ <b>افزودن مدل</b>\n\nشناسه مدل را بفرستید.\n\n<b>چند مدل با هم؟</b> هر خط یک شناسه بگذارید (یا با کاما جدا کنید):\n" +
      "<code>gpt-4o\nclaude-3-5-sonnet\nmeta/llama-3.3-70b-instruct</code>\n\n<i>پس از افزودن، همه خودکار تست میشوند.</i>",
      cancelKb(), editMsg);
    return true;
  }
  if (action === "pdelbad") {
    await ack();
    const bad = (await listModels(env, { providerId: arg })).filter(m => m.status === "failed" || m.status === "degraded");
    for (const m of bad) await deleteModel(env, m.id, userId);
    await send(chatId, `🗑 <b>${bad.length}</b> مدل ناسالم حذف شد.`, null, editMsg);
    return showProviderModels(env, chatId, arg, { editMsg });
  }
  if (action === "addprov") { await ack(); return startAddProvider(env, chatId, userId); }
  if (action === "bulk") { await ack(); return startBulkImport(env, chatId, userId); }

  // ── تاریخچه چت ──
  if (action === "chats") { await ack(); return chatsMsg(env, chatId, userId, Number(arg || 0) || 0, editMsg); }
  if (action === "cv") { await ack(); return convDetail(env, chatId, userId, arg, editMsg); }
  if (action === "cvren") {
    await ack();
    await kvPut(env, WKEY(userId), { type: "convrename", convId: arg }, { expirationTtl: 1800 });
    await send(chatId, "✏️ <b>تغییر نام گفتگو</b>\n\nنام جدید را بفرستید:", cancelKb(), editMsg);
    return true;
  }
  if (action === "cvpin") {
    const c = await getConv(env, userId, arg);
    if (!c) { await ack("یافت نشد"); return true; }
    c.pinned = !c.pinned;
    await kvPut(env, CONV_KEY(userId, arg), c);
    await ack(c.pinned ? "پین شد" : "پین برداشته شد");
    return convDetail(env, chatId, userId, arg, editMsg);
  }
  if (action === "cvclr") {
    const c = await getConv(env, userId, arg);
    if (!c) { await ack("یافت نشد"); return true; }
    c.messages = [];
    c.updatedAt = new Date().toISOString();
    await kvPut(env, CONV_KEY(userId, arg), c);
    await ack("پیامها پاک شد");
    return convDetail(env, chatId, userId, arg, editMsg);
  }
  if (action === "cvdel") {
    await tombConv(env, userId, arg);
    await indexRemove(env, CONV_INDEX(userId), arg);
    await ack("حذف شد");
    return chatsMsg(env, chatId, userId, 0, editMsg);
  }
  if (action === "cvexp") { await ack("در حال ساخت فایل…"); return exportConv(env, chatId, userId, arg); }
  if (action === "cvwipe") {
    await ack();
    await send(chatId, "⚠️ <b>حذف همه گفتگوها؟</b>\n\nاین عملیات بازگشتپذیر نیست.", kb([
      [{ text: "✅ بله، همه را حذف کن", callback_data: "pf:cvwipe2" }],
      [{ text: "❌ لغو", callback_data: "pf:chats:0" }]
    ]), editMsg);
    return true;
  }
  if (action === "cvwipe2") {
    const ids = await kvGet(env, CONV_INDEX(userId), []);
    if ((ids || []).length) await tombConv(env, userId, ids);
    await kvPut(env, CONV_INDEX(userId), []);
    await ack(`${(ids || []).length} گفتگو حذف شد`);
    return chatsMsg(env, chatId, userId, 0, editMsg);
  }

  if (action === "doctor") { await ack(); await kvPut(env, WKEY(userId), { type: "doctor", step: "url" }, { expirationTtl: 1800 }); await send(chatId, "🩺 <b>API Doctor</b>\n\nBase URL را بفرستید:", cancelKb()); return true; }
  if (action === "testall") { await ack("شروع شد"); return testAll(env, chatId, userId); }
  if (action === "ptest") { await ack("شروع شد"); return testAll(env, chatId, userId, arg); }
  if (action === "routing") { await ack(); return routingMsg(env, chatId); }
  if (action === "monitor") { await ack(); return monitorMsg(env, chatId); }
  if (action === "usage") { await ack(); return handlePlatformCommand(env, chatId, userId, "/pusage", "7", opts); }
  if (action === "council") { await ack(); return handlePlatformCommand(env, chatId, userId, "/council", "", opts); }
  if (action === "research") { await ack(); return handlePlatformCommand(env, chatId, userId, "/research", "", opts); }
  if (action === "agents") { await ack(); return handlePlatformCommand(env, chatId, userId, "/agents", "", opts); }
  if (action === "tools") { await ack(); return handlePlatformCommand(env, chatId, userId, "/tools", "", opts); }
  if (action === "tasks") { await ack(); return handlePlatformCommand(env, chatId, userId, "/tasks", "", opts); }
  if (action === "workflows") { await ack(); return handlePlatformCommand(env, chatId, userId, "/workflows", "", opts); }
  if (action === "alerts") { await ack(); return handlePlatformCommand(env, chatId, userId, "/alert", "", opts); }
  if (action === "newtask") { await ack(); await kvPut(env, WKEY(userId), { type: "automate" }, { expirationTtl: 1800 }); await send(chatId, "⏱ درخواست اتوماسیون را به زبان طبیعی بنویسید:", cancelKb()); return true; }
  if (action === "pol") {
    await setRoutingConfig(env, { policy: arg }, userId);
    await ack(`سیاست: ${POLICIES[arg]?.label || arg}`);
    return routingMsg(env, chatId);
  }
  if (action === "sweep") {
    await ack("در حال تست…");
    const r = await healthSweep(env, { batch: 6 });
    await send(chatId, `🔄 <b>تست چرخشی</b>\n\n${r.tested} مدل تست شد · ${r.healthy} سالم`, backKb());
    return true;
  }
  if (action === "fastest" || action === "cheapest") {
    await ack();
    const r = await execute(env, { intent: `model.${action}`, args: {} }, { userId });
    return renderResult(env, chatId, userId, `model.${action}`, r);
  }
  if (action === "delbad") {
    await ack();
    const r = await execute(env, { intent: "model.deleteUnhealthy", args: {} }, { userId });
    return renderResult(env, chatId, userId, "model.deleteUnhealthy", r);
  }
  if (action === "pdel") {
    await ack();
    const r = await execute(env, { intent: "provider.delete", args: { providerId: arg } }, { userId });
    return renderResult(env, chatId, userId, "provider.delete", r);
  }
  if (action === "bench") {
    await ack("بنچمارک شروع شد");
    const msg = await ctx.tg.sendMessage(chatId, "🏁 <b>بنچمارک…</b>");
    const r = await execute(env, { intent: "model.benchmark", args: { limit: 5, provider: arg } },
      { userId, onProgress: m => ctx.tg.editMessage(chatId, msg, `🏁 ${esc(m)}`).catch(() => {}) });
    if (r.error) { await ctx.tg.editMessage(chatId, msg, `⚠️ ${esc(r.error)}`); return true; }
    const run = r.run;
    await ctx.tg.editMessage(chatId, msg,
      `🏁 <b>نتیجه بنچمارک</b>\n\n` +
      run.reports.map((x, i) => `${i + 1}. <b>${esc((x.displayName || x.model || "").slice(0, 30))}</b>\n   امتیاز ${x.score?.overall ?? x.qualityScore} · کیفیت ${x.qualityScore} · ${fmtMs(x.avgLatency)} · ${fmtUsd(x.cost)}`).join("\n") +
      `\n\n🏆 برنده: <b>${esc(run.winner?.model || "—")}</b>`, backKb());
    return true;
  }
  if (action === "pbench") {
    await ack("بنچمارک شروع شد");
    return handlePlatformCallback(env, { ...cq, data: `pf:bench:${arg}` }, opts);
  }
  if (action === "agrun") {
    await ack();
    const agentId = data.slice("pf:agrun:".length);
    await kvPut(env, WKEY(userId), { type: "agent", agentId }, { expirationTtl: 1800 });
    const agents = await listAgents(env);
    const a = agents.find(x => x.id === agentId);
    await send(chatId, `✦ <b>${esc(a?.name || "عامل")}</b>\n\n<i>${esc(a?.description || "")}</i>\n\nهدف یا درخواست خود را بنویسید:`, cancelKb());
    return true;
  }
  if (action === "taskrun") {
    await ack("اجرا…");
    const tasks = await listTasks(env, userId);
    const t = tasks.find(x => x.id === arg);
    if (!t) { await send(chatId, "⚠️ تسک یافت نشد.", backKb()); return true; }
    const { runTask } = await import("../ops/automation.js");
    const r = await runTask(env, t, { notify: null });
    await send(chatId, r.ok ? `▶️ <b>${esc(t.name)}</b>\n\n${esc(String(r.output).slice(0, 3200))}` : `⚠️ ${esc(r.error || "ناموفق")}`, backKb());
    return true;
  }
  if (action === "taskdel") {
    await deleteTask(env, arg, userId);
    await ack("حذف شد");
    return handlePlatformCommand(env, chatId, userId, "/tasks", "", opts);
  }
  if (action === "wfrun") {
    await ack("اجرا…");
    const msg = await ctx.tg.sendMessage(chatId, "⋔ <b>اجرای ورکفلو…</b>");
    try {
      const run = await runWorkflow(env, arg, { userId, chatId, notify: ctx.tg.sendMessage });
      await ctx.tg.editMessage(chatId, msg,
        `⋔ <b>${esc(run.name)}</b> — ${run.status === "done" ? "✅ کامل" : "⚠️ ناموفق"}\n\n` +
        `<code>${esc((run.steps || []).map(s => `${s.status === "done" ? "✓" : s.status === "fail" ? "✗" : "–"} ${s.label}`).join("\n"))}</code>\n\n` +
        esc(String(run.output || "").slice(0, 2500)), backKb());
    } catch (e) { await ctx.tg.editMessage(chatId, msg, `⚠️ ${esc(String(e.message || e))}`); }
    return true;
  }
  if (action === "confirm") {
    await ack();
    const op = await takePending(env, userId, arg);
    if (!op) { await send(chatId, "⌛️ این عملیات منقضی شده. دوباره درخواست کنید.", backKb()); return true; }
    const r = await execute(env, { intent: op.intent, args: op.args }, { userId, confirmed: true, onProgress: m => send(chatId, m) });
    return renderResult(env, chatId, userId, op.intent, r);
  }
  if (action === "schedbrief") {
    await ack("در حال ثبت اتوماسیون…");
    return createAutomation(env, chatId, userId, "هر روز صبح ساعت ۸ گزارش اخبار و ترندهای مهم AI را بفرست");
  }
  if (action === "sc_res") {
    await ack();
    await send(chatId, "🧠 <b>موضوع تحقیق خود را بفرستید:</b>\n<i>مثال: مقایسه مدل‌های reasoning جدید مثل Claude 3.7 و o3</i>", cancelKb());
    await putDbWiz(env, userId, { type: "agent", agentId: "builtin:research" });
    return true;
  }
  if (action === "sc_map") {
    await ack();
    await send(chatId, "🗺 <b>موضوع نقشه ذهنی را بفرستید:</b>\n<i>مثال: نقشه راه یادگیری هوش مصنوعی و یادگیری عمیق در ۲۰۲۶</i>", cancelKb());
    await putDbWiz(env, userId, { type: "agent", agentId: "builtin:planner" });
    return true;
  }
  if (action === "sc_cnl") {
    await ack();
    await send(chatId, "⚡ <b>پرسش خود را برای داوری در شورای هوش مصنوعی بفرستید:</b>", cancelKb());
    return true;
  }
  if (action === "sc_brief") {
    await ack("در حال آماده‌سازی…");
    return handleDailyBriefTg(env, chatId, userId, "");
  }
  if (action === "abort") { await ack("لغو شد"); await takePending(env, userId, arg); await send(chatId, "❌ عملیات لغو شد.", backKb()); return true; }
  return false;
}

// ─────────────────────────────────────────────
// زبان طبیعی → عملیات زیرساخت
// ─────────────────────────────────────────────
export async function maybeHandleNaturalOps(env, chatId, userId, text) {
  const c = detectCouncilIntent(text);
  if (c && c.confidence >= 0.8 && c.args?.question) {
    return runCouncilTg(env, chatId, userId, c.args);
  }
  const quick = quickIntent(text);
  if (!quick || quick.confidence < 0.75) return false;
  return runNl(env, chatId, userId, text, quick);
}

export async function handleNaturalOps(env, chatId, userId, text) {
  const parsed = await parseIntent(env, text);
  if (parsed.intent === "none" || parsed.confidence < 0.55) return false;
  return runNl(env, chatId, userId, text, parsed);
}

async function runNl(env, chatId, userId, text, parsed) {
  // ورودی لازم را از خود متن استخراج کن
  if (parsed.intent === "provider.add" && !parsed.args.baseUrl) {
    return startAddProvider(env, chatId, userId, text);
  }
  if (parsed.intent === "provider.bulkAdd") {
    const keys = parsed.args.keys?.length ? parsed.args.keys : parseKeys(text);
    if (!parsed.args.baseUrl) { await startBulkImport(env, chatId, userId); return true; }
    if (!keys.length) {
      await kvPut(env, WKEY(userId), { type: "nlkeys", baseUrl: parsed.args.baseUrl, nameTemplate: parsed.args.nameTemplate }, { expirationTtl: 1800 });
      await send(chatId, "📦 کلیدها را بفرستید (هر خط یک کلید):", cancelKb());
      return true;
    }
    return finishBulk(env, chatId, userId, { baseUrl: parsed.args.baseUrl, keys, nameTemplate: parsed.args.nameTemplate || "Provider-{n}" });
  }
  if (parsed.intent === "provider.add" && parsed.args.baseUrl) {
    return finishAddProvider(env, chatId, userId, parsed.args);
  }

  const msg = await ctx.tg.sendMessage(chatId, "⚙️ <b>در حال اجرای عملیات زیرساخت…</b>");
  const edit = html => ctx.tg.editMessage(chatId, msg, html).catch(() => {});
  try {
    const r = await execute(env, parsed, { userId, onProgress: edit });
    await edit("⚙️ <b>انجام شد.</b>");
    return renderResult(env, chatId, userId, parsed.intent, r);
  } catch (e) {
    await edit(`⚠️ <b>عملیات ناموفق بود.</b>\n\n<i>${esc(String(e.message || e).slice(0, 300))}</i>`);
    return true;
  }
}

// نمایش نتیجه عملیات + تأیید عملیات مخرب
async function renderResult(env, chatId, userId, intent, r) {
  if (!r) { await send(chatId, "⚠️ نتیجهای برنگشت.", backKb()); return true; }
  if (r.error) { await send(chatId, `⚠️ ${esc(r.error)}`, backKb()); return true; }
  if (r.needsInput) { await send(chatId, `ℹ️ ${esc(r.message)}`, cancelKb()); return true; }

  if (r.type === "confirm") {
    const id = await stagePending(env, userId, { intent: r.intent, args: r.args });
    const s = r.summary || {};
    await send(chatId,
      `⚠️ <b>تأیید لازم است</b>\n\n${esc(r.message)}\n\n` +
      (s.models && Array.isArray(s.models) ? `<i>${esc(s.models.slice(0, 12).join("\n"))}</i>\n\n` : "") +
      `این عملیات بازگشتپذیر نیست.`,
      kb([[{ text: "✅ تأیید و اجرا", callback_data: `pf:confirm:${id}` }, { text: "❌ لغو", callback_data: `pf:abort:${id}` }]]));
    return true;
  }

  const fmt = {
    "provider.list": () => `▣ <b>پروایدرها</b>\n\n` + r.providers.map(p => `${p.enabled ? "🟢" : "⚪️"} <b>${esc(p.name)}</b> — ${p.modelCount} مدل (${p.healthyModels} سالم)`).join("\n"),
    "provider.deleted": () => `🗑 پروایدر <b>${esc(r.provider)}</b> و ${r.modelsDeleted} مدل حذف شد.`,
    "provider.toggled": () => `${r.enabled ? "✅" : "⛔️"} ${r.count} پروایدر ${r.enabled ? "فعال" : "غیرفعال"} شد.`,
    "provider.renamed": () => `🏷 «${esc(r.from)}» → «${esc(r.to)}»`,
    "doctor": () => `🩺 <b>API DOCTOR</b>\n\n` + r.report.steps.map(s => `${s.ok ? "✓" : "✗"} ${esc(s.name)}${s.detail ? ` — <i>${esc(s.detail.slice(0, 60))}</i>` : ""}`).join("\n") +
      (r.report.diagnosis?.cause ? `\n\n<b>علت:</b> ${esc(r.report.diagnosis.cause)}\n<b>راهحل:</b> ${esc(r.report.diagnosis.fix)}` : "\n\n✅ سالم"),
    "model.discovered": () => `📦 <b>${r.found}</b> مدل از <b>${esc(r.provider)}</b> کشف شد (${r.created} جدید).`,
    "model.added": () => `✅ ${r.count} مدل به <b>${esc(r.provider)}</b> اضافه شد — ${r.healthy} سالم.\n\n<i>${esc(r.models.slice(0, 10).join(", "))}</i>`,
    "model.list": () => `◉ <b>مدلها (${r.models.length})</b>\n\n` + r.models.slice(0, 18).map(m =>
      `${m.status === "healthy" ? "🟢" : m.status === "failed" ? "🔴" : "⚪️"} <b>${esc((m.name || "").slice(0, 32))}</b> — ${esc(m.provider)} · ${fmtMs(m.latency)} · امتیاز ${m.score?.overall ?? "—"}`).join("\n"),
    "model.pick": () => `🎯 <b>بهترین گزینهها (${esc(r.criteria)}${r.capability ? " · " + esc(r.capability) : ""})</b>\n\n` +
      r.models.map((m, i) => `${i + 1}. <b>${esc(m.name)}</b>\n   ${esc(m.provider)} · ${m.costPer1M === 0 ? "رایگان" : fmtUsd(m.costPer1M) + "/1M"} · ${fmtMs(m.latency)} · امتیاز ${m.score?.overall ?? "—"}`).join("\n"),
    "model.tested": () => `🧪 <b>${esc(r.model.name)}</b>: ${r.passed}/${r.total} موفق · ${fmtMs(r.model.latency)}\n\n` +
      r.results.map(x => `${x.ok ? "✓" : "✗"} ${esc(x.label)}${x.error ? ` — <i>${esc(x.error.slice(0, 40))}</i>` : ""}`).join("\n"),
    "model.testedAll": () => `🧪 <b>${r.total} مدل تست شد</b>\n\n🟢 سالم: ${r.healthy}\n🔴 ناموفق: ${r.failed}`,
    "model.deleted": () => `🗑 ${r.count ?? 1} مدل حذف شد.${r.message ? `\n<i>${esc(r.message)}</i>` : ""}`,
    "model.toggled": () => `${r.enabled ? "✅ فعال" : "⛔️ غیرفعال"} شد: ${r.count} مدل\n<i>${esc((r.models || []).slice(0, 10).join(", "))}</i>`,
    "model.compare": () => `⚖️ <b>مقایسه</b>\n\n` + r.rows.map(x =>
      `<b>${esc(x.displayName)}</b> (${esc(x.provider)})\n   امتیاز ${x.score?.overall ?? "—"} · کیفیت ${x.quality ?? "—"} · ${fmtMs(x.latency)}`).join("\n"),
    "benchmark": () => `🏁 <b>بنچمارک</b>\n\n` + r.run.reports.map((x, i) =>
      `${i + 1}. <b>${esc((x.displayName || x.model || "").slice(0, 30))}</b> — امتیاز ${x.score?.overall ?? x.qualityScore} · ${fmtMs(x.avgLatency)}`).join("\n") +
      `\n\n🏆 برنده: <b>${esc(r.run.winner?.model || "—")}</b>`,
    "routing.policy": () => `⇄ سیاست مسیریابی: <b>${esc(POLICIES[r.config.policy]?.label || r.config.policy)}</b>`,
    "routing.default": () => `⭐ مدل پیشفرض: <b>${esc(r.model.name)}</b> (${esc(r.model.provider)})`,
    "routing.rule": () => `⇄ قانون افزوده شد: ${esc(r.rule.task)} → <b>${esc(r.target)}</b>`,
    "routing.failover": () => `🔁 failover تنظیم شد: <b>${esc(r.primary)}</b> → <b>${esc(r.backup)}</b>`,
    "monitor": () => `◎ پروایدر ${r.snapshot.providers} · مدل سالم ${r.snapshot.modelsHealthy}/${r.snapshot.models} · تأخیر ${fmtMs(r.snapshot.avgLatency)}`,
    "usage": () => `▥ <b>مصرف ${r.days} روز</b>\n\nدرخواست ${num(r.usage.totals.requests)} · توکن ${num(r.usage.totals.tokens)} · هزینه ${fmtUsd(r.usage.totals.cost)}`,
    "provider.added": () => `🟢 پروایدر <b>${esc(r.provider.name)}</b> اضافه شد — ${r.imported} مدل، ${r.healthy} سالم.`,
    "provider.bulkAdded": () => `📦 ${r.created} پروایدر ساخته شد — ${r.healthy} سالم، ${r.invalid} نامعتبر.`
  };
  const html = (fmt[r.type] || (() => `✅ انجام شد.\n\n<pre>${esc(JSON.stringify(r, null, 1).slice(0, 1500))}</pre>`))();
  await send(chatId, html, backKb());
  return true;
}

// ─────────────────────────────────────────────
// 🗺 New Features: MindMap, DailyBrief, ExportChat, Shortcuts
// ─────────────────────────────────────────────
async function handleMindmapTg(env, chatId, userId, topic, isDiagram) {
  const msg = await ctx.tg.sendMessage(chatId, `🗺 <b>در حال تولید ${isDiagram ? "دیاگرام" : "نقشه ذهنی"} برای:</b>\n<i>${esc(topic.slice(0, 100))}</i>…`);
  try {
    const prompt = isDiagram
      ? `Generate a Mermaid sequence or flowchart diagram for: "${topic}". Provide a brief explanation in Persian, followed by a valid \`\`\`mermaid code block.`
      : `Create a comprehensive mindmap outline and Mermaid graph for the topic: "${topic}". Structure it hierarchically with main branches, sub-branches and key details in Persian, followed by a \`\`\`mermaid graph TD block.`;
    
    const res = await route(env, {
      messages: [{ role: "user", content: prompt }],
      userId,
      temperature: 0.4
    });

    const answer = res.content || res.text || "";
    const html = `🗺 <b>${isDiagram ? "دیاگرام" : "نقشه ذهنی"}: ${esc(topic.slice(0, 50))}</b>\n\n` +
      (ctx.util.mdToHtml ? ctx.util.mdToHtml(answer) : `<pre>${esc(answer)}</pre>`);

    await ctx.tg.editMessage(chatId, msg, html.slice(0, 3950));
    await trackPlatformUsage(env, { userId, model: res.modelId || "auto", promptTokens: 0, completionTokens: 0, cost: 0, latency: res.latency || 0, ok: true, task: isDiagram ? "diagram" : "mindmap" });
  } catch (e) {
    await ctx.tg.editMessage(chatId, msg, `⚠️ تولید نقشه ذهنی ناموفق: <i>${esc(String(e.message || e))}</i>`);
  }
  return true;
}

async function handleDailyBriefTg(env, chatId, userId, customTopic) {
  const topic = customTopic || "اخبار برتر فناوری، هوش مصنوعی و ترندهای کلیدی روز";
  const msg = await ctx.tg.sendMessage(chatId, `☕️ <b>در حال آماده‌سازی گزارش روزانه (Daily Brief)…</b>\n<i>موضوع: ${esc(topic.slice(0, 80))}</i>`);
  try {
    const prompt = `You are an executive AI assistant. Create a concise, high-value Daily Briefing in Persian for the topic: "${topic}".
Structure into:
1. 🚀 ۳ تیتر و رویداد کلیدی (Headlines)
2. 💡 تحلیل کوتاه و بینش کاربردی (Insights)
3. 🎯 نکته یا ابزار پیشنهادی امروز (Actionable Tip)
Use beautiful emojis, clean formatting, and concise Persian.`;

    const res = await route(env, {
      messages: [{ role: "user", content: prompt }],
      userId,
      temperature: 0.5
    });

    const answer = res.content || res.text || "";
    const html = `☕️ <b>گزارش روزانه هوش مصنوعی (Daily Brief)</b>\n\n` +
      (ctx.util.mdToHtml ? ctx.util.mdToHtml(answer) : esc(answer));

    const kbRows = [
      [{ text: "⏰ تنظیم ارسال خودکار هر روز (۸ صبح)", callback_data: "pf:schedbrief" }],
      [{ text: "🏠 منوی اصلی", callback_data: "pf:menu" }]
    ];

    await ctx.tg.editMessage(chatId, msg, html.slice(0, 3900));
    await ctx.tg.sendMessage(chatId, "💡 <i>می‌توانید دریافت این گزارش را به عنوان یک اتوماسیون روزانه تنظیم کنید:</i>", kb(kbRows));
    await trackPlatformUsage(env, { userId, model: res.modelId || "auto", promptTokens: 0, completionTokens: 0, cost: 0, latency: res.latency || 0, ok: true, task: "dailybrief" });
  } catch (e) {
    await ctx.tg.editMessage(chatId, msg, `⚠️ خطا در تهیه گزارش: <i>${esc(String(e.message || e))}</i>`);
  }
  return true;
}

async function handleExportChatTg(env, chatId, userId) {
  const all = await listConvs(env, userId);
  if (!all.length) {
    await send(chatId, "💬 <i>گفتگویی برای صدور خروجی یافت نشد.</i>", backKb());
    return true;
  }
  const latest = all[0];
  const msgs = latest.messages || [];
  if (!msgs.length) {
    await send(chatId, "💬 <i>گفتگوی فعلی خالی است.</i>", backKb());
    return true;
  }

  let mdTranscript = `# ${latest.title || "گفتگوی PIMXAGENT"}\n`;
  mdTranscript += `تاریخ صدور: ${new Date().toLocaleString("fa-IR")}\n\n---\n\n`;
  for (const m of msgs) {
    const role = m.role === "user" ? "🧑 کاربر" : "🤖 هوش مصنوعی";
    mdTranscript += `### ${role}\n${m.content}\n\n`;
  }

  await send(chatId,
    `📥 <b>خروجی گفتگوی «${esc(latest.title || "چت")}»</b>\n\n` +
    `تعداد پیام‌ها: <b>${msgs.length}</b>\n\n` +
    `<pre>${esc(mdTranscript.slice(0, 3500))}</pre>`,
    backKb());
  return true;
}

function handleShortcutsTg(env, chatId) {
  const text = "⚡️ <b>میانبرهای کاربردی و هوشمند PIMXAGENT</b>\n\n" +
    "روی هر میانبر ضربه بزنید یا دستور آن را تایپ کنید:\n\n" +
    "• <code>/research [موضوع]</code> — تحقیق عمیق وب با منابع\n" +
    "• <code>/mindmap [موضوع]</code> — نقشه ذهنی و دیاگرام تصویری\n" +
    "• <code>/council [پرسش]</code> — داوری و هم‌فکری چند مدل\n" +
    "• <code>/dailybrief</code> — گزارش خلاصه اخبار و ترندهای امروز\n" +
    "• <code>/factcheck [متن]</code> — بررسی صحت اطلاعات و ادعاها\n" +
    "• <code>/exportchat</code> — دریافت فایل و خروجی گفتگوی جاری\n" +
    "• <code>/voice</code> — راهنمای تبدیل وویس و فایل صوتی به متن";

  const rows = [
    [{ text: "🧠 تحقیق عمیق", callback_data: "pf:sc_res" }, { text: "🗺 نقشه ذهنی", callback_data: "pf:sc_map" }],
    [{ text: "⚡ شورای مدل‌ها", callback_data: "pf:sc_cnl" }, { text: "☕️ گزارش روزانه", callback_data: "pf:sc_brief" }],
    [{ text: "🖥 باز کردن Mini App", callback_data: "pf:menu" }]
  ];
  return send(chatId, text, kb(rows));
}

// ─────────────────────────────────────────────
// Cron
// ─────────────────────────────────────────────
export async function platformCron(env, { adminId } = {}) {
  const out = {};
  const now = new Date();
  try { out.tasks = await tickTasks(env, { notify: ctx.tg.sendMessage, now, max: 2 }); } catch (e) { out.tasksError = String(e.message || e); }
  // اسنپشات و ارزیابی هشدارها هر ۱۰ دقیقه
  if (now.getUTCMinutes() % 10 === 0) {
    try { out.snapshot = await snapshot(env); } catch {}
    try { out.alerts = await evaluateAlerts(env, { notify: ctx.tg.sendMessage, adminChatId: adminId }); } catch {}
  }
  // تست چرخشی سلامت هر ۳۰ دقیقه
  if (now.getUTCMinutes() % 30 === 5) {
    try { out.sweep = await healthSweep(env, { batch: 4 }); } catch {}
  }
  return out;
}

export const PLATFORM_COMMANDS = [
  "/infra", "/platform", "/panel", "/app", "/miniapp", "/dashboard",
  "/provider", "/providers", "/pmodels", "/testmodel", "/discover", "/doctor",
  "/benchmark", "/compare", "/routing", "/monitor", "/pusage",
  "/agents", "/agent", "/deepresearch", "/research2", "/research", "/factcheck",
  "/mindmap", "/diagram", "/dailybrief", "/digest", "/exportchat", "/export",
  "/shortcuts", "/macros", "/voice", "/transcribe",
  "/tools", "/tool", "/automate", "/tasks", "/workflows", "/workflow",
  "/promptlab", "/alert", "/audit", "/council"
];

