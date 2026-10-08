// ─────────────────────────────────────────────
// ✉️ PIMXAGENT — Telegram Message & Keyboard Design System
// Parse mode پروژه HTML است؛ همه پیامها از این ماژول ساخته میشوند
// تا Formatting معنا داشته باشد (سلسلهمراتب اطلاعاتی)، نه تزئینی.
// هیچ Secret/کلیدی اینجا تولید نمیشود و همه متنها Escape میشوند.
// ─────────────────────────────────────────────

const MAX_LEN = 3900;         // حاشیه امن نسبت به سقف 4096 تلگرام
const MAX_BTN_TEXT = 58;      // متن دکمه کوتاه بماند
export const DIV = "━━━━━━━━━━━━━━━━━━";

function esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function clamp(s, max = MAX_LEN) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}
function strip(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}

// ورودی HTML (خروجی مدل / تبدیل Markdown) باید قبل از ارسال ایمن شود؛
// تلگرام فقط وایتلیست محدودی از تگها را میپذیرد، پس تگهای خطرناک حذف میشوند
// و در غیر این صورت پیام با خطای parse شکست میخورد.
const DANGEROUS = "script|style|iframe|frame|object|embed|form|input|button|select|textarea|link|meta|base|svg|math";
function safe(html) {
  return String(html === null || html === undefined ? "" : html)
    .replace(new RegExp("<\\s*(" + DANGEROUS + ")[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>", "gi"), "")
    .replace(new RegExp("<\\s*\\/?" + "(" + DANGEROUS + ")\\b[^>]*>", "gi"), "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|data):[^"']*\2/gi, '$1="#"');
}

export const TG = {
  esc, clamp, strip, safe, DIV,
  MAX_LEN, MAX_BTN_TEXT,

  /* ── inline formatting ───────────────── */
  b: t => `<b>${esc(t)}</b>`,
  i: t => `<i>${esc(t)}</i>`,
  u: t => `<u>${esc(t)}</u>`,
  strike: t => `<s>${esc(t)}</s>`,
  code: t => `<code>${esc(t)}</code>`,
  pre: (t, lang) => `<pre>${lang ? `<code class="language-${esc(lang)}">` : ""}${esc(t)}${lang ? "</code>" : ""}</pre>`,
  spoiler: t => `<tg-spoiler>${esc(t)}</tg-spoiler>`,
  link: (label, url) => `<a href="${esc(url)}">${esc(label)}</a>`,
  quote: t => `<blockquote>${t}</blockquote>`,
  expandable: (t, title) => `<blockquote expandable>${title ? `<b>${esc(title)}</b>\n` : ""}${t}</blockquote>`,
  divider: () => DIV,

  /* ── blocks ──────────────────────────── */
  title: (icon, text) => `${icon ? icon + " " : ""}<b>${esc(String(text).toUpperCase())}</b>`,
  section: (text) => `<b>${esc(text)}</b>`,
  kv: (k, v) => `${esc(k)}: <b>${esc(v)}</b>`,
  mono: (t) => `<code>${esc(t)}</code>`,
  bullets: (items) => (items || []).map(x => `• ${x}`).join("\n"),
  numbered: (items) => (items || []).map((x, i) => `${i + 1}. ${x}`).join("\n"),
  stats: (parts) => (parts || []).filter(Boolean).join(" · "),
  progress: (pct, width = 10) => {
    const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const filled = Math.round((p / 100) * width);
    return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled)) + " " + p + "%";
  },
  dot: (tone) => (tone === "ok" ? "🟢" : tone === "warn" ? "🟡" : tone === "bad" ? "🔴" : "⚪"),
  empty: (t) => `📭 <i>${esc(t || "چیزی برای نمایش نیست")}</i>`,

  /* ── chips (بدون رنگ، فقط تشخیص) ─────── */
  model: (name) => `<code>${esc(name || "—")}</code>`,
  provider: (name) => `<b>${esc(name || "—")}</b>`,
  source: (n, title, url) => `${n}. <a href="${esc(url)}">${esc(title || url)}</a>`,
  time: (v) => esc(v),
  date: (unix, label, format = "wDT") => `<tg-time unix="${Math.floor(Number(unix))}" format="${String(format).replace(/[^a-zA-Z]/g, "")}">${esc(label)}</tg-time>`,
};

/* ─────────────────────────────────────────────
   پیامهای آماده — همه با داده واقعی پر میشوند
   ───────────────────────────────────────────── */
function nameSafe(s) { return String(s || "").replace(/[<>&]/g, ""); }

export const TGM = {
  // پاسخ چت: سلسلهمراتب روشن + تفکر اختیاری + امضای مدل/زمان در پایین
  answer({ body, model, latency, tokens, cost, sources, note, reasoning }) {
    const parts = [TG.title("🤖", "پاسخ هوش مصنوعی"), TG.divider()];
    if (reasoning) {
      parts.push(TG.expandable(safe(reasoning), "🧠 فرآیند تفکر مدل"), "");
    }
    parts.push(safe(body || "—"));
    if (sources && sources.length) {
      parts.push("", TG.section("📚 منابع"));
      parts.push(TG.numbered(sources.slice(0, 5).map((s, i) => TG.source(i + 1, s.title || s.domain, s.url))));
    }
    if (note) parts.push("", TG.quote(note));
    const meta = [];
    if (model) meta.push(`🤖 ${TG.model(model)}`);
    if (latency) meta.push(`⚡ ${esc(latency)}`);
    if (tokens) meta.push(`🔢 ${esc(tokens)}`);
    if (cost) meta.push(`💵 ${esc(cost)}`);
    if (meta.length) parts.push(TG.divider(), meta.join(" · "));
    return clamp(parts.join("\n"));
  },

  research({ topic, summary, findings, sources, models, duration, note }) {
    const parts = [TG.title("🔬", "تحقیق عمیق"), TG.divider()];
    if (topic) parts.push(TG.kv("موضوع", topic), "");
    if (summary) parts.push(TG.section("📌 نتیجه"), safe(summary), "");
    if (findings && findings.length) parts.push(TG.section("🔎 یافتههای کلیدی"), TG.numbered(findings.slice(0, 8).map(esc)), "");
    if (sources && sources.length) parts.push(TG.section("📚 منابع"), TG.numbered(sources.slice(0, 8).map((s, i) => TG.source(i + 1, s.title || s.domain, s.url))), "");
    if (note) parts.push(TG.quote(note), "");
    const meta = [];
    if (models) meta.push(`🤖 ${esc(models)} مدل`);
    if (duration) meta.push(`⏱ ${esc(duration)}`);
    if (meta.length) parts.push(TG.divider(), meta.join(" · "));
    return clamp(parts.join("\n"));
  },

  council({ question, mode, panel, consensus, synthesis, cost, duration }) {
    const parts = [TG.title("🧠", "شورای هوش مصنوعی"), TG.divider()];
    if (question) parts.push(TG.kv("پرسش", question), "");
    if (mode) parts.push(TG.kv("حالت", mode), "");
    if (panel && panel.length) {
      parts.push(TG.section("👥 پنل"));
      parts.push(panel.map(p => `• ${p.role ? TG.b(nameSafe(p.role)) + " — " : ""}${esc(p.model || "")}${p.tone ? " " + TG.dot(p.tone) : ""}`).join("\n"));
      parts.push("");
    }
    if (consensus !== undefined && consensus !== null) parts.push(TG.section("📊 اجماع"), TG.mono(TG.progress(consensus)), "");
    if (synthesis) parts.push(TG.section("💡 سنتز نهایی"), safe(synthesis), "");
    const meta = [];
    if (cost) meta.push(`💵 ${esc(cost)}`);
    if (duration) meta.push(`⏱ ${esc(duration)}`);
    if (meta.length) parts.push(TG.divider(), meta.join(" · "));
    return clamp(parts.join("\n"));
  },

  agent({ name, goal, steps, result, duration, tools }) {
    const parts = [TG.title("🤝", name || "ایجنت هوشمند"), TG.divider()];
    if (goal) parts.push(TG.kv("هدف", goal), "");
    if (tools && tools.length) parts.push(TG.kv("ابزارها", tools.map(esc).join(", ")), "");
    if (steps && steps.length) {
      parts.push(TG.section("مراحل"));
      parts.push(steps.map(s => {
        const icon = s.state === "run" ? "◉" : s.state === "err" || s.state === "fail" ? "✕" : s.state === "wait" ? "○" : "✓";
        return `${icon} ${esc(s.label || s.name || "")}${s.meta ? ` <i>${esc(s.meta)}</i>` : ""}`;
      }).join("\n"));
      parts.push("");
    }
    if (result) parts.push(TG.section("نتیجه"), safe(result), "");
    if (duration) parts.push(TG.divider(), `⏱ ${esc(duration)}`);
    return clamp(parts.join("\n"));
  },

  wizard({ step, total, title, hint, current, body, example }) {
    const parts = [`🧩 <b>${esc(title)}</b>`];
    if (total) parts.push(`<i>مرحله ${esc(step)} از ${esc(total)}</i>`);
    parts.push(TG.divider());
    if (body) parts.push(safe(body), "");
    if (example) parts.push(TG.quote("مثال: " + TG.mono(example)));
    if (current) parts.push("", TG.kv("مقدار فعلی", current));
    if (hint) parts.push("", TG.i(hint));
    return clamp(parts.join("\n"));
  },

  listPage({ icon, title, sub, body, page, pages, total, empty }) {
    if (empty) return TG.empty(empty);
    const parts = [TG.title(icon || "📋", title)];
    if (sub) parts.push(TG.i(sub));
    parts.push(TG.divider(), body || "");
    if (pages && pages > 1) parts.push(TG.divider(), `صفحه <b>${esc(page)}</b> از <b>${esc(pages)}</b>${total !== undefined ? ` · ${esc(total)} مورد` : ""}`);
    return clamp(parts.join("\n"));
  },

  card({ icon, title, sub, body, items, footer, note }) {
    const parts = [TG.title(icon || "◈", title)];
    if (sub) parts.push(TG.i(sub));
    parts.push(TG.divider());
    if (body) parts.push(safe(body), "");
    if (items && items.length) {
      parts.push(items.map(it => `• ${esc(it)}`).join("\n"), "");
    }
    if (note) parts.push(TG.quote(note), "");
    if (footer) parts.push(TG.divider(), esc(footer));
    return clamp(parts.join("\n"));
  },

  stats({ title, sub, rows, footer }) {
    const parts = [TG.title("📊", title || "آمار و وضعیت")];
    if (sub) parts.push(TG.i(sub));
    parts.push(TG.divider());
    if (rows && rows.length) {
      parts.push(rows.map(r => `${esc(r[0])}: <b>${esc(r[1])}</b>`).join("\n"));
    }
    if (footer) parts.push("", TG.divider(), esc(footer));
    return clamp(parts.join("\n"));
  },

  success({ title, body, id, next }) {
    const parts = [TG.title("✅", title || "انجام شد"), TG.divider()];
    if (body) parts.push(body);
    if (id) parts.push("", TG.kv("شناسه", id));
    if (next) parts.push("", TG.quote(next));
    return clamp(parts.join("\n"));
  },

  error({ title, message, reason, hint, retriable }) {
    const parts = [`⚠️ <b>${esc(title || "مشکلی پیش آمد")}</b>`, TG.divider()];
    if (message) parts.push(esc(message));
    if (reason) parts.push("", TG.kv("دلیل", reason));
    if (hint) parts.push("", TG.quote(hint));
    if (retriable) parts.push("", TG.i("میتوانید دوباره تلاش کنید."));
    return clamp(parts.join("\n"));
  },

  loading({ title, steps, note, progress }) {
    const parts = [`🧠 <b>${esc(title || "در حال پردازش…")}</b>`];
    if (progress !== undefined && progress !== null) parts.push("", `<code>${TG.progress(progress, 12)}</code>`);
    if (steps && steps.length) parts.push("", steps.join("\n"));
    parts.push("", `<i>${esc(note || "این پیام بهروزرسانی میشود.")}</i>`);
    return clamp(parts.join("\n"));
  }
};

/* ─────────────────────────────────────────────
   Inline Keyboard Builder
   Telegram Bot API supports primary (blue), success (green), danger (red).
   قواعد: حداکثر ۲ دکمه در ردیف، primary اول، ناوبری در پایین.
   ───────────────────────────────────────────── */
export const KB = {
  raw: (rows) => styleKeyboard({ inline_keyboard: rows }),
  btn: (text, data, style) => ({
    text: String(text || "").slice(0, MAX_BTN_TEXT),
    callback_data: String(data || "").slice(0, 64),
    ...(style ? { style } : {})
  }),
  url: (text, url) => ({ text: String(text || "").slice(0, MAX_BTN_TEXT), url }),
  webapp: (text, url) => ({ text: String(text || "").slice(0, MAX_BTN_TEXT), web_app: { url }, style: "primary" }),
  row(...btns) { return btns.filter(Boolean); },
  grid(items, perRow = 2) {
    const rows = [];
    for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
    return rows;
  },
  primary(label, data) { return [KB.btn(label, data)]; },
  nav({ back, home = true, appUrl, appLabel } = {}) {
    const rows = [];
    const row = [];
    if (back) row.push(KB.btn("‹ بازگشت", back));
    if (home) row.push(KB.btn("🏠 منو", "menu"));
    if (row.length) rows.push(row);
    if (appUrl) rows.push([KB.webapp(appLabel || "🚀 Mini App", appUrl)]);
    return rows;
  },
  confirm({ yes = "yes", no = "no", yesLabel = "تأیید", noLabel = "لغو" } = {}) {
    return [[KB.btn("✅ " + yesLabel, yes), KB.btn("✕ " + noLabel, no)]];
  },
  toggle(label, on, data) { return [KB.btn(`${on ? "🟢" : "⚪"} ${label}`, data)]; },
  pager(prefix, page, pages) {
    if (!pages || pages <= 1) return [];
    const row = [];
    if (page > 0) row.push(KB.btn("‹ قبلی", `${prefix}:${page - 1}`));
    row.push(KB.btn(`${page + 1} / ${pages}`, "noop"));
    if (page + 1 < pages) row.push(KB.btn("بعدی ›", `${prefix}:${page + 1}`));
    return [row];
  },
  merge(...groups) { return [].concat(...groups.filter(Boolean)); }
};

export function styleKeyboard(markup) {
  const field = markup?.inline_keyboard ? "inline_keyboard" : markup?.keyboard ? "keyboard" : null;
  if (!field) return markup;
  return { ...markup, [field]: markup[field].map(row => row.map(button => {
    const b = typeof button === "string" ? { text: button } : button;
    if (b.style) return b;
    const action = b.callback_data || b.text || "";
    const style = b.web_app ? "primary" : /^(?:del|delete|wipe)|حذف|پاک کن/.test(action) ? "danger" : /exportall|backup|restore|mode:chat|گفتگو|چت/.test(action) ? "success" : /models|providers|council|mode:|منو|مدل|Mini App/.test(action) ? "primary" : null;
    return style ? { ...b, style } : b;
  })) };
}

/* ─────────────────────────────────────────────
   پیامهای بلند را به چند تکه امن تلگرام میشکند
   ───────────────────────────────────────────── */
export function tgChunks(text, max = 3900) {
  const t = String(text || "");
  if (t.length <= max) return [t];
  const out = [];
  let cur = t;
  while (cur.length > max) {
    let cut = cur.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = max;
    out.push(cur.slice(0, cut));
    cur = cur.slice(cut).replace(/^\n+/, "");
  }
  if (cur) out.push(cur);
  return out;
}

export default TG;
