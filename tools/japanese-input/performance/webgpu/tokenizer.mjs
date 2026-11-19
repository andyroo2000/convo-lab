import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const root = new URL('../../', import.meta.url);

async function sampleTexts() {
  const fixtures = JSON.parse(await readFile(new URL('fixtures.json', root)));
  return [...new Set(fixtures.flatMap((f) => [f.reading, `\uEE00${f.reading}\uEE01`, ...f.expected]).concat([
    '日本語 English 123', 'カタカナ・ひらがな。！？', '🙂前後', 'ｅｘａｍｐｌｅ', '「こんにちは」、と言った。',
    '\uEE00ハシデタベマシタ\uEE01はしで食べました',
  ]))];
}
function nativeTokens(samples) {
  const lines = execFileSync(new URL('.engines/tokenizer-probe', root).pathname,
    [new URL('.engines/zenz-v3-small/ggml-model-Q5_K_M.gguf', root).pathname],
    { input: samples.join('\n') + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n');
  return { specialTokens: lines.shift(), tokens: lines.map((line) => line.split(' ').map(Number)) };
}
async function browserTokens(page, samples) {
  await page.goto('http://127.0.0.1:5203/gpu/config.mjs');
  return page.evaluate(async (samples) => {
    const { NeuralModel } = await import('/browser/neural-model.mjs');
    const model = new NeuralModel();
    await model.load();
    const result = [];
    for (const sample of samples) result.push(await model.tokenize(sample, true));
    await model.model.exit();
    return result;
  }, samples);
}
async function verify() {
  const samples = await sampleTexts();
  const native = nativeTokens(samples);
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  try {
    const actual = await browserTokens(await browser.newPage(), samples);
    const differences = samples.flatMap((text, i) => JSON.stringify(native.tokens[i]) === JSON.stringify(actual[i])
      ? [] : [{ text, native: native.tokens[i], actual: actual[i] }]);
    const report = { samples: samples.length, specialTokens: native.specialTokens, differences };
    await writeFile(new URL('benchmarks/webgpu-tokenizer.json', root), JSON.stringify(report, null, 2));
    console.log(report);
    if (differences.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
await verify();
