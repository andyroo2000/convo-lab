import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
process.env.NEURAL_GPU = 'gpu';
process.env.GPU_PROFILE = '1';
const { createBrowserServer } = await import('../../browser/server.mjs');
const server = createBrowserServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const configurations = JSON.parse(process.env.CONFIGS ?? '[[512,16],[1024,32],[2048,64],[2048,128]]');
const report = { version: browser.version(), configurations: [] };
const cases = [['はしでたべました', [1]], ['きょうはいいてんきです', [3]], ['かみをきりました', [2]]];
if (process.env.FULL_CORPUS) {
  const baseline = JSON.parse(await readFile(new URL('../../benchmarks/webgpu-gpu.json', import.meta.url)));
  cases.splice(0, cases.length, ...baseline.trials.filter(r => r.trial === 0).map(r => {
    const length = Array.from(r.candidates[0].sections[0].reading).length;
    return [r.reading, [length > 1 ? length - 1 : Math.min(2, Array.from(r.reading).length)]];
  }));
}
async function run(page, reading, boundaries) {
  return page.evaluate(async input => {
    const started = performance.now();
    const result = await browserEngine.convert(input);
    return { ms: performance.now() - started, ...result };
  }, { reading, boundaries, expanded: Boolean(boundaries) });
}
try {
  for (const [tokens, sequences, shared = false] of configurations) {
    process.env.GPU_BATCH_TOKENS = String(tokens);
    process.env.GPU_SEQUENCES = String(sequences);
    process.env.GPU_SHARE_PROMPT = shared ? '1' : '0';
    const result = { tokens, sequences, shared, requests: [], profiles: [], errors: [] };
    report.configurations.push(result);
    const page = await browser.newPage();
    page.on('console', message => {
      if (message.text().startsWith('journal-profile ')) result.profiles.push(JSON.parse(message.text().slice(16)));
    });
    page.on('pageerror', error => result.errors.push(error.message));
    try {
      await page.goto(url);
      await page.waitForFunction(() => ['ready', 'error'].includes(browserEngine.state), null, { timeout: 120000 });
      for (let trial = 0; trial < Number(process.env.TRIALS ?? 2); trial++) {
        for (const [reading, boundaries] of cases) {
          await run(page, reading);
          const converted = await run(page, reading, boundaries);
          result.requests.push({ trial, reading, boundaries, ...converted });
          console.log(tokens, sequences, trial, reading, Math.round(converted.ms), result.profiles.at(-1));
        }
      }
    } catch (error) { result.failure = error.stack; console.error(error.message); }
    finally { await page.close(); }
  }
} finally {
  await writeFile(new URL(`../../benchmarks/${process.env.REPORT ?? 'webgpu-batch-sweep'}.json.gz`, import.meta.url), gzipSync(JSON.stringify(report)));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
