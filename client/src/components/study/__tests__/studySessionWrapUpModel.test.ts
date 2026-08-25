import { describe, expect, it } from 'vitest';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { buildStudySessionWrapUp, type StudySessionReviewRecord } from '../studySessionWrapUpModel';

const makeCard = (
  id: string,
  options: { queueState?: 'new' | 'review' | 'relearning'; stability?: number } = {}
): StudyCardSummary => ({
  id,
  noteId: `note-${id}`,
  cardType: 'recognition',
  prompt: { cueText: id },
  answer: { expression: id, meaning: `meaning-${id}` },
  state: {
    dueAt: '2026-08-25T12:00:00.000Z',
    queueState: options.queueState ?? 'review',
    scheduler: {
      due: '2026-08-25T12:00:00.000Z',
      stability: options.stability ?? 3,
      difficulty: 5,
      elapsed_days: 1,
      scheduled_days: 3,
      learning_steps: 0,
      reps: 2,
      lapses: 0,
      state: 2,
      last_review: '2026-08-22T12:00:00.000Z',
    },
    source: {},
  },
  answerAudioSource: 'missing',
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-25T12:00:00.000Z',
});

const review = (
  id: string,
  cardBefore: StudyCardSummary,
  grade: StudySessionReviewRecord['grade'],
  durationMs: number,
  cardAfter: StudyCardSummary | null = cardBefore
): StudySessionReviewRecord => ({ id, cardBefore, cardAfter, grade, durationMs });

describe('buildStudySessionWrapUp', () => {
  it('uses first attempts on learned cards for recall and counts every review event', () => {
    const learned = makeCard('learned');
    const fresh = makeCard('fresh', { queueState: 'new' });
    const summary = buildStudySessionWrapUp([
      review('one', learned, 'again', 8_000),
      review('two', learned, 'good', 4_000),
      review('three', fresh, 'again', 6_000),
    ]);

    expect(summary.reviewsCompleted).toBe(3);
    expect(summary.firstPassRecall).toBe(0);
  });

  it('identifies cards that cross into week-plus FSRS stability', () => {
    const before = makeCard('stable', { stability: 6.9 });
    const after = makeCard('stable', { stability: 7.1 });

    const summary = buildStudySessionWrapUp([review('one', before, 'good', 5_000, after)]);

    expect(summary.stabilizedCards.map((card) => card.id)).toEqual(['stable']);
  });

  it('combines repeated misses with the slowest cards without duplicates', () => {
    const cards = Array.from({ length: 7 }, (_, index) => makeCard(`card-${index + 1}`));
    const summary = buildStudySessionWrapUp([
      review('one', cards[0], 'again', 4_000),
      review('two', cards[0], 'again', 5_000),
      review('three', cards[1], 'again', 7_000),
      ...cards
        .slice(2)
        .map((card, index) => review(`slow-${index}`, card, 'good', 30_000 - index * 2_000)),
    ]);

    expect(summary.toughestCards).toHaveLength(5);
    expect(summary.toughestCards[0]).toMatchObject({
      card: { id: 'card-1' },
      missCount: 2,
    });
    expect(new Set(summary.toughestCards.map(({ card }) => card.id)).size).toBe(5);
  });
});
