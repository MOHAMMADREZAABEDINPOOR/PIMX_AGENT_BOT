import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startPreview } from './ui-preview.mjs';

test('Workspace library, comparison and searchable selectors work across mobile and themes', { timeout: 120000 }, async () => {
  const preview = await startPreview();
  const put = (key, value) => preview.env.BOT_KV.put(key, JSON.stringify(value));
  const models = [
    ['model_fixture', 'Gemini Pro Latest', 'gemini-pro-latest'],
    ['preview', 'Gemini Pro Latest', 'gemini-pro-preview'],
    ['long', 'Deep Research Max Preview with a very long full model display name', 'deep-research-max-preview'],
    ['escaped', '<img src=x onerror=alert(1)>', 'escaped-model'],
    ...Array.from({ length: 96 }, (_, i) => [`model-${i}`, `Gemini Lab ${i}`, `gemini-lab-${i}`])
  ];
  await put('pf:models:index', models.map(([id]) => id));
  for (const [id, displayName, apiModelId] of models) await put(`pf:model:${id}`, {
    id, displayName, apiModelId, providerId: 'fixture', providerName: 'Google Gemini', enabled: true,
    status: 'healthy', capabilities: { chat: { supported: true }, streaming: { supported: true } },
    stats: {}, pricing: { free: true }, context: 1048576
  });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const folder = new URL('../artifacts/workspace/', import.meta.url); await mkdir(folder, { recursive: true });
  const visit = async (route, params) => {
    await page.evaluate(([route, params]) => go(route, params), [route, params]);
    await page.waitForFunction(route => S.route === route && document.querySelector('#view').dataset.workspace === route && !document.querySelector('#view[aria-busy]'), route);
  };
  const capture = async name => {
    await page.evaluate(() => { document.activeElement.blur(); document.getElementById('main').scrollTop = 0; });
    return page.screenshot({ path: fileURLToPath(new URL(name + '.png', folder)), animations: 'disabled', style: '.tst,#toasts{visibility:hidden!important}' });
  };
  const checkOverflow = async () => assert.equal(await page.evaluate(() => {
    const main = document.querySelector('#main'); return main.scrollWidth > main.clientWidth + 1;
  }), false, 'workspace must fit the viewport');
  try {
    await page.goto(`${preview.url}/app`); await page.locator('.studio-home').waitFor();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => pxSetTheme(theme), theme);
        await visit('models');
        assert.equal(await page.locator('.studio-model-card').count(), models.length);
        assert.equal(await page.locator('.studio-model-card img').count(), 0);
        await page.getByRole('searchbox', { name: 'جستجوی کتابخانه مدل‌ها' }).fill('pro latest');
        assert.equal(await page.locator('.studio-model-card:visible').count(), 2);
        await page.locator('#modelSearch').fill('does-not-exist');
        assert.ok(await page.locator('#modelListEmpty').isVisible());
        await page.locator('#modelSearch').fill('');
        await checkOverflow(); await capture(`models-${width}-${theme}`);
        await visit('model', 'model_fixture'); await checkOverflow(); await capture(`model-${width}-${theme}`);
        await visit('council');
        await page.locator('#councilModelSearch').fill('gemini-lab-95');
        assert.equal(await page.locator('#cnlPicker .pick:visible').count(), 1);
        await page.locator('#cnlPicker .pick:visible').click();
        assert.equal(await page.locator('#cnlPicker .pick:visible').getAttribute('aria-pressed'), 'true');
        await page.locator('#councilModelSearch').fill('');
        await checkOverflow(); await capture(`council-${width}-${theme}`);
        await visit('compare');
        await page.locator('#cmpSearch').fill('pro latest');
        assert.equal(await page.locator('.cmp-chip:visible').count(), 2);
        await page.locator('.cmp-chip:visible').first().click();
        await page.locator('.cmp-chip:visible').last().click();
        assert.ok(await page.locator('#cmpRunBtn').isEnabled());
        await page.locator('#cmpSearch').fill('');
        await checkOverflow(); await capture(`compare-${width}-${theme}`);
        await visit('playground');
        await page.locator('#pgmTrigger').click();
        assert.ok(await page.locator('#app').evaluate(el => el.inert));
        await page.getByRole('searchbox', { name: 'جستجوی گزینه‌ها' }).fill('gemini-pro-preview');
        assert.equal(await page.locator('[data-choice-index]').count(), 1);
        await capture(`selector-${width}-${theme}`);
        await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
        assert.equal(await page.locator('#pgm').inputValue(), 'preview');
        assert.equal(await page.locator('#workspaceChoiceOverlay').count(), 0);
        assert.ok(await page.locator('#pgmTrigger').evaluate(el => el === document.activeElement));
        await checkOverflow(); await capture(`playground-${width}-${theme}`);
        await visit('tools');
        await page.evaluate(() => { S.tab.tools = 'run'; render(); });
        await page.locator('#trToolTrigger').waitFor();
        await page.locator('#trToolTrigger').click();
        await page.getByRole('searchbox', { name: 'جستجوی گزینه‌ها' }).fill('calculator');
        await page.locator('[data-choice-index]').click();
        assert.equal(await page.locator('#trTool').inputValue(), 'calculator');
        await checkOverflow(); await capture(`tools-${width}-${theme}`);
        await visit('routing');
        await page.locator('#r_defTrigger').click();
        await page.getByRole('searchbox', { name: 'جستجوی گزینه‌ها' }).fill('gemini-pro-preview');
        await page.locator('[data-choice-index]').click();
        assert.equal(await page.locator('#r_def').inputValue(), 'preview');
        await checkOverflow();
        await page.evaluate(() => { S.cache.cmpSel = []; S.council.modelIds = []; });
      }
    }
    // Verify the selection travels through the actual execution request.
    await visit('playground'); await page.locator('#pgmTrigger').click();
    await page.getByRole('searchbox', { name: 'جستجوی گزینه‌ها' }).fill('gemini-pro-preview');
    await page.locator('[data-choice-index]').click();
    const request = page.waitForRequest(r => r.url().includes('/api/models/preview/run'));
    await page.getByRole('button', { name: '▶ اجرا', exact: true }).click();
    assert.equal((await request).method(), 'POST');
    await visit('models');
    const toggle = page.waitForResponse(r => r.url().endsWith('/api/models/model_fixture') && r.request().method() === 'PATCH');
    await page.locator('.studio-model-card').filter({ has: page.locator('button[onclick*="model_fixture"]') }).first().getByRole('button', { name: 'غیرفعال', exact: true }).click();
    assert.equal((await toggle).request().postDataJSON().enabled, false);
    await page.waitForFunction(() => document.querySelector('.studio-model-card.is-disabled'));
    await page.locator('.studio-model-card.is-disabled').getByRole('button', { name: 'فعال', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.studio-model-card.is-disabled'));
    await visit('models'); await page.evaluate(() => go('home')); await page.locator('.studio-home').waitFor();
    assert.equal(await page.locator('#view').evaluate(el => el.classList.contains('workspace-view')), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await preview.close(); }
});
