import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, webkit, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createPlaygroundServer } from '../server.mjs';

let browser;
let server;
let url;
before(async () => {
  server = createPlaygroundServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await (process.env.BROWSER === 'webkit' ? webkit : chromium).launch();
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function openPage(t, viewport = { width: 1440, height: 1100 }) {
  const context = await browser.newContext({ viewport });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.locator('#phrase')).toBeVisible();
  return page;
}

test('romaji converts, keyboard selects, and notebook survives reload', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#phrase');
  await input.pressSequentially('kinoueigawomimashita');
  await expect(input).toHaveValue('きのうえいがをみました');
  await input.press('Space');
  await expect(page.locator('#candidates button').first()).toHaveText('昨日映画を見ました');
  await input.press('ArrowDown');
  await expect(page.locator('#candidates button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await input.press('Enter');
  await expect(page.locator('#notebook')).toHaveValue('昨日映画を観ました');
  await expect(input).toHaveValue('');
  await page.reload();
  await expect(page.locator('#notebook')).toHaveValue('昨日映画を観ました');
  await input.pressSequentially('sonoato');
  await page.reload();
  await expect(input).toHaveValue('そのあと');
  await page.locator('#keep-kana').click();
  await expect(page.locator('#notebook')).toHaveValue('昨日映画を観ましたそのあと');
});

test('stale responses and service failures preserve the current phrase', async (t) => {
  const page = await openPage(t);
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/convert', async (route) => {
    await held;
    await route
      .fulfill({ json: { candidates: [{ text: '古い候補' }], engineMs: 5 } })
      .catch(() => {});
  });
  await page.locator('#phrase').fill('あめ');
  await page.locator('#convert').click();
  await expect(page.locator('#status')).toHaveText('Finding kanji…');
  await page.locator('#phrase').fill('はし');
  release();
  await expect(page.locator('#candidates button')).toHaveCount(0);
  await expect(page.locator('#phrase')).toHaveValue('はし');
  await page.unrouteAll({ behavior: 'wait' });
  await page.route('**/api/v1/convert', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable.' } })
  );
  await page.locator('#convert').click();
  await expect(page.locator('#status')).toContainText('Your phrase has been kept.');
  await page.locator('#keep-kana').click();
  await expect(page.locator('#notebook')).toHaveValue('はし');
});

test('native composition keys are not intercepted and kana can be committed', async (t) => {
  const page = await openPage(t);
  await page.locator('#phrase').fill('こんにちは');
  const consumed = await page.locator('#phrase').evaluate((input) => {
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    return !input.dispatchEvent(event);
  });
  assert.equal(consumed, false);
  await page.locator('#keep-kana').click();
  await expect(page.locator('#notebook')).toHaveValue('こんにちは');
});

test('notebook grows and the desktop/mobile candidate layouts do not overflow', async (t) => {
  const page = await openPage(t);
  await page.locator('#notebook').fill('昨日友達と映画を見ました。\n'.repeat(12));
  const sizes = await page
    .locator('#notebook')
    .evaluate((field) => ({ client: field.clientHeight, scroll: field.scrollHeight }));
  assert.equal(sizes.client, sizes.scroll);
  await page.locator('#notebook').fill('昨日映画を見ました。そのあと友達と晩ご飯を食べました。');
  await page.locator('[data-reading="はしをわたりました"]').click();
  await expect(page.locator('#candidates button').first()).toHaveText('橋を渡りました');
  const directory = process.env.SCREENSHOT_DIR;
  if (directory) {
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: `${directory}/desktop.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await expect(page.locator('#convert')).toBeVisible();
  if (directory) await page.screenshot({ path: `${directory}/mobile.png`, fullPage: true });
});
