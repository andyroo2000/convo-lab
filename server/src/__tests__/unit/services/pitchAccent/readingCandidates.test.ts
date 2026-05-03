import { describe, expect, it } from 'vitest';

import { collectPitchAccentReadingCandidates } from '../../../../services/pitchAccent/readingCandidates.js';

describe('readingCandidates', () => {
  it('collects normalized kana readings from ruby, override, and sentence kana', () => {
    expect(
      collectPitchAccentReadingCandidates({
        expressionReading: '上手[じょうず]',
        promptReading: '上手(うわて)',
        answerAudioTextOverride: 'じょうず',
        sentenceJpKana: '彼はじょうずです。',
      })
    ).toEqual(['じょうず', 'うわて']);
  });

  it('uses plain kana readings and ignores missing values', () => {
    expect(
      collectPitchAccentReadingCandidates({
        expressionReading: 'かいしゃ',
        promptReading: null,
      })
    ).toEqual(['かいしゃ']);
  });
});
