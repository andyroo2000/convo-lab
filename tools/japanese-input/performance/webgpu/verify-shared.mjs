import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const folder = new URL('../../benchmarks/', import.meta.url);
async function read(file) {
  const bytes = await readFile(new URL(file, folder));
  return JSON.parse(file.endsWith('.gz') ? gunzipSync(bytes) : bytes);
}
const signature = candidate => JSON.stringify([candidate.text, candidate.sections, candidate.units]);
function compare(reference, actual) {
  const previous = new Map(reference.candidates.map(candidate => [candidate.text, candidate]));
  assert.equal(actual.candidates.length, previous.size);
  assert.deepEqual(actual.candidates.slice(0, 5).map(c => c.text), reference.candidates.slice(0, 5).map(c => c.text));
  for (const candidate of actual.candidates) assert.equal(signature(candidate), signature(previous.get(candidate.text)));
  return {
    reading: reference.reading ?? reference.input.reading,
    beforeMs: reference.ms ?? reference.wallMs,
    afterMs: actual.ms ?? actual.wallMs,
    count: actual.candidates.length,
    matchingPositions: actual.candidates.filter((c, i) => c.text === reference.candidates[i].text).length,
    maxScoreDifference: Math.max(...actual.candidates.map(c => Math.abs(c.neuralScore - previous.get(c.text).neuralScore))),
  };
}
const corpus = await read('webgpu-shared-quality.json.gz');
const old = corpus.configurations[0], optimized = corpus.configurations[1];
assert.equal(old.requests.length, 24);
assert.equal(optimized.requests.length, 24);
assert.ok(!old.failure && !optimized.failure);
const corpusResults = old.requests.map((request, i) => compare(request, optimized.requests[i]));
const baseline = await read('webgpu-gpu.json');
const final = await read('webgpu-gpu-shared-final.json');
assert.ok(!final.failure);
assert.equal(final.trials.length, 72);
for (const [i, request] of final.trials.entries()) {
  assert.deepEqual(request.candidates.map(signature), baseline.trials[i].candidates.map(signature));
}
const boundaries = baseline.boundaries.map((request, i) => compare(request, final.boundaries[i]));
await writeFile(new URL('WEBGPU-SHARED-SUMMARY.json', folder), JSON.stringify({ ordinaryMatches: 72, corpusResults, boundaries }, null, 2));
console.log('72 ordinary conversions, 24 full-corpus boundary cases, and 8 original boundary/repeat requests preserve candidate sets, sections, and top five.');
