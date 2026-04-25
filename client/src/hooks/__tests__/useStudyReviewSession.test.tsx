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
} = vi.hoisted(() => ({
  cardActionMutateAsyncMock: vi.fn(),
  startStudySessionMock: vi.fn(),
  prepareStudyAnswerAudioMock: vi.fn(),
  reviewMutateAsyncMock: vi.fn(),
  undoStudyReviewMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
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
  startStudySession: startStudySessionMock,
  prepareStudyAnswerAudio: prepareStudyAnswerAudioMock,
  undoStudyReview: undoStudyReviewMock,
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
