import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, webkit, expect } from '@playwright/test';
import { createPlaygroundServer } from '../server.mjs';
let browser, server, url;
before(async () => {
  server = createPlaygroundServer({
    snapshot: () => ({ state: 'ready', neural: true }),
    close() {},
    convert: async (reading) => ({ candidates: [{ text: reading, reading }], engineMs: 1 }),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await (process.env.BROWSER === 'webkit' ? webkit : chromium).launch();
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
});
async function open(t) {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(url);
  const field = page.locator('#notebook');
  await expect(field).toBeEditable();
  return { page, field };
}
test('typing and deleting punctuation keeps the conversion underline', async (t) => {
  const { field } = await open(t);
  await field.pressSequentially('ame1.');
  await expect(field).toHaveValue('あめ1。');
  await expect(field).toHaveClass(/composing/);
  await field.press('Backspace');
  await expect(field).toHaveValue('あめ1');
  await expect(field).toHaveClass(/composing/);
  await field.press('Enter');
  await expect(field).not.toHaveClass(/composing/);
});
test('moving the caret and editing an unfinished phrase preserves composition', async (t) => {
  const { page, field } = await open(t);
  await field.pressSequentially('kyouhaiitenki');
  await field.evaluate((el) => el.setSelectionRange(7, 7));
  await field.press('Backspace');
  await expect(field).toHaveValue('きょうはいいんき');
  await field.pressSequentially('te');
  await expect(field).toHaveValue('きょうはいいてんき');
  await expect(field).toHaveClass(/composing/);
  await field.press('Space');
  await expect(page.locator('#candidates')).toBeVisible();
  assert.equal(await field.inputValue(), 'きょうはいいてんき');
});

async function kanjiPreview(page, field) {
  await page.route('**/api/v1/convert', (route) => {
    const { reading } = route.request().postDataJSON();
    return route.fulfill({
      json: {
        candidates: [{ text: reading === 'かんじ' ? '漢字' : reading, reading }],
        engineMs: 1,
      },
    });
  });
  await field.pressSequentially('kanji');
  await expect(field).toHaveValue(/漢字$/);
}

test('Backspace removes a kana immediately after live kanji conversion', async (t) => {
  const { page, field } = await open(t);
  await kanjiPreview(page, field);
  await field.press('Backspace');
  assert.equal(await field.inputValue(), 'かん');
  await field.press('Backspace');
  assert.equal(await field.inputValue(), 'か');
  await field.press('Backspace');
  await expect(field).toHaveValue('');
  await expect(field).not.toHaveClass(/composing/);
});

test('Backspace at the composition boundary deletes preceding committed text', async (t) => {
  const { field } = await open(t);
  await field.pressSequentially('a');
  await field.press('Enter');
  await field.pressSequentially('ka');
  await field.evaluate((el) => el.setSelectionRange(1, 1));
  await field.press('Backspace');
  assert.equal(await field.inputValue(), 'か');
});

test('deleting a converted prefix with newly typed kana preserves the reading', async (t) => {
  const { page, field } = await open(t);
  await kanjiPreview(page, field);
  await field.pressSequentially('ha');
  assert.equal(await field.inputValue(), '漢字は');
  await field.press('Backspace');
  assert.equal(await field.inputValue(), 'かんじ');
  await field.pressSequentially('no');
  await expect(field).toHaveValue('かんじの');
});

test('deletion stays in kana instead of restarting automatic conversion', async (t) => {
  const { page, field } = await open(t);
  await kanjiPreview(page, field);
  const requests = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/convert')) requests.push(request);
  });
  await field.press('Backspace');
  // Longer than the live conversion debounce, including the old restore/reconvert loop.
  await page.waitForTimeout(600);
  assert.equal(await field.inputValue(), 'かん');
  assert.equal(requests.length, 0);
  await field.press('Space');
  await expect(page.locator('#candidates')).toBeVisible();
});

test('an in-flight conversion cannot restore text erased with Backspace', async (t) => {
  const { page, field } = await open(t);
  let capture;
  const pending = new Promise((resolve) => {
    capture = resolve;
  });
  await page.route('**/api/v1/convert', (route) => capture(route));
  await field.pressSequentially('kanji');
  const route = await pending;
  await field.press('Backspace');
  assert.equal(await field.inputValue(), 'かん');
  const response = page.waitForResponse('**/api/v1/convert');
  await route.fulfill({
    json: {
      candidates: [{ text: '漢字', reading: 'かんじ' }],
      engineMs: 900,
    },
  });
  await response;
  await page.waitForTimeout(300);
  assert.equal(await field.inputValue(), 'かん');
  await expect(field).toHaveClass(/composing/);
});

test('Backspace removes a selected conversion and can continue into committed text', async (t) => {
  const { page, field } = await open(t);
  await field.fill('前🙂');
  await field.press('End');
  await kanjiPreview(page, field);
  await field.press('Space');
  await expect(page.locator('#candidates')).toBeVisible();
  await field.press('Backspace');
  await expect(field).toHaveValue('前🙂');
  await expect(field).not.toHaveClass(/composing/);
  await field.press('Backspace');
  await expect(field).toHaveValue('前');
  await field.press('Backspace');
  await expect(field).toHaveValue('');
});
