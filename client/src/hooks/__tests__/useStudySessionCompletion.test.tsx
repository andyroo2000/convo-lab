import { act, renderHook, waitFor } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { StudyAchievementSessionStore } from '../../components/study/studyAchievementSessionModel';
import useStudySessionCompletion from '../useStudySessionCompletion';

type CompletionOptions = Parameters<typeof useStudySessionCompletion>[0];

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createOptions = (overrides: Partial<CompletionOptions> = {}): CompletionOptions => ({
  achievementAwards: [],
  achievementCompletion: null,
  achievementCompletionRequestIdRef: { current: 0 },
  achievementSessionStore: {
    prepareCurrentSessionCompletion: vi.fn().mockReturnValue(null),
  } as unknown as StudyAchievementSessionStore,
  activeAchievementCompletionRequestRef: { current: null },
  masteryAnimation: null,
  reviewQueueExhausted: true,
  runBackgroundTask: vi.fn(),
  sessionEpochRef: { current: 1 },
  setAchievementCelebrationPresented: vi.fn(),
  setAchievementCompletion: vi.fn(),
  setAchievementCompletionRefreshPending: vi.fn(),
  setCurrentAchievementIndex: vi.fn(),
  setSessionWasEnded: vi.fn(),
  syncAchievements: vi.fn().mockResolvedValue({
    catalog: {} as never,
    progress: { revision: '1', metricValues: {}, awards: [] },
  }),
  ...overrides,
});

describe('useStudySessionCompletion', () => {
  it('does not start another completion refresh when only achievement awards change', async () => {
    const refresh = createDeferred<Awaited<ReturnType<CompletionOptions['syncAchievements']>>>();
    const syncAchievements = vi.fn().mockReturnValue(refresh.promise);
    const prepareCurrentSessionCompletion = vi.fn().mockReturnValue(null);
    const options = createOptions({
      achievementSessionStore: {
        prepareCurrentSessionCompletion,
      } as unknown as StudyAchievementSessionStore,
      syncAchievements,
    });
    const { rerender } = renderHook(
      ({ currentOptions }) => useStudySessionCompletion(currentOptions),
      { initialProps: { currentOptions: options } }
    );

    expect(syncAchievements).toHaveBeenCalledTimes(1);

    await act(async () => {
      refresh.resolve({
        catalog: {} as never,
        progress: { revision: '2', metricValues: {}, awards: [] },
      });
      await refresh.promise;
    });

    rerender({
      currentOptions: {
        ...options,
        achievementAwards: [{ id: 'new-award', earnedAt: '2026-09-02T00:00:00.000Z' }],
      },
    });

    await waitFor(() => expect(prepareCurrentSessionCompletion).toHaveBeenCalledTimes(2));
    expect(syncAchievements).toHaveBeenCalledTimes(1);
  });

  it('ignores a refreshed completion after the session epoch changes', async () => {
    const refresh = createDeferred<Awaited<ReturnType<CompletionOptions['syncAchievements']>>>();
    const sessionEpochRef: MutableRefObject<number> = { current: 1 };
    const initialCompletion = {
      id: 'completion-1',
      records: [],
      newAwardIds: [],
      celebrationPresented: false,
    };
    const refreshedCompletion = { ...initialCompletion, newAwardIds: ['award-1'] };
    const prepareCurrentSessionCompletion = vi
      .fn()
      .mockReturnValueOnce(initialCompletion)
      .mockReturnValueOnce(refreshedCompletion);
    const setAchievementCompletion = vi.fn();
    const options = createOptions({
      achievementSessionStore: {
        prepareCurrentSessionCompletion,
      } as unknown as StudyAchievementSessionStore,
      sessionEpochRef,
      setAchievementCompletion,
      syncAchievements: vi.fn().mockReturnValue(refresh.promise),
    });
    renderHook(() => useStudySessionCompletion(options));

    sessionEpochRef.current = 2;
    await act(async () => {
      refresh.resolve({
        catalog: {} as never,
        progress: {
          revision: '2',
          metricValues: {},
          awards: [{ id: 'award-1', earnedAt: '2026-09-02T00:00:00.000Z' }],
        },
      });
      await refresh.promise;
    });

    expect(setAchievementCompletion).toHaveBeenCalledTimes(1);
    expect(setAchievementCompletion).toHaveBeenCalledWith(initialCompletion);
    expect(prepareCurrentSessionCompletion).toHaveBeenCalledTimes(1);
  });
});
