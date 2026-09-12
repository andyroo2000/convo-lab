import { beforeEach, describe, expect, it } from 'vitest';

import {
  StudyAchievementSessionStore,
  deleteStudyAchievementSessionData,
  studyAchievementSessionStorageKey,
} from '../studyAchievementSessionModel';
import { deferredAchievementStorageKey } from '../studyDeferredAchievements';
import type { StudySessionReviewRecord } from '../studySessionWrapUpModel';

const firstAward = { id: 'reviews.first', earnedAt: '2026-09-12T12:00:00.000Z' };
const secondAward = { id: 'reviews.second', earnedAt: '2026-09-12T12:01:00.000Z' };

describe('deferred achievement completion', () => {
  let store: StudyAchievementSessionStore;
  let nextId: number;

  beforeEach(() => {
    localStorage.clear();
    nextId = 0;
    store = new StudyAchievementSessionStore(localStorage, 'learner', {
      createId: () => {
        nextId += 1;
        return `session-${nextId}`;
      },
    });
  });

  const finishSession = () => {
    const id = store.beginReviewSession([])!;
    store.recordReview({ id: `review-${id}` } as StudySessionReviewRecord);
    store.prepareCurrentSessionCompletion([]);
    return store.beginCompletionRefresh({ id })!;
  };

  const reload = () => new StudyAchievementSessionStore(localStorage, 'learner');

  it('keeps late awards after Done and reload without reopening the old summary', () => {
    const refresh = finishSession();
    store.dismissCompletion({ id: refresh.sessionId });
    const reloaded = reload();
    store.completeDeferredRefresh(refresh, [firstAward]);

    expect(reloaded.prepareDeferredCompletion([firstAward])).toMatchObject({
      id: refresh.sessionId,
      records: [],
      newAwardIds: [firstAward.id],
      celebrationPresented: false,
    });
    reloaded.markCelebrationPresented({ id: refresh.sessionId });
    expect(reload().prepareDeferredCompletion([firstAward])).toBeNull();
  });

  it('does not replace a new session when an older response arrives', () => {
    const first = finishSession();
    store.dismissCompletion({ id: first.sessionId });
    const second = finishSession();
    store.completeDeferredRefresh(first, [firstAward]);

    expect(store.prepareCurrentSessionCompletion([])).toMatchObject({
      id: second.sessionId,
      records: [{ id: `review-${second.sessionId}` }],
      newAwardIds: [],
    });
    expect(reload().prepareDeferredCompletion([firstAward])?.id).toBe(first.sessionId);
    store.refreshCurrentSessionBaseline([firstAward]);
    expect(store.prepareInterruptedCompletion([firstAward, secondAward])).toMatchObject({
      id: second.sessionId,
      records: [{ id: `review-${second.sessionId}` }],
      newAwardIds: [secondAward.id],
    });
  });

  it('ignores an obsolete response after undo, re-ending, and Done', () => {
    const first = finishSession();
    store.reopenCompletion({ id: first.sessionId }, []);
    store.prepareCurrentSessionCompletion([]);
    const latest = store.beginCompletionRefresh({ id: first.sessionId })!;
    store.dismissCompletion({ id: latest.sessionId });
    store.completeDeferredRefresh(first, [firstAward]);

    const pending = JSON.parse(localStorage.getItem(deferredAchievementStorageKey('learner'))!);
    expect(pending[0]).toMatchObject({
      revision: latest.revision,
      needsRefresh: true,
      newAwardIds: [],
    });
    store.completeDeferredRefresh(latest, [secondAward]);
    expect(reload().prepareDeferredCompletion([firstAward, secondAward])?.newAwardIds).toEqual([
      secondAward.id,
    ]);
  });

  it('recovers after a failed request using the next visit’s successful evaluation', () => {
    const refresh = finishSession();
    // No completion callback ran because the request failed.
    store.dismissCompletion({ id: refresh.sessionId });
    expect(reload().prepareDeferredCompletion([firstAward])?.newAwardIds).toEqual([firstAward.id]);
  });

  it('applies a late session-start baseline to the deferred session', () => {
    const refresh = finishSession();
    store.dismissCompletion({ id: refresh.sessionId });
    store.refreshDeferredBaseline({ id: refresh.sessionId }, [firstAward]);
    store.completeDeferredRefresh(refresh, [firstAward, secondAward]);
    expect(reload().prepareDeferredCompletion([firstAward, secondAward])?.newAwardIds).toEqual([
      secondAward.id,
    ]);
  });

  it('does not present the same award from multiple pending sessions', () => {
    const first = finishSession();
    store.dismissCompletion({ id: first.sessionId });
    const second = finishSession();
    store.dismissCompletion({ id: second.sessionId });
    const reloaded = reload();
    expect(reloaded.prepareDeferredCompletion([firstAward])?.id).toBe(first.sessionId);
    reloaded.markCelebrationPresented({ id: first.sessionId });
    expect(reload().prepareDeferredCompletion([firstAward])).toBeNull();
  });

  it('removes a successfully evaluated completion with no new awards', () => {
    const refresh = finishSession();
    store.completeCurrentRefresh(refresh, []);
    store.dismissCompletion({ id: refresh.sessionId });
    expect(JSON.parse(localStorage.getItem(deferredAchievementStorageKey('learner'))!)).toEqual([]);
    expect(reload().prepareDeferredCompletion([firstAward])).toBeNull();
  });

  it('keeps deferred awards isolated by user and clears them with study data', () => {
    const refresh = finishSession();
    store.dismissCompletion({ id: refresh.sessionId });
    const anotherUser = new StudyAchievementSessionStore(localStorage, 'another-learner');
    expect(anotherUser.prepareDeferredCompletion([firstAward])).toBeNull();
    deleteStudyAchievementSessionData(localStorage, 'learner');
    expect(reload().prepareDeferredCompletion([firstAward])).toBeNull();
  });

  it('only presents newly discovered awards after an earlier celebration', () => {
    const refresh = finishSession();
    store.prepareCurrentSessionCompletion([firstAward]);
    store.markCelebrationPresented({ id: refresh.sessionId });
    expect(store.completeCurrentRefresh(refresh, [firstAward, secondAward])).toMatchObject({
      newAwardIds: [secondAward.id],
      celebrationPresented: false,
    });
  });

  it('keeps legacy completed celebrations frozen after upgrading and leaving', () => {
    localStorage.setItem(
      studyAchievementSessionStorageKey('learner'),
      JSON.stringify({
        activeSession: {
          id: 'legacy-session',
          records: [{ id: 'review-1' }],
          baselineAwardIds: [],
          newAwardIds: [firstAward.id],
          celebrationPresented: true,
          isReadyForPresentation: true,
        },
      })
    );
    const reloaded = reload();
    expect(reloaded.prepareInterruptedCompletion([firstAward, secondAward])?.newAwardIds).toEqual([
      firstAward.id,
    ]);
    reloaded.dismissCompletion({ id: 'legacy-session' });
    expect(reload().prepareDeferredCompletion([firstAward, secondAward])).toBeNull();
  });
});
