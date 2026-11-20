import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { EngineClient } from './engine-client.mjs';
import { MozcClient } from './mozc-client.mjs';
import { engineInfo } from './contract.mjs';
import { neuralConfiguration } from './neural-client.mjs';

const fixtures = JSON.parse(await readFile(new URL('./fixtures.json', import.meta.url)));
const rounds = 20;
const includeNeural = process.argv.includes('--neural');
const engines = [
  { info: engineInfo, createClient: () => new EngineClient() },
  {
    info: {
      id: 'mozc-oss-desktop',
      revision: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: fileURLToPath(new URL('./.engines/mozc', import.meta.url)),
        encoding: 'utf8',
      }).trim(),
      neural: false,
      learning: false,
    },
    createClient: () => new MozcClient(),
  },
  ...(includeNeural ? [neuralConfiguration(1), neuralConfiguration(5)] : []),
];
for (const engine of engines) engine.client = engine.createClient();

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

async function timed(client, reading) {
  const start = performance.now();
  const result = await client.convert(reading);
  if (result.candidates[0]?.reading !== reading)
    throw new Error('Conversion did not preserve the complete reading.');
  return { ...result, roundTripMs: performance.now() - start };
}

async function measureStartup(engine) {
  const client = engine.createClient();
  try {
    return (await timed(client, fixtures[0].reading)).roundTripMs;
  } finally {
    client.close();
  }
}

async function initialize(engine) {
  const cold = await timed(engine.client, fixtures[0].reading);
  engine.coldRoundTripMs = cold.roundTripMs;
  engine.rows = [];
  for (const fixture of fixtures) {
    const result = await timed(engine.client, fixture.reading);
    const rank =
      result.candidates.findIndex((candidate) => fixture.expected.includes(candidate.text)) + 1;
    engine.rows.push({
      ...fixture,
      ...result,
      exactTop1: fixture.expected.includes(result.candidates[0]?.text),
      expectedRank: result.segments ? null : rank || null,
      samples: [],
    });
  }
}

async function measureRound(engine) {
  for (const row of engine.rows) {
    const result = await timed(engine.client, row.reading);
    if (result.candidates[0]?.text !== row.candidates[0]?.text)
      throw new Error('First-choice conversion changed despite disabled learning.');
    row.samples.push({ engineMs: result.engineMs, roundTripMs: result.roundTripMs });
  }
}

function reportEngine(engine) {
  const samples = engine.rows.flatMap((row) => row.samples);
  return {
    engine: engine.info,
    summary: {
      total: engine.rows.length,
      exactTop1: engine.rows.filter((row) => row.exactTop1).length,
      exactTop5: engine.rows[0].segments
        ? null
        : engine.rows.filter((row) => row.expectedRank && row.expectedRank <= 5).length,
      warmSamples: samples.length,
      engineMedianMs: percentile(
        samples.map((sample) => sample.engineMs),
        0.5
      ),
      engineP95Ms: percentile(
        samples.map((sample) => sample.engineMs),
        0.95
      ),
      roundTripMedianMs: percentile(
        samples.map((sample) => sample.roundTripMs),
        0.5
      ),
      roundTripP95Ms: percentile(
        samples.map((sample) => sample.roundTripMs),
        0.95
      ),
      coldRoundTripMs: engine.coldRoundTripMs,
      freshProcessMedianMs: percentile(engine.startupSamplesMs, 0.5),
    },
    startupSamplesMs: engine.startupSamplesMs,
    results: engine.rows,
  };
}

try {
  for (const engine of engines) {
    await initialize(engine);
    console.log(
      `${engine.info.id}: ${engine.rows.filter((row) => row.exactTop1).length}/24 first choices`
    );
  }
  for (let round = 0; round < rounds; round++) {
    const order = round % 2 ? [...engines].reverse() : engines;
    for (const engine of order) await measureRound(engine);
    if ((round + 1) % 5 === 0) console.log(`Completed ${round + 1}/${rounds} timing passes`);
  }
  for (const engine of engines) engine.startupSamplesMs = [];
  for (let trial = 0; trial < 5; trial++) {
    const order = trial % 2 ? [...engines].reverse() : engines;
    for (const engine of order) engine.startupSamplesMs.push(await measureStartup(engine));
  }
  const report = {
    host: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0].model },
    measuredAt: new Date().toISOString(),
    rounds,
    methodology:
      'Unchanged 24 fixtures. Release builds. Fresh processes/profiles, no learning. Neural settings are recorded per engine; no external context or personalization. Composition and neural session caches reset before each phrase. One cold request then one full warmup pass, followed by 20 passes alternating engine order. Then five fresh-process startup trials per engine, alternating order, with OS file caches warm. Sequential subprocess calls, no HTTP. Whole-sentence rankings for AzooKey only; Mozc alternatives are per segment. Valid spelling variants count as misses. Internal timers have slightly different boundaries; subprocess round trips include serialization and reset for both.',
    engines: engines.map(reportEngine),
  };
  await writeFile(
    new URL(
      includeNeural ? './neural-comparison.local.json' : './comparison.local.json',
      import.meta.url
    ),
    JSON.stringify(report, null, 2)
  );
  for (const engine of report.engines) console.log(engine.engine.id, engine.summary);
} finally {
  for (const engine of engines) engine.client.close();
}
