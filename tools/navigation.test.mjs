import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startPreview } from './ui-preview.mjs';

test('Back navigation works in the header, Telegram, browser history and direct links', { timeout: 120000 }, async () => {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const route = async (name, params, query) => {
    await page.evaluate(([name, params, query]) => go(name, params, query), [name, params, query]);
    await page.waitForFunction(name => S.route === name, name);
  };
  const back = async name => {
    await page.getByRole('button', { name: 'بازگشت', exact: true }).click();
    await page.waitForFunction(name => S.route === name, name);
  };
  try {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${preview.url}/app`);
      await page.locator('.studio-home').waitFor();
      await page.evaluate(() => {
        Telegram.WebApp.BackButton = {
          visible: false, handlers: [],
          show() { this.visible = true; }, hide() { this.visible = false; },
          onClick(fn) { this.handlers.push(fn); },
          offClick(fn) { this.handlers = this.handlers.filter(handler => handler !== fn); }
        };
        syncBackButton();
      });
      assert.equal(await page.locator('#headBack').isVisible(), false);
      assert.equal(await page.evaluate(() => Telegram.WebApp.BackButton.visible), false);
      await route('providers');
      await page.locator('.prov-card').first().waitFor();
      await page.getByRole('button', { name: '⚙ مدیریت و مدل‌ها', exact: true }).click();
      await page.waitForFunction(() => S.route === 'provider');
      const button = await page.locator('#headBack').boundingBox();
      assert.ok(button && button.x >= 0 && button.x + button.width <= width);
      await route('model', 'model_fixture');
      await back('provider');
      await back('providers');
      await page.goForward();
      await page.waitForFunction(() => S.route === 'provider');
      await page.evaluate(() => Telegram.WebApp.BackButton.handlers.forEach(fn => fn()));
      await page.waitForFunction(() => S.route === 'providers');
      await back('home');
      assert.equal(await page.locator('#headBack').isVisible(), false);
      assert.equal(await page.evaluate(() => Telegram.WebApp.BackButton.handlers.length), 1);
      assert.equal(await page.evaluate(() => Telegram.WebApp.BackButton.visible), false);

      // Restore filters and route parameters when returning to a list.
      await route('models', {}, { providerId: 'fixture', search: 'Fixture' });
      await route('model', 'model_fixture');
      await back('models');
      assert.equal(await page.evaluate(() => S.query.search), 'Fixture');
      // Repeatedly visiting an existing route must still follow actual history.
      await route('providers'); await route('provider', 'fixture'); await route('providers');
      await back('provider');
      await page.evaluate(() => { sheet({ title: 'Navigation test', body: 'Test', foot: null }); goBack(); });
      assert.equal(await page.locator('#sheetOverlay').count(), 0);
      assert.equal(await page.evaluate(() => S.route), 'provider');
    }
    // A fresh deep link has no safe earlier app entry. Walk up to the root.
    await page.goto(`${preview.url}/app#provider/fixture`);
    await page.reload();
    await page.locator('#headBack').waitFor();
    await back('providers'); await back('home');
    await page.goto(`${preview.url}/app#run/missing`);
    await page.reload();
    await page.locator('#headBack').waitFor();
    await back('runs'); await back('agents'); await back('home');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await preview.close(); }
});
