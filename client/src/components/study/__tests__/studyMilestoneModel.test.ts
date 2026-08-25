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

const burned100 = {
  id: 'burned100' as const,
  earnedAt: '2026-08-25T12:00:00.000Z',
  presentedAt: null,
};

describe('StudyMilestoneStore', () => {
  let storage: MemoryStorage;
  let nextId: number;

  beforeEach(() => {
    storage = new MemoryStorage();
    nextId = 0;
  });

  const makeStore = (userId = 'user-1') =>
    new StudyMilestoneStore(storage, userId, {
      createId: () => {
        nextId += 1;
        return `session-${String(nextId)}`;
      },
    });

  it('uses the server snapshot to award 100 burned at session completion', () => {
    const store = makeStore();
    store.beginReviewSession();
    store.recordReview(review('review-1'));
    store.applyServerSnapshot({ milestones: [burned100], pendingMilestones: [burned100] });

    const completion = store.prepareCurrentSessionCompletion([burned100]);

    expect(completion?.newAwards.map(({ id }) => id)).toEqual(['burned100']);
    expect(store.earnedAwards.map(({ id }) => id)).toEqual(['burned100']);
  });

  it('restores an interrupted qualifying session as award then wrap-up data', () => {
    const store = makeStore();
    store.beginReviewSession();
    store.recordReview(review('review-1'));

    const reloaded = makeStore();
    reloaded.applyServerSnapshot({ milestones: [burned100], pendingMilestones: [burned100] });
    const restored = reloaded.prepareInterruptedCompletion([burned100]);

    expect(restored).toMatchObject({
      id: 'session-1',
      celebrationPresented: false,
      records: [{ id: 'review-1' }],
      newAwards: [{ id: 'burned100' }],
    });
  });

  it('keeps a prepared celebration when a later snapshot has no pending award', () => {
    const store = makeStore();
    store.beginReviewSession();
    store.recordReview(review('review-1'));

    const prepared = store.prepareInterruptedCompletion([burned100]);
    const restored = store.prepareInterruptedCompletion([]);

    expect(prepared?.newAwards).toEqual([burned100]);
    expect(restored?.newAwards).toEqual([burned100]);
    expect(restored?.celebrationPresented).toBe(false);
  });

  it('adds a server award to a wrap-up that was prepared offline', () => {
    const store = makeStore();
    store.beginReviewSession();
    store.recordReview(review('review-1'));

    expect(store.prepareCurrentSessionCompletion()?.newAwards).toEqual([]);
    expect(store.prepareInterruptedCompletion([burned100])?.newAwards).toEqual([burned100]);
  });

  it('does not force an ordinary abandoned session into a stale wrap-up', () => {
    const store = makeStore();
    store.beginReviewSession();
    store.recordReview(review('review-1'));

    expect(makeStore().prepareInterruptedCompletion()).toBeNull();
  });

  it('restores a formally ended ordinary session if the page closes on the wrap-up', () => {
    const store = makeStore();
    store.beginReviewSession();
    store.recordReview(review('review-1'));
    const prepared = store.prepareCurrentSessionCompletion();

    const restored = makeStore().prepareInterruptedCompletion();

    expect(prepared?.newAwards).toEqual([]);
    expect(restored?.id).toBe(prepared?.id);
    expect(restored?.records.map(({ id }) => id)).toEqual(['review-1']);
  });

  it('caches backfilled server history without replaying its award', () => {
    const store = makeStore();
    store.applyServerSnapshot({
      milestones: [{ ...burned100, presentedAt: burned100.earnedAt }],
      pendingMilestones: [],
    });
    store.beginReviewSession();
    store.recordReview({
      ...review('review-1'),
      cardBefore: card('review-1', 10),
      cardAfter: card('review-1', 20),
    });

    expect(store.prepareCurrentSessionCompletion()?.newAwards).toEqual([]);
    expect(store.earnedAwards.map(({ id }) => id)).toEqual(['burned100']);
  });

  it('persists server history for offline milestone views', () => {
    const store = makeStore();
    store.applyServerSnapshot({
      milestones: [{ ...burned100, presentedAt: burned100.earnedAt }],
      pendingMilestones: [],
    });

    expect(makeStore().earnedAwards.map(({ id }) => id)).toEqual(['burned100']);
  });

  it('retracts a prepared award when its qualifying review is undone', () => {
    const store = makeStore();
    store.beginReviewSession();
    store.recordReview(review('review-1'));
    store.applyServerSnapshot({ milestones: [burned100], pendingMilestones: [burned100] });
    const completion = store.prepareCurrentSessionCompletion([burned100]);

    store.reopenCompletion(completion?.id ?? 'missing');
    store.undoReview('review-1');
    store.applyServerSnapshot({ milestones: [], pendingMilestones: [] });

    expect(store.earnedAwards).toEqual([]);
    expect(store.prepareCurrentSessionCompletion()).toBeNull();
  });

  it('keeps earned milestones scoped to the signed-in account', () => {
    const first = makeStore('user-1');
    first.applyServerSnapshot({ milestones: [burned100], pendingMilestones: [] });

    expect(makeStore('user-2').earnedAwards).toEqual([]);
    expect(makeStore('user-1').earnedAwards.map(({ id }) => id)).toEqual(['burned100']);
  });
});
