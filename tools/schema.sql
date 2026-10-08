-- ─────────────────────────────────────────────
-- PIMXAGENT — D1 schema
-- اجرا: npx wrangler d1 execute telegram-multi-ai-bots --remote --file tools/schema.sql
-- این جدول ذخیرهساز اصلی لایهٔ kv.js است (کلیدهای پیشونددار pf:)
-- در صورت نبود آن، کد بهصورت خودکار روی Cloudflare KV عقبنشینی میکند
-- (و سقف نوشتن KV بهسرعت پر میشود) — پس اجرای این فایل لازم است.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kv_store (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  expiration INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_kv_exp ON kv_store (expiration);
CREATE INDEX IF NOT EXISTS idx_kv_updated ON kv_store (updated_at);

-- بازهٔ نگهداری لاگهای ساده (اختیاری، برای رشد کمتر دیتابیس)
CREATE INDEX IF NOT EXISTS idx_kv_prefix ON kv_store (substr(key, 1, 12));
