import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useStudyReviewSession from '../useStudyReviewSession';

const {
  cardActionMutateAsyncMock,
  createStudyReviewRequestMock,
  deleteStudyCardMock,
  getAchievementCatalogMock,
  getAchievementProgressMock,
  prepareStudyAnswerAudioMock,
  regenerateStudyAnswerAudioMock,
  reviewMutateAsyncMock,
  startStudyIntroductionCohortLessonMock,
  startStudyLessonMock,
  startStudySessionMock,
  undoStudyReviewMock,
  updateStudyCardMock,
  warmAudioCacheMock,
} = vi.hoisted(() => ({
  cardActionMutateAsyncMock: vi.fn(),
  createStudyReviewRequestMock: vi.fn(),
  deleteStudyCardMock: vi.fn(),
  getAchievementCatalogMock: vi.fn(),
  getAchievementProgressMock: vi.fn(),
  prepareStudyAnswerAudioMock: vi.fn(),
  regenerateStudyAnswerAudioMock: vi.fn(),
  reviewMutateAsyncMock: vi.fn(),
  startStudyIntroductionCohortLessonMock: vi.fn(),
  startStudyLessonMock: vi.fn(),
  startStudySessionMock: vi.fn(),
  undoStudyReviewMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
  warmAudioCacheMock: vi.fn(),
}));

vi.mock('../useStudy', () => ({
  createStudyReviewRequest: createStudyReviewRequestMock,
  useSubmitStudyReview: () => ({ mutateAsync: reviewMutateAsyncMock, isPending: false }),
  useStudyCardAction: () => ({ mutateAsync: cardActionMutateAsyncMock, isPending: false }),
  useUpdateStudyCard: () => ({ mutateAsync: updateStudyCardMock, isPending: false, error: null }),
  useDeleteStudyCard: () => ({ mutateAsync: deleteStudyCardMock, isPending: false, error: null }),
  useRegenerateStudyAnswerAudio: () => ({
    mutateAsync: regenerateStudyAnswerAudioMock,
    isPending: false,
    error: null,
  }),
  startStudyLesson: startStudyLessonMock,
  startStudyIntroductionCohortLesson: startStudyIntroductionCohortLessonMock,
  startStudySession: startStudySessionMock,
  prepareStudyAnswerAudio: prepareStudyAnswerAudioMock,
  undoStudyReview: undoStudyReviewMock,
}));

vi.mock('../../lib/audioCache', () => ({ warmAudioCache: warmAudioCacheMock }));
vi.mock('../../lib/achievementApi', () => ({
  getAchievementCatalog: getAchievementCatalogMock,
  getAchievementProgress: getAchievementProgressMock,
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'study-review-hook-test-user' } }),
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
  prompt: { cueText: '会社', cueReading: 'かいしゃ' },
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
  prompt: { cueText: '学校', cueReading: 'がっこう' },
  answer: {
    expression: '学校',
    expressionReading: '学校[がっこう]',
    meaning: 'school',
  },
};

const achievementCatalog = {
  revision: 'test-achievements-v1',
  presentation: {
    targetVisibleBadgeCount: 1,
    fillWithLockedCandidates: true,
    noDataFallbackTierIds: ['burned.burned100'],
  },
  families: [],
};
const emptyAchievementProgress = {
  revision: achievementCatalog.revision,
  metricValues: { 'mastery.burned': 99 },
  awards: [],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

async function exitFocusModeWhileAudioIsPending() {
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

  return { deferredAudio, result };
}

async function settleAudioAfterFocusExit(
  deferredAudio: ReturnType<typeof createDeferred<typeof baseCardOne>>,
  result: ReturnType<
    typeof renderHook<ReturnType<typeof useStudyReviewSession>, unknown>
  >['result'],
  outcome: 'resolve' | 'reject'
) {
  if (outcome === 'resolve') {
    await act(async () => {
      deferredAudio.resolve(baseCardOne);
      await deferredAudio.promise;
    });

    await waitFor(() => {
      expect(result.current.focusMode).toBe(false);
      expect(result.current.currentCard).toBeNull();
    });
    return;
  }

  await act(async () => {
    deferredAudio.reject(new Error('audio failed'));
    await deferredAudio.promise.catch(() => undefined);
  });

  await waitFor(() => {
    expect(result.current.focusMode).toBe(false);
    expect(result.current.sessionError).toBeNull();
  });
}

describe('useStudyReviewSession answer audio', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    [
      cardActionMutateAsyncMock,
      createStudyReviewRequestMock,
      deleteStudyCardMock,
      getAchievementCatalogMock,
      getAchievementProgressMock,
      prepareStudyAnswerAudioMock,
      regenerateStudyAnswerAudioMock,
      reviewMutateAsyncMock,
      startStudyIntroductionCohortLessonMock,
      startStudyLessonMock,
      startStudySessionMock,
      undoStudyReviewMock,
      updateStudyCardMock,
      warmAudioCacheMock,
    ].forEach((mock) => mock.mockReset());
    window.localStorage.clear();
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
    warmAudioCacheMock.mockResolvedValue(undefined);
    getAchievementCatalogMock.mockResolvedValue(achievementCatalog);
    getAchievementProgressMock.mockResolvedValue(emptyAchievementProgress);
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
    const { deferredAudio, result } = await exitFocusModeWhileAudioIsPending();
    await settleAudioAfterFocusExit(deferredAudio, result, 'resolve');
  });

  it('does not surface a stale audio preparation error after focus mode exits', async () => {
    const { deferredAudio, result } = await exitFocusModeWhileAudioIsPending();
    await settleAudioAfterFocusExit(deferredAudio, result, 'reject');
  });
});
