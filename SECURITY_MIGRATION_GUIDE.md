# 🔐 CRITICAL SECURITY MIGRATION GUIDE

## ⚠️ IMMEDIATE ACTION REQUIRED

**Status:** 36 API keys were found hardcoded in `index.js` lines 43-84 and are now **PUBLICLY EXPOSED**.

**Risk Level:** 🔴 CRITICAL

---

## 📋 STEP-BY-STEP MIGRATION PROCESS

### ✅ STEP 1: REVOKE ALL EXPOSED KEYS (DO THIS FIRST!)

All keys found in the previous version of `index.js` **MUST** be revoked immediately:

#### 1.1 Telegram Bot Token
- Go to: [@BotFather](https://t.me/BotFather) on Telegram
- Send: `/mybots`
- Select your bot
- Select: **API Token** → **Revoke current token**
- Copy the NEW token (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

#### 1.2 Gemini API Keys (2 keys)
- Go to: [Google AI Studio](https://aistudio.google.com/app/apikey)
- Find your existing keys
- Click **Delete** on each exposed key
- Click **Create API Key** twice to generate 2 new keys
- Copy both keys (format: `AIza...`)

#### 1.3 NVIDIA NIM Keys (32 keys)
- Go to: [NVIDIA NGC Dashboard](https://org.ngc.nvidia.com/setup/api-key)
- Click **Generate New API Key** (this revokes old keys)
- You'll need to generate multiple keys if you have multiple accounts
- Copy all keys (format: `nvapi-...`)

#### 1.4 OpenRouter API Key
- Go to: [OpenRouter Keys](https://openrouter.ai/keys)
- Find your existing key
- Click **Revoke**
- Click **Create Key**
- Copy the new key (format: `sk-or-v1-...`)

#### 1.5 Mistral API Key
- Go to: [Mistral Console](https://console.mistral.ai/api-keys/)
- Find your existing key
- Click **Delete**
- Click **Create new key**
- Copy the new key (format: alphanumeric string)

---

### ✅ STEP 2: SET CLOUDFLARE SECRETS

Now that you have NEW keys, store them securely using Cloudflare Secrets:

```powershell
# Navigate to your project directory
cd d:\bot

# 1. Set Telegram Bot Token
npx wrangler secret put BOT_TOKEN
# Paste your NEW token when prompted, then press Enter

# 2. Set Gemini API Keys (as JSON array)
npx wrangler secret put GEMINI_API_KEYS_JSON
# Paste: ["YOUR_GEMINI_KEY_1", "YOUR_GEMINI_KEY_2"]
# Then press Enter

# 3. Set NVIDIA Keys (as JSON array)
npx wrangler secret put NVIDIA_KEYS_JSON
# Paste: ["nvapi-key1", "nvapi-key2", ..., "nvapi-key32"]
# Then press Enter

# 4. Set OpenRouter Key
npx wrangler secret put OPENROUTER_API_KEY
# Paste your NEW OpenRouter key, then press Enter

# 5. Set Mistral Key
npx wrangler secret put MISTRAL_API_KEY
# Paste your NEW Mistral key, then press Enter

# 6. Set Admin Telegram ID
npx wrangler secret put ADMIN_ID
# Paste: 5675632554 (or your admin Telegram user ID)
# Then press Enter
```

**Important Notes:**
- For `GEMINI_API_KEYS_JSON` and `NVIDIA_KEYS_JSON`, paste the ENTIRE JSON array as a single line
- DO NOT include spaces or newlines in the JSON arrays
- Example: `["key1","key2","key3"]`

---

### ✅ STEP 3: VERIFY SECRETS ARE SET

```powershell
# List all secrets (will NOT show values, only names)
npx wrangler secret list
```

You should see:
```
BOT_TOKEN
GEMINI_API_KEYS_JSON
NVIDIA_KEYS_JSON
OPENROUTER_API_KEY
MISTRAL_API_KEY
ADMIN_ID
```

---

### ✅ STEP 4: DEPLOY THE SECURE VERSION

```powershell
# Deploy with new secrets
npm run deploy
```

The deployment will:
- Use secrets from Cloudflare's encrypted secret store
- Log warnings if any secrets are missing
- Initialize all providers with the new keys

---

### ✅ STEP 5: VERIFY DEPLOYMENT

```powershell
# Check deployment logs
npx wrangler tail
```

Look for these messages:
- ✅ `[PIMXAGENT] Secrets initialized successfully`
- ❌ `❌ CRITICAL: BOT_TOKEN not set` (means Step 2 failed)
- ⚠️ `⚠️ WARNING: No Gemini API keys configured` (means GEMINI_API_KEYS_JSON is missing)

---

## 🧪 TESTING THE MIGRATION

### Test 1: Telegram Bot
```
1. Open Telegram
2. Send a message to your bot
3. Verify it responds
```

### Test 2: Mini App
```
1. Open: https://ai-telegram-bot.mohammadrezaabedinpoor6.workers.dev/app
2. Authenticate via Telegram
3. Send a test message
4. Verify response appears
```

### Test 3: Provider Health
```
1. In Mini App, go to: Providers tab
2. Check all providers show "Active" status
3. Click "Test Model" on any model
4. Verify test succeeds
```

---

## 🔍 WHAT CHANGED IN THE CODE

### Before (INSECURE):
```javascript
const BOT_TOKEN = "REDACTED_CREDENTIAL"; // ❌ EXPOSED
const GEMINI_API_KEYS = ["key1", "key2"]; // ❌ EXPOSED
// ... 32 more hardcoded keys
```

### After (SECURE):
```javascript
let BOT_TOKEN = null;
let GEMINI_API_KEYS = [];
// ...

function initializeSecrets(env) {
  BOT_TOKEN = env.BOT_TOKEN || null; // ✅ From Cloudflare Secrets
  GEMINI_API_KEYS = JSON.parse(env.GEMINI_API_KEYS_JSON); // ✅ Encrypted
  // ...
}
```

---

## 🛡️ SECURITY BEST PRACTICES

### ✅ DO:
- Store ALL secrets in Cloudflare Secrets or environment variables
- Rotate API keys every 90 days
- Use separate keys for development and production
- Monitor API usage for unusual activity
- Enable rate limiting on all API endpoints

### ❌ DON'T:
- Commit API keys to Git (use `.gitignore`)
- Share keys via Telegram, Discord, or email
- Use the same key across multiple projects
- Store keys in plain text files
- Leave old keys active after rotation

---

## 📊 SECRETS INVENTORY

| Secret Name | Provider | Type | Count | Format |
|-------------|----------|------|-------|--------|
| `BOT_TOKEN` | Telegram | String | 1 | `1234567890:ABC...` |
| `GEMINI_API_KEYS_JSON` | Google | JSON Array | 2 | `["AIza...", "AIza..."]` |
| `NVIDIA_KEYS_JSON` | NVIDIA | JSON Array | 32 | `["nvapi-...", ...]` |
| `OPENROUTER_API_KEY` | OpenRouter | String | 1 | `sk-or-v1-...` |
| `MISTRAL_API_KEY` | Mistral | String | 1 | `alphanumeric` |
| `ADMIN_ID` | Custom | Number | 1 | `5675632554` |

**Total:** 39 secrets (36 API keys + 3 config values)

---

## 🚨 TROUBLESHOOTING

### Issue: "BOT_TOKEN not set" error after deployment
**Solution:** Run `npx wrangler secret put BOT_TOKEN` again and paste the correct value

### Issue: "Failed to parse GEMINI_API_KEYS_JSON"
**Solution:** Ensure you're pasting valid JSON: `["key1","key2"]` (no spaces, no newlines)

### Issue: Bot doesn't respond after deployment
**Solution:** 
1. Check `npx wrangler tail` for error messages
2. Verify all secrets are set: `npx wrangler secret list`
3. Test each provider individually in Mini App

### Issue: "Cannot read properties of undefined (reading 'length')"
**Solution:** NVIDIA_KEYS_JSON or GEMINI_API_KEYS_JSON is missing - set them as JSON arrays

---

## ✅ MIGRATION CHECKLIST

- [ ] Step 1.1: Revoked Telegram bot token
- [ ] Step 1.2: Revoked 2 Gemini keys
- [ ] Step 1.3: Revoked 32 NVIDIA keys
- [ ] Step 1.4: Revoked OpenRouter key
- [ ] Step 1.5: Revoked Mistral key
- [ ] Step 2: Set all 6 Cloudflare secrets
- [ ] Step 3: Verified secrets list
- [ ] Step 4: Deployed secure version
- [ ] Step 5: Checked deployment logs
- [ ] Test 1: Telegram bot responds
- [ ] Test 2: Mini App works
- [ ] Test 3: Provider health checks pass

---

## 📞 SUPPORT

If you encounter issues during migration:
1. Check deployment logs: `npx wrangler tail`
2. Verify secrets: `npx wrangler secret list`
3. Review the code changes in `index.js` lines 43-130

---

## 📝 POST-MIGRATION

After successful migration:
1. ✅ Delete this guide (contains sensitive information)
2. ✅ Add `.env` to `.gitignore` if using local env files
3. ✅ Update documentation with new secrets management process
4. ✅ Schedule key rotation reminder for 90 days from now

---

**Migration Created:** 2026-08-11  
**Status:** Ready to Execute  
**Priority:** 🔴 CRITICAL - Execute immediately
