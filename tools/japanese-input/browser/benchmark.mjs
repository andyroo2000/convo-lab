import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const fixtures = JSON.parse(await readFile(new URL('../fixtures.json', import.meta.url)));
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  const started = performance.now();
  await page.goto(process.env.BROWSER_URL ?? 'http://127.0.0.1:5189');
  await page.waitForFunction(() => window.browserEngine?.state === 'ready', { timeout: 90000 });
  const readyMs = performance.now() - started;
  const rows = [];
  for (const fixture of fixtures) {
    const input = { reading: fixture.reading };
    const native = await fetch('http://127.0.0.1:5188/api/v1/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => r.json());
    const result = await page.evaluate((input) => browserEngine.convert(input), input);
    rows.push({ ...fixture, native, browser: result });
    console.log(
      fixture.reading,
      native.candidates[0]?.text,
      result.candidates[0]?.text,
      result.engineMs
    );
  }
  const boundaries = [];
  for (const [reading, cuts] of [
    ['はしでたべました', [1]],
    ['はしでたべました', [2]],
    ['きょうはいいてんきです', [3]],
    ['かみをきりました', [2]],
  ]) {
    const input = { reading, boundaries: cuts, expanded: true };
    const native = await fetch('http://127.0.0.1:5188/api/v1/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => r.json());
    const result = await page.evaluate((input) => browserEngine.convert(input), input);
    boundaries.push({ input, native, browser: result });
    console.log(
      'BOUNDARY',
      reading,
      cuts,
      result.candidates[0]?.text,
      result.candidates.length,
      result.engineMs
    );
  }
  await writeFile(
    new URL('../benchmarks/browser-comparison.json', import.meta.url),
    JSON.stringify({ readyMs, rows, boundaries }, null, 2)
  );
} finally {
  await browser.close();
}
