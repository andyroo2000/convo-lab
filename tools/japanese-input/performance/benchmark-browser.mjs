import { readFile, writeFile } from 'node:fs/promises';
import { browserSession, ready } from './browser-session.mjs';
const name = process.env.BROWSER ?? 'chrome';
const variant = process.env.VARIANT ?? 'baseline';
const fixtures = JSON.parse(await readFile(new URL('../fixtures.json', import.meta.url)));
const session = await browserSession(name);
const report = {
  name,
  version: session.version,
  variant,
  trials: [],
  boundaries: [],
  prefixes: [],
};
try {
  await session.goto(process.env.BROWSER_URL ?? 'http://127.0.0.1:5189');
  report.readyMs = await ready(session);
  for (let trial = 0; trial < Number(process.env.TRIALS ?? 3); trial++) {
    if (trial > 0) {
      await session.evaluate(() => browserEngine.preload());
      await ready(session);
    }
    for (const fixture of fixtures) {
      const result = await session.evaluate(async (reading) => {
        const start = performance.now();
        const result = await browserEngine.convert({ reading });
        return { wallMs: performance.now() - start, ...result };
      }, fixture.reading);
      report.trials.push({
        trial,
        reading: fixture.reading,
        expected: fixture.expected,
        ...result,
      });
    }
    console.log(name, variant, 'ordinary trial', trial, 'done');
  }
  // Simulate live conversion requests on previously unseen growing prefixes.
  for (const reading of [
    'す',
    'すし',
    'すしを',
    'すしをた',
    'すしをたべ',
    'すしをたべま',
    'すしをたべまし',
    'すしをたべました',
  ]) {
    const result = await session.evaluate(async (reading) => {
      const start = performance.now();
      const result = await browserEngine.convert({ reading });
      return { wallMs: performance.now() - start, ...result };
    }, reading);
    report.prefixes.push({ reading, ...result });
  }
  for (const [reading, boundaries] of [
    ['はしでたべました', [1]],
    ['はしでたべました', [2]],
    ['きょうはいいてんきです', [3]],
    ['かみをきりました', [2]],
  ]) {
    const input = { reading, boundaries, expanded: true };
    const result = await session.evaluate(async (input) => {
      const start = performance.now();
      const result = await browserEngine.convert(input);
      return { wallMs: performance.now() - start, ...result };
    }, input);
    report.boundaries.push({ input, ...result });
    console.log(name, variant, 'boundary', reading, boundaries, Math.round(result.wallMs));
  }
} finally {
  await writeFile(
    new URL(`../benchmarks/performance-${name}-${variant}.json`, import.meta.url),
    JSON.stringify(report, null, 2)
  );
  await session.close();
}
