import { describe, expect, it } from 'vitest';
import {
  createStudyFsrsScheduler,
  deserializeStudyFsrsCard,
  serializeStudyFsrsCard,
} from '@languageflow/shared/src/studyFsrs';

describe('studyFsrs shared helpers', () => {
  it('round-trips a serialized FSRS card shape', () => {
    const original = {
      due: new Date('2026-04-22T12:00:00.000Z'),
      stability: 12.5,
      difficulty: 4.5,
      elapsed_days: 3,
      scheduled_days: 14,
      learning_steps: 1,
      reps: 9,
      lapses: 2,
      state: 2,
      last_review: new Date('2026-04-20T12:00:00.000Z'),
    };

    const serialized = serializeStudyFsrsCard(original);
    const deserialized = deserializeStudyFsrsCard(serialized);

    expect(deserialized).toEqual(original);
  });

  it('builds a reusable shared scheduler instance for client-side interval previews', () => {
    const scheduler = createStudyFsrsScheduler();

    expect(typeof scheduler.next).toBe('function');
    expect(typeof scheduler.repeat).toBe('function');
  });
});
