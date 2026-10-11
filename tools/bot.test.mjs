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
  const language = async (userId, value) => {
    const pending = [];
    await worker.fetch(new Request('https://fixture.invalid/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': signature }, body: JSON.stringify({ callback_query: { id: 'fixture-language', from: { id: userId }, message: { message_id: 1, chat: { id: userId, type: 'private' } }, data: `language:${value}` } }) }), env, { waitUntil: p => pending.push(p) });
    await Promise.all(pending);
  };
  try {
    assert.equal((await call('/start', false)).status, 403);
    assert.equal(messages.length, 0);
    assert.equal((await call('/start', true)).status, 200);
    assert.ok(messages.at(-1).body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'language:en'), 'first start must offer both languages');
    await language(11, 'fa');
    const welcome = messages.find(m => m.method === 'sendMessage' && m.body.text.includes('فضای هوشمند تو'));
    assert.ok(welcome, 'real /start must send the redesigned welcome');
    assert.equal(welcome.body.parse_mode, 'HTML');
    assert.ok(welcome.body.text.includes('<blockquote>'));
    const menu = messages.find(m => m.method === 'sendMessage' && m.body.reply_markup?.inline_keyboard?.flat().some(b => b.callback_data === 'backup:account'));
    const buttons = menu.body.reply_markup.inline_keyboard.flat();
    assert.ok(buttons.some(b => b.web_app && b.style === 'primary'));
    assert.ok(buttons.some(b => b.callback_data === 'backup:account' && b.style === 'success'));
    assert.ok(buttons.some(b => b.callback_data === 'backup:database'));
    assert.equal((await call('/format', true)).status, 200);
    const formatting = messages.filter(m => m.method === 'sendMessage').at(-1).body;
    for (const tag of ['<b>', '<i>', '<u>', '<s>', '<tg-spoiler>', '<blockquote expandable>']) assert.ok(formatting.text.includes(tag), `missing ${tag}`);
    await call('/start', true, 22);
    await language(22, 'fa');
    const userMenu = messages.filter(m => m.method === 'sendMessage' && m.body.reply_markup?.inline_keyboard).at(-1);
    assert.ok(!userMenu.body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'backup:database'));
    await language(22, 'en');
    assert.equal(JSON.parse(await env.BOT_KV.get('pf:preferences:22')).language, 'en');
    const englishMenu = messages.filter(m => m.method === 'sendMessage' && m.body.chat_id === 22 && m.body.reply_markup?.inline_keyboard).at(-1);
    assert.ok(!/[\u0600-\u06ff]/.test(englishMenu.body.text));
    assert.ok(englishMenu.body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'backup:account' && !/[\u0600-\u06ff]/.test(b.text)));
    await call('/format', true, 22);
    assert.ok(messages.filter(m => m.method === 'sendMessage' && m.body.chat_id === 22).at(-1).body.text.includes('Native Telegram formatting'));
    await call('⚙️ Settings', true, 22);
    assert.ok(messages.filter(m => m.method === 'sendMessage' && m.body.chat_id === 22).at(-1).body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'language'), 'English reply keyboard must retain its actions');
    await Promise.all([call('/help', true, 11), call('/help', true, 22)]);
    const helpFa = messages.filter(m => m.method === 'sendMessage' && m.body.chat_id === 11).at(-1).body.text;
    const helpEn = messages.filter(m => m.method === 'sendMessage' && m.body.chat_id === 22).at(-1).body.text;
    assert.ok(helpFa.includes('راهنمای'));
    assert.ok(!/[\u0600-\u06ff]/.test(helpEn), 'concurrent users must keep independent languages');
    await call('/start', true, 22);
    assert.ok(!messages.filter(m => m.method === 'sendMessage' && m.body.chat_id === 22).at(-1).body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'language:en'), 'saved language must survive another start');
    await call('/language', true, 22);
    assert.ok(messages.filter(m => m.method === 'sendMessage' && m.body.chat_id === 22).at(-1).body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'language:fa'));
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

test('Models catalog displays all models with categories, pagination, chat button and complete menu', async () => {
  const env = { BOT_KV: new MemoryKV(), BOT_TOKEN: 'fixture-only-token', ADMIN_ID: '11' };
  const originalFetch = globalThis.fetch;
  const messages = [];
  globalThis.fetch = async (url, options) => {
    const body = options.body instanceof FormData ? Object.fromEntries(options.body.entries()) : JSON.parse(options.body || '{}');
    messages.push({ method: String(url).split('/').at(-1), body });
    return Response.json({ ok: true, result: { message_id: messages.length } });
  };
  const signature = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pimx-webhook:' + env.BOT_TOKEN)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const call = async (text, userId = 11) => {
    const pending = [];
    const response = await worker.fetch(new Request('https://fixture.invalid/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': signature },
      body: JSON.stringify({ update_id: messages.length + 1, message: { message_id: messages.length + 1, from: { id: userId, first_name: 'Tester' }, chat: { id: userId, type: 'private' }, text } })
    }), env, { waitUntil: p => pending.push(p) });
    await Promise.all(pending);
    return response;
  };
  const click = async (data, userId = 11) => {
    const pending = [];
    const response = await worker.fetch(new Request('https://fixture.invalid/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': signature },
      body: JSON.stringify({ callback_query: { id: 'cq-' + messages.length, from: { id: userId }, message: { message_id: 1, chat: { id: userId, type: 'private' } }, data } })
    }), env, { waitUntil: p => pending.push(p) });
    await Promise.all(pending);
    return response;
  };

  try {
    // 1. Open /models
    await call('/models', 11);
    const mMsg = messages.at(-1);
    assert.equal(mMsg.method, 'sendMessage');
    assert.ok(mMsg.body.text.includes('کتابخانه و انتخاب مدل‌های هوش مصنوعی'));
    const buttons = mMsg.body.reply_markup.inline_keyboard.flat();

    // Verify category filter buttons exist
    assert.ok(buttons.some(b => b.callback_data === 'models:c:chat:1'), 'chat category button must exist');
    assert.ok(buttons.some(b => b.callback_data === 'models:c:coding:1'), 'coding category button must exist');
    assert.ok(buttons.some(b => b.callback_data === 'models:c:reasoning:1'), 'reasoning category button must exist');
    assert.ok(buttons.some(b => b.callback_data === 'models:c:vision:1'), 'vision category button must exist');
    assert.ok(buttons.some(b => b.callback_data === 'models:c:fast:1'), 'fast category button must exist');
    assert.ok(buttons.some(b => b.callback_data === 'models:c:all:1'), 'all category button must exist');

    // Verify action buttons exist in models menu
    assert.ok(buttons.some(b => b.callback_data === 'mode:chat'), 'start chat button must exist in models menu');
    assert.ok(buttons.some(b => b.callback_data === 'setmodel:auto'), 'auto model button must exist');
    assert.ok(buttons.some(b => b.callback_data === 'testmodels'), 'test models button must exist');
    assert.ok(buttons.some(b => b.callback_data === 'pf:providers'), 'providers button must exist');
    assert.ok(buttons.some(b => b.callback_data === 'menu'), 'main menu button must exist');

    // 2. Filter to Coding category
    await click('models:c:coding:1', 11);
    const codeMsg = messages.at(-1);
    assert.ok(codeMsg.body.text.includes('برنامه‌نویسی'));
    const codeBtns = codeMsg.body.reply_markup.inline_keyboard.flat();
    assert.ok(codeBtns.some(b => b.callback_data === 'setmodel:codestral-latest'));

    // 3. Paginate to page 2 of all models
    await click('models:p:all:2', 11);
    const p2Msg = messages.at(-1);
    assert.ok(p2Msg.body.text.includes('صفحه 2'));

    // 4. Select a specific model
    await click('setmodel:meta/llama-3.3-70b-instruct', 11);
    const selectMsg = messages.at(-1);
    assert.ok(selectMsg.body.text.includes('مدل با موفقیت انتخاب شد'));
    assert.ok(selectMsg.body.text.includes('Llama 3.3 70B'));
    const selBtns = selectMsg.body.reply_markup.inline_keyboard.flat();
    assert.ok(selBtns.some(b => b.callback_data === 'mode:chat'), 'direct chat button must be available after model selection');
    assert.ok(selBtns.some(b => b.callback_data === 'models'), 'return to models list must be available');
    assert.ok(selBtns.some(b => b.callback_data === 'menu'), 'menu button must be available');

    // 5. Enter Chat mode directly
    await click('mode:chat', 11);
    const chatMsg = messages.at(-1);
    assert.ok(chatMsg.body.text.includes('چت هوشمند فعال شد'));
    assert.ok(chatMsg.body.text.includes('Llama 3.3 70B'), 'active model must be shown in chat activation');
    const chatBtns = chatMsg.body.reply_markup.inline_keyboard.flat();
    assert.ok(chatBtns.some(b => b.callback_data === 'models'), 'change model button must be available in chat');

    // 6. Main menu contains chatmgmt and help
    await call('/menu', 11);
    const menuMsg = messages.at(-1);
    const menuBtns = menuMsg.body.reply_markup.inline_keyboard.flat();
    assert.ok(menuBtns.some(b => b.callback_data === 'chatmgmt'), 'chat management must be in main menu');
    assert.ok(menuBtns.some(b => b.callback_data === 'help'), 'help button must be in main menu');
    assert.ok(menuBtns.some(b => b.callback_data === 'models'), 'models button must be in main menu');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

