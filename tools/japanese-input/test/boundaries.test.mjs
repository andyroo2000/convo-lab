import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phraseSections } from '../web/sections.mjs';
import { resizedSections, resolveBoundaries } from '../web/section-boundaries.mjs';
import { validateConversionRequest } from '../contract.mjs';

const reading = 'はしでたべました';
const candidate = {
  text: '箸で食べました',
  sections: [
    { reading: 'はしで', text: '箸で' },
    { reading: 'たべました', text: '食べました' },
  ],
  units: [
    { reading: 'はし', text: '箸' },
    { reading: 'で', text: 'で' },
    { reading: 'たべ', text: '食べ' },
    { reading: 'ました', text: 'ました' },
  ],
};

function parts() {
  return phraseSections(reading, [candidate]);
}

test('moves a right boundary one reading character without changing the full reading', () => {
  const shrunk = resizedSections(parts(), 0, -1, [candidate]);
  assert.deepEqual(
    shrunk.map((p) => p.reading),
    ['はし', 'でたべました']
  );
  assert.deepEqual(
    shrunk.map((p) => p.text),
    ['箸', 'で食べました']
  );
  const restored = resizedSections(shrunk, 0, 1, [candidate]);
  assert.deepEqual(
    restored.map((p) => p.reading),
    parts().map((p) => p.reading)
  );
  assert.equal(restored.map((p) => p.text).join(''), candidate.text);
});

test('never guesses an internal kanji split and keeps untouched section choices', () => {
  const shrunk = resizedSections(resizedSections(parts(), 0, -1, [candidate]), 0, -1, [candidate]);
  assert.deepEqual(
    shrunk.map((p) => p.reading),
    ['は', 'しでたべました']
  );
  assert.equal(shrunk[0].text, 'は');
  const withPrefix = [
    { start: 0, reading: 'かみ', text: '神', choices: ['神'], selected: 0 },
    ...parts().map((p) => ({ ...p, start: p.start + 2 })),
  ];
  assert.equal(resizedSections(withPrefix, 1, -1, [])[0], withPrefix[0]);
});

test('merges consumed sections, splits the last section, and stops at either limit', () => {
  let result = parts();
  for (let i = 0; i < 5; i++) result = resizedSections(result, 0, 1, [candidate]);
  assert.equal(result.length, 1);
  assert.equal(result[0].reading, reading);
  assert.equal(resizedSections(result, 0, 1, []), result);
  result = resizedSections(result, 0, -1, [candidate]);
  assert.deepEqual(
    result.map((p) => p.reading),
    ['はしでたべまし', 'た']
  );
  assert.equal(resizedSections(result, 1, -1, []), result);
  assert.equal(result.map((p) => p.reading).join(''), reading);
});

test('preserves an explicit choice while delayed boundary choices arrive', () => {
  const result = resizedSections(parts(), 0, -1, [candidate]);
  result[0] = { ...result[0], text: 'はし', selected: 0, pendingBoundary: false };
  assert.equal(resolveBoundaries(result, reading, [candidate])[0].text, 'はし');
});

test('boundary movement and request validation respect complete Unicode characters', () => {
  const sections = [
    { start: 0, reading: 'あ🙂', text: 'あ🙂' },
    { start: 3, reading: 'か\u3099き', text: 'か\u3099き' },
  ];
  assert.deepEqual(
    resizedSections(sections, 0, -1, []).map((p) => p.reading),
    ['あ', '🙂か\u3099き']
  );
  assert.deepEqual(
    resizedSections(sections, 0, 1, []).map((p) => p.reading),
    ['あ🙂か\u3099', 'き']
  );
  assert.deepEqual(
    validateConversionRequest({ reading: 'あ🙂い', boundaries: [1, 3] }).boundaries,
    [1, 3]
  );
  for (const boundaries of [[0], [2], [4], [-1], [1.5], [3, 1], [1, 1], '1']) {
    assert.throws(() => validateConversionRequest({ reading: 'あ🙂い', boundaries }));
  }
});
