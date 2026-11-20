import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, webkit, expect } from '@playwright/test';
import { createBrowserServer } from '../server.mjs';
let browser, server, page;
before(async () => {
  server = createBrowserServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await (process.env.BROWSER === 'webkit' ? webkit : chromium).launch({
    channel: process.env.CHROME_CHANNEL,
    headless: !process.env.HEADED,
  });
  const context = await browser.newContext();
  page = await context.newPage();
  page.on('pageerror', (error) => console.error(error));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await ready();
});
beforeEach(async () => {
  await page.evaluate(() => browserEngine.resetLearning());
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function ready() {
  await expect(page.locator('#engine-status')).toHaveText('Ready to write · Neural conversion', {
    timeout: 90000,
  });
}
async function texts(reading, boundaries = []) {
  return page.evaluate(
    async ({ reading, boundaries }) =>
      (await browserEngine.convert({ reading, boundaries, expanded: true })).candidates.map(
        (c) => c.text
      ),
    { reading, boundaries }
  );
}
test('confirmed learning persists locally, keeps context and alternatives, and resets', async () => {
  const before = await texts('あめ');
  assert.ok(before.includes('飴'));
  const selection = { reading: 'あめ', text: '飴', start: 0, end: 2 };
  assert.equal(
    (await page.evaluate((s) => browserEngine.learn(s), { ...selection, text: '偽' })).learned,
    false
  );
  for (let i = 0; i < 3; i++)
    assert.equal((await page.evaluate((s) => browserEngine.learn(s), selection)).learned, true);
  const learned = await texts('あめ');
  assert.equal(learned[0], '飴');
  assert.ok(before.every((text) => learned.includes(text)));
  assert.equal((await texts('あめがふる'))[0], '雨が降る');
  await page.reload();
  await ready();
  assert.equal((await texts('あめ'))[0], '飴');
  await texts('あめを', [2]);
  assert.equal(
    (
      await page.evaluate(() =>
        browserEngine.learn({ reading: 'あめを', text: '雨', start: 0, end: 2 })
      )
    ).learned,
    true
  );
  assert.equal((await texts('あめを', [2]))[0], '雨を');
  await page.evaluate(() => browserEngine.resetLearning());
  assert.deepEqual(await texts('あめ'), before);
  await page.reload();
  await ready();
  assert.deepEqual(await texts('あめ'), before);
});

test('only committing a selected spelling teaches the browser keyboard', async () => {
  await page.evaluate(() => browserEngine.resetLearning());
  const baseline = await texts('あめ');
  const input = page.locator('#notebook');
  await input.fill('');
  await input.pressSequentially('ame');
  await input.press('Space');
  const candy = page.locator('#candidates button').filter({ hasText: /^飴$/ });
  await expect(candy).toBeVisible({ timeout: 15000 });
  await candy.click();
  await input.press('Escape');
  await page.reload();
  await ready();
  assert.deepEqual(await texts('あめ'), baseline);
  await input.fill('');
  await input.pressSequentially('ame');
  await input.press('Space');
  await expect(candy).toBeVisible({ timeout: 15000 });
  await candy.click();
  await page.evaluate(() => {
    window.learningFinished = false;
    window.addEventListener(
      'conversions-learned',
      () => {
        window.learningFinished = true;
      },
      { once: true }
    );
  });
  await input.press('Enter');
  await page.waitForFunction(() => window.learningFinished);
  assert.equal((await texts('あめ'))[0], '飴');
  await page.reload();
  await ready();
  assert.equal((await texts('あめ'))[0], '飴');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#reset-learning').click();
  await expect(page.locator('#status')).toHaveText('Learned conversions cleared.');
  assert.deepEqual(await texts('あめ'), baseline);
});

test('a stale tab cannot restore history cleared in another tab', async () => {
  await page.evaluate(() => browserEngine.resetLearning());
  const other = await page.context().newPage();
  try {
    await other.goto(page.url());
    await expect(other.locator('#engine-status')).toHaveText('Ready to write · Neural conversion', {
      timeout: 90000,
    });
    await other.evaluate(() => browserEngine.convert({ reading: 'あめ', expanded: true }));
    await page.evaluate(() => browserEngine.resetLearning());
    const error = await other.evaluate(async () => {
      try {
        await browserEngine.learn({ reading: 'あめ', text: '飴', start: 0, end: 2 });
        return null;
      } catch (error) {
        return error.message;
      }
    });
    assert.match(error, /another tab/);
    assert.equal(await other.evaluate(() => browserEngine.state), 'error');
    assert.equal(
      await other.evaluate(async () => {
        try {
          await browserEngine.convert({ reading: 'あめ' });
          return false;
        } catch {
          return true;
        }
      }),
      true
    );
    await page.reload();
    await ready();
    assert.notEqual((await texts('あめ'))[0], '飴');
    await other.evaluate(() => browserEngine.preload());
    const recovered = await other.evaluate(async () => {
      await browserEngine.convert({ reading: 'あめ', expanded: true });
      return browserEngine.learn({ reading: 'あめ', text: '飴', start: 0, end: 2 });
    });
    assert.equal(recovered.learned, true);
    await other.evaluate(() => browserEngine.resetLearning());
    await page.reload();
    await ready();
  } finally {
    await other.close();
  }
});

test('a damaged preference cache does not prevent startup or future learning', async () => {
  await page.evaluate(async () => {
    const { saveLearning } = await import('/browser/learning-storage.mjs');
    await saveLearning([['confirmed.json', new TextEncoder().encode('{broken')]], null);
  });
  await page.reload();
  await ready();
  assert.ok((await texts('あめ')).includes('飴'));
  assert.equal(
    (
      await page.evaluate(() =>
        browserEngine.learn({
          reading: 'あめ',
          text: '飴',
          start: 0,
          end: 2,
        })
      )
    ).learned,
    true
  );
  assert.equal((await texts('あめ'))[0], '飴');
  await page.evaluate(() => browserEngine.resetLearning());
});
