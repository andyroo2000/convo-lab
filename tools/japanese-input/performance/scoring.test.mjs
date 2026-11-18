import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createBrowserServer } from '../browser/server.mjs';

test(
  'batched prefix scores agree with full-vocabulary token-by-token scoring',
  { timeout: 120000 },
  async () => {
    assert.equal(process.env.NEURAL_BATCH, 'prefix');
    const server = createBrowserServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const results = await page.evaluate(async () => {
        window.browserEngine.close();
        const { NeuralModel: Baseline } = await import('/browser/base-neural-model.mjs');
        const { NeuralModel: Optimized } = await import('/browser/neural-model.mjs');
        const baseline = new Baseline(),
          optimized = new Optimized();
        await baseline.load();
        await optimized.load();
        const results = [];
        for (const [reading, output] of [
          ['ハシデタベマシタ', '箸で食べました'],
          ['ハシデタベマシタ', '橋で食べました'],
          ['ハシデタベマシタ', '箸で食べます'],
          ['カミヲキリマシタ', '髪を切りました'],
          ['ハシデタベマシタ', '箸で食べました'],
        ]) {
          const prompt = `\uEE00${reading}\uEE01`;
          const text = prompt + output;
          results.push({
            reading,
            output,
            baseline: (await baseline.score(text, prompt)).score,
            optimized: (await optimized.score(text, prompt)).score,
          });
        }
        await baseline.model.exit();
        await optimized.model.exit();
        return results;
      });
      for (const row of results) {
        assert.ok(Number.isFinite(row.optimized));
        assert.ok(Math.abs(row.baseline - row.optimized) < 0.002, JSON.stringify(row));
      }
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  }
);
