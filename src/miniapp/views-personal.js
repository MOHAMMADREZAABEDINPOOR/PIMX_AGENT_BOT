export const VIEWS_PERSONAL = String.raw`
function pxIcon(name, size) {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 10h8M8 14h5"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
    arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    models: '<rect x="4" y="7" width="16" height="14" rx="4"/><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 11v5m22-5v5"/>',
    council: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 21v-3a5 5 0 0 1 10 0v3M2 20v-3h3m17 3v-3h-3"/>',
    memory: '<path d="M12 5a3 3 0 0 0-5-2 3 3 0 0 0-3 5 4 4 0 0 0 0 8 3 3 0 0 0 3 5 3 3 0 0 0 5-2V5Zm0 0a3 3 0 0 1 5-2 3 3 0 0 1 3 5 4 4 0 0 1 0 8 3 3 0 0 1-3 5 3 3 0 0 1-5-2M7 8l2 2m8-2-2 2m-8 6 2-2m8 2-2-2"/>',
    knowledge: '<path d="M12 6c-4-3-8-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-2-1-6-1-10 2Zm0 0v15"/>',
    prompts: '<path d="m15 4 5 5M4 20l4-1L21 6a2 2 0 0 0-3-3L5 16zM4 5h5m-3-3v6"/>',
    agents: '<rect x="5" y="5" width="14" height="14" rx="4"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4M9 9h6v6H9z"/>',
    backup: '<path d="M20 16a4 4 0 0 0 0-8 7 7 0 0 0-13-2 5 5 0 0 0-1 10M12 10v11m-4-4 4 4 4-4"/>',
    restore: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6m3-3v5l3 2"/>',
    provider: '<path d="M9 3v4m6-4v4M7 7h10v4a5 5 0 0 1-10 0V7Zm5 9v5"/>',
    tools: '<path d="m14 6 4 4-9 9H5v-4Zm2-2 2-2 4 4-2 2M3 3l4 4m-4 14 2-2"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    plan: '<rect x="4" y="4" width="16" height="17" rx="3"/><path d="M8 2v4m8-4v4M4 10h16m-11 5 2 2 4-4"/>',
    pin: '<path d="m16 3 5 5-4 3-1 5-4-1-6 6m-3-5 6-6-1-4 5-1z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    monitor: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    costs: '<path d="M4 20V10m8 10V4m8 16v-7"/>',
    projects: '<path d="M3 6h6l2 3h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V3H3v13h5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    playground: '<path d="m8 4 13 8-13 8z"/>',
    compare: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M3 15v6h18v-6"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>'
  };
  return '<svg class="px-icon" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.spark) + '</svg>';
}
window.pxIcon = pxIcon;

function responseModesHtml() {
  const selected = (S.preferences || {}).responseMode || 'speed';
  return [['speed', 'سریع', 'bolt'], ['balanced', 'متعادل', 'models'], ['quality', 'عمیق', 'memory']].map(function (item) {
    return '<button type="button" data-mode="' + item[0] + '" class="response-mode' + (selected === item[0] ? ' on' : '') + '" aria-pressed="' + (selected === item[0]) + '"' + act('setResponseMode', item[0]) + '>' + pxIcon(item[2], 15) + item[1] + '</button>';
  }).join('');
}
window.setResponseMode = async function (mode) {
  const previous = (S.preferences || {}).responseMode || 'speed';
  S.preferences = Object.assign({}, S.preferences || {}, { responseMode: mode });
  document.querySelectorAll('.response-mode').forEach(function (button) { const active = button.dataset.mode === mode; button.classList.toggle('on', active); button.setAttribute('aria-pressed', String(active)); });
  try { S.preferences = await api('/preferences', { method: 'PATCH', body: { responseMode: mode } }); bust('preferences'); toast(mode === 'speed' ? 'پاسخ سریع و کوتاه' : mode === 'quality' ? 'پاسخ دقیق‌تر و مفصل‌تر' : 'تعادل سرعت و جزئیات', 'ok'); }
  catch (e) { S.preferences.responseMode = previous; toast(e.message, 'err'); render(); }
};
window.homeAsk = function () { const input = document.getElementById('homePrompt'); const text = (input && input.value || '').trim(); if (text) launchPrompt(text); else go('chat'); };
window.launchPrompt = async function (text) { if (S.chat.sending || S.chat.creating) return; S.chat.autoPrompt = text; await newChat(); };
const personalAfterChat = window.AFTER.chat;
window.AFTER.chat = function () {
  if (personalAfterChat) personalAfterChat();
  const input = document.getElementById('cinput');
  if (input && S.chat.autoPrompt) { input.value = S.chat.autoPrompt; S.chat.autoPrompt = null; setTimeout(sendChat, 0); }
};

async function viewBackup() {
  return '<div class="backup-page"><div class="studio-section-title"><div><span class="studio-eyebrow">اطلاعاتت در اختیار توست</span><h2>حافظه‌ات را همراهت ببر</h2><p>یک فایل برای گفتگوها، حافظه، اسناد و تنظیمات شخصی.</p></div><span class="backup-header-icon">' + pxIcon('backup', 34) + '</span></div>' +
    '<div class="backup-grid"><section class="backup-card"><span class="backup-step">01 / ذخیره</span><h3>یک نسخه برای خودت</h3><p>اطلاعات کامل حساب را دانلود کن یا مستقیم در گفتگوی خصوصی بات دریافت کن.</p><div class="backup-features"><span>' + pxIcon('chat') + ' تاریخچهٔ گفتگو</span><span>' + pxIcon('memory') + ' حافظه و پروفایل</span><span>' + pxIcon('knowledge') + ' دانش و اسناد</span><span>' + pxIcon('settings') + ' تنظیمات و پرامپت</span></div><button class="btn pri backup-primary" onclick="downloadBackup(\'account\',\'telegram\')">' + pxIcon('chat') + ' ارسال فایل به تلگرام</button><button class="btn sec backup-primary" onclick="downloadBackup(\'account\',\'download\')">' + pxIcon('download') + ' دانلود روی دستگاه</button><div id="backupExportStatus" class="backup-inline-status" role="status" aria-live="polite"></div></section>' +
    '<section class="backup-card"><span class="backup-step">02 / انتقال</span><h3>اینجا ادامه بده</h3><p>فایل پشتیبان حساب قبلی را انتخاب کن. قبل از انتقال، خلاصهٔ محتوا را می‌بینی.</p><label class="backup-drop" for="backupFile" id="backupDrop">' + pxIcon('upload', 32) + '<strong>فایل پشتیبان را انتخاب کن</strong><span>JSON · حداکثر ۱۸ مگابایت</span><input id="backupFile" type="file" accept=".json,application/json" onchange="inspectBackupFile(this.files[0])"></label><div id="backupPreview" aria-live="polite"><div class="backup-note">' + pxIcon('check') + '<span>اطلاعات فعلی حفظ می‌شود. کارهای خودکار واردشده به صورت متوقف منتقل می‌شوند.</span></div></div></section></div>' +
    '<div class="backup-explainer"><span class="explainer-number">۱</span><p>در حساب قبلی، پشتیبان را بگیر.</p><span class="explainer-number">۲</span><p>با حساب جدید، بات را باز کن.</p><span class="explainer-number">۳</span><p>فایل را اینجا بازیابی کن یا در بات با کپشن <code>/restore</code> بفرست.</p></div>' +
    (S.isAdmin ? '<section class="database-card"><span class="database-symbol">' + pxIcon('models', 28) + '</span><div><span class="studio-eyebrow">ویژهٔ ادمین</span><h3>پشتیبان کامل دیتابیس</h3><p>تمام رکوردهای KV و D1، شامل داده‌های همهٔ حساب‌ها و تنظیمات ذخیره‌شده. کلیدهای محیطی Cloudflare داخل این فایل نیستند.</p></div><button class="btn sec" onclick="downloadBackup(\'database\',\'telegram\')">' + pxIcon('download') + ' دریافت در تلگرام</button><button class="btn gho" onclick="downloadBackup(\'database\',\'download\')">دانلود فایل</button></section>' : '') + '</div>';
}
VIEWS.backup = viewBackup;

let backupBusy = false, pendingBackup = null, backupInspection = 0;
window.downloadBackup = async function (scope, delivery) {
  if (backupBusy) return;
  backupBusy = true;
  const status = document.getElementById('backupExportStatus');
  if (status) status.textContent = 'در حال جمع‌آوری و آماده‌سازی فایل…';
  document.querySelectorAll('.backup-page button').forEach(function (button) { button.disabled = true; });
  try {
    const archive = await api('/backup/export', { body: { scope: scope, delivery: delivery }, long: true });
    if (delivery === 'download') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(archive)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'pimx-' + scope + '-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
    }
    const message = delivery === 'telegram' ? 'فایل در گفتگوی خصوصی بات ارسال شد.' : 'فایل پشتیبان آمادهٔ دانلود شد.';
    if (status) status.textContent = message;
    toast(message, 'ok');
  } catch (e) { if (status) status.textContent = e.message; toast(e.message, 'err'); }
  finally { backupBusy = false; document.querySelectorAll('.backup-page button').forEach(function (button) { button.disabled = false; }); }
};
window.inspectBackupFile = async function (file) {
  if (!file || backupBusy) return;
  pendingBackup = null;
  const generation = ++backupInspection;
  const box = document.getElementById('backupPreview');
  try {
    if (file.size > 18 * 1024 * 1024) throw new Error('فایل باید کمتر از ۱۸ مگابایت باشد.');
    box.innerHTML = '<div class="backup-inline-status">در حال بررسی فایل…</div>';
    const archive = JSON.parse(await file.text());
    const summary = await api('/backup/inspect', { body: { archive: archive }, long: true });
    if (generation !== backupInspection) return;
    pendingBackup = archive;
    box.innerHTML = '<div class="backup-preview"><div class="row gap8">' + pxIcon('check') + '<strong>فایل معتبر است</strong></div><span class="backup-file-name">' + h(file.name) + '</span><div class="backup-counts"><span><b>' + n(summary.conversations) + '</b> گفتگو</span><span><b>' + n(summary.memories) + '</b> بخش حافظه</span><span><b>' + n(summary.documents) + '</b> سند</span></div><p>' + n(summary.records) + ' رکورد به حساب فعلی منتقل می‌شود. داده‌های دیگر کاربران منتقل نمی‌شود.</p><button class="btn pri backup-primary" onclick="confirmBackupRestore()">تأیید و انتقال به حساب من ' + pxIcon('arrow') + '</button></div>';
  } catch (e) { if (generation === backupInspection) box.innerHTML = '<div class="backup-error" role="alert">' + h(e instanceof SyntaxError ? 'فایل JSON قابل خواندن نیست.' : e.message) + '</div>'; }
};
window.confirmBackupRestore = async function () {
  if (!pendingBackup || backupBusy) return;
  backupBusy = true;
  const box = document.getElementById('backupPreview');
  box.innerHTML = '<div class="backup-inline-status">در حال انتقال اطلاعات…</div>';
  try {
    const result = await api('/backup/restore', { body: { archive: pendingBackup, confirm: true }, long: true });
    pendingBackup = null; bust(); S.chat.id = null; S.chat.loadedId = null; S.chat.messages = []; S.deadConvs = {};
    box.innerHTML = '<div class="backup-preview"><strong>✓ اطلاعاتت منتقل شد</strong><p>' + n(result.imported) + ' رکورد ذخیره شد. حالا می‌توانی گفتگوها را ادامه بدهی.</p><button class="btn pri" onclick="go(\'chat\')">ادامهٔ گفتگو ' + pxIcon('arrow') + '</button></div>';
    toast('انتقال کامل شد', 'ok');
  } catch (e) { box.innerHTML = '<div class="backup-error">' + h(e.message) + '</div><button class="btn sec" onclick="confirmBackupRestore()">تلاش دوباره</button>'; }
  finally { backupBusy = false; }
};
window.AFTER.backup = function () {
  const drop = document.getElementById('backupDrop');
  if (!drop) return;
  drop.addEventListener('dragover', function (event) { event.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', function () { drop.classList.remove('dragging'); });
  drop.addEventListener('drop', function (event) { event.preventDefault(); drop.classList.remove('dragging'); inspectBackupFile(event.dataTransfer.files[0]); });
};
`;
