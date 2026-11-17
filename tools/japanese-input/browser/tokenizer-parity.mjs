import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const fixtures = JSON.parse(readFileSync(new URL('../fixtures.json', import.meta.url)));
const samples = [
  ...new Set(
    fixtures
      .flatMap((f) => [f.reading, `\uEE00${f.reading}\uEE01`, ...f.expected])
      .concat([
        '日本語 English 123',
        'カタカナ・ひらがな。！？',
        '🙂前後',
        'ｅｘａｍｐｌｅ',
        '「こんにちは」、と言った。',
        '\uEE00ハシデタベマシタ\uEE01はしで食べました',
      ])
  ),
];
const lines = execFileSync(
  new URL('../.engines/tokenizer-probe', import.meta.url).pathname,
  [new URL('../.engines/zenz-v3-small/ggml-model-Q5_K_M.gguf', import.meta.url).pathname],
  { input: samples.join('\n') + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
)
  .trim()
  .split('\n');
const tokenIds = lines.shift();
const native = lines.map((line) => line.split(' ').map(Number));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5189');
  const result = await page.evaluate(async (samples) => {
    const { NeuralModel } = await import('/browser/neural-model.mjs');
    const model = new NeuralModel();
    await model.load();
    const tokens = [];
    for (const sample of samples) tokens.push(await model.tokenize(sample, true));
    await model.model.exit();
    return tokens;
  }, samples);
  const differences = samples.flatMap((text, i) =>
    JSON.stringify(native[i]) === JSON.stringify(result[i])
      ? []
      : [{ text, native: native[i], browser: result[i] }]
  );
  const report = { samples: samples.length, nativeSpecialTokens: tokenIds, differences };
  writeFileSync(
    new URL('../benchmarks/browser-tokenizer.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));
  if (differences.length) process.exitCode = 1;
} finally {
  await browser.close();
}
