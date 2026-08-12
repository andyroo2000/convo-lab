import { describe, expect, it } from 'vitest';

import type { Sentence } from '../../types';
import {
  getSentenceNavigationTargetMs,
  getSentenceTiming,
  isSentenceActive,
} from '../playbackTiming';

function sentence(overrides: Partial<Sentence>): Sentence {
  return {
    id: 'sentence',
    dialogueId: 'dialogue',
    text: 'Text',
    translation: 'Translation',
    speakerId: 'speaker',
    order: 0,
    metadata: {},
    selected: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('playback timing', () => {
  it('uses speed-specific timing with independent legacy fallbacks', () => {
    const value = sentence({
      startTime: 100,
      endTime: 900,
      startTime_0_85: 200,
    });

    expect(getSentenceTiming(value, 'medium')).toEqual({
      startTime: 200,
      endTime: 900,
    });
    expect(getSentenceTiming(value, 'normal')).toEqual({
      startTime: 100,
      endTime: 900,
    });
  });

  it('treats the end timestamp as exclusive', () => {
    const value = sentence({ startTime_1_0: 1000, endTime_1_0: 2000 });

    expect(isSentenceActive(value, 'normal', 1000)).toBe(true);
    expect(isSentenceActive(value, 'normal', 2000)).toBe(false);
  });

  it('targets the first sentence when moving next before dialogue starts', () => {
    const sentences = [
      sentence({ startTime_1_0: 1000, endTime_1_0: 2000 }),
      sentence({ id: 'second', startTime_1_0: 3000, endTime_1_0: 4000 }),
    ];

    expect(getSentenceNavigationTargetMs(sentences, 'normal', 0, 'next')).toBe(1000);
  });

  it('restarts the active sentence before moving to the previous one', () => {
    const sentences = [
      sentence({ startTime_1_0: 0, endTime_1_0: 2000 }),
      sentence({ id: 'second', startTime_1_0: 3000, endTime_1_0: 6000 }),
    ];

    expect(getSentenceNavigationTargetMs(sentences, 'normal', 4500, 'previous')).toBe(3000);
    expect(getSentenceNavigationTargetMs(sentences, 'normal', 3500, 'previous')).toBe(0);
  });

  it('moves next to the upcoming sentence from an active turn or timing gap', () => {
    const sentences = [
      sentence({ startTime_1_0: 0, endTime_1_0: 2000 }),
      sentence({ id: 'second', startTime_1_0: 3000, endTime_1_0: 4000 }),
    ];

    expect(getSentenceNavigationTargetMs(sentences, 'normal', 1000, 'next')).toBe(3000);
    expect(getSentenceNavigationTargetMs(sentences, 'normal', 2500, 'next')).toBe(3000);
    expect(getSentenceNavigationTargetMs(sentences, 'normal', 5000, 'next')).toBe(3000);
  });

  it('skips sentences without usable start timing', () => {
    const sentences = [
      sentence({}),
      sentence({ id: 'timed', startTime_1_0: 2500, endTime_1_0: 4000 }),
    ];

    expect(getSentenceNavigationTargetMs(sentences, 'normal', 0, 'next')).toBe(2500);
  });
});
