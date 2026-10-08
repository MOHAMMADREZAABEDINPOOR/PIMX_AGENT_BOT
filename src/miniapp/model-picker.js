// Chat model selection uses registry IDs; display names need not be unique.
export const MODEL_PICKER = String.raw`
let modelPicker = null;
function chatModelTriggerHtml(models) {
  S.chat.availableModels = models;
  const selected = models.find(function (m) { return m.id === S.chat.modelId; });
  const name = selected ? (selected.name || selected.apiModelId) : 'انتخاب هوشمند';
  return '<button type="button" id="cmodel" class="model-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="انتخاب مدل گفتگو، ' + h(name) + '" title="' + h(name) + '" onclick="openModelPicker()">' +
    '<span class="model-trigger-icon">' + pxIcon(selected ? 'models' : 'spark', 18) + '</span>' +
    '<span class="model-trigger-copy"><bdi>' + h(name) + '</bdi><small>' + h(selected ? selected.provider || 'مدل انتخاب‌شده' : 'Auto · متناسب با درخواست تو') + '</small></span>' +
    '<svg class="model-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>';
}
function pickerProviderKey(m) { return String(m.providerId || m.provider || 'other'); }
function pickerStatus(m) {
  if (m.status === 'healthy') return ['healthy', 'پاسخ‌گو'];
  if (m.status === 'degraded') return ['degraded', 'ناپایدار'];
  if (m.status === 'failed') return ['failed', 'نیاز به بررسی'];
  return ['unknown', 'بررسی‌نشده'];
}
function pickerMark(name) {
  const label = String(name || 'AI');
  const tone = /google|gemini/i.test(label) ? 'mint' : /openai|gpt/i.test(label) ? 'blue' : /anthropic|claude/i.test(label) ? 'amber' : 'violet';
  return '<span class="model-provider-mark tone-' + tone + '" aria-hidden="true">' + h(label.trim().slice(0, 1).toUpperCase()) + '</span>';
}
function pickerNormalize(text) {
  return String(text || '').normalize('NFKC').toLocaleLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
}
function pickerRowHtml(m) {
  const status = pickerStatus(m);
  const selected = S.chat.modelId === m.id;
  return '<button type="button" class="model-option' + (selected ? ' is-selected' : '') + '" data-model-id="' + h(m.id) + '" aria-pressed="' + selected + '">' +
    pickerMark(m.provider) + '<span class="model-option-copy"><bdi class="model-option-name">' + h(m.name || m.apiModelId) + '</bdi><bdi class="model-option-id" dir="ltr">' + h(m.apiModelId || m.id) + '</bdi></span>' +
    '<span class="model-option-meta"><span class="model-status status-' + status[0] + '"><i aria-hidden="true"></i>' + status[1] + '</span>' + (m.pricing && m.pricing.free ? '<small class="model-free">رایگان</small>' : '') + '</span>' +
    '<span class="model-option-check" aria-hidden="true">' + (selected ? pxIcon('check', 15) : '') + '</span></button>';
}
function renderModelPickerResults() {
  if (!modelPicker) return;
  const terms = pickerNormalize(modelPicker.query).trim().split(/\s+/).filter(Boolean);
  const matches = modelPicker.models.filter(function (m) {
    if (modelPicker.provider && pickerProviderKey(m) !== modelPicker.provider) return false;
    const text = pickerNormalize([m.name, m.apiModelId, m.provider].join(' '));
    return terms.every(function (term) { return text.includes(term); });
  });
  const groups = new Map();
  matches.forEach(function (m) {
    const key = pickerProviderKey(m);
    if (!groups.has(key)) groups.set(key, { label: m.provider || 'سایر مدل‌ها', rows: [] });
    groups.get(key).rows.push(m);
  });
  let html = '';
  groups.forEach(function (group) {
    html += '<section class="model-group"><h3><bdi>' + h(group.label) + '</bdi><span>' + n(group.rows.length) + ' مدل</span></h3>' + group.rows.map(pickerRowHtml).join('') + '</section>';
  });
  if (!matches.length) html = '<div class="model-picker-empty">' + pxIcon('search', 30) + '<strong>مدلی پیدا نشد</strong><p>نام کوتاه‌تر یا پروایدر دیگری را امتحان کن.</p><button type="button" class="btn gho" data-picker-reset>پاک کردن فیلترها</button></div>';
  const list = document.getElementById('modelPickerResults');
  list.innerHTML = html;
  list.scrollTop = 0;
  document.getElementById('modelPickerCount').textContent = n(matches.length) + ' مدل' + (terms.length || modelPicker.provider ? ' پیدا شد' : ' در دسترس');
  document.querySelectorAll('#modelPickerFilters [data-provider]').forEach(function (button) {
    const active = button.dataset.provider === modelPicker.provider;
    button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
  });
  const clear = document.getElementById('modelPickerClear');
  clear.hidden = !modelPicker.query;
}
function chooseChatModel(id) {
  if (!modelPicker || (id && !modelPicker.models.some(function (m) { return m.id === id; }))) return;
  S.chat.modelId = id;
  const trigger = document.getElementById('cmodel');
  if (trigger) trigger.outerHTML = chatModelTriggerHtml(modelPicker.models);
  closeModelPicker();
  haptic('selection');
}
function modelPickerKeydown(e) {
  if (!modelPicker) return;
  const overlay = modelPicker.overlay;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeModelPicker(); return; }
  if (e.key === 'Tab') {
    const focusable = Array.from(overlay.querySelectorAll('button:not([disabled]),input')).filter(function (el) { return !el.hidden && el.getClientRects().length; });
    const index = focusable.indexOf(document.activeElement);
    if (e.shiftKey && index <= 0) { e.preventDefault(); focusable[focusable.length - 1].focus(); }
    else if (!e.shiftKey && (index === focusable.length - 1 || index === -1)) { e.preventDefault(); focusable[0].focus(); }
    return;
  }
  if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
  const options = Array.from(overlay.querySelectorAll('[data-model-id]'));
  if (!options.length) return;
  const current = options.indexOf(document.activeElement);
  let index = current < 0 ? (e.key === 'ArrowDown' ? (modelPicker.query && options.length > 1 ? 1 : 0) : options.length - 1) : (current + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
  e.preventDefault(); e.stopImmediatePropagation();
  options[index].focus(); options[index].scrollIntoView({ block: 'nearest' });
}
function closeModelPicker(returnFocus) {
  if (!modelPicker) return;
  const previous = modelPicker; modelPicker = null;
  previous.overlay.remove();
  previous.app.inert = previous.wasInert;
  document.body.style.overflow = previous.overflow;
  document.removeEventListener('keydown', modelPickerKeydown, true);
  window.removeEventListener('hashchange', modelPickerRouteChange);
  if (window.visualViewport) {
    visualViewport.removeEventListener('resize', previous.resize);
    visualViewport.removeEventListener('scroll', previous.resize);
  }
  const trigger = document.getElementById('cmodel');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (returnFocus !== false) {
    const target = trigger || previous.focus;
    if (target && target.isConnected) target.focus({ preventScroll: true });
  }
}
function modelPickerRouteChange() { closeModelPicker(false); }
function openModelPicker() {
  if (modelPicker) return;
  const models = S.chat.availableModels || [];
  const providers = new Map();
  models.forEach(function (m) { const key = pickerProviderKey(m); if (!providers.has(key)) providers.set(key, m.provider || 'سایر'); });
  let chips = '<button type="button" class="model-filter is-active" data-provider="" aria-pressed="true">همهٔ پروایدرها</button>';
  providers.forEach(function (label, key) { chips += '<button type="button" class="model-filter" data-provider="' + h(key) + '" aria-pressed="false"><bdi>' + h(label) + '</bdi></button>'; });
  const overlay = document.createElement('div');
  overlay.id = 'modelPickerOverlay'; overlay.className = 'model-picker-overlay';
  overlay.innerHTML = '<section class="model-picker" role="dialog" aria-modal="true" aria-labelledby="modelPickerTitle" aria-describedby="modelPickerHint">' +
    '<div class="model-picker-handle" aria-hidden="true"></div><header class="model-picker-header"><div><span class="model-picker-eyebrow">MODEL LIBRARY</span><h2 id="modelPickerTitle">مدل گفتگو را انتخاب کن</h2></div><button type="button" class="model-picker-close" data-picker-close aria-label="بستن انتخاب مدل">' + pxIcon('close', 19) + '</button></header>' +
    '<button type="button" class="model-auto' + (!S.chat.modelId ? ' is-selected' : '') + '" data-model-id="" aria-pressed="' + !S.chat.modelId + '"><span class="model-auto-icon">' + pxIcon('spark', 23) + '</span><span class="model-auto-copy"><strong>انتخاب هوشمند <bdi>Auto</bdi></strong><small>مدل مناسب با درخواست و حالت پاسخ تو</small></span><span class="model-option-check" aria-hidden="true">' + (!S.chat.modelId ? pxIcon('check', 15) : '') + '</span></button>' +
    '<div class="model-picker-search">' + pxIcon('search', 19) + '<input id="modelPickerSearch" type="search" autocomplete="off" spellcheck="false" aria-label="جستجوی مدل یا پروایدر" placeholder="جستجوی مدل یا پروایدر…"><button type="button" id="modelPickerClear" data-picker-clear aria-label="پاک کردن جستجو" hidden>' + pxIcon('close', 15) + '</button></div>' +
    '<div class="model-picker-filters" id="modelPickerFilters" role="group" aria-label="فیلتر پروایدر">' + chips + '</div><div class="model-picker-summary"><span id="modelPickerCount" role="status" aria-live="polite"></span><span>مدل‌های تو</span></div><div class="model-picker-results" id="modelPickerResults"></div>' +
    '<footer class="model-picker-footer"><span id="modelPickerHint">وضعیت‌ها بر اساس آخرین بررسی مدل‌اند.</span><span class="model-picker-keys"><kbd>↑</kbd><kbd>↓</kbd> جابه‌جایی <kbd>Enter</kbd> انتخاب</span></footer></section>';
  const app = document.getElementById('app');
  modelPicker = { models: models, query: '', provider: '', overlay: overlay, app: app, wasInert: app.inert, overflow: document.body.style.overflow, focus: document.activeElement };
  app.inert = true; document.body.style.overflow = 'hidden';
  const trigger = document.getElementById('cmodel'); if (trigger) trigger.setAttribute('aria-expanded', 'true');
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay || e.target.closest('[data-picker-close]')) { closeModelPicker(); return; }
    const option = e.target.closest('[data-model-id]');
    if (option) { chooseChatModel(option.dataset.modelId); return; }
    const filter = e.target.closest('[data-provider]');
    if (filter) { modelPicker.provider = filter.dataset.provider; renderModelPickerResults(); return; }
    if (e.target.closest('[data-picker-clear]') || e.target.closest('[data-picker-reset]')) {
      if (e.target.closest('[data-picker-reset]')) modelPicker.provider = '';
      modelPicker.query = ''; const search = document.getElementById('modelPickerSearch'); search.value = ''; renderModelPickerResults(); search.focus();
    }
  });
  const input = document.getElementById('modelPickerSearch');
  input.addEventListener('input', function () { modelPicker.query = input.value; renderModelPickerResults(); });
  document.addEventListener('keydown', modelPickerKeydown, true);
  window.addEventListener('hashchange', modelPickerRouteChange);
  modelPicker.resize = function () {
    if (!window.visualViewport) return;
    overlay.style.setProperty('--picker-viewport', visualViewport.height + 'px');
    overlay.style.setProperty('--picker-offset', visualViewport.offsetTop + 'px');
    overlay.classList.toggle('is-compact', visualViewport.height <= 550);
  };
  if (window.visualViewport) { visualViewport.addEventListener('resize', modelPicker.resize); visualViewport.addEventListener('scroll', modelPicker.resize); modelPicker.resize(); }
  renderModelPickerResults(); input.focus({ preventScroll: true });
  if (S.chat.modelId) {
    const selected = Array.from(overlay.querySelectorAll('.model-option')).find(function (row) { return row.dataset.modelId === S.chat.modelId; });
    const list = document.getElementById('modelPickerResults');
    if (selected) list.scrollTop += selected.getBoundingClientRect().top - list.getBoundingClientRect().top - (list.clientHeight - selected.clientHeight) / 2;
  }
}
window.openModelPicker = openModelPicker;
window.closeModelPicker = closeModelPicker;
`;
