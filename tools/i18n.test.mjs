import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startPreview } from './ui-preview.mjs';
import { translateLiteral, renderTemplate } from '../src/i18n/shared.js';
import { generateCacheKey } from '../src/gateway/cache.js';
import { withLanguage } from '../src/i18n/server.js';

test('Slow fonts do not block startup and language switching never reloads or reauthenticates', { timeout: 20000 }, async () => {
  const preview = await startPreview();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const heldFonts = [];
  let authRequests = 0;
  let releaseSave;
  const saveGate = new Promise(resolve => { releaseSave = resolve; });
  await page.route('https://fonts.googleapis.com/**', route => { heldFonts.push(route); });
  await page.route('**/api/preferences', async route => {
    if (route.request().method() === 'PATCH') await saveGate;
    await route.continue();
  });
  page.on('request', request => { if (request.url().endsWith('/api/auth')) authRequests++; });
  try {
    await page.goto(preview.url + '/app', { waitUntil: 'domcontentloaded' });
    await page.locator('.studio-home').waitFor({ timeout: 4000 });
    await page.evaluate(() => { window.fixturePageIdentity = 'same-page'; });
    const authBefore = authRequests;
    await page.locator('#languageToggle').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 1000 });
    assert.equal(await page.evaluate(() => window.fixturePageIdentity), 'same-page');
    assert.equal(authRequests, authBefore);
    assert.equal(await page.locator('.boot').count(), 0, 'switching must not restart the boot screen');
    assert.ok(!/[\u0600-\u06ff]/.test(await page.locator('#view').innerText()), 'pending switch must show English loading content');
    releaseSave();
    await page.waitForFunction(() => !window.pxLanguageSwitching);
    await page.locator('.studio-home').waitFor({ timeout: 4000 });
    assert.equal(await page.evaluate(() => window.fixturePageIdentity), 'same-page');
    assert.equal(authRequests, authBefore);
    // Even before the full application script arrives, the initial loader is English.
    await page.route('**/api/auth', route => {});
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.ok(!/[\u0600-\u06ff]/.test(await page.locator('#bootMsg').innerText()));
  } finally {
    releaseSave();
    await Promise.all(heldFonts.map(route => route.abort().catch(() => {})));
    await browser.close(); await preview.close();
  }
});

test('Translation preserves interpolated content, HTML actions and language-specific cache entries', () => {
  assert.equal(renderTemplate('en', ['مدل ', ''], ['مدل خصوصی فارسی']), 'model مدل خصوصی فارسی');
  assert.equal(translateLiteral('بازگشت', 'fa'), 'بازگشت');
  assert.equal(translateLiteral('بازگشت', 'en'), 'Back');
  const user = '<img src=x onerror=alert(1)>';
  assert.equal(renderTemplate('en', ['ذخیره ', ''], [user]), 'Save ' + user);
  const input = { model: 'fixture', messages: [{ role: 'user', content: 'hello' }] };
  assert.notEqual(withLanguage('fa', () => generateCacheKey(input).cacheKey), withLanguage('en', () => generateCacheKey(input).cacheKey));
});

test('Mini App switches and persists language across routes, themes and accounts', { timeout: 120000 }, async () => {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(preview.url + '/app'); await page.locator('.studio-home').waitFor();
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    await page.locator('#homePrompt').fill('پیش‌نویس شخصی');
    await page.locator('#languageToggle').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en' && S.ready);
    await page.waitForFunction(() => !window.pxLanguageSwitching);
    await page.locator('.studio-home').waitFor();
    assert.equal(await page.locator('#homePrompt').inputValue(), 'پیش‌نویس شخصی');
    assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
    assert.equal(JSON.parse(await preview.env.BOT_KV.get('pf:preferences:11')).language, 'en');
    assert.ok(await page.locator('.studio-home').innerText().then(t => t.includes('Start chatting')));
    assert.ok(await page.locator('body').innerText().then(t => t.includes('برنامهٔ امروز من')), 'user-authored titles must remain unchanged');
    const routes = ['models', 'provider', 'model', 'council', 'playground', 'compare', 'routing', 'agents', 'tools', 'memory', 'knowledge', 'prompts', 'projects', 'automation', 'monitor', 'costs', 'eval', 'alerts', 'approvals', 'settings', 'backup', 'chat'];
    for (const route of routes) {
      await page.evaluate(route => go(route, route === 'provider' ? 'fixture' : route === 'model' ? 'model_fixture' : undefined), route);
      await page.waitForFunction(route => S.route === route && !document.querySelector('#view[aria-busy]'), route);
      const title = await page.locator('.head-t h1').innerText();
      assert.ok(!/[\u0600-\u06ff]/.test(title), `${route} header should be English`);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `${route} must fit ${width}px`);
      }
    }
    await page.evaluate(() => pxSetTheme('light'));
    await page.locator('#cmodel').click();
    await page.locator('#modelPickerSearch').waitFor();
    assert.ok(!/[\u0600-\u06ff]/.test(await page.locator('#modelPickerSearch').getAttribute('placeholder')));
    await page.keyboard.press('Escape');
    await page.evaluate(() => api('/chat', { body: { prompt: 'پیام شخصی فارسی', modelId: 'model_fixture', save: false } }));
    assert.ok(preview.upstream.at(-1).messages.some(m => m.role === 'system' && /English/.test(m.content)));
    assert.equal(preview.upstream.at(-1).messages.find(m => m.role === 'user').content, 'پیام شخصی فارسی');
    const invalid = await page.evaluate(async () => { try { await api('/preferences', { method: 'PATCH', body: { language: 'xx' } }); return 0; } catch (e) { return e.status; } });
    assert.equal(invalid, 400);
    await page.reload(); await page.locator('#cmodel').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.goto(preview.url + '/app?user=33'); await page.locator('.studio-home').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'fa', 'another account must not inherit the previous language');
    await page.goto(preview.url + '/app'); await page.locator('.studio-home').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'account language must be restored');
    await page.locator('#languageToggle').click();
    await page.waitForFunction(() => document.documentElement.lang === 'fa' && S.ready);
    await page.waitForFunction(() => !window.pxLanguageSwitching);
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await preview.close(); }
});
