import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useStudyReviewSession from '../useStudyReviewSession';

const {
  cardActionMutateAsyncMock,
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
    startStudySessionMock.mockReset();
    prepareStudyAnswerAudioMock.mockReset();
    reviewMutateAsyncMock.mockReset();
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

  it('warms nearby study prompt and answer audio after entering focus mode', async () => {
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
      'https://example.com/answer-1.mp3',
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

    await act(async () => {
      await result.current.handleUndo();
    });

    expect(result.current.currentCard?.id).toBe('card-1');
    expect(result.current.revealed).toBe(true);
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
      togglePlayPause: vi.fn(),
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

  it('moves a failed new card from the new count to the failed count', async () => {
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
          dueAt: new Date('2026-04-21T12:05:00.000Z').toISOString(),
          queueState: 'learning' as const,
        },
      },
      overview: {
        ...baseOverview,
        dueCount: 0,
        newCount: 0,
        newCardsPerDay: 20,
        newCardsIntroducedToday: 1,
        newCardsAvailableToday: 0,
        learningCount: 1,
        reviewCount: 0,
        totalCards: 1,
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
