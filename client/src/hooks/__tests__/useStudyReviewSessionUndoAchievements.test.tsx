import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  baseCardOne,
  baseOverview,
  createDeferred,
  createWrapper,
  emptyAchievementProgress,
  getAchievementProgressMock,
  reviewMutateAsyncMock,
  setUpStudyReviewSession,
  undoStudyReviewMock,
} from './studyReviewSessionTestHarness';
import useStudyReviewSession from '../useStudyReviewSession';

const startReview = async () => {
  const { result, unmount } = renderHook(useStudyReviewSession, { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.achievementProgress).not.toBeNull());
  await act(async () => {
    await result.current.enterFocusMode();
  });
  return { result, unmount };
};

const rateFirstCard = async (result: { current: ReturnType<typeof useStudyReviewSession> }) => {
  act(() => result.current.revealCurrentCard());
  await act(async () => {
    await result.current.handleGrade('good');
  });
  act(() => result.current.setMasteryAnimation(null));
};

const rateThenUndo = async (result: { current: ReturnType<typeof useStudyReviewSession> }) => {
  await rateFirstCard(result);
  await act(async () => {
    await result.current.handleUndo();
  });
  expect(result.current.currentCard?.id).toBe('card-1');
  expect(result.current.reviewBusy).toBe(false);
};

describe('batched achievements after review Undo', () => {
  beforeEach(setUpStudyReviewSession);

  it('evaluates once at completion after repeated Undo and re-rating', async () => {
    reviewMutateAsyncMock.mockImplementation(async () => ({
      reviewLogId: `review-${reviewMutateAsyncMock.mock.calls.length}`,
      card: baseCardOne,
      overview: baseOverview,
    }));
    const { result } = await startReview();
    await rateThenUndo(result);
    await rateThenUndo(result);
    await rateThenUndo(result);
    expect(undoStudyReviewMock).toHaveBeenCalledTimes(3);
    expect(getAchievementProgressMock).toHaveBeenCalledTimes(1);
    await rateFirstCard(result);
    act(() => result.current.endReviewSession());
    await waitFor(() => expect(result.current.achievementCompletionRefreshPending).toBe(false));
    expect(getAchievementProgressMock).toHaveBeenCalledTimes(2);
    expect(getAchievementProgressMock).toHaveBeenLastCalledWith({ evaluate: true });
    expect(result.current.achievementCompletion?.records.map(({ id }) => id)).toEqual(['review-4']);
  });

  it('refreshes on exit even when every review was undone and never blocks leaving', async () => {
    const { result } = await startReview();
    await rateFirstCard(result);
    await act(async () => {
      await result.current.handleUndo();
    });
    const refresh = createDeferred<typeof emptyAchievementProgress>();
    getAchievementProgressMock.mockReturnValueOnce(refresh.promise);
    act(() => result.current.endReviewSession());
    expect(result.current.focusMode).toBe(false);
    expect(result.current.achievementCompletion).toBeNull();
    await waitFor(() => expect(getAchievementProgressMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      refresh.resolve(emptyAchievementProgress);
      await refresh.promise;
    });
    expect(result.current.achievementProgress).toEqual(emptyAchievementProgress);
  });

  it('reconciles an interrupted session on the next visit after Undo', async () => {
    const { result, unmount } = await startReview();
    await rateFirstCard(result);
    await act(async () => {
      await result.current.handleUndo();
    });
    expect(getAchievementProgressMock).toHaveBeenCalledTimes(1);
    unmount();
    const { result: nextVisit } = renderHook(useStudyReviewSession, { wrapper: createWrapper() });
    await waitFor(() => expect(nextVisit.current.achievementProgress).not.toBeNull());
    expect(getAchievementProgressMock).toHaveBeenCalledTimes(2);
    expect(getAchievementProgressMock).toHaveBeenLastCalledWith({ evaluate: true });
    expect(nextVisit.current.currentAchievement).toBeNull();
    expect(nextVisit.current.focusMode).toBe(false);
  });
});
