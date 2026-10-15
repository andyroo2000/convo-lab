import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  StudyAchievementSessionStore,
  deleteStudyAchievementSessionData,
} from '../studyAchievementSessionModel';
import type { StudySessionReviewRecord } from '../studySessionWrapUpModel';

const awards = [
  { id: 'listening.hour', earnedAt: '2026-10-01T12:00:00Z' },
  { id: 'reviews.hundred', earnedAt: '2026-10-01T13:00:00Z' },
];
const reload = (userId = 'learner') => new StudyAchievementSessionStore(localStorage, userId);
const start = (store: StudyAchievementSessionStore, baseline: typeof awards | null = []) => {
  const id = store.beginReviewSession(baseline)!;
  store.recordReview({ id: `review-${id}` } as StudySessionReviewRecord);
  return { id };
};

beforeEach(() => localStorage.clear());

describe('durable achievement dismissals', () => {
  it('resumes only the remaining badges after skipping one and reloading', () => {
    const store = reload();
    start(store);
    store.prepareCurrentSessionCompletion(awards);
    store.acknowledgeAwards([awards[0].id]);
    expect(reload().prepareInterruptedCompletion(awards)?.newAwardIds).toEqual([awards[1].id]);
  });

  it('keeps skipped awards dismissed when an older page overwrites session state', () => {
    const store = reload();
    start(store);
    store.prepareCurrentSessionCompletion(awards);
    const olderPage = reload();
    store.acknowledgeAwards([awards[0].id]);
    olderPage.prepareCurrentSessionCompletion(awards);
    expect(reload().prepareInterruptedCompletion(awards)?.newAwardIds).toEqual([awards[1].id]);
  });

  it('retains skip-all history across sessions and failed baseline loads', () => {
    const store = reload();
    const reference = start(store);
    store.prepareCurrentSessionCompletion(awards);
    store.markCelebrationPresented(reference);
    store.consumeCompletion(reference.id);
    const next = reload();
    start(next);
    expect(next.prepareInterruptedCompletion(awards)).toBeNull();
  });

  it('does not replay skipped awards after a late deferred response', () => {
    const store = reload();
    const reference = start(store);
    store.prepareCurrentSessionCompletion([]);
    const refresh = store.beginCompletionRefresh(reference)!;
    store.dismissCompletion(reference);
    reload().acknowledgeAwards([awards[0].id]);
    store.completeDeferredRefresh(refresh, awards);
    expect(reload().prepareDeferredCompletion(awards)?.newAwardIds).toEqual([awards[1].id]);
  });

  it('still celebrates genuinely new awards discovered after skip all', () => {
    const store = reload();
    const reference = start(store);
    store.prepareCurrentSessionCompletion([awards[0]]);
    const refresh = store.beginCompletionRefresh(reference)!;
    store.markCelebrationPresented(reference);
    expect(store.completeCurrentRefresh(refresh, awards)).toMatchObject({
      newAwardIds: [awards[1].id],
      celebrationPresented: false,
    });
  });

  it('isolates history by user and removes it only with explicit study-data deletion', () => {
    reload().acknowledgeAwards([awards[0].id]);
    const other = reload('other');
    start(other);
    expect(other.prepareInterruptedCompletion(awards)?.newAwardIds).toEqual(
      awards.map(({ id }) => id)
    );
    deleteStudyAchievementSessionData(localStorage, 'learner');
    const reset = reload();
    start(reset);
    expect(reset.prepareInterruptedCompletion(awards)?.newAwardIds).toHaveLength(2);
  });
});

describe('unavailable initial progress', () => {
  it('does not interpret a failed baseline request as no prior achievements', () => {
    const store = reload();
    const reference = start(store, null);
    store.prepareCurrentSessionCompletion([]);
    const refresh = store.beginCompletionRefresh(reference)!;
    expect(store.completeCurrentRefresh(refresh, awards)?.newAwardIds).toEqual([]);
    expect(reload().prepareInterruptedCompletion(awards)).toBeNull();
  });

  it('does not replay history when recovering a deferred session with no baseline', () => {
    const store = reload();
    const reference = start(store, null);
    store.prepareCurrentSessionCompletion([]);
    store.beginCompletionRefresh(reference);
    store.dismissCompletion(reference);
    expect(reload().prepareDeferredCompletion(awards)).toBeNull();
  });

  it('uses a successful session-start baseline to recognize subsequent awards', () => {
    const store = reload();
    const reference = start(store, null);
    store.refreshCurrentSessionBaseline([awards[0]]);
    const refresh = store.beginCompletionRefresh(reference)!;
    expect(store.completeCurrentRefresh(refresh, awards)?.newAwardIds).toEqual([awards[1].id]);
  });
});

describe('unavailable browser storage', () => {
  it('keeps Skip and Skip all working when storage fills after a session starts', () => {
    const storage = {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: vi.fn((key: string, value: string) => localStorage.setItem(key, value)),
      removeItem: (key: string) => localStorage.removeItem(key),
    };
    const store = new StudyAchievementSessionStore(storage, 'learner');
    const reference = start(store);
    store.prepareCurrentSessionCompletion(awards);
    storage.setItem.mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    store.acknowledgeAwards([awards[0].id]);
    expect(store.prepareInterruptedCompletion(awards)?.newAwardIds).toEqual([awards[1].id]);
    store.markCelebrationPresented(reference);
    expect(store.prepareInterruptedCompletion(awards)?.celebrationPresented).toBe(true);
    store.dismissCompletion(reference);
    expect(store.prepareDeferredCompletion(awards)).toBeNull();
  });

  it('allows studying and dismissing when all storage access fails', () => {
    const unavailable = () => {
      throw new Error('storage disabled');
    };
    const store = new StudyAchievementSessionStore(
      {
        getItem: unavailable,
        setItem: unavailable,
        removeItem: unavailable,
      },
      'learner'
    );
    const reference = start(store);
    store.prepareCurrentSessionCompletion(awards);
    store.markCelebrationPresented(reference);
    store.dismissCompletion(reference);
    expect(store.prepareDeferredCompletion(awards)).toBeNull();
  });
});
