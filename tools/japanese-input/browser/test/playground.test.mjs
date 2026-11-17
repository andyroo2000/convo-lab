import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, webkit, firefox, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createBrowserServer } from '../server.mjs';
let browser, server, context, page, url;
before(async () => {
  server = createBrowserServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await { chromium, webkit, firefox }[process.env.BROWSER || 'chromium'].launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  page = await context.newPage();
  await page.goto(url);
  await expect(page.locator('#engine-status')).toHaveText('Ready to write · Neural conversion', {
    timeout: 90000,
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function empty() {
  await page.locator('#notebook').press('Escape');
  await page.locator('#notebook').fill('');
}
async function type(romaji, expected) {
  const input = page.locator('#notebook');
  await input.pressSequentially(romaji);
  await input.press('Space');
  await expect(input).toHaveValue(expected, { timeout: 15000 });
  return input;
}
test('all inference stays in the browser, including while offline', async () => {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await context.setOffline(true);
  const result = await page.evaluate(() => browserEngine.convert({ reading: 'はしでたべました' }));
  assert.equal(result.candidates[0].text, '箸で食べました');
  assert.equal(
    requests.some((url) => url.includes('/api/')),
    false
  );
  await context.setOffline(false);
});
test('live conversion, arrows, section focus, commit, autosave and undo', async () => {
  await empty();
  const input = await type('hashidetabemashita', '箸で食べました');
  await expect(page.locator('.composition-section')).toHaveCount(2);
  await input.press('ArrowDown');
  await expect(page.locator('#candidates')).toBeVisible();
  await input.press('ArrowRight');
  await input.press('ArrowLeft');
  await input.press('Enter');
  await expect(page.locator('#candidates')).toBeHidden();
  await input.press('ControlOrMeta+z');
  await expect(input).toHaveValue('');
  await input.press('ControlOrMeta+Shift+z');
  assert.ok((await input.inputValue()).includes('食べました'));
});
test('conversion in the middle preserves emoji and surrounding text', async () => {
  await empty();
  const input = page.locator('#notebook');
  await input.fill('前🙂後');
  await input.evaluate((field) => field.setSelectionRange(3, 3));
  await type('hashidetabemashita', '前🙂箸で食べました後');
  await input.press('Escape');
  await expect(input).toHaveValue('前🙂はしでたべました後');
  await input.press('Backspace');
  await expect(input).toHaveValue('前🙂はしでたべまし後');
});
test('expanded alternatives and manual boundaries retain whole-phrase neural scores', async () => {
  const result = await page.evaluate(() =>
    browserEngine.convert({ reading: 'はしでたべました', expanded: true, boundaries: [1] })
  );
  assert.equal(result.candidates[0].text, 'はしで食べました');
  assert.ok(result.candidates.length > 100);
  let previous = Infinity;
  for (const candidate of result.candidates) {
    assert.ok(Number.isFinite(candidate.neuralScore));
    assert.ok(candidate.neuralScore <= previous);
    previous = candidate.neuralScore;
    assert.equal(candidate.units.map((unit) => unit.reading).join(''), 'はしでたべました');
    assert.equal(candidate.units[0].reading, 'は');
  }
});
test('Shift arrows resize sections, and menu choices survive continued typing', async () => {
  await empty();
  const input = await type('hashidetabemashita', '箸で食べました');
  await input.press('Shift+ArrowLeft');
  await input.press('Shift+ArrowLeft');
  await expect(page.locator('.composition-section').first()).toHaveText(/^[はハ]$/, {
    timeout: 60000,
  });
  await input.press('ArrowDown');
  await expect
    .poll(() => page.locator('#candidates button').count(), { timeout: 60000 })
    .toBeGreaterThan(5);
  await input.press('Enter');
  await expect(page.locator('#candidates')).toBeHidden();
});
test('punctuation shortcuts, uncommitted n, native IME and ordinary English', async () => {
  await empty();
  const input = page.locator('#notebook');
  await input.pressSequentially('ko-hi-');
  await input.press('Space');
  await expect(input).toHaveValue(/珈琲|コーヒー/, { timeout: 10000 });
  await input.press('/');
  await expect(input).toHaveValue(/・$/);
  await input.pressSequentially('hon');
  await input.press('Enter');
  await expect(input).toHaveValue(/ほん$/);
  await input.evaluate((field) => {
    field.dispatchEvent(new CompositionEvent('compositionstart'));
    field.dispatchEvent(new CompositionEvent('compositionend', { data: '日本語' }));
  });
});
test('late and failed conversions keep newer edits intact', async () => {
  await empty();
  await page.evaluate(() => {
    const original = browserEngine.convert.bind(browserEngine);
    window.originalConvert = original;
    browserEngine.convert = async (input) => {
      await new Promise((r) => setTimeout(r, 700));
      return original(input);
    };
  });
  const input = page.locator('#notebook');
  await input.pressSequentially('hashi');
  await input.press('Space');
  await input.press('Enter');
  await input.fill('Keep this');
  await page.waitForTimeout(1200);
  await expect(input).toHaveValue('Keep this');
  await page.evaluate(() => {
    browserEngine.convert = async () => {
      throw Error('Test failure');
    };
  });
  await input.fill('');
  await input.pressSequentially('hashi');
  await input.press('Space');
  await page.waitForTimeout(500);
  await expect(input).toHaveValue('はし');
  await page.evaluate(() => {
    browserEngine.convert = window.originalConvert;
  });
});
test('notebook grows, popup fits narrow screens and screenshots show the actual port', async () => {
  await empty();
  await page.setViewportSize({ width: 390, height: 844 });
  const input = await type('hashidetabemashita', '箸で食べました');
  await input.press('ArrowDown');
  const bounds = await page.locator('#candidates').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
  await mkdir(new URL('../../.engines/screenshots/', import.meta.url), { recursive: true });
  await page.screenshot({
    path: new URL(
      `../../.engines/screenshots/browser-${process.env.BROWSER || 'chromium'}-mobile.png`,
      import.meta.url
    ).pathname,
  });
  await input.press('Enter');
  await input.fill('昨日映画を見ました。\n'.repeat(50));
  const dimensions = await input.evaluate((field) => ({
    height: field.clientHeight,
    scroll: field.scrollHeight,
  }));
  assert.ok(dimensions.scroll <= dimensions.height + 2);
  await page.setViewportSize({ width: 1440, height: 1100 });
});

test('explicit spelling survives extending the uncommitted whole phrase', async () => {
  await empty();
  const input = page.locator('#notebook');
  await input.pressSequentially('hashidetabemashita');
  await expect(input).toHaveValue('箸で食べました', { timeout: 15000 });
  await input.press('ArrowRight');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('橋で食べました');
  await input.pressSequentially('sonoato');
  await input.press('Space');
  await expect(input).toHaveValue(/^橋で食べましたその/, { timeout: 15000 });
  await input.press('Enter');
  await expect(page.locator('.composition-layer')).toBeHidden();
});

test('romaji doubles consonants and switching to ABC preserves ordinary English', async () => {
  await empty();
  const input = page.locator('#notebook');
  await input.pressSequentially('konnichiha');
  await input.press('Enter');
  await input.pressSequentially('kitte');
  await input.press('Enter');
  await input.pressSequentially('hon');
  await input.press('Enter');
  await expect(input).toHaveValue('こんにちはきってほん');
  await page.locator('#mode').click();
  await input.pressSequentially(' Hello world!');
  await expect(input).toHaveValue('こんにちはきってほん Hello world!');
  await page.locator('#mode').click();
});

test('saving, reloading and retrying the model preserve notebook text', async () => {
  await empty();
  const input = page.locator('#notebook');
  await input.fill('昨日映画を見ました。');
  await page.reload();
  await expect(page.locator('#engine-status')).toHaveText('Ready to write · Neural conversion', {
    timeout: 90000,
  });
  await expect(input).toHaveValue('昨日映画を見ました。');
  await page.evaluate(() => browserEngine.fail(Error('Test restart')));
  await expect(page.locator('#retry-engine')).toBeVisible({ timeout: 5000 });
  await page.locator('#retry-engine').click();
  await expect(page.locator('#engine-status')).toHaveText('Ready to write · Neural conversion', {
    timeout: 90000,
  });
  await expect(input).toHaveValue('昨日映画を見ました。');
  await page.screenshot({
    path: new URL('../../.engines/screenshots/browser-desktop.png', import.meta.url).pathname,
    fullPage: true,
  });
});
