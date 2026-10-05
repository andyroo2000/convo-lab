import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeferred,
  emptyAchievementProgress,
  getAchievementProgressMock,
  setUpStudyReviewSession,
} from './studyReviewSessionTestHarness';
import useStudyAchievementSync from '../useStudyAchievementSync';

describe('useStudyAchievementSync invalidation', () => {
  beforeEach(setUpStudyReviewSession);

  it('clears cached awards and rejects freshness from a response started before Undo', async () => {
    const { result } = renderHook(useStudyAchievementSync);
    await act(async () => {
      await result.current.syncAchievements();
    });
    expect(result.current.hasFreshAchievementProgress(60_000)).toBe(true);
    const oldResponse = createDeferred<typeof emptyAchievementProgress>();
    getAchievementProgressMock.mockReturnValueOnce(oldResponse.promise);
    const request = result.current.syncAchievements();
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(2));

    act(() => result.current.invalidateAchievementProgress());
    await act(async () => {
      oldResponse.resolve(emptyAchievementProgress);
      await request;
    });
    expect(result.current.achievementProgress).toBeNull();
    expect(result.current.hasFreshAchievementProgress(60_000)).toBe(false);

    await act(async () => {
      await result.current.syncAchievements(false);
    });
    expect(getAchievementProgressMock).toHaveBeenLastCalledWith({ evaluate: true });
    expect(result.current.hasFreshAchievementProgress(60_000)).toBe(true);
  });

  it('shares the completion evaluation when exiting while the dirty refresh is pending', async () => {
    const refresh = createDeferred<typeof emptyAchievementProgress>();
    getAchievementProgressMock.mockReturnValueOnce(refresh.promise);
    const { result } = renderHook(useStudyAchievementSync);
    act(() => result.current.invalidateAchievementProgress());
    const completion = result.current.syncAchievements(true, true);
    const exitRefresh = result.current.refreshInvalidatedAchievements();
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      refresh.resolve(emptyAchievementProgress);
      await Promise.all([completion, exitRefresh]);
      await result.current.refreshInvalidatedAchievements();
    });
    expect(getAchievementProgressMock).toHaveBeenCalledTimes(1);
  });

  it('keeps failed invalidations dirty and retries evaluation at the next session baseline', async () => {
    getAchievementProgressMock.mockRejectedValueOnce(new Error('Offline'));
    const { result } = renderHook(useStudyAchievementSync);
    act(() => result.current.invalidateAchievementProgress());
    await expect(result.current.refreshInvalidatedAchievements()).rejects.toThrow('Offline');
    expect(result.current.hasFreshAchievementProgress(60_000)).toBe(false);
    await act(async () => {
      await result.current.syncAchievements(false);
    });
    expect(getAchievementProgressMock).toHaveBeenCalledTimes(2);
    expect(getAchievementProgressMock).toHaveBeenLastCalledWith({ evaluate: true });
    expect(result.current.hasFreshAchievementProgress(60_000)).toBe(true);
  });
});
