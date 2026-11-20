import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EngineClient } from '../engine-client.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const simulator = process.env.SIMULATOR_ID;
if (!simulator) throw Error('Set SIMULATOR_ID to the dedicated booted test simulator.');
const mode = process.env.IOS_MODE ?? 'metal';
if (!['metal', 'cpu'].includes(mode)) throw Error('IOS_MODE must be metal or cpu');
const build = mode === 'cpu' ? '.engines/ios-cpu/.build' : '.engines/ios-simulator';
const worker = root + build + '/arm64-apple-ios-simulator/release/InputWorker';
const model = root + '.engines/zenz-v3-small/ggml-model-Q5_K_M.gguf';
const client = new EngineClient('/usr/bin/xcrun', {
  args: ['simctl', 'spawn', simulator, worker, model, '1'],
  timeoutMs: 65000,
});
const fixtures = JSON.parse(await readFile(new URL('../fixtures.json', import.meta.url)));
const report = {
  mode,
  environment: 'iOS 26.2 simulator on Apple M3; NOT physical iPhone performance',
  trials: [],
  boundaries: [],
};
async function measure(reading, options) {
  const start = performance.now();
  const result = await client.convert(reading, options);
  return { wallMs: performance.now() - start, ...result };
}
try {
  report.firstRequest = await measure('こんにちは');
  for (let trial = 0; trial < 3; trial++) {
    for (const fixture of fixtures)
      report.trials.push({ trial, ...fixture, ...(await measure(fixture.reading)) });
    console.log('iOS', mode, 'ordinary trial', trial, 'done');
  }
  for (const [reading, boundaries] of [
    ['はしでたべました', [1]],
    ['はしでたべました', [2]],
    ['きょうはいいてんきです', [3]],
    ['かみをきりました', [2]],
  ]) {
    const input = { reading, boundaries, expanded: true };
    const result = await measure(reading, input);
    report.boundaries.push({ input, ...result });
    console.log('iOS boundary', reading, boundaries, Math.round(result.wallMs));
  }
} catch (error) {
  report.error = error.message;
  throw error;
} finally {
  client.close();
  await writeFile(
    new URL(`../benchmarks/performance-ios-${mode}.json`, import.meta.url),
    JSON.stringify(report, null, 2)
  );
}
