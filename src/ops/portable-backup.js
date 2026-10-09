import { pxText, pxTemplate } from '../i18n/server.js';
// D1 + legacy KV snapshots. Account restores never write foreign/global keys.
const FORMAT = "pimx-portable-backup";
export const MAX_BACKUP_BYTES = 18 * 1024 * 1024;
const MAX_RECORDS = 50000;
const RESOURCE_INDEX = {
  project: null, agent: "agents:index", agentrun: "agentruns:index", task: "tasks:index",
  workflow: "workflows:index", councilrun: "council:runs", councilcfg: "council:cfgs",
  "council:template": "council:templates", prompt: "prompts:index"
};
const RESOURCE = /^(?:project|agent|agentrun|task|workflow|wfrun|councilrun|councilcfg|council:template|document|knowledge_base|vector_index|prompt):[^:]+$/;
const EXCLUDED = /^(?:session:|avatarfile:|ratelimit:|quota:|stream:|user_identity:|user_role:|tenant_member:)/;
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const owner = value => value && (value.userId ?? value.createdBy ?? value.ownerId ?? value.uploadedBy);

async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function allRecords(env) {
  const records = new Map();
  const now = Math.floor(Date.now() / 1000);
  let bytes = 0;
  const add = row => {
    if (row.expiration && row.expiration <= now) return;
    if (records.has(row.key)) bytes -= records.get(row.key).value.length * 3;
    bytes += row.value.length * 3;
    records.set(row.key, { key: row.key, value: row.value, expiration: row.expiration || null });
    if (records.size > MAX_RECORDS || bytes > MAX_BACKUP_BYTES * 3) throw new Error(pxText("حجم داده‌ها از سقف فایل تلگرام بیشتر است؛ خروجی سرور را با Wrangler بگیرید."));
  };
  // Read every KV page, including keys never migrated into D1.
  if (env.BOT_KV) {
    let cursor;
    do {
      const page = await env.BOT_KV.list({ limit: 1000, cursor });
      for (let i = 0; i < page.keys.length; i += 30) {
        const rows = await Promise.all(page.keys.slice(i, i + 30).map(async key => ({ key: key.name, value: await env.BOT_KV.get(key.name), expiration: key.expiration })));
        for (const row of rows) if (row.value !== null) add(row);
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
  }
  if (env.DB?.prepare) {
    let after = "";
    do {
      const page = await env.DB.prepare("SELECT key, value, expiration FROM kv_store WHERE key > ? ORDER BY key LIMIT 500").bind(after).all();
      if (!page.results?.length) break;
      for (const row of page.results) {
        // D1 is authoritative, even when a legacy KV replica still has a value.
        if (row.expiration && row.expiration <= now) { records.delete(row.key); continue; }
        add(row);
      }
      after = page.results.at(-1).key;
    } while (true);
  }
  return [...records.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function personalKey(key, userId) {
  if (key.startsWith(`user:${userId}:`)) return !/:(?:pending|wizard)$/.test(key);
  if (!key.startsWith("pf:")) return false;
  const k = key.slice(3);
  if (EXCLUDED.test(k)) return false;
  return (k.startsWith(`user:${userId}:`) && !/:(?:pending|wizard)$/.test(k)) || k.startsWith(`conv:${userId}:`) ||
    k.startsWith(`cost_agg:user:${userId}:`) || k.startsWith(`kb:doc:${userId}:`) ||
    [`mem:${userId}`, `mem:user:${userId}`, `graph:${userId}`, `promptlab:${userId}`, `convindex:${userId}`, `convtomb:${userId}`, `projects:index:${userId}`, `kbindex:${userId}`, `search_history:${userId}`, `preferences:${userId}`].includes(k);
}

function accountRecords(records, userId) {
  const selected = new Set();
  const ids = new Set();
  for (const row of records) {
    const key = row.key.replace(/^pf:/, "");
    const value = parse(row.value);
    if (personalKey(row.key, userId) || (row.key.startsWith("pf:") && RESOURCE.test(key) && Number(owner(value)) === Number(userId))) {
      selected.add(row.key);
      if (RESOURCE.test(key)) ids.add(key.split(":").at(-1));
      if (key.startsWith(`conv:${userId}:`)) ids.add(key.split(":").at(-1));
    }
  }
  for (const row of records) {
    const k = row.key.replace(/^pf:/, "");
    if (/^(?:document_content:|kb_doc:|vector:|mem:(?:project|agent|conv):)/.test(k) && k.split(":").some(part => ids.has(part))) selected.add(row.key);
  }
  return records.filter(row => selected.has(row.key));
}

export async function exportBackup(env, userId, { scope = "account", adminId } = {}) {
  if (scope !== "account" && scope !== "database") throw new Error(pxText("نوع پشتیبان نامعتبر است."));
  if (scope === "database" && (!adminId || Number(userId) !== Number(adminId))) throw new Error(pxText("خروجی کل دیتابیس فقط برای ادمین مجاز است."));
  const all = await allRecords(env);
  const records = scope === "database" ? all : accountRecords(all, userId);
  const archive = { format: FORMAT, version: 2, scope, sourceUserId: Number(userId), exportedAt: new Date().toISOString(), recordCount: records.length, records };
  archive.checksum = await digest(JSON.stringify(records));
  const size = new TextEncoder().encode(JSON.stringify(archive)).byteLength;
  if (size > MAX_BACKUP_BYTES) throw new Error(pxText("فایل بیش از ۱۸ مگابایت است؛ خروجی سرور را با Wrangler بگیرید."));
  return archive;
}

export async function inspectBackup(archive) {
  if (archive?.format !== FORMAT || archive.version !== 2 || !["account", "database"].includes(archive.scope) || !Number.isSafeInteger(archive.sourceUserId) || archive.sourceUserId <= 0 || !Array.isArray(archive.records)) throw new Error(pxText("فایل پشتیبان PIMX معتبر نیست."));
  if (archive.records.length > MAX_RECORDS || new TextEncoder().encode(JSON.stringify(archive)).byteLength > MAX_BACKUP_BYTES) throw new Error(pxText("فایل پشتیبان بیش از حد بزرگ است."));
  const keys = new Set();
  for (const row of archive.records) {
    if (typeof row.key !== "string" || row.key.length > 512 || typeof row.value !== "string" || row.value.length > 1024 * 1024 || keys.has(row.key) || (row.expiration !== null && row.expiration !== undefined && !Number.isSafeInteger(row.expiration))) throw new Error(pxText("ساختار رکوردهای فایل معتبر نیست."));
    keys.add(row.key);
  }
  if (await digest(JSON.stringify(archive.records)) !== archive.checksum) throw new Error(pxText("فایل پشتیبان ناقص یا تغییر داده شده است."));
  const rows = accountRecords(archive.records, archive.sourceUserId);
  return { scope: archive.scope, sourceUserId: archive.sourceUserId, exportedAt: archive.exportedAt, records: rows.length, conversations: rows.filter(r => /^(?:pf:conv:|user:\d+:history:)/.test(r.key)).length, memories: rows.filter(r => /(?:^pf:mem:|:memories$|:memory$|^pf:graph:)/.test(r.key)).length, documents: rows.filter(r => /(?:kb:doc:|^pf:document:|^pf:kb_doc:)/.test(r.key)).length };
}

async function readRaw(env, key) {
  if (key.startsWith("pf:") && env.DB?.prepare) {
    const row = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first();
    if (row) return row.value;
  }
  return env.BOT_KV ? env.BOT_KV.get(key) : null;
}

export async function restoreBackup(env, archive, userId) {
  await inspectBackup(archive); // Complete validation before the first write.
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) throw new Error(pxText("حساب مقصد معتبر نیست."));
  const source = archive.sourceUserId;
  const rows = accountRecords(archive.records, source);
  const ids = new Map();
  for (const row of rows) {
    const key = row.key.replace(/^pf:/, "");
    if (RESOURCE.test(key) || key.startsWith(`conv:${source}:`) || key.startsWith(`kb:doc:${source}:`) || key.startsWith(`user:${source}:kb:doc:`)) {
      const id = key.split(":").at(-1);
      ids.set(id, `r_${(await digest(`${userId}:${archive.checksum}:${id}`)).slice(0, 24)}`);
    }
  }
  const remap = (value, field) => {
    if (["userId", "createdBy", "ownerId", "uploadedBy", "chatId"].includes(field)) return Number(userId);
    if (typeof value === "string") return ids.get(value) || value;
    if (Array.isArray(value)) return value.map(v => remap(v));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([k]) => !["__proto__", "prototype", "constructor"].includes(k)).map(([k, v]) => [k, remap(v, k)]));
    return value;
  };
  const writes = new Map();
  let merged = 0, skipped = 0;
  for (const row of rows) {
    if (row.expiration && row.expiration <= Date.now() / 1000) { skipped++; continue; }
    let key = row.key.replace(/^(pf:)?user:\d+:/, `$1user:${userId}:`);
    key = key.split(":").map(part => part === String(source) ? String(userId) : ids.get(part) || part).join(":");
    let value = remap(parse(row.value));
    if (value === null) { skipped++; continue; }
    if (/^(?:pf:task:|user:\d+:(?:reminders|schedules)$)/.test(key)) {
      // Imported automations start paused; importing a file cannot send messages.
      if (Array.isArray(value)) value = value.map(v => ({ ...v, enabled: false, paused: true }));
      else value.enabled = false;
    }
    const previous = parse(await readRaw(env, key));
    if (Array.isArray(previous) && Array.isArray(value)) {
      const identity = v => typeof v === "object" && v?.id ? `id:${v.id}` : JSON.stringify(v);
      const map = new Map(previous.map(v => [identity(v), v]));
      for (const v of value) if (!map.has(identity(v))) map.set(identity(v), v);
      value = [...map.values()]; merged++;
    } else if (previous && value && typeof previous === "object" && typeof value === "object" && !Array.isArray(previous) && !Array.isArray(value) && /(?:^pf:(?:mem:|graph:|promptlab:|preferences:)|^user:\d+:(?:memories|memory|profile|settings)$)/.test(key)) {
      // Keep destination scalar settings while bringing across missing fields
      // and distinct facts. Re-importing the same archive adds no duplicates.
      const merge = (current, incoming) => {
        if (Array.isArray(current) && Array.isArray(incoming)) {
          const identity = v => v && typeof v === "object" && v.id ? `id:${v.id}` : JSON.stringify(v);
          const entries = new Map(current.map(v => [identity(v), v]));
          for (const v of incoming) if (!entries.has(identity(v))) entries.set(identity(v), v);
          return [...entries.values()];
        }
        if (current && incoming && typeof current === "object" && typeof incoming === "object" && !Array.isArray(current) && !Array.isArray(incoming)) {
          const out = { ...current };
          for (const [field, entry] of Object.entries(incoming)) {
            if (["__proto__", "constructor", "prototype"].includes(field)) continue;
            out[field] = Object.hasOwn(out, field) ? merge(out[field], entry) : entry;
          }
          return out;
        }
        return current;
      };
      value = merge(previous, value); merged++;
    } else if (previous !== null) { skipped++; continue; }
    writes.set(key, { value: JSON.stringify(value), expiration: row.expiration || null });
    const logical = key.replace(/^pf:/, "");
    const type = logical.slice(0, logical.lastIndexOf(":"));
    let index = RESOURCE_INDEX[type];
    if (type === "project") index = `projects:index:${userId}`;
    if (index) {
      const indexKey = `pf:${index}`;
      const list = parse(writes.get(indexKey)?.value || await readRaw(env, indexKey)) || [];
      const id = logical.split(":").at(-1);
      if (!list.includes(id)) list.push(id);
      writes.set(indexKey, { value: JSON.stringify(list), expiration: null });
    }
  }
  const d1 = [...writes].filter(([key]) => key.startsWith("pf:") && env.DB?.prepare);
  // D1 batches are atomic. Legacy KV is verified and failures are surfaced.
  if (d1.length) await env.DB.batch(d1.map(([key, row]) => env.DB.prepare("INSERT INTO kv_store (key, value, expiration, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expiration=excluded.expiration, updated_at=datetime('now')").bind(key, row.value, row.expiration)));
  for (const [key, row] of writes) {
    if (key.startsWith("pf:") && env.DB?.prepare) continue;
    if (!env.BOT_KV) throw new Error(pxText("ذخیره‌ساز KV برای بازیابی داده‌های بات تنظیم نشده است."));
    await env.BOT_KV.put(key, row.value, row.expiration ? { expiration: row.expiration } : {});
  }
  return { imported: writes.size, merged, skipped, targetUserId: Number(userId), automationsPaused: true };
}

export async function stageRestore(env, archive, userId) {
  const summary = await inspectBackup(archive);
  const token = crypto.randomUUID().replace(/-/g, "");
  const key = `pf:restore_pending:${userId}:${token}`;
  const value = JSON.stringify({ archive, expires: Date.now() + 600000 });
  if (env.DB?.prepare) await env.DB.prepare("INSERT INTO kv_store (key, value, expiration) VALUES (?, ?, ?)").bind(key, value, Math.floor(Date.now() / 1000) + 600).run();
  else await env.BOT_KV.put(key, value, { expirationTtl: 600 });
  return { token, summary };
}

export async function confirmRestore(env, userId, token) {
  if (!/^[a-f0-9]{32}$/.test(token || "")) throw new Error(pxText("درخواست بازیابی نامعتبر است."));
  const key = `pf:restore_pending:${userId}:${token}`;
  const staged = parse(await readRaw(env, key));
  if (!staged || staged.expires < Date.now()) throw new Error(pxText("درخواست بازیابی منقضی شده؛ فایل را دوباره ارسال کنید."));
  const result = await restoreBackup(env, staged.archive, userId);
  if (env.DB?.prepare) await env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
  else await env.BOT_KV.delete(key);
  return result;
}
