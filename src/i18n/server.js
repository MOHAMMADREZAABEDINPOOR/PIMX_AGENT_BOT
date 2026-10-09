import { AsyncLocalStorage } from 'node:async_hooks';
import { kvGet, kvPut } from '../core/kv.js';
import { translateLiteral, renderTemplate, validLanguage } from './shared.js';

const languages = new AsyncLocalStorage();
export function currentLanguage() { return languages.getStore()?.language || 'fa'; }
export function pxText(value) { return translateLiteral(value, currentLanguage()); }
export function pxTemplate(parts, ...values) { return renderTemplate(currentLanguage(), parts, values); }
export function withLanguage(language, action) {
  return languages.run({ language: validLanguage(language) ? language : 'fa' }, action);
}
export function setCurrentLanguage(language) {
  const store = languages.getStore();
  if (store && validLanguage(language)) store.language = language;
}
export function languageMessages(messages) {
  if (!languages.getStore()) return messages;
  if (messages.some(m => m.role === 'system' && typeof m.content === 'string' && /\[Account language\]|Account language:/.test(m.content))) return messages;
  const instruction = `[Account language] Respond in ${currentLanguage() === 'en' ? 'English' : 'Persian'}. Follow explicit requests for a different target language or exact output format.`;
  const result = messages.map(message => ({ ...message }));
  const system = result.find(message => message.role === 'system' && typeof message.content === 'string');
  if (system) system.content += '\n\n' + instruction;
  else result.unshift({ role: 'system', content: instruction });
  return result;
}
export async function savedLanguage(env, userId) {
  const preferences = await kvGet(env, `preferences:${userId}`, {});
  return validLanguage(preferences.language) ? preferences.language : null;
}
export async function saveLanguage(env, userId, language) {
  if (!validLanguage(language)) throw new Error('Unsupported language');
  const preferences = await kvGet(env, `preferences:${userId}`, {});
  await kvPut(env, `preferences:${userId}`, { ...preferences, language });
  setCurrentLanguage(language);
}
