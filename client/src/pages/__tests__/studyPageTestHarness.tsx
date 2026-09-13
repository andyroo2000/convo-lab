import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StudyOverview } from '@languageflow/shared/src/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KnownKanjiContextProvider } from '../../contexts/KnownKanjiContext';
import StudyPage from '../StudyPage';
import studyCapabilitiesFixture from '../../test/studyCapabilitiesFixture';

vi.mock('../../hooks/useStudyCapabilities', () => ({
  useStudyCapabilities: () => ({
    data: studyCapabilitiesFixture,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

export async function chooseAnswerAudioVoice(name: RegExp | string) {
  await userEvent.click(screen.getByLabelText('Answer audio voice'));
  await userEvent.click(await screen.findByRole('option', { name }));
}

const {
  cardActionMutateAsyncMock,
  startStudyLessonMock,
  startStudyIntroductionCohortLessonMock,
  startStudySessionMock,
  createStudyReviewRequestMock,
  prepareStudyAnswerAudioMock,
  undoStudyReviewMock,
  mutateAsyncMock,
  resolveStudyCardPitchAccentMock,
  updateStudyCardMock,
  deleteStudyCardMock,
  regenerateStudyAnswerAudioMock,
  studyOverviewData,
  studyOverviewLoading,
  featureFlagsData,
  featureFlagsLoading,
  masteryAnimationFinishesImmediately,
  reviewMutationError,
  getAchievementCatalogMock,
  getAchievementProgressMock,
} = vi.hoisted(() => ({
  cardActionMutateAsyncMock: vi.fn(),
  startStudyLessonMock: vi.fn(),
  startStudyIntroductionCohortLessonMock: vi.fn(),
  startStudySessionMock: vi.fn(),
  createStudyReviewRequestMock: vi.fn(),
  prepareStudyAnswerAudioMock: vi.fn(),
  undoStudyReviewMock: vi.fn(),
  mutateAsyncMock: vi.fn(),
  resolveStudyCardPitchAccentMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
  deleteStudyCardMock: vi.fn(),
  regenerateStudyAnswerAudioMock: vi.fn(),
  studyOverviewData: {
    current: {
      dueCount: 4,
      newCount: 6,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 18,
      newCardsAvailableToday: 2,
      learningCount: 2,
      reviewCount: 8,
      suspendedCount: 0,
      totalCards: 20,
    } as StudyOverview | undefined,
  },
  studyOverviewLoading: { current: false },
  featureFlagsData: {
    current: {
      id: 'default',
      dialoguesEnabled: false,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
      updatedAt: '2026-07-16T12:00:00.000Z',
    },
  },
  featureFlagsLoading: { current: false },
  masteryAnimationFinishesImmediately: { current: true },
  reviewMutationError: { current: null as Error | null },
  getAchievementCatalogMock: vi.fn(),
  getAchievementProgressMock: vi.fn(),
}));

export const getStudyPageTestState = () => ({
  cardActionMutateAsyncMock,
  createStudyReviewRequestMock,
  deleteStudyCardMock,
  featureFlagsData,
  featureFlagsLoading,
  getAchievementCatalogMock,
  getAchievementProgressMock,
  masteryAnimationFinishesImmediately,
  mutateAsyncMock,
  prepareStudyAnswerAudioMock,
  regenerateStudyAnswerAudioMock,
  resolveStudyCardPitchAccentMock,
  reviewMutationError,
  startStudyIntroductionCohortLessonMock,
  startStudyLessonMock,
  startStudySessionMock,
  studyOverviewData,
  studyOverviewLoading,
  undoStudyReviewMock,
  updateStudyCardMock,
});

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: featureFlagsData.current,
    isLoading: featureFlagsLoading.current,
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../hooks/useAchievements', () => ({
  default: () => ({
    catalog: null,
    progress: null,
    loading: true,
    error: null,
    progressError: null,
    retry: vi.fn(),
  }),
}));

vi.mock('../../hooks/useStudy', () => ({
  createStudyReviewRequest: createStudyReviewRequestMock,
  useStudyOverview: () => ({
    data: studyOverviewData.current,
    isLoading: studyOverviewLoading.current,
    error: null,
    refetch: vi.fn(),
  }),
  useSubmitStudyReview: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
    error: reviewMutationError.current,
  }),
  useStudyCardAction: () => ({
    mutateAsync: cardActionMutateAsyncMock,
    isPending: false,
  }),
  useUpdateStudyCard: () => ({
    mutateAsync: updateStudyCardMock,
    isPending: false,
    error: null,
    reset: vi.fn(),
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
    reset: vi.fn(),
  }),
  startStudyLesson: startStudyLessonMock,
  startStudyIntroductionCohortLesson: startStudyIntroductionCohortLessonMock,
  startStudySession: startStudySessionMock,
  prepareStudyAnswerAudio: prepareStudyAnswerAudioMock,
  resolveStudyCardPitchAccent: resolveStudyCardPitchAccentMock,
  undoStudyReview: undoStudyReviewMock,
}));

vi.mock('../../lib/achievementApi', () => ({
  getAchievementCatalog: getAchievementCatalogMock,
  getAchievementProgress: getAchievementProgressMock,
}));

vi.mock('../../components/study/studyTimeZoneUtils', () => ({
  default: () => 'America/New_York',
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'study-page-test-user' } }),
}));

vi.mock('../../components/common/VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => <span data-testid="voice-preview">{voiceId}</span>,
}));

vi.mock('../../components/study/MasteryReviewAnimation', async () => {
  const React = await import('react');

  return {
    default: function MasteryReviewAnimationStub({ onFinished }: { onFinished: () => void }) {
      React.useEffect(() => {
        if (masteryAnimationFinishesImmediately.current) {
          onFinished();
        }
      }, [onFinished]);

      return (
        <button type="button" data-testid="mastery-animation-stub" onClick={onFinished}>
          Finish mastery animation
        </button>
      );
    },
  };
});

export const renderStudyPage = ({
  knownKanji = [],
  knownKanjiActive = false,
}: {
  knownKanji?: string[];
  knownKanjiActive?: boolean;
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <KnownKanjiContextProvider active={knownKanjiActive} knownKanji={new Set(knownKanji)}>
        <BrowserRouter>
          <StudyPage />
        </BrowserRouter>
      </KnownKanjiContextProvider>
    </QueryClientProvider>
  );
};

export const baseCard = {
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
    dueAt: new Date().toISOString(),
    queueState: 'review' as const,
    scheduler: null,
    source: {},
  },
  answerAudioSource: 'imported' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export class MockDeviceMotionEvent extends Event {
  static requestPermission = vi.fn<() => Promise<'granted' | 'denied'>>(async () => 'granted');

  accelerationIncludingGravity: { x?: number | null; y?: number | null; z?: number | null } | null;

  acceleration: { x?: number | null; y?: number | null; z?: number | null } | null;

  constructor(
    type: string,
    init?: {
      accelerationIncludingGravity?: { x?: number | null; y?: number | null; z?: number | null };
      acceleration?: { x?: number | null; y?: number | null; z?: number | null };
    }
  ) {
    super(type);
    this.accelerationIncludingGravity = init?.accelerationIncludingGravity ?? null;
    this.acceleration = init?.acceleration ?? null;
  }
}

const pageAchievementAssets = {
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
export const pageAchievementCatalog = {
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
          assets: pageAchievementAssets,
        },
      ],
    },
  ],
};
export const pageEmptyAchievementProgress = {
  revision: pageAchievementCatalog.revision,
  metricValues: { 'mastery.burned': 99 },
  awards: [] as Array<{ id: string; earnedAt: string }>,
};

const resetStudyPageMocks = () => {
  vi.restoreAllMocks();
  getAchievementCatalogMock.mockReset();
  getAchievementCatalogMock.mockResolvedValue(pageAchievementCatalog);
  getAchievementProgressMock.mockReset();
  getAchievementProgressMock.mockResolvedValue(pageEmptyAchievementProgress);
  cardActionMutateAsyncMock.mockReset();
  startStudyLessonMock.mockReset();
  startStudyIntroductionCohortLessonMock.mockReset();
  startStudySessionMock.mockReset();
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
  prepareStudyAnswerAudioMock.mockReset();
  resolveStudyCardPitchAccentMock.mockReset();
  undoStudyReviewMock.mockReset();
  mutateAsyncMock.mockReset();
  updateStudyCardMock.mockReset();
  deleteStudyCardMock.mockReset();
  regenerateStudyAnswerAudioMock.mockReset();
  window.history.replaceState({}, '', '/app/study');
};

const configureStudyContentMocks = () => {
  prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => ({
    ...baseCard,
    id: cardId,
    answer: {
      ...baseCard.answer,
      answerAudio: {
        filename: `${cardId}.mp3`,
        url: `https://example.com/${cardId}.mp3`,
        mediaKind: 'audio',
        source: 'generated',
      },
    },
    answerAudioSource: 'generated',
  }));
  resolveStudyCardPitchAccentMock.mockImplementation(async (cardId: string) => ({
    ...baseCard,
    id: cardId,
    answer: { ...baseCard.answer, pitchAccent: null },
  }));
  undoStudyReviewMock.mockImplementation(async (reviewLogId: string) => ({
    reviewLogId,
    card: baseCard,
    overview: {
      dueCount: 4,
      newCount: 6,
      learningCount: 2,
      reviewCount: 8,
      suspendedCount: 0,
      totalCards: 20,
    },
  }));
  updateStudyCardMock.mockImplementation(
    async (payload: {
      cardId: string;
      prompt: Record<string, unknown>;
      answer: Record<string, unknown>;
    }) => ({ ...baseCard, id: payload.cardId, prompt: payload.prompt, answer: payload.answer })
  );
  regenerateStudyAnswerAudioMock.mockImplementation(
    async (payload: {
      cardId: string;
      answerAudioVoiceId?: string | null;
      answerAudioTextOverride?: string | null;
    }) => ({
      ...baseCard,
      id: payload.cardId,
      answerAudioSource: 'generated' as const,
      answer: {
        ...baseCard.answer,
        answerAudioVoiceId: payload.answerAudioVoiceId,
        answerAudioTextOverride: payload.answerAudioTextOverride,
        answerAudio: {
          filename: `${payload.cardId}-regenerated.mp3`,
          url: `https://example.com/${payload.cardId}-regenerated.mp3`,
          mediaKind: 'audio',
          source: 'generated',
        },
      },
    })
  );
};

const configureStudyCardActionMock = () => {
  cardActionMutateAsyncMock.mockImplementation(
    async (payload: {
      cardId: string;
      action: 'suspend' | 'unsuspend' | 'forget' | 'set_due';
      mode?: 'now' | 'tomorrow' | 'custom_date';
      dueAt?: string;
      timeZone?: string;
    }) => {
      if (payload.action === 'suspend') {
        return {
          card: {
            ...baseCard,
            id: payload.cardId,
            state: {
              ...baseCard.state,
              queueState: 'suspended',
            },
          },
          overview: {
            dueCount: 3,
            newCount: 6,
            learningCount: 2,
            reviewCount: 7,
            suspendedCount: 1,
            totalCards: 20,
          },
        };
      }

      if (payload.action === 'forget') {
        return {
          card: {
            ...baseCard,
            id: payload.cardId,
            state: {
              ...baseCard.state,
              queueState: 'new',
              dueAt: null,
            },
          },
          overview: {
            dueCount: 3,
            newCount: 7,
            learningCount: 2,
            reviewCount: 7,
            suspendedCount: 0,
            totalCards: 20,
          },
        };
      }

      return {
        card: {
          ...baseCard,
          id: payload.cardId,
          state: {
            ...baseCard.state,
            queueState: payload.mode === 'tomorrow' ? 'review' : baseCard.state.queueState,
            dueAt:
              payload.mode === 'tomorrow'
                ? new Date('2026-04-13T09:00:00.000Z').toISOString()
                : (payload.dueAt ?? baseCard.state.dueAt),
          },
        },
        overview: {
          dueCount: payload.mode === 'tomorrow' ? 3 : 4,
          newCount: 6,
          learningCount: 2,
          reviewCount: 8,
          suspendedCount: 0,
          totalCards: 20,
        },
      };
    }
  );
};

const configureStudyPageEnvironment = () => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, 'DeviceMotionEvent', {
    configurable: true,
    writable: true,
    value: MockDeviceMotionEvent,
  });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 1,
  });
  MockDeviceMotionEvent.requestPermission.mockClear();
  studyOverviewLoading.current = false;
  featureFlagsLoading.current = false;
  masteryAnimationFinishesImmediately.current = true;
  reviewMutationError.current = null;
  window.localStorage.clear();
  featureFlagsData.current = {
    id: 'default',
    dialoguesEnabled: false,
    scriptsEnabled: true,
    audioCourseEnabled: true,
    flashcardsEnabled: true,
    updatedAt: '2026-07-16T12:00:00.000Z',
  };
  studyOverviewData.current = {
    dueCount: 4,
    newCount: 6,
    newCardsPerDay: 20,
    newCardsIntroducedToday: 18,
    newCardsAvailableToday: 2,
    learningCount: 2,
    reviewCount: 8,
    suspendedCount: 0,
    totalCards: 20,
  };
};

export const createImportedTestAudio = (filename: string) => ({
  filename,
  url: `https://example.com/${filename}`,
  mediaKind: 'audio' as const,
  source: 'imported' as const,
});

export const createReturningFailedCard = () => ({
  ...baseCard,
  prompt: {
    cueAudio: createImportedTestAudio('prompt-card-1.mp3'),
  },
  answer: {
    ...baseCard.answer,
    answerAudio: createImportedTestAudio('answer-card-1.mp3'),
  },
});

export const createReturningNextCard = () => ({
  ...baseCard,
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
    answerAudio: createImportedTestAudio('answer-card-2.mp3'),
  },
});

export const configureReturningFailedCardSession = () => {
  const firstCard = createReturningFailedCard();
  const secondCard = createReturningNextCard();

  startStudySessionMock.mockResolvedValue({
    overview: {
      dueCount: 2,
      newCount: 0,
      learningCount: 0,
      reviewCount: 2,
      suspendedCount: 0,
      totalCards: 2,
    },
    cards: [firstCard, secondCard],
  });
  mutateAsyncMock.mockImplementation(
    async ({ cardId, grade }: { cardId: string; grade: 'again' | 'good' }) => ({
      reviewLogId: `review-${cardId}-${grade}`,
      card: cardId === 'card-1' ? firstCard : secondCard,
      overview: {
        dueCount: grade === 'again' ? 2 : 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: grade === 'again' ? 2 : 1,
        suspendedCount: 0,
        totalCards: 2,
      },
    })
  );
};

export const setUpStudyPageTest = () => {
  resetStudyPageMocks();
  configureStudyContentMocks();
  configureStudyCardActionMock();
  configureStudyPageEnvironment();
};
