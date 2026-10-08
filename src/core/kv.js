// ─────────────────────────────────────────────
// 🗂 Cloudflare D1 & KV Storage Layer
// دیتابیس رابطه‌ای D1 به عنوان ذخیره‌ساز اصلی (با سقف ۱۰۰,۰۰۰ نوشتن در روز)
// و پشتیبانی کمکی/انتقال نرم از BOT_KV بدون وقوع خطای محدودیت روزانه
// ─────────────────────────────────────────────

const P = "pf:";

function hasD1(env) {
  return Boolean(env && env.DB && typeof env.DB.prepare === "function");
}

export async function kvGet(env, key, def = null) {
  const fullKey = P + key;
  if (hasD1(env)) {
    try {
      const row = await env.DB.prepare("SELECT value, expiration FROM kv_store WHERE key = ?").bind(fullKey).first();
      if (row) {
        if (row.expiration && row.expiration < Math.floor(Date.now() / 1000)) {
          env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(fullKey).run().catch(() => {});
          return def;
        }
        return JSON.parse(row.value);
      }
      // اگر هنوز در D1 نبود، از KV قدیمی می‌خوانیم و در D1 کپی می‌کنیم
      if (env.BOT_KV) {
        const raw = await env.BOT_KV.get(fullKey);
        if (raw !== null && raw !== undefined) {
          const parsed = JSON.parse(raw);
          env.DB.prepare(
            "INSERT INTO kv_store (key, value, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
          ).bind(fullKey, raw).run().catch(() => {});
          return parsed;
        }
      }
      return def;
    } catch {
      // Fallback
    }
  }

  // اگر D1 نبود
  try {
    const raw = await env.BOT_KV?.get(fullKey);
    if (raw === null || raw === undefined) return def;
    return JSON.parse(raw);
  } catch { return def; }
}

export async function kvPut(env, key, val, opts = {}) {
  const fullKey = P + key;
  const valStr = JSON.stringify(val);
  const exp = opts.expirationTtl ? Math.floor(Date.now() / 1000) + Number(opts.expirationTtl) : (opts.expiration ? Number(opts.expiration) : null);

  if (hasD1(env)) {
    try {
      await env.DB.prepare(
        "INSERT INTO kv_store (key, value, expiration, created_at, updated_at) " +
        "VALUES (?, ?, ?, datetime('now'), datetime('now')) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, expiration = excluded.expiration, updated_at = datetime('now')"
      ).bind(fullKey, valStr, exp).run();
      return;
    } catch (e) {
      // در صورت خطای ناگهانی D1، به عنوان آخرین راهکار به KV مراجعه می‌شود
      console.error("D1 kvPut error:", e);
    }
  }

  try {
    await env.BOT_KV?.put(fullKey, valStr, opts);
  } catch (err) {
    console.warn("BOT_KV put failed (likely daily limit exceeded):", err?.message);
  }
}

export async function kvDel(env, key) {
  const fullKey = P + key;
  if (hasD1(env)) {
    try {
      await env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(fullKey).run();
    } catch {}
  }
  try { await env.BOT_KV?.delete(fullKey); } catch {}
}

export async function kvList(env, prefix) {
  if (hasD1(env)) {
    try {
      const pfx = P + prefix + "%";
      const rows = await env.DB.prepare("SELECT key FROM kv_store WHERE key LIKE ? ORDER BY key ASC").bind(pfx).all();
      return (rows.results || []).map(r => r.key.slice(P.length));
    } catch {}
  }

  const out = [];
  let cursor;
  do {
    const res = await env.BOT_KV.list({ prefix: P + prefix, cursor });
    for (const k of res.keys) out.push(k.name.slice(P.length));
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);
  return out;
}

export async function kvListRaw(env, opts = {}) {
  const prefix = opts.prefix || "";
  const cap = Math.max(1, Number(opts.limit) || 10000);

  if (hasD1(env)) {
    try {
      const pfx = P + prefix + "%";
      const rows = await env.DB.prepare("SELECT key, expiration FROM kv_store WHERE key LIKE ? ORDER BY key ASC LIMIT ?").bind(pfx, cap).all();
      const keys = (rows.results || []).map(r => ({
        name: r.key.slice(P.length),
        expiration: r.expiration,
        metadata: null
      }));
      return { keys, list_complete: true, cursor: null };
    } catch {}
  }

  const keys = [];
  let cursor = opts.cursor;
  do {
    const pageLimit = Math.min(1000, cap - keys.length);
    if (pageLimit <= 0) break;
    const res = await env.BOT_KV.list({ prefix: P + prefix, cursor, limit: pageLimit });
    for (const k of res.keys) keys.push({ name: k.name.slice(P.length), expiration: k.expiration, metadata: k.metadata });
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor && keys.length < cap);
  return { keys, list_complete: true, cursor: null };
}

export async function indexAdd(env, indexKey, id) {
  const ids = await kvGet(env, indexKey, []);
  if (!ids.includes(id)) { ids.push(id); await kvPut(env, indexKey, ids); }
  return ids;
}

export async function indexRemove(env, indexKey, id) {
  const ids = (await kvGet(env, indexKey, [])).filter(x => x !== id);
  await kvPut(env, indexKey, ids);
  return ids;
}

export async function readMany(env, keys) {
  if (!keys || !keys.length) return [];
  const out = [];

  if (hasD1(env)) {
    try {
      const CH = 50;
      const now = Math.floor(Date.now() / 1000);
      for (let i = 0; i < keys.length; i += CH) {
        const slice = keys.slice(i, i + CH).map(k => P + k);
        const placeholders = slice.map(() => "?").join(",");
        const rows = await env.DB.prepare(`SELECT key, value, expiration FROM kv_store WHERE key IN (${placeholders})`).bind(...slice).all();
        for (const r of (rows.results || [])) {
          if (r.expiration && r.expiration < now) continue;
          try { out.push(JSON.parse(r.value)); } catch {}
        }
      }
      if (out.length > 0) return out;
    } catch {}
  }

  const CH = 50;
  for (let i = 0; i < keys.length; i += CH) {
    const part = await Promise.all(keys.slice(i, i + CH).map(k => kvGet(env, k, null)));
    for (const r of part) if (r) out.push(r);
  }
  return out;
}

export function newId(prefix = "") {
  const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${s}` : s;
}

export function nowIso() { return new Date().toISOString(); }
