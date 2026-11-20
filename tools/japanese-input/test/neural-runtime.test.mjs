import test from 'node:test';
import assert from 'node:assert/strict';
import { NeuralRuntime } from '../neural-runtime.mjs';

function configuration(convert) {
  return {
    info: { neural: true, inferenceLimit: 1 },
    createClient: () => ({
      child: {},
      convert,
      close() {
        this.child = null;
      },
    }),
  };
}
const candidates = [{ text: '箸', reading: 'はし' }];

test('preload finishes before accepting writing and reuses its warm worker', async () => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const calls = [];
  const engine = new NeuralRuntime(
    configuration(async (reading) => {
      calls.push(reading);
      await held;
      return { candidates };
    })
  );
  assert.equal(engine.snapshot().state, 'loading');
  await assert.rejects(engine.convert('私の文章'), /not ready/);
  const worker = engine.client;
  release();
  await engine.warming;
  assert.equal(engine.snapshot().state, 'ready');
  await engine.convert('私の文章');
  assert.equal(calls.at(-1), '私の文章');
  assert.equal(engine.client, worker);
  engine.close();
});

test('failed warmup can retry and a crashed worker cannot report ready', async () => {
  let fail = true;
  const engine = new NeuralRuntime(
    configuration(async () => {
      if (fail) throw new Error('Unavailable');
      return { candidates };
    })
  );
  await engine.warming;
  assert.equal(engine.snapshot().state, 'error');
  fail = false;
  const retry = engine.preload();
  assert.equal(engine.preload(), retry);
  await retry;
  assert.equal(engine.snapshot().state, 'ready');
  engine.client.child = null;
  assert.equal(engine.snapshot().state, 'error');
  engine.close();
});

test('closing during preload cannot bring the runtime back to ready', async () => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const engine = new NeuralRuntime(
    configuration(async () => {
      await held;
      return { candidates };
    })
  );
  const warming = engine.warming;
  engine.close();
  release();
  await warming;
  assert.equal(engine.snapshot().state, 'error');
});
