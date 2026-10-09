import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { startPreview } from './ui-preview.mjs';
import { MemoryKV } from './test-fixtures.mjs';

test('Production Wrangler bundle boots and switches language without missing module variables', { timeout: 120000 }, async () => {
  const output = '.wrangler/bundle-test';
  await promisify(execFile)(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', output], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, timeout: 60000
  });
  const { default: worker } = await import(pathToFileURL(resolve(output, 'index.js')).href);
  const env = { BOT_KV: new MemoryKV(), BOT_TOKEN: 'fixture-only-token', ADMIN_ID: '11' };
  const response = await worker.fetch(new Request('https://fixture.invalid/app'), env, { waitUntil() {} });
  const html = await response.text();
  const preview = await startPreview(0, { appHtml: () => html });
  await preview.env.BOT_KV.put('pf:preferences:33', JSON.stringify({ language: 'en', responseMode: 'speed' }));
  const browser = await chromium.launch();
  try {
    for (const [user, language] of [[11, 'fa'], [33, 'en']]) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(language => localStorage.setItem('pimx_language', language), language);
      await page.goto(`${preview.url}/app?user=${user}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.studio-home').waitFor({ timeout: 10000 }).catch(error => {
        throw new Error(errors.join('; ') || error.message);
      });
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      assert.equal(await page.evaluate(() => pxText('بازگشت')), language === 'en' ? 'Back' : 'بازگشت');
      await page.locator('#languageToggle').click();
      await page.waitForFunction(() => !window.pxLanguageSwitching);
      assert.equal(await page.locator('html').getAttribute('lang'), language === 'en' ? 'fa' : 'en');
      await page.locator('.studio-home').waitFor();
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await preview.close(); }
});
