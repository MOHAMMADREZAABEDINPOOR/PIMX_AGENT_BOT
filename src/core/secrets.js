// ─────────────────────────────────────────────
// 🔐 Secret Management
// کلیدهای API با AES-GCM رمزنگاری و در KV ذخیره میشوند.
// هیچگاه به فرانتاند/تلگرام بهصورت خام برنمیگردند.
// ─────────────────────────────────────────────

let cachedKey = null;
let cachedMaterial = "";

async function aesKey(env) {
  const material = String(env?.SECRET_KEY || env?.MASTER_SECRET || env?.BOT_TOKEN || "pimxagent-default-secret");
  if (cachedKey && cachedMaterial === material) return cachedKey;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  cachedKey = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  cachedMaterial = material;
  return cachedKey;
}

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(env, plain) {
  if (!plain) return "";
  const key = await aesKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `v1:${b64(iv)}:${b64(ct)}`;
}

export async function decryptSecret(env, blob) {
  if (!blob) return "";
  if (!String(blob).startsWith("v1:")) return String(blob); // سازگاری با مقادیر قدیمی/خام
  const [, ivB, ctB] = String(blob).split(":");
  try {
    const key = await aesKey(env);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(ivB) }, key, unb64(ctB));
    return new TextDecoder().decode(pt);
  } catch { return ""; }
}

// نمایش ایمن کلید: فقط ۴ کاراکتر اول و آخر
export function maskKey(plain) {
  const s = String(plain || "");
  if (!s) return "—";
  if (s.length <= 10) return `${s.slice(0, 2)}${"•".repeat(4)}`;
  return `${s.slice(0, 4)}${"•".repeat(6)}${s.slice(-4)}`;
}

export async function fingerprint(plain) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(plain || "")));
  return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

// حذف هرگونه کلید/توکن از متن لاگها
export function redact(text) {
  return String(text || "")
    .replace(/\b(sk-[A-Za-z0-9-_]{8,}|nvapi-[A-Za-z0-9-_]{8,}|AQ\.[A-Za-z0-9-_]{8,}|gsk_[A-Za-z0-9]{8,})/g, "[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9-._~+/]{10,}/gi, "$1[REDACTED]");
}
