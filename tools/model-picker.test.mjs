import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startPreview } from './ui-preview.mjs';

// Real API catalog with duplicate display names, untested/failed models and
// enough rows to cross both the previous 80-option and 300-model limits.
async function seedCatalog(env) {
  const put = (key, value) => env.BOT_KV.put(key, JSON.stringify(value));
  const providers = [['google', 'Google Gemini'], ['openai', 'OpenAI'], ['anthropic', 'Anthropic']];
  await put('pf:providers:index', providers.map(([id]) => id));
  for (const [id, name] of providers) await put(`pf:provider:${id}`, { id, name, baseUrl: 'https://fixture.invalid/v1', format: 'openai', auth: 'none', enabled: true, status: 'healthy', keys: [] });
  const models = [
    ['lite-a', 'google', 'Gemini 3.5 Flash Lite', 'gemini-3.5-flash-lite', 'healthy'],
    ['lite-b', 'google', 'Gemini 3.5 Flash Lite', 'gemini-3.5-flash-lite-preview', 'healthy'],
    ['research', 'google', 'Deep Research Max Preview (Apr-21-2026)', 'deep-research-max-preview-apr-21-2026', 'failed'],
    ['long', 'google', 'Gemini Robotics Extended Computer Use Preview 10-2025 with an intentionally long complete model name', 'gemini-robotics-extended-computer-use-preview-10-2025-long', 'degraded'],
    ['gpt', 'openai', 'GPT Test', 'gpt-test', 'healthy'],
    ['claude', 'anthropic', 'Claude Test', 'claude-test', 'unknown'],
    ['persian', 'google', 'مدل فارسی هوشمند', 'persian-test', 'unknown'],
    ['escape', 'google', '<img src=x onerror=alert(1)>', 'safe-html-test', 'unknown'],
    ...Array.from({ length: 322 }, (_, i) => [`lab-${i}`, 'google', `Gemini Lab ${String(i).padStart(3, '0')}`, `gemini-lab-${i}`, 'unknown'])
  ];
  await put('pf:models:index', models.map(([id]) => id));
  for (const [id, providerId, displayName, apiModelId, status] of models) await put(`pf:model:${id}`, { id, providerId, providerName: providers.find(([id]) => id === providerId)[1], displayName, apiModelId, status, enabled: true, capabilities: { chat: { supported: true }, streaming: { supported: true } }, pricing: { free: true }, stats: {} });
  return models.length;
}

test('model picker searches a complete catalog and sends the exact selected model', { timeout: 120000 }, async () => {
  const preview = await startPreview();
  const total = await seedCatalog(preview.env);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const artifacts = new URL('../artifacts/qa/', import.meta.url);
  await mkdir(artifacts, { recursive: true });
  const capture = async name => {
    await page.locator('.tst').last().waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
    return page.screenshot({ path: fileURLToPath(new URL(name + '.png', artifacts)), fullPage: true, animations: 'disabled' });
  };
  const open = async () => { await page.locator('#cmodel').click(); await page.locator('#modelPickerSearch').waitFor(); };
  const dialog = page.getByRole('dialog', { name: 'مدل گفتگو را انتخاب کن' });
  const search = page.getByRole('searchbox', { name: 'جستجوی مدل یا پروایدر' });
  try {
    await page.goto(`${preview.url}/app#chat`);
    await open();
    assert.equal(await dialog.locator('.model-option').count(), total);
    assert.equal(await page.locator('#cmodel').getAttribute('aria-expanded'), 'true');
    assert.ok(await search.evaluate(el => el === document.activeElement));
    assert.ok(await page.locator('#app').evaluate(el => el.inert));
    assert.equal(await dialog.locator('.model-auto').getAttribute('aria-pressed'), 'true');
    assert.equal(await dialog.locator('.model-option img').count(), 0, 'registry names must be escaped');
    await capture('model-picker-desktop-dark');

    await search.fill('Gemini Lab 321');
    assert.equal(await dialog.locator('.model-option').count(), 1, 'the last page remains searchable');
    await search.fill('Flash Lite');
    assert.equal(await dialog.locator('.model-option').count(), 2, 'same-name models stay distinct');
    assert.deepEqual(await dialog.locator('.model-option-id').allTextContents(), ['gemini-3.5-flash-lite', 'gemini-3.5-flash-lite-preview']);
    await dialog.locator('[data-model-id="lite-b"]').click();
    assert.equal(await page.evaluate(() => S.chat.modelId), 'lite-b');
    assert.ok(await page.locator('#cmodel').evaluate(el => el === document.activeElement));
    assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
    await page.locator('#cinput').fill('انتخاب مدل مشخص');
    const [request] = await Promise.all([page.waitForRequest(r => r.url().endsWith('/api/chat/stream')), page.getByRole('button', { name: 'ارسال پیام', exact: true }).click()]);
    assert.equal(request.postDataJSON().modelId, 'lite-b');
    await page.getByRole('button', { name: 'ارسال پیام', exact: true }).waitFor();
    assert.equal(preview.upstream.at(-1).model, 'gemini-3.5-flash-lite-preview');

    await open();
    await dialog.locator('[data-provider="openai"]').click();
    assert.equal(await dialog.locator('.model-option').count(), 1);
    await search.fill('Gemini');
    assert.ok(await dialog.getByText('مدلی پیدا نشد', { exact: true }).isVisible());
    await dialog.getByRole('button', { name: 'پاک کردن فیلترها', exact: true }).click();
    assert.equal(await dialog.locator('.model-option').count(), total);
    await search.fill('فارسي هوشمند');
    assert.equal(await dialog.locator('.model-option').count(), 1, 'Persian/Arabic letter variants match');
    await search.fill('research');
    assert.ok(await dialog.getByText('نیاز به بررسی', { exact: true }).isVisible());
    await dialog.locator('[data-model-id="research"]').click();
    assert.equal(await page.evaluate(() => S.chat.modelId), 'research', 'a failed probe must not disable explicit selection');

    await open();
    await search.fill('gpt-test');
    await search.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.modelId), 'gpt');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => S.chat.modelId), 'gpt');
    await open();
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    assert.ok(await page.locator('#cmodel').evaluate(el => el === document.activeElement));
    await open();
    await page.locator('#modelPickerOverlay').click({ position: { x: 8, y: 8 } });
    assert.equal(await dialog.count(), 0);
    await open();
    await dialog.locator('.model-auto').click();
    assert.equal(await page.evaluate(() => S.chat.modelId), '');
    await page.getByRole('button', { name: 'تغییر تم', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.pxTheme === 'light');
    await open(); await capture('model-picker-desktop-light');
    // Reverse Tab from the first control and forward Tab from the last control
    // must remain inside the modal, even though the catalog is long.
    await dialog.getByRole('button', { name: 'بستن انتخاب مدل' }).focus();
    await page.keyboard.press('Shift+Tab');
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('#modelPickerResults')));
    await page.keyboard.press('Tab');
    assert.ok(await dialog.getByRole('button', { name: 'بستن انتخاب مدل' }).evaluate(el => el === document.activeElement));
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 390, height: 844 });
    await open(); await capture('model-picker-mobile-light');
    assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
    await search.fill('computer use');
    const longName = await dialog.locator('.model-option-name').textContent();
    assert.ok(longName.endsWith('complete model name'), 'long names remain complete on mobile');
    assert.equal(await dialog.locator('.model-option').evaluate(el => el.scrollWidth > el.clientWidth), false);
    await dialog.locator('[data-model-id="long"]').click();
    await page.getByRole('button', { name: 'تغییر تم', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.pxTheme === 'dark');
    await open(); await capture('model-picker-mobile-dark');
    // iOS/WebView keyboards can shrink only visualViewport, leaving media
    // queries unchanged. Exercise that resize path separately.
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: 350 });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    assert.ok(await dialog.locator('#modelPickerResults').evaluate(el => el.clientHeight > 60));
    const keyboardBounds = await dialog.boundingBox();
    assert.ok(keyboardBounds.y + keyboardBounds.height <= 351);
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 390 }]) {
      await page.setViewportSize(viewport);
      const bounds = await dialog.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1);
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 1);
      assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
      assert.ok(await dialog.locator('#modelPickerResults').evaluate(el => el.clientHeight > 50), 'list remains usable when the keyboard reduces height');
    }
    await page.evaluate(() => go('home'));
    await page.locator('.studio-home').waitFor();
    assert.equal(await dialog.count(), 0);
    assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
    assert.deepEqual(errors, []);
    await writeFile(new URL('model-picker-results.json', artifacts), JSON.stringify({ pass: true, catalog: total, checked: ['pagination', 'search', 'provider filter', 'duplicate names', 'exact upstream model', 'Auto reset', 'failed probe selection', 'escaping', 'keyboard', 'focus trap', 'backdrop', 'RTL', 'dark/light', 'mobile', 'short viewport', 'route cleanup'], errors }, null, 2));
  } finally { await browser.close(); await preview.close(); }
});
