import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startPreview } from './ui-preview.mjs';

const folder = new URL('../assets/readme/', import.meta.url);
await mkdir(folder, { recursive: true });
const preview = await startPreview();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  await page.goto(`${preview.url}/app`);
  await page.locator('.studio-home').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.screenshot({ path: fileURLToPath(new URL('workspace.png', folder)) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => go('providers'));
  await page.locator('.prov-card').first().waitFor();
  await page.getByRole('button', { name: '⚙ مدیریت و مدل‌ها', exact: true }).click();
  await page.waitForFunction(() => S.route === 'provider' && !document.querySelector('#view .loading-box'));
  await page.screenshot({ path: fileURLToPath(new URL('provider-mobile.png', folder)) });
  console.log('Captured workspace and mobile provider screenshots');
} finally { await browser.close(); await preview.close(); }
