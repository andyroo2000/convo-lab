import { beforeEach, describe, expect, it } from 'vitest';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { StudyMilestoneStore, type StudyMilestoneStorage } from '../studyMilestoneModel';
import type { StudySessionReviewRecord } from '../studySessionWrapUpModel';

class MemoryStorage implements StudyMilestoneStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const card = (id: string, stability: number): StudyCardSummary => ({
  id,
  noteId: `note-${id}`,
  cardType: 'recognition',
  prompt: { cueText: id },
  answer: { expression: id, meaning: `meaning-${id}` },
  state: {
    dueAt: '2026-08-25T12:00:00.000Z',
    queueState: 'review',
    scheduler: {
      due: '2026-08-25T12:00:00.000Z',
      stability,
      difficulty: 5,
      elapsed_days: 1,
      scheduled_days: stability,
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

const review = (id: string): StudySessionReviewRecord => ({
  id,
  cardBefore: card(id, 364),
  cardAfter: card(id, 365),
  grade: 'good',
  durationMs: 1_000,
});

describe('StudyMilestoneStore', () => {
  let storage: MemoryStorage;
  let nextId: number;

  beforeEach(() => {
    storage = new MemoryStorage();
    nextId = 0;
  });

  const makeStore = (userId = 'user-1') =>
    new StudyMilestoneStore(storage, userId, {
      now: () => new Date('2026-08-25T12:00:00.000Z'),
      createId: () => {
        nextId += 1;
        return `session-${String(nextId)}`;
      },
    });

  it('awards 100 burned when a review session crosses the threshold', () => {
    const store = makeStore();
    store.beginReviewSession(99);
    store.recordReview(review('review-1'));

    const completion = store.prepareCurrentSessionCompletion();

    expect(completion?.newAwards.map(({ id }) => id)).toEqual(['burned100']);
    expect(store.earnedAwards.map(({ id }) => id)).toEqual(['burned100']);
  });

  it('restores an interrupted qualifying session as award then wrap-up data', () => {
    const store = makeStore();
    store.beginReviewSession(99);
    store.recordReview(review('review-1'));

    const restored = makeStore().prepareInterruptedCompletion();

    expect(restored).toMatchObject({
      id: 'session-1',
      celebrationPresented: false,
      records: [{ id: 'review-1' }],
      newAwards: [{ id: 'burned100' }],
    });
  });

  it('does not force an ordinary abandoned session into a stale wrap-up', () => {
    const store = makeStore();
    store.beginReviewSession(20);
    store.recordReview(review('review-1'));

    expect(makeStore().prepareInterruptedCompletion()).toBeNull();
  });

  it('restores a formally ended ordinary session if the page closes on the wrap-up', () => {
    const store = makeStore();
    store.beginReviewSession(20);
    store.recordReview(review('review-1'));
    const prepared = store.prepareCurrentSessionCompletion();

    const restored = makeStore().prepareInterruptedCompletion();

    expect(prepared?.newAwards).toEqual([]);
    expect(restored?.id).toBe(prepared?.id);
    expect(restored?.records.map(({ id }) => id)).toEqual(['review-1']);
  });

  it('backfills previously reached thresholds without replaying their award', () => {
    const store = makeStore();
    store.beginReviewSession(120);
    store.recordReview({
      ...review('review-1'),
      cardBefore: card('review-1', 10),
      cardAfter: card('review-1', 20),
    });

    expect(store.prepareCurrentSessionCompletion()?.newAwards).toEqual([]);
    expect(store.earnedAwards.map(({ id }) => id)).toEqual(['burned100']);
  });

  it('retracts a prepared award when its qualifying review is undone', () => {
    const store = makeStore();
    store.beginReviewSession(99);
    store.recordReview(review('review-1'));
    const completion = store.prepareCurrentSessionCompletion();

    store.reopenCompletion(completion?.id ?? 'missing');
    store.undoReview('review-1');

    expect(store.earnedAwards).toEqual([]);
    expect(store.prepareCurrentSessionCompletion()).toBeNull();
  });

  it('keeps earned milestones scoped to the signed-in account', () => {
    const first = makeStore('user-1');
    first.beginReviewSession(99);
    first.recordReview(review('review-1'));
    first.prepareCurrentSessionCompletion();

    expect(makeStore('user-2').earnedAwards).toEqual([]);
    expect(makeStore('user-1').earnedAwards.map(({ id }) => id)).toEqual(['burned100']);
  });
});
