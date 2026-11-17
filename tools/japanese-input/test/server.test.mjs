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
