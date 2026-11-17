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

async function openPage(t) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.locator('#engine-status')).toHaveText('Ready to write · Neural conversion', {
    timeout: 60000,
  });
  return page;
}

async function typeAndConvert(page, romaji, expected) {
  const input = page.locator('#notebook');
  await input.pressSequentially(romaji);
  await input.press('Space');
  await expect(page.locator('#candidates button').first()).toHaveText(expected);
  return input;
}

async function convertInMiddle(page, text, offset) {
  const input = page.locator('#notebook');
  await input.fill(text);
  await input.evaluate((field, position) => field.setSelectionRange(position, position), offset);
  return typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
}

test('inline neural conversion previews choices, confirms, and survives reload', async (t) => {
  const page = await openPage(t);
  const converted = page.waitForResponse('**/api/v1/convert');
  const input = await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  const body = await (await converted).json();
  assert.equal(body.engine.neural, true);
  assert.equal(body.engine.inferenceLimit, 1);
  await expect(input).toHaveValue('箸で食べました');
  const alternate = await page.locator('#candidates button').nth(1).textContent();
  await input.press('ArrowDown');
  await expect(input).toHaveValue(alternate);
  await input.press('Enter');
  await expect(page.locator('#candidates')).toBeHidden();
  await input.press('Enter');
  await input.pressSequentially('sonoato');
  await expect(input).toHaveValue(`${alternate}\nそのあと`);
  await page.reload();
  await expect(input).toHaveValue(`${alternate}\nそのあと`);
  await expect(page.locator('#phrase')).toHaveCount(0);
});

test('conversion in the middle preserves surrounding text and supports undo/redo', async (t) => {
  const page = await openPage(t);
  const input = await convertInMiddle(page, '前🙂後', 3);
  await input.press('Enter');
  await expect(input).toHaveValue('前🙂箸で食べました後');
  await input.press('ControlOrMeta+z');
  await expect(input).toHaveValue('前🙂後');
  await input.press('ControlOrMeta+Shift+z');
  await expect(input).toHaveValue('前🙂箸で食べました後');
});

test('Escape restores kana and backspace edits it without deleting its neighbors', async (t) => {
  const page = await openPage(t);
  const input = await convertInMiddle(page, '前後', 1);
  await input.press('Escape');
  await expect(input).toHaveValue('前はしでたべました後');
  await input.press('Backspace');
  await expect(input).toHaveValue('前はしでたべまし後');
  await input.press('Enter');
  await expect(page.locator('#candidates')).toBeHidden();
});

test('typing after a candidate confirms it and starts a new composition', async (t) => {
  const page = await openPage(t);
  const input = await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  await input.pressSequentially('sonoato');
  await expect(input).toHaveValue('箸で食べましたそのあと');
  await input.press('Enter');
  await input.press('Space');
  await expect(input).toHaveValue('箸で食べましたそのあと ');
});

test('romaji handles n and doubled consonants, and ABC allows ordinary English', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  await input.pressSequentially('konnichiha');
  await input.press('Enter');
  await expect(input).toHaveValue('こんにちは');
  await input.pressSequentially('kitte');
  await input.press('Enter');
  await input.pressSequentially('hon');
  await input.press('Enter');
  await expect(input).toHaveValue('こんにちはきってほん');
  await page.locator('#mode').click();
  await input.pressSequentially(' Hello world!');
  await expect(input).toHaveValue('こんにちはきってほん Hello world!');
});

test('selected kana can be converted and candidate clicks keep surrounding writing', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  await input.fill('前はしでたべました後');
  await input.evaluate((field) => field.setSelectionRange(1, field.value.length - 1));
  await input.press('Space');
  await expect(page.locator('#candidates button').first()).toHaveText('箸で食べました');
  await page.locator('#candidates button').first().click();
  await expect(input).toHaveValue('前箸で食べました後');
  await expect(input).toBeFocused();
});

test('late responses and failed conversion preserve new edits', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
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
  await input.pressSequentially('ame');
  await input.press('Space');
  await expect(page.locator('#status')).toHaveText('Finding kanji…');
  await input.press('ArrowLeft');
  await input.pressSequentially('ka');
  release();
  await expect(input).toHaveValue('あかめ');
  await expect(page.locator('#candidates')).toBeHidden();
  await page.unrouteAll({ behavior: 'wait' });
  await page.route('**/api/v1/convert', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable.' } })
  );
  await input.press('Space');
  await expect(page.locator('#status')).toContainText('Your text has been kept.');
  await expect(input).toHaveValue('あかめ');
});

test('native IME events pass through without intercepting Space', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  const consumed = await input.evaluate((field) => {
    field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    const consumed = !field.dispatchEvent(event);
    field.value = '日本語';
    field.dispatchEvent(
      new InputEvent('input', {
        data: '日本語',
        inputType: 'insertCompositionText',
        isComposing: true,
        bubbles: true,
      })
    );
    field.dispatchEvent(new CompositionEvent('compositionend', { data: '日本語', bubbles: true }));
    return consumed;
  });
  assert.equal(consumed, false);
  await expect(input).toHaveValue('日本語');
  await page.reload();
  await expect(input).toHaveValue('日本語');
});

test('loading and retry keep the saved notebook and disable writing until ready', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  await input.pressSequentially('sonoato');
  let state = 'loading';
  await page.route('**/api/v1/engine', (route) => route.fulfill({ json: { state } }));
  await page.reload();
  await expect(input).toHaveAttribute('readonly', '');
  await expect(input).toHaveValue('そのあと');
  state = 'error';
  await expect(page.locator('#retry-engine')).toBeVisible();
  await page.route('**/api/v1/engine/retry', (route) => {
    state = 'ready';
    return route.fulfill({ status: 202, json: { state } });
  });
  await page.locator('#retry-engine').click();
  await expect(input).toBeEditable();
  await expect(input).toHaveValue('そのあと');
});

test('notebook grows and the candidate popup stays in desktop and mobile viewports', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  await input.fill('昨日友達と映画を見ました。\n'.repeat(12));
  const sizes = await input.evaluate((field) => ({
    client: field.clientHeight,
    scroll: field.scrollHeight,
  }));
  assert.equal(sizes.client, sizes.scroll);
  await input.fill('昨日映画を見ました。そのあと');
  await input.press('End');
  await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  const directory = process.env.SCREENSHOT_DIR;
  if (directory) {
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: `${directory}/desktop.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#candidates')).toBeVisible();
  await expect
    .poll(async () => {
      const panel = await page.locator('#candidates').boundingBox();
      return (
        panel.x >= 0 &&
        panel.x + panel.width <= 390 &&
        panel.y >= 0 &&
        panel.y + panel.height <= 844
      );
    })
    .toBe(true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (directory) await page.screenshot({ path: `${directory}/mobile.png`, fullPage: true });
});

test('Japanese punctuation commits the current word while ABC keeps ASCII punctuation', async (t) => {
  const page = await openPage(t);
  const input = await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  await input.pressSequentially('.');
  await expect(input).toHaveValue('箸で食べました。');
  await expect(page.locator('#candidates')).toBeHidden();
  await page.locator('#mode').click();
  await input.pressSequentially(' Yes!');
  await expect(input).toHaveValue('箸で食べました。 Yes!');
});

test('cutting a selected candidate removes it and undo restores it', async (t) => {
  const page = await openPage(t);
  const input = await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  await input.press('ControlOrMeta+x');
  await expect(input).toHaveValue('');
  await input.press('ControlOrMeta+z');
  await expect(input).toHaveValue('箸で食べました');
});

test('unfinished text from the former phrase box can be restored once', async (t) => {
  const page = await openPage(t);
  await page.evaluate(() =>
    localStorage.setItem('convolab:typing-playground:phrase:v1', 'はしでたべました')
  );
  await page.reload();
  await page.locator('#restore-phrase').click();
  await expect(page.locator('#notebook')).toHaveValue('箸で食べました');
  await page.locator('#notebook').press('Enter');
  await page.reload();
  await expect(page.locator('#restore-phrase')).toBeHidden();
  await expect(page.locator('#notebook')).toHaveValue('箸で食べました');
});
