import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useStudyReviewSession from '../useStudyReviewSession';
import { JsonRequestError } from '../../lib/apiClient';
import StudyReviewIdentityMismatchError from '../../lib/studyReviewIdentityMismatch';

const {
  cardActionMutateAsyncMock,
  createStudyReviewRequestMock,
  startStudyLessonMock,
  startStudySessionMock,
  prepareStudyAnswerAudioMock,
  reviewMutateAsyncMock,
  undoStudyReviewMock,
  updateStudyCardMock,
  deleteStudyCardMock,
  regenerateStudyAnswerAudioMock,
  warmAudioCacheMock,
} = vi.hoisted(() => ({
  cardActionMutateAsyncMock: vi.fn(),
  createStudyReviewRequestMock: vi.fn(),
  startStudyLessonMock: vi.fn(),
  startStudySessionMock: vi.fn(),
  prepareStudyAnswerAudioMock: vi.fn(),
  reviewMutateAsyncMock: vi.fn(),
  undoStudyReviewMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
  deleteStudyCardMock: vi.fn(),
  regenerateStudyAnswerAudioMock: vi.fn(),
  warmAudioCacheMock: vi.fn(),
}));

vi.mock('../useStudy', () => ({
  createStudyReviewRequest: createStudyReviewRequestMock,
  useSubmitStudyReview: () => ({
    mutateAsync: reviewMutateAsyncMock,
    isPending: false,
  }),
  useStudyCardAction: () => ({
    mutateAsync: cardActionMutateAsyncMock,
    isPending: false,
  }),
  useUpdateStudyCard: () => ({
    mutateAsync: updateStudyCardMock,
    isPending: false,
    error: null,
  }),
  useDeleteStudyCard: () => ({
    mutateAsync: deleteStudyCardMock,
    isPending: false,
    error: null,
  }),
  useRegenerateStudyAnswerAudio: () => ({
    mutateAsync: regenerateStudyAnswerAudioMock,
    isPending: false,
    error: null,
  }),
  startStudyLesson: startStudyLessonMock,
  startStudySession: startStudySessionMock,
  prepareStudyAnswerAudio: prepareStudyAnswerAudioMock,
  undoStudyReview: undoStudyReviewMock,
}));

vi.mock('../../lib/audioCache', () => ({
  warmAudioCache: warmAudioCacheMock,
}));

const baseOverview = {
  dueCount: 2,
  newCount: 0,
  learningCount: 0,
  reviewCount: 2,
  suspendedCount: 0,
  totalCards: 2,
};

const baseCardOne = {
  id: 'card-1',
  noteId: 'note-1',
  cardType: 'recognition' as const,
  prompt: {
    cueText: '会社',
    cueReading: 'かいしゃ',
  },
  answer: {
    expression: '会社',
    expressionReading: '会社[かいしゃ]',
    meaning: 'company',
  },
  state: {
    dueAt: new Date('2026-04-20T13:00:00.000Z').toISOString(),
    queueState: 'review' as const,
    scheduler: null,
    source: {},
  },
  answerAudioSource: 'missing' as const,
  createdAt: new Date('2026-04-21T12:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-04-21T12:00:00.000Z').toISOString(),
};

const baseCardTwo = {
  ...baseCardOne,
  id: 'card-2',
  noteId: 'note-2',
  prompt: {
    cueText: '学校',
    cueReading: 'がっこう',
  },
  answer: {
    expression: '学校',
    expressionReading: '学校[がっこう]',
    meaning: 'school',
  },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const TestQueryClientProvider = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  TestQueryClientProvider.displayName = 'TestQueryClientProvider';

  return TestQueryClientProvider;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('useStudyReviewSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    startStudyLessonMock.mockReset();
    startStudySessionMock.mockReset();
    prepareStudyAnswerAudioMock.mockReset();
    reviewMutateAsyncMock.mockReset();
    createStudyReviewRequestMock.mockReset();
    createStudyReviewRequestMock.mockImplementation(
      (payload: { cardId: string; grade: 'again' | 'hard' | 'good' | 'easy' }) => ({
        ...payload,
        clientReviewId: `01arz3ndektsv4rrffq69g5fa${String(
          createStudyReviewRequestMock.mock.calls.length
        )}`,
        reviewedAt: '2026-08-12T23:30:45.678Z',
      })
    );
    cardActionMutateAsyncMock.mockReset();
    undoStudyReviewMock.mockReset();
    updateStudyCardMock.mockReset();
    deleteStudyCardMock.mockReset();
    regenerateStudyAnswerAudioMock.mockReset();
    warmAudioCacheMock.mockReset();
    warmAudioCacheMock.mockResolvedValue(undefined);

    startStudySessionMock.mockResolvedValue({
      overview: baseOverview,
      cards: [baseCardOne, baseCardTwo],
    });
    startStudyLessonMock.mockResolvedValue({
      overview: { ...baseOverview, newCount: 2 },
      cards: [
        {
          ...baseCardOne,
          state: { ...baseCardOne.state, dueAt: null, queueState: 'new' as const },
        },
        {
          ...baseCardTwo,
          state: { ...baseCardTwo.state, dueAt: null, queueState: 'new' as const },
        },
      ],
    });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => ({
      ...(cardId === 'card-1' ? baseCardOne : baseCardTwo),
      id: cardId,
      answer: {
        ...baseCardOne.answer,
        answerAudio: {
          filename: `${cardId}.mp3`,
          url: `https://example.com/${cardId}.mp3`,
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      answerAudioSource: 'generated',
    }));
    reviewMutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-log-1',
      card: {
        ...baseCardOne,
        state: {
          ...baseCardOne.state,
          dueAt: new Date('2026-04-23T09:00:00.000Z').toISOString(),
        },
      },
      overview: {
        ...baseOverview,
        dueCount: 1,
        reviewCount: 1,
      },
    });
    regenerateStudyAnswerAudioMock.mockImplementation(
      async (payload: {
        cardId: string;
        answerAudioVoiceId?: string | null;
        answerAudioTextOverride?: string | null;
      }) => ({
        ...baseCardOne,
        id: payload.cardId,
        answerAudioSource: 'generated' as const,
        answer: {
          ...baseCardOne.answer,
          answerAudioVoiceId: payload.answerAudioVoiceId,
          answerAudioTextOverride: payload.answerAudioTextOverride,
          answerAudio: {
            filename: `${payload.cardId}.mp3`,
            url: `https://example.com/${payload.cardId}.mp3`,
            mediaKind: 'audio',
            source: 'generated',
          },
        },
      })
    );
    undoStudyReviewMock.mockResolvedValue({
      reviewLogId: 'review-log-1',
      card: baseCardOne,
      overview: baseOverview,
    });
    cardActionMutateAsyncMock.mockResolvedValue({
      card: {
        ...baseCardOne,
        state: {
          ...baseCardOne.state,
          queueState: 'suspended',
        },
      },
      overview: {
        ...baseOverview,
        dueCount: 1,
        reviewCount: 1,
        suspendedCount: 1,
      },
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    });
  });

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
    expect(undoStudyReviewMock).toHaveBeenCalledWith(
      'review-log-1',
      expect.objectContaining({ reviewCount: 2 })
    );
  });

  it('surfaces the mastery rail after a passing review even when the level stays put', async () => {
    const guruCard = {
      ...baseCardOne,
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
      label: '会社',
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
    expect(undoStudyReviewMock).toHaveBeenCalledWith('review-log-committed', expect.any(Object));
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

  it('treats a review conflict as authoritative and never resubmits with a fresh ID', async () => {
    reviewMutateAsyncMock.mockRejectedValueOnce(
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

    expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(createStudyReviewRequestMock).toHaveBeenCalledTimes(1);
    expect(startStudySessionMock).toHaveBeenCalledTimes(2);
    expect(result.current.reviewConflictRecovered).toBe(true);
    expect(result.current.sessionError).toBeNull();
  });

  it('recovers from a mismatched response log ID without allowing a fresh review', async () => {
    reviewMutateAsyncMock.mockRejectedValueOnce(
      new StudyReviewIdentityMismatchError(
        '01arz3ndektsv4rrffq69g5fa1',
        '01arz3ndektsv4rrffq69g5fzz'
      )
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

    expect(reviewMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(createStudyReviewRequestMock).toHaveBeenCalledTimes(1);
    expect(result.current.reviewConflictRecovered).toBe(true);
    expect(result.current.reviewRetryAvailable).toBe(false);
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

  it('blocks undo while a review submission is still in flight', async () => {
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
      await result.current.handleUndo();
      expect(undoStudyReviewMock).not.toHaveBeenCalled();
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
      expect(undoStudyReviewMock).toHaveBeenCalledWith('review-log-2', expect.any(Object));

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
    expect(undoStudyReviewMock).toHaveBeenLastCalledWith('review-log-1', expect.any(Object));
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

  it('does not submit a card action while a review is still in flight', async () => {
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

    let reviewPromise: Promise<void> | undefined;
    await act(async () => {
      reviewPromise = result.current.handleGrade('good');
      await result.current.handleCardAction('suspend');

      expect(cardActionMutateAsyncMock).not.toHaveBeenCalled();

      deferredReview.resolve({
        reviewLogId: 'review-log-1',
        card: baseCardOne,
        overview: baseOverview,
      });
      await reviewPromise;
    });
  });

  it('retries answer-audio preparation until a generated URL becomes available', async () => {
    prepareStudyAnswerAudioMock.mockResolvedValueOnce(baseCardOne).mockResolvedValueOnce({
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
      answerAudioSource: 'generated',
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

    await waitFor(() => {
      expect(prepareStudyAnswerAudioMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(result.current.currentCard?.answer.answerAudio?.url).toBe(
      'https://example.com/card-1.mp3'
    );
    expect(warmAudioCacheMock).toHaveBeenCalledWith(['https://example.com/card-1.mp3']);
  });

  it('regenerates current card answer audio and merges the refreshed card', async () => {
    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });

    await act(async () => {
      await result.current.regenerateCurrentCardAudio({
        answerAudioVoiceId: 'ja-JP-Neural2-C',
        answerAudioTextOverride: 'かいしゃ',
      });
    });

    expect(regenerateStudyAnswerAudioMock).toHaveBeenCalledWith({
      cardId: 'card-1',
      answerAudioVoiceId: 'ja-JP-Neural2-C',
      answerAudioTextOverride: 'かいしゃ',
    });
    expect(result.current.currentCard?.answer.answerAudioVoiceId).toBe('ja-JP-Neural2-C');
    expect(result.current.currentCard?.answer.answerAudioTextOverride).toBe('かいしゃ');
    expect(result.current.currentCard?.answer.answerAudio?.url).toBe(
      'https://example.com/card-1.mp3'
    );
  });

  it('exits focus mode cleanly while answer-audio preparation is still pending', async () => {
    const deferredAudio = createDeferred<typeof baseCardOne>();
    prepareStudyAnswerAudioMock.mockReturnValue(deferredAudio.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => {
      result.current.revealCurrentCard();
      result.current.exitFocusMode();
    });

    await act(async () => {
      deferredAudio.resolve(baseCardOne);
      await deferredAudio.promise;
    });

    await waitFor(() => {
      expect(result.current.focusMode).toBe(false);
      expect(result.current.currentCard).toBeNull();
    });
  });

  it('does not surface a stale audio preparation error after focus mode exits', async () => {
    const deferredAudio = createDeferred<typeof baseCardOne>();
    prepareStudyAnswerAudioMock.mockReturnValue(deferredAudio.promise);

    const { result } = renderHook(() => useStudyReviewSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.enterFocusMode();
    });
    act(() => {
      result.current.revealCurrentCard();
      result.current.exitFocusMode();
    });

    await act(async () => {
      deferredAudio.reject(new Error('audio failed'));
      await deferredAudio.promise.catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.focusMode).toBe(false);
      expect(result.current.sessionError).toBeNull();
    });
  });
});
