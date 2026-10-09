import { pxText, pxTemplate } from '../i18n/server.js';
// ─────────────────────────────────────────────
// 🔐 Telegram Mini App authentication (initData HMAC verification)
// شناسه کاربر هرگز از فرانتاند پذیرفته نمیشود — فقط از initData امضاشده
// ─────────────────────────────────────────────

async function hmac(keyBytes, msg) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}

function hex(bytes) { return [...bytes].map(b => b.toString(16).padStart(2, "0")).join(""); }

export async function verifyInitData(initData, botToken, { maxAgeSec = 86400 } = {}) {
  if (!initData) return { ok: false, error: pxText("initData موجود نیست") };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: pxText("hash موجود نیست") };
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => [k, v])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = await hmac(new TextEncoder().encode("WebAppData"), botToken);
  const sig = await hmac(secret, dataCheckString);
  if (hex(sig) !== hash) return { ok: false, error: pxText("امضای initData نامعتبر است") };

  const authDate = Number(params.get("auth_date") || 0);
  if (maxAgeSec && authDate && Date.now() / 1000 - authDate > maxAgeSec) {
    return { ok: false, error: pxText("initData منقضی شده — Mini App را دوباره باز کنید") };
  }
  let user = null;
  try { user = JSON.parse(params.get("user") || "null"); } catch {}
  if (!user?.id) return { ok: false, error: pxText("کاربر در initData نیست") };
  return { ok: true, user, authDate, startParam: params.get("start_param") || null };
}

import { kvGet, kvPut } from "../core/kv.js";

// توکن نشست کوتاهمدت برای فراخوانیهای بعدی (بدون ارسال مکرر initData)
export async function issueSession(env, user) {
  const token = crypto.randomUUID().replace(/-/g, "");
  await kvPut(env, `session:${token}`, { userId: user.id, name: user.first_name || "", ts: Date.now() }, { expirationTtl: 43200 });
  return token;
}

export async function readSession(env, token) {
  if (!token) return null;
  return await kvGet(env, `session:${token}`, null);
}

// احراز هویت درخواست API: Bearer session یا هدر initData
export async function authenticate(request, env, botToken) {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const s = await readSession(env, auth.slice(7).trim());
    if (s) return { ok: true, userId: Number(s.userId), name: s.name, via: "session" };
  }
  const initData = request.headers.get("x-telegram-init-data") || "";
  if (initData) {
    const v = await verifyInitData(initData, botToken);
    if (v.ok) return { ok: true, userId: Number(v.user.id), name: v.user.first_name || "", via: "initData", user: v.user };
    return { ok: false, error: v.error, status: 401 };
  }
  // حالت توسعه: فقط اگر ADMIN_API_TOKEN تنظیم شده باشد
  const devToken = request.headers.get("x-admin-token");
  if (devToken && env.ADMIN_API_TOKEN && devToken === env.ADMIN_API_TOKEN) {
    return { ok: true, userId: Number(env.ADMIN_ID || 0), name: "admin", via: "adminToken" };
  }
  return { ok: false, error: pxText("احراز هویت لازم است"), status: 401 };
}

// محدودیت نرخ API (KV-based، سبک)
const apiHits = new Map();
export function rateLimitApi(userId, limit = 90, windowMs = 60000) {
  const now = Date.now();
  const arr = (apiHits.get(userId) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) { apiHits.set(userId, arr); return true; }
  arr.push(now);
  apiHits.set(userId, arr);
  return false;
}
