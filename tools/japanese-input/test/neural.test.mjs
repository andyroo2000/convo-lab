import test from 'node:test';
import assert from 'node:assert/strict';
import { neuralConfiguration } from '../neural-client.mjs';

test('fresh neural clients retain their inference limit and isolated binary', () => {
  for (const limit of [1, 5]) {
    const configuration = neuralConfiguration(limit);
    const first = configuration.createClient();
    const next = configuration.createClient();
    assert.equal(configuration.info.inferenceLimit, limit);
    assert.equal(configuration.info.neural, true);
    assert.match(next.binary, /neural-build\/release\/InputWorker$/);
    assert.deepEqual(first.args, next.args);
    assert.equal(next.args[1], String(limit));
    assert.equal(next.timeoutMs, 60000);
    assert.equal(configuration.info.learning, false);
    first.close();
    next.close();
  }
});
