import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setUpStudyReviewSession,
  baseOverview,
  baseCardOne,
  baseCardTwo,
  createWrapper,
  createDeferred,
  startStudySessionMock,
  prepareStudyAnswerAudioMock,
  reviewMutateAsyncMock,
  undoStudyReviewMock,
  warmAudioCacheMock,
} from './studyReviewSessionTestHarness';
import useStudyReviewSession from '../useStudyReviewSession';

describe('useStudyReviewSession', () => {
  beforeEach(setUpStudyReviewSession);

  it('requeues an incorrect lesson card without submitting or introducing it', async () => {
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode('lessons');
    });
    act(() => result.current.beginLessonQuiz());

    expect(result.current.currentCard?.id).toBe('card-1');

    await act(async () => {
      await result.current.handleGrade('again');
    });

    expect(reviewMutateAsyncMock).not.toHaveBeenCalled();
    expect(result.current.cards.map((card) => card.id)).toEqual(['card-2', 'card-1']);
    expect(result.current.currentCard?.id).toBe('card-2');
    expect(result.current.lessonPhase).toBe('quiz');
  });

  it('clears an ordinary interrupted review session before starting lessons', async () => {
    const { result: firstResult, unmount: unmountFirst } = renderHook(
      () => useStudyReviewSession(),
      {
        wrapper: createWrapper(),
      }
    );
    await act(async () => {
      await firstResult.current.enterFocusMode();
    });
    unmountFirst();

    const { result: secondResult } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await secondResult.current.enterFocusMode('lessons');
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(
        'convo-lab.study-achievement-sessions-v1.study-review-hook-test-user'
      ) ?? '{}'
    ) as { activeSession?: unknown };
    expect(persisted.activeSession).toBeNull();
  });

  it("warms each nearby card's logical audio asset after entering focus mode", async () => {
    const cardOneWithAudio = {
      ...baseCardOne,
      prompt: {
        ...baseCardOne.prompt,
        cueAudio: {
          filename: 'prompt-1.mp3',
          url: 'https://example.com/prompt-1.mp3',
          mediaKind: 'audio',
          source: 'imported',
        },
      },
      answer: {
        ...baseCardOne.answer,
        answerAudio: {
          filename: 'answer-1.mp3',
          url: 'https://example.com/answer-1.mp3',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      answerAudioSource: 'generated' as const,
    };
    const cardTwoWithAudio = {
      ...baseCardTwo,
      answer: {
        ...baseCardTwo.answer,
        answerAudio: {
          filename: 'answer-2.mp3',
          url: 'https://example.com/answer-2.mp3',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      answerAudioSource: 'generated' as const,
    };
    startStudySessionMock.mockResolvedValue({
      overview: baseOverview,
      cards: [cardOneWithAudio, cardTwoWithAudio],
    });

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });

    expect(warmAudioCacheMock).toHaveBeenCalledWith([
      'https://example.com/prompt-1.mp3',
      'https://example.com/answer-2.mp3',
    ]);
  });

  it('surfaces the mastery rail after a passing review even when the level stays put', async () => {
    const guruCard = {
      ...baseCardOne,
      answer: { ...baseCardOne.answer, expression: 'raw mastery label' },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'text' as const,
          text: 'server mastery label',
          ruby: null,
          hint: null,
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: null,
          ruby: null,
          restored: null,
          meaning: null,
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: null,
          pitchAccent: null,
        },
      },
      masteryLevel: 'guru',
    };
    startStudySessionMock.mockResolvedValueOnce({
      overview: baseOverview,
      cards: [guruCard, baseCardTwo],
    });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => ({
      ...(cardId === guruCard.id ? guruCard : baseCardTwo),
      id: cardId,
    }));
    reviewMutateAsyncMock.mockResolvedValueOnce({
      reviewLogId: 'review-log-pass',
      card: {
        ...guruCard,
        state: {
          ...guruCard.state,
          dueAt: new Date('2026-05-23T09:00:00.000Z').toISOString(),
        },
      },
      overview: baseOverview,
    });
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

    expect(result.current.masteryAnimation).toMatchObject({
      id: 'review-log-pass',
      card: { id: guruCard.id },
      label: 'server mastery label',
      fromLevel: 'guru',
      toLevel: 'guru',
      passed: true,
    });

    await act(async () => {
      await result.current.handleGrade('good');
    });
    await act(async () => {
      await result.current.handleUndo();
    });

    expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(undoStudyReviewMock).not.toHaveBeenCalled();
  });

  it('surfaces a backward mastery transition after a failed review', async () => {
    const masterCard = {
      ...baseCardOne,
      masteryLevel: 'master',
    };
    startStudySessionMock.mockResolvedValueOnce({
      overview: baseOverview,
      cards: [masterCard, baseCardTwo],
    });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => ({
      ...(cardId === masterCard.id ? masterCard : baseCardTwo),
      id: cardId,
    }));
    reviewMutateAsyncMock.mockResolvedValueOnce({
      reviewLogId: 'review-log-fail',
      card: {
        ...masterCard,
        masteryLevel: 'apprentice',
        state: {
          ...masterCard.state,
          queueState: 'relearning',
        },
      },
      overview: baseOverview,
    });
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
      await result.current.handleGrade('again');
    });

    expect(result.current.masteryAnimation).toMatchObject({
      id: 'review-log-fail',
      card: { id: masterCard.id },
      label: '会社',
      fromLevel: 'master',
      toLevel: 'apprentice',
      passed: false,
    });
  });

  it('advances without retrying when a committed review loses its card refetch race', async () => {
    reviewMutateAsyncMock.mockResolvedValueOnce({
      message: 'Study card not found after review.',
      reviewLogId: 'review-log-committed',
      committed: true,
      cardFetchFailed: true,
      card: null,
      overview: {
        ...baseOverview,
        dueCount: 1,
        reviewCount: 1,
      },
    });
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

    expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(result.current.currentCard?.id).toBe('card-2');
    expect(result.current.sessionCounts.reviewRemaining).toBe(1);

    act(() => {
      result.current.setMasteryAnimation(null);
    });
    await act(async () => {
      await result.current.handleUndo();
    });
    expect(undoStudyReviewMock).toHaveBeenCalledWith('review-log-committed');
  });

  it('counts only current new queue-state cards as new in the focus header', async () => {
    const trueNewCards = Array.from({ length: 20 }, (_, index) => ({
      ...baseCardOne,
      id: `new-${index + 1}`,
      noteId: `note-new-${index + 1}`,
      state: {
        ...baseCardOne.state,
        dueAt: null,
        queueState: 'new' as const,
        source: { type: 0 },
      },
    }));
    const ankiOriginDueCards = Array.from({ length: 11 }, (_, index) => ({
      ...baseCardOne,
      id: `review-${index + 1}`,
      noteId: `note-review-${index + 1}`,
      state: {
        ...baseCardOne.state,
        queueState: 'review' as const,
        source: { type: 0 },
      },
    }));

    startStudySessionMock.mockResolvedValue({
      overview: {
        ...baseOverview,
        dueCount: 11,
        newCount: 31,
        newCardsPerDay: 20,
        newCardsIntroducedToday: 0,
        newCardsAvailableToday: 20,
        reviewCount: 11,
        totalCards: 31,
      },
      cards: [...trueNewCards, ...ankiOriginDueCards],
    });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => {
      const card = [...trueNewCards, ...ankiOriginDueCards].find((item) => item.id === cardId);
      return card ?? baseCardOne;
    });

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });

    expect(result.current.sessionCounts).toEqual({
      newRemaining: 20,
      failedDue: 0,
      reviewRemaining: 11,
    });
  });

  it('resets answer-audio autoplay memory for each new focus session', async () => {
    const playMock = vi.fn().mockResolvedValue(true);
    const cardWithAnswerAudio = {
      ...baseCardOne,
      answer: {
        ...baseCardOne.answer,
        answerAudio: {
          filename: 'card-1.mp3',
          url: 'https://example.com/card-1.mp3',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      answerAudioSource: 'generated' as const,
    };

    startStudySessionMock.mockResolvedValue({
      overview: {
        ...baseOverview,
        dueCount: 1,
        reviewCount: 1,
        totalCards: 1,
      },
      cards: [cardWithAnswerAudio],
    });

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    result.current.answerAudioRef.current = {
      play: playMock,
      stop: vi.fn(),
    };
    act(() => {
      result.current.revealCurrentCard();
    });
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.exitFocusMode();
    });
    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => {
      result.current.revealCurrentCard();
    });

    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(2);
    });
  });

  it('does not restore a stale session after focus mode exits while loading', async () => {
    const deferredSession = createDeferred<{
      overview: typeof baseOverview;
      cards: (typeof baseCardOne)[];
    }>();
    startStudySessionMock.mockReturnValue(deferredSession.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    let enterPromise!: Promise<void>;
    act(() => {
      enterPromise = result.current.enterFocusMode();
    });
    await waitFor(() => {
      expect(result.current.sessionLoading).toBe(true);
    });

    act(() => {
      result.current.exitFocusMode();
    });
    await act(async () => {
      deferredSession.resolve({ overview: baseOverview, cards: [baseCardOne] });
      await enterPromise;
    });

    expect(result.current.focusMode).toBe(false);
    expect(result.current.sessionLoading).toBe(false);
    expect(result.current.currentCard).toBeNull();
  });

  it('does not let a grade from an exited session overwrite a newly opened session', async () => {
    const deferredReview = createDeferred<{
      reviewLogId: string;
      card: typeof baseCardOne;
      overview: typeof baseOverview;
    }>();
    const replacementCard = {
      ...baseCardOne,
      id: 'card-replacement',
      noteId: 'note-replacement',
    };
    startStudySessionMock
      .mockResolvedValueOnce({ overview: baseOverview, cards: [baseCardOne, baseCardTwo] })
      .mockResolvedValueOnce({ overview: baseOverview, cards: [replacementCard] });
    reviewMutateAsyncMock.mockReturnValue(deferredReview.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });

    let gradePromise!: Promise<void>;
    act(() => {
      gradePromise = result.current.handleGrade('good');
    });
    await waitFor(() => {
      expect(result.current.reviewBusy).toBe(true);
    });

    act(() => {
      result.current.exitFocusMode();
    });
    await act(async () => {
      await result.current.enterFocusMode();
    });
    expect(result.current.currentCard?.id).toBe(replacementCard.id);

    await act(async () => {
      deferredReview.resolve({
        reviewLogId: 'stale-review-log',
        card: baseCardOne,
        overview: baseOverview,
      });
      await gradePromise;
    });

    expect(result.current.currentCard?.id).toBe(replacementCard.id);
    expect(result.current.masteryAnimation).toBeNull();
  });

  it('increments the failed count for a due card while it waits for its retry due time', async () => {
    const retryDueAt = new Date('2999-04-21T12:05:00.000Z').toISOString();

    startStudySessionMock.mockResolvedValue({
      overview: {
        ...baseOverview,
        dueCount: 2,
        failedCount: 0,
        newCount: 0,
        reviewCount: 2,
        totalCards: 2,
      },
      cards: [baseCardOne, baseCardTwo],
    });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) =>
      cardId === baseCardOne.id ? baseCardOne : baseCardTwo
    );
    reviewMutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-log-due',
      card: {
        ...baseCardOne,
        state: {
          ...baseCardOne.state,
          dueAt: retryDueAt,
          failedAt: new Date().toISOString(),
          queueState: 'relearning' as const,
        },
      },
      overview: {
        ...baseOverview,
        dueCount: 1,
        failedCount: 1,
        newCount: 0,
        learningCount: 1,
        reviewCount: 1,
        totalCards: 2,
        nextDueAt: retryDueAt,
      },
    });

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    expect(result.current.sessionCounts).toEqual({
      newRemaining: 0,
      failedDue: 0,
      reviewRemaining: 2,
    });

    await act(async () => {
      await result.current.handleGrade('again');
    });

    expect(result.current.sessionCounts).toEqual({
      newRemaining: 0,
      failedDue: 1,
      reviewRemaining: 1,
    });
    expect(result.current.currentCard?.id).toBe('card-2');
    expect(startStudySessionMock).toHaveBeenCalledTimes(1);
  });

  it('removes a failed new card while it waits for its retry due time', async () => {
    const retryDueAt = new Date('2999-04-21T12:05:00.000Z').toISOString();
    const newCard = {
      ...baseCardOne,
      id: 'new-card-1',
      state: {
        ...baseCardOne.state,
        dueAt: null,
        queueState: 'new' as const,
        source: { type: 0 },
      },
    };

    startStudySessionMock.mockResolvedValue({
      overview: {
        ...baseOverview,
        dueCount: 0,
        newCount: 1,
        newCardsPerDay: 20,
        newCardsIntroducedToday: 0,
        newCardsAvailableToday: 1,
        reviewCount: 0,
        totalCards: 1,
      },
      cards: [newCard],
    });
    prepareStudyAnswerAudioMock.mockResolvedValue(newCard);
    reviewMutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-log-new',
      card: {
        ...newCard,
        state: {
          ...newCard.state,
          dueAt: retryDueAt,
          failedAt: new Date().toISOString(),
          queueState: 'learning' as const,
        },
      },
      overview: {
        ...baseOverview,
        dueCount: 0,
        failedCount: 1,
        newCount: 0,
        newCardsPerDay: 20,
        newCardsIntroducedToday: 1,
        newCardsAvailableToday: 0,
        learningCount: 1,
        reviewCount: 0,
        totalCards: 1,
        nextDueAt: retryDueAt,
      },
    });

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    expect(result.current.sessionCounts).toEqual({
      newRemaining: 1,
      failedDue: 0,
      reviewRemaining: 0,
    });

    await act(async () => {
      await result.current.handleGrade('again');
    });

    expect(result.current.sessionCounts).toEqual({
      newRemaining: 0,
      failedDue: 1,
      reviewRemaining: 0,
    });
    await waitFor(() => {
      expect(result.current.currentCard).toBeNull();
    });
    expect(startStudySessionMock).toHaveBeenCalledTimes(1);
  });

  it('counts persisted failed cards loaded from the server', async () => {
    const failedCard = {
      ...baseCardOne,
      id: 'failed-card-1',
      state: {
        ...baseCardOne.state,
        failedAt: new Date('2026-04-21T12:00:00.000Z').toISOString(),
        queueState: 'relearning' as const,
      },
    };

    startStudySessionMock.mockResolvedValue({
      overview: {
        ...baseOverview,
        dueCount: 0,
        failedCount: 1,
        newCount: 0,
        learningCount: 1,
        reviewCount: 0,
        totalCards: 1,
      },
      cards: [failedCard],
    });
    prepareStudyAnswerAudioMock.mockResolvedValue(failedCard);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });

    expect(result.current.sessionCounts).toEqual({
      newRemaining: 0,
      failedDue: 1,
      reviewRemaining: 0,
    });
  });

  it('does not load lesson cards into a review session after backlog is cleared', async () => {
    const dueCard = {
      ...baseCardOne,
      id: 'due-card-1',
    };
    const newCard = {
      ...baseCardTwo,
      id: 'new-card-1',
      state: {
        ...baseCardTwo.state,
        dueAt: null,
        queueState: 'new' as const,
        source: { type: 0 },
      },
    };

    startStudySessionMock
      .mockResolvedValueOnce({
        overview: {
          ...baseOverview,
          dueCount: 1,
          failedCount: 0,
          newCount: 1,
          newCardsAvailableToday: 0,
          reviewCount: 1,
          totalCards: 2,
        },
        cards: [dueCard],
      })
      .mockResolvedValueOnce({
        overview: {
          ...baseOverview,
          dueCount: 0,
          failedCount: 0,
          newCount: 1,
          newCardsAvailableToday: 1,
          reviewCount: 0,
          totalCards: 1,
        },
        cards: [newCard],
      });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) =>
      cardId === newCard.id ? newCard : dueCard
    );
    reviewMutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-log-due',
      card: {
        ...dueCard,
        state: {
          ...dueCard.state,
          dueAt: new Date('2026-04-22T12:00:00.000Z').toISOString(),
          queueState: 'review' as const,
        },
      },
      overview: {
        ...baseOverview,
        dueCount: 0,
        failedCount: 0,
        newCount: 1,
        newCardsAvailableToday: 1,
        reviewCount: 1,
        totalCards: 2,
      },
    });

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    await act(async () => {
      await result.current.handleGrade('good');
    });

    await waitFor(() => expect(result.current.currentCard).toBeNull());
    expect(startStudySessionMock).toHaveBeenCalledTimes(1);
  });

  it('does not load lesson cards while a failed review waits for its retry', async () => {
    const retryDueAt = new Date('2999-04-21T12:05:00.000Z').toISOString();
    const newCard = {
      ...baseCardTwo,
      id: 'new-card-1',
      state: {
        ...baseCardTwo.state,
        dueAt: null,
        queueState: 'new' as const,
        source: { type: 0 },
      },
    };

    startStudySessionMock
      .mockResolvedValueOnce({
        overview: {
          ...baseOverview,
          dueCount: 0,
          failedCount: 1,
          newCount: 1,
          newCardsAvailableToday: 1,
          learningCount: 1,
          reviewCount: 0,
          totalCards: 2,
          nextDueAt: retryDueAt,
        },
        cards: [],
      })
      .mockResolvedValueOnce({
        overview: {
          ...baseOverview,
          dueCount: 0,
          failedCount: 1,
          newCount: 1,
          newCardsAvailableToday: 1,
          learningCount: 1,
          reviewCount: 0,
          totalCards: 2,
          nextDueAt: retryDueAt,
        },
        cards: [newCard],
      });
    prepareStudyAnswerAudioMock.mockResolvedValue(newCard);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });

    await waitFor(() => expect(result.current.currentCard).toBeNull());
    expect(startStudySessionMock).toHaveBeenCalledTimes(1);
  });

  it('stops refreshing when the server repeatedly returns an empty session with work available', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        ...baseOverview,
        dueCount: 1,
        reviewCount: 1,
      },
      cards: [],
    });

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 25);
      });
    });

    expect(startStudySessionMock).toHaveBeenCalledTimes(2);
    expect(result.current.currentCard).toBeNull();
  });

  it('runs toughest-card practice without submitting scheduler reviews', async () => {
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => {
      result.current.startToughestPractice([baseCardOne, baseCardTwo]);
      result.current.revealCurrentCard();
    });

    await act(async () => {
      await result.current.handleGrade('again');
    });
    expect(result.current.currentCard?.id).toBe('card-2');

    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });
    act(() => result.current.revealCurrentCard());
    await act(async () => {
      await result.current.handleGrade('good');
    });

    expect(reviewMutateAsyncMock).not.toHaveBeenCalled();
    expect(result.current.practiceComplete).toBe(true);
    expect(result.current.sessionWrapUp.reviewsCompleted).toBe(0);
  });
});
