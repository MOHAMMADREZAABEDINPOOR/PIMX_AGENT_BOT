import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBackup, inspectBackup, restoreBackup, stageRestore, confirmRestore } from '../src/ops/portable-backup.js';
import { handleApi } from '../src/api/routes.js';
import { initPlatform } from '../src/core/ctx.js';
import { MemoryKV, MemoryD1 } from './test-fixtures.mjs';

const source = () => new MemoryKV({
  'user:11:profile': { job: 'designer' },
  'user:11:history:default': [{ role: 'user', content: 'سلام' }],
  'user:11:memories': { work: ['اولین خاطره'] },
  'user:11:kb:index': [{ docId: 'legacy-doc', name: 'Legacy file' }],
  'user:11:kb:doc:legacy-doc': { name: 'Legacy file', chunks: ['Legacy content'] },
  'user:11:reminders': [{ id: 'rem1', status: 'pending', time: 1, text: 'reminder' }],
  'user:11:schedules': [{ id: 'sch1', time: '08:00' }],
  'pf:convindex:11': ['conv1'],
  'pf:conv:11:conv1': { id: 'conv1', userId: 11, messages: [{ role: 'assistant', content: 'پاسخ' }] },
  'pf:mem:user:11': { facts: ['یک واقعیت'] },
  'pf:kbindex:11': [{ id: 'doc1', name: 'My notes' }],
  'pf:kb:doc:11:doc1': { text: 'Private document' },
  'pf:document:upload1': { id: 'upload1', uploadedBy: 11, filename: 'notes.txt' },
  'pf:document_content:upload1': 'Uploaded content',
  'pf:project:project1': { id: 'project1', userId: 11, name: 'Personal project' },
  'pf:task:task1': { id: 'task1', userId: 11, chatId: -99, enabled: true },
  'pf:provider:secret': { keys: ['fixture-secret'] },
  'pf:session:private': { userId: 11 },
  'user:22:profile': { job: 'other account' },
  'pf:conv:22:foreign': { id: 'foreign', userId: 22 },
  'pf:document:foreign': { id: 'foreign', uploadedBy: 22 },
  'pf:document_content:foreign': 'Foreign content'
});

test('account export includes both chat stores and all owned documents without foreign data or secrets', async () => {
  const archive = await exportBackup({ BOT_KV: source() }, 11);
  const keys = archive.records.map(r => r.key);
  for (const key of ['user:11:history:default', 'pf:conv:11:conv1', 'pf:kb:doc:11:doc1', 'pf:document:upload1', 'pf:document_content:upload1']) assert.ok(keys.includes(key), `missing ${key}`);
  assert.ok(!JSON.stringify(archive).includes('fixture-secret'));
  assert.ok(!keys.some(k => k.includes('foreign') || k.includes('session:') || k.includes('user:22')));
});

test('restore remaps ownership and references, preserves existing data and is idempotent', async () => {
  const archive = await exportBackup({ BOT_KV: source() }, 11);
  const env = { BOT_KV: new MemoryKV({ 'user:33:memories': { work: ['خاطره فعلی'], personal: ['My name'] }, 'pf:convindex:33': ['existing'], 'pf:tasks:index': ['existing-task'] }) };
  const result = await restoreBackup(env, archive, 33);
  assert.equal(result.targetUserId, 33);
  const index = JSON.parse(await env.BOT_KV.get('pf:convindex:33'));
  assert.equal(index[0], 'existing');
  const conv = JSON.parse(await env.BOT_KV.get(`pf:conv:33:${index[1]}`));
  assert.equal(conv.id, index[1]); assert.equal(conv.userId, 33);
  assert.equal(conv.messages[0].content, 'پاسخ');
  assert.deepEqual(JSON.parse(await env.BOT_KV.get('user:33:memories')).work, ['خاطره فعلی', 'اولین خاطره']);
  const keys = [...env.BOT_KV.rows.keys()];
  const docKey = keys.find(k => k.startsWith('pf:document:'));
  const doc = JSON.parse(await env.BOT_KV.get(docKey));
  assert.equal(doc.uploadedBy, 33);
  assert.equal(JSON.parse(await env.BOT_KV.get(`pf:document_content:${doc.id}`)), 'Uploaded content');
  const kb = JSON.parse(await env.BOT_KV.get('pf:kbindex:33'));
  assert.ok(await env.BOT_KV.get(`pf:kb:doc:33:${kb[0].id}`));
  const legacyKb = JSON.parse(await env.BOT_KV.get('user:33:kb:index'));
  assert.ok(await env.BOT_KV.get(`user:33:kb:doc:${legacyKb[0].docId}`));
  const taskIds = JSON.parse(await env.BOT_KV.get('pf:tasks:index'));
  const task = JSON.parse(await env.BOT_KV.get(`pf:task:${taskIds[1]}`));
  assert.equal(task.enabled, false); assert.equal(task.chatId, 33);
  assert.equal(JSON.parse(await env.BOT_KV.get('user:33:reminders'))[0].paused, true);
  const before = JSON.stringify([...env.BOT_KV.rows]);
  await restoreBackup(env, archive, 33);
  assert.equal(JSON.stringify([...env.BOT_KV.rows]), before);
  assert.ok(![...env.BOT_KV.rows.keys()].some(k => k.startsWith('user:11:') || k.startsWith('pf:conv:11:')));
});

test('tampered files fail before any write and database export requires the configured admin', async () => {
  const env = { BOT_KV: source() };
  await assert.rejects(exportBackup(env, 11, { scope: 'database', adminId: 99 }));
  const archive = await exportBackup(env, 11, { scope: 'database', adminId: 11 });
  assert.equal(archive.recordCount, env.BOT_KV.rows.size);
  const dest = { BOT_KV: new MemoryKV() };
  archive.records[0].value = '{}';
  await assert.rejects(restoreBackup(dest, archive, 33), /ناقص|تغییر/);
  assert.equal(dest.BOT_KV.rows.size, 0);
});

test('restore confirmation is bound to the destination account and consumed once', async () => {
  const env = { BOT_KV: source() };
  const staged = await stageRestore(env, await exportBackup(env, 11), 33);
  await assert.rejects(confirmRestore(env, 44, staged.token));
  assert.ok((await confirmRestore(env, 33, staged.token)).imported > 0);
  await assert.rejects(confirmRestore(env, 33, staged.token));
});

test('Mini App export actually sends the archive through the Telegram adapter', async () => {
  const env = { BOT_KV: source() };
  await env.BOT_KV.put('pf:session:fixture', JSON.stringify({ userId: 11, name: 'Test' }));
  let sent;
  initPlatform({ env, tg: { sendDocument: async (...args) => { sent = args; return { ok: true }; } } });
  const response = await handleApi(new Request('https://pimx.invalid/api/backup/export', { method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'account', delivery: 'telegram' }) }), env, 'fixture-bot-token', 99);
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.data.sent, true); assert.equal(sent[0], 11);
  assert.equal((await inspectBackup(JSON.parse(sent[2]))).sourceUserId, 11);
});

test('database export paginates both stores and D1 wins over stale or expired KV replicas', async () => {
  const env = { BOT_KV: new MemoryKV(Object.fromEntries(Array.from({ length: 1005 }, (_, i) => [`legacy:${String(i).padStart(5, '0')}`, i]))), DB: new MemoryD1(Object.fromEntries(Array.from({ length: 510 }, (_, i) => [`pf:other:${String(i).padStart(5, '0')}`, i]))) };
  await env.BOT_KV.put('pf:conv:11:merged', JSON.stringify({ id: 'merged', userId: 11, title: 'stale' }));
  env.DB.rows.set('pf:conv:11:merged', { key: 'pf:conv:11:merged', value: JSON.stringify({ id: 'merged', userId: 11, title: 'current' }), expiration: null });
  await env.BOT_KV.put('pf:expired', JSON.stringify('stale'));
  env.DB.rows.set('pf:expired', { key: 'pf:expired', value: '"expired"', expiration: 1 });
  const archive = await exportBackup(env, 11, { scope: 'database', adminId: 11 });
  assert.equal(archive.recordCount, 1516);
  assert.equal(JSON.parse(archive.records.find(row => row.key === 'pf:conv:11:merged').value).title, 'current');
  assert.ok(!archive.records.some(row => row.key === 'pf:expired'));
  assert.equal((await inspectBackup(archive)).conversations, 1);
});

test('mixed-store restore writes legacy bot data to KV and Mini App data to D1', async () => {
  const archive = await exportBackup({ BOT_KV: source() }, 11);
  const env = { BOT_KV: new MemoryKV(), DB: new MemoryD1() };
  await restoreBackup(env, archive, 33);
  assert.ok(await env.BOT_KV.get('user:33:history:default'));
  assert.ok(![...env.BOT_KV.rows.keys()].some(key => key.startsWith('pf:')));
  const ids = JSON.parse(env.DB.rows.get('pf:convindex:33').value);
  assert.equal(JSON.parse(env.DB.rows.get(`pf:conv:33:${ids[0]}`).value).userId, 33);
  const staged = await stageRestore(env, archive, 44);
  await confirmRestore(env, 44, staged.token);
  assert.ok(!env.DB.rows.has(`pf:restore_pending:44:${staged.token}`));
});
