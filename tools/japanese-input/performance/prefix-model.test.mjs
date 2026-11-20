import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Exercise the production cache logic with deterministic token likelihoods.
const source = (
  await readFile(new URL('./batch/prefix-model.mjs', import.meta.url), 'utf8')
).replace(
  "import { BatchedNeuralModel } from '/browser/batched-neural-model.mjs';",
  'class BatchedNeuralModel {}'
);
const { PrefixNeuralModel } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
function fixture() {
  const requests = [];
  const model = new PrefixNeuralModel();
  model.tokenize = async (text) => [2, ...Array.from(text, (character) => character.charCodeAt(0))];
  model.model = {
    getEOS: () => 3,
    proxy: {
      async wllamaAction(action, request) {
        requests.push(request);
        const probabilities = request.tokens.slice(request.start).map((token) => -token / 100);
        return {
          score: probabilities.reduce((a, b) => a + b, 0),
          log_probs: probabilities,
          n_past: request.tokens.length - 1,
        };
      },
    },
  };
  return { model, requests };
}
test('shared candidate prefixes preserve the complete neural score', async () => {
  const { model, requests } = fixture();
  const first = await model.score('Pabc', 'P');
  const second = await model.score('Pabd', 'P');
  assert.ok(Math.abs(first.score - (-97 - 98 - 99 - 3) / 100) < 1e-12);
  assert.ok(Math.abs(second.score - (-97 - 98 - 100 - 3) / 100) < 1e-12);
  assert.equal(requests[1].start, 4);
  assert.deepEqual(await model.score('Pabc', 'P'), first);
  assert.equal(requests.length, 2);
});
test('different prompt boundaries do not reuse incompatible scores', async () => {
  const { model, requests } = fixture();
  await model.score('Pabc', 'P');
  const result = await model.score('Pabc', 'Pa');
  assert.equal(requests[1].start, 3);
  assert.ok(Math.abs(result.score - (-98 - 99 - 3) / 100) < 1e-12);
});
test('prefix score cache remains bounded', () => {
  const { model } = fixture();
  for (let index = 0; index < 4100; index++) {
    model.remember([2, index], 1, { next: 1, score: 0 }, [-1]);
  }
  assert.equal(model.prefixScores.size, 4096);
  assert.equal(model.cachedPrefix([2, 0], 1).next, 1);
  assert.equal(model.cachedPrefix([2, 4099], 1).score, -1);
});
test('invalid inference does not poison cached scores', async () => {
  const { model } = fixture();
  model.model.proxy.wllamaAction = async () => ({ score: NaN });
  await assert.rejects(model.score('Pabc', 'P'), /Invalid neural score/);
  assert.equal(model.prefixScores.size, 0);
});
