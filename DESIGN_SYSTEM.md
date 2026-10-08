# 🎨 PIMXAGENT Design System

نسخه ۲.۰ — زبان طراحی مشترک بین **ربات تلگرام** و **Mini App**.
هدف: یک محصول AI حرفهای و Premium؛ نه یک بات قدیمی و نه یک داشبورد شلوغ.

---

## ۱. فایلها

| فایل | نقش |
|------|-----|
| `src/ui/theme.js` | توکنهای طراحی (رنگ، فاصله، Radius، سایه، حرکت) + تم روشن + دسترسپذیری + همگامسازی تم تلگرام |
| `src/ui/kit-css.js` | لایهٔ کامپوننتها: کارت، KPI، Badge، List، Timeline، States، Sheet، Palette، Bottom Nav، Light-theme fixes |
| `src/ui/kit.js` | کامپوننتهای JS مینیاپ (روی `window`) + Command Palette با جستجوی واقعی `/api/search` |
| `src/ui/tg.js` | سیستم پیام و کیبورد تلگرام (HTML parse mode) + Sanitizer |
| `src/miniapp/css.js` | `base CSS (سازگاری) + tokensCss + light + a11y + KIT_CSS` |
| `src/miniapp/views-home.js` | داشبورد جدید (`VIEWS.home`) |
| `tools/smoke.mjs` | تست خودکار: syntax باندل، Callbackها، HTML پیامها، Secret، توکنها، Regression |

---

## ۲. توکنها (تکمنبع حقیقت)

همهٔ مقادیر در `theme.js` → `TOKENS` تعریف شدهاند و بهصورت CSS Variable تزریق میشوند:

```
--px-bg --px-bg-soft --px-surface --px-surface-2 --px-surface-3 --px-glass
--px-line --px-line-2 --px-line-acc
--px-text --px-text-2 --px-muted --px-dim
--px-acc --px-ok --px-warn --px-bad --px-info  (+ --px-*-soft)
--px-r-xs..xl --px-e1..e4 --px-d-fast/--px-d/--px-d-slow --px-ease
--px-s1..s8 --px-nav --px-head --px-tab --px-pad
```

نامهای قدیمی (`--bg`, `--acc`, `--r`, `--sh`, `--line`, …) بهعنوان **Alias** نگاشت شدهاند
تا کل CSS و Viewهای موجود بدون تغییر و بدون شکستن ظاهر کار کنند.

> ⚠️ قاعده: هیچ رنگ/فاصلهٔ جدیدی هاردکد نکنید؛ فقط از توکنها استفاده کنید.

---

## ۳. کامپوننتهای Mini App (window.*)

| کامپوننت | کاربرد |
|----------|--------|
| `pageHead({title, sub, actions, back})` | سرصفحهٔ هر صفحه |
| `sectionHead({icon, title, sub, count, actions})` | سرتیتر بخشهای داخل صفحه |
| `card({title, sub, icon, actions, body, foot, tone, flat})` | گروهبندی اطلاعات (نه همهچیز!) |
| `stat({label, value, sub, icon, meter, meterKind, spark, kind, onclick})` | KPI با Meter و Sparkline |
| `metric(label, value, unit)` · `bar()` · `progressBar()` · `ring()` | نمایش کمی |
| `bdg()` `statusBdg()` `modelBdg()` `provBdg()` `capBdg()` | برچسبهای وضعیت/مدل/پروایدر/قابلیت |
| `li()` `lst()` `rowsBlock()` `dataRow()` `kv()` | ردیفها و لیستها |
| `pxState()` `empty()` `loading()` `skel()` `errBox()` `note()` `alertBox()` | همهٔ حالتها |
| `timeline()` `agentSteps()` | مراحل ایجنت/اجرا |
| `sourceList()` `quoteBlock()` `linkBlock()` | منابع، نقلقول، لینک |
| `activityFeed()` | فید فعالیت |
| `actionGroup()` `segmented()` `searchField()` `toolbar()` `tabsBar()` | کنترلها |
| `toast()` `sheet()` `confirmSheet()` `editSheet()` | بازخورد و فرم |
| `palette()` | Command Palette (`Ctrl/Cmd+K`) با جستجوی زنده در پلتفرم |

همهٔ اینها **جایگزین پریمیتیوهای قدیمی با همان امضا** شدهاند؛ بنابراین هر View موجود
بهصورت خودکار ظاهر و رفتار جدید (حالتها، سایهها، RTL، Light theme) را میگیرد.

---

## ۴. سیستم پیام تلگرام (`src/ui/tg.js`)

- `TG.b/i/u/code/pre/link/spoiler/quote/expandable/divider/progress/mono/kv/…`
- `TGM.answer/research/council/agent/wizard/listPage/success/error/loading`
- `KB.btn/grid/nav/confirm/pager/toggle/merge` — حداکثر ۲–۳ دکمه در هر ردیف
- `TG.safe()` — حذف تگهای خطرناک از خروجی مدل قبل از ارسال (جلوگیری از شکست parse و XSS)
- `TG.clamp()` / `tgChunks()` — احترام به سقف ۴۰۹۶ کاراکتر
- `KB.btn()` طول `callback_data` را به ۶۴ کاراکتر و متن دکمه را کوتاه میکند

قواعد طراحی پیام: سلسلهمراتب با `title → divider → section → body → meta` و اسکنپذیری سریع.

---

## ۵. دسترسپذیری

- `:focus-visible` روی همهٔ کنترلها
- `aria-label`/`aria-current`/`role` در ناوبری، Sheet و Palette
- احترام به `prefers-reduced-motion` و `prefers-contrast`
- Tap target حداقل ۳۴–۴۴px، احترام به `env(safe-area-inset-*)`
- تضاد رنگ در هر دو تم تیره/روشن

---

## ۶. تست

```bash
npm run smoke     # ۷ بخش تست خودکار (بدون شبکه/کلید)
npm run check     # syntax index.js
npm run deploy    # انتشار روی Cloudflare Workers
```

`npm run smoke` شامل: syntax باندل، یکپارچگی handlerها، اعتبارسنجی HTML پیامها،
محدودیتهای تلگرام، لو نرفتن Secret در فرانتاند، وجود توکنها/کامپوننتها،
هندلر داشتن Callbackها و Regression تعداد دستورها/Routes.
