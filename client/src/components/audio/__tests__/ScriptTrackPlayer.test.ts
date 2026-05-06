import { describe, expect, it } from 'vitest';

import {
  findCurrentL2Unit,
  normalizeTimingDataForDuration,
} from '../scriptTrackTiming';
import type { DailyAudioPracticeTiming, LessonScriptUnit } from '../../../types';

describe('ScriptTrackPlayer timing helpers', () => {
  const units: LessonScriptUnit[] = [
    { type: 'marker', label: 'Start' },
    { type: 'L2', text: 'ゆっくり話します。', voiceId: 'ja-JP-Wavenet-C', speed: 0.75 },
    { type: 'pause', seconds: 1 },
    { type: 'L2', text: '自然に話します。', voiceId: 'ja-JP-Wavenet-C', speed: 1 },
  ];

  it('scales stored timing data to the actual audio duration for transcript sync', () => {
    const timings: DailyAudioPracticeTiming[] = [
      { unitIndex: 1, startTime: 0, endTime: 5000 },
      { unitIndex: 2, startTime: 5000, endTime: 6000 },
      { unitIndex: 3, startTime: 6000, endTime: 10000 },
    ];

    const scaled = normalizeTimingDataForDuration(timings, 20);

    expect(scaled).toEqual([
      { unitIndex: 1, startTime: 0, endTime: 10000 },
      { unitIndex: 2, startTime: 10000, endTime: 12000 },
      { unitIndex: 3, startTime: 12000, endTime: 20000 },
    ]);
    expect(findCurrentL2Unit(units, scaled, 13)).toEqual(
      expect.objectContaining({ text: '自然に話します。' })
    );
  });

  it('leaves near-matching timing data unchanged', () => {
    const timings: DailyAudioPracticeTiming[] = [
      { unitIndex: 1, startTime: 0, endTime: 5000 },
      { unitIndex: 3, startTime: 5000, endTime: 10000 },
    ];

    expect(normalizeTimingDataForDuration(timings, 10.5)).toBe(timings);
  });
});
