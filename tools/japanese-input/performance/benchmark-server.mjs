import { readFile, writeFile } from 'node:fs/promises';
const fixtures = JSON.parse(await readFile(new URL('../fixtures.json', import.meta.url)));
const base = process.env.SERVER_URL ?? 'http://127.0.0.1:5191';
async function request(input) {
  const start = performance.now();
  const response = await fetch(base + '/api/v1/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(65000),
  });
  const result = await response.json();
  if (!response.ok) throw Error(JSON.stringify(result));
  return { wallMs: performance.now() - start, ...result };
}
const report = {
  transport: 'HTTP over persistent SSH tunnel to existing DigitalOcean host',
  trials: [],
  boundaries: [],
  roundTrips: [],
  bursts: [],
};
for (let index = 0; index < 20; index++) {
  const start = performance.now();
  report.engine = await fetch(base + '/api/v1/engine').then((r) => r.json());
  if (report.engine.state !== 'ready') throw Error('Server model is not ready');
  report.roundTrips.push(performance.now() - start);
}
for (let trial = 0; trial < 3; trial++) {
  for (const fixture of fixtures)
    report.trials.push({ trial, ...fixture, ...(await request({ reading: fixture.reading })) });
  console.log('server ordinary trial', trial, 'done');
}
for (const [reading, boundaries] of [
  ['はしでたべました', [1]],
  ['はしでたべました', [2]],
  ['きょうはいいてんきです', [3]],
  ['かみをきりました', [2]],
]) {
  const input = { reading, boundaries, expanded: true };
  const result = await request(input);
  report.boundaries.push({ input, ...result });
  console.log('boundary', reading, boundaries, Math.round(result.wallMs));
}
for (const count of [2, 4, 8]) {
  const results = await Promise.all(
    fixtures.slice(0, count).map((f) => request({ reading: f.reading }))
  );
  report.bursts.push({ count, results });
}
// Check how a large rerank delays a new typing request sharing this worker.
const large = request({ reading: 'はしでたべました', boundaries: [1], expanded: true });
await new Promise((resolve) => setTimeout(resolve, 100));
const small = request({ reading: 'すしをたべました' });
report.mixed = await Promise.all([large, small]);
await writeFile(
  new URL('../benchmarks/performance-server.json', import.meta.url),
  JSON.stringify(report, null, 2)
);
