// ─────────────────────────────────────────────
// 🧩 Platform Context — dependency injection
// index.js تابعهای موجود (تلگرام، مدل، جستجو) را اینجا تزریق میکند
// تا ماژولهای جدید بدون تکرار پیادهسازی از آنها استفاده کنند.
// ─────────────────────────────────────────────

export const ctx = {
  env: null,
  adminId: 0,
  tg: {},
  ai: {},
  util: {}
};

export function initPlatform(deps) {
  if (deps.env !== undefined) ctx.env = deps.env;
  if (deps.adminId !== undefined) ctx.adminId = deps.adminId;
  if (deps.tg) Object.assign(ctx.tg, deps.tg);
  if (deps.ai) Object.assign(ctx.ai, deps.ai);
  if (deps.util) Object.assign(ctx.util, deps.util);
  return ctx;
}

export function env() {
  if (!ctx.env) throw new Error("platform not initialized");
  return ctx.env;
}

export function isAdmin(userId) {
  return Number(userId) === Number(ctx.adminId);
}
