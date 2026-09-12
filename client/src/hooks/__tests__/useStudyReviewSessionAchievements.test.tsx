import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonRequestError } from '../../lib/apiClient';
import type { AchievementProgress } from '../../components/study/achievementModel';
import {
  emptyAchievementProgress,
  setUpStudyReviewSession,
  baseOverview,
  baseCardOne,
  baseCardTwo,
  createWrapper,
  createDeferred,
  startStudySessionMock,
  reviewMutateAsyncMock,
  undoStudyReviewMock,
  getAchievementCatalogMock,
  getAchievementProgressMock,
} from './studyReviewSessionTestHarness';
import useStudyReviewSession from '../useStudyReviewSession';

describe('useStudyReviewSession achievements', () => {
  beforeEach(setUpStudyReviewSession);

  it('does not replay historical server awards without a matching saved session', async () => {
    const award = {
      id: 'burned100' as const,
      earnedAt: '2026-08-25T21:00:00.000Z',
      presentedAt: null,
    };
    getAchievementProgressMock.mockResolvedValue({
      ...emptyAchievementProgress,
      awards: [award],
    });

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalled());
    expect(result.current.currentAchievement).toBeNull();
    expect(result.current.focusMode).toBe(false);
  });

  it('restores only awards committed to the saved achievement session', async () => {
    const burned100 = {
      id: 'burned100' as const,
      earnedAt: '2026-08-25T21:00:00.000Z',
      presentedAt: null,
    };
    const burned500 = {
      id: 'burned500' as const,
      earnedAt: '2026-08-25T22:00:00.000Z',
      presentedAt: null,
    };
    window.localStorage.setItem(
      'convo-lab.study-achievement-sessions-v1.study-review-hook-test-user',
      JSON.stringify({
        activeSession: {
          id: 'presented-session',
          records: [
            {
              id: 'prior-review',
              cardBefore: baseCardOne,
              cardAfter: baseCardOne,
              grade: 'good',
              durationMs: 1_000,
            },
          ],
          baselineAwardIds: [],
          newAwardIds: ['burned.burned100'],
          isReadyForPresentation: true,
          celebrationPresented: true,
        },
      })
    );
    getAchievementProgressMock.mockResolvedValue({
      ...emptyAchievementProgress,
      awards: [
        { id: 'burned.burned100', earnedAt: burned100.earnedAt },
        { id: 'burned.burned500', earnedAt: burned500.earnedAt },
      ],
    });

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.achievementCompletion?.newAwardIds).toEqual(['burned.burned100']);
    });
    expect(getAchievementCatalogMock).toHaveBeenCalledTimes(1);
    expect(getAchievementProgressMock).toHaveBeenCalledTimes(1);
    expect(result.current.completionAchievements.map(({ id }) => id)).toEqual(['burned.burned100']);
  });

  it('does not replace a newly started review with a slow interrupted-session restore', async () => {
    const award = {
      id: 'burned100' as const,
      earnedAt: '2026-08-25T21:00:00.000Z',
      presentedAt: null,
    };
    window.localStorage.setItem(
      'convo-lab.study-achievement-sessions-v1.study-review-hook-test-user',
      JSON.stringify({
        activeSession: {
          id: 'interrupted-session',
          records: [
            {
              id: 'prior-review',
              cardBefore: baseCardOne,
              cardAfter: baseCardOne,
              grade: 'good',
              durationMs: 1_000,
            },
          ],
          baselineAwardIds: [],
          newAwardIds: [],
          isReadyForPresentation: false,
          celebrationPresented: false,
        },
      })
    );
    const deferredRestore = createDeferred<AchievementProgress>();
    getAchievementProgressMock
      .mockReturnValueOnce(deferredRestore.promise)
      .mockResolvedValueOnce(emptyAchievementProgress);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(1));

    let enterPromise: Promise<void> | undefined;
    act(() => {
      enterPromise = result.current.enterFocusMode();
    });
    expect(result.current.focusMode).toBe(true);

    await act(async () => {
      deferredRestore.resolve({
        ...emptyAchievementProgress,
        awards: [{ id: 'burned.burned100', earnedAt: award.earnedAt }],
      });
      await enterPromise;
    });

    expect(result.current.currentCard?.id).toBe('card-1');
    expect(result.current.achievementCompletion).toBeNull();
    expect(result.current.currentAchievement).toBeNull();
  });

  it('loads the first review card without waiting for an in-flight achievement bootstrap', async () => {
    const deferredProgress = createDeferred<AchievementProgress>();
    getAchievementProgressMock.mockReturnValue(deferredProgress.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(1));

    let enterPromise!: Promise<void>;
    act(() => {
      enterPromise = result.current.enterFocusMode();
    });

    expect(result.current.focusMode).toBe(true);
    expect(result.current.sessionLoading).toBe(true);
    expect(result.current.currentCard).toBeNull();
    expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    expect(getAchievementProgressMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await enterPromise;
    });

    expect(getAchievementProgressMock).toHaveBeenCalledTimes(1);
    expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    expect(result.current.currentCard?.id).toBe('card-1');
    expect(result.current.sessionLoading).toBe(false);

    await act(async () => {
      deferredProgress.resolve(emptyAchievementProgress);
      await deferredProgress.promise;
    });
  });

  it('preserves a review completed before the achievement bootstrap finishes', async () => {
    const deferredProgress = createDeferred<AchievementProgress>();
    getAchievementProgressMock.mockReturnValue(deferredProgress.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });

    const persistedBeforeBootstrap = JSON.parse(
      window.localStorage.getItem(
        'convo-lab.study-achievement-sessions-v1.study-review-hook-test-user'
      ) ?? '{}'
    ) as { activeSession?: { records?: Array<{ id?: string }> } };
    expect(persistedBeforeBootstrap.activeSession?.records?.map(({ id }) => id)).toEqual([
      'review-log-1',
    ]);

    await act(async () => {
      deferredProgress.resolve(emptyAchievementProgress);
      await deferredProgress.promise;
    });

    await waitFor(() => {
      const persisted = JSON.parse(
        window.localStorage.getItem(
          'convo-lab.study-achievement-sessions-v1.study-review-hook-test-user'
        ) ?? '{}'
      ) as { activeSession?: { records?: Array<{ id?: string }> } };
      expect(persisted.activeSession?.records?.map(({ id }) => id)).toEqual(['review-log-1']);
    });
  });

  it('does not create an achievement session after focus mode exits during bootstrap', async () => {
    const deferredProgress = createDeferred<AchievementProgress>();
    getAchievementProgressMock.mockReturnValue(deferredProgress.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => result.current.exitFocusMode());

    await act(async () => {
      deferredProgress.resolve(emptyAchievementProgress);
      await deferredProgress.promise;
    });

    expect(
      JSON.parse(
        window.localStorage.getItem(
          'convo-lab.study-achievement-sessions-v1.study-review-hook-test-user'
        ) ?? '{}'
      ).activeSession
    ).toBeNull();
  });

  it('does not refetch loaded achievement progress at every review session start', async () => {
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(result.current.achievementProgress).toEqual(emptyAchievementProgress)
    );

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => {
      result.current.exitFocusMode();
    });
    await act(async () => {
      await result.current.enterFocusMode();
    });

    expect(getAchievementProgressMock).toHaveBeenCalledTimes(1);
    expect(startStudySessionMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes stale achievement progress before capturing a review-session baseline', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const refreshedProgress = {
      ...emptyAchievementProgress,
      awards: [{ id: 'burned.burned100', earnedAt: '2026-08-25T21:00:00.000Z' }],
    };
    getAchievementProgressMock
      .mockResolvedValueOnce(emptyAchievementProgress)
      .mockResolvedValueOnce(refreshedProgress);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(result.current.achievementProgress).toEqual(emptyAchievementProgress)
    );
    now += 60_001;

    await act(async () => {
      await result.current.enterFocusMode();
    });

    expect(getAchievementProgressMock).toHaveBeenCalledTimes(2);
    expect(getAchievementProgressMock).toHaveBeenLastCalledWith({ evaluate: false });
    expect(result.current.currentCard?.id).toBe('card-1');
    await waitFor(() => expect(result.current.achievementProgress).toEqual(refreshedProgress));
  });

  it('replaces an in-flight achievement bootstrap with the conflict-recovery baseline', async () => {
    const deferredProgress = createDeferred<AchievementProgress>();
    const recoveredProgress: AchievementProgress = {
      ...emptyAchievementProgress,
      awards: [
        {
          id: 'burned.burned100',
          earnedAt: '2026-08-25T21:00:00.000Z',
        },
      ],
    };
    getAchievementProgressMock
      .mockReturnValueOnce(deferredProgress.promise)
      .mockResolvedValueOnce(recoveredProgress);
    reviewMutateAsyncMock.mockRejectedValueOnce(
      new JsonRequestError('Review is out of order. (409)', 409, {
        code: 'review_out_of_order',
      })
    );

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => result.current.revealCurrentCard());

    let conflictPromise!: Promise<void>;
    act(() => {
      conflictPromise = result.current.handleGrade('good');
    });
    await waitFor(() => expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      deferredProgress.resolve(emptyAchievementProgress);
      await conflictPromise;
    });

    expect(getAchievementProgressMock).toHaveBeenCalledTimes(2);
    expect(startStudySessionMock).toHaveBeenCalledTimes(2);
    expect(result.current.reviewConflictRecovered).toBe(true);

    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(
        'convo-lab.study-achievement-sessions-v1.study-review-hook-test-user'
      ) ?? '{}'
    ) as {
      activeSession?: { baselineAwardIds?: string[]; records?: Array<{ id?: string }> };
    };
    expect(persisted.activeSession?.baselineAwardIds).toEqual(['burned.burned100']);
    expect(persisted.activeSession?.records?.map(({ id }) => id)).toEqual(['review-log-1']);
  });

  it('preserves an achievement crossed before a later review conflict', async () => {
    const masterySpread = {
      apprentice: 0,
      guru: 0,
      master: 0,
      enlightened: 1,
      burned: 99,
    };
    startStudySessionMock.mockResolvedValue({
      overview: { ...baseOverview, masterySpread },
      cards: [baseCardOne, baseCardTwo],
    });
    reviewMutateAsyncMock
      .mockResolvedValueOnce({
        reviewLogId: 'review-burned-100',
        card: { ...baseCardOne, masteryLevel: 'burned' },
        overview: {
          ...baseOverview,
          masterySpread: { ...masterySpread, enlightened: 0, burned: 100 },
        },
      })
      .mockRejectedValueOnce(
        new JsonRequestError('Review is out of order. (409)', 409, {
          code: 'review_out_of_order',
        })
      );
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    getAchievementProgressMock.mockResolvedValue({
      ...emptyAchievementProgress,
      metricValues: { 'mastery.burned': 100 },
      awards: [{ id: 'burned.burned100', earnedAt: '2026-08-25T12:00:00.000Z' }],
    });
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.setMasteryAnimation(null));
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });

    expect(result.current.currentAchievement?.id).toBe('burned.burned100');
    expect(result.current.achievementCompletion?.records.map(({ id }) => id)).toEqual([
      'review-burned-100',
    ]);
  });

  it('shows wrap-up and allows undo while achievements refresh in the background', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: { ...baseOverview, dueCount: 1, reviewCount: 1, totalCards: 1 },
      cards: [baseCardOne],
    });
    reviewMutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-log-1',
      card: baseCardOne,
      overview: { ...baseOverview, dueCount: 0, reviewCount: 0 },
    });
    const deferredEvaluation = createDeferred<AchievementProgress>();

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    getAchievementProgressMock.mockReturnValueOnce(deferredEvaluation.promise);
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.setMasteryAnimation(null));

    await waitFor(() => expect(result.current.reviewSessionComplete).toBe(true));
    expect(result.current.sessionLoading).toBe(false);
    expect(getAchievementProgressMock).toHaveBeenLastCalledWith({ evaluate: true });

    let undoPromise!: Promise<void>;
    act(() => {
      undoPromise = result.current.handleUndo();
    });
    await waitFor(() => expect(undoStudyReviewMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      deferredEvaluation.resolve(emptyAchievementProgress);
      await undoPromise;
    });
    expect(result.current.reviewSessionComplete).toBe(false);
  });

  it.each([
    { name: 'no awards', awards: [] },
    {
      name: 'a late award',
      awards: [{ id: 'burned.burned100', earnedAt: '2026-09-02T00:00:00.000Z' }],
    },
  ])('allows Done immediately and recovers $name on the next visit', async ({ awards }) => {
    startStudySessionMock.mockResolvedValue({
      overview: { ...baseOverview, dueCount: 1, reviewCount: 1, totalCards: 1 },
      cards: [baseCardOne],
    });
    reviewMutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-log-1',
      card: baseCardOne,
      overview: { ...baseOverview, dueCount: 0, reviewCount: 0 },
    });
    const deferredEvaluation = createDeferred<AchievementProgress>();

    const { result, unmount } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    getAchievementProgressMock.mockReturnValueOnce(deferredEvaluation.promise);
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.setMasteryAnimation(null));

    await waitFor(() => expect(result.current.achievementCompletionRefreshPending).toBe(true));
    act(() => result.current.finishReviewSession());

    expect(result.current.focusMode).toBe(false);
    expect(
      JSON.parse(
        window.localStorage.getItem(
          'convo-lab.study-achievement-sessions-v1.study-review-hook-test-user'
        ) ?? '{}'
      ).activeSession
    ).toBeNull();

    expect(
      JSON.parse(
        window.localStorage.getItem(
          'convo-lab.study-deferred-achievements-v1.study-review-hook-test-user'
        ) ?? '[]'
      )
    ).toHaveLength(1);

    await act(async () => {
      deferredEvaluation.resolve({ ...emptyAchievementProgress, awards });
      await deferredEvaluation.promise;
    });
    await waitFor(() => expect(result.current.achievementCompletionRefreshPending).toBe(false));
    act(() => result.current.finishReviewSession());

    expect(result.current.focusMode).toBe(false);
    expect(
      JSON.parse(
        window.localStorage.getItem(
          'convo-lab.study-achievement-sessions-v1.study-review-hook-test-user'
        ) ?? '{}'
      ).activeSession
    ).toBeNull();
    unmount();
    getAchievementProgressMock.mockResolvedValue({ ...emptyAchievementProgress, awards });
    const { result: nextVisit } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(3));
    if (awards.length > 0) {
      await waitFor(() => expect(nextVisit.current.currentAchievement?.id).toBe(awards[0].id));
      expect(nextVisit.current.achievementCompletion?.records).toEqual([]);
      act(() => nextVisit.current.advanceAchievement());
    }
    expect(nextVisit.current.focusMode).toBe(false);
    expect(
      JSON.parse(
        window.localStorage.getItem(
          'convo-lab.study-deferred-achievements-v1.study-review-hook-test-user'
        ) ?? '[]'
      )
    ).toEqual([]);
  });

  it('keeps the newest completion refresh authoritative after undo and re-ending', async () => {
    reviewMutateAsyncMock
      .mockResolvedValueOnce({
        reviewLogId: 'review-log-1',
        card: baseCardOne,
        overview: { ...baseOverview, dueCount: 1, reviewCount: 1 },
      })
      .mockResolvedValueOnce({
        reviewLogId: 'review-log-2',
        card: baseCardTwo,
        overview: { ...baseOverview, dueCount: 0, reviewCount: 0 },
      });
    undoStudyReviewMock.mockResolvedValue({
      reviewLogId: 'review-log-2',
      card: baseCardTwo,
      overview: { ...baseOverview, dueCount: 1, reviewCount: 1 },
    });
    const firstEvaluation = createDeferred<AchievementProgress>();
    const postUndoEvaluation = createDeferred<AchievementProgress>();
    const latestCompletionEvaluation = createDeferred<AchievementProgress>();

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    getAchievementProgressMock
      .mockReturnValueOnce(firstEvaluation.promise)
      .mockReturnValueOnce(postUndoEvaluation.promise)
      .mockReturnValueOnce(latestCompletionEvaluation.promise);

    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.setMasteryAnimation(null));
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.setMasteryAnimation(null));

    await waitFor(() => expect(result.current.reviewSessionComplete).toBe(true));

    let undoPromise!: Promise<void>;
    act(() => {
      undoPromise = result.current.handleUndo();
    });
    await waitFor(() => expect(result.current.reviewSessionComplete).toBe(false));

    act(() => result.current.endReviewSession());
    await waitFor(() => expect(result.current.reviewSessionComplete).toBe(true));

    await act(async () => {
      firstEvaluation.resolve(emptyAchievementProgress);
      await firstEvaluation.promise;
    });
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(3));
    await act(async () => {
      postUndoEvaluation.resolve(emptyAchievementProgress);
      await undoPromise;
    });
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(4));

    await act(async () => {
      latestCompletionEvaluation.resolve({
        ...emptyAchievementProgress,
        metricValues: { 'mastery.burned': 100 },
        awards: [
          {
            id: 'burned.burned100',
            earnedAt: '2026-08-31T18:00:00.000Z',
          },
        ],
      });
      await latestCompletionEvaluation.promise;
    });

    await waitFor(() => {
      expect(result.current.achievementCompletion?.newAwardIds).toEqual(['burned.burned100']);
    });
  });
});
