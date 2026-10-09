export const VIEWS_AGENTS = String.raw`
/* ═══════════ AGENTS ═══════════ */
async function viewAgents() {
  const agents = await api("/agents");
  const builtins = agents.filter(function (a) { return a.builtin; });
  const custom = agents.filter(function (a) { return !a.builtin; });

  return '<div class="ph"><div class="ph-t"><h2>Agents</h2><p>' + n(custom.length) + " custom · " + n(builtins.length) + " builtin</p></div>" +
    '<div class="ph-a"><button class="btn sm gho"' + act("go", "runs") + ">◷ Runs</button>" +
    '<button class="btn pri sm"' + act("agentNew") + pxText(">＋ ساخت Agent</button></div></div>") +
    card({
      title: "Custom Agents", sub: pxText("ساخته شده توسط شما"), flat: true, icon: "◈",
      body: lst(custom.map(agentRow), { icon: "◈", title: pxText("Agent سفارشی نداری"), sub: pxText("میتوانید یک builtin را کپی و ویرایش کنید"), btn: { t: pxText("＋ ساخت Agent"), on: act("agentNew") } })
    }) +
    card({
      title: "Built-in Agents", sub: pxText("آماده استفاده — برای ویرایش کپی بگیرید"), flat: true, icon: "◇", cls: "mt12",
      body: lst(builtins.map(agentRow))
    });
}
function agentRow(a) {
  return li({
    icon: a.builtin ? "◇" : "◈",
    onclick: act("go", "agent", a.id),
    title: h(a.name) + " " + (a.builtin ? bdg("builtin", "mut") : bdg(a.task || "chat", "acc")) +
      (a.enabled === false ? " " + bdg("disabled", "err") : ""),
    sub: h(short(a.description, 70)) + "<br>" +
      '<span class="tny">' + n((a.tools || []).length) + " tools · maxSteps " + n(a.maxSteps) +
      (a.memory ? " · memory" : "") + (a.knowledge ? " · knowledge" : "") +
      (a.runs ? " · " + n(a.runs) + " runs" : "") + "</span>",
    actions: '<button class="btn sm pri"' + act("agentRun", a.id, a.name) + ">▶</button>" +
      '<button class="btn sm gho"' + act("agentDup", a.id) + ">⧉</button>",
    chev: true
  });
}

async function viewAgent() {
  const id = S.params.id;
  const a = await api("/agents/" + id);
  const tools = await cached("tools", function () { return api("/tools").catch(function () { return []; }); });
  const head = '<div class="ph"><div class="ph-t">' +
    '<button class="btn sm gho mb8"' + act("go", "agents") + ">‹ Agents</button>" +
    "<h2>" + h(a.name) + " " + (a.builtin ? bdg("builtin", "mut") : "") + "</h2>" +
    "<p>" + h(a.description || "") + "</p></div>" +
    '<div class="ph-a"><button class="btn pri sm"' + act("agentRun", id, a.name) + pxText(">▶ اجرا</button>") +
    '<button class="btn sm gho"' + act("agentDup", id) + pxText(">⧉ کپی</button>") +
    (a.builtin ? "" : '<button class="btn sm gho"' + act("agentEdit", id) + pxText(">✎ ویرایش</button>") +
      '<button class="btn sm dan"' + act("delEntity", "Agent", "/agents/" + id, "agents") + ">🗑</button>") +
    "</div></div>";

  return head + '<div class="side-by">' +
    card({
      title: pxText("تنظیمات"), icon: "⚙",
      body: kv("Task", bdg(a.task || "chat", "acc")) +
        kv("Max Steps", n(a.maxSteps)) +
        kv("Memory", a.memory ? bdg("on", "ok") : bdg("off", "mut")) +
        kv("Knowledge (RAG)", a.knowledge ? bdg("on", "ok") : bdg("off", "mut")) +
        kv("Budget", a.budget ? usd(a.budget) : pxText("بدون سقف")) +
        kv("Enabled", a.enabled === false ? bdg("no", "err") : bdg("yes", "ok")) +
        (a.runs !== undefined ? kv("Total Runs", n(a.runs)) : "") +
        ((a.permissions || []).length ? kv("Permissions", (a.permissions || []).map(function (p) { return bdg(p, "mut"); }).join(" ")) : "") +
        ((a.preferredModels || []).length ? kv("Preferred Models", n(a.preferredModels.length) + pxText(" مدل")) : "")
    }) +
    card({
      title: "Tools", sub: n((a.tools || []).length) + pxText(" ابزار فعال"), icon: "⚒",
      body: (a.tools || []).length ? '<div class="chips">' + a.tools.map(function (t) {
        const info = (tools || []).filter(function (x) { return x.name === t; })[0];
        return '<span class="chip' + (info && info.dangerous ? " on" : "") + '">' + h(t) +
          (info ? ' <span class="tny">' + h(info.riskLevel) + "</span>" : "") + "</span>";
      }).join("") + "</div>" : pxText('<div class="tiny">ابزاری فعال نیست</div>')
    }) + "</div>" +
    card({
      title: "System Prompt", icon: "◫", cls: "mt12",
      body: a.systemPrompt ? codeBox(a.systemPrompt, "asp") : pxText('<div class="tiny">تعیین نشده</div>')
    });
}

async function agentFields(a) {
  a = a || {};
  const tools = await cached("tools", function () { return api("/tools").catch(function () { return []; }); });
  const sel = a.tools || [];
  return [
    { k: "name", l: pxText("نام"), req: true, v: a.name },
    { k: "description", l: pxText("توضیح"), t: "area", rows: 2, v: a.description },
    { k: "systemPrompt", l: "System Prompt", t: "area", rows: 5, v: a.systemPrompt, hint: pxText("نقش و دستورات پایه Agent") },
    { t: "hr" },
    { k: "task", l: "Task", v: a.task || "chat", hint: "chat, coding, research, …" },
    { t: "rowStart" },
    { k: "maxSteps", l: "Max Steps", t: "num", v: a.maxSteps || 6, min: 1, max: 20 },
    { k: "budget", l: "Budget (USD)", t: "num", step: 0.01, v: a.budget || 0 },
    { t: "rowEnd" },
    { k: "tools", l: "Tools", t: "csv", v: sel.join(", "), hint: pxText("موجود: ") + (tools || []).map(function (t) { return t.name; }).slice(0, 14).join(", ") },
    { t: "hr" },
    { k: "memory", l: "Memory", t: "switch", v: a.memory !== false, hint: pxText("دسترسی به حافظه بلندمدت کاربر") },
    { k: "knowledge", l: "Knowledge (RAG)", t: "switch", v: a.knowledge !== false, hint: pxText("جستجو در اسناد ذخیرهشده") },
    { k: "enabled", l: pxText("فعال"), t: "switch", v: a.enabled !== false }
  ];
}
window.agentNew = async function () {
  const fields = await agentFields({});
  editSheet({
    title: pxText("ساخت Agent"), fields: fields, okText: pxText("ساخت"),
    onSave: async function (v) { await doAct(function () { return api("/agents", { body: v }); }, pxText("Agent ساخته شد"), { bust: "" }); }
  });
};
window.agentEdit = async function (id) {
  const a = await api("/agents/" + id);
  const fields = await agentFields(a);
  editSheet({
    title: pxText("ویرایش Agent"), sub: a.name, fields: fields,
    onSave: async function (v) { await doAct(function () { return api("/agents/" + id, { method: "PATCH", body: v }); }, pxText("ذخیره شد")); }
  });
};
window.agentDup = async function (id) {
  await doAct(function () { return api("/agents/" + id + "/duplicate", { body: {} }); }, pxText("کپی ساخته شد"));
};
window.agentRun = function (id, name) {
  editSheet({
    title: pxText("اجرای ") + name, cls: "wide",
    fields: [
      { k: "goal", l: pxText("هدف"), t: "area", rows: 4, req: true, ph: pxText("چه کاری باید انجام شود؟") },
      { k: "context", l: pxText("Context اضافه"), t: "area", rows: 2 },
      { k: "confirmDangerous", l: pxText("اجازه ابزارهای خطرناک"), t: "switch", v: false, hint: pxText("http_request, d1_query و مشابه") }
    ],
    okText: pxText("▶ اجرا"),
    onSave: async function (v) {
      sheetBody(loading(pxText("Agent در حال کار است… ممکن است چند دقیقه طول بکشد")));
      const r = await api("/agents/" + id + "/run", { body: v, long: true, timeout: 300000 });
      bust();
      sheetBody(runDetail(r));
    }
  });
};
function runDetail(r) {
  return '<div class="row wrap gap4 mb12">' +
    (r.model ? bdg(tail(r.displayName || r.model), "mono") : "") +
    bdg(ms(r.latency)) + bdg(usd(r.cost), "acc") + bdg(n(r.tokens) + " tok") +
    bdg(n((r.toolCalls || []).length) + " tool calls") + "</div>" +
    '<div class="bub" style="border:1px solid var(--line);background:var(--bg2)">' + md(r.answer || "") + "</div>" +
    ((r.plan && (r.plan.steps || []).length) ? '<h4 class="mt16 mb8">Plan</h4>' + r.plan.steps.map(function (s, i) {
      return '<div class="node"><span class="node-n">' + (i + 1) + '</span><div class="sp"><div style="font-size:12.5px;font-weight:600">' + h(s.title) + "</div>" +
        '<div class="tny">' + h(s.why || "") + (s.tool ? " · " + h(s.tool) : "") + "</div></div></div>";
    }).join("") : "") +
    ((r.steps || []).length ? '<h4 class="mt16 mb8">Timeline</h4><div class="steps">' + r.steps.map(function (s) {
      return '<div class="step ' + (s.status === "done" ? "done" : s.status === "fail" ? "fail" : "run") + '">' +
        '<i class="step-i">' + (s.status === "done" ? "✓" : s.status === "fail" ? "✕" : "•") + "</i>" +
        '<div class="sp"><div class="step-t">' + h(s.label) + "</div>" +
        (s.detail ? '<div class="step-d">' + h(short(s.detail, 160)) + "</div>" : "") + "</div></div>";
    }).join("") + "</div>" : "") +
    ((r.toolCalls || []).length ? '<h4 class="mt16 mb8">Tool Calls</h4>' + r.toolCalls.map(function (t) {
      return kv(t.tool, (t.ok ? bdg("ok", "ok") : bdg("fail", "err")) + ' <span class="tny mono">' + ms(t.ms) + "</span>");
    }).join("") : "") +
    ((r.sources || []).length ? '<h4 class="mt16 mb8">Sources</h4>' + r.sources.map(function (s) {
      return '<div class="tiny">• ' + h(short(s.title, 60)) + "</div>";
    }).join("") : "");
}
window.runDetail = runDetail;

async function viewRuns() {
  const runs = await api("/agents/runs?limit=40");
  return '<div class="ph"><div class="ph-t"><h2>Agent Runs</h2><p>' + n((runs || []).length) + pxText(" اجرا</p></div>") +
    '<div class="ph-a"><button class="btn sm gho"' + act("go", "agents") + ">‹ Agents</button></div></div>" +
    '<div class="card">' + dataView({
      rows: runs || [],
      empty: { icon: "◷", title: pxText("اجرایی ثبت نشده") },
      cols: [{ t: "Agent" }, { t: "Goal" }, { t: "Status" }, { t: "Model" }, { t: "Cost", align: "num" }, { t: pxText("زمان") }],
      tr: function (r) {
        return tr([
          "<b>" + h(r.agentName || "—") + "</b>",
          '<span class="tiny">' + h(short(r.goal, 44)) + "</span>",
          statusBdg(r.status),
          '<span class="tny mono">' + h(tail(r.model || "—")) + "</span>",
          { v: '<span class="mono tiny">' + usd(r.cost) + "</span>", align: "num" },
          '<span class="tny">' + rel(r.startedAt) + "</span>"
        ], { onclick: act("go", "run", r.id) });
      },
      li: function (r) {
        return li({
          onclick: act("go", "run", r.id), icon: "◷",
          title: h(r.agentName || "—") + " " + statusBdg(r.status),
          sub: h(short(r.goal, 60)) + '<br><span class="tny">' + h(tail(r.model || "—")) + " · " + usd(r.cost) + " · " + rel(r.startedAt) + "</span>",
          chev: true
        });
      }
    }) + "</div>";
}
async function viewRun() {
  const r = await api("/agents/runs/" + S.params.id);
  return '<div class="ph"><div class="ph-t">' +
    '<button class="btn sm gho mb8"' + act("go", "runs") + ">‹ Runs</button>" +
    "<h2>" + h(r.agentName || "Run") + " " + statusBdg(r.status) + "</h2>" +
    "<p>" + h(short(r.goal, 100)) + " · " + rel(r.startedAt) + "</p></div></div>" +
    card({ title: pxText("نتیجه"), icon: "◎", body: runDetail(r) }) +
    (r.error ? '<div class="mt12">' + note(h(r.error), "err") + "</div>" : "");
}

/* ═══════════ TOOLS ═══════════ */
async function viewTools() {
  const tab = curTab("tools", "tools");
  const head = pxText('<div class="ph"><div class="ph-t"><h2>Tools & MCP</h2><p>ابزارهایی که Agentها میتوانند صدا بزنند</p></div></div>') +
    tabsBar("tools", [["tools", "Tools"], ["mcp", "MCP Servers"], ["run", pxText("اجرای دستی")]]);

  if (tab === "mcp") {
    const servers = await api("/mcp");
    return head + card({
      title: "MCP Servers", sub: "Model Context Protocol", flat: true, icon: "⇄",
      actions: (S.isAdmin ? '<button class="btn sm pri"' + act("mcpNew") + ">＋ Server</button>" : "") +
        '<button class="btn sm gho"' + act("mcpSync") + ">↻ Sync</button>",
      body: lst((servers || []).map(function (s) {
        return li({
          icon: "⇄",
          title: h(s.name) + " " + (s.enabled ? bdg("enabled", "ok") : bdg("disabled", "mut")),
          sub: '<span class="mono ltr">' + h(short(s.url, 44)) + "</span> · " + (s.hasKey ? pxText("با کلید") : pxText("بدون کلید")),
          actions: S.isAdmin ? '<button class="btn sm dan"' + act("delEntity", "MCP Server", "/mcp/" + s.id) + ">🗑</button>" : ""
        });
      }), { icon: "⇄", title: pxText("MCP Server ثبت نشده"), sub: pxText("با MCP میتوانید ابزارهای بیرونی را به Agentها وصل کنید") })
    });
  }
  if (tab === "run") {
    const tools = await cached("tools", function () { return api("/tools"); });
    return head + card({
      title: pxText("اجرای دستی ابزار"), icon: "▶",
      body: '<div class="fld"><label>Tool</label><select id="trTool">' +
        (tools || []).map(function (t) { return '<option value="' + h(t.name) + '">' + h(t.name) + " · " + h(t.riskLevel) + "</option>"; }).join("") + "</select></div>" +
        '<div class="fld"><label>Arguments (JSON)</label><textarea id="trArgs" class="code" rows="5">{}</textarea></div>' +
        pxText('<div class="fld"><label class="swt"><div><div class="sl">تأیید ابزار خطرناک</div></div><input type="checkbox" id="trOk"><span class="swt-b"></span></label></div>'),
      foot: '<div class="sp"></div><button class="btn pri"' + act("runToolManual") + pxText(">▶ اجرا</button>")
    }) + '<div class="mt12" id="trOut"></div>';
  }

  const tools = await cached("tools", function () { return api("/tools"); });
  const byRisk = {};
  (tools || []).forEach(function (t) { const r = t.riskLevel || "safe"; (byRisk[r] = byRisk[r] || []).push(t); });
  const order = ["safe", "low", "medium", "high", "critical"];
  return head + order.filter(function (r) { return byRisk[r]; }).map(function (r) {
    return card({
      title: r.toUpperCase() + " risk", sub: n(byRisk[r].length) + pxText(" ابزار"), flat: true, cls: "mt12",
      icon: r === "safe" ? "✓" : r === "critical" ? "⚠" : "◆",
      body: lst(byRisk[r].map(function (t) {
        return li({
          icon: "⚒",
          onclick: act("toolInfo", t.name),
          title: '<span class="mono">' + h(t.name) + "</span> " +
            (t.dangerous ? bdg("dangerous", "err") : "") + (t.requiresApproval ? bdg("approval", "warn") : "") +
            (t.source && t.source !== "builtin" ? bdg(t.source, "acc") : ""),
          sub: h(short(t.description, 80)),
          chev: true
        });
      }))
    });
  }).join("");
}
window.toolInfo = async function (name) {
  try {
    const t = await api("/tools/" + encodeURIComponent(name));
    const sec = t.security || {};
    sheet({
      title: name, sub: t.riskLevel + " risk", cls: "wide",
      body: '<div class="tiny mb12">' + h(t.description) + "</div>" +
        kv("Risk Level", bdg(t.riskLevel, t.riskLevel === "safe" ? "ok" : t.riskLevel === "critical" ? "err" : "warn")) +
        kv("Requires Approval", t.requiresApproval ? bdg("yes", "warn") : bdg("no", "ok")) +
        kv("Rate Limit", n(t.maxExecutionsPerMinute) + " / min") +
        kv("Timeout", ms(t.timeout)) +
        kv("Source", bdg(t.source || "builtin", "mut")) +
        ((t.permissions || []).length ? kv("Permissions", t.permissions.map(function (p) { return bdg(p, "mut"); }).join(" ")) : "") +
        '<h4 class="mt16 mb8">Security Profile</h4>' +
        Object.keys(sec).map(function (k) {
          const v = sec[k];
          return kv(k, typeof v === "boolean" ? (v ? bdg("yes", "warn") : bdg("no", "ok")) : bdg(String(v), "mut"));
        }).join("") +
        (t.input ? '<h4 class="mt16 mb8">Input Schema</h4>' + codeBox(JSON.stringify(t.input, null, 2), "tin") : "")
    });
  } catch (e) { toast(e.message, "err"); }
};
window.runToolManual = async function () {
  const out = document.getElementById("trOut");
  out.innerHTML = loading();
  try {
    let args = {};
    try { args = JSON.parse((document.getElementById("trArgs") || {}).value || "{}"); }
    catch (e) { throw new Error(pxText("JSON نامعتبر است")); }
    const r = await api("/tools/run", {
      long: true,
      body: { tool: (document.getElementById("trTool") || {}).value, args: args, confirmed: !!(document.getElementById("trOk") || {}).checked }
    });
    out.innerHTML = card({
      title: pxText("نتیجه"), sub: ms(r.ms), icon: "◎",
      body: '<div class="row wrap gap4 mb12">' + bdg(r.tool, "mono") + bdg(ms(r.ms)) + bdg(r.riskLevel || "", "mut") + "</div>" +
        codeBox(JSON.stringify(r.result, null, 2), "trRes")
    });
  } catch (e) { out.innerHTML = errBox(e); }
};
window.mcpNew = function () {
  editSheet({
    title: pxText("افزودن MCP Server"),
    fields: [
      { k: "name", l: pxText("نام"), req: true },
      { k: "url", l: "URL", t: "url", req: true },
      { k: "apiKey", l: "API Key", t: "pass" },
      { k: "enabled", l: pxText("فعال"), t: "switch", v: true }
    ],
    onSave: async function (v) { await doAct(function () { return api("/mcp", { body: v }); }, pxText("اضافه شد")); }
  });
};
window.mcpSync = async function () {
  toast(pxText("در حال sync…"));
  try { const r = await api("/mcp/sync", { body: {}, long: true }); bust("tools"); toast(n(r.tools) + pxText(" ابزار از ") + n(r.servers) + pxText(" سرور"), "ok"); render(); }
  catch (e) { toast(e.message, "err"); }
};

/* ═══════════ MEMORY ═══════════ */
async function viewMemory() {
  const tab = curTab("memory", "list");
  const kinds = (S.meta && S.meta.memoryKinds) || ["fact", "preference", "project", "semantic", "skill", "relationship"];
  const head = pxText('<div class="ph"><div class="ph-t"><h2>Memory</h2><p>حافظه بلندمدت — Agentها از این اطلاعات استفاده میکنند</p></div>') +
    '<div class="ph-a"><button class="btn sm gho"' + act("memSearch") + pxText(">◍ جستجوی معنایی</button>") +
    '<button class="btn pri sm"' + act("memNew") + pxText(">＋ افزودن</button></div></div>") +
    tabsBar("memory", [["list", pxText("همه")], ["stats", "Stats"], ["graph", "Knowledge Graph"]]);

  if (tab === "stats") {
    const st = await api("/memory/scoped/stats?scope=user");
    return head + '<div class="g g4 mb16">' +
      stat({ label: "Total", value: n(st.total), icon: "◫" }) +
      stat({ label: "Embedded", value: n(st.embedded), sub: st.embeddedPercent + "%", icon: "◈" }) +
      stat({ label: "Total Hits", value: n(st.totalHits), sub: "avg " + st.avgHits, icon: "↗" }) +
      stat({ label: "Kinds", value: n(Object.keys(st.byKind || {}).length), icon: "◆" }) +
      "</div>" +
      '<div class="side-by">' +
      card({ title: "By Kind", icon: "◆", body: Object.keys(st.byKind || {}).map(function (k) { return bar(k, st.byKind[k], st.total); }).join("") || pxText('<div class="tiny">خالی</div>') }) +
      card({ title: "By Source", icon: "◇", body: Object.keys(st.bySource || {}).map(function (k) { return bar(k, st.bySource[k], st.total); }).join("") || pxText('<div class="tiny">خالی</div>') }) +
      "</div>";
  }
  if (tab === "graph") {
    const g = await api("/graph");
    return head + '<div class="g g2 mb12">' +
      stat({ label: "Nodes", value: n((g.nodes || []).length), icon: "○" }) +
      stat({ label: "Edges", value: n((g.edges || []).length), icon: "⇄" }) + "</div>" +
      card({
        title: "Relations", flat: true, icon: "⇄",
        actions: '<button class="btn sm pri"' + act("graphAdd") + ">＋ Relation</button>" +
          '<button class="btn sm dan"' + act("graphClear") + pxText(">پاک کردن</button>"),
        body: lst((g.edges || []).slice(0, 60).map(function (e) {
          const f = (g.nodes || []).filter(function (n2) { return n2.id === e.from; })[0] || {};
          const t = (g.nodes || []).filter(function (n2) { return n2.id === e.to; })[0] || {};
          return li({ icon: "⇄", title: h(f.name || e.from) + " → " + h(t.name || e.to), sub: bdg(e.relation, "acc") + " · " + rel(e.ts) });
        }), { icon: "⇄", title: pxText("رابطهای ثبت نشده") })
      });
  }

  const list = await api("/memory" + (S.query.kind ? "?kind=" + encodeURIComponent(S.query.kind) : ""));
  return head +
    '<div class="chips mb12"><span class="chip clk ' + (!S.query.kind ? "on" : "") + '"' + act("memFilter", "") + pxText(">همه</span>") +
    kinds.map(function (k) { return '<span class="chip clk ' + (S.query.kind === k ? "on" : "") + '"' + act("memFilter", k) + ">" + h(k) + "</span>"; }).join("") + "</div>" +
    card({
      title: "Memories", sub: n((list || []).length) + pxText(" مورد"), flat: true, icon: "◫",
      body: lst((list || []).map(function (m) {
        return li({
          icon: "◫",
          title: bdg(m.kind, "acc") + ' <span class="tny">' + rel(m.ts) + "</span>" + (m.hits ? ' <span class="tny">' + n(m.hits) + " hits</span>" : ""),
          sub: h(short(m.text, 130)),
          actions: '<button class="btn sm gho"' + act("memEdit", m.id, m.text) + ">✎</button>" +
            '<button class="btn sm dan"' + act("delEntity", "Memory", "/memory/" + m.id) + ">🗑</button>"
        });
      }), { icon: "◫", title: pxText("حافظهای ثبت نشده"), sub: pxText("اطلاعاتی که میخواهید مدل همیشه بداند را اینجا ذخیره کنید"), btn: { t: pxText("＋ افزودن"), on: act("memNew") } })
    });
}
window.memFilter = function (k) { go("memory", {}, k ? { kind: k } : {}); };
window.memNew = function () {
  const kinds = (S.meta && S.meta.memoryKinds) || ["fact", "preference", "project", "semantic", "skill", "relationship"];
  editSheet({
    title: pxText("افزودن Memory"),
    fields: [
      { k: "text", l: pxText("متن"), t: "area", rows: 4, req: true, ph: pxText("من از TypeScript استفاده میکنم و tab size = 2") },
      { k: "kind", l: "Kind", t: "select", v: "fact", opts: kinds },
      { k: "embed", l: pxText("ساخت Embedding"), t: "switch", v: true, hint: pxText("برای جستجوی معنایی لازم است") }
    ],
    onSave: async function (v) { await doAct(function () { return api("/memory", { body: v }); }, pxText("ذخیره شد")); }
  });
};
window.memEdit = function (id, text) {
  editSheet({
    title: pxText("ویرایش Memory"), cls: "narrow",
    fields: [{ k: "text", l: pxText("متن"), t: "area", rows: 4, req: true, v: text }],
    onSave: async function (v) { await doAct(function () { return api("/memory/" + id, { method: "PATCH", body: { text: v.text } }); }, pxText("ذخیره شد")); }
  });
};
window.memSearch = function () {
  editSheet({
    title: pxText("جستجوی معنایی"), cls: "narrow",
    fields: [{ k: "query", l: pxText("عبارت"), req: true }, { k: "topK", l: pxText("تعداد نتیجه"), t: "num", v: 8 }],
    okText: pxText("◍ جستجو"),
    onSave: async function (v) {
      sheetBody(loading());
      const r = await api("/memory/search", { body: v });
      sheetBody((r || []).length ? (r || []).map(function (m) {
        return li({ icon: "◫", title: bdg(m.kind, "acc") + ' <span class="mono tny">' + pct(m.score * 100) + "</span>", sub: h(short(m.text, 120)) });
      }).join("") : empty({ icon: "◍", title: pxText("نتیجهای یافت نشد") }));
    }
  });
};
window.graphAdd = function () {
  editSheet({
    title: pxText("افزودن Relation"),
    fields: [{ k: "from", l: pxText("از"), req: true }, { k: "relation", l: pxText("رابطه"), req: true, ph: "works_with" }, { k: "to", l: pxText("به"), req: true }],
    onSave: async function (v) { await doAct(function () { return api("/graph", { body: v }); }, pxText("اضافه شد")); }
  });
};
window.graphClear = function () {
  confirmSheet(pxText("پاک کردن Graph؟"), pxText("همه nodeها و edgeها حذف میشوند."), async function () {
    await doAct(function () { return api("/graph", { method: "DELETE" }); }, pxText("پاک شد"));
  });
};

/* ═══════════ KNOWLEDGE / RAG ═══════════ */
async function viewKnowledge() {
  const tab = curTab("kb", "docs");
  const head = pxText('<div class="ph"><div class="ph-t"><h2>Knowledge</h2><p>اسناد و پایگاه دانش برای RAG</p></div></div>') +
    tabsBar("kb", [["docs", "Documents"], ["kbs", "Knowledge Bases"], ["vectors", "Vector Indexes"]]);

  if (tab === "kbs") {
    let kbs = [];
    try { kbs = await api("/rag/knowledge-bases"); } catch (e) { return head + errBox(e); }
    return head + card({
      title: "Knowledge Bases", sub: n((kbs || []).length) + pxText(" مورد"), flat: true, icon: "◫",
      actions: '<button class="btn sm pri"' + act("kbNew") + pxText(">＋ ساخت KB</button>"),
      body: lst((kbs || []).map(function (k) {
        return li({
          icon: "◫", onclick: act("kbOpen", k.id),
          title: h(k.name),
          sub: h(short(k.description, 60)) + "<br><span class=\"tny\">" + n(k.documentCount) + " doc · " + n(k.chunkCount) + " chunk · " + h(k.embeddingModel) + "</span>",
          actions: '<button class="btn sm pri"' + act("kbQuery", k.id, k.name) + ">◍ Query</button>" +
            '<button class="btn sm gho"' + act("kbAddDoc", k.id) + ">＋ Doc</button>" +
            '<button class="btn sm dan"' + act("delEntity", "Knowledge Base", "/rag/knowledge-bases/" + k.id) + ">🗑</button>",
          chev: true
        });
      }), { icon: "◫", title: pxText("KB نداری"), sub: pxText("یک Knowledge Base بسازید و اسناد را برای جستجوی معنایی اضافه کنید"), btn: { t: pxText("＋ ساخت KB"), on: act("kbNew") } })
    });
  }
  if (tab === "vectors") {
    let idx = [];
    try { idx = await api("/vector/indexes"); } catch (e) { return head + errBox(e); }
    return head + card({
      title: "Vector Indexes", flat: true, icon: "◈",
      actions: '<button class="btn sm pri"' + act("vecNew") + ">＋ Index</button>",
      body: lst((idx || []).map(function (i) {
        return li({
          icon: "◈", title: h(i.name),
          sub: n(i.vectorCount) + " vectors · " + n(i.dimensions) + " dim · " + h(i.metric),
          actions: '<button class="btn sm gho"' + act("vecStats", i.id) + ">stats</button>" +
            '<button class="btn sm dan"' + act("delEntity", "Vector Index", "/vector/indexes/" + i.id) + ">🗑</button>"
        });
      }), { icon: "◈", title: pxText("Index نداری"), btn: { t: pxText("＋ ساخت Index"), on: act("vecNew") } })
    });
  }

  let docs = [];
  try { docs = await api("/documents?limit=100"); } catch (e) { docs = []; }
  let legacy = [];
  try { legacy = await api("/knowledge"); } catch (e) { legacy = []; }
  return head +
    card({
      title: "Documents", sub: n((docs || []).length) + pxText(" سند"), flat: true, icon: "▤",
      actions: '<button class="btn sm pri"' + act("docNew") + pxText(">＋ افزودن سند</button>"),
      body: lst((docs || []).map(function (d) {
        return li({
          icon: "▤", onclick: act("docOpen", d.id),
          title: h(short(d.filename, 40)) + " " + bdg(d.format, "mut") + (d.processed ? bdg("processed", "ok") : bdg("pending", "warn")),
          sub: bytes(d.size) + (d.wordCount ? " · " + n(d.wordCount) + " words" : "") + " · " + rel(d.uploadedAt),
          actions: (d.processed ? '<button class="btn sm gho"' + act("docAnalyze", d.id) + ">◍</button>" : '<button class="btn sm pri"' + act("docProcess", d.id) + ">process</button>") +
            '<button class="btn sm dan"' + act("delEntity", "Document", "/documents/" + d.id) + ">🗑</button>",
          chev: true
        });
      }), { icon: "▤", title: pxText("سندی آپلود نشده"), sub: pxText("متن سند را وارد کنید تا برای جستجو پردازش شود"), btn: { t: pxText("＋ افزودن سند"), on: act("docNew") } })
    }) +
    ((legacy || []).length ? card({
      title: "Legacy Knowledge", sub: pxText("اسناد ثبتشده از ربات"), flat: true, cls: "mt12", icon: "◇",
      actions: '<button class="btn sm gho"' + act("kbLegacySearch") + pxText(">◍ جستجو</button>"),
      body: lst(legacy.map(function (d) {
        return li({ icon: "◇", title: h(d.name), sub: n(d.chunks) + " chunk · " + rel(d.ts) });
      }))
    }) : "");
}
window.docNew = function () {
  editSheet({
    title: pxText("افزودن سند"), cls: "wide",
    fields: [
      { k: "filename", l: pxText("نام فایل"), req: true, ph: "notes.md" },
      { k: "mimeType", l: "MIME Type", t: "select", v: "text/markdown", opts: [["text/markdown", "Markdown"], ["text/plain", "Text"], ["text/html", "HTML"], ["application/json", "JSON"], ["application/xml", "XML"]] },
      { k: "content", l: pxText("محتوا"), t: "code", rows: 10, req: true }
    ],
    okText: pxText("آپلود و پردازش"),
    onSave: async function (v) {
      const d = await api("/documents", { body: v });
      try { await api("/documents/" + d.id + "/process", { body: {}, long: true }); } catch (e) { }
      closeSheet(); bust(); toast(pxText("سند اضافه شد"), "ok"); render();
    }
  });
};
window.docProcess = async function (id) {
  await doAct(function () { return api("/documents/" + id + "/process", { body: {}, long: true }); }, pxText("پردازش شد"));
};
window.docOpen = async function (id) {
  const d = await api("/documents/" + id);
  sheet({
    title: d.filename, sub: d.format + " · " + bytes(d.size), cls: "wide",
    body: kv("Processed", d.processed ? bdg("yes", "ok") : bdg("no", "warn")) +
      (d.wordCount ? kv("Words", n(d.wordCount)) : "") +
      (d.charCount ? kv("Characters", n(d.charCount)) : "") +
      kv("Uploaded", dt(d.uploadedAt)) +
      (d.processingError ? '<div class="mt12">' + note(h(d.processingError), "err") + "</div>" : "") +
      (d.extractedText ? '<h4 class="mt16 mb8">Extracted Text</h4>' + codeBox(short(d.extractedText, 3000), "dtxt") : "")
  });
};
window.docAnalyze = async function (id) {
  try {
    const a = await api("/documents/" + id + "/analyze");
    const e = await api("/documents/" + id + "/entities").catch(function () { return { entities: {} }; });
    sheet({
      title: pxText("تحلیل سند"), sub: a.filename, cls: "wide",
      body: '<div class="g g4 mb16">' +
        stat({ label: "Words", value: n(a.wordCount) }) + stat({ label: "Sentences", value: n(a.sentenceCount) }) +
        stat({ label: "Avg Sentence", value: n(Math.round(a.avgSentenceLength)) }) + stat({ label: "Reading", value: n(a.readingTime) + "m" }) +
        "</div>" +
        '<h4 class="mb8">Top Words</h4><div class="chips">' + (a.topWords || []).slice(0, 20).map(function (w) {
          return '<span class="chip">' + h(w.word) + ' <span class="tny">' + n(w.count) + "</span></span>";
        }).join("") + "</div>" +
        Object.keys(e.entities || {}).filter(function (k) { return (e.entities[k] || []).length; }).map(function (k) {
          return '<h4 class="mt16 mb8">' + h(k) + "</h4><div class=\"chips\">" + e.entities[k].slice(0, 12).map(function (x) { return '<span class="chip mono">' + h(short(x, 30)) + "</span>"; }).join("") + "</div>";
        }).join("")
    });
  } catch (er) { toast(er.message, "err"); }
};
window.kbNew = function () {
  editSheet({
    title: pxText("ساخت Knowledge Base"),
    fields: [
      { k: "name", l: pxText("نام"), req: true },
      { k: "description", l: pxText("توضیح"), t: "area", rows: 2 },
      { k: "embeddingModel", l: "Embedding Model", v: "text-embedding-ada-002" }
    ],
    onSave: async function (v) { await doAct(function () { return api("/rag/knowledge-bases", { body: v }); }, pxText("ساخته شد")); }
  });
};
window.kbOpen = async function (id) {
  try {
    const s = await api("/rag/knowledge-bases/" + id + "/stats");
    sheet({
      title: s.name, sub: n(s.documentCount) + " doc · " + n(s.chunkCount) + " chunk",
      body: kv("Avg Chunks/Doc", n(s.avgChunksPerDoc)) + kv("Embedding Model", h(s.embeddingModel)) +
        '<h4 class="mt16 mb8">Recent Documents</h4>' +
        ((s.recentDocuments || []).map(function (d) { return li({ icon: "▤", title: h(d.title), sub: rel(d.addedAt) }); }).join("") || pxText('<div class="tiny">خالی</div>'))
    });
  } catch (e) { toast(e.message, "err"); }
};
window.kbAddDoc = function (id) {
  editSheet({
    title: pxText("افزودن سند به KB"), cls: "wide",
    fields: [
      { k: "title", l: pxText("عنوان"), req: true },
      { k: "source", l: pxText("منبع"), ph: "https://…" },
      { k: "content", l: pxText("محتوا"), t: "code", rows: 10, req: true },
      { k: "chunkingStrategy", l: "Chunking", t: "seg", v: "smart", opts: [["smart", "Smart"], ["fixed", "Fixed 500"]] }
    ],
    okText: pxText("افزودن"),
    onSave: async function (v) {
      const r = await api("/rag/knowledge-bases/" + id + "/documents", { body: v, long: true });
      closeSheet(); toast(n(r.chunks) + pxText(" chunk ساخته شد"), "ok"); bust(); render();
    }
  });
};
window.kbQuery = function (id, name) {
  editSheet({
    title: "Query: " + name, cls: "wide",
    fields: [
      { k: "query", l: pxText("سوال"), t: "area", rows: 3, req: true },
      { k: "topK", l: "Top K", t: "num", v: 5 },
      { k: "multihop", l: "Multi-hop Reasoning", t: "switch", v: false, hint: pxText("چند مرحله جستجو برای سوالات پیچیده") }
    ],
    okText: "◍ Query",
    onSave: async function (v) {
      sheetBody(loading(pxText("در حال جستجو و تولید پاسخ…")));
      const path = v.multihop ? "/query/multihop" : "/query";
      const r = await api("/rag/knowledge-bases/" + id + path, { body: { query: v.query, topK: v.topK, maxHops: 3 }, long: true });
      sheetBody('<div class="bub" style="border:1px solid var(--line)">' + md(r.answer) + "</div>" +
        (r.model ? '<div class="row wrap gap4 mt12">' + bdg(tail(r.model), "mono") + bdg(ms(r.latency)) + bdg(usd(r.cost)) + "</div>" : "") +
        ((r.hops || []).length ? '<h4 class="mt16 mb8">Hops</h4>' + r.hops.map(function (hp) { return kv("hop " + hp.hop, h(short(hp.query, 40)) + " → " + n(hp.retrieved)); }).join("") : "") +
        '<h4 class="mt16 mb8">Sources (' + n((r.sources || []).length) + ")</h4>" +
        ((r.sources || []).map(function (s) {
          return li({ icon: "▤", title: h(short(s.title, 40)) + ' <span class="mono tny">' + pct((s.score || 0) * 100) + "</span>", sub: h(short(s.excerpt, 90)) });
        }).join("") || pxText('<div class="tiny">منبعی یافت نشد</div>')));
    }
  });
};
window.kbLegacySearch = function () {
  editSheet({
    title: pxText("جستجو در Knowledge"), cls: "narrow",
    fields: [{ k: "query", l: pxText("عبارت"), req: true }, { k: "topK", l: pxText("تعداد"), t: "num", v: 5 }],
    okText: pxText("◍ جستجو"),
    onSave: async function (v) {
      sheetBody(loading());
      const r = await api("/knowledge/search", { body: v });
      sheetBody((r || []).map(function (x) {
        return li({ icon: "◇", title: h(x.doc) + ' <span class="mono tny">' + pct((x.score || 0) * 100) + "</span>", sub: h(short(x.text, 120)) });
      }).join("") || empty({ title: pxText("نتیجهای نیست") }));
    }
  });
};
window.vecNew = function () {
  editSheet({
    title: pxText("ساخت Vector Index"),
    fields: [
      { k: "name", l: pxText("نام"), req: true },
      { k: "dimensions", l: "Dimensions", t: "num", v: 1536 },
      { k: "metric", l: "Metric", t: "seg", v: "cosine", opts: [["cosine", "Cosine"], ["euclidean", "Euclidean"], ["dot", "Dot"]] },
      { k: "description", l: pxText("توضیح"), t: "area", rows: 2 }
    ],
    onSave: async function (v) { await doAct(function () { return api("/vector/indexes", { body: v }); }, pxText("ساخته شد")); }
  });
};
window.vecStats = async function (id) {
  try {
    const s = await api("/vector/indexes/" + id + "/stats");
    sheet({ title: "Index Stats", body: Object.keys(s).map(function (k) { return kv(k, typeof s[k] === "number" ? n(s[k]) : h(String(s[k]))); }).join("") });
  } catch (e) { toast(e.message, "err"); }
};

/* ═══════════ PROJECTS ═══════════ */
async function viewProjects() {
  const list = await api("/projects");
  return pxText('<div class="ph"><div class="ph-t"><h2>Projects</h2><p>گروهبندی حافظه، Agent و تنظیمات</p></div>') +
    '<div class="ph-a"><button class="btn pri sm"' + act("projNew") + pxText(">＋ ساخت Project</button></div></div>") +
    lst((list || []).filter(function (p) { return !p.archived; }).map(function (p) {
      return li({
        icon: "◰",
        title: h(p.name),
        sub: h(short(p.description, 70)) + "<br><span class=\"tny\">" + n((p.agentIds || []).length) + " agent · " + rel(p.createdAt) + "</span>",
        actions: '<button class="btn sm gho"' + act("projEdit", p.id) + ">✎</button>" +
          '<button class="btn sm dan"' + act("delEntity", "Project", "/projects/" + p.id) + ">🗑</button>"
      });
    }), { icon: "◰", title: pxText("Project نداری"), sub: pxText("برای جدا کردن حافظه و تنظیمات هر کار، Project بسازید"), btn: { t: pxText("＋ ساخت Project"), on: act("projNew") } });
}
function projFields(p) {
  p = p || {};
  return [
    { k: "name", l: pxText("نام"), req: true, v: p.name },
    { k: "description", l: pxText("توضیح"), t: "area", rows: 2, v: p.description },
    { k: "systemPrompt", l: "System Prompt", t: "area", rows: 4, v: p.systemPrompt },
    { k: "tags", l: "Tags", t: "csv", v: (p.tags || []).join(", ") }
  ];
}
window.projNew = function () {
  editSheet({
    title: pxText("ساخت Project"), fields: projFields({}),
    onSave: async function (v) { await doAct(function () { return api("/projects", { body: v }); }, pxText("ساخته شد")); }
  });
};
window.projEdit = async function (id) {
  const list = await api("/projects");
  const p = list.filter(function (x) { return x.id === id; })[0] || {};
  editSheet({
    title: pxText("ویرایش Project"), sub: p.name, fields: projFields(p),
    onSave: async function (v) { await doAct(function () { return api("/projects/" + id, { method: "PATCH", body: v }); }, pxText("ذخیره شد")); }
  });
};

/* ═══════════ PROMPTS ═══════════ */
async function viewPrompts() {
  const list = await api("/promptlab");
  return pxText('<div class="ph"><div class="ph-t"><h2>Prompt Lab</h2><p>بهینهسازی و A/B تست پرامپت</p></div>') +
    '<div class="ph-a"><button class="btn pri sm"' + act("promptOptimize") + pxText(">＋ بهینهسازی</button></div></div>") +
    lst((list || []).map(function (p) {
      return li({
        icon: "◫",
        onclick: act("promptOpen", p.id),
        title: h(short(p.original, 56)),
        sub: n((p.variants || []).length) + " variant · " + n((p.tests || []).length) + " test · " + rel(p.ts),
        actions: '<button class="btn sm pri"' + act("promptAB", p.id) + ">A/B</button>",
        chev: true
      });
    }), { icon: "◫", title: pxText("پرامپتی بهینه نشده"), sub: pxText("یک پرامپت بدهید تا چند نسخه بهتر ساخته و مقایسه شود"), btn: { t: pxText("＋ بهینهسازی پرامپت"), on: act("promptOptimize") } });
}
window.promptOptimize = function () {
  editSheet({
    title: pxText("بهینهسازی پرامپت"), cls: "wide",
    fields: [
      { k: "prompt", l: pxText("پرامپت اصلی"), t: "area", rows: 5, req: true },
      { k: "variants", l: pxText("تعداد Variant"), t: "num", v: 3, min: 1, max: 5 }
    ],
    okText: pxText("▶ بهینهسازی"),
    onSave: async function (v) {
      sheetBody(loading(pxText("در حال ساخت نسخههای بهتر…")));
      const r = await api("/promptlab/optimize", { body: v, long: true });
      bust();
      sheetBody('<div class="tiny mb12">' + h(r.analysis || "") + "</div>" +
        (r.variants || []).map(function (x, i) {
          return card({ title: x.label || ("Variant " + (i + 1)), body: codeBox(x.prompt, "pv" + i), cls: "mb12" });
        }).join(""));
    }
  });
};
window.promptOpen = async function (id) {
  const list = await api("/promptlab");
  const p = list.filter(function (x) { return x.id === id; })[0];
  if (!p) return toast(pxText("یافت نشد"), "err");
  sheet({
    title: "Prompt", sub: rel(p.ts), cls: "wide",
    body: '<h4 class="mb8">Original</h4>' + codeBox(p.original, "porig") +
      '<div class="tiny mt12">' + h(p.analysis || "") + "</div>" +
      '<h4 class="mt16 mb8">Variants</h4>' + (p.variants || []).map(function (v, i) {
        return '<div class="mb12"><div class="tny mb8">' + h(v.label || ("V" + (i + 1))) + "</div>" + codeBox(v.prompt, "pvv" + i) + "</div>";
      }).join("") +
      ((p.tests || []).length ? '<h4 class="mt16 mb8">Test Results</h4>' + p.tests.slice(-1).map(function (t) {
        return (t.results || []).map(function (r) {
          return kv(r.label || "—", (r.score !== undefined ? '<b>' + n(r.score) + "</b> · " : "") + ms(r.latency) + " · " + usd(r.cost));
        }).join("");
      }).join("") : "")
  });
};
window.promptAB = function (id) {
  editSheet({
    title: "A/B Test", cls: "wide",
    fields: [
      { k: "testInput", l: pxText("ورودی تست"), t: "area", rows: 3, req: true, ph: pxText("متنی که با هر variant تست میشود") },
      { k: "judge", l: pxText("قضاوت خودکار با AI"), t: "switch", v: true }
    ],
    okText: pxText("▶ اجرا"),
    onSave: async function (v) {
      sheetBody(loading(pxText("در حال تست variantها…")));
      const r = await api("/promptlab/abtest", { body: { promptId: id, testInput: v.testInput, judge: v.judge }, long: true, timeout: 300000 });
      sheetBody((r.best ? note(pxText("بهترین: <b>") + h(r.best.label) + "</b>", "") : "") +
        (r.results || []).map(function (x) {
          return card({
            title: x.label, sub: ms(x.latency) + " · " + usd(x.cost) + (x.score !== undefined ? " · score " + n(x.score) : ""),
            body: '<div class="tiny">' + h(short(x.output, 400)) + "</div>", cls: "mb12"
          });
        }).join(""));
    }
  });
};
`;
