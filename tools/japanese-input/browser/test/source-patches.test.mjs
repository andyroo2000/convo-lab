import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replaceRequired } from '../source-patches.mjs';

test('pinned source replacements require the exact expected match count', () => {
  assert.equal(replaceRequired('learning: off', 'off', 'on'), 'learning: on');
  assert.equal(replaceRequired('old old', 'old', 'new', 2), 'new new');
  assert.throws(() => replaceRequired('drifted', 'old', 'new'), /found 0/);
  assert.throws(() => replaceRequired('old old', 'old', 'new'), /found 2/);
});
