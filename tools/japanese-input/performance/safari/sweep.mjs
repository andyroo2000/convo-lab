import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { browserSession, ready } from '../browser-session.mjs';
function requireUnlocked() {
  const state = execFileSync('ioreg', ['-n', 'Root', '-d1'], { encoding: 'utf8' });
  if (state.includes('CGSSessionScreenIsLocked"=Yes')) throw Error('Unlock the Mac before benchmarking Safari');
}
requireUnlocked();
process.env.NEURAL_GPU = 'gpu';
const { createBrowserServer } = await import('../../browser/server.mjs');
const server = createBrowserServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const configurations = JSON.parse(process.env.CONFIGS ?? '[[512,16],[1024,64],[2048,128]]');
const report = [];
const cases = [['はしでたべました', [1]], ['きょうはいいてんきです', [3]], ['かみをきりました', [2]]];
async function measure(session, reading, boundaries) {
  requireUnlocked();
  return session.evaluate(async input => {
    const start = performance.now();
    const result = await browserEngine.convert(input);
    return { ms: performance.now() - start, ...result };
  }, { reading, boundaries, expanded: Boolean(boundaries) });
}
try {
  for (const [tokens, sequences] of configurations) {
    process.env.GPU_BATCH_TOKENS = String(tokens);
    process.env.GPU_SEQUENCES = String(sequences);
    const session = await browserSession('safari');
    const result = { tokens, sequences, version: session.version, requests: [] };
    report.push(result);
    try {
      await session.goto(url);
      execFileSync('open', ['-a', 'Safari']);
      result.page = await session.evaluate(() => ({ visibility: document.visibilityState, focused: document.hasFocus() }));
      result.readyMs = await ready(session);
      for (let trial = 0; trial < 2; trial++) {
        for (const [reading, boundaries] of cases) {
          await measure(session, reading);
          const converted = await measure(session, reading, boundaries);
          result.requests.push({ trial, reading, boundaries, ...converted });
          console.log(tokens, sequences, trial, reading, Math.round(converted.ms), converted.candidates.length);
        }
      }
    } catch (error) { result.error = error.stack; }
    finally { await session.close(); }
  }
} finally {
  await writeFile(new URL('../../benchmarks/safari-gpu-sweep.json', import.meta.url), JSON.stringify(report, null, 2));
  await new Promise(resolve => server.close(resolve));
}
