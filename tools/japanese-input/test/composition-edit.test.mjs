import test from 'node:test';
import assert from 'node:assert/strict';
import { toHiragana } from 'wanakana';
import { InlineSession, kanaComposer } from '../web/inline-session.mjs';
import { replaceCompositionRange, restoreCaret } from '../web/composition-edit.mjs';

function sessionFor(raw) {
  const field = {
    value: '前後',
    selectionStart: 1,
    selectionEnd: 1,
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    setRangeText(text, start, end) {
      this.value = this.value.slice(0, start) + text + this.value.slice(end);
    },
  };
  const session = new InlineSession(field, kanaComposer(toHiragana), () => {});
  session.append(raw);
  return session;
}

test('punctuation and numbers remain part of the full reading', () => {
  const session = sessionFor('ame1.');
  assert.equal(session.reading(), 'あめ1。');
  replaceCompositionRange(session, 4, 1, '');
  session.append('wo');
  assert.equal(session.field.value, '前あめ1を後');
});

test('editing inside kana preserves the surrounding document and remaining romaji', () => {
  const session = sessionFor('kyouhaiitenki');
  replaceCompositionRange(session, 7, 1, '');
  assert.equal(session.field.value, '前きょうはいいんき後');
  replaceCompositionRange(session, 7, 0, 'te');
  assert.equal(session.field.value, '前きょうはいいてんき後');
});

test('a caret at a converted section boundary maps back to the correct reading', () => {
  const session = sessionFor('kyouhaiitenki');
  session.preview('今日はいい天気');
  session.field.setSelectionRange(4, 4);
  restoreCaret(session, [
    { text: '今日は', reading: 'きょうは' },
    { text: 'いい天気', reading: 'いいてんき' },
  ]);
  assert.equal(session.field.value, '前きょうはいいてんき後');
  assert.equal(session.field.selectionStart, 5);
  replaceCompositionRange(session, 5, 0, 'totemo');
  assert.equal(session.field.value, '前きょうはとてもいいてんき後');
});

for (const count of [10, 200]) {
  test(`deleting the last kana avoids rescanning ${count} preceding tokens`, () => {
    const session = sessionFor('ka'.repeat(count));
    const kana = session.kana;
    let calls = 0;
    session.kana = (...args) => {
      calls++;
      return kana(...args);
    };
    replaceCompositionRange(session, session.active.end - 1, 1, '');
    assert.equal(session.field.value, `前${'か'.repeat(count - 1)}後`);
    assert.ok(calls <= 6, `Expected bounded conversion calls, received ${calls}`);
  });
}
