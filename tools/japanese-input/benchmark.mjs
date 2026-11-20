import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { EngineClient } from './engine-client.mjs';
import { engineInfo } from './contract.mjs';

const fixtures = JSON.parse(await readFile(new URL('./fixtures.json', import.meta.url)));
const engine = new EngineClient();
function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}
try {
  const coldStart = performance.now();
  await engine.convert(fixtures[0].reading);
  const coldRoundTripMs = performance.now() - coldStart;
  const results = [];
  for (const fixture of fixtures) {
    const start = performance.now();
    const result = await engine.convert(fixture.reading);
    const candidates = result.candidates.map((candidate) => candidate.text);
    const rank = candidates.findIndex((text) => fixture.expected.includes(text)) + 1;
    results.push({
      ...fixture,
      candidates,
      expectedRank: rank || null,
      engineMs: result.engineMs,
      roundTripMs: performance.now() - start,
    });
  }
  const summary = {
    total: results.length,
    exactTop1: results.filter((row) => row.expectedRank === 1).length,
    exactTop5: results.filter((row) => row.expectedRank && row.expectedRank <= 5).length,
    engineMedianMs: percentile(
      results.map((row) => row.engineMs),
      0.5
    ),
    engineP95Ms: percentile(
      results.map((row) => row.engineMs),
      0.95
    ),
    coldRoundTripMs,
  };
  const report = {
    engine: engineInfo,
    host: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0].model },
    measuredAt: new Date().toISOString(),
    summary,
    results,
    caveat:
      'Small synthetic exact-match check, not a language-quality benchmark. Valid alternate spellings may count as misses. No concurrency or remote-network measurement.',
  };
  await writeFile(
    new URL('./results.local.json', import.meta.url),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log('Full candidate lists: results.local.json');
} finally {
  engine.close();
}
