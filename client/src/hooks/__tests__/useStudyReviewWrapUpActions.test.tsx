import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StudyAchievementSessionStore } from '../../components/study/studyAchievementSessionModel';
import type { StudySessionReviewRecord } from '../../components/study/studySessionWrapUpModel';
import useStudyReviewWrapUpActions from '../useStudyReviewWrapUpActions';

const awards = [
  { id: 'listening.hour', earnedAt: '2026-10-01T12:00:00Z' },
  { id: 'reviews.hundred', earnedAt: '2026-10-01T13:00:00Z' },
];

const setUp = (deferred: boolean) => {
  const store = new StudyAchievementSessionStore(localStorage, 'learner');
  store.beginReviewSession([]);
  store.recordReview({ id: 'review-1' } as StudySessionReviewRecord);
  let completion = store.prepareCurrentSessionCompletion(awards)!;
  if (deferred) {
    store.dismissCompletion(completion);
    completion = store.prepareDeferredCompletion(awards)!;
  }
  const options = {
    achievementCompletion: completion,
    achievementCompletionRefreshPending: false,
    achievementSessionStore: store,
    completionAchievementCount: 2,
    currentAchievementIndex: 0,
    currentAchievementId: awards[0].id,
    exitFocusMode: vi.fn(),
    exitPracticeMode: vi.fn(),
    prepareSessionCompletion: vi.fn(),
    practiceMode: false,
    sessionKind: 'reviews' as const,
    sessionReviewRecordCount: 1,
    setAchievementCelebrationPresented: vi.fn(),
    setCurrentAchievementIndex: vi.fn(),
  };
  return { options, store };
};

beforeEach(() => localStorage.clear());

describe.each([false, true])('achievement wrap-up actions (deferred: %s)', (deferred) => {
  it('saves each individual advance before the animation queue finishes', () => {
    const { options } = setUp(deferred);
    const { result } = renderHook(() => useStudyReviewWrapUpActions(options));
    act(() => result.current.advanceAchievement());
    expect(options.setCurrentAchievementIndex).toHaveBeenCalledOnce();
    const reloaded = new StudyAchievementSessionStore(localStorage, 'learner');
    const pending = deferred
      ? reloaded.prepareDeferredCompletion(awards)
      : reloaded.prepareInterruptedCompletion(awards);
    expect(pending?.newAwardIds).toEqual([awards[1].id]);
  });

  it('skips the whole queue and immediately exits recovered notifications', () => {
    const { options } = setUp(deferred);
    const { result } = renderHook(() => useStudyReviewWrapUpActions(options));
    act(() => result.current.skipAllAchievements());
    expect(options.setAchievementCelebrationPresented).toHaveBeenCalledWith(true);
    expect(options.exitFocusMode).toHaveBeenCalledTimes(deferred ? 1 : 0);
    const reloaded = new StudyAchievementSessionStore(localStorage, 'learner');
    expect(reloaded.prepareDeferredCompletion(awards)).toBeNull();
    if (!deferred) {
      expect(reloaded.prepareInterruptedCompletion(awards)?.celebrationPresented).toBe(true);
    }
  });
});
