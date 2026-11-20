import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
process.env.NEURAL_GPU = 'gpu';
const { createBrowserServer } = await import('../../browser/server.mjs');
let server, browser, page;
before(async () => {
  server = createBrowserServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'chrome', headless: false });
  page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/gpu/config.mjs`);
  await page.evaluate(async () => {
    const { NeuralModel } = await import('/browser/neural-model.mjs');
    window.neuralTest = new NeuralModel();
    await neuralTest.load();
    const prompt = '\uEE00カミ\uEE01';
    window.promptTokens = await neuralTest.tokenize(prompt, true);
    window.sentences = [];
    for (const text of ['紙', '髪', '神'])
      sentences.push([...(await neuralTest.tokenize(prompt + text, true)), 3]);
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function score(overrides = {}) {
  return page.evaluate(
    (overrides) =>
      neuralTest.call({
        op: 'scores',
        sentences,
        start: promptTokens.length,
        capacity: 16,
        batchTokens: 512,
        sharePrompt: true,
        ...overrides,
      }),
    overrides
  );
}
test('shared prompt scores every target and EOS across different batch sizes', async () => {
  const reference = await score({ sharePrompt: false });
  for (const capacity of [1, 2, 16]) {
    const actual = await score({ capacity });
    assert.equal(actual.scores.length, 3);
    actual.scores.forEach((value, index) => {
      assert.ok(Number.isFinite(value));
      // GPU batch shapes round differently; catch masking/indexing mistakes.
      assert.ok(Math.abs(value - reference.scores[index]) < 0.1);
    });
    assert.ok(actual.tokens < reference.tokens);
  }
});
test('a sentence consisting only of the prompt and EOS is scored', async () => {
  const input = await page.evaluate(() => [[...promptTokens, 3]]);
  const actual = await score({ sentences: input });
  const reference = await score({ sentences: input, sharePrompt: false });
  assert.ok(Number.isFinite(actual.scores[0]));
  assert.ok(Math.abs(actual.scores[0] - reference.scores[0]) < 0.1);
});
test('invalid shapes fail clearly and leave the scorer usable', async () => {
  const invalid = await page.evaluate(() => [sentences[0], [3, ...sentences[1].slice(1)]]);
  await assert.rejects(score({ sentences: invalid }), /exact prompt tokens/);
  await assert.rejects(score({ capacity: 0 }), /sequence capacity/);
  await assert.rejects(score({ batchTokens: 4096 }), /token capacity/);
  await assert.rejects(score({ start: 0 }), /shared prompt/);
  await assert.rejects(score({ sentences: [] }), /Empty candidate/);
  assert.equal((await score()).scores.length, 3);
});
test('repeated scoring survives clearing and rebuilding the shared context', async () => {
  const original = await score();
  await score({ sharePrompt: false });
  assert.deepEqual((await score()).scores, original.scores);
});
