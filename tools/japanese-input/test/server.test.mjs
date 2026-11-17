import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaygroundServer } from '../server.mjs';
import { EngineClient } from '../engine-client.mjs';

async function serverFor(t, convert) {
  const server = createPlaygroundServer({ convert, close() {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('versioned conversion contract returns complete candidates', async (t) => {
  const url = await serverFor(t, async (reading) => ({
    candidates: [{ text: '昨日', reading }],
    engineMs: 3,
  }));
  const response = await fetch(`${url}/api/v1/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reading: 'きのう' }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.candidates[0].text, '昨日');
  assert.equal(body.engine.learning, false);
});

test('invalid and cross-origin requests never reach the engine', async (t) => {
  let calls = 0;
  const url = await serverFor(t, async () => {
    calls += 1;
  });
  const cases = [
    { body: '{}', status: 400 },
    { body: JSON.stringify({ reading: 'あ', expanded: 'true' }), status: 400 },
    { body: '{', status: 400 },
    { body: JSON.stringify({ reading: 'あ'.repeat(121) }), status: 400 },
    { body: JSON.stringify({ reading: 'あ\nい' }), status: 400 },
    { body: JSON.stringify({ reading: 'あ' }), status: 403, origin: 'https://example.com' },
  ];
  for (const item of cases) {
    const headers = { 'Content-Type': 'application/json' };
    if (item.origin) headers.Origin = item.origin;
    const response = await fetch(`${url}/api/v1/convert`, {
      method: 'POST',
      headers,
      body: item.body,
    });
    assert.equal(response.status, item.status);
  }
  assert.equal(calls, 0);
});

test('engine failure returns a recoverable error and private files cannot be read', async (t) => {
  const url = await serverFor(t, async () => {
    throw new Error('Engine unavailable.');
  });
  const response = await fetch(`${url}/api/v1/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"reading":"あ"}',
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'Engine unavailable.');
  assert.equal((await fetch(`${url}/engine/Package.resolved`)).status, 404);
});

test('missing engine binary rejects requests instead of hanging', async () => {
  const client = new EngineClient('/nonexistent/convolab-input-engine');
  try {
    await assert.rejects(client.convert('あ'), /engine|Engine/);
  } finally {
    client.close();
  }
});

test('readiness and retry endpoints reflect runtime state and reject foreign origins', async (t) => {
  let state = 'error';
  let retries = 0;
  const server = createPlaygroundServer({
    snapshot: () => ({ neural: true, inferenceLimit: 1, state }),
    preload() {
      retries += 1;
      state = 'loading';
    },
    close() {},
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/engine`;
  assert.equal((await (await fetch(url)).json()).state, 'error');
  const blocked = await fetch(`${url}/retry`, {
    method: 'POST',
    headers: { Origin: 'https://example.com' },
  });
  assert.equal(blocked.status, 403);
  assert.equal(retries, 0);
  const retry = await fetch(`${url}/retry`, { method: 'POST' });
  assert.equal(retry.status, 202);
  assert.equal((await retry.json()).state, 'loading');
  assert.equal(retries, 1);
  state = 'ready';
  assert.equal((await (await fetch(url)).json()).state, 'ready');
});

test('expanded menus forward the entire reading and explicit search mode', async (t) => {
  const calls = [];
  const url = await serverFor(t, async (reading, options) => {
    calls.push({ reading, ...options });
    return { candidates: [], engineMs: 1, expansion: 'whole-phrase-neural-and-dictionary' };
  });
  const response = await fetch(`${url}/api/v1/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reading: 'はしでたべました', expanded: true }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ reading: 'はしでたべました', expanded: true }]);
  assert.equal((await response.json()).expansion, 'whole-phrase-neural-and-dictionary');
});

test('manual boundaries preserve the full reading and reject invalid cuts before conversion', async (t) => {
  const calls = [];
  const url = await serverFor(t, async (reading, options) => {
    calls.push({ reading, ...options });
    return { candidates: [], engineMs: 1 };
  });
  const body = { reading: 'はしでたべました', expanded: true, boundaries: [2] };
  const send = (value) =>
    fetch(`${url}/api/v1/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  assert.equal((await send(body)).status, 200);
  assert.deepEqual(calls, [body]);
  assert.equal((await send({ ...body, boundaries: [2, 1] })).status, 400);
  assert.equal(calls.length, 1);
});
