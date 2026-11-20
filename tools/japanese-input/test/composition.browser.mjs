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
