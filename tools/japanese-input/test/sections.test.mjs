import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phraseSections, preserveChoices, expandSectionChoices } from '../web/sections.mjs';

const primary = {
  text: '箸で食べました',
  sections: [
    { text: '箸で', reading: 'はしで' },
    { text: '食べました', reading: 'たべました' },
  ],
};

test('aligns context-ranked choices across literal kana edges without guessing kanji readings', () => {
  const alternate = {
    text: '橋で食べました',
    units: [
      { text: '橋', reading: 'はし' },
      { text: 'で食べ', reading: 'でたべ' },
      { text: 'ました', reading: 'ました' },
    ],
  };
  const result = phraseSections('はしでたべました', [primary, alternate]);
  assert.deepEqual(result[0].choices, ['はしで', '箸で', '橋で', 'ハシデ']);
  const opaque = {
    text: '橋で食べました',
    units: [{ text: '橋で食べました', reading: 'はしでたべました' }],
  };
  assert.ok(!phraseSections('はしでたべました', [primary, opaque])[0].choices.includes('橋で'));
});

test('preserves a manual choice when later context merges its clause with another', () => {
  const pin = { ...phraseSections('はしでたべました', [primary])[0], text: 'はしで', selected: 0 };
  const result = preserveChoices(
    [
      { text: '箸で食べました', reading: 'はしでたべました', start: 0 },
      { text: '昨日', reading: 'きのう', start: 8 },
    ],
    [pin]
  );
  assert.equal(result.map((part) => part.text).join(''), 'はしでたべました昨日');
  assert.equal(result.map((part) => part.reading).join(''), 'はしでたべましたきのう');
});

test('invalid engine alignment falls back to a whole phrase instead of dropping text', () => {
  const result = phraseSections('はしでたべました', [
    { ...primary, sections: primary.sections.slice(0, 1) },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, primary.text);
  assert.equal(result[0].reading, 'はしでたべました');
});

test('menu expansion keeps current choices, selection, and clause boundaries intact', () => {
  const initial = phraseSections('はしでたべました', [primary]);
  initial[0].text = 'はしで';
  initial[0].selected = 0;
  const more = {
    text: '橋で食べました',
    units: [
      { text: '橋で', reading: 'はしで' },
      { text: '食べました', reading: 'たべました' },
    ],
  };
  const result = expandSectionChoices(initial, 'はしでたべました', [more, more]);
  assert.equal(result[0].text, 'はしで');
  assert.equal(result[0].selected, 0);
  assert.deepEqual(result[0].choices, ['はしで', '箸で', 'ハシデ', '橋で']);
  assert.equal(result[1].text, '食べました');
  assert.equal(initial[0].choices.includes('橋で'), false);
});
