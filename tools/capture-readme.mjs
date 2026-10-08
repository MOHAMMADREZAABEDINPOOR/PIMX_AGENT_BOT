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
  // Add fictional models for a reproducible gallery of the redesigned screens.
  const gallery = [
    ['gemini-pro', 'Gemini Pro Latest', 'gemini-pro-latest', 'Google Gemini'],
    ['gemini-flash', 'Gemini Flash', 'gemini-flash', 'Google Gemini'],
    ['claude-sonnet', 'Claude Sonnet', 'claude-sonnet', 'Anthropic'],
    ['codestral', 'Codestral', 'codestral', 'Mistral AI'],
    ['deep-research', 'Deep Research Preview', 'deep-research-preview', 'Google Gemini']
  ];
  await preview.env.BOT_KV.put('pf:models:index', JSON.stringify(gallery.map(([id]) => id)));
  for (const [id, displayName, apiModelId, providerName] of gallery) await preview.env.BOT_KV.put(`pf:model:${id}`, JSON.stringify({
    id, displayName, apiModelId, providerName, providerId: 'fixture', enabled: true, status: 'healthy',
    context: 1048576, capabilities: { chat: { supported: true }, streaming: { supported: true } }, stats: {}, pricing: { free: true }
  }));
  await page.evaluate(() => bust());
  const visit = async (route, params) => {
    await page.evaluate(([route, params]) => go(route, params), [route, params]);
    await page.waitForFunction(route => document.getElementById('view').dataset.workspace === route && !document.querySelector('#view[aria-busy]'), route);
  };
  const capture = async name => {
    await page.evaluate(() => { document.activeElement.blur(); document.getElementById('main').scrollTop = 0; });
    await page.screenshot({ path: fileURLToPath(new URL(name + '.png', folder)), animations: 'disabled', style: '.tst,#toasts{visibility:hidden!important}' });
  };
  await visit('models'); await capture('model-library');
  await visit('model', 'gemini-pro'); await capture('model-details');
  await visit('council'); await capture('council');
  await visit('playground'); await capture('playground');
  await visit('compare');
  await page.locator('.cmp-chip').nth(0).click(); await page.locator('.cmp-chip').nth(1).click();
  await capture('comparison');
  await visit('tools');
  await page.evaluate(() => { S.tab.tools = 'run'; render(); }); await page.locator('#trToolTrigger').waitFor();
  await page.locator('#trToolTrigger').click(); await capture('tool-picker');
  await page.keyboard.press('Escape'); await visit('routing');
  await page.locator('#r_defTrigger').click(); await capture('default-picker');
  console.log('Captured workspace, library, details, council, playground, comparison and selectors');
} finally { await browser.close(); await preview.close(); }
