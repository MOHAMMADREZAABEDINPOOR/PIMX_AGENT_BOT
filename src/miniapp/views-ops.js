export const VIEWS_OPS = String.raw`
/* ═══════════ AUTOMATION ═══════════ */
async function viewAutomation() {
  const tab = curTab("auto", "tasks");
  const head = '<div class="ph"><div class="ph-t"><h2>Automation</h2><p>اجرای زمانبندیشده و Workflow</p></div></div>' +
    tabsBar("auto", [["tasks", "Scheduled Tasks"], ["workflows", "Workflows"], ["webhooks", "Webhooks"]]);

  if (tab === "workflows") {
    const wfs = await api("/workflows");
    return head + card({
      title: "Workflows", sub: n((wfs || []).length) + " مورد", flat: true, icon: "⇉",
      actions: '<button class="btn sm gho"' + act("wfNL") + ">✦ با زبان طبیعی</button>" +
        '<button class="btn sm pri"' + act("wfNew") + ">＋ Workflow</button>",
      body: lst((wfs || []).map(function (w) {
        return li({
          icon: "⇉", onclick: act("wfOpen", w.id),
          title: h(w.name) + " " + (w.enabled === false ? bdg("disabled", "mut") : bdg("enabled", "ok")),
          sub: h(short(w.description, 60)) + "<br><span class=\"tny\">" + n((w.nodes || []).length) + " node · " + n((w.edges || []).length) + " edge" + (w.runs ? " · " + n(w.runs) + " runs" : "") + (w.lastRun ? " · " + rel(w.lastRun) : "") + "</span>",
          actions: '<button class="btn sm pri"' + act("wfRun", w.id, w.name) + ">▶</button>" +
            '<button class="btn sm dan"' + act("delEntity", "Workflow", "/workflows/" + w.id) + ">🗑</button>",
          chev: true
        });
      }), { icon: "⇉", title: "Workflow نداری", sub: "چند مرحله را به هم وصل کنید: search → model → notification", btn: { t: "✦ ساخت با زبان طبیعی", on: act("wfNL") } })
    });
  }
  if (tab === "webhooks") {
    let hooks = [];
    try { hooks = await api("/webhooks"); } catch (e) { return head + errBox(e); }
    return head + card({
      title: "Webhooks", sub: n((hooks || []).length) + " مورد", flat: true, icon: "⇗",
      actions: '<button class="btn sm pri"' + act("hookNew") + ">＋ Webhook</button>",
      body: lst((hooks || []).map(function (w) {
        const st = w.stats || {};
        return li({
          icon: "⇗",
          title: '<span class="mono ltr">' + h(short(w.url, 36)) + "</span> " + (w.enabled ? bdg("enabled", "ok") : bdg("disabled", "mut")),
          sub: n((w.events || []).length) + " events · " + n(st.successfulCalls) + " ok / " + n(st.failedCalls) + " fail" +
            (st.lastTriggered ? " · " + rel(st.lastTriggered) : ""),
          actions: '<button class="btn sm"' + act("hookTest", w.id) + ">test</button>" +
            '<button class="btn sm gho"' + act("hookDeliveries", w.id) + ">log</button>" +
            '<button class="btn sm gho"' + act("hookEdit", w.id) + ">✎</button>" +
            '<button class="btn sm dan"' + act("delEntity", "Webhook", "/webhooks/" + w.id) + ">🗑</button>"
        });
      }), { icon: "⇗", title: "Webhook نداری", sub: "رویدادهای پلتفرم را به یک URL بیرونی بفرستید", btn: { t: "＋ ساخت Webhook", on: act("hookNew") } })
    });
  }

  const tasks = await api("/tasks");
  return head + card({
    title: "Scheduled Tasks", sub: n((tasks || []).length) + " مورد", flat: true, icon: "◷",
    actions: '<button class="btn sm gho"' + act("taskNL") + ">✦ با زبان طبیعی</button>" +
      '<button class="btn sm pri"' + act("taskNew") + ">＋ Task</button>",
    body: lst((tasks || []).map(function (t) {
      const lr = t.lastResult || {};
      return li({
        icon: "◷",
        title: h(t.name) + " " + (t.enabled ? bdg("enabled", "ok") : bdg("paused", "mut")) + " " + bdg(t.kind || "agent", "acc"),
        sub: '<span class="mono ltr">' + h(t.cron) + "</span> · " +
          (t.lastRun ? (lr.ok ? "✓" : "✕") + " " + rel(t.lastRun) : "اجرا نشده") +
          (t.runs ? " · " + n(t.runs) + " runs" : "") +
          (lr.error ? '<br><span class="tny" style="color:var(--bad)">' + h(short(lr.error, 60)) + "</span>" : ""),
        actions: '<button class="btn sm pri"' + act("taskRun", t.id) + ">▶</button>" +
          '<button class="btn sm gho"' + act("taskToggle", t.id, String(!t.enabled)) + ">" + (t.enabled ? "⏸" : "▶") + "</button>" +
          '<button class="btn sm gho"' + act("taskEdit", t.id) + ">✎</button>" +
          '<button class="btn sm dan"' + act("delEntity", "Task", "/tasks/" + t.id) + ">🗑</button>"
      });
    }), { icon: "◷", title: "Task زمانبندیشده نداری", sub: "مثلاً: هر روز ساعت ۸ صبح خبرهای AI را خلاصه کن", btn: { t: "✦ ساخت با زبان طبیعی", on: act("taskNL") } })
  });
}
window.taskNL = function () {
  editSheet({
    title: "ساخت Task با زبان طبیعی", cls: "narrow",
    fields: [{ k: "naturalLanguage", l: "توضیح دهید", t: "area", rows: 4, req: true, ph: "هر روز ساعت ۸ صبح خبرهای هوش مصنوعی را خلاصه کن و برایم بفرست" }],
    okText: "✦ ساخت",
    onSave: async function (v) {
      await doAct(function () { return api("/tasks", { body: { naturalLanguage: v.naturalLanguage, tzOffsetMin: -new Date().getTimezoneOffset() }, long: true }); }, "Task ساخته شد");
    }
  });
};
async function taskFields(t) {
  t = t || {};
  const agents = await cached("agentList", function () { return api("/agents"); });
  return [
    { k: "name", l: "نام", req: true, v: t.name },
    { k: "cron", l: "Cron", req: true, v: t.cron || "0 8 * * *", ltr: true, hint: "minute hour day month weekday — مثال: 0 8 * * * هر روز ۸ صبح" },
    { k: "kind", l: "نوع", t: "select", v: t.kind || "agent", opts: [["agent", "Agent"], ["workflow", "Workflow"], ["tool", "Tool"], ["prompt", "Prompt"]] },
    { k: "agentId", l: "Agent", t: "select", v: t.agentId || "builtin:master", opts: (agents || []).map(function (a) { return [a.id, a.name]; }) },
    { k: "prompt", l: "هدف / پرامپت", t: "area", rows: 3, v: t.prompt },
    { k: "enabled", l: "فعال", t: "switch", v: t.enabled !== false }
  ];
}
window.taskNew = async function () {
  const f = await taskFields({});
  editSheet({
    title: "ساخت Task", fields: f,
    onSave: async function (v) {
      v.tzOffsetMin = -new Date().getTimezoneOffset();
      await doAct(function () { return api("/tasks", { body: v }); }, "ساخته شد");
    }
  });
};
window.taskEdit = async function (id) {
  const tasks = await api("/tasks");
  const t = (tasks || []).filter(function (x) { return x.id === id; })[0] || {};
  const f = await taskFields(t);
  editSheet({
    title: "ویرایش Task", sub: t.name, fields: f,
    onSave: async function (v) { await doAct(function () { return api("/tasks/" + id, { method: "PATCH", body: v }); }, "ذخیره شد"); }
  });
};
window.taskToggle = async function (id, val) {
  await doAct(function () { return api("/tasks/" + id, { method: "PATCH", body: { enabled: val === "true" } }); }, val === "true" ? "فعال شد" : "متوقف شد", { close: false });
};
window.taskRun = async function (id) {
  toast("در حال اجرا…");
  try {
    const r = await api("/tasks/" + id + "/run", { body: {}, long: true, timeout: 300000 });
    sheet({
      title: r.ok ? "اجرا موفق" : "اجرا ناموفق",
      body: (r.error ? note(h(r.error), "err") : "") + '<div class="bub" style="border:1px solid var(--line)">' + md(r.output || "") + "</div>",
      foot: '<button class="btn gho" onclick="closeSheet();render()">بستن</button>'
    });
  } catch (e) { toast(e.message, "err"); }
};
window.wfNL = function () {
  editSheet({
    title: "ساخت Workflow با زبان طبیعی", cls: "narrow",
    fields: [{ k: "naturalLanguage", l: "توضیح دهید", t: "area", rows: 4, req: true, ph: "در وب جستجو کن، خلاصه بساز و نتیجه را برایم بفرست" }],
    okText: "✦ ساخت",
    onSave: async function (v) {
      await doAct(function () { return api("/workflows", { body: { naturalLanguage: v.naturalLanguage }, long: true }); }, "Workflow ساخته شد");
    }
  });
};
window.wfNew = function () {
  editSheet({
    title: "ساخت Workflow", cls: "wide",
    fields: [
      { k: "name", l: "نام", req: true },
      { k: "description", l: "توضیح", t: "area", rows: 2 },
      { k: "nodesJson", l: "Nodes (JSON)", t: "code", rows: 8, v: JSON.stringify([{ id: "n1", type: "trigger", label: "Start", config: {} }, { id: "n2", type: "model", label: "Generate", config: { prompt: "{{input}}" } }], null, 2) },
      { k: "edgesJson", l: "Edges (JSON)", t: "code", rows: 4, v: JSON.stringify([{ from: "n1", to: "n2" }], null, 2) },
      { k: "enabled", l: "فعال", t: "switch", v: true }
    ],
    onSave: async function (v) {
      let nodes = [], edges = [];
      try { nodes = JSON.parse(v.nodesJson || "[]"); edges = JSON.parse(v.edgesJson || "[]"); }
      catch (e) { throw new Error("JSON نامعتبر"); }
      await doAct(function () { return api("/workflows", { body: { name: v.name, description: v.description, nodes: nodes, edges: edges, enabled: v.enabled } }); }, "ساخته شد");
    }
  });
};
window.wfOpen = async function (id) {
  const w = await api("/workflows/" + id);
  const types = (S.meta && S.meta.nodeTypes) || {};
  sheet({
    title: w.name, sub: n((w.nodes || []).length) + " node", cls: "wide",
    body: '<div class="tiny mb12">' + h(w.description || "") + "</div>" +
      '<div class="flow">' + (w.nodes || []).map(function (nd, i) {
        return '<div class="node"><span class="node-n">' + (i + 1) + "</span>" +
          '<div class="sp"><div style="font-weight:600;font-size:12.5px">' + h(nd.label || nd.id) + " " + bdg((types[nd.type] && types[nd.type].label) || nd.type, "acc") + "</div>" +
          '<div class="tny mono">' + h(short(JSON.stringify(nd.config || {}), 60)) + "</div></div></div>";
      }).join("") + "</div>" +
      '<h4 class="mt16 mb8">Edges</h4>' + (w.edges || []).map(function (e) { return kv(e.from, "→ " + e.to); }).join(""),
    foot: '<button class="btn gho" onclick="closeSheet()">بستن</button>' +
      '<button class="btn"' + act("wfEdit", id) + ">✎ ویرایش</button>" +
      '<button class="btn pri"' + act("wfRun", id, w.name) + ">▶ اجرا</button>"
  });
};
window.wfEdit = async function (id) {
  const w = await api("/workflows/" + id);
  closeSheet();
  editSheet({
    title: "ویرایش Workflow", sub: w.name, cls: "wide",
    fields: [
      { k: "name", l: "نام", req: true, v: w.name },
      { k: "description", l: "توضیح", t: "area", rows: 2, v: w.description },
      { k: "nodesJson", l: "Nodes (JSON)", t: "code", rows: 10, v: JSON.stringify(w.nodes || [], null, 2) },
      { k: "edgesJson", l: "Edges (JSON)", t: "code", rows: 5, v: JSON.stringify(w.edges || [], null, 2) },
      { k: "enabled", l: "فعال", t: "switch", v: w.enabled !== false }
    ],
    onSave: async function (v) {
      let nodes, edges;
      try { nodes = JSON.parse(v.nodesJson); edges = JSON.parse(v.edgesJson); }
      catch (e) { throw new Error("JSON نامعتبر"); }
      await doAct(function () { return api("/workflows/" + id, { method: "PATCH", body: { name: v.name, description: v.description, nodes: nodes, edges: edges, enabled: v.enabled } }); }, "ذخیره شد");
    }
  });
};
window.wfRun = function (id, name) {
  editSheet({
    title: "اجرای " + name, cls: "narrow",
    fields: [{ k: "input", l: "ورودی", t: "area", rows: 3 }],
    okText: "▶ اجرا",
    onSave: async function (v) {
      sheetBody(loading("Workflow در حال اجرا…"));
      const r = await api("/workflows/" + id + "/run", { body: v, long: true, timeout: 300000 });
      bust();
      sheetBody('<div class="mb12">' + (r.status === "done" ? note("✓ اجرا کامل شد") : note("✕ " + h(r.error || "ناموفق"), "err")) + "</div>" +
        '<div class="steps">' + (r.steps || []).map(function (s) {
          return '<div class="step ' + (s.status === "done" ? "done" : s.status === "fail" ? "fail" : "run") + '">' +
            '<i class="step-i">' + (s.status === "done" ? "✓" : s.status === "fail" ? "✕" : s.status === "skip" ? "–" : "•") + "</i>" +
            '<div class="sp"><div class="step-t">' + h(s.label || s.node) + " " + bdg(s.type, "mut") + "</div>" +
            (s.preview || s.detail ? '<div class="step-d">' + h(short(s.preview || s.detail, 140)) + "</div>" : "") + "</div></div>";
        }).join("") + "</div>" +
        (r.output ? '<h4 class="mt16 mb8">Output</h4><div class="bub" style="border:1px solid var(--line)">' + md(r.output) + "</div>" : ""));
    }
  });
};
async function hookFields(w) {
  w = w || {};
  let events = {};
  try { const e = await api("/webhooks/events"); events = e.events || {}; } catch (er) { events = {}; }
  return [
    { k: "url", l: "URL", t: "url", req: true, v: w.url },
    { k: "events", l: "Events", t: "csv", v: (w.events || []).join(", "), req: true, hint: "موجود: " + Object.keys(events).slice(0, 8).join(", ") + (Object.keys(events).length > 8 ? " …" : "") },
    { k: "description", l: "توضیح", t: "area", rows: 2, v: w.description },
    { k: "enabled", l: "فعال", t: "switch", v: w.enabled !== false }
  ];
}
window.hookNew = async function () {
  const f = await hookFields({});
  editSheet({
    title: "ساخت Webhook", fields: f, okText: "ساخت",
    onSave: async function (v) {
      const r = await api("/webhooks", { body: v });
      closeSheet(); bust(); render();
      sheet({
        title: "Webhook ساخته شد", cls: "narrow",
        body: note("این Secret را ذخیره کنید — دیگر نمایش داده نمیشود.", "warn") + codeBox(r.secret, "hsec")
      });
    }
  });
};
window.hookEdit = async function (id) {
  const w = await api("/webhooks/" + id);
  const f = await hookFields(w);
  editSheet({
    title: "ویرایش Webhook", fields: f,
    onSave: async function (v) { await doAct(function () { return api("/webhooks/" + id, { method: "PATCH", body: v }); }, "ذخیره شد"); }
  });
};
window.hookTest = async function (id) {
  try { const r = await api("/webhooks/" + id + "/test", { body: {}, long: true }); toast(r.success ? "ارسال موفق (" + r.status + ")" : "ناموفق: " + (r.error || r.status), r.success ? "ok" : "err"); bust(); render(); }
  catch (e) { toast(e.message, "err"); }
};
window.hookDeliveries = async function (id) {
  try {
    const d = await api("/webhooks/" + id + "/deliveries?limit=40");
    sheet({
      title: "Delivery Log", cls: "wide",
      body: lst((d || []).map(function (x) {
        return li({
          icon: x.status === "delivered" ? "✓" : x.status === "failed" ? "✕" : "•",
          title: bdg(x.event, "acc") + " " + statusBdg(x.status) + (x.statusCode ? " " + bdg("HTTP " + x.statusCode, "mut") : ""),
          sub: n(x.attempts) + " attempt · " + rel(x.createdAt) + (x.error ? " · " + h(short(x.error, 40)) : "")
        });
      }), { title: "تحویلی ثبت نشده" })
    });
  } catch (e) { toast(e.message, "err"); }
};

/* ═══════════ MONITORING ═══════════ */
async function viewMonitor() {
  const tab = curTab("mon", "health");
  const head = '<div class="ph"><div class="ph-t"><h2>Monitoring</h2><p>سلامت، مصرف و Observability</p></div>' +
    '<div class="ph-a"><button class="btn sm gho"' + act("healthSweep") + ">◍ Health Sweep</button></div></div>" +
    tabsBar("mon", [["health", "Health"], ["usage", "Usage"], ["traces", "Traces"], ["logs", "Logs"], ["metrics", "Metrics"]]);

  if (tab === "usage") {
    const days = Number(S.query.days || 7);
    const u = await api("/usage?days=" + days);
    const t = u.totals || {};
    return head +
      '<div class="chips mb12">' + [7, 14, 30].map(function (d) {
        return '<span class="chip clk ' + (days === d ? "on" : "") + '"' + act("setUsageDays", String(d)) + ">" + d + " روز</span>";
      }).join("") + "</div>" +
      '<div class="g g4 mb16">' +
      stat({ label: "Requests", value: n(t.requests), sub: n(t.errors) + " error", icon: "↗", spark: (u.series || []).map(function (x) { return x.requests; }) }) +
      stat({ label: "Tokens", value: n(t.tokens), sub: n(t.tokensIn) + " in / " + n(t.tokensOut) + " out", icon: "◆", spark: (u.series || []).map(function (x) { return x.tokens; }) }) +
      stat({ label: "Cost", value: usd(t.cost), kind: "acc", icon: "$", spark: (u.series || []).map(function (x) { return x.cost; }) }) +
      stat({ label: "Avg Latency", value: ms(t.avgLatency), icon: "◷" }) +
      "</div>" +
      '<div class="side-by">' +
      card({
        title: "Daily", icon: "▤",
        raw: dataView({
          rows: (u.series || []).slice().reverse(),
          empty: { icon: "▤", title: "دادهای نیست" },
          cols: [{ t: "Date" }, { t: "Req", align: "num" }, { t: "Err", align: "num" }, { t: "Tokens", align: "num" }, { t: "Cost", align: "num" }, { t: "Latency", align: "num" }],
          tr: function (s) {
            return tr([
              '<span class="mono tiny">' + h(s.date) + "</span>",
              { v: n(s.requests), align: "num" },
              { v: s.errors ? '<span style="color:var(--bad)">' + n(s.errors) + "</span>" : "0", align: "num" },
              { v: n(s.tokens), align: "num" },
              { v: '<span class="mono tiny">' + usd(s.cost) + "</span>", align: "num" },
              { v: '<span class="mono tiny">' + ms(s.avgLatency) + "</span>", align: "num" }
            ]);
          },
          li: function (s) {
            return li({
              title: '<span class="mono">' + h(s.date) + "</span>",
              sub: n(s.requests) + " req · " + n(s.errors) + " err · " + n(s.tokens) + " tok",
              end: '<span class="tny mono">' + usd(s.cost) + "<br>" + ms(s.avgLatency) + "</span>"
            });
          }
        })
      }) +
      '<div>' +
      card({ title: "Top Models", icon: "◆", body: (u.byModel || []).slice(0, 10).map(function (x) { return bar(short(x.name, 22), x.requests, (u.byModel[0] || {}).requests || 1); }).join("") || '<div class="tiny">خالی</div>' }) +
      card({ title: "Top Providers", icon: "▣", cls: "mt12", body: (u.byProvider || []).slice(0, 8).map(function (x) { return bar(short(x.name, 22), x.requests, (u.byProvider[0] || {}).requests || 1); }).join("") || '<div class="tiny">خالی</div>' }) +
      card({ title: "By Task", icon: "◈", cls: "mt12", body: (u.byTask || []).slice(0, 8).map(function (x) { return bar(short(x.name, 22), x.requests, (u.byTask[0] || {}).requests || 1); }).join("") || '<div class="tiny">خالی</div>' }) +
      "</div></div>";
  }
  if (tab === "traces") {
    let traces = [];
    try { traces = await api("/observability/traces?limit=40"); } catch (e) { return head + errBox(e); }
    return head + card({
      title: "Traces", sub: n((traces || []).length), flat: true, icon: "◈",
      body: lst((traces || []).map(function (t) {
        return li({
          icon: "◈", onclick: act("traceOpen", t.id),
          title: '<span class="mono">' + h(short(t.id, 22)) + "</span> " + statusBdg(t.status),
          sub: n(t.spanCount) + " spans · " + ms(t.duration) + " · " + rel(new Date(t.startTime).toISOString()),
          chev: true
        });
      }), { icon: "◈", title: "Trace ثبت نشده" })
    });
  }
  if (tab === "logs") {
    const lvl = S.query.level || "";
    let logs = [];
    try { logs = await api("/observability/logs?limit=100" + (lvl ? "&level=" + lvl : "")); } catch (e) { return head + errBox(e); }
    return head +
      '<div class="chips mb12">' + ["", "debug", "info", "warn", "error", "fatal"].map(function (l) {
        return '<span class="chip clk ' + (lvl === l ? "on" : "") + '"' + act("setLogLevel", l) + ">" + (l || "همه") + "</span>";
      }).join("") + "</div>" +
      card({
        title: "Logs", flat: true, icon: "▤",
        body: lst((logs || []).map(function (l) {
          const k = l.level === "ERROR" || l.level === "FATAL" ? "err" : l.level === "WARN" ? "warn" : l.level === "DEBUG" ? "mut" : "info";
          return li({
            title: bdg(l.level, k) + ' <span class="tny">' + rel(new Date(l.timestamp).toISOString()) + "</span>",
            sub: h(short(l.message, 120)) + (l.traceId ? '<br><span class="tny mono">trace: ' + h(short(l.traceId, 18)) + "</span>" : "")
          });
        }), { icon: "▤", title: "لاگی ثبت نشده" })
      });
  }
  if (tab === "metrics") {
    let dash = null, perf = null;
    try { dash = await api("/observability/dashboard?hours=24"); } catch (e) { }
    try { perf = await api("/observability/performance"); } catch (e) { }
    if (!dash && !perf) return head + errBox({ message: "دادهای برای Observability موجود نیست" });
    return head +
      (dash ? '<div class="g g4 mb16">' +
        stat({ label: "Traces", value: n(dash.traces.total), sub: n(dash.traces.errors) + " error", icon: "◈" }) +
        stat({ label: "Logs", value: n(dash.logs.total), sub: n(dash.logs.error) + " error", icon: "▤" }) +
        stat({ label: "Metrics", value: n(dash.metrics.total), icon: "◔" }) +
        stat({ label: "Health", value: dash.health.status === "healthy" ? "OK" : "Degraded", kind: dash.health.status === "healthy" ? "ok" : "warn", sub: pct(dash.health.errorRate) + " error rate", icon: "◍" }) +
        "</div>" : "") +
      (perf ? card({
        title: "Performance by Operation", icon: "◷",
        raw: dataView({
          rows: Object.keys(perf).map(function (k) { return Object.assign({ __k: k }, perf[k]); }),
          empty: { icon: "◷", title: "دادهای نیست" },
          cols: [{ t: "Operation" }, { t: "Count", align: "num" }, { t: "Success", align: "num" }, { t: "Avg", align: "num" }, { t: "Min", align: "num" }, { t: "Max", align: "num" }],
          tr: function (p) {
            return tr([
              "<b>" + h(p.__k) + "</b>",
              { v: n(p.count), align: "num" },
              { v: pct(p.successRate), align: "num" },
              { v: ms(p.avgDuration), align: "num" },
              { v: ms(p.minDuration), align: "num" },
              { v: ms(p.maxDuration), align: "num" }
            ]);
          },
          li: function (p) {
            return li({
              title: "<b>" + h(p.__k) + "</b> " + bdg(pct(p.successRate), p.successRate > 90 ? "ok" : "warn"),
              sub: n(p.count) + " calls · avg " + ms(p.avgDuration) + " · " + ms(p.minDuration) + "→" + ms(p.maxDuration)
            });
          }
        })
      }) : "");
  }

  const mon = await api("/monitoring");
  const snap = mon.snapshot || {};
  return head +
    '<div class="g g4 mb16">' +
    stat({ label: "Providers", value: n(snap.providersHealthy) + "/" + n(snap.providers), icon: "▣", meter: snap.providers ? (snap.providersHealthy / snap.providers) * 100 : 0 }) +
    stat({ label: "Models", value: n(snap.modelsHealthy) + "/" + n(snap.models), sub: n(snap.modelsFailed) + " failed", icon: "◆", meter: snap.models ? (snap.modelsHealthy / snap.models) * 100 : 0 }) +
    stat({ label: "Avg Latency", value: ms(snap.avgLatency), icon: "◷" }) +
    stat({ label: "Requests", value: n(snap.requests), sub: n(snap.errors) + " error", icon: "↗" }) +
    "</div>" +
    '<div class="side-by">' +
    card({
      title: "Provider Health", flat: true, icon: "▣",
      body: lst((mon.providers || []).map(function (p) {
        return li({
          onclick: act("go", "provider", p.id),
          title: h(p.name) + " " + statusBdg(p.status),
          sub: n(p.healthyModels) + "/" + n(p.models) + " models · " + pct(p.successRate) + " success · " + ms(p.avgLatency) +
            (p.lastError ? '<br><span class="tny" style="color:var(--bad)">' + h(short(p.lastError, 60)) + "</span>" : ""),
          end: '<span class="tny">' + rel(p.lastChecked) + "</span>", chev: true
        });
      }), { icon: "▣", title: "Provider نداری" })
    }) +
    card({
      title: "Model Health", flat: true, icon: "◆",
      body: lst((mon.models || []).slice(0, 14).map(function (m) {
        return li({
          onclick: act("go", "model", m.id),
          title: h(short(m.name, 28)) + " " + statusBdg(m.status),
          sub: h(short(m.provider, 18)) + " · " + ms(m.latency) + " · " + pct(m.errorRate) + " err",
          chev: true
        });
      }), { icon: "◆", title: "مدلی نداری" })
    }) + "</div>";
}
window.setUsageDays = function (d) { go("monitor", {}, { days: d }); };
window.setLogLevel = function (l) { go("monitor", {}, l ? { level: l } : {}); };
window.traceOpen = async function (id) {
  try {
    const t = await api("/observability/traces/" + id);
    sheet({
      title: "Trace", sub: short(id, 30), cls: "wide",
      body: kv("Status", statusBdg(t.status)) + kv("Spans", n((t.spans || []).length)) + kv("Duration", ms(t.duration)) +
        '<h4 class="mt16 mb8">Spans</h4><div class="steps">' + (t.spans || []).map(function (s) {
          return '<div class="step ' + (s.status === "ok" ? "done" : "fail") + '"><i class="step-i">•</i>' +
            '<div class="sp"><div class="step-t">' + h(s.name) + ' <span class="tny mono">' + ms(s.duration) + "</span></div>" +
            '<div class="step-d mono">' + h(short(JSON.stringify(s.attributes || {}), 80)) + "</div></div></div>";
        }).join("") + "</div>"
    });
  } catch (e) { toast(e.message, "err"); }
};

/* ═══════════ COSTS & TOKENS DASHBOARD ═══════════ */
async function viewCosts() {
  const d = await api("/models?size=500");
  const models = d.models || [];

  let totalRequests = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalTokens = 0;
  let totalCost = 0;

  models.forEach(function (m) {
    const req = Number(m.requests || (m.stats && m.stats.req) || 0);
    const tin = Number(m.tokensIn || (m.stats && m.stats.tokensIn) || 0);
    const tout = Number(m.tokensOut || (m.stats && m.stats.tokensOut) || 0);
    const tok = tin + tout || Number(m.tokens || 0);
    const cost = Number(m.cost || (m.stats && m.stats.cost) || 0);

    totalRequests += req;
    totalTokensIn += tin;
    totalTokensOut += tout;
    totalTokens += tok;
    totalCost += cost;
  });

  const avgTokensPerReq = totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0;

  const head = '<div class="ph">' +
    '<div class="ph-t">' +
    '<h2>📊 هزینه‌ها و مصرف توکن (Costs & Tokens)</h2>' +
    '<p>گزارش لحظه‌ای مصرف توکن‌ها، هزینه‌های واقعی دلاری و تعرفه تمام مدل‌ها</p>' +
    '</div>' +
    '<div class="ph-a">' +
    '<button class="btn sm gho" onclick="bust();render()">↻ به‌روزرسانی</button>' +
    '<button class="btn sm gho" onclick="exportCosts()">▤ دانلود CSV</button>' +
    '</div></div>';

  const statsGrid = '<div class="g g4 mb16">' +
    stat({ label: "کل هزینه مصرفی", value: usd(totalCost), kind: "acc", icon: "💰", sub: "هزینه کل توکن‌ها" }) +
    stat({ label: "مجموع توکن‌ها", value: n(totalTokens), icon: "🔢", sub: n(totalTokensIn) + " in · " + n(totalTokensOut) + " out" }) +
    stat({ label: "تعداد درخواست‌ها", value: n(totalRequests), icon: "↗", sub: avgTokensPerReq > 0 ? (n(avgTokensPerReq) + " توکن/پیام") : "آماده" }) +
    stat({ label: "مدل‌های فعال", value: n(models.filter(function (m) { return m.enabled !== false; }).length), icon: "◆", sub: "از " + n(models.length) + " مدل کل" }) +
    '</div>';

  const usedModels = models.slice().sort(function (a, b) {
    return (b.tokens || 0) - (a.tokens || 0) || (b.cost || 0) - (a.cost || 0);
  });

  const usageCards = usedModels.map(function (m) {
    const req = Number(m.requests || (m.stats && m.stats.req) || 0);
    const tin = Number(m.tokensIn || (m.stats && m.stats.tokensIn) || 0);
    const tout = Number(m.tokensOut || (m.stats && m.stats.tokensOut) || 0);
    const tok = tin + tout || Number(m.tokens || 0);
    const cost = Number(m.cost || (m.stats && m.stats.cost) || 0);
    const pctShare = totalTokens > 0 ? Math.round((tok / totalTokens) * 100) : 0;

    return '<div class="card mb-2" style="padding:12px 14px;border-radius:12px;">' +
      '<div class="flex-between mb-1" style="align-items:center;flex-wrap:wrap;gap:8px;">' +
        '<div style="min-width:0;flex:1;">' +
          '<div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
            '<span>' + h(m.name || m.apiModelId) + '</span>' +
            (m.provider ? '<span class="badge badge-acc" style="font-size:10px;">' + h(m.provider) + '</span>' : '') +
            statusBdg(m.status) +
          '</div>' +
          '<div class="mono ltr text-xs text-muted" style="margin-top:2px;">' + h(m.apiModelId) + '</div>' +
        '</div>' +
        '<div style="text-align:end;flex-shrink:0;">' +
          '<div class="font-bold text-sm" style="color:var(--acc);">' + usd(cost) + '</div>' +
          '<div class="text-xs text-muted">' + n(tok) + ' توکن (' + pctShare + '%)</div>' +
        '</div>' +
      '</div>' +
      '<div class="row gap8 wrap text-xs text-muted mt-2" style="background:var(--surface2);border:1px solid var(--line);padding:6px 10px;border-radius:8px;">' +
        '<span>درخواست‌ها: <b style="color:var(--text);">' + n(req) + '</b></span> · ' +
        '<span>ورودی (Prompt): <b style="color:var(--text);">' + n(tin) + '</b></span> · ' +
        '<span>خروجی (Completion): <b style="color:var(--text);">' + n(tout) + '</b></span>' +
      '</div>' +
      '<div style="height:4px;border-radius:99px;background:var(--line2);overflow:hidden;margin-top:8px;">' +
        '<div style="width:' + (totalTokens > 0 ? (tok / totalTokens) * 100 : 0) + '%;height:100%;background:var(--grad);border-radius:99px;"></div>' +
      '</div>' +
    '</div>';
  }).join("");

  const usageSection = card({
    title: "مصرف و هزینه به تفکیک هر مدل",
    icon: "▣",
    sub: n(models.length) + " مدل ثبت‌شده در سیستم",
    body: usageCards || '<div class="empty" style="padding:24px;text-align:center;">هنوز درخواستی ثبت نشده است</div>'
  });

  function getModelDisplayPricing(m) {
    const p = m.pricing || {};
    let inP = Number(p.inputPer1M || 0);
    let outP = Number(p.outputPer1M || 0);
    const mid = String(m.apiModelId || m.name || "").toLowerCase();
    const isExplicitFree = p.free || /:free$/i.test(mid) || /free/i.test(m.name || "");

    if (inP === 0 && outP === 0 && !isExplicitFree) {
      if (/gpt-4o-mini/i.test(mid)) { inP = 0.15; outP = 0.60; }
      else if (/gpt-4o/i.test(mid)) { inP = 2.50; outP = 10.00; }
      else if (/gpt-4/i.test(mid)) { inP = 30.00; outP = 60.00; }
      else if (/o1-mini/i.test(mid)) { inP = 3.00; outP = 12.00; }
      else if (/o1/i.test(mid)) { inP = 15.00; outP = 60.00; }
      else if (/o3-mini/i.test(mid)) { inP = 1.10; outP = 4.40; }
      else if (/claude-3-7-sonnet|claude-3-5-sonnet/i.test(mid)) { inP = 3.00; outP = 15.00; }
      else if (/claude-3-5-haiku/i.test(mid)) { inP = 0.80; outP = 4.00; }
      else if (/claude-3-opus/i.test(mid)) { inP = 15.00; outP = 75.00; }
      else if (/gemini-2\.5-flash|gemini-2\.0-flash/i.test(mid)) { inP = 0.10; outP = 0.40; }
      else if (/gemini-2\.5-pro/i.test(mid)) { inP = 1.25; outP = 5.00; }
      else if (/gemini-1\.5-flash/i.test(mid)) { inP = 0.075; outP = 0.30; }
      else if (/gemini-1\.5-pro/i.test(mid)) { inP = 1.25; outP = 5.00; }
      else if (/deepseek-reasoner|deepseek-r1/i.test(mid)) { inP = 0.55; outP = 2.19; }
      else if (/deepseek/i.test(mid)) { inP = 0.14; outP = 0.28; }
      else if (/llama-3\.3-70b/i.test(mid)) { inP = 0.59; outP = 0.79; }
      else if (/llama-3/i.test(mid)) { inP = 0.20; outP = 0.40; }
      else if (/mistral-large/i.test(mid)) { inP = 2.00; outP = 6.00; }
      else if (/mixtral/i.test(mid)) { inP = 0.24; outP = 0.24; }
    }

    const freeFinal = isExplicitFree || (inP === 0 && outP === 0);
    return {
      inPrice: freeFinal ? "رایگان" : "$" + inP.toFixed(2),
      outPrice: freeFinal ? "رایگان" : "$" + outP.toFixed(2),
      isFree: freeFinal
    };
  }

  const pricingRows = models.map(function (m) {
    const pr = getModelDisplayPricing(m);
    const ctx = m.context ? n(m.context) : "—";
    const searchData = (m.name + " " + m.apiModelId + " " + (m.provider || "")).toLowerCase();

    return '<tr class="pricing-row" data-search="' + h(searchData) + '" style="border-bottom:1px solid var(--line);">' +
      '<td style="padding:10px 12px;">' +
        '<div style="font-weight:700;font-size:13.5px;">' + h(m.name || m.apiModelId) + '</div>' +
        '<div class="mono ltr text-xs text-muted">' + h(m.apiModelId) + '</div>' +
      '</td>' +
      '<td style="padding:10px 12px;"><span class="badge badge-mut" style="font-size:11px;">' + h(m.provider || "—") + '</span></td>' +
      '<td class="mono" style="padding:10px 12px;color:' + (pr.isFree ? 'var(--ok)' : 'var(--text)') + ';font-weight:600;">' + pr.inPrice + '</td>' +
      '<td class="mono" style="padding:10px 12px;color:' + (pr.isFree ? 'var(--ok)' : 'var(--text)') + ';font-weight:600;">' + pr.outPrice + '</td>' +
      '<td class="mono text-xs text-muted" style="padding:10px 12px;">' + ctx + '</td>' +
      '<td style="padding:10px 12px;">' + (pr.isFree ? '<span class="badge badge-ok">رایگان</span>' : '<span class="badge badge-acc">تعرفه استاندارد</span>') + '</td>' +
    '</tr>';
  }).join("");

  const pricingSection = card({
    title: "تعرفه و قیمت رسمی تمامی مدل‌ها (به ازای هر ۱ میلیون توکن)",
    icon: "💲",
    sub: "قیمت دقیق محاسبه‌شده برای ورودی (Input) و خروجی (Output)",
    body: '<div class="mb-3" style="position:relative;">' +
      '<input type="search" class="input" style="padding-inline-start:36px;border-radius:12px;font-size:13px;" placeholder="جستجوی مدل برای مشاهده قیمت..." oninput="filterPricingTable(this.value)">' +
      '<span style="position:absolute;inset-inline-start:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none;">🔍</span>' +
      '</div>' +
      '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;text-align:start;font-size:13px;">' +
      '<thead><tr style="border-bottom:1px solid var(--line);color:var(--muted);font-size:12px;">' +
      '<th style="padding:8px 12px;text-align:start;">مدل</th>' +
      '<th style="padding:8px 12px;text-align:start;">Provider</th>' +
      '<th style="padding:8px 12px;text-align:start;">قیمت ورودی (1M)</th>' +
      '<th style="padding:8px 12px;text-align:start;">قیمت خروجی (1M)</th>' +
      '<th style="padding:8px 12px;text-align:start;">Context</th>' +
      '<th style="padding:8px 12px;text-align:start;">وضعیت تعرفه</th>' +
      '</tr></thead>' +
      '<tbody>' + pricingRows + '</tbody>' +
      '</table>' +
      '</div>'
  });

  return head + statsGrid + usageSection + '<div class="mt16"></div>' + pricingSection;
}

window.filterPricingTable = function (q) {
  q = (q || "").toLowerCase().trim();
  const rows = document.querySelectorAll(".pricing-row");
  rows.forEach(function (r) {
    const text = (r.getAttribute("data-search") || r.textContent || "").toLowerCase();
    r.style.display = !q || text.includes(q) ? "" : "none";
  });
};

window.exportCosts = function (start, end) {
  const url = "/api/costs/export?startDate=" + (start || "") + "&endDate=" + (end || "");
  window.open(url, "_blank");
};
function budgetFields(b) {
  b = b || {};
  return [
    { k: "name", l: "نام", req: true, v: b.name },
    { k: "limit", l: "سقف (USD)", t: "num", step: 0.01, req: true, v: b.limit },
    { k: "period", l: "Period", t: "seg", v: b.period || "monthly", opts: [["daily", "روزانه"], ["weekly", "هفتگی"], ["monthly", "ماهانه"], ["yearly", "سالانه"]] },
    { k: "scope", l: "Scope", t: "select", v: b.scope || "user", opts: [["user", "User"], ["project", "Project"]].concat(S.isAdmin ? [["global", "Global"]] : []) },
    { k: "alertThresholds", l: "آستانه هشدار (%)", t: "csv", v: (b.alertThresholds || [75, 90, 100]).join(", ") },
    { k: "enabled", l: "فعال", t: "switch", v: b.enabled !== false }
  ];
}
window.budgetNew = function () {
  editSheet({
    title: "ساخت Budget", fields: budgetFields({}),
    onSave: async function (v) {
      v.alertThresholds = (v.alertThresholds || []).map(Number).filter(function (x) { return !isNaN(x); });
      await doAct(function () { return api("/budgets", { body: v }); }, "ساخته شد");
    }
  });
};
window.budgetEdit = async function (id) {
  const b = await api("/budgets/" + id);
  editSheet({
    title: "ویرایش Budget", sub: b.name, fields: budgetFields(b),
    onSave: async function (v) {
      v.alertThresholds = (v.alertThresholds || []).map(Number).filter(function (x) { return !isNaN(x); });
      await doAct(function () { return api("/budgets/" + id, { method: "PATCH", body: { name: v.name, limit: v.limit, period: v.period, alertThresholds: v.alertThresholds, enabled: v.enabled } }); }, "ذخیره شد");
    }
  });
};
window.budgetReset = function (id) {
  confirmSheet("Reset مصرف؟", "مصرف فعلی این Budget صفر میشود.", async function () {
    await doAct(function () { return api("/budgets/" + id + "/reset", { body: {} }); }, "reset شد");
  }, { danger: false, okText: "Reset" });
};

/* ═══════════ ALERTS ═══════════ */
async function viewAlerts() {
  const d = await api("/alerts");
  return '<div class="ph"><div class="ph-t"><h2>Alerts</h2><p>هشدار خودکار روی سلامت و هزینه</p></div>' +
    '<div class="ph-a"><button class="btn sm gho"' + act("alertEval") + ">◍ ارزیابی الان</button>" +
    '<button class="btn pri sm"' + act("alertNew") + ">＋ Rule</button></div></div>" +
    '<div class="side-by">' +
    card({
      title: "Rules", sub: n((d.rules || []).length), flat: true, icon: "◔",
      body: lst((d.rules || []).map(function (r) {
        return li({
          icon: "◔",
          title: bdg(r.type, "acc") + " " + (r.enabled ? bdg("enabled", "ok") : bdg("disabled", "mut")),
          sub: "threshold " + n(r.threshold) + " · target " + h(r.target) + " · via " + h(r.channel),
          actions: '<button class="btn sm dan"' + act("delEntity", "Alert Rule", "/alerts/" + r.id, "alerts") + ">🗑</button>"
        });
      }), { icon: "◔", title: "Rule تعریف نشده", btn: { t: "＋ ساخت Rule", on: act("alertNew") } })
    }) +
    card({
      title: "Events", sub: n((d.events || []).length), flat: true, icon: "!",
      body: lst((d.events || []).slice(0, 40).map(function (e) {
        return li({ icon: "!", title: bdg(e.type, "warn") + ' <span class="tny">' + rel(e.ts) + "</span>", sub: h(short(String(e.message || "").replace(/<[^>]+>/g, ""), 90)) });
      }), { icon: "✓", title: "رویدادی ثبت نشده", sub: "سیستم پایدار است" })
    }) + "</div>";
}
window.alertNew = function () {
  editSheet({
    title: "ساخت Alert Rule",
    fields: [
      { k: "type", l: "نوع", t: "select", v: "modelDown", opts: [["providerDown", "Provider Down"], ["modelDown", "Model Down"], ["latency", "Latency"], ["errorRate", "Error Rate"], ["rateLimit", "Rate Limit"], ["cost", "Cost"], ["healthDegraded", "Health Degraded"]] },
      { k: "threshold", l: "Threshold", t: "num", v: 0, hint: "مثلاً برای latency = 5000 (ms) یا errorRate = 20 (%)" },
      { k: "target", l: "Target", v: "*", hint: "* برای همه، یا شناسه مدل/Provider" },
      { k: "channel", l: "کانال", t: "seg", v: "telegram", opts: [["telegram", "Telegram"], ["miniapp", "Mini App"]] },
      { k: "enabled", l: "فعال", t: "switch", v: true }
    ],
    onSave: async function (v) { await doAct(function () { return api("/alerts", { body: v }); }, "ساخته شد"); }
  });
};
window.alertEval = async function () {
  try { const r = await api("/alerts/evaluate", { body: {}, long: true }); toast("بررسی " + n(r.checked) + " · fired " + n(r.fired), "ok"); bust(); render(); }
  catch (e) { toast(e.message, "err"); }
};

/* ═══════════ APPROVALS ═══════════ */
async function viewApprovals() {
  let list = [], st = null;
  try { list = await api("/approvals?limit=50"); } catch (e) { }
  try { st = await api("/approvals/stats"); } catch (e) { }
  return '<div class="ph"><div class="ph-t"><h2>Approvals</h2><p>درخواستهای نیازمند تأیید (هزینه بالا / ابزار خطرناک)</p></div>' +
    '<div class="ph-a"><button class="btn sm gho"' + act("approvalCleanup") + ">پاکسازی منقضیها</button></div></div>" +
    (st ? '<div class="g g4 mb16">' +
      stat({ label: "Pending", value: n(st.pending), kind: st.pending ? "warn" : "", icon: "◷" }) +
      stat({ label: "Approved", value: n(st.approved), kind: "ok", icon: "✓" }) +
      stat({ label: "Rejected", value: n(st.rejected), kind: "bad", icon: "✕" }) +
      stat({ label: "Expired", value: n(st.expired), icon: "◌" }) +
      "</div>" : "") +
    lst((list || []).map(function (a) {
      return li({
        icon: a.risk === "critical" ? "⚠" : "◔",
        title: bdg(a.category, "acc") + " " + bdg(a.risk, a.risk === "critical" || a.risk === "high" ? "err" : a.risk === "medium" ? "warn" : "ok") + " " + statusBdg(a.status),
        sub: h(short(a.description, 90)) + '<br><span class="tny">' + (a.estimatedCost ? usd(a.estimatedCost) + " · " : "") + rel(a.createdAt) + " · " + h(a.userName || a.userId) + "</span>",
        actions: a.status === "pending" ? '<button class="btn sm okb"' + act("approveReq", a.id) + ">✓ تأیید</button>" +
          '<button class="btn sm dan"' + act("rejectReq", a.id) + ">✕ رد</button>" : ""
      });
    }), { icon: "✓", title: "درخواستی در انتظار نیست" });
}
window.approveReq = function (id) {
  editSheet({
    title: "تأیید درخواست", cls: "narrow",
    fields: [{ k: "reason", l: "دلیل (اختیاری)", t: "area", rows: 2 }],
    okText: "✓ تأیید",
    onSave: async function (v) { await doAct(function () { return api("/approvals/" + id + "/approve", { body: v }); }, "تأیید شد"); }
  });
};
window.rejectReq = function (id) {
  editSheet({
    title: "رد درخواست", cls: "narrow",
    fields: [{ k: "reason", l: "دلیل", t: "area", rows: 2, req: true }],
    okText: "✕ رد",
    onSave: async function (v) { await doAct(function () { return api("/approvals/" + id + "/reject", { body: v }); }, "رد شد"); }
  });
};
window.approvalCleanup = async function () {
  try { const r = await api("/approvals/cleanup", { body: {} }); toast(n(r.cleaned) + " مورد پاک شد", "ok"); render(); }
  catch (e) { toast(e.message, "err"); }
};

/* ═══════════ EVALUATION ═══════════ */
async function viewEval() {
  const tab = curTab("eval", "datasets");
  const head = '<div class="ph"><div class="ph-t"><h2>Evaluation</h2><p>سنجش کیفیت مدل با دیتاست تست</p></div></div>' +
    tabsBar("eval", [["datasets", "Datasets"], ["runs", "Runs"], ["criteria", "Criteria"]]);

  if (tab === "runs") {
    const runs = await api("/eval/runs?limit=30");
    return head + card({
      title: "Eval Runs", flat: true, icon: "▤",
      actions: '<button class="btn sm gho"' + act("evalCompare") + ">⇄ مقایسه</button>",
      body: lst((runs || []).map(function (r) {
        const s = r.summary || {};
        return li({
          icon: "▤", onclick: act("evalRunOpen", r.id),
          title: h(r.datasetName || "run") + " " + statusBdg(r.status),
          sub: "score " + n(Math.round(s.avgScore || 0)) + " · " + n(s.passed) + "/" + n(s.total) + " passed · " + usd(s.totalCost) + " · " + rel(r.startedAt),
          end: '<span class="mono tny">' + pct(s.total ? (s.passed / s.total) * 100 : 0) + "</span>", chev: true
        });
      }), { icon: "▤", title: "Run ثبت نشده" })
    });
  }
  if (tab === "criteria") {
    const c = await api("/eval/criteria");
    return head + card({
      title: "Criteria", sub: "معیارهای سنجش پاسخ", flat: true, icon: "◎",
      body: lst(Object.keys(c.criteria || {}).map(function (k) {
        return li({ icon: "◎", title: '<span class="mono">' + h(k) + "</span> — " + h(c.criteria[k].label), sub: h(c.criteria[k].desc) });
      }))
    });
  }

  const ds = await api("/eval/datasets");
  return head + card({
    title: "Datasets", sub: n((ds || []).length), flat: true, icon: "◫",
    actions: '<button class="btn sm pri"' + act("dsNew") + ">＋ Dataset</button>",
    body: lst((ds || []).map(function (d) {
      return li({
        icon: "◫", onclick: act("dsOpen", d.id),
        title: h(d.name) + " " + bdg(n((d.cases || []).length) + " cases", "mut"),
        sub: h(short(d.description, 70)) + " · " + rel(d.createdAt),
        actions: '<button class="btn sm pri"' + act("dsRun", d.id, d.name) + ">▶ Run</button>" +
          '<button class="btn sm gho"' + act("dsAddCase", d.id) + ">＋ Case</button>" +
          '<button class="btn sm dan"' + act("delEntity", "Dataset", "/eval/datasets/" + d.id) + ">🗑</button>",
        chev: true
      });
    }), { icon: "◫", title: "Dataset نداری", sub: "مجموعهای از سوال و پاسخ انتظاری بسازید تا مدلها را بسنجید", btn: { t: "＋ ساخت Dataset", on: act("dsNew") } })
  });
}
window.dsNew = function () {
  editSheet({
    title: "ساخت Dataset",
    fields: [
      { k: "name", l: "نام", req: true },
      { k: "description", l: "توضیح", t: "area", rows: 2 },
      { k: "tags", l: "Tags", t: "csv" }
    ],
    onSave: async function (v) { await doAct(function () { return api("/eval/datasets", { body: v }); }, "ساخته شد"); }
  });
};
window.dsOpen = async function (id) {
  const d = await api("/eval/datasets/" + id);
  sheet({
    title: d.name, sub: n((d.cases || []).length) + " test case", cls: "wide",
    body: '<div class="tiny mb12">' + h(d.description || "") + "</div>" +
      lst((d.cases || []).map(function (c) {
        return li({
          icon: "◈",
          title: h(short(c.question || c.input, 60)),
          sub: (c.expectedOutput ? "expected: " + h(short(c.expectedOutput, 40)) + "<br>" : "") +
            '<span class="tny">' + (c.criteria || []).map(function (x) { return x.type; }).join(", ") + "</span>",
          actions: '<button class="btn sm dan"' + act("dsDelCase", id, c.id) + ">🗑</button>"
        });
      }), { icon: "◈", title: "Case نداری", btn: { t: "＋ افزودن Case", on: act("dsAddCase", id) } }),
    foot: '<button class="btn gho" onclick="closeSheet()">بستن</button>' +
      '<button class="btn"' + act("dsAddCase", id) + ">＋ Case</button>" +
      '<button class="btn pri"' + act("dsRun", id, d.name) + ">▶ Run</button>"
  });
};
window.dsAddCase = function (id) {
  closeSheet();
  editSheet({
    title: "افزودن Test Case", cls: "wide",
    fields: [
      { k: "question", l: "سوال / پرامپت", t: "area", rows: 3, req: true },
      { k: "expectedOutput", l: "پاسخ انتظاری", t: "area", rows: 3 },
      { k: "criterion", l: "معیار", t: "select", v: "contains", opts: [["no_errors", "No Errors"], ["exact_match", "Exact Match"], ["contains", "Contains"], ["regex", "Regex"], ["json_valid", "JSON Valid"], ["llm_judge", "LLM Judge"], ["latency_max", "Max Latency"], ["cost_max", "Max Cost"]] },
      { k: "threshold", l: "Threshold", t: "num", hint: "برای latency_max / cost_max / llm_judge" }
    ],
    onSave: async function (v) {
      const crit = [{ type: v.criterion, threshold: v.threshold === null ? null : v.threshold }];
      await doAct(function () {
        return api("/eval/datasets/" + id + "/cases", { body: { question: v.question, input: v.question, expectedOutput: v.expectedOutput, criteria: crit } });
      }, "Case اضافه شد");
    }
  });
};
window.dsDelCase = function (dsId, caseId) {
  confirmSheet("حذف Case؟", "این test case حذف میشود.", async function () {
    await doAct(function () { return api("/eval/datasets/" + dsId + "/cases/" + caseId, { method: "DELETE" }); }, "حذف شد");
  });
};
window.dsRun = async function (id, name) {
  closeSheet();
  const models = await usableModels();
  if (!models.length) return toast("اول یک Provider اضافه کنید", "warn");
  editSheet({
    title: "اجرای Eval: " + name,
    fields: [
      { k: "modelId", l: "Model", t: "select", req: true, opts: models.map(function (m) { return [m.id, short(m.name || m.apiModelId, 40)]; }) },
      { t: "note", v: "همه test caseها روی این مدل اجرا و امتیازدهی میشوند. ممکن است چند دقیقه طول بکشد.", kind: "warn" }
    ],
    okText: "▶ اجرا",
    onSave: async function (v) {
      sheetBody(loading("در حال اجرای evaluation…"));
      const r = await api("/eval/datasets/" + id + "/run", { body: { type: "model", modelId: v.modelId }, long: true, timeout: 600000 });
      bust();
      sheetBody(evalRunHtml(r));
    }
  });
};
function evalRunHtml(r) {
  const s = r.summary || {};
  return '<div class="g g2 mb16">' +
    stat({ label: "Avg Score", value: n(Math.round(s.avgScore || 0)), kind: s.avgScore > 70 ? "ok" : "warn", meter: s.avgScore }) +
    stat({ label: "Passed", value: n(s.passed) + " / " + n(s.total), meter: s.total ? (s.passed / s.total) * 100 : 0 }) +
    stat({ label: "Avg Time", value: ms(s.avgExecutionTime) }) +
    stat({ label: "Cost", value: usd(s.totalCost) }) +
    "</div>" +
    (r.results || []).map(function (x) {
      return '<div class="ans"><div class="ans-h"' + act("toggleAns", "ev" + x.caseId) + ">" +
        '<span class="dot ' + (x.passed ? "ok" : "err") + '"></span>' +
        '<span class="sp trunc" style="font-size:12.5px">' + h(short(x.question, 50)) + "</span>" +
        '<span class="mono tny">' + n(Math.round(x.score || 0)) + "</span><span class=\"chev\">▾</span></div>" +
        '<div class="ans-b hide" id="ev' + x.caseId + '">' +
        (x.error ? note(h(x.error), "err") : '<div class="tiny">' + h(short(x.output, 500)) + "</div>") +
        '<h4 class="mt12 mb8">Criteria</h4>' + (x.criteriaResults || []).map(function (c) {
          return kv(c.type, (c.passed ? bdg("pass", "ok") : bdg("fail", "err")) + ' <span class="tny">' + h(short(c.message, 40)) + "</span>");
        }).join("") + "</div></div>";
    }).join("");
}
window.evalRunOpen = async function (id) {
  try { const r = await api("/eval/runs/" + id); sheet({ title: "Eval Run", sub: r.datasetName, cls: "wide", body: evalRunHtml(r) }); }
  catch (e) { toast(e.message, "err"); }
};
window.evalCompare = async function () {
  const runs = await api("/eval/runs?limit=20");
  editSheet({
    title: "مقایسه Runs", cls: "wide",
    fields: [
      { k: "a", l: "Run اول (baseline)", t: "select", req: true, opts: (runs || []).map(function (r) { return [r.id, (r.datasetName || "run") + " · " + rel(r.startedAt)]; }) },
      { k: "b", l: "Run دوم", t: "select", req: true, opts: (runs || []).map(function (r) { return [r.id, (r.datasetName || "run") + " · " + rel(r.startedAt)]; }) }
    ],
    okText: "⇄ مقایسه",
    onSave: async function (v) {
      sheetBody(loading());
      const r = await api("/eval/runs/compare", { body: { runIds: [v.a, v.b] } });
      const d = r.delta || {};
      sheetBody('<div class="g g3 mb16">' +
        stat({ label: "Score Δ", value: (d.scoreChange > 0 ? "+" : "") + n(Math.round(d.scoreChange || 0)), kind: d.scoreChange >= 0 ? "ok" : "bad" }) +
        stat({ label: "Cost Δ", value: usd(d.costChange) }) +
        stat({ label: "Latency Δ", value: ms(d.latencyChange) }) +
        "</div>" +
        (r.caseComparison || []).map(function (c) {
          return kv(short(c.question, 40), (c.regression ? bdg("regression", "err") : bdg("ok", "ok")) +
            ' <span class="mono tny">' + n(Math.round(c.baselineScore)) + " → " + n(Math.round(c.currentScore)) + "</span>");
        }).join(""));
    }
  });
};

/* ═══════════ SETTINGS ═══════════ */
async function viewSettings() {
  const tab = curTab("set", "general");
  const head = '<div class="ph"><div class="ph-t"><h2>Settings</h2><p>حساب، امنیت و ابزارهای مدیریتی</p></div></div>' +
    tabsBar("set", [["general", "عمومی"], ["account", "حساب"], ["data", "داده"], ["system", "سیستم"]].concat(S.isAdmin ? [["admin", "Admin"]] : []));

  if (tab === "account") {
    const me = await api("/me");
    return head + card({
      title: "حساب کاربری", icon: "◉",
      body: '<div class="profcard mb16">' + avatarHtml(58) +
        '<div class="sp"><div class="pn">' + h(userLabel()) + "</div>" +
        (me.username ? '<div class="pu">@' + h(me.username) + "</div>" : "") +
        '<div class="mt8">' + (me.isAdmin ? bdg("admin", "acc") : bdg("user", "mut")) + " " + bdg(me.via, "mut") + "</div>" +
        "</div></div>" +
        kv("User ID", '<span class="mono">' + h(me.userId) + "</span>") +
        kv("نام", h([me.firstName, me.lastName].filter(Boolean).join(" ") || me.name || "—")) +
        kv("Username", me.username ? "@" + h(me.username) : "—") +
        kv("Session Token", '<span class="mono">' + (S.token ? h(S.token.slice(0, 8)) + "…" : "—") + "</span>"),
      foot: '<div class="sp"></div><button class="btn dan"' + act("logout") + ">خروج و پاک کردن Session</button>"
    }) +
      card({
        title: "امنیت", icon: "🔒", cls: "mt12",
        body: note("کلیدهای API هرگز در Mini App نمایش داده نمیشوند. احراز هویت با امضای Telegram initData انجام میشود و توکن نشست ۱۲ ساعت اعتبار دارد.")
      }) +
      card({
        title: "تاریخچه چت", icon: "💬", cls: "mt12",
        body: kv("مدیریت گفتگوها", '<button class="btn sm"' + act("go", "chat") + ">باز کردن Chat</button>") +
          kv("حذف گفتگوهای خالی", '<button class="btn sm gho"' + act("pruneChats") + ">پاکسازی</button>") +
          kv("حذف کل تاریخچه", '<button class="btn sm dan"' + act("wipeChats") + ">حذف همه</button>") +
          note("تاریخچه چت از داخل ربات هم با دستور <code>/chats</code> قابل مشاهده، تغییر نام و حذف است.")
      });
  }
  if (tab === "data") {
    return head + card({
      title: "Export / Import", icon: "⬇", sub: S.isAdmin ? "" : "فقط ادمین",
      body: kv("Export کامل پلتفرم", '<button class="btn sm"' + act("platformExport") + (S.isAdmin ? "" : " disabled") + ">⬇ دانلود</button>") +
        kv("Import از فایل", '<button class="btn sm"' + act("platformImport") + (S.isAdmin ? "" : " disabled") + ">⬆ آپلود</button>") +
        note("کلیدهای API هرگز export نمیشوند.", "warn")
    }) +
      card({
        title: "Cache", icon: "⚡", cls: "mt12",
        body: '<div id="cacheStatsBox">' + loading("خواندن آمار cache…") + "</div>",
        foot: '<div class="sp"></div><button class="btn gho"' + act("clearCache") + ">پاک کردن Cache</button>"
      }) +
      card({
        title: "UI Cache", icon: "◌", cls: "mt12",
        body: kv("دادههای موقت رابط", '<button class="btn sm gho" onclick="bust();toast(\'پاک شد\',\'ok\');render()">پاکسازی</button>')
      });
  }
  if (tab === "system") {
    const meta = S.meta || {};
    return head + card({
      title: "System Info", icon: "◍",
      body: kv("API Formats", (Object.keys(meta.formats || {})).map(function (k) { return bdg(k, "mut"); }).join(" ")) +
        kv("Auth Methods", (Object.keys(meta.auths || {})).map(function (k) { return bdg(k, "mut"); }).join(" ")) +
        kv("Capabilities", n((meta.capabilities || []).length)) +
        kv("Test Suite", n(Object.keys(meta.tests || {}).length) + " تست") +
        kv("Benchmark Tasks", n(Object.keys(meta.benchTasks || {}).length)) +
        kv("Policies", (Object.keys(meta.policies || {})).map(function (k) { return bdg(k, "mut"); }).join(" ")) +
        kv("LB Strategies", (meta.strategies || []).map(function (k) { return bdg(k, "mut"); }).join(" ")) +
        kv("Node Types", n(Object.keys(meta.nodeTypes || {}).length)) +
        kv("Builtin Agents", n((meta.builtinAgents || []).length))
    }) +
      card({
        title: "CLI & SDK", icon: "⌘", cls: "mt12",
        body: kv("CLI Spec", '<button class="btn sm gho"' + act("showSpec", "/cli/spec") + ">مشاهده</button>") +
          kv("SDK — TypeScript", '<button class="btn sm gho"' + act("showSdk", "typescript") + ">مشاهده</button>") +
          kv("SDK — Python", '<button class="btn sm gho"' + act("showSdk", "python") + ">مشاهده</button>")
      }) +
      card({
        title: "Capabilities", icon: "◈", cls: "mt12",
        body: '<div class="chips">' + (meta.capabilities || []).map(function (c) { return '<span class="chip">' + h(c) + "</span>"; }).join("") + "</div>"
      });
  }
  if (tab === "admin") {
    return head + card({
      title: "Audit Log", icon: "▤",
      body: '<div id="auditBox">' + loading() + "</div>",
      foot: '<div class="sp"></div><button class="btn gho"' + act("auditStats") + ">آمار</button>" +
        '<button class="btn gho"' + act("auditSearch") + ">جستجو</button>"
    }) +
      card({
        title: "Tenants", icon: "◰", cls: "mt12",
        body: kv("مدیریت Tenant", '<button class="btn sm gho"' + act("go", "tenants") + ">باز کردن</button>") +
          kv("Plugins", '<button class="btn sm gho"' + act("pluginList") + ">مشاهده</button>")
      });
  }

  const cfg = await api("/routing").catch(function () { return {}; });
  return head + card({
    title: "پیکربندی AI", icon: "◎",
    body: kv("Routing Policy", bdg(cfg.policy || "—", "acc")) +
      kv("LB Strategy", bdg(cfg.strategy || "—", "mut")) +
      kv("Response Cache", cfg.enableCache !== false ? bdg("فعال", "ok") : bdg("خاموش", "mut")) +
      kv("Monthly Budget", cfg.monthlyBudget ? usd(cfg.monthlyBudget) : "بدون سقف") +
      kv("Max Fallbacks", n(cfg.maxFallbacks)),
    foot: '<div class="sp"></div><button class="btn"' + act("go", "routing") + ">ویرایش Routing</button>"
  }) +
    card({
      title: "دسترسی سریع", icon: "⚡", cls: "mt12",
      body: '<div class="g g2 tight">' +
        [["providers", "▣ Providers"], ["models", "◆ Models"], ["agents", "◈ Agents"], ["memory", "◫ Memory"],
        ["knowledge", "▤ Knowledge"], ["automation", "◷ Automation"], ["monitor", "◍ Monitoring"], ["costs", "$ Costs"],
        ["eval", "◎ Evaluation"], ["alerts", "◔ Alerts"], ["approvals", "✓ Approvals"], ["tools", "⚒ Tools"]].map(function (x) {
          return '<button class="btn gho" style="justify-content:flex-start"' + act("go", x[0]) + ">" + h(x[1]) + "</button>";
        }).join("") + "</div>"
    });
}
window.AFTER.settings = async function () {
  const cb = document.getElementById("cacheStatsBox");
  if (cb) {
    try {
      const s = await api("/cache/stats");
      cb.innerHTML = s && !s.error ? kv("Total Entries", n(s.totalEntries)) + kv("Valid", n(s.validEntries)) +
        kv("Expired", n(s.expiredEntries)) + kv("Hits", n(s.totalHits)) + kv("Hit Rate", pct(s.hitRate)) +
        kv("Avg TTL", ms((s.avgTTL || 0) * 1000)) : '<div class="tiny">آماری موجود نیست</div>';
    } catch (e) { cb.innerHTML = '<div class="tiny">آماری موجود نیست</div>'; }
  }
  const ab = document.getElementById("auditBox");
  if (ab) {
    try {
      const logs = await api("/audit?days=7&limit=40");
      ab.innerHTML = lst((logs || []).map(function (l) {
        return li({
          title: bdg(l.action, "acc") + " " + (l.result === "ok" ? bdg("ok", "ok") : bdg(String(l.result || "?"), "warn")),
          sub: h(l.resource || "") + " · user " + h(l.userId) + " · " + rel(l.ts)
        });
      }), { title: "لاگی نیست" });
    } catch (e) { ab.innerHTML = errBox(e); }
  }
};
window.logout = function () {
  confirmSheet("خروج؟", "Session پاک میشود و باید Mini App را دوباره باز کنید.", function () {
    try { localStorage.removeItem("pimx_token"); } catch (e) { }
    location.reload();
  });
};
window.platformExport = async function () {
  toast("در حال export…");
  try {
    const d = await api("/platform/export", { body: {}, long: true });
    sheet({ title: "Platform Export", cls: "wide", body: codeBox(JSON.stringify(d, null, 2), "pexp") });
  } catch (e) { toast(e.message, "err"); }
};
window.platformImport = function () {
  editSheet({
    title: "Platform Import", cls: "wide",
    fields: [
      { k: "json", l: "JSON", t: "code", rows: 12, req: true },
      { k: "overwrite", l: "بازنویسی موارد موجود", t: "switch", v: false }
    ],
    okText: "⬆ Import",
    onSave: async function (v) {
      let data;
      try { data = JSON.parse(v.json); } catch (e) { throw new Error("JSON نامعتبر"); }
      const r = await api("/platform/import", { body: { data: data, mergeStrategy: v.overwrite ? "overwrite" : "skip" }, long: true });
      closeSheet(); bust(); toast("Import انجام شد", "ok");
      sheet({ title: "نتیجه Import", body: codeBox(JSON.stringify(r, null, 2), "pimp") });
    }
  });
};
window.showSpec = async function (path) {
  try { const s = await api(path); sheet({ title: "Spec", cls: "wide", body: codeBox(JSON.stringify(s, null, 2), "spec") }); }
  catch (e) { toast(e.message, "err"); }
};
window.showSdk = async function (lang) {
  try {
    const res = await fetch("/api/sdk/" + lang, { headers: S.token ? { Authorization: "Bearer " + S.token } : {} });
    const t = await res.text();
    sheet({ title: "SDK — " + lang, cls: "wide", body: codeBox(t, "sdk") });
  } catch (e) { toast(e.message, "err"); }
};
window.auditStats = async function () {
  try {
    const s = await api("/audit/stats?days=30");
    sheet({
      title: "Audit Stats", cls: "wide",
      body: kv("Total Events", n(s.total)) +
        '<h4 class="mt16 mb8">Top Actions</h4>' + (s.topActions || []).map(function (a) { return bar(a.action, a.count, (s.topActions[0] || {}).count || 1); }).join("") +
        '<h4 class="mt16 mb8">Top Users</h4>' + (s.topUsers || []).map(function (u) { return bar(String(u.userId), u.count, (s.topUsers[0] || {}).count || 1); }).join("")
    });
  } catch (e) { toast(e.message, "err"); }
};
window.auditSearch = function () {
  editSheet({
    title: "جستجو در Audit", cls: "wide",
    fields: [{ k: "query", l: "عبارت", req: true }, { k: "limit", l: "تعداد", t: "num", v: 50 }],
    okText: "◍ جستجو",
    onSave: async function (v) {
      sheetBody(loading());
      const r = await api("/audit/search", { body: v });
      sheetBody(lst((r || []).map(function (l) {
        return li({ title: bdg(l.action, "acc") + " " + bdg(l.classification || "low", "mut"), sub: h(l.resource || "") + " · " + rel(l.datetime || l.timestamp) });
      }), { title: "نتیجهای نیست" }));
    }
  });
};
window.pluginList = async function () {
  try {
    const list = await api("/plugins");
    sheet({
      title: "Plugins", cls: "wide",
      body: lst((list || []).map(function (p) {
        return li({
          icon: "◧", title: h(p.name) + " " + bdg(p.type, "acc") + " " + (p.enabled ? bdg("enabled", "ok") : bdg("disabled", "mut")),
          sub: rel(p.createdAt),
          actions: '<button class="btn sm gho"' + act("pluginToggle", p.id, String(!p.enabled)) + ">" + (p.enabled ? "⏸" : "▶") + "</button>"
        });
      }), { icon: "◧", title: "Plugin نصب نشده" })
    });
  } catch (e) { toast(e.message, "err"); }
};
window.pluginToggle = async function (id, en) {
  try { await api("/plugins/" + id + "/" + (en === "true" ? "enable" : "disable"), { body: {} }); toast("انجام شد", "ok"); closeSheet(); pluginList(); }
  catch (e) { toast(e.message, "err"); }
};

/* ═══════════ TENANTS (admin) ═══════════ */
async function viewTenants() {
  let list = [];
  try { list = await api("/tenants?limit=100"); } catch (e) { return '<div class="ph"><h2>Tenants</h2></div>' + errBox(e); }
  return '<div class="ph"><div class="ph-t"><h2>Tenants</h2><p>سازمانها و اعضا</p></div>' +
    '<div class="ph-a"><button class="btn sm gho"' + act("tenantPlans") + ">Plans</button>" +
    '<button class="btn pri sm"' + act("tenantNew") + ">＋ Tenant</button></div></div>" +
    lst((list || []).map(function (t) {
      return li({
        icon: "◰", onclick: act("tenantOpen", t.id),
        title: h(t.name) + " " + bdg(t.plan, "acc") + " " + statusBdg(t.status),
        sub: '<span class="mono tny">' + h(t.slug) + "</span> · " + n((t.usage || {}).users) + "/" + n((t.quotas || {}).maxUsers) + " users · " +
          n((t.usage || {}).models) + " models",
        actions: '<button class="btn sm dan"' + act("delEntity", "Tenant", "/tenants/" + t.id) + ">🗑</button>", chev: true
      });
    }), { icon: "◰", title: "Tenant نداری", btn: { t: "＋ ساخت Tenant", on: act("tenantNew") } });
}
window.tenantNew = function () {
  editSheet({
    title: "ساخت Tenant",
    fields: [{ k: "name", l: "نام", req: true }, { k: "slug", l: "Slug", req: true, ltr: true, hint: "یکتا، بدون فاصله" }],
    onSave: async function (v) { await doAct(function () { return api("/tenants", { body: v }); }, "ساخته شد"); }
  });
};
window.tenantOpen = async function (id) {
  try {
    const t = await api("/tenants/" + id);
    let st = null, members = [];
    try { st = await api("/tenants/" + id + "/stats"); } catch (e) { }
    try { members = await api("/tenants/" + id + "/members"); } catch (e) { }
    sheet({
      title: t.name, sub: t.slug, cls: "wide",
      body: kv("Plan", bdg(t.plan, "acc")) + kv("Status", statusBdg(t.status)) + kv("Owner", h(t.ownerId)) +
        (st ? '<h4 class="mt16 mb8">Utilization</h4>' + Object.keys(st.utilization || {}).map(function (k) { return bar(k, st.utilization[k], 100, pct(st.utilization[k])); }).join("") : "") +
        '<h4 class="mt16 mb8">Members (' + n((members || []).length) + ")</h4>" +
        ((members || []).map(function (m) {
          return li({ icon: "◉", title: h(m.userId) + " " + bdg(m.role, "acc"), sub: rel(m.joinedAt), actions: '<button class="btn sm dan"' + act("tenantRemoveMember", id, String(m.userId)) + ">🗑</button>" });
        }).join("") || '<div class="tiny">عضوی نیست</div>'),
      foot: '<button class="btn gho" onclick="closeSheet()">بستن</button>' +
        '<button class="btn"' + act("tenantAddMember", id) + ">＋ عضو</button>"
    });
  } catch (e) { toast(e.message, "err"); }
};
window.tenantAddMember = function (id) {
  closeSheet();
  editSheet({
    title: "افزودن عضو",
    fields: [
      { k: "userId", l: "User ID", req: true, ltr: true },
      { k: "role", l: "Role", t: "seg", v: "member", opts: [["viewer", "Viewer"], ["member", "Member"], ["admin", "Admin"], ["owner", "Owner"]] }
    ],
    onSave: async function (v) { await doAct(function () { return api("/tenants/" + id + "/members", { body: v }); }, "اضافه شد"); }
  });
};
window.tenantRemoveMember = async function (tid, uid) {
  await doAct(function () { return api("/tenants/" + tid + "/members/" + uid, { method: "DELETE" }); }, "حذف شد");
};
window.tenantPlans = async function () {
  try {
    const p = await api("/tenants/plans");
    const lim = function (v) { return v === null || v === undefined ? "∞" : n(v); };
    sheet({
      title: "Plans", cls: "wide",
      body: dataView({
        rows: Object.keys(p.plans || {}).map(function (k) { return p.plans[k]; }),
        empty: { title: "Plan نیست" },
        cols: [{ t: "Plan" }, { t: "Users", align: "num" }, { t: "Projects", align: "num" }, { t: "Models", align: "num" }, { t: "Storage", align: "num" }],
        tr: function (x) {
          return tr(["<b>" + h(x.name) + "</b>", { v: lim(x.maxUsers), align: "num" }, { v: lim(x.maxProjects), align: "num" },
          { v: lim(x.maxModels), align: "num" }, { v: lim(x.storageGB) + " GB", align: "num" }]);
        },
        li: function (x) {
          return li({
            icon: "◰", title: "<b>" + h(x.name) + "</b>",
            sub: lim(x.maxUsers) + " users · " + lim(x.maxProjects) + " projects · " + lim(x.maxModels) + " models · " + lim(x.storageGB) + " GB"
          });
        }
      })
    });
  } catch (e) { toast(e.message, "err"); }
};
`;
