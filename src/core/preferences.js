import { kvGet } from './kv.js';

const MODES = {
  speed: { policy: 'speed', maxTokens: 900 },
  balanced: { policy: 'balanced', maxTokens: 2000 },
  quality: { policy: 'quality', maxTokens: 4000 }
};

export async function responseOptions(env, userId, body = {}) {
  const saved = await kvGet(env, `preferences:${userId}`, { responseMode: 'speed' });
  const mode = Object.hasOwn(MODES, body.responseMode) ? body.responseMode : Object.hasOwn(MODES, saved.responseMode) ? saved.responseMode : 'speed';
  const profile = MODES[mode];
  return { responseMode: mode, policy: body.policy || profile.policy, maxTokens: Number(body.maxTokens) > 0 ? Number(body.maxTokens) : profile.maxTokens };
}
