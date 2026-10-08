export const VIEW_HOME = String.raw`
async function viewHomeV2() {
  const results = await Promise.allSettled([api('/dashboard'), convList(), cached('preferences', function () { return api('/preferences'); })]);
  if (results[0].status === 'rejected') throw results[0].reason;
  const d = results[0].value, snap = d.snapshot || {};
  const convs = results[1].status === 'fulfilled' ? results[1].value : [];
  S.preferences = results[2].status === 'fulfilled' ? results[2].value : { responseMode: 'speed' };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صبح بخیر' : hour < 18 ? 'عصر بخیر' : 'شب بخیر';
  const tools = [
    ['council', 'چند ذهن، یک پاسخ', 'نظر چند مدل را کنار هم ببین', 'violet'],
    ['knowledge', 'از دانش خودت بپرس', 'پاسخ بر اساس فایل‌ها و اسناد', 'mint'],
    ['prompts', 'ایده را بهتر بنویس', 'پرامپت‌های آماده و شخصی', 'amber'],
    ['agents', 'کار را بسپار', 'عامل‌ها و ابزارهای هوشمند', 'coral']
  ];
  const recent = convs.slice(0, 4);
  return '<div class="studio-home">' +
    '<div class="studio-greeting"><div class="row gap12">' + avatarHtml(40) + '<div><div class="studio-eyebrow">فضای شخصی تو</div><h2>' + greeting + '، ' + h(userLabel()) + ' <span class="hello-dot">✦</span></h2></div></div><span class="studio-date">' + h(new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' })) + '</span></div>' +
    '<section class="studio-hero"><div class="hero-copy"><span class="hero-label"><span></span> PIMX PERSONAL AI</span><h1>هر ایده،<br><em>یک شروع تازه.</em></h1><p>فکر کن، بساز، یاد بگیر.<br>دستیار تو، با حافظه‌ای که همراهت می‌ماند.</p><div class="hero-models"><span class="mini-stack">' + pxIcon('models') + '</span><span>' + n(snap.modelsHealthy || 0) + ' مدل آماده <span class="studio-separator">/</span> انتخاب با تو</span><button onclick="go(\'models\')" aria-label="انتخاب مدل">' + pxIcon('arrow') + '</button></div></div>' +
    '<div class="hero-art" aria-hidden="true"><div class="orbit-grid"></div><div class="orbit-ring ring-one"></div><div class="orbit-ring ring-two"></div><div class="orbit-ring ring-three"></div><div class="orbit-core"><span>✦</span></div><div class="orbit-label label-one">' + pxIcon('bolt') + ' پاسخ زنده</div><div class="orbit-label label-two">' + pxIcon('memory') + ' حافظهٔ شخصی</div><div class="orbit-star star-one">✧</div><div class="orbit-star star-two">+</div><div class="orbit-coordinates">IDEAS → POSSIBILITIES</div></div></section>' +
    '<section class="start-box"><form onsubmit="event.preventDefault();homeAsk()"><label class="sr-only" for="homePrompt">پیام به دستیار</label><textarea id="homePrompt" rows="2" placeholder="امروز چه چیزی توی ذهنته؟"></textarea><div class="start-footer"><div class="response-switch" aria-label="حالت پاسخ">' + responseModesHtml() + '</div><button class="studio-send" type="submit" aria-label="شروع گفتگو">' + pxIcon('arrow') + '<span>بریم سراغش</span></button></div></form></section>' +
    '<div class="prompt-chips"><button onclick="launchPrompt(\'برای انجام کارهای امروز یک برنامه عملی و کوتاه پیشنهاد بده\')">' + pxIcon('plan') + ' روزم را برنامه‌ریزی کن</button><button onclick="launchPrompt(\'در نقش یک ایده‌پرداز کمکم کن ایده‌ام را بهتر کنم. اول از من درباره ایده بپرس\')">' + pxIcon('spark') + ' یک ایده بسازیم</button><button onclick="launchPrompt(\'برای یادگیری یک مهارت جدید کمکم کن. اول بپرس چه مهارتی می‌خواهم یاد بگیرم\')">' + pxIcon('knowledge') + ' چیزی یاد بگیریم</button></div>' +
    (!snap.providers ? '<div class="studio-onboarding"><div>' + pxIcon('provider') + '<strong>اولین مدل را وصل کن</strong><p>یک پروایدر اضافه کن تا گفتگو و ابزارها آماده شوند.</p></div><button class="btn pri" onclick="providerPresets()">انتخاب پروایدر ' + pxIcon('arrow') + '</button></div>' : '') +
    '<div class="studio-section-title"><div><span class="studio-eyebrow">بیشتر از یک گفتگو</span><h3>برای هر کاری، یک راه تازه</h3></div><button onclick="go(\'tools\')">همهٔ ابزارها ' + pxIcon('arrow') + '</button></div><div class="studio-tools">' + tools.map(function (t) { return '<button class="studio-tool tone-' + t[3] + '"' + act('go', t[0]) + '><span class="tool-symbol">' + pxIcon(t[0]) + '</span><span class="tool-arrow">' + pxIcon('arrow') + '</span><strong>' + t[1] + '</strong><span class="tool-description">' + t[2] + '</span></button>'; }).join('') + '</div>' +
    '<div class="studio-bottom"><section class="recent-panel"><div class="studio-section-title"><h3>از همین‌جا ادامه بده</h3><button onclick="go(\'chat\')">گفتگوها ' + pxIcon('arrow') + '</button></div>' + (recent.length ? recent.map(function (c) { return '<button class="recent-chat"' + act('openConv', c.id) + '><span class="recent-icon">' + pxIcon(c.pinned ? 'pin' : 'chat') + '</span><span class="recent-copy"><strong>' + h(c.title || 'گفتگو') + '</strong><small>' + h(c.preview || 'برای ادامه باز کن') + '</small></span><time>' + h(rel(c.updatedAt)) + '</time>' + pxIcon('arrow') + '</button>'; }).join('') : '<div class="studio-empty">' + pxIcon('chat') + '<strong>اولین گفتگو منتظر توست</strong><p>یک پیام بنویس؛ ادامهٔ آن همین‌جا می‌ماند.</p></div>') + '</section>' +
    '<section class="carry-card"><span class="carry-icon">' + pxIcon('backup') + '</span><span class="studio-eyebrow">حافظه‌ات، همراهت</span><h3>همه‌چیز را<br>با خودت ببر.</h3><p>گفتگو، حافظه و اسنادت را در یک فایل ذخیره کن و روی حساب دیگر ادامه بده.</p><button onclick="go(\'backup\')">پشتیبان و انتقال ' + pxIcon('arrow') + '</button></section></div>' +
    '<div class="studio-status"><span><i class="status-dot' + (snap.providersHealthy ? ' live' : '') + '"></i>' + (snap.providersHealthy ? n(snap.providersHealthy) + ' پروایدر آماده' : 'پروایدر آماده‌ای نیست') + '</span><button onclick="go(\'monitor\')">وضعیت پلتفرم ' + pxIcon('arrow') + '</button><span class="studio-keyhint">جستجوی سریع <kbd>Ctrl K</kbd></span></div></div>';
}
VIEWS.home = viewHomeV2;
`;
