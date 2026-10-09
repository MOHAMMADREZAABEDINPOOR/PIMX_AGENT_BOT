# Persian and English

The Telegram bot and Mini App share a saved language preference for each Telegram account. Supported values are `fa` (Persian) and `en` (English).

On the first `/start`, the bot offers **فارسی** and **English**. Choosing a language opens the welcome screen and main menu in that language and updates the private chat's Telegram command menu. Later starts keep the saved choice. Use `/language`, `/lang` or the language button in bot settings to change it.

The Mini App header has an **EN / فا** button. Switching saves the account preference and reloads the current route with the correct direction, translated interface and local date format. Unsent home/chat text is retained for the same account. English uses LTR; Persian uses RTL. Opening a different Telegram account loads that account's preference.

Messages, names, conversation titles, documents, identifiers and provider responses retain their original content. Translation applies to authored interface literals and template fragments, preserving interpolated values. AI requests include the selected response language while allowing explicit translation targets and exact output formats.

## Maintaining translations

- `src/i18n/en.json` contains the checked-in English phrase catalog. Persian remains the source copy.
- `pxText('متن فارسی')` localizes a static literal. Use `pxTemplate` for templates with dynamic values; those values are preserved.
- Server language context uses `AsyncLocalStorage`, keeping concurrent users isolated. Scheduled reminders, tasks and bot notifications also load account preferences.
- `GET /api/preferences` returns the account preference. `PATCH /api/preferences` accepts `{ "language": "en" }` or `{ "language": "fa" }` without replacing the response mode. Other language values return HTTP 400.
- Translation runs locally from the catalog. No translation service is called when using the bot or Mini App.
- Run `npm test` and `npm run test:ui` to verify bot language selection, concurrent users, browser switching, account isolation, content preservation and model response instructions.

## فارسی

بات و مینی‌اپ زبان هر حساب تلگرام را مشترک ذخیره می‌کنند. در اولین `/start`، فارسی یا انگلیسی را انتخاب کن؛ دفعات بعد همان انتخاب باقی می‌ماند. برای تغییر زبان از `/language`، `/lang` یا دکمهٔ زبان در تنظیمات بات استفاده کن.

در هدر مینی‌اپ، دکمهٔ **EN / فا** زبان را تغییر می‌دهد. انتخاب ذخیره می‌شود و مسیر فعلی با چیدمان فارسی راست‌به‌چپ یا انگلیسی چپ‌به‌راست باز می‌شود. متن نوشته‌شده و ارسال‌نشدهٔ خانه یا چت در همان حساب حفظ می‌شود. زبان حساب دیگر به‌صورت مستقل بارگذاری می‌شود.

نام‌ها، عنوان گفتگوها، اسناد و پیام‌های شخصی ترجمه یا بازنویسی نمی‌شوند. ترجمهٔ رابط از فایل محلی انجام می‌شود و سرویس خارجی در زمان استفاده فراخوانی نمی‌شود. درخواست‌های هوش مصنوعی نیز زبان انتخابی را دریافت می‌کنند؛ زبان مقصد ترجمه و قالب خروجی مشخص همچنان رعایت می‌شود.
