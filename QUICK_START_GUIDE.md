# 🚀 راهنمای سریع راه‌اندازی PIMXAGENT

## ✅ مرحله 1: تنظیم Secrets (حتماً انجام دهید!)

```powershell
cd d:\bot

# 1. توکن تلگرام (حتماً)
npx wrangler secret put BOT_TOKEN
# paste: REDACTED_CREDENTIAL

# 2. Admin ID (حتماً)
npx wrangler secret put ADMIN_ID
# paste: 5675632554

# 3-6. پروایدرهای اختیاری (اگر الان ندارید، بعداً از مینی اپ اضافه کنید)
npx wrangler secret put GEMINI_API_KEYS_JSON
# paste: [""] یا اگر ندارید Enter بزنید

npx wrangler secret put NVIDIA_KEYS_JSON
# paste: [""]

npx wrangler secret put OPENROUTER_API_KEY
# paste: ""

npx wrangler secret put MISTRAL_API_KEY
# paste: ""
```

---

## 🚀 مرحله 2: Deploy

```powershell
npm run deploy
```

---

## 🔗 مرحله 3: تنظیم Webhook

این لینک را در مرورگر باز کنید:
```
https://api.telegram.org/bot8327417666:AAHzY4miCNMStgvkQ8sL6ct_KV07Ypj58hM/setWebhook?url=https://ai-telegram-bot.mohammadrezaabedinpoor6.workers.dev/webhook
```

باید ببینید: `{"ok":true,"result":true,"description":"Webhook was set"}`

---

## 🎯 مرحله 4: Initialize کردن (مهم!)

این لینک را باز کنید تا بات initialize شود:
```
https://ai-telegram-bot.mohammadrezaabedinpoor6.workers.dev/setup
```

---

## ✅ مرحله 5: تست بات

1. به بات تلگرام خود بروید
2. دستور `/start` را بزنید
3. دستور `/app` را بزنید تا مینی اپ باز شود

---

## 🤖 مرحله 6: اضافه کردن پروایدر (از مینی اپ)

### پروایدرهای از پیش تعریف شده:
بعد از باز کردن مینی اپ، به بخش "Providers" بروید:

**13 پروایدر آماده:**
1. **OpenAI** 🤖 - GPT-4, GPT-3.5
2. **Claude** 🧠 - Claude 3.5 Sonnet
3. **Gemini** ✨ - Gemini 1.5 Pro/Flash
4. **DeepSeek** 🔍 - DeepSeek models
5. **Grok** 🚀 - xAI Grok
6. **Groq** ⚡ - Ultra-fast inference
7. **Kimi AI** 🌙 - Moonshot Kimi
8. **Mistral** 🌊 - Mistral Large
9. **Ollama** 🏠 - Local models
10. **NVIDIA NIM** 💚 - NVIDIA hosted
11. **OpenRouter** 🌐 - 100+ models
12. **HuggingFace** 🤗 - Serverless inference
13. **Cloudflare** ☁️ - Workers AI

**روش اضافه کردن:**
1. روی یکی از پروایدرهای بالا کلیک کنید
2. فقط API Key را وارد کنید
3. Save کنید
4. تست کنید

### پروایدر کاستوم:
- روی "Custom Provider" کلیک کنید
- تمام فیلدها را پر کنید (نام، URL، API Key، فرمت)
- می‌توانید بی‌نهایت پروایدر کاستوم اضافه کنید

---

## ⚠️ نکات مهم:

### اگر بات جواب نمی‌دهد:
```powershell
# لاگ‌ها را ببینید
npx wrangler tail
```

### اگر مینی اپ Loading می‌ماند:
1. F12 را بزنید (Developer Tools)
2. Console را ببینید
3. خطاها را بخوانید

### اگر می‌گوید "هیچ مدل سالمی موجود نیست":
- یعنی هنوز پروایدری اضافه نکرده‌اید
- به مینی اپ بروید و یک پروایدر اضافه کنید

---

## 📋 Checklist:

- [ ] `npx wrangler secret put BOT_TOKEN` انجام شد
- [ ] `npx wrangler secret put ADMIN_ID` انجام شد
- [ ] `npm run deploy` موفق بود
- [ ] Webhook تنظیم شد (لینک setWebhook)
- [ ] `/setup` باز شد
- [ ] `/start` در بات کار می‌کند
- [ ] `/app` مینی اپ را باز می‌کند
- [ ] یک پروایدر اضافه کردم
- [ ] بات به پیام‌ها جواب می‌دهد

---

## 🆘 عیب‌یابی سریع:

### خطا: "No Gemini API keys configured"
- این هشدار است، نه خطا
- اگر Gemini ندارید، نادیده بگیرید
- از مینی اپ پروایدر دیگری اضافه کنید

### خطا: "ADMIN_ID not configured"
- حتماً `npx wrangler secret put ADMIN_ID` را اجرا کنید
- عدد `5675632554` را وارد کنید

### خطا: "Not Found" در setWebhook
- مطمئن شوید توکن را کامل کپی کرده‌اید
- بین `bot` و توکن فاصله نگذارید

---

## 🎉 موفقیت!

اگر همه Checklist بالا ✅ است، بات شما فعال است!

برای استفاده:
1. به بات بروید
2. پیام بدهید
3. از `/app` برای مینی اپ استفاده کنید

---

**نکته:** هشدارهای "No Gemini/NVIDIA keys" عادی هستند. تا وقتی که یک پروایدر از مینی اپ اضافه کنید، بات کار نمی‌کند.
