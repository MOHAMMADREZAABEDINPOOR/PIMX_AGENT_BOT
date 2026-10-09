export const WORKSPACE_JS = String.raw`
/* Shared workspace components; retain the existing API/action handlers. */
function workspaceAct(fn) {
  const args = Array.prototype.slice.call(arguments, 1).map(function (arg) { return JSON.stringify(arg); });
  return ' onclick="' + h(fn + '(' + args.join(',') + ')') + '"';
}
function workspaceHead(title, subtitle, icon, actions) {
  return '<div class="ph studio-page-head"><div class="studio-page-icon">' + pxIcon(icon, 24) + '</div><div class="ph-t"><span class="studio-eyebrow">PIMX WORKSPACE</span><h2>' + h(title) + '</h2><p>' + h(subtitle) + '</p></div><div class="ph-a">' + (actions || '') + '</div></div>';
}
function workspaceAction(label, icon, action, danger) {
  return '<button type="button" class="btn ' + (danger ? 'dan' : 'gho') + '" aria-label="' + h(label) + '" title="' + h(label) + '"' + action + '>' + pxIcon(icon, 16) + '<span>' + h(label) + '</span></button>';
}
function workspaceModelRow(m, selection) {
  const status = pickerStatus(m);
  return '<span class="studio-model-mark">' + pickerMark(m.provider || m.providerName) + '</span><span class="studio-model-copy"><bdi>' + h(m.name || m.apiModelId) + '</bdi><bdi class="studio-model-id" dir="ltr">' + h(m.apiModelId) + '</bdi><span class="studio-model-meta"><bdi>' + h(m.provider || m.providerName || pxText('سرویس سفارشی')) + '</bdi><span class="model-status status-' + status[0] + '"><i></i>' + status[1] + '</span></span></span>' + (selection ? '<span class="studio-selection-check" aria-hidden="true">' + pxIcon('check', 15) + '</span>' : '');
}
VIEWS.models = async function () {
  const d = await api('/models?size=500&sort=name');
  let models = d.models || [];
  if (d.total > models.length) {
    const rest = await Promise.all(Array.from({ length: Math.ceil(d.total / 500) - 1 }, function (_, i) { return api('/models?size=500&sort=name&page=' + (i + 2)); }));
    models = models.concat.apply(models, rest.map(function (page) { return page.models || []; }));
  }
  const active = models.filter(function (m) { return m.enabled !== false; }).length;
  const healthy = models.filter(function (m) { return m.status === 'healthy'; }).length;
  const head = workspaceHead(pxText('کتابخانهٔ مدل‌ها'), pxText('مدل مناسب هر ایده را پیدا کن و مدیریت کن.'), 'models',
    workspaceAction(pxText('مقایسه'), 'compare', workspaceAct('go', 'compare')) + '<button class="btn pri"' + workspaceAct('modelNew', '') + '>' + pxIcon('plus', 16) + pxText('افزودن مدل</button>'));
  const metrics = '<div class="studio-library-stats"><span><strong>' + n(models.length) + pxText('</strong> مدل در کتابخانه</span><span><i class="studio-dot"></i><strong>') + n(active) + pxText('</strong> فعال</span><span><strong>') + n(healthy) + pxText('</strong> پاسخ‌گو</span></div>');
  const toolbar = '<div class="studio-library-toolbar"><div class="studio-search">' + pxIcon('search', 19) + pxText('<input type="search" id="modelSearch" aria-label="جستجوی کتابخانه مدل‌ها" placeholder="نام مدل، شناسه یا پروایدر…" oninput="filterModelsList(this.value)"></div><details class="studio-bulk"><summary>') + pxIcon('settings', 17) + pxText('مدیریت گروهی</summary><div>') + workspaceAction(pxText('تست همه'), 'playground', ' onclick="bulkModels(null,\'test\')"') + workspaceAction(pxText('فعال کردن همه'), 'check', ' onclick="bulkModels(null,\'enable\')"') + workspaceAction(pxText('فعال کردن سالم‌ها'), 'restore', ' onclick="enableHealthy(null)"') + workspaceAction(pxText('غیرفعال کردن همه'), 'close', ' onclick="bulkModels(null,\'disable\')"', true) + '</div></details></div>';
  const rows = models.map(function (m) {
    const enabled = m.enabled !== false;
    return '<article class="card studio-model-card model-card' + (!enabled ? ' is-disabled' : '') + '" data-search="' + h(pickerNormalize([m.name, m.apiModelId, m.provider, (m.tags || []).join(' ')].join(' '))) + '">' +
      '<button class="studio-model-open"' + workspaceAct('go', 'model', m.id) + '>' + workspaceModelRow(m) + '</button>' +
      '<div class="studio-model-facts"><span>' + (m.context ? n(m.context) + pxText(' توکن زمینه') : pxText('زمینه ثبت نشده')) + '</span><span>' + (m.pricing && m.pricing.free ? pxText('رایگان') : m.costPer1M != null ? price(m.costPer1M) : pxText('هزینه ثبت نشده')) + '</span>' + (!enabled ? pxText('<span>غیرفعال</span>') : '') + '</div>' +
      '<div class="studio-model-actions">' + workspaceAction(pxText('تست'), 'playground', workspaceAct('modelTestSingle', m.id)) + workspaceAction(enabled ? pxText('غیرفعال') : pxText('فعال'), enabled ? 'close' : 'check', workspaceAct('modelToggle', m.id, enabled)) + workspaceAction(pxText('کپی'), 'copy', workspaceAct('modelCopyName', m.apiModelId)) + workspaceAction(pxText('حذف'), 'trash', workspaceAct('modelDelete', m.id, m.name || m.apiModelId), true) + '</div></article>';
  }).join('');
  return head + metrics + toolbar + '<div class="studio-results-label"><span id="mcount" role="status" aria-live="polite">' + n(models.length) + pxText(' مدل</span><span>برای جزئیات، مدل را باز کن</span></div><div class="studio-model-grid model-list" id="modelList">') + rows + '</div><div class="studio-empty" id="modelListEmpty"' + (models.length ? ' hidden' : '') + '>' + pxIcon('search', 28) + pxText('<h3>مدلی پیدا نشد</h3><p>جستجو را تغییر بده یا مدل جدیدی اضافه کن.</p><button class="btn gho" onclick="document.getElementById(\'modelSearch\').value=\'\';filterModelsList(\'\')">پاک کردن جستجو</button></div>');
};
window.filterModelsList = function (query) {
  const terms = pickerNormalize(query).trim().split(/\s+/).filter(Boolean);
  let visible = 0;
  document.querySelectorAll('#modelList .model-card').forEach(function (row) {
    const matches = terms.every(function (term) { return row.dataset.search.includes(term); });
    row.hidden = !matches; if (matches) visible++;
  });
  document.getElementById('mcount').textContent = n(visible) + pxText(' مدل');
  document.getElementById('modelListEmpty').hidden = visible > 0;
};
VIEWS.compare = async function () {
  const models = await usableModels();
  const selected = (S.cache.cmpSel || []).filter(function (id) { return models.some(function (m) { return m.id === id; }); });
  S.cache.cmpSel = selected;
  return workspaceHead(pxText('آرنای مقایسه'), pxText('۲ تا ۵ مدل را کنار هم قرار بده و عملکردشان را بسنج.'), 'compare') +
    pxText('<div class="card studio-compare"><div class="studio-compare-header"><div><h3>تیم مقایسهٔ تو</h3><p>') + n(models.length) + pxText(' مدل در دسترس</p></div><span class="studio-selection-count" id="cmpSelCount">') + n(selected.length) + pxText(' از ۵ مدل</span></div><div class="studio-search">') + pxIcon('search', 19) + pxText('<input type="search" id="cmpSearch" aria-label="جستجوی مدل برای مقایسه" placeholder="مدل یا پروایدر را جستجو کن…" oninput="filterCmpChips(this.value)"></div><div class="studio-comparison-list" id="cmpChipsList">') + models.map(function (m) {
      const on = selected.includes(m.id);
      return '<button type="button" class="studio-compare-option cmp-chip' + (on ? ' on' : '') + '" data-id="' + h(m.id) + '" data-search="' + h(pickerNormalize([m.name, m.apiModelId, m.provider].join(' '))) + '" aria-pressed="' + on + '"' + workspaceAct('cmpToggle', m.id) + '>' + workspaceModelRow(m, true) + '</button>';
    }).join('') + pxText('</div><div class="studio-empty" id="compareEmpty" hidden>مدلی با این عبارت پیدا نشد.</div><div class="studio-compare-footer"><span>حداقل دو مدل انتخاب کن</span><button class="btn pri" id="cmpRunBtn" onclick="runCompare()"') + (selected.length < 2 ? ' disabled' : '') + '>' + pxIcon('playground', 17) + pxText('شروع مقایسه</button></div></div><div id="cmpout" class="mt12"></div>');
};
window.filterCmpChips = function (query) {
  const text = pickerNormalize(query).trim(); let visible = 0;
  document.querySelectorAll('.cmp-chip').forEach(function (row) { row.hidden = !row.dataset.search.includes(text); if (!row.hidden) visible++; });
  const empty = document.getElementById('compareEmpty'); if (empty) empty.hidden = visible > 0;
};
window.cmpToggle = function (id) {
  const selected = S.cache.cmpSel || [];
  const index = selected.indexOf(id);
  if (index >= 0) selected.splice(index, 1);
  else { if (selected.length >= 5) return toast(pxText('حداکثر ۵ مدل انتخاب کن'), 'warn'); selected.push(id); }
  S.cache.cmpSel = selected;
  document.querySelectorAll('.cmp-chip').forEach(function (row) { const on = selected.includes(row.dataset.id); row.classList.toggle('on', on); row.setAttribute('aria-pressed', String(on)); });
  document.getElementById('cmpSelCount').textContent = n(selected.length) + pxText(' از ۵ مدل');
  document.getElementById('cmpRunBtn').disabled = selected.length < 2;
};

let workspaceChoice = null;
function closeWorkspaceChoice(focus) {
  if (!workspaceChoice) return;
  const choice = workspaceChoice; workspaceChoice = null;
  choice.overlay.remove(); choice.app.inert = choice.wasInert;
  choice.sheets.forEach(function (item) { item.element.inert = item.inert; });
  document.removeEventListener('keydown', workspaceChoiceKeys, true);
  window.removeEventListener('hashchange', workspaceChoiceRouteChange);
  if (window.visualViewport) { visualViewport.removeEventListener('resize', choice.resize); visualViewport.removeEventListener('scroll', choice.resize); }
  choice.trigger.setAttribute('aria-expanded', 'false');
  if (focus !== false && choice.trigger.isConnected) choice.trigger.focus({ preventScroll: true });
}
window.closeWorkspaceChoice = closeWorkspaceChoice;
function workspaceChoiceRouteChange() { closeWorkspaceChoice(false); }
function workspaceChoiceKeys(e) {
  if (!workspaceChoice) return;
  const overlay = workspaceChoice.overlay;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeWorkspaceChoice(); return; }
  const focusable = Array.from(overlay.querySelectorAll('button:not([disabled]),input')).filter(function (el) { return !el.hidden && el.getClientRects().length; });
  if (e.key === 'Tab') {
    const i = focusable.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); focusable[focusable.length - 1].focus(); }
    else if (!e.shiftKey && (i < 0 || i === focusable.length - 1)) { e.preventDefault(); focusable[0].focus(); }
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const options = Array.from(overlay.querySelectorAll('[data-choice-index]:not([disabled])'));
    if (!options.length) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const i = options.indexOf(document.activeElement);
    const next = i < 0 ? (e.key === 'ArrowDown' ? 0 : options.length - 1) : (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next].focus(); options[next].scrollIntoView({ block: 'nearest' });
  }
}
function paintWorkspaceChoices(query) {
  const text = pickerNormalize(query).trim(); let count = 0;
  const choice = workspaceChoice;
  const rows = choice.options.map(function (option, index) {
    if (!pickerNormalize(option.text + ' ' + (option.dataset.detail || '')).includes(text)) return '';
    count++;
    const label = option.text.split(' · ');
    const isSelected = option.value === choice.select.value;
    return '<button type="button" class="model-option' + (isSelected ? ' is-selected' : '') + '" data-choice-index="' + index + '" aria-pressed="' + isSelected + '"' + (option.disabled ? ' disabled' : '') + '>' + pickerMark(label[1] || label[0]) + '<span class="model-option-copy"><bdi class="model-option-name">' + h(label[0]) + '</bdi><bdi class="model-option-id">' + h(option.dataset.detail || label.slice(1).join(' · ') || pxText('انتخاب خودکار')) + '</bdi></span><span class="model-option-check">' + (isSelected ? pxIcon('check', 15) : '') + '</span></button>';
  }).join('');
  choice.overlay.querySelector('.model-picker-results').innerHTML = rows || pxText('<div class="model-picker-empty"><strong>نتیجه‌ای پیدا نشد</strong><p>عبارت کوتاه‌تری را امتحان کن.</p></div>');
  choice.overlay.querySelector('[role="status"]').textContent = n(count) + pxText(' گزینه');
}
function openWorkspaceChoice(select, trigger, label) {
  if (workspaceChoice || select.disabled) return;
  const overlay = document.createElement('div'); overlay.className = 'model-picker-overlay studio-choice-overlay'; overlay.id = 'workspaceChoiceOverlay';
  overlay.innerHTML = '<section class="model-picker studio-choice" role="dialog" aria-modal="true" aria-labelledby="workspaceChoiceTitle"><div class="model-picker-handle"></div><header class="model-picker-header"><div><span class="model-picker-eyebrow">PIMX / SELECT</span><h2 id="workspaceChoiceTitle">' + h(label) + pxText('</h2></div><button class="model-picker-close" data-choice-close aria-label="بستن انتخاب‌گر">') + pxIcon('close', 18) + '</button></header><div class="model-picker-search">' + pxIcon('search', 19) + pxText('<input type="search" aria-label="جستجوی گزینه‌ها" placeholder="جستجو در همهٔ گزینه‌ها…" autocomplete="off"></div><div class="model-picker-summary"><span role="status" aria-live="polite"></span><span>انتخاب فعلی با تیک مشخص شده</span></div><div class="model-picker-results"></div><footer class="model-picker-footer">نام کامل گزینه‌ها را ببین و انتخاب کن.</footer></section>');
  const app = document.getElementById('app');
  workspaceChoice = { select: select, trigger: trigger, options: Array.from(select.options), overlay: overlay, app: app, wasInert: app.inert, sheets: Array.from(document.querySelectorAll('.modal-overlay')).map(function (element) { return { element: element, inert: element.inert }; }) };
  workspaceChoice.sheets.forEach(function (item) { item.element.inert = true; });
  app.inert = true; trigger.setAttribute('aria-expanded', 'true'); document.body.appendChild(overlay);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay || e.target.closest('[data-choice-close]')) return closeWorkspaceChoice();
    const row = e.target.closest('[data-choice-index]'); if (!row || row.disabled) return;
    const choice = workspaceChoice;
    choice.select.value = choice.options[Number(row.dataset.choiceIndex)].value;
    closeWorkspaceChoice();
    choice.select.dispatchEvent(new Event('input', { bubbles: true }));
    choice.select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const input = overlay.querySelector('input'); input.oninput = function () { paintWorkspaceChoices(input.value); };
  document.addEventListener('keydown', workspaceChoiceKeys, true); window.addEventListener('hashchange', workspaceChoiceRouteChange);
  workspaceChoice.resize = function () { if (window.visualViewport) { overlay.style.setProperty('--picker-viewport', visualViewport.height + 'px'); overlay.style.setProperty('--picker-offset', visualViewport.offsetTop + 'px'); overlay.classList.toggle('is-compact', visualViewport.height <= 550); } };
  if (window.visualViewport) { visualViewport.addEventListener('resize', workspaceChoice.resize); visualViewport.addEventListener('scroll', workspaceChoice.resize); workspaceChoice.resize(); }
  paintWorkspaceChoices(''); input.focus({ preventScroll: true });
}
function enhanceWorkspaceSelects(root) {
  root.querySelectorAll('select:not([data-studio-select])').forEach(function (select) {
    if (!select.id) select.id = 'studioSelect' + Math.random().toString(36).slice(2);
    const field = select.closest('.fld,.input-group') || select.parentElement;
    const label = field.querySelector('label');
    const titles = { pgm: pxText('انتخاب مدل آزمایشگاه'), trTool: pxText('انتخاب ابزار'), r_def: pxText('انتخاب مدل پیش‌فرض') };
    const title = titles[select.id] || (label ? label.textContent.replace('*', '').trim() : pxText('انتخاب گزینه'));
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'studio-select-trigger'; trigger.id = select.id + 'Trigger'; trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false');
    select.dataset.studioSelect = '1'; select.classList.add('studio-native-select'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
    select.after(trigger); if (label) label.htmlFor = trigger.id;
    const sync = function () {
      const option = select.selectedOptions[0]; const parts = option ? option.text.split(' · ') : [pxText('گزینه‌ای موجود نیست')];
      trigger.disabled = select.disabled || !select.options.length; trigger.setAttribute('aria-label', title + pxText('، ') + (option ? option.text : ''));
      trigger.innerHTML = '<span class="studio-select-icon">' + pxIcon(select.id === 'trTool' ? 'tools' : 'models', 20) + '</span><span class="studio-select-copy"><bdi>' + h(parts[0]) + '</bdi><small>' + h(parts.slice(1).join(' · ') || pxText('برای انتخاب کلیک کن')) + '</small></span><span class="studio-select-chevron">⌄</span>';
    };
    select.addEventListener('change', sync); sync(); trigger.onclick = function () { openWorkspaceChoice(select, trigger, title); };
  });
}
const WORKSPACE_ROUTES = ['models', 'model', 'council', 'playground', 'compare', 'tools', 'routing', 'settings'];
WORKSPACE_ROUTES.forEach(function (route) {
  const prev = window.AFTER[route];
  window.AFTER[route] = async function () {
    if (prev) await prev();
    const root = document.getElementById('view'); if (!root || S.route !== route) return;
    root.classList.add('workspace-view'); root.dataset.workspace = route;
    const pageHead = root.querySelector('.ph');
    if (pageHead && !pageHead.classList.contains('studio-page-head')) {
      pageHead.classList.add('studio-page-head');
      pageHead.insertAdjacentHTML('afterbegin', '<div class="studio-page-icon">' + pxIcon(route === 'model' ? 'models' : route, 24) + '</div>');
      const title = pageHead.querySelector('h2');
      const names = { council: pxText('شورای هوش مصنوعی'), playground: pxText('آزمایشگاه مدل‌ها'), tools: pxText('ابزارها و MCP'), routing: pxText('مسیریابی هوشمند'), settings: pxText('تنظیمات فضای کار') };
      if (title && names[route]) title.textContent = names[route];
    }
    if (route === 'model') {
      const actions = { modelTest: [pxText('تست مدل'), 'playground'], modelBench: [pxText('سنجش عملکرد'), 'compare'], modelEdit: [pxText('ویرایش'), 'prompts'], modelFav: [pxText('نشان‌کردن'), 'pin'], delEntity: [pxText('حذف'), 'trash'] };
      root.querySelectorAll('.ph-a button').forEach(function (button) {
        const onclick = button.getAttribute('onclick') || '';
        const key = Object.keys(actions).find(function (key) { return onclick.includes(key + '('); });
        if (key) { const value = actions[key]; button.innerHTML = pxIcon(value[1], 16) + '<span>' + value[0] + '</span>'; button.setAttribute('aria-label', value[0]); }
      });
      const crumb = root.querySelector('.ph-t > button'); if (crumb) { crumb.textContent = pxText('کتابخانهٔ مدل‌ها'); crumb.classList.add('studio-breadcrumb'); }
    }
    enhanceWorkspaceSelects(root);
    root.querySelectorAll('.fld,.input-group').forEach(function (field) { const control = field.querySelector('textarea,input'); const label = field.querySelector('label'); if (label && control && control.id) label.htmlFor = control.id; });
    root.querySelectorAll('button[title]:not([aria-label])').forEach(function (button) { button.setAttribute('aria-label', button.title); });
    const translations = { 'AI Council': pxText('شورای هوش مصنوعی'), '▶ Playground': pxText('آزمایشگاه مدل‌ها'), 'Tools & MCP': pxText('ابزارها و MCP'), 'Request': pxText('درخواست تو'), 'Response': pxText('پاسخ مدل'), 'Mode': pxText('شیوهٔ همکاری'), 'Rounds': pxText('تعداد دور'), 'Model': pxText('انتخاب مدل'), 'Tool': pxText('انتخاب ابزار'), 'System Prompt': pxText('دستور سیستمی'), 'Prompt': pxText('پرامپت'), 'Max Tokens': pxText('حداکثر توکن'), 'Temperature': pxText('خلاقیت مدل'), 'Arguments (JSON)': pxText('ورودی ابزار (JSON)'), 'Overview': pxText('نمای کلی'), 'Capabilities': pxText('قابلیت‌ها'), 'Tests': pxText('تست‌ها'), 'Benchmarks': pxText('بنچمارک'), 'History': pxText('تاریخچه'), 'Templates': pxText('قالب‌ها'), 'Configs': pxText('تنظیمات'), 'Score': pxText('امتیاز'), 'Latency': pxText('زمان پاسخ'), 'Requests': pxText('درخواست‌ها'), 'Cost': pxText('هزینه'), 'Independent': pxText('مستقل'), 'Debate': pxText('مناظره'), 'Panel': pxText('پنل تخصصی'), 'Judge': pxText('داوری'), 'Iterative': pxText('بهبود مرحله‌ای') };
    root.querySelectorAll('h2,.card-t,label,.tabs button,.seg button,.stat-box .lbl span').forEach(function (el) {
      Array.from(el.childNodes).forEach(function (node) { if (node.nodeType === 3 && translations[node.textContent.trim()]) node.textContent = translations[node.textContent.trim()]; });
    });
    const councilPicker = document.getElementById('cnlPicker');
    if (councilPicker) {
      if (!document.getElementById('councilModelSearch')) {
        councilPicker.insertAdjacentHTML('beforebegin', '<div class="studio-search studio-council-search">' + pxIcon('search', 18) + pxText('<input type="search" id="councilModelSearch" aria-label="جستجوی مدل‌های شورا" placeholder="جستجوی مدل یا پروایدر…"></div>'));
        document.getElementById('councilModelSearch').oninput = function () { const query = pickerNormalize(this.value); councilPicker.querySelectorAll('.pick').forEach(function (row) { row.hidden = !pickerNormalize(row.textContent).includes(query); }); };
      }
      councilPicker.querySelectorAll('.pick').forEach(function (row) { row.setAttribute('aria-pressed', String(row.classList.contains('on'))); });
    }
  };
});
// Sheets are created outside #view (including the default-model settings).
new MutationObserver(function (mutations) {
  if (!mutations.some(function (m) { return m.addedNodes.length; })) return;
  const sheetRoot = document.getElementById('sheetOverlay'); if (sheetRoot) enhanceWorkspaceSelects(sheetRoot);
}).observe(document.body, { childList: true, subtree: true });
`;
