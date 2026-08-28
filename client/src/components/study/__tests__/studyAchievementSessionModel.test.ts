import { beforeEach, describe, expect, it } from 'vitest';

import {
  StudyAchievementSessionStore,
  type StudyAchievementSessionStorage,
} from '../studyAchievementSessionModel';
import type { StudySessionReviewRecord } from '../studySessionWrapUpModel';

class MemoryStorage implements StudyAchievementSessionStorage {
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

const record = (id: string) => ({ id }) as StudySessionReviewRecord;
const awards = [
  { id: 'reviews.first', earnedAt: '2026-08-28T12:00:00.000Z' },
  { id: 'voice.first', earnedAt: '2026-08-28T12:01:00.000Z' },
];

describe('StudyAchievementSessionStore', () => {
  let storage: MemoryStorage;
  let store: StudyAchievementSessionStore;

  beforeEach(() => {
    storage = new MemoryStorage();
    store = new StudyAchievementSessionStore(storage, 'user-1', {
      createId: () => 'session-1',
    });
  });

  it('captures every award earned after the session baseline in earned order', () => {
    store.beginReviewSession([]);
    store.recordReview(record('review-1'));

    expect(store.prepareCurrentSessionCompletion(awards)).toMatchObject({
      id: 'session-1',
      newAwardIds: ['reviews.first', 'voice.first'],
      records: [{ id: 'review-1' }],
      celebrationPresented: false,
    });
  });

  it('restores an interrupted qualifying session as celebration then wrap-up', () => {
    store.beginReviewSession([]);
    store.recordReview(record('review-1'));

    const reloaded = new StudyAchievementSessionStore(storage, 'user-1');
    expect(reloaded.prepareInterruptedCompletion(awards)?.newAwardIds).toEqual([
      'reviews.first',
      'voice.first',
    ]);
  });

  it('does not replay server history when there is no saved review session', () => {
    expect(store.prepareInterruptedCompletion(awards)).toBeNull();
  });

  it('adds an award discovered after an offline wrap-up was prepared', () => {
    store.beginReviewSession([]);
    store.recordReview(record('review-1'));
    expect(store.prepareCurrentSessionCompletion([])?.newAwardIds).toEqual([]);
    expect(store.prepareInterruptedCompletion(awards)?.newAwardIds).toEqual([
      'reviews.first',
      'voice.first',
    ]);
  });
});
