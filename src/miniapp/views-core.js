export const VIEWS_CORE = String.raw`
/* ═══════════ HOME ═══════════ */
async function viewHome() {
  const d = await api("/dashboard");
  const s = d.snapshot || {}, t = (d.usage && d.usage.totals) || {}, ser = (d.usage && d.usage.series) || [];
  const hour = new Date().getHours();
  const greet = hour < 5 ? "شب بخیر" : hour < 12 ? "صبح بخیر" : hour < 18 ? "عصر بخیر" : "شب بخیر";
  const name = userLabel();
  const errRate = t.requests ? (t.errors / t.requests) * 100 : 0;
  const provHealth = s.providers ? (s.providersHealthy / s.providers) * 100 : 0;
  const modHealth = s.models ? (s.modelsHealthy / s.models) * 100 : 0;
  const head = '<div class="ph"><div class="ph-t"><div class="row gap12" style="margin-bottom:2px">' +
    avatarHtml(44) +
    '<div class="sp"><h2 style="font-size:19px">' + greet + (name ? "، " + h(name) : "") + "</h2>" +
    '<p style="margin-top:1px">نمای کلی پلتفرم · ' + rel(s.ts) + "</p></div></div></div>" +
    '<div class="ph-a"><button class="btn sm gho"' + act("healthSweep") + ">◍ Health Sweep</button>" +
    '<button class="btn sm gho"' + act("hardRefresh") + ">↻ تازهسازی</button></div></div>";

  if (!s.providers) {
    return head +
      '<div class="card"><div class="empty">' +
      '<i class="ei">▣</i><div class="et">به PIMXAGENT خوش آمدید</div>' +
      '<div class="es">برای شروع یک Provider اضافه کنید. کافیست Base URL و API Key بدهید؛ مدلها خودکار کشف و تست میشوند و بعد میتوانید چت، Council و Agent را اجرا کنید.</div>' +
      '<div class="row wrap" style="justify-content:center;margin-top:14px">' +
      '<button class="btn pri"' + act("providerPresets") + ">◈ انتخاب از Presets</button>" +
      '<button class="btn gho"' + act("providerNew") + ">＋ افزودن دستی</button>" +
      "</div></div></div>" +
      card({
        title: "بعد از افزودن Provider چه کاری میتوانید بکنید؟", icon: "ⓘ", cls: "mt12",
        body: kv("Chat", "گفتگو با هر مدل، با streaming") +
          kv("AI Council", "چند مدل همزمان روی یک سوال") +
          kv("Agents", "اجرای خودکار با ابزار و حافظه") +
          kv("Routing", "انتخاب هوشمند مدل بر اساس کیفیت/سرعت/هزینه") +
          kv("Monitoring", "سلامت، مصرف و هزینه")
      });
  }

  const stats = '<div class="g g4 mb16">' +
    stat({
      label: "Providers", icon: "▣", value: n(s.providersHealthy) + " / " + n(s.providers),
      sub: '<span class="dot ' + (provHealth > 70 ? "ok" : provHealth > 30 ? "warn" : "err") + '"></span> ' + pct(provHealth) + " سالم",
      meter: provHealth, meterKind: provHealth > 70 ? "ok" : provHealth > 30 ? "warn" : "bad"
    }) +
    stat({
      label: "Models", icon: "◆", value: n(s.modelsHealthy) + " / " + n(s.models),
      sub: (s.modelsFailed ? n(s.modelsFailed) + " failed" : "همه سالم"),
      meter: modHealth, meterKind: modHealth > 70 ? "ok" : modHealth > 30 ? "warn" : "bad"
    }) +
    stat({
      label: "Requests (7d)", icon: "↗", value: n(t.requests),
      sub: (errRate > 0 ? '<span style="color:var(--bad)">' + pct(errRate) + " error</span>" : "بدون خطا"),
      spark: ser.map(function (x) { return x.requests || 0; })
    }) +
    stat({
      label: "Cost (7d)", icon: "$", value: usd(t.cost), kind: "acc",
      sub: "avg " + ms(t.avgLatency) + " · " + n(t.tokens) + " tokens",
      spark: ser.map(function (x) { return x.cost || 0; })
    }) +
    "</div>";

  const quick = card({
    title: "شروع سریع", icon: "⚡",
    body: '<div class="row wrap">' +
      '<button class="btn pri"' + act("newChat") + ">＋ چت جدید</button>" +
      '<button class="btn"' + act("go", "council") + ">⚡ AI Council</button>" +
      '<button class="btn"' + act("providerNew") + ">＋ Provider</button>" +
      '<button class="btn gho"' + act("go", "models") + ">◆ Models</button>" +
      '<button class="btn gho"' + act("go", "agents") + ">◈ Agents</button>" +
      '<button class="btn gho"' + act("go", "playground") + ">▶ Playground</button>" +
      "</div>"
  });

  const provList = card({
    title: "Providers", sub: n(s.providers) + " مورد", icon: "▣",
    actions: '<button class="btn sm gho"' + act("go", "providers") + ">همه ›</button>",
    flat: true,
    body: lst((d.providers || []).slice(0, 6).map(function (p) {
      return li({
        onclick: act("go", "provider", p.id),
        title: h(p.name) + " " + statusBdg(p.status),
        sub: n(p.healthyModels) + "/" + n(p.models) + " models · " + ms(p.avgLatency) + (p.lastError ? " · " + h(short(p.lastError, 28)) : ""),
        end: '<span class="tny mono">' + (p.successRate === null || p.successRate === undefined ? "—" : pct(p.successRate)) + "</span>",
        chev: true
      });
    }), { icon: "▣", title: "هیچ Provider ثبت نشده", sub: "برای شروع یک Provider اضافه کنید", btn: { t: "＋ افزودن Provider", on: act("providerNew") } })
  });

  const failures = (d.failures || []).length ? card({
    title: "مدلهای Failed", sub: n(d.failures.length) + " مورد", icon: "✕",
    flat: true, cls: "mt12",
    body: lst(d.failures.slice(0, 6).map(function (m) {
      return li({
        onclick: act("go", "model", m.id),
        title: h(short(m.name, 30)),
        sub: h(m.provider || "") + (m.lastChecked ? " · " + rel(m.lastChecked) : ""),
        end: bdg("failed", "err", true), chev: true
      });
    }))
  }) : "";

  const runs = card({
    title: "Agent Runs", icon: "◈", flat: true,
    actions: '<button class="btn sm gho"' + act("go", "runs") + ">همه ›</button>",
    body: lst((d.recentRuns || []).slice(0, 5).map(function (r) {
      return li({
        onclick: act("go", "run", r.id),
        title: h(r.agentName || "agent"),
        sub: h(short(r.goal, 46)),
        end: statusBdg(r.status) + '<span class="tny">' + rel(r.startedAt) + "</span>", chev: true
      });
    }), { icon: "◈", title: "اجرایی ثبت نشده", sub: "یک Agent اجرا کنید" })
  });

  const alerts = card({
    title: "Alerts", icon: "◔", flat: true, cls: "mt12",
    actions: '<button class="btn sm gho"' + act("go", "alerts") + ">مدیریت ›</button>",
    body: lst((d.alerts || []).slice(0, 5).map(function (a) {
      return li({
        icon: "!", title: bdg(a.type, "warn"),
        sub: h(short(String(a.message || "").replace(/<[^>]+>/g, ""), 70)),
        end: '<span class="tny">' + rel(a.ts) + "</span>"
      });
    }), { icon: "◔", title: "هیچ هشداری نیست", sub: "سیستم پایدار است" })
  });

  const autos = (d.automations || []).length ? card({
    title: "Scheduled Tasks", icon: "◷", flat: true, cls: "mt12",
    actions: '<button class="btn sm gho"' + act("go", "automation") + ">همه ›</button>",
    body: lst(d.automations.slice(0, 5).map(function (a) {
      return li({
        onclick: act("go", "automation"),
        title: h(a.name), sub: '<span class="mono ltr">' + h(a.cron) + "</span>",
        end: '<span class="tny">' + (a.lastRun ? rel(a.lastRun) : "اجرا نشده") + "</span>"
      });
    }))
  }) : "";

  return head + stats + quick +
    '<div class="side-by mt12"><div>' + provList + failures + "</div><div>" + runs + alerts + autos + "</div></div>";
}

window.healthSweep = async function () {
  toast("Health sweep شروع شد…");
  try {
    const r = await api("/monitoring/sweep", { body: { batch: 8 }, long: true });
    toast("تست شد: " + n(r.tested) + " · سالم: " + n(r.healthy), "ok");
    bust(); render();
  } catch (e) { toast(e.message, "err"); }
};

/* ═══════════ CHAT ═══════════ */
async function viewChat() {
  const initial = await Promise.all([usableModels(), convList(), cached('preferences', function () { return api('/preferences'); }).catch(function () { return { responseMode: 'speed' }; })]);
  const models = initial[0];
  S.preferences = initial[2];
  if (!models.length) return setupGate("چت");

  const convs = initial[1];

  const sid = S.params.id || S.chat.id;
  const dead = S.deadConvs || {};
  if (sid && dead[sid]) {
    S.chat.id = null; S.chat.loadedId = null; S.chat.messages = [];
    if (S.params.id) { go("chat"); return loading(); }
  } else if (sid && sid !== S.chat.loadedId) {
    try {
      const c = await api("/conversations/" + sid);
      S.chat.id = c.id; S.chat.loadedId = c.id; S.chat.messages = c.messages || [];
    } catch (e) {
      S.chat.id = null; S.chat.loadedId = null; S.chat.messages = [];
      if (e.status === 404) dropConvLocal(sid);
    }
  }

  if (S.chat.modelId && !models.some(function (m) { return m.id === S.chat.modelId; })) S.chat.modelId = "";

  const sideList = (convs || []).length ? convs.map(function (c) {
    return '<div class="citem ' + (S.chat.id === c.id ? "on" : "") + '" data-id="' + h(c.id) + '"' + act("openConv", c.id) + ">" +
      '<div class="row gap4">' +
      '<div class="sp" style="min-width:0">' +
      '<div class="t trunc">' + (c.pinned ? "📌 " : "") + h(c.title || "گفتگو") + "</div>" +
      '<div class="s trunc">' + (c.count ? n(c.count) + " پیام · " : "") + h(short(c.preview, 26) || "خالی") + "</div>" +
      "</div>" +
      '<button class="ibtn cmore"' + act("convMenu", c.id, c.title || "گفتگو") + ' title="options">⋯</button>' +
      "</div></div>";
  }).join("") : '<div class="empty" style="padding:22px 10px"><div class="es">گفتگویی نیست</div></div>';

  return '<section class="cmain">' +
    '<div class="cbar">' +
    '<button class="ibtn ctoggle' + (S.chat.sideOpen ? " on" : "") + '"' + act("toggleChatSide") + ' aria-label="گفتگوهای قبلی">' + pxIcon('menu') + '</button>' +
    chatModelTriggerHtml(models) +
    '<button class="ibtn"' + act("newChat") + ' aria-label="گفتگوی جدید">＋</button>' +
    (S.chat.id ? '<button class="ibtn"' + act("renameConv") + ' title="rename">✎</button>' +
      '<button class="ibtn"' + act("delConv") + ' title="delete">🗑</button>' : "") +
    '<div class="response-switch chat-response-switch" aria-label="حالت پاسخ">' + responseModesHtml() + '</div></div>' +
    '<div class="cwrap">' +
    '<aside class="cside' + (S.chat.sideOpen ? " mob" : "") + '" id="cside">' +
    '<div class="cside-h"><div class="row gap4">' +
    '<button class="btn pri sm sp"' + act("newChat") + ">＋ گفتگوی جدید</button>" +
    ((convs || []).length ? '<button class="ibtn" ' + act("wipeChats").trim() + ' title="delete all">🗑</button>' : "") +
    "</div></div>" +
    '<div class="cside-l">' + sideList + "</div></aside>" +
    '<div class="cscrim' + (S.chat.sideOpen ? " on" : "") + '"' + act("closeChatSide") + "></div>" +
    '<div class="cbody">' +
    '<div class="msgs" id="msgs">' + renderMsgs() + "</div>" +
    '<div class="comp"><div class="comp-in">' +
    '<textarea id="cinput" aria-label="پیام به دستیار" rows="1" placeholder="پیام خود را بنویسید…"></textarea>' +
    '<button class="btn pri ico" id="csend" aria-label="ارسال پیام"' + act("sendChat") + '>' + pxIcon('arrow') + '</button></div>' +
    '<div class="comp-hint">Enter ارسال · Shift+Enter خط جدید</div></div>' +
    "</div></div></section>";
}

async function usableModels() {
  try {
    const d = await cached("models", async function () {
      const first = await api("/models?size=300&sort=name");
      if (!first.models || first.total <= first.models.length) return first;
      const pages = Math.ceil(first.total / 300);
      const rest = await Promise.all(Array.from({ length: pages - 1 }, function (_, i) { return api('/models?size=300&sort=name&page=' + (i + 2)); }));
      return { models: first.models.concat.apply(first.models, rest.map(function (page) { return page.models || []; })) };
    });
    const list = d.models || d || [];
    // Never hide a model the user explicitly imported: a failed probe can be a
    // cold endpoint or a rate limit. Healthy first, failed last, but all listed.
    const usable = list.filter(function (m) { return m.enabled !== false; });
    const rank = { healthy: 0, unknown: 1, degraded: 2, failed: 3 };
    usable.sort(function (a, b) {
      const ra = rank[a.status] === undefined ? 1 : rank[a.status];
      const rb = rank[b.status] === undefined ? 1 : rank[b.status];
      if (ra !== rb) return ra - rb;
      return String(a.name || a.apiModelId).localeCompare(String(b.name || b.apiModelId));
    });
    return usable;
  } catch (e) { return []; }
}
window.usableModels = usableModels;
async function healthyModels() {
  const list = await usableModels();
  const ok = list.filter(function (m) { return m.status === "healthy"; });
  return ok.length ? ok : list;
}
window.healthyModels = healthyModels;

async function hasProviders() {
  try {
    const list = await cached("provList", function () { return api("/providers"); });
    return (list || []).length > 0;
  } catch (e) { return false; }
}
window.hasProviders = hasProviders;

function setupGate(what) {
  return '<div class="card"><div class="empty">' +
    '<i class="ei">▣</i>' +
    '<div class="et">برای استفاده از ' + h(what) + ' اول یک Provider اضافه کنید</div>' +
    '<div class="es">هیچ مدل فعالی موجود نیست. یک Provider (مثل OpenAI، OpenRouter، Gemini) با API Key خودتان اضافه کنید؛ مدلها بهصورت خودکار کشف میشوند.</div>' +
    '<div class="row wrap" style="justify-content:center;margin-top:14px">' +
    '<button class="btn pri"' + act("providerNew") + ">＋ افزودن Provider</button>" +
    '<button class="btn gho"' + act("providerPresets") + ">◈ Presets آماده</button>" +
    "</div></div></div>";
}
window.setupGate = setupGate;

function modelOptsHtml(models) {
  const groups = {};
  models.forEach(function (m) {
    const p = m.provider || "other";
    if (!groups[p]) groups[p] = [];
    groups[p].push(m);
  });
  let out = '<option value="">Auto (انتخاب هوشمند)</option>';
  Object.keys(groups).sort().forEach(function (p) {
    out += '<optgroup label="' + h(p) + '">';
    groups[p].slice(0, 80).forEach(function (m) {
      const mark = m.status === "healthy" ? "" : m.status === "failed" ? " ✕" : m.status === "degraded" ? " ⚠" : " ○";
      out += '<option value="' + h(m.id) + '"' + (S.chat.modelId === m.id ? " selected" : "") + ">" +
        h(short(m.name || m.apiModelId, 40)) + mark + "</option>";
    });
    out += "</optgroup>";
  });
  return out;
}
window.modelOptsHtml = modelOptsHtml;

/* Avatar shown next to each message: the user's Telegram photo (or initials), ◆ for the model. */
function msgAvatar(isUser) {
  if (!isUser) return '<i class="msg-av">◆</i>';
  const src = S.avatarOk ? "/api/me/avatar" : ((S.user && S.user.photoUrl) || "");
  if (src) {
    return '<img class="msg-av" src="' + h(src) + '" alt="" width="26" height="26" ' +
      'title="' + h(userLabel()) + '" onerror="this.outerHTML=window.msgAvatarFallback()">';
  }
  return msgAvatarFallback();
}
function msgAvatarFallback() { return '<i class="msg-av">' + h(userInitials()) + "</i>"; }
window.msgAvatar = msgAvatar; window.msgAvatarFallback = msgAvatarFallback;

function renderMsgs() {
  const msgs = S.chat.messages || [];
  if (!msgs.length) {
    return '<div class="chat-welcome"><span class="chat-welcome-symbol">' + pxIcon('spark', 34) + '</span><h2>از کجا شروع کنیم؟</h2><p>یک پیام بنویس. مدل مناسب را خودکار انتخاب می‌کنم، یا خودت انتخاب کن.</p><div class="prompt-chips"><button onclick="fillChatPrompt(\'کمکم کن یک ایده تازه بسازم\')">یک ایده تازه</button><button onclick="fillChatPrompt(\'این موضوع را ساده توضیح بده: \')">ساده توضیح بده</button><button onclick="fillChatPrompt(\'در نوشتن و بهتر کردن این متن کمکم کن: \')">کمک در نوشتن</button></div></div>';
  }
  return msgs.map(function (m, i) {
    const isU = m.role === "user";
    const streaming = m.streaming;
    return '<div class="msg ' + (isU ? "u" : "a") + '">' +
      msgAvatar(isU) +
      '<div class="bub"><div class="' + (streaming ? "cur" : "") + '">' + (m.content ? md(m.content) : (streaming ? "" : "…")) + "</div>" +
      (!isU && (m.model || m.latency) ? '<div class="mmeta">' +
        (m.model ? '<span class="mono">' + h(tail(m.model)) + "</span>" : "") +
        (m.latency ? "<span>" + ms(m.latency) + "</span>" : "") +
        (m.cost ? "<span>" + usd(m.cost) + "</span>" : "") +
        (m.tokens ? "<span>" + n(m.tokens.total || m.tokens) + " tok</span>" : "") +
        (m.cached ? "<span>⚡ cached</span>" : "") +
        '<button class="btn sm gho" style="height:20px;padding:0 7px;font-size:9.5px"' + act("copyMsg", String(i)) + ">کپی</button>" +
        "</div>" : "") +
      (m.note ? '<div class="stream-note">' + h(m.note) + '</div>' : '') + "</div></div>";
  }).join("");
}
window.copyMsg = function (i) {
  const m = S.chat.messages[Number(i)];
  if (m && navigator.clipboard) navigator.clipboard.writeText(m.content || "").then(function () { toast("کپی شد", "ok"); });
};
function paintMsgs() {
  const box = document.getElementById("msgs");
  if (box) { box.innerHTML = renderMsgs(); box.scrollTop = box.scrollHeight; }
}
window.paintMsgs = paintMsgs;
window.fillChatPrompt = function (text) { const input = document.getElementById('cinput'); if (input) { input.value = text; input.focus(); } };

window.AFTER = window.AFTER || {};
window.AFTER.chat = function () {
  const send = document.getElementById('csend');
  if (send && S.chat.sending) { send.classList.add('stopping'); send.setAttribute('aria-label', 'توقف پاسخ'); send.innerHTML = '■'; }
  const ta = document.getElementById("cinput");
  if (ta) {
    ta.onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
    };
    ta.oninput = function () {
      ta.style.height = "auto";
      ta.style.height = Math.min(Math.round(window.innerHeight * 0.32), ta.scrollHeight) + "px";
    };
    if (window.innerWidth > 820) ta.focus();
  }
  const box = document.getElementById("msgs");
  if (box) box.scrollTop = box.scrollHeight;
};
window.toggleChatSide = function () {
  setChatSide(!S.chat.sideOpen);
};
window.closeChatSide = function () { setChatSide(false); };
function setChatSide(open) {
  S.chat.sideOpen = !!open;
  const el = document.getElementById("cside");
  if (el) el.className = "cside" + (open ? " mob" : "");
  const sc = document.querySelector(".cscrim");
  if (sc) sc.className = "cscrim" + (open ? " on" : "");
  const tg = document.querySelector(".ctoggle");
  if (tg) tg.className = "ibtn ctoggle" + (open ? " on" : "");
}
window.setChatSide = setChatSide;

window.newChat = async function () {
  if (S.chat.sending) { toast('پاسخ را متوقف کن یا منتظر پایان آن بمان.', 'warn'); return; }
  if (S.chat.creating) return;
  S.chat.creating = true;
  try {
    // Server reuses the newest empty conversation, so repeat taps never pile up blanks.
    const c = await api("/conversations", { body: { title: "گفتگوی جدید" } });
    if (S.deadConvs && S.deadConvs[c.id]) delete S.deadConvs[c.id];
    bust("convs");
    S.chat.id = c.id; S.chat.loadedId = c.id; S.chat.messages = c.messages || [];
    S.chat.sideOpen = false;
    go("chat", { id: c.id });
  } catch (e) {
    S.chat.id = null; S.chat.loadedId = null; S.chat.messages = [];
    go("chat"); toast(e.message, "err");
  } finally {
    setTimeout(function () { S.chat.creating = false; }, 700);
  }
};
window.openConv = function (id) { if (S.chat.sending) { toast('پاسخ را متوقف کن یا منتظر پایان آن بمان.', 'warn'); return; } S.chat.sideOpen = false; go("chat", { id: id }); };
window.convMenu = function (id, title) {
  sheet({
    title: short(title, 34), sub: "مدیریت گفتگو", cls: "narrow",
    body: lst([
      li({ icon: "▸", onclick: act("openConv2", id), title: "باز کردن", chev: true }),
      li({ icon: "✎", onclick: act("convRename", id, title), title: "تغییر نام", chev: true }),
      li({ icon: "📌", onclick: act("convPin", id), title: "پین / برداشتن پین", chev: true }),
      li({ icon: "🧹", onclick: act("convClear", id), title: "پاک کردن پیامها", chev: true }),
      li({ icon: "🗑", onclick: act("convDelete", id), title: "حذف گفتگو", chev: true })
    ]),
    foot: '<button class="btn gho" onclick="closeSheet()">بستن</button>'
  });
};
window.openConv2 = function (id) { closeSheet(); openConv(id); };
window.convRename = function (id, title) {
  closeSheet();
  setTimeout(function () {
    editSheet({
      title: "تغییر نام گفتگو", cls: "narrow",
      fields: [{ k: "title", l: "عنوان", req: true, v: title === "گفتگو" ? "" : title }],
      onSave: async function (v) {
        await doAct(function () { return api("/conversations/" + id, { method: "PATCH", body: { title: v.title } }); }, "ذخیره شد", { bust: "convs" });
      }
    });
  }, 60);
};
window.convPin = async function (id) {
  closeSheet();
  try {
    const c = await api("/conversations/" + id);
    await api("/conversations/" + id, { method: "PATCH", body: { pinned: !c.pinned } });
    bust("convs"); toast(!c.pinned ? "پین شد" : "پین برداشته شد", "ok"); render();
  } catch (e) { toast(e.message, "err"); }
};
window.convClear = function (id) {
  closeSheet();
  setTimeout(function () {
    confirmSheet("پاک کردن پیامها؟", "همه پیامهای این گفتگو حذف میشود ولی گفتگو باقی میماند.", async function () {
      await api("/conversations/" + id, { method: "PATCH", body: { clear: true } });
      if (S.chat.id === id) { S.chat.messages = []; S.chat.loadedId = null; }
      bust("convs"); closeSheet(); render(); toast("پاک شد", "ok");
    });
  }, 60);
};
window.convDelete = function (id) {
  closeSheet();
  setTimeout(function () {
    confirmSheet("حذف گفتگو؟", "این گفتگو و همه پیامهایش حذف میشود.", async function () {
      try {
        await api("/conversations/" + id, { method: "DELETE" });
      } catch (e) {
        if (e.status !== 404) { toast(e.message, "err"); return; }
      }
      // Drop it locally too so the row disappears instantly even if the
      // next list read is served from a stale KV replica.
      dropConvLocal(id);
      if (S.chat.id === id) { S.chat.id = null; S.chat.loadedId = null; S.chat.messages = []; }
      closeSheet();
      toast("حذف شد", "ok");
      if (S.chat.id) render(); else go("chat");
    });
  }, 60);
};
/* Remove a conversation from the client cache and remember it as deleted. */
function dropConvLocal(id) {
  S.deadConvs = S.deadConvs || {};
  S.deadConvs[id] = 1;
  if (Array.isArray(S.cache.convs)) {
    S.cache.convs = S.cache.convs.filter(function (c) { return c.id !== id; });
  }
  const el = document.querySelector('.citem[data-id="' + String(id).replace(/"/g, "") + '"]');
  if (el) el.remove();
}
window.dropConvLocal = dropConvLocal;
/* Conversation list, minus anything deleted in this session. */
async function convList() {
  const rows = await cached("convs", function () { return api("/conversations"); });
  const dead = S.deadConvs || {};
  const live = (rows || []).filter(function (c) { return !dead[c.id]; });
  if (live.length !== (rows || []).length) S.cache.convs = live;
  return live;
}
window.convList = convList;
window.wipeChats = function () {
  confirmSheet("حذف همه گفتگوها؟", "همه تاریخچه چت پاک میشود. این عملیات بازگشتپذیر نیست.", async function () {
    try {
      const r = await api("/conversations/wipe", { body: {} });
      (S.cache.convs || []).forEach(function (c) { dropConvLocal(c.id); });
      S.cache.convs = [];
      S.chat.id = null; S.chat.loadedId = null; S.chat.messages = [];
      closeSheet();
      toast(n(r.deleted) + " گفتگو حذف شد", "ok");
      go("chat");
    } catch (e) { toast(e.message, "err"); }
  });
};
window.renameConv = function () {
  if (!S.chat.id) return;
  const cur = (S.cache.convs || []).filter(function (c) { return c.id === S.chat.id; })[0];
  convRename(S.chat.id, (cur && cur.title) || "");
};
window.clearConv = function () { if (S.chat.id) convClear(S.chat.id); };
window.delConv = function () { if (S.chat.id) convDelete(S.chat.id); };
window.pruneChats = async function () {
  try {
    const r = await api("/conversations/prune", { body: {} });
    bust("convs");
    toast(r.pruned ? n(r.pruned) + " گفتگوی خالی حذف شد" : "گفتگوی خالی نبود", "ok");
    render();
  } catch (e) { toast(e.message, "err"); }
};
window.sendChat = async function () {
  if (S.chat.sending) { if (S.chat.controller) S.chat.controller.abort(); return; }
  const ta = document.getElementById("cinput");
  const text = ((ta && ta.value) || "").trim();
  if (!text) return;
  ta.value = ""; ta.style.height = "auto";
  S.chat.sending = true;
  const controller = new AbortController();
  S.chat.controller = controller;
  const timeout = setTimeout(function () { controller.abort('timeout'); }, 240000);
  S.chat.messages.push({ role: "user", content: text });
  S.chat.messages.push({ role: "assistant", content: "", streaming: true });
  const ai = S.chat.messages.length - 1;
  paintMsgs();
  const btn = document.getElementById("csend");
  if (btn) { btn.disabled = false; btn.classList.add('stopping'); btn.setAttribute('aria-label', 'توقف پاسخ'); btn.innerHTML = '■'; }

  const history = S.chat.messages
    .filter(function (m) { return m.content && m.role; })
    .map(function (m) { return { role: m.role, content: m.content }; });

  let txt = '', meta = null, finished = false;
  const conversationId = S.chat.id;
  try {
    const headers = { "Content-Type": "application/json" };
    if (S.token) headers.Authorization = "Bearer " + S.token;
    else if (tgInitData()) headers["X-Telegram-Init-Data"] = tgInitData();

    const res = await fetch("/api/chat/stream", {
      method: "POST", headers: headers, signal: controller.signal,
      body: JSON.stringify({
        messages: history.slice(-20),
        modelId: S.chat.modelId || undefined,
        conversationId: conversationId || undefined,
        responseMode: (S.preferences || {}).responseMode || 'speed'
      })
    });
    if (!res.ok || !res.body) {
      const j = await res.json().catch(function () { return {}; });
      throw new Error(j.error || ("HTTP " + res.status));
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", ev = "message";
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) { ev = "message"; continue; }
        if (line.charAt(0) === ":") continue;
        if (line.indexOf("event:") === 0) { ev = line.slice(6).trim(); continue; }
        if (line.indexOf("data:") !== 0) continue;
        let p = null;
        try { p = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
        if (ev === "chunk") {
          txt += p.chunk || "";
          S.chat.messages[ai].content = txt;
          paintMsgs();
        } else if (ev === 'reset') { txt = ''; S.chat.messages[ai].content = ''; paintMsgs(); }
        else if (ev === "metadata") {
          meta = p;
          if (!S.chat.id && p.conversationId) { S.chat.id = p.conversationId; S.chat.loadedId = p.conversationId; }
        }
        else if (ev === 'done') finished = true;
        else if (ev === "error") throw new Error(p.error || "خطای stream");
      }
    }
    if (!finished) throw new Error('ارتباط پیش از پایان پاسخ قطع شد.');
    S.chat.messages[ai] = {
      role: "assistant", content: txt || "⚠ پاسخی دریافت نشد",
      model: meta && meta.model, latency: meta && meta.latency,
      cost: meta && meta.cost, tokens: meta && meta.tokens
    };
    bust("convs");
  } catch (e) {
    const stopped = controller.signal.aborted && controller.signal.reason !== 'timeout';
    S.chat.messages[ai] = { role: 'assistant', content: txt || (stopped ? 'پاسخ متوقف شد.' : '⚠ ' + (controller.signal.reason === 'timeout' ? 'زمان دریافت پاسخ تمام شد.' : e.message || e)), note: txt ? (stopped ? 'تولید پاسخ متوقف شد.' : 'ارتباط قطع شد؛ پاسخ تا اینجا نگه داشته شده است.') : '' };
  } finally {
    clearTimeout(timeout);
    S.chat.controller = null;
    S.chat.sending = false;
    const b = document.getElementById("csend");
    if (b) { b.disabled = false; b.classList.remove('stopping'); b.setAttribute('aria-label', 'ارسال پیام'); b.innerHTML = pxIcon('arrow'); }
    paintMsgs();
  }
};

/* ═══════════ COUNCIL ═══════════ */
async function viewCouncil() {
  const tab = curTab("council", "run");
  const head = '<div class="ph"><div class="ph-t"><h2>⚡ AI Council</h2>' +
    "<p>چند مدل بهصورت همزمان روی یک سوال کار میکنند و نتیجه ترکیب میشود</p></div></div>" +
    tabsBar("council", [["run", "اجرا"], ["history", "History"], ["templates", "Templates"], ["configs", "Configs"]]);

  if (tab === "history") return head + (await councilHistory());
  if (tab === "templates") return head + (await councilTemplates());
  if (tab === "configs") return head + (await councilConfigs());

  const models = await usableModels();
  if (models.length < 2) {
    return head + (models.length === 0 ? setupGate("AI Council") :
      '<div class="card"><div class="empty"><i class="ei">⚡</i>' +
      '<div class="et">حداقل ۲ مدل سالم لازم است</div>' +
      '<div class="es">الان ' + n(models.length) + ' مدل قابل استفاده دارید. Provider دیگری اضافه کنید یا مدلهای بیشتری کشف/تست کنید.</div>' +
      '<div class="row wrap" style="justify-content:center;margin-top:14px">' +
      '<button class="btn pri"' + act("providerNew") + ">＋ Provider</button>" +
      '<button class="btn gho"' + act("go", "models") + ">◆ Models</button></div></div></div>");
  }

  const MODES = [
    ["independent", "Independent", "هر مدل مستقل پاسخ میدهد"],
    ["debate", "Debate", "مدلها یکدیگر را نقد میکنند"],
    ["panel", "Panel", "هر مدل نقش تخصصی دارد"],
    ["judge", "Judge", "یک مدل داور بهترین را انتخاب میکند"],
    ["iterative", "Iterative", "پاسخ در چند دور اصلاح میشود"]
  ];
  const maxCount = Math.min(30, models.length);
  const picked = (S.council.modelIds || []).filter(function (id) {
    return models.some(function (m) { return m.id === id; });
  });
  S.council.modelIds = picked;
  if (S.council.count > maxCount) S.council.count = maxCount;

  const modelPicker =
    '<div class="fld"><label>انتخاب مدل' +
    (picked.length ? ' <span class="bdg acc">' + n(picked.length) + " انتخابشده</span>" : ' <span class="tny">(خالی = خودکار)</span>') +
    "</label>" +
    '<div class="row wrap gap4 mb8">' +
    '<button class="btn sm gho"' + act("cnlPickAll") + ">انتخاب همه</button>" +
    '<button class="btn sm gho"' + act("cnlPickHealthy") + ">فقط سالمها</button>" +
    (picked.length ? '<button class="btn sm gho"' + act("cnlPickNone") + ">پاک کردن</button>" : "") +
    "</div>" +
    '<div class="picker" id="cnlPicker">' +
    models.map(function (m) {
      const on = picked.indexOf(m.id) >= 0;
      return '<button type="button" class="pick' + (on ? " on" : "") + '" data-id="' + h(m.id) + '"' + act("cnlToggle", m.id) + ">" +
        '<span class="dot ' + (m.status === "healthy" ? "ok" : m.status === "failed" ? "err" : "warn") + '"></span>' +
        '<span class="sp trunc">' + h(m.name || m.apiModelId) + '<small class="studio-council-id" dir="ltr">' + h(m.apiModelId) + '</small></span>' +
        '<span class="tny">' + h(m.provider) + "</span>" +
        "</button>";
    }).join("") +
    "</div>" +
    '<div class="hint">اگر چیزی انتخاب نکنید، سیستم خودکار ' + n(S.council.count || 3) + " مدل بهتر را انتخاب میکند.</div></div>";

  const form = card({
    title: "پیکربندی اجرا", icon: "⚡",
    body:
      '<div class="fld"><label>سوال یا هدف<span class="req">*</span></label>' +
      '<textarea id="cq" rows="4" placeholder="چه مسئلهای را میخواهید چند مدل با هم حل کنند؟">' + h(S.council.question) + "</textarea></div>" +
      '<div class="fld"><label>Mode</label><div class="seg">' +
      MODES.map(function (m) {
        return "<button" + (S.council.mode === m[0] ? ' class="on"' : "") + act("setCMode", m[0]) + ">" + h(m[1]) + "</button>";
      }).join("") + "</div>" +
      '<div class="hint">' + h((MODES.filter(function (m) { return m[0] === S.council.mode; })[0] || MODES[0])[2]) + "</div></div>" +
      modelPicker +
      '<div class="inline-f">' +
      '<div class="fld"><label>تعداد مدل</label><input type="number" id="cc" min="2" max="' + maxCount + '" value="' + (picked.length || S.council.count || 3) + '"' + (picked.length ? " disabled" : "") + '><div class="hint">' + (picked.length ? "بر اساس انتخاب دستی" : "حداکثر " + n(maxCount) + " مدل موجود") + "</div></div>" +
      '<div class="fld"><label>Rounds</label><input type="number" id="cr" min="1" max="5" value="' + (S.council.rounds || 2) + '"></div>' +
      "</div>" +
      note("اگر مدلی fail شود اجرا متوقف نمیشود و بقیه ادامه میدهند."),
    foot: '<button class="btn gho sm"' + act("councilEstimate") + ">برآورد هزینه</button>" +
      '<div class="sp"></div>' +
      '<button class="btn pri" id="cgo"' + act("runCouncilUI") + (S.council.running ? " disabled" : "") + ">" +
      (S.council.running ? '<span class="sp8"></span> در حال اجرا…' : "▶ START COUNCIL") + "</button>"
  });

  return head + form + (S.council.last ? councilResult(S.council.last) : "");
}
function paintPicker() {
  const picked = S.council.modelIds || [];
  document.querySelectorAll("#cnlPicker .pick").forEach(function (b) {
    const on = picked.indexOf(b.getAttribute("data-id")) >= 0;
    b.className = "pick" + (on ? " on" : "");
    b.setAttribute('aria-pressed', String(on));
  });
  const cc = document.getElementById("cc");
  if (cc) { cc.disabled = picked.length > 0; if (picked.length) cc.value = picked.length; }
  const lab = document.querySelector("#cnlPicker");
  if (lab && lab.previousElementSibling) {
    const b = lab.parentElement.querySelector("label .bdg, label .tny");
    if (b) b.outerHTML = picked.length
      ? '<span class="bdg acc">' + n(picked.length) + " انتخابشده</span>"
      : '<span class="tny">(خالی = خودکار)</span>';
  }
}
window.cnlToggle = function (id) {
  readCouncilForm();
  const sel = S.council.modelIds || [];
  const i = sel.indexOf(id);
  if (i >= 0) sel.splice(i, 1);
  else { if (sel.length >= 30) return toast("حداکثر ۳۰ مدل", "warn"); sel.push(id); }
  S.council.modelIds = sel;
  paintPicker();
};
window.cnlPickAll = async function () {
  readCouncilForm();
  const list = await usableModels();
  S.council.modelIds = list.slice(0, 30).map(function (m) { return m.id; });
  render();
};
window.cnlPickHealthy = async function () {
  readCouncilForm();
  const list = await usableModels();
  const ok = list.filter(function (m) { return m.status === "healthy"; });
  if (!ok.length) return toast("مدل سالمی موجود نیست — همه را انتخاب کنید یا اول تست بگیرید", "warn");
  S.council.modelIds = ok.slice(0, 30).map(function (m) { return m.id; });
  render();
};
window.cnlPickNone = function () { readCouncilForm(); S.council.modelIds = []; render(); };

function councilResult(r) {
  const syn = r.synthesis || {};
  const qy = syn.quality || {};
  const answers = r.answers || [];
  return '<div class="mt16">' +
    card({
      title: "نتیجه", icon: "◎", sub: r.mode + " · " + n(answers.length) + " model · " + ms(new Date(r.finishedAt) - new Date(r.startedAt)),
      actions: '<button class="btn sm gho"' + act("copyText", "cnlFinal") + ">کپی پاسخ</button>",
      body:
        '<div class="rings">' +
        ring(syn.agreement, "Agreement", syn.agreement > 70 ? "ok" : syn.agreement > 40 ? "warn" : "bad") +
        ring(syn.confidence, "Confidence", syn.confidence > 70 ? "ok" : "warn") +
        (qy.overallQuality !== undefined ? ring(qy.overallQuality, "Quality", "") : "") +
        "</div>" +
        '<div class="row wrap gap4 mb12">' +
        bdg("consensus: " + (syn.consensus || "—"), syn.consensus === "high" ? "ok" : syn.consensus === "low" ? "warn" : "") +
        (syn.winner ? bdg("winner: " + short(syn.winner, 24), "acc") : "") +
        bdg("ok " + n((r.totals || {}).ok) + " / fail " + n((r.totals || {}).fail), (r.totals || {}).fail ? "warn" : "ok") +
        bdg(usd((r.totals || {}).cost), "mono") +
        "</div>" +
        '<div class="bub" id="cnlFinal" style="border:1px solid var(--line);background:var(--bg2)">' + md(syn.final || "") + "</div>" +
        ((syn.strong || []).length ? '<h4 class="mt16 mb8">نقاط توافق</h4>' + (syn.strong || []).map(function (x) { return '<div class="tiny">✓ ' + h(x) + "</div>"; }).join("") : "") +
        ((syn.disagreements || []).length ? '<h4 class="mt16 mb8">اختلاف نظر</h4>' + (syn.disagreements || []).map(function (x) { return '<div class="tiny">⚠ ' + h(x) + "</div>"; }).join("") : "")
    }) +
    card({
      title: "پاسخ هر مدل", icon: "◆", cls: "mt12", flat: true,
      body: answers.map(function (a, i) {
        return '<div class="ans"><div class="ans-h"' + act("toggleAns", "ans" + i) + ">" +
          '<span class="dot ' + (a.ok ? "ok" : "err") + '"></span>' +
          '<span class="sp trunc" style="font-weight:600;font-size:12.5px">' + h(a.displayName || a.model) + "</span>" +
          (a.role ? bdg(a.role, "acc") : "") +
          '<span class="tny mono">' + (a.ok ? ms(a.latency) + " · " + usd(a.cost) : h(short(a.error, 26))) + "</span>" +
          '<span class="chev">▾</span></div>' +
          '<div class="ans-b hide" id="ans' + i + '">' + (a.ok ? md(a.text) : '<span style="color:var(--bad)">' + h(a.error) + "</span>") + "</div></div>";
      }).join("")
    }) +
    (r.diversity ? card({
      title: "Diversity", icon: "◈", cls: "mt12",
      body: kv("Diversity Score", pct(r.diversity.diversityScore)) +
        kv("Unique Providers", n(r.diversity.uniqueProviders)) +
        kv("Balanced", r.diversity.balanced ? bdg("yes", "ok") : bdg("no", "warn")) +
        Object.keys(r.diversity.providerDistribution || {}).map(function (k) {
          return bar(k, r.diversity.providerDistribution[k], r.diversity.totalModels);
        }).join("")
    }) : "") + "</div>";
}
window.toggleAns = function (id) {
  const el = document.getElementById(id);
  if (el) el.className = el.className.indexOf("hide") >= 0 ? "ans-b" : "ans-b hide";
};
window.copyText = function (id) {
  const el = document.getElementById(id);
  if (el && navigator.clipboard) navigator.clipboard.writeText(el.textContent || "").then(function () { toast("کپی شد", "ok"); });
};
window.setCMode = function (m) { readCouncilForm(); S.council.mode = m; render(); };
function readCouncilForm() {
  const q1 = document.getElementById("cq"), c1 = document.getElementById("cc"), r1 = document.getElementById("cr");
  if (q1) S.council.question = q1.value;
  if (c1) S.council.count = Number(c1.value) || 3;
  if (r1) S.council.rounds = Number(r1.value) || 2;
}
window.councilEstimate = async function () {
  readCouncilForm();
  try {
    const e = await api("/council/estimate", { body: councilBody() });
    sheet({
      title: "برآورد اجرا", cls: "narrow",
      body: kv("مدلهای موجود", n(e.available)) + kv("Model Calls", n(e.modelCalls)) +
        kv("Rounds", n(S.council.rounds)) +
        kv("انتخاب", (S.council.modelIds || []).length ? "دستی (" + n(S.council.modelIds.length) + ")" : "خودکار") +
        (e.diversity ? kv("Diversity", pct(e.diversity.diversityScore)) : "") +
        '<h4 class="mt16 mb8">مدلهای انتخابی</h4>' +
        (e.models || []).map(function (m) { return li({ title: h(m.name), sub: h(m.provider), end: statusBdg(m.status) }); }).join("") +
        (e.note ? note(h(e.note)) : "")
    });
  } catch (er) { toast(er.message, "err"); }
};
function councilBody() {
  const b = {
    question: S.council.question,
    mode: S.council.mode,
    rounds: S.council.rounds
  };
  const picked = S.council.modelIds || [];
  if (picked.length) { b.modelIds = picked; b.count = picked.length; }
  else b.count = S.council.count;
  return b;
}
window.councilBody = councilBody;
window.runCouncilUI = async function () {
  readCouncilForm();
  if (!S.council.question.trim()) return toast("سوال را بنویسید", "err");
  const picked = S.council.modelIds || [];
  if (picked.length === 1) return toast("حداقل ۲ مدل انتخاب کنید (یا انتخاب را پاک کنید)", "err");
  S.council.running = true; render();
  try {
    const run = await api("/council/run", { long: true, timeout: 300000, body: councilBody() });
    S.council.last = run;
    toast("Council کامل شد", "ok");
  } catch (e) {
    if (e.data && e.data.needsApproval) {
      toast("نیاز به تأیید هزینه: " + usd(e.data.estimatedCost), "warn");
      S.council.running = false; render();
      return councilApprovalSheet(e.data);
    }
    toast(e.message, "err");
  } finally { S.council.running = false; render(); }
};
function councilApprovalSheet(d) {
  sheet({
    title: "تأیید هزینه لازم است", cls: "narrow",
    body: note("هزینه برآوردی " + usd(d.estimatedCost) + " از بودجه بیشتر است.", "warn") +
      kv("Approval ID", '<span class="mono">' + h(d.approvalRequestId || "—") + "</span>") +
      (d.autoPlan ? kv("Complexity", n(d.autoPlan.complexity)) : ""),
    okText: "رفتن به Approvals",
    onOk: async function () { closeSheet(); go("approvals"); }
  });
}
async function councilHistory() {
  const runs = await api("/council/runs?limit=30");
  return card({
    title: "اجراهای قبلی", sub: n((runs || []).length) + " مورد", flat: true,
    body: lst((runs || []).map(function (r) {
      return li({
        onclick: act("viewCouncilRun", r.id),
        title: h(short(r.question, 52)),
        sub: bdg(r.mode, "acc") + " " + n((r.models || []).length) + " model · " + rel(r.startedAt),
        end: statusBdg(r.status) + '<span class="tny mono">' + usd((r.totals || {}).cost) + "</span>", chev: true
      });
    }), { icon: "⚡", title: "اجرایی ثبت نشده" })
  });
}
window.viewCouncilRun = async function (id) {
  try {
    const r = await api("/council/runs/" + id);
    S.council.last = r; S.tab.council = "run"; render();
  } catch (e) { toast(e.message, "err"); }
};
async function councilTemplates() {
  const ts = await api("/council/templates");
  return card({
    title: "Templates", sub: n((ts || []).length) + " مورد", flat: true,
    actions: '<button class="btn sm pri"' + act("templateNew") + ">＋ جدید</button>",
    body: lst((ts || []).map(function (t) {
      return li({
        icon: t.icon || "⚙",
        title: h(t.name) + (t.isBuiltin ? " " + bdg("builtin", "mut") : ""),
        sub: h(short(t.description, 56)) + " · " + t.mode + " · " + n(t.count) + " model",
        actions: '<button class="btn sm pri"' + act("runTemplate", t.id) + ">▶</button>" +
          '<button class="btn sm gho"' + act("dupTemplate", t.id) + ">⧉</button>" +
          (t.isBuiltin ? "" : '<button class="btn sm gho"' + act("templateEdit", t.id) + ">✎</button>" +
            '<button class="btn sm dan"' + act("delEntity", "Template", "/council/templates/" + t.id) + ">🗑</button>")
      });
    }), { icon: "⚙", title: "Template نداری", btn: { t: "＋ ساخت Template", on: act("templateNew") } })
  });
}
function templateFields(t) {
  t = t || {};
  return [
    { k: "name", l: "نام", req: true, v: t.name },
    { k: "description", l: "توضیح", t: "area", rows: 2, v: t.description },
    { k: "icon", l: "آیکون", v: t.icon || "⚙" },
    { k: "mode", l: "Mode", t: "select", v: t.mode || "judge", opts: [["independent", "Independent"], ["debate", "Debate"], ["panel", "Panel"], ["judge", "Judge"], ["iterative", "Iterative"]] },
    { t: "rowStart" },
    { k: "count", l: "تعداد مدل", t: "num", v: t.count || 3, min: 2, max: 30 },
    { k: "rounds", l: "Rounds", t: "num", v: t.rounds || 2, min: 1, max: 5 },
    { t: "rowEnd" },
    { k: "systemPrompt", l: "System Prompt", t: "area", rows: 3, v: t.systemPrompt },
    { k: "ensureDiversity", l: "Ensure Diversity", t: "switch", v: t.ensureDiversity !== false, hint: "مدلها از Providerهای متفاوت انتخاب شوند" }
  ];
}
window.templateNew = function () {
  editSheet({
    title: "Template جدید", fields: templateFields({}),
    onSave: async function (v) { await doAct(function () { return api("/council/templates", { body: v }); }, "ساخته شد"); }
  });
};
window.templateEdit = async function (id) {
  const t = await api("/council/templates/" + id);
  editSheet({
    title: "ویرایش Template", sub: t.name, fields: templateFields(t),
    onSave: async function (v) { await doAct(function () { return api("/council/templates/" + id, { method: "PATCH", body: v }); }, "ذخیره شد"); }
  });
};
window.dupTemplate = async function (id) {
  await doAct(function () { return api("/council/templates/" + id + "/duplicate", { body: {} }); }, "کپی شد");
};
window.runTemplate = function (id) {
  editSheet({
    title: "اجرای Template", cls: "narrow",
    fields: [{ k: "question", l: "سوال", t: "area", rows: 4, req: true }],
    okText: "▶ اجرا",
    onSave: async function (v) {
      closeSheet(); toast("در حال اجرا…");
      const r = await api("/council/templates/" + id + "/run", { body: { question: v.question }, long: true, timeout: 300000 });
      S.council.last = r; S.tab.council = "run"; render(); toast("کامل شد", "ok");
    }
  });
};
async function councilConfigs() {
  const cs = await api("/council/configs");
  return card({
    title: "Saved Configs", flat: true,
    actions: '<button class="btn sm pri"' + act("configSave") + ">＋ ذخیره فعلی</button>",
    body: lst((cs || []).map(function (c) {
      return li({
        title: h(c.name || "config"),
        sub: c.mode + " · " + n(c.count) + " model · " + n(c.rounds) + " rounds",
        actions: '<button class="btn sm"' + act("configLoad", c.id, c.mode, String(c.count), String(c.rounds)) + ">بارگذاری</button>" +
          '<button class="btn sm dan"' + act("delEntity", "Config", "/council/configs/" + c.id) + ">🗑</button>"
      });
    }), { icon: "⚙", title: "Config ذخیرهشدهای نیست" })
  });
}
window.configSave = function () {
  editSheet({
    title: "ذخیره Config", cls: "narrow",
    fields: [{ k: "name", l: "نام", req: true, v: S.council.mode + "-" + S.council.count }],
    onSave: async function (v) {
      await doAct(function () {
        return api("/council/configs", { body: { name: v.name, mode: S.council.mode, count: S.council.count, rounds: S.council.rounds } });
      }, "ذخیره شد");
    }
  });
};
window.configLoad = function (id, mode, count, rounds) {
  S.council.mode = mode; S.council.count = Number(count); S.council.rounds = Number(rounds);
  S.tab.council = "run"; render(); toast("بارگذاری شد", "ok");
};

/* ═══════════ PLAYGROUND ═══════════ */
async function viewPlayground() {
  const head = '<div class="ph"><div class="ph-t"><h2>▶ Playground</h2><p>یک مدل را با پرامپت دلخواه تست کنید</p></div></div>';
  const models = await usableModels();
  if (!models.length) return head + setupGate("Playground");
  const opts = models.map(function (m) {
    return '<option value="' + h(m.id) + '" data-detail="' + h(m.apiModelId) + '">' + h(m.name || m.apiModelId) + " · " + h(m.provider || "") + "</option>";
  }).join("");

  return head +
    '<div class="side-by">' +
    card({
      title: "Request", icon: "▶",
      body:
        '<div class="fld"><label>Model<span class="req">*</span></label><select id="pgm">' + opts + "</select></div>" +
        '<div class="fld"><label>System Prompt</label><textarea id="pgs" rows="2" placeholder="اختیاری"></textarea></div>' +
        '<div class="fld"><label>Prompt<span class="req">*</span></label><textarea id="pgp" rows="5">Reply with exactly: PIMX_OK</textarea></div>' +
        '<div class="inline-f">' +
        '<div class="fld"><label>Max Tokens</label><input type="number" id="pgt" value="500"></div>' +
        '<div class="fld"><label>Temperature</label><input type="number" id="pgtemp" value="0.7" step="0.1" min="0" max="2"></div>' +
        "</div>" +
        '<div class="fld"><label class="swt"><div><div class="sl">JSON Mode</div></div><input type="checkbox" id="pgj"><span class="swt-b"></span></label></div>',
      foot: '<button class="btn pri full"' + act("runPlayground") + ">▶ اجرا</button>"
    }) +
    '<div id="pgout">' + card({ title: "Response", icon: "◎", body: '<div class="empty" style="padding:28px"><div class="es">خروجی اینجا نمایش داده میشود</div></div>' }) + "</div>" +
    "</div>";
}
window.runPlayground = async function () {
  const id = (document.getElementById("pgm") || {}).value;
  if (!id) return toast("مدلی انتخاب نشده", "err");
  const out = document.getElementById("pgout");
  out.innerHTML = card({ title: "Response", body: loading("در حال اجرا…") });
  try {
    const r = await api("/models/" + id + "/run", {
      long: true,
      body: {
        prompt: (document.getElementById("pgp") || {}).value,
        system: (document.getElementById("pgs") || {}).value || undefined,
        maxTokens: Number((document.getElementById("pgt") || {}).value) || 500,
        temperature: Number((document.getElementById("pgtemp") || {}).value),
        json: !!(document.getElementById("pgj") || {}).checked
      }
    });
    out.innerHTML = card({
      title: "Response", icon: "◎",
      sub: ms(r.latency) + " · " + usd(r.cost),
      body: '<div class="row wrap gap4 mb12">' + bdg(tail(r.model), "mono") + bdg(ms(r.latency)) +
        bdg(n(r.promptTokens) + "→" + n(r.completionTokens) + " tok") + bdg(usd(r.cost), "acc") +
        (r.failover ? bdg("failover", "warn") : "") + "</div>" +
        '<div class="bub" style="border:1px solid var(--line)">' + md(r.text) + "</div>" +
        ((r.attempts || []).length > 1 ? '<h4 class="mt16 mb8">Attempts</h4>' + r.attempts.map(function (a) {
          return kv(tail(a.model), a.error ? '<span style="color:var(--bad)">' + h(short(a.error, 34)) + "</span>" : ms(a.ms));
        }).join("") : "")
    });
  } catch (e) { out.innerHTML = card({ title: "Response", body: errBox(e) }); }
};
`;
