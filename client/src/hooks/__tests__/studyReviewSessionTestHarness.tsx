import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

import type { AchievementProgress } from '../../components/study/achievementModel';

const {
  cardActionMutateAsyncMock,
  createStudyReviewRequestMock,
  startStudyLessonMock,
  startStudyIntroductionCohortLessonMock,
  startStudySessionMock,
  prepareStudyAnswerAudioMock,
  reviewMutateAsyncMock,
  undoStudyReviewMock,
  updateStudyCardMock,
  deleteStudyCardMock,
  regenerateStudyAnswerAudioMock,
  warmAudioCacheMock,
  getAchievementCatalogMock,
  getAchievementProgressMock,
} = vi.hoisted(() => ({
  cardActionMutateAsyncMock: vi.fn(),
  createStudyReviewRequestMock: vi.fn(),
  startStudyLessonMock: vi.fn(),
  startStudyIntroductionCohortLessonMock: vi.fn(),
  startStudySessionMock: vi.fn(),
  prepareStudyAnswerAudioMock: vi.fn(),
  reviewMutateAsyncMock: vi.fn(),
  undoStudyReviewMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
  deleteStudyCardMock: vi.fn(),
  regenerateStudyAnswerAudioMock: vi.fn(),
  warmAudioCacheMock: vi.fn(),
  getAchievementCatalogMock: vi.fn(),
  getAchievementProgressMock: vi.fn(),
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
  startStudyIntroductionCohortLesson: startStudyIntroductionCohortLessonMock,
  startStudySession: startStudySessionMock,
  prepareStudyAnswerAudio: prepareStudyAnswerAudioMock,
  undoStudyReview: undoStudyReviewMock,
}));

vi.mock('../../lib/audioCache', () => ({
  warmAudioCache: warmAudioCacheMock,
}));

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

const achievementAssets = {
  earned: {
    png: {
      '256': { path: '/achievement-assets/burned-256.png', width: 256, height: 256 },
      '512': { path: '/achievement-assets/burned-512.png', width: 512, height: 512 },
    },
  },
  locked: {
    png: {
      '256': { path: '/achievement-assets/burned-locked-256.png', width: 256, height: 256 },
      '512': { path: '/achievement-assets/burned-locked-512.png', width: 512, height: 512 },
    },
  },
};
const achievementCatalog = {
  revision: 'test-achievements-v1',
  presentation: {
    targetVisibleBadgeCount: 1,
    fillWithLockedCandidates: true,
    noDataFallbackTierIds: ['burned.burned100'],
  },
  families: [
    {
      key: 'burned',
      title: 'Burned',
      metricKey: 'mastery.burned',
      unit: 'cards',
      tiers: [
        {
          key: 'burned100',
          title: '100 items burned',
          threshold: 100,
          earnedDescription: 'One hundred cards reached burned.',
          description: 'Burn 100 cards.',
          assets: achievementAssets,
        },
      ],
    },
  ],
};
const emptyAchievementProgress: AchievementProgress = {
  revision: achievementCatalog.revision,
  metricValues: { 'mastery.burned': 99 },
  awards: [],
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

function resetStudyReviewSessionMocks() {
  vi.restoreAllMocks();
  startStudyLessonMock.mockReset();
  startStudyIntroductionCohortLessonMock.mockReset();
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
  getAchievementCatalogMock.mockReset();
  getAchievementCatalogMock.mockResolvedValue(achievementCatalog);
  getAchievementProgressMock.mockReset();
  getAchievementProgressMock.mockResolvedValue(emptyAchievementProgress);
  window.localStorage.clear();
}

function configureStudySessionStartMocks() {
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
  startStudyIntroductionCohortLessonMock.mockResolvedValue({
    overview: { ...baseOverview, newCount: 1 },
    cards: [
      {
        ...baseCardOne,
        state: { ...baseCardOne.state, dueAt: null, queueState: 'new' as const },
      },
    ],
  });
}

function configureStudyReviewMutationMocks() {
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
}

function configureStudyMediaEnvironment() {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  });
}

export function setUpStudyReviewSession() {
  resetStudyReviewSessionMocks();
  configureStudySessionStartMocks();
  configureStudyReviewMutationMocks();
  configureStudyMediaEnvironment();
}

export {
  emptyAchievementProgress,
  baseCardOne,
  baseCardTwo,
  baseOverview,
  cardActionMutateAsyncMock,
  createDeferred,
  createStudyReviewRequestMock,
  createWrapper,
  getAchievementCatalogMock,
  getAchievementProgressMock,
  prepareStudyAnswerAudioMock,
  reviewMutateAsyncMock,
  startStudyIntroductionCohortLessonMock,
  startStudyLessonMock,
  startStudySessionMock,
  undoStudyReviewMock,
  warmAudioCacheMock,
};
