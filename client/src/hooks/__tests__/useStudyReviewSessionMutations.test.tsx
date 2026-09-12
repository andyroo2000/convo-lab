import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { JsonRequestError } from '../../lib/apiClient';
import StudyReviewIdentityMismatchError from '../../lib/studyReviewIdentityMismatch';
import {
  setUpStudyReviewSession,
  baseOverview,
  baseCardOne,
  baseCardTwo,
  createWrapper,
  createDeferred,
  cardActionMutateAsyncMock,
  createStudyReviewRequestMock,
  startStudyLessonMock,
  startStudyIntroductionCohortLessonMock,
  startStudySessionMock,
  reviewMutateAsyncMock,
  undoStudyReviewMock,
} from './studyReviewSessionTestHarness';
import useStudyReviewSession from '../useStudyReviewSession';

describe('useStudyReviewSession mutations', () => {
  beforeEach(setUpStudyReviewSession);

  it('restores the previous revealed card after grade then undo', async () => {
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => {
      result.current.revealCurrentCard();
    });

    await act(async () => {
      await result.current.handleGrade('good');
    });
    expect(result.current.currentCard?.id).toBe('card-2');
    expect(result.current.revealed).toBe(false);

    act(() => {
      result.current.setMasteryAnimation(null);
    });
    await act(async () => {
      await result.current.handleUndo();
    });

    expect(result.current.currentCard?.id).toBe('card-1');
    expect(result.current.revealed).toBe(true);
    expect(startStudySessionMock).toHaveBeenCalledWith();
    expect(undoStudyReviewMock).toHaveBeenCalledWith('review-log-1');
  });

  it('reuses the exact review identity and timestamp after an ambiguous lost response', async () => {
    reviewMutateAsyncMock
      .mockRejectedValueOnce(new TypeError('Network connection lost'))
      .mockImplementationOnce(async (payload: { clientReviewId: string }) => ({
        reviewLogId: payload.clientReviewId,
        card: baseCardOne,
        overview: baseOverview,
      }));
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => result.current.revealCurrentCard());

    await act(async () => {
      try {
        await result.current.handleGrade('good');
      } catch (error) {
        expect(error).toEqual(new TypeError('Network connection lost'));
      }
    });
    await waitFor(() => expect(result.current.reviewRetryAvailable).toBe(true));
    await act(async () => {
      await result.current.retryPendingReview();
    });

    expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(2);
    expect(createStudyReviewRequestMock).toHaveBeenCalledTimes(1);
    const firstPayload = reviewMutateAsyncMock.mock.calls[0]?.[0];
    const retryPayload = reviewMutateAsyncMock.mock.calls[1]?.[0];
    expect(retryPayload).toEqual(firstPayload);
    expect(firstPayload).toMatchObject({
      cardId: 'card-1',
      grade: 'good',
      clientReviewId: expect.stringMatching(/^[0-9a-hjkmnp-tv-z]{26}$/),
      reviewedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    expect(result.current.masteryAnimation?.id).toBe(firstPayload.clientReviewId);
  });

  it('discards an ambiguous review identity when the user exits the session', async () => {
    const replacementCard = {
      ...baseCardTwo,
      id: 'card-replacement',
      noteId: 'note-replacement',
    };
    startStudySessionMock
      .mockResolvedValueOnce({ overview: baseOverview, cards: [baseCardOne] })
      .mockResolvedValueOnce({ overview: baseOverview, cards: [replacementCard] });
    reviewMutateAsyncMock
      .mockRejectedValueOnce(new TypeError('Network connection lost'))
      .mockImplementationOnce(async (payload: { clientReviewId: string }) => ({
        reviewLogId: payload.clientReviewId,
        card: replacementCard,
        overview: baseOverview,
      }));
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await expect(result.current.handleGrade('good')).rejects.toThrow('Network connection lost');
    });
    expect(result.current.reviewRetryAvailable).toBe(true);

    act(() => result.current.exitFocusMode());
    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });

    const firstPayload = reviewMutateAsyncMock.mock.calls[0]?.[0];
    const nextSessionPayload = reviewMutateAsyncMock.mock.calls[1]?.[0];
    expect(createStudyReviewRequestMock).toHaveBeenCalledTimes(2);
    expect(nextSessionPayload.cardId).toBe(replacementCard.id);
    expect(nextSessionPayload.clientReviewId).not.toBe(firstPayload.clientReviewId);
  });

  it.each([
    {
      name: 'out-of-order review',
      error: new JsonRequestError('Review is out of order. (409)', 409, {
        code: 'review_out_of_order',
      }),
    },
    {
      name: 'mismatched log ID',
      error: new StudyReviewIdentityMismatchError(
        '01arz3ndektsv4rrffq69g5fa1',
        '01arz3ndektsv4rrffq69g5fzz'
      ),
    },
  ])('recovers from $name without submitting a fresh review', async ({ error }) => {
    reviewMutateAsyncMock.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });

    expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(createStudyReviewRequestMock).toHaveBeenCalledTimes(1);
    expect(startStudySessionMock).toHaveBeenCalledTimes(2);
    expect(result.current.reviewConflictRecovered).toBe(true);
    expect(result.current.sessionError).toBeNull();
    expect(result.current.reviewRetryAvailable).toBe(false);
    await act(async () => {
      await result.current.retryPendingReview();
    });
    expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('preserves the lesson cohort during authoritative conflict recovery', async () => {
    const cohortId = '01k00000000000000000000000';
    reviewMutateAsyncMock.mockRejectedValueOnce(
      new JsonRequestError('Review is out of order. (409)', 409, {
        code: 'review_out_of_order',
      })
    );
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode('lessons', { lessonCohortId: cohortId });
    });
    act(() => result.current.beginLessonQuiz());
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });

    expect(startStudyIntroductionCohortLessonMock).toHaveBeenCalledTimes(2);
    expect(startStudyIntroductionCohortLessonMock).toHaveBeenNthCalledWith(1, cohortId);
    expect(startStudyIntroductionCohortLessonMock).toHaveBeenNthCalledWith(2, cohortId);
    expect(startStudyLessonMock).not.toHaveBeenCalled();
    expect(result.current.reviewConflictRecovered).toBe(true);
  });

  it('resets queue position and answered state after authoritative conflict recovery', async () => {
    const replacementCard = {
      ...baseCardOne,
      id: 'card-replacement',
      noteId: 'note-replacement',
    };
    startStudySessionMock
      .mockResolvedValueOnce({ overview: baseOverview, cards: [baseCardOne, baseCardTwo] })
      .mockResolvedValueOnce({
        overview: { ...baseOverview, dueCount: 1, reviewCount: 1, totalCards: 1 },
        cards: [replacementCard],
      });
    reviewMutateAsyncMock
      .mockResolvedValueOnce({
        reviewLogId: '01arz3ndektsv4rrffq69g5fa1',
        card: baseCardOne,
        overview: { ...baseOverview, dueCount: 1, reviewCount: 1 },
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
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.setMasteryAnimation(null));
    expect(result.current.currentCard?.id).toBe(baseCardTwo.id);
    expect(result.current.sessionProgress).toBeGreaterThan(0);

    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });

    expect(result.current.currentCard?.id).toBe(replacementCard.id);
    expect(result.current.revealed).toBe(false);
    expect(result.current.sessionCounts.reviewRemaining).toBe(1);
    expect(result.current.sessionProgress).toBe(0);
    expect(result.current.reviewConflictRecovered).toBe(true);
  });

  it('does not retain an identity after a definitive review rejection', async () => {
    reviewMutateAsyncMock.mockRejectedValueOnce(
      new JsonRequestError('Grade is invalid. (422)', 422, { message: 'Grade is invalid.' })
    );
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      try {
        await result.current.handleGrade('good');
      } catch {
        // The hook exposes the definitive error in session state.
      }
    });

    expect(result.current.reviewRetryAvailable).toBe(false);
    await act(async () => {
      await result.current.handleGrade('good');
    });
    expect(createStudyReviewRequestMock).toHaveBeenCalledTimes(2);
  });

  it('restores a buried card when undo is triggered', async () => {
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => {
      result.current.revealCurrentCard();
      result.current.handleBuryForSession();
    });

    expect(result.current.currentCard?.id).toBe('card-2');

    await act(async () => {
      await result.current.handleUndo();
    });

    expect(result.current.currentCard?.id).toBe('card-1');
    expect(result.current.revealed).toBe(true);
  });

  it.each([
    {
      name: 'undo',
      run: (session: ReturnType<typeof useStudyReviewSession>) => session.handleUndo(),
      mutation: undoStudyReviewMock,
    },
    {
      name: 'card action',
      run: (session: ReturnType<typeof useStudyReviewSession>) =>
        session.handleCardAction('suspend'),
      mutation: cardActionMutateAsyncMock,
    },
  ])('blocks $name while a review submission is still in flight', async ({ run, mutation }) => {
    const deferredReview = createDeferred<{
      reviewLogId: string;
      card: typeof baseCardOne;
      overview: typeof baseOverview;
    }>();
    reviewMutateAsyncMock.mockReturnValue(deferredReview.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => {
      result.current.revealCurrentCard();
    });

    let reviewPromise: Promise<void> | undefined;
    await act(async () => {
      reviewPromise = result.current.handleGrade('good');
      await Promise.resolve();
      await run(result.current);
      expect(mutation).not.toHaveBeenCalled();
      expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(1);
      deferredReview.resolve({
        reviewLogId: 'review-log-1',
        card: baseCardOne,
        overview: baseOverview,
      });
      await reviewPromise;
    });

    expect(result.current.currentCard?.id).toBe('card-2');
  });

  it('submits only one review undo while the first undo is still in flight', async () => {
    reviewMutateAsyncMock
      .mockResolvedValueOnce({
        reviewLogId: 'review-log-1',
        card: baseCardOne,
        overview: baseOverview,
      })
      .mockResolvedValueOnce({
        reviewLogId: 'review-log-2',
        card: baseCardTwo,
        overview: baseOverview,
      });
    const deferredUndo = createDeferred<{
      reviewLogId: string;
      card: typeof baseCardOne;
      overview: typeof baseOverview;
    }>();
    undoStudyReviewMock.mockReturnValue(deferredUndo.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.setMasteryAnimation(null));
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.setMasteryAnimation(null));

    let firstUndo: Promise<void> | undefined;
    let duplicateUndo: Promise<void> | undefined;
    await act(async () => {
      firstUndo = result.current.handleUndo();
      duplicateUndo = result.current.handleUndo();
      await Promise.resolve();

      expect(undoStudyReviewMock).toHaveBeenCalledTimes(1);
      expect(undoStudyReviewMock).toHaveBeenCalledWith('review-log-2');

      deferredUndo.resolve({
        reviewLogId: 'review-log-2',
        card: baseCardTwo,
        overview: baseOverview,
      });
      await Promise.all([firstUndo, duplicateUndo]);
    });

    await act(async () => {
      await result.current.handleUndo();
    });

    expect(undoStudyReviewMock).toHaveBeenCalledTimes(2);
    expect(undoStudyReviewMock).toHaveBeenLastCalledWith('review-log-1');
  });

  it('blocks grading and card actions while a review undo is still in flight', async () => {
    reviewMutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-log-1',
      card: baseCardOne,
      overview: baseOverview,
    });
    const deferredUndo = createDeferred<{
      reviewLogId: string;
      card: typeof baseCardOne;
      overview: typeof baseOverview;
    }>();
    undoStudyReviewMock.mockReturnValue(deferredUndo.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.setMasteryAnimation(null));

    let undoPromise: Promise<void> | undefined;
    act(() => {
      undoPromise = result.current.handleUndo();
    });
    expect(undoStudyReviewMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.handleGrade('good');
      await result.current.handleCardAction('suspend');

      expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(1);
      expect(cardActionMutateAsyncMock).not.toHaveBeenCalled();

      deferredUndo.resolve({
        reviewLogId: 'review-log-1',
        card: baseCardOne,
        overview: baseOverview,
      });
      await undoPromise;
    });
  });

  it('keeps session selection stable after a card action removes the current card', async () => {
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => {
      result.current.revealCurrentCard();
    });

    await act(async () => {
      await result.current.handleCardAction('suspend');
    });

    expect(result.current.currentCard?.id).toBe('card-2');
    expect(result.current.revealed).toBe(false);
  });

  it('submits only one card action while the first action is still in flight', async () => {
    const deferredAction = createDeferred<{
      card: typeof baseCardOne;
      overview: typeof baseOverview;
    }>();
    cardActionMutateAsyncMock.mockReturnValue(deferredAction.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });

    let firstAction: Promise<void> | undefined;
    let duplicateAction: Promise<void> | undefined;
    let conflictingGrade: Promise<void> | undefined;
    await act(async () => {
      firstAction = result.current.handleCardAction('suspend');
      duplicateAction = result.current.handleCardAction('forget');
      conflictingGrade = result.current.handleGrade('good');
      await Promise.resolve();

      expect(cardActionMutateAsyncMock).toHaveBeenCalledTimes(1);
      expect(reviewMutateAsyncMock).not.toHaveBeenCalled();

      deferredAction.resolve({
        card: baseCardOne,
        overview: baseOverview,
      });
      await Promise.all([firstAction, duplicateAction, conflictingGrade]);
    });

    await act(async () => {
      await result.current.handleCardAction('suspend');
    });

    expect(cardActionMutateAsyncMock).toHaveBeenCalledTimes(2);
  });
});
