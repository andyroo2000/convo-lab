import test from 'node:test';
import assert from 'node:assert/strict';
import { MozcClient, parseMozc } from '../mozc-client.mjs';

const hex = (text) => Buffer.from(text).toString('hex');
test('Mozc keeps phrase alternatives separate from its first-choice sentence', () => {
  const result = parseMozc(
    `1.25\t${hex('はしで')}:${hex('箸で')},${hex('橋で')}\t${hex('たべました')}:${hex('食べました')}`
  );
  assert.equal(result.engineMs, 1.25);
  assert.deepEqual(result.candidates, [{ text: '箸で食べました', reading: 'はしでたべました' }]);
  assert.deepEqual(result.segments[0].candidates, ['箸で', '橋で']);
});

test('Mozc protocol preserves punctuation and rejects malformed responses', () => {
  const text = '"quote"\t\\。';
  assert.equal(parseMozc(`0\t${hex('かな')}:${hex(text)}`).candidates[0].text, text);
  for (const line of ['ERROR', '', 'NaN\tab:cd', '-1\tab:cd', '1\tbad:zz', '1\tab:']) {
    assert.throws(() => parseMozc(line));
  }
});

test('missing Mozc binary fails promptly and cannot leave a stale pending request', async () => {
  const client = new MozcClient('/nonexistent-convolab-mozc-worker');
  await assert.rejects(client.convert('かな'), /Build Mozc/);
  await assert.rejects(client.convert('かな'), /closed/);
  client.close();
});

test('Mozc benchmark rejects multiline input without spawning a worker', async () => {
  const client = new MozcClient('/nonexistent-convolab-mozc-worker');
  await assert.rejects(client.convert('かな\nかな'), /one nonempty reading/);
  assert.equal(client.child, null);
  client.close();
});
