// Isolated preview: signed fixture users and in-memory storage, never live data.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { miniAppHtml } from '../src/miniapp/index.js';
import { handleApi } from '../src/api/routes.js';
import { initPlatform } from '../src/core/ctx.js';
import { modelEnv } from './test-fixtures.mjs';

const BOT = 'fixture-only-bot-token';
export async function fixtureInitData(id = 11) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: id === 33 ? 'حساب دوم' : 'سارا', last_name: 'پیمکس', username: 'pimx_fixture', language_code: 'fa' }) });
  const sign = async (key, text) => {
    const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', imported, new TextEncoder().encode(text)));
  };
  const secret = await sign(new TextEncoder().encode('WebAppData'), BOT);
  const hash = await sign(secret, [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n'));
  params.set('hash', [...hash].map(b => b.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}

export async function startPreview(port = 0, { appHtml = miniAppHtml } = {}) {
  const env = modelEnv();
  const put = async (key, value) => env.BOT_KV.put(key, JSON.stringify(value));
  await put('pf:profile:11', { firstName: 'سارا', lastName: 'پیمکس' });
  await put('pf:convindex:11', ['welcome', 'ideas']);
  await put('pf:conv:11:welcome', { id: 'welcome', userId: 11, title: 'برنامهٔ امروز من', updatedAt: new Date().toISOString(), messages: [{ role: 'user', content: 'برای روزم یک برنامهٔ کوتاه پیشنهاد بده' }, { role: 'assistant', content: 'اول مهم‌ترین کار را انتخاب کن. سپس زمان مشخصی برای آن کنار بگذار.' }] });
  await put('pf:conv:11:ideas', { id: 'ideas', userId: 11, title: 'ایده‌های یک شروع تازه', updatedAt: new Date(Date.now() - 3600000).toISOString(), messages: [{ role: 'user', content: 'برای یک پروژهٔ خلاقانه ایده بده' }] });
  await put('pf:mem:user:11', { facts: ['کاربر به طراحی علاقه دارد.'], preferences: ['پاسخ کوتاه'] });
  await put('user:11:memories', { work: ['در حال ساخت یک پروژهٔ شخصی'] });
  await put('pf:kbindex:11', [{ id: 'notes', name: 'یادداشت‌های من', chunks: 2, ts: Date.now() }]);
  await put('pf:kb:doc:11:notes', { text: 'متن یادداشت شخصی' });
  await put('pf:preferences:11', { responseMode: 'speed' });
  await put('pf:preferences:33', { responseMode: 'balanced' });
  const deliveries = [];
  initPlatform({ env, adminId: 11, tg: { sendDocument: async (...args) => { deliveries.push(args); return { ok: true }; } }, ai: {} });
  const nativeFetch = globalThis.fetch;
  const upstream = [];
  globalThis.fetch = async (input, options) => {
    if (String(input).startsWith('https://fixture.invalid/')) {
      const body = JSON.parse(options.body); upstream.push(body);
      if (!body.stream) return Response.json({ choices: [{ message: { content: 'پاسخ آزمایشی' } }], usage: { prompt_tokens: 8, completion_tokens: 4 } });
      const encoder = new TextEncoder();
      let timer, index = 0;
      const chunks = ['سلام! ', 'این یک پاسخ زنده است. ', '**ایده‌ات را با هم کامل می‌کنیم.**'];
      return new Response(new ReadableStream({
        start(controller) {
          const tick = () => {
            if (options.signal?.aborted) { controller.error(new DOMException('Aborted', 'AbortError')); return; }
            if (index < chunks.length) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[index++] } }] })}\n\n`));
              timer = setTimeout(tick, 220);
            } else {
              controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close();
            }
          };
          timer = setTimeout(tick, 30);
        }, cancel() { clearTimeout(timer); }
      }), { headers: { 'Content-Type': 'text/event-stream' } });
    }
    return nativeFetch(input, options);
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/app' || url.pathname === '/') {
        const userId = Number(url.searchParams.get('user') || 11);
        const sdk = url.searchParams.has('anonymous') ? '' : `<script>window.Telegram={WebApp:{initData:${JSON.stringify(await fixtureInitData(userId))},colorScheme:'dark',ready:function(){},expand:function(){},setHeaderColor:function(){},setBackgroundColor:function(){},onEvent:function(){},HapticFeedback:{impactOccurred:function(){},notificationOccurred:function(){},selectionChanged:function(){}}}};</script>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end((await appHtml()).replace('<script async src="https://telegram.org/js/telegram-web-app.js"></script>', sdk)); return;
      }
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const request = new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
        const response = await handleApi(request, env, BOT, 11);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) {
          const reader = response.body.getReader();
          res.on('close', () => { if (!res.writableEnded) reader.cancel().catch(() => {}); });
          while (true) { const part = await reader.read(); if (part.done) break; if (!res.destroyed) res.write(Buffer.from(part.value)); }
        }
        res.end(); return;
      }
      res.writeHead(404); res.end();
    } catch (error) { if (!res.headersSent) res.writeHead(500); if (!res.destroyed) res.end(JSON.stringify({ error: error.message })); }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, env, deliveries, upstream, close: async () => { globalThis.fetch = nativeFetch; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const preview = await startPreview(Number(process.env.PORT || 8787));
  console.log(`Fixture preview: ${preview.url}/app`);
}
