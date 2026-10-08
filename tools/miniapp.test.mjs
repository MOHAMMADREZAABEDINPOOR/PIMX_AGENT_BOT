import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPreview } from './ui-preview.mjs';

test('Mini App works across themes, mobile, real API streaming and account transfer', { timeout: 120000 }, async () => {
  const preview = await startPreview();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const artifacts = new URL('../artifacts/qa/', import.meta.url);
  await mkdir(artifacts, { recursive: true });
  const capture = async name => {
    await page.locator('.tst').last().waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
    return page.screenshot({ path: new URL(`${name}.png`, artifacts).pathname.replace(/^\/([A-Z]:)/, '$1'), fullPage: true });
  };
  try {
    await page.goto(`${preview.url}/app`);
    await page.locator('.studio-home').waitFor();
    assert.ok(await page.getByRole('heading', { name: /سارا/ }).isVisible());
    assert.equal(await page.locator('.studio-tools').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 4);
    await capture('home-desktop-dark');
    await page.getByRole('button', { name: 'تغییر تم', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.pxTheme === 'light');
    await page.locator('.studio-home').waitFor();
    await capture('home-desktop-light');
    await page.reload(); await page.locator('.studio-home').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-px-theme'), 'light');
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/preferences') && r.request().method() === 'PATCH'), page.getByRole('button', { name: 'عمیق', exact: true }).click()]);
    await page.reload(); await page.locator('.studio-home').waitFor();
    assert.equal(await page.getByRole('button', { name: 'عمیق', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.locator('#homePrompt').fill('یک برنامهٔ کوتاه برای امروز بنویس');
    await page.getByRole('button', { name: 'شروع گفتگو', exact: true }).click();
    await page.locator('.msgs').getByText('سلام!').waitFor();
    assert.ok(await page.getByRole('button', { name: 'توقف پاسخ', exact: true }).isVisible());
    await page.getByRole('button', { name: 'ارسال پیام', exact: true }).waitFor();
    assert.ok(preview.upstream.some(body => body.max_tokens === 4000));
    const conv = await page.evaluate(() => S.chat.id);
    assert.ok(JSON.parse(await preview.env.BOT_KV.get(`pf:conv:11:${conv}`)).messages.some(m => m.role === 'assistant'));
    await capture('chat-desktop-light');
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/preferences') && r.request().method() === 'PATCH'), page.getByRole('button', { name: 'سریع', exact: true }).click()]);
    await page.locator('#cinput').fill('پاسخ بعدی'); await page.getByRole('button', { name: 'ارسال پیام', exact: true }).click();
    await page.getByRole('button', { name: 'توقف پاسخ', exact: true }).click();
    await page.getByRole('button', { name: 'ارسال پیام', exact: true }).waitFor();
    assert.ok(await page.locator('#msgs').getByText(/پاسخ متوقف شد|تولید پاسخ متوقف شد/).count());

    await page.goto(`${preview.url}/app#backup`); await page.locator('.backup-page').waitFor();
    await page.getByRole('button', { name: 'ارسال فایل به تلگرام', exact: true }).click();
    await page.getByText('فایل در گفتگوی خصوصی بات ارسال شد.', { exact: true }).first().waitFor();
    assert.equal(preview.deliveries.length, 1);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'دانلود روی دستگاه', exact: true }).click()]);
    assert.ok(download.suggestedFilename().startsWith('pimx-account-'));
    await capture('backup-desktop-light');
    const archive = JSON.parse(preview.deliveries[0][2]);
    // Same browser storage, different signed Telegram account.
    await page.goto(`${preview.url}/app?user=33#backup`); await page.locator('.backup-page').waitFor();
    assert.equal(await page.evaluate(() => S.user.id), 33);
    assert.equal(await page.getByRole('heading', { name: 'پشتیبان کامل دیتابیس', exact: true }).count(), 0);
    await page.locator('#backupFile').setInputFiles({ name: 'account.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archive)) });
    await page.getByText('فایل معتبر است', { exact: true }).waitFor();
    await page.getByRole('button', { name: /تأیید و انتقال به حساب من/ }).click();
    await page.getByText('✓ اطلاعاتت منتقل شد', { exact: true }).waitFor();
    assert.ok(JSON.parse(await preview.env.BOT_KV.get('pf:convindex:33')).length >= 2);
    await page.getByRole('button', { name: /ادامهٔ گفتگو/ }).click(); await page.locator('#cinput').waitFor();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${preview.url}/app`); await page.locator('.studio-home').waitFor();
    await capture('home-mobile-light');
    assert.ok(await page.locator('.tabbar').isVisible());
    assert.equal(await page.locator('.studio-tools').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.studio-home *')].some(el => getComputedStyle(el).position !== 'absolute' && el.getBoundingClientRect().right > innerWidth + 2));
    assert.equal(overflow, false, 'mobile layout must stay within the viewport');
    await page.getByRole('button', { name: 'تغییر تم', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.pxTheme === 'dark'); await page.locator('.studio-home').waitFor();
    await capture('home-mobile-dark');
    await page.locator('.tabbar').getByRole('button', { name: 'پشتیبان', exact: true }).click(); await page.locator('.backup-page').waitFor();
    await capture('backup-mobile-dark');
    await page.locator('.tabbar').getByRole('button', { name: 'چت', exact: true }).click(); await page.locator('#cinput').waitFor();
    await capture('chat-mobile-dark');
    assert.ok(await page.locator('#cinput').isVisible());
    const composer = await page.locator('#cinput').boundingBox();
    assert.ok(composer.y + composer.height <= 844 - 64, 'composer must be fully above the mobile tab bar');
    assert.ok(await page.getByRole('button', { name: 'سریع', exact: true }).isVisible());
    await page.locator('.tabbar').getByRole('button', { name: 'منوی کامل', exact: true }).click();
    assert.ok(await page.locator('.side.open').isVisible());
    await page.locator('#scrim').click({ position: { x: 15, y: 100 } });
    assert.equal(await page.locator('.side.open').count(), 0);
    await page.goto(`${preview.url}/app?user=44#models`);
    await page.locator('#view').waitFor();
    const checkedRoutes = ['models', 'council', 'knowledge', 'memory', 'prompts', 'projects', 'agents', 'tools', 'automation', 'monitor', 'settings'];
    for (const route of checkedRoutes) {
      await page.evaluate(route => go(route), route);
      await page.waitForFunction(() => !document.querySelector('#view[aria-busy]') && !document.querySelector('#view .loading-box'));
      const failed = await page.locator('#view').getByText(/ctx is not a function|Cannot read properties|خطا در دریافت اطلاعات|خطای غیرمنتظره/).count();
      assert.equal(failed, 0, `route ${route} must render without an API or runtime error`);
    }
    await page.evaluate(() => localStorage.removeItem('pimx_token'));
    await page.goto(`${preview.url}/app?anonymous=1`);
    await page.locator('.auth-gate').waitFor();
    assert.equal(await page.locator('.studio-home').count(), 0);
    assert.deepEqual(errors, []);
    await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: true, screenshots: 8, checks: ['theme persistence', 'mode persistence', 'real stream', 'stop', 'Telegram delivery adapter', 'download', 'account switch', 'restore to second account', 'admin-only database export', 'mobile layout', 'mobile composer', 'navigation dismissal', 'unauthenticated entry'], checkedRoutes, pageErrors: errors }, null, 2));
  } finally { await browser.close(); await preview.close(); }
});
