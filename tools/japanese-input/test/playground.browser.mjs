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
  await expect
    .poll(async () => (await page.locator('.composition-section').allTextContents()).join(''))
    .toBe(expected);
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
  await input.press('ArrowDown');
  const alternate = await input.inputValue();
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

test('typing after a candidate continues the uncommitted phrase', async (t) => {
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
  await expect(page.locator('#candidates button[aria-pressed=true]')).toHaveText('箸で');
  await page.locator('#candidates button[aria-pressed=true]').click();
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
  await input.pressSequentially('hari-/potta-');
  await input.press('Enter');
  await expect(input).toHaveValue('箸で食べました。はりー・ぽったー');
  await page.locator('#mode').click();
  await input.pressSequentially(' Yes/no!');
  await expect(input).toHaveValue('箸で食べました。はりー・ぽったー Yes/no!');
});

test('cutting a selected section removes only that section and undo restores it', async (t) => {
  const page = await openPage(t);
  const input = await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  await input.press('ControlOrMeta+x');
  await expect(input).toHaveValue('食べました');
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

test('live neural conversion keeps whole-phrase context and lets arrows revise sections', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  const readings = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/convert')) readings.push(request.postDataJSON().reading);
  });
  await input.pressSequentially('hashidetabemashita');
  await expect(input).toHaveValue('箸で食べました');
  await expect(page.locator('.composition-section')).toHaveCount(2);
  await expect(input).toHaveClass('composing');
  await input.press('ArrowRight');
  await expect(page.locator('.composition-section.current')).toHaveText('箸で');
  await expect(page.locator('#candidates button[aria-pressed=true]')).toHaveText('箸で');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('橋で食べました');
  await input.press('ArrowRight');
  await expect(page.locator('.composition-section.current')).toHaveText('食べました');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('橋でたべました');
  await input.press('ArrowLeft');
  await expect(page.locator('.composition-section.current')).toHaveText('橋で');
  assert.ok(readings.length >= 1);
  assert.ok(readings.every((reading) => reading === 'はしでたべました'));
  await input.press('Enter');
  await expect(page.locator('.composition-layer')).toBeHidden();
  await expect(input).toHaveValue('橋でたべました');
  await page.reload();
  await expect(input).toHaveValue('橋でたべました');
});

test('live conversion extends the whole phrase and keeps explicit section choices', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  await input.pressSequentially('hashidetabemashita');
  await expect(input).toHaveValue('箸で食べました');
  await input.press('ArrowRight');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('橋で食べました');
  const converted = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/convert') &&
      response.request().postDataJSON().reading === 'はしでたべましたそのあと'
  );
  await input.pressSequentially('sonoato');
  await converted;
  await expect.poll(async () => (await input.inputValue()).startsWith('橋で')).toBe(true);
  await expect(page.locator('.composition-section')).not.toHaveCount(0);
  await input.press('Enter');
  await expect(page.locator('.composition-layer')).toBeHidden();
  await input.press('ControlOrMeta+z');
  await expect(input).toHaveValue('');
});

test('committing or moving focus while conversion is pending ignores its late result', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/convert', async (route) => {
    await held;
    await route.fulfill({ json: { candidates: [{ text: '雨' }], engineMs: 1 } }).catch(() => {});
  });
  const requested = page.waitForRequest('**/api/v1/convert');
  await input.pressSequentially('ame');
  await requested;
  await input.press('Enter');
  await input.pressSequentially('ka');
  await input.press('Enter');
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await expect(input).toHaveValue('あめか');
  await expect(page.locator('.composition-layer')).toBeHidden();
});

test('long vowel readings stay exact and committing flushes an unfinished n after live text', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  const converted = page.waitForResponse('**/api/v1/convert');
  await input.pressSequentially('ra-menwotabemashita');
  const body = await (await converted).json();
  assert.equal(
    body.candidates[0].sections.map((part) => part.reading).join(''),
    'らーめんをたべました'
  );
  await expect(input).toHaveValue(body.candidates[0].text);
  await input.pressSequentially('n');
  await input.press('Enter');
  await expect(input).toHaveValue(`${body.candidates[0].text}ん`);
  await input.fill('');
  await input.pressSequentially('hon');
  await input.press('Space');
  await expect(input).toHaveValue('本');
  await input.pressSequentially('a');
  await input.press('Enter');
  await expect(input).toHaveValue('ほな');
});

test('opening a menu expands contextual alternatives without changing the chosen text', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  const requests = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/convert')) requests.push(request.postDataJSON());
  });
  await input.fill('前🙂後');
  await input.evaluate((field) => field.setSelectionRange(3, 3));
  await input.pressSequentially('koushou');
  await expect(input).toHaveValue('前🙂交渉後');
  assert.equal(
    requests.some((body) => body.expanded),
    false
  );
  await input.press('Space');
  await expect(page.locator('#status')).toContainText('More choices ready');
  const choices = page.locator('#candidates button');
  assert.ok((await choices.count()) > 12);
  await expect(input).toHaveValue('前🙂交渉後');
  assert.ok(requests.every((body) => body.reading === 'こうしょう'));
  assert.equal(requests.filter((body) => body.expanded).length, 1);
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.SCREENSHOT_DIR}/expanded-menu.png`,
      fullPage: true,
    });
  const alternate = await choices.nth(12).textContent();
  await choices.nth(12).click();
  await input.press('Enter');
  await expect(input).toHaveValue(`前🙂${alternate}後`);
  await page.reload();
  await expect(input).toHaveValue(`前🙂${alternate}後`);
});

test('an expanded menu arriving late preserves the active section and chosen spelling', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/convert', async (route) => {
    if (!route.request().postDataJSON().expanded) return route.continue();
    await held;
    await route
      .fulfill({
        json: {
          candidates: [
            {
              text: '端で食べました',
              units: [
                { text: '端で', reading: 'はしで' },
                { text: '食べました', reading: 'たべました' },
              ],
            },
          ],
          engineMs: 10,
        },
      })
      .catch(() => {});
  });
  await input.pressSequentially('hashidetabemashita');
  await expect(input).toHaveValue('箸で食べました');
  const expanded = page.waitForRequest(
    (request) => request.url().endsWith('/api/v1/convert') && request.postDataJSON().expanded
  );
  await input.press('Space');
  await expanded;
  await input.press('ArrowUp');
  await input.press('ArrowRight');
  release();
  await expect(page.locator('#status')).toContainText('More choices ready');
  await expect(input).toHaveValue('はしで食べました');
  await expect(page.locator('.composition-section.current')).toHaveText('食べました');
  await input.press('ArrowLeft');
  await expect(page.locator('#candidates button').filter({ hasText: /^端で$/ })).toHaveCount(1);
  await input.press('Enter');
  await expect(page.locator('#candidates')).toBeHidden();
});

test('expanded results cannot replace text after the composition has been committed', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/convert', async (route) => {
    if (!route.request().postDataJSON().expanded) return route.continue();
    await held;
    await route.fulfill({ json: { candidates: [], engineMs: 1 } }).catch(() => {});
  });
  await input.pressSequentially('koushou');
  await expect(input).toHaveValue('交渉');
  const requested = page.waitForRequest(
    (r) => r.url().endsWith('/api/v1/convert') && r.postDataJSON().expanded
  );
  await input.press('Space');
  await requested;
  await input.press('Enter');
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/convert') && r.request().postDataJSON().expanded
  );
  release();
  await response;
  await page.unrouteAll({ behavior: 'wait' });
  await input.pressSequentially('ka');
  await input.press('Enter');
  await expect(input).toHaveValue('交渉か');
  await expect(page.locator('#candidates')).toBeHidden();
});

test('a failed menu expansion leaves current choices usable and retries on demand', async (t) => {
  const page = await openPage(t);
  const input = page.locator('#notebook');
  let fail = true;
  await page.route('**/api/v1/convert', (route) => {
    if (route.request().postDataJSON().expanded && fail)
      return route.fulfill({ status: 503, json: { error: 'Busy' } });
    return route.continue();
  });
  await input.pressSequentially('koushou');
  await expect(input).toHaveValue('交渉');
  await input.press('Space');
  await expect(page.locator('#status')).toContainText('Could not load more choices');
  await expect(input).toHaveValue('交渉');
  fail = false;
  await input.press('Space');
  const chosen = await input.inputValue();
  await expect(page.locator('#status')).toContainText('More choices ready');
  await expect(input).toHaveValue(chosen);
  assert.ok((await page.locator('#candidates button').count()) > 12);
});

test('Shift arrows resize a section in the notebook with full-phrase requests and undo', async (t) => {
  const page = await openPage(t);
  const requests = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/v1/convert')) requests.push(r.postDataJSON());
  });
  const input = await convertInMiddle(page, '前🙂後', 3);
  await input.press('Shift+ArrowLeft');
  await expect(page.locator('.composition-section.current')).toHaveText('箸');
  await expect(page.locator('#status')).toContainText('More choices ready');
  await expect(page.locator('.composition-section')).toHaveText(['箸', 'で食べました']);
  if (process.env.SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.SCREENSHOT_DIR}/resized-section.png`,
      fullPage: true,
    });
  }
  assert.ok(requests.some((r) => r.boundaries?.[0] === 2));
  assert.ok(requests.every((r) => r.reading === 'はしでたべました'));
  await input.press('ArrowUp');
  await expect(page.locator('.composition-section.current')).toHaveText('はし');
  await input.press('ArrowRight');
  await expect(page.locator('.composition-section.current')).toHaveText('で食べました');
  await input.press('Enter');
  await expect(input).toHaveValue('前🙂はしで食べました後');
  await input.press('ControlOrMeta+z');
  await expect(input).toHaveValue('前🙂後');
  await input.press('ControlOrMeta+Shift+z');
  await expect(input).toHaveValue('前🙂はしで食べました後');
});

test('resizing inside a kanji reading obtains newly constrained candidates', async (t) => {
  const page = await openPage(t);
  const input = await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  const constrained = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/convert') && r.request().postDataJSON().boundaries?.[0] === 1
  );
  await input.press('Shift+ArrowLeft');
  await input.press('Shift+ArrowLeft');
  const result = await (await constrained).json();
  assert.ok(result.candidates.length > 10);
  const scores = result.candidates.map((candidate) => candidate.neuralScore);
  assert.ok(scores.every(Number.isFinite));
  assert.deepEqual(
    scores,
    [...scores].sort((a, b) => b - a)
  );
  assert.equal(result.candidates[0].text, 'はしで食べました');
  for (const candidate of result.candidates) {
    assert.equal(candidate.units[0].reading, 'は');
    assert.equal(candidate.units.map((unit) => unit.reading).join(''), 'はしでたべました');
  }
  await expect(page.locator('#status')).toContainText('More choices ready');
  const options = await page.locator('#candidates button').allTextContents();
  assert.ok(
    options.some((text) => /[葉歯派波]/.test(text)),
    options.join(', ')
  );
  await input.press('Shift+ArrowLeft'); // Cannot shrink は to an empty section.
  assert.equal(await page.locator('.composition-section').count(), 2);
  await input.press('Escape');
  await expect(input).toHaveValue('はしでたべました');
  await input.press('Enter');
});

test('repeated boundary expansion merges sections, then shrinking splits the last section', async (t) => {
  const page = await openPage(t);
  const input = await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  for (let i = 0; i < 6; i++) await input.press('Shift+ArrowRight');
  await expect(page.locator('.composition-section')).toHaveCount(1);
  await input.press('Shift+ArrowLeft');
  await expect(page.locator('.composition-section')).toHaveCount(2);
  await expect(page.locator('#status')).toContainText('More choices ready');
  await input.press('Escape');
  await expect(input).toHaveValue('はしでたべました');
});

test('a late boundary response keeps a user choice and preserves breaks when typing continues', async (t) => {
  const page = await openPage(t);
  const input = await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  let release;
  let arrived;
  const received = new Promise((resolve) => {
    arrived = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/convert', async (route) => {
    if (route.request().postDataJSON().boundaries?.length) {
      const response = await route.fetch();
      arrived();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await input.press('Shift+ArrowLeft');
  await received;
  await input.press('ArrowUp');
  await expect(page.locator('.composition-section.current')).toHaveText('はし');
  release();
  await expect(page.locator('#status')).toContainText('More choices ready');
  await expect(page.locator('.composition-section.current')).toHaveText('はし');
  await input.pressSequentially('sonoato');
  await expect(page.locator('.composition-section')).toHaveCount(3);
  await input.press('Space');
  await expect(page.locator('.composition-section.current')).toHaveText('はし');
  await input.press('Enter');
  await expect(input).toHaveValue('はしで食べましたそのあと');
  await page.unrouteAll({ behavior: 'wait' });
});

test('superseded and post-commit boundary responses cannot restore old sections', async (t) => {
  const page = await openPage(t);
  const input = await typeAndConvert(page, 'hashidetabemashita', '箸で食べました');
  let release;
  let arrived;
  const received = new Promise((resolve) => {
    arrived = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/convert', async (route) => {
    if (route.request().postDataJSON().boundaries?.[0] === 2) {
      const response = await route.fetch();
      arrived();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await input.press('Shift+ArrowLeft');
  await received;
  await input.press('Shift+ArrowRight');
  await expect(page.locator('.composition-section')).toHaveText(['箸で', '食べました']);
  await input.press('Enter');
  await input.pressSequentially('a');
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await expect(input).toHaveValue('箸で食べましたあ');
  await expect(page.locator('#candidates')).toBeHidden();
});
