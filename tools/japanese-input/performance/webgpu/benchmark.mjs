import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const fixtures = JSON.parse(await readFile(new URL('../../fixtures.json', import.meta.url)));
const variant = process.env.VARIANT ?? 'gpu';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage();
const report = { variant, version: browser.version(), trials: [], boundaries: [], prefixes: [], startup: [], errors: [], backend: [] };
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('console', (message) => {
  if (/adapter_info|offloaded|model buffer size/.test(message.text())) report.backend.push(message.text());
  if (process.env.VERBOSE || /WebGPU|adapter|offload|error|Error|GPU/.test(message.text())) console.log(message.text().slice(0, 350));
});
async function ready() {
  await page.waitForFunction(() => ['ready', 'error'].includes(window.browserEngine?.state), null, { timeout: 120000 });
  const state = await page.evaluate(() => ({ state: browserEngine.state, error: browserEngine.error }));
  if (state.state !== 'ready') throw Error(state.error);
}
async function convert(input) {
  return page.evaluate(async (input) => {
    const start = performance.now();
    const result = await browserEngine.convert(input);
    return { wallMs: performance.now() - start, ...result };
  }, input);
}
try {
  const start = performance.now();
  await page.goto(process.env.BROWSER_URL ?? 'http://127.0.0.1:5203');
  console.log(variant, 'page loaded');
  report.adapter = await page.evaluate(async () => {
    const adapter = await Promise.race([navigator.gpu?.requestAdapter(), new Promise((resolve) => setTimeout(() => resolve(null), 10000))]);
    return adapter ? { ...adapter.info.toJSON?.(), vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null;
  });
  await ready(); report.startup.push(performance.now() - start);
  for (let trial = 0; trial < Number(process.env.TRIALS ?? 3); trial++) {
    if (trial) { const start = performance.now(); await page.evaluate(() => browserEngine.preload()); await ready(); report.startup.push(performance.now() - start); }
    for (const fixture of fixtures) report.trials.push({ trial, reading: fixture.reading, expected: fixture.expected, ...await convert({ reading: fixture.reading }) });
    console.log(variant, 'ordinary', trial, 'complete');
  }
  for (const reading of ['す','すし','すしを','すしをた','すしをたべ','すしをたべま','すしをたべまし','すしをたべました']) report.prefixes.push({ reading, ...await convert({ reading }) });
  for (const [reading, boundaries] of [['はしでたべました',[1]],['はしでたべました',[2]],['きょうはいいてんきです',[3]],['かみをきりました',[2]]]) {
    for (let repeat = 0; repeat < 2; repeat++) {
      const input = { reading, boundaries, expanded: true };
      const result = await convert(input);
      report.boundaries.push({ input, repeat, ...result });
      console.log(variant, 'boundary', reading, boundaries, repeat, Math.round(result.wallMs), result.candidates.length);
    }
  }
} catch (error) { report.failure = error.stack; throw error; }
finally {
  await writeFile(new URL(`../../benchmarks/webgpu-${variant}.json`, import.meta.url), JSON.stringify(report, null, 2));
  await browser.close();
}
