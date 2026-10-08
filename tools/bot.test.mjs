import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';
import { MemoryKV } from './test-fixtures.mjs';

test('Telegram webhook rejects unsigned updates and emits native styled start and formatting messages', async () => {
  const env = { BOT_KV: new MemoryKV(), BOT_TOKEN: 'fixture-only-token', ADMIN_ID: '11' };
  const originalFetch = globalThis.fetch;
  const messages = [];
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith('https://api.telegram.org/'), 'fixture cannot call non-Telegram services');
    const body = options.body instanceof FormData ? Object.fromEntries(options.body.entries()) : JSON.parse(options.body || '{}');
    if (body.document) body.archive = JSON.parse(await body.document.text());
    messages.push({ method: String(url).split('/').at(-1), body });
    return Response.json({ ok: true, result: { message_id: messages.length } });
  };
  const signature = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pimx-webhook:' + env.BOT_TOKEN)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const update = (text, userId) => ({ update_id: 1, message: { message_id: 1, from: { id: userId, first_name: 'Fixture' }, chat: { id: userId, type: 'private' }, text } });
  const call = async (text, signed, userId = 11) => {
    const pending = [];
    const response = await worker.fetch(new Request('https://fixture.invalid/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(signed ? { 'X-Telegram-Bot-Api-Secret-Token': signature } : {}) }, body: JSON.stringify(update(text, userId)) }), env, { waitUntil: p => pending.push(p) });
    await Promise.all(pending);
    return response;
  };
  try {
    assert.equal((await call('/start', false)).status, 403);
    assert.equal(messages.length, 0);
    assert.equal((await call('/start', true)).status, 200);
    const welcome = messages.find(m => m.method === 'sendMessage' && m.body.text.includes('فضای هوشمند تو'));
    assert.ok(welcome, 'real /start must send the redesigned welcome');
    assert.equal(welcome.body.parse_mode, 'HTML');
    assert.ok(welcome.body.text.includes('<blockquote>'));
    const menu = messages.find(m => m.method === 'sendMessage' && m.body.reply_markup?.inline_keyboard);
    const buttons = menu.body.reply_markup.inline_keyboard.flat();
    assert.ok(buttons.some(b => b.web_app && b.style === 'primary'));
    assert.ok(buttons.some(b => b.callback_data === 'backup:account' && b.style === 'success'));
    assert.ok(buttons.some(b => b.callback_data === 'backup:database'));
    assert.equal((await call('/format', true)).status, 200);
    const formatting = messages.filter(m => m.method === 'sendMessage').at(-1).body;
    for (const tag of ['<b>', '<i>', '<u>', '<s>', '<tg-spoiler>', '<blockquote expandable>']) assert.ok(formatting.text.includes(tag), `missing ${tag}`);
    await call('/start', true, 22);
    const userMenu = messages.filter(m => m.method === 'sendMessage' && m.body.reply_markup?.inline_keyboard).at(-1);
    assert.ok(!userMenu.body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'backup:database'));
    const before = messages.filter(m => m.method === 'sendDocument').length;
    await call('/backupdb', true, 22);
    assert.equal(messages.filter(m => m.method === 'sendDocument').length, before);
    await call('/backup', true);
    const archive = messages.find(m => m.method === 'sendDocument').body;
    assert.equal(archive.chat_id, '11'); assert.equal(archive.archive.scope, 'account');
    assert.ok(!archive.archive.records.some(r => r.key.startsWith('user:22:')));
    // The three Mini App modes must preserve the bot's five explicit levels.
    await call('/think 5', true);
    await call('/think', true);
    assert.ok(messages.filter(m => m.method === 'sendMessage').at(-1).body.reply_markup.inline_keyboard.flat().some(b => b.text.startsWith('✅') && b.text.includes('خلاق')), 'an explicit creative level must survive preference synchronization');
    await call('/think 1', true);
    await call('/think', true);
    assert.ok(messages.filter(m => m.method === 'sendMessage').at(-1).body.reply_markup.inline_keyboard.flat().some(b => b.text.startsWith('✅') && b.text.includes('فوری')), 'an explicit instant level must survive preference synchronization');
    const pending = [];
    await worker.fetch(new Request('https://fixture.invalid/setup'), env, { waitUntil: p => pending.push(p) });
    await Promise.all(pending);
    const setup = messages.find(m => m.method === 'setWebhook').body;
    assert.equal(setup.secret_token, signature); assert.equal(setup.drop_pending_updates, false);
    assert.ok(messages.find(m => m.method === 'setMyCommands').body.commands.some(c => c.command === 'restore'));
  } finally { globalThis.fetch = originalFetch; }
});
