import { describe, expect, it } from 'vitest';

import { buildPitchAccentPattern } from '../../../../services/pitchAccent/hatsuonAdapter.js';

describe('hatsuonAdapter', () => {
  it('builds heiban pitch patterns', () => {
    expect(buildPitchAccentPattern({ surface: '会社', reading: 'かいしゃ', pitchNum: 0 })).toEqual(
      expect.objectContaining({
        morae: ['か', 'い', 'しゃ'],
        pattern: [0, 1, 1],
        patternName: expect.any(String),
      })
    );
  });

  it('builds atamadaka and nakadaka patterns', () => {
    expect(
      buildPitchAccentPattern({ surface: '雨', reading: 'あめ', pitchNum: 1 }).pattern
    ).toEqual([1, 0]);
    expect(
      buildPitchAccentPattern({ surface: '中学校', reading: 'ちゅうがっこう', pitchNum: 3 }).morae
    ).toEqual(['ちゅ', 'う', 'が', 'っ', 'こ', 'う']);
  });

  it('drops the following-particle pitch that hatsuon includes', () => {
    expect(
      buildPitchAccentPattern({ surface: '橋', reading: 'はし', pitchNum: 2 }).pattern
    ).toHaveLength(2);
  });
});
