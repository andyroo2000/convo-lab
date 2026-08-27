import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StudyOverview } from '@languageflow/shared/src/types';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KnownKanjiContextProvider } from '../../contexts/KnownKanjiContext';
import { JsonRequestError } from '../../lib/apiClient';
import StudyPage from '../StudyPage';

async function chooseAnswerAudioVoice(name: RegExp | string) {
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
  evaluateStudyMilestonesMock,
  presentStudyMilestonesMock,
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
  evaluateStudyMilestonesMock: vi.fn(),
  presentStudyMilestonesMock: vi.fn(),
}));

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
  resolveStudyCardPitchAccent: resolveStudyCardPitchAccentMock,
  undoStudyReview: undoStudyReviewMock,
}));

vi.mock('../../lib/studyMilestoneApi', () => ({
  evaluateStudyMilestones: evaluateStudyMilestonesMock,
  presentStudyMilestones: presentStudyMilestonesMock,
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

const renderStudyPage = ({
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

const baseCard = {
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

class MockDeviceMotionEvent extends Event {
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

describe('StudyPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    evaluateStudyMilestonesMock.mockReset();
    evaluateStudyMilestonesMock.mockResolvedValue({ milestones: [], pendingMilestones: [] });
    presentStudyMilestonesMock.mockReset();
    presentStudyMilestonesMock.mockResolvedValue(undefined);
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
      answer: {
        ...baseCard.answer,
        pitchAccent: null,
      },
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
      }) => ({
        ...baseCard,
        id: payload.cardId,
        prompt: payload.prompt,
        answer: payload.answer,
      })
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
  });

  it('renders overview counts without eagerly starting a study session', () => {
    renderStudyPage();

    expect(screen.getByRole('button', { name: 'Reviews' })).toBeInTheDocument();
    expect(screen.getByText('4 reviews')).toBeInTheDocument();
    expect(screen.getByText('20 cards total')).toBeInTheDocument();
    expect(screen.queryByText('Due')).not.toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText('Learning')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Browse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create Card' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cards' })).toHaveAttribute('href', '/app/study/cards');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/app/study/settings'
    );
    expect(screen.queryByRole('link', { name: 'History' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh counts' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to study')).not.toBeInTheDocument();
    expect(screen.queryByText('Available now')).not.toBeInTheDocument();
    expect(screen.queryByText('Load strategy')).not.toBeInTheDocument();
    expect(screen.queryByText('Keyboard')).not.toBeInTheDocument();
    expect(startStudySessionMock).not.toHaveBeenCalled();
  });

  it('associates the disabled Reviews button with the empty-state message', () => {
    studyOverviewData.current = {
      dueCount: 0,
      newCount: 0,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 20,
      newCardsAvailableToday: 0,
      learningCount: 0,
      reviewCount: 0,
      suspendedCount: 0,
      totalCards: 20,
    };

    renderStudyPage();

    const emptyMessage = 'Open Cards to create your first card and start studying here.';
    const beginButton = screen.getByRole('button', { name: 'Reviews' });
    const emptyState = screen.getByText(emptyMessage);
    expect(beginButton).toBeDisabled();
    expect(beginButton.getAttribute('aria-describedby')?.split(' ')).toContain(emptyState.id);
    expect(beginButton).toHaveAccessibleDescription(`0 reviews All caught up ${emptyMessage}`);
    expect(beginButton).not.toHaveAttribute('title');
  });

  it('does not report future failed retries as reviews that are due', () => {
    studyOverviewData.current = {
      dueCount: 0,
      failedCount: 8,
      failedDueCount: 0,
      newCount: 0,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 20,
      newCardsAvailableToday: 0,
      learningCount: 8,
      reviewCount: 0,
      suspendedCount: 0,
      totalCards: 8,
      nextDueAt: '2999-07-29T12:00:00.000Z',
    };

    renderStudyPage();

    expect(screen.getByText('0 reviews')).toBeInTheDocument();
    expect(screen.queryByText('8 reviews')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reviews' })).toBeDisabled();
  });

  it('includes failed retries whose due time has arrived', () => {
    studyOverviewData.current = {
      dueCount: 2,
      failedCount: 8,
      failedDueCount: 3,
      newCount: 0,
      learningCount: 8,
      reviewCount: 2,
      suspendedCount: 0,
      totalCards: 10,
    };

    renderStudyPage();

    expect(screen.getByText('5 reviews')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reviews' })).toBeEnabled();
  });

  it('points to Lessons when reviews are exhausted but new cards remain', () => {
    studyOverviewData.current = {
      dueCount: 0,
      newCount: 6,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 0,
      newCardsAvailableToday: 6,
      learningCount: 0,
      reviewCount: 0,
      suspendedCount: 0,
      totalCards: 6,
    };

    renderStudyPage();

    expect(screen.getByRole('button', { name: 'Reviews' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lessons' })).toBeEnabled();
    expect(
      screen.getByText('No reviews are due. You can start a Lesson whenever you’re ready.')
    ).toBeInTheDocument();
  });

  it('finishes a lesson when its last quiz card is buried', async () => {
    startStudyLessonMock.mockResolvedValue({
      overview: {
        dueCount: 0,
        newCount: 1,
        newCardsPerDay: 20,
        newCardsAvailableToday: 1,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          state: {
            ...baseCard.state,
            queueState: 'new',
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lessons' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Start quiz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bury for session' }));

    expect(screen.getByText('Lesson complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Learn another batch' })).toBeInTheDocument();
  });

  it('keeps the last lesson card and feedback lane visible until mastery feedback finishes', async () => {
    masteryAnimationFinishesImmediately.current = false;
    startStudyLessonMock.mockResolvedValue({
      overview: {
        dueCount: 0,
        newCount: 1,
        newCardsPerDay: 20,
        newCardsAvailableToday: 1,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          state: {
            ...baseCard.state,
            queueState: 'new',
          },
        },
      ],
    });
    mutateAsyncMock.mockResolvedValue({
      reviewLogId: 'lesson-review-1',
      card: {
        ...baseCard,
        masteryLevel: 'guru',
        state: {
          ...baseCard.state,
          dueAt: '2026-08-01T12:00:00.000Z',
          queueState: 'learning',
        },
      },
      overview: {
        dueCount: 0,
        newCount: 0,
        learningCount: 1,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lessons' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Start quiz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: /Good/ }));

    expect(
      within(screen.getByTestId('mastery-feedback-lane')).getByTestId('mastery-animation-stub')
    ).toBeInTheDocument();
    expect(screen.getByTestId('study-focus-card-scroll')).toBeInTheDocument();
    expect(screen.queryByText('Lesson complete')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Finish mastery animation' }));

    expect(await screen.findByText('Lesson complete')).toBeInTheDocument();
  });

  it('offers a retry only for an ambiguous review result', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: studyOverviewData.current,
      cards: [baseCard],
    });
    mutateAsyncMock.mockImplementationOnce(async () => {
      reviewMutationError.current = new TypeError('Network connection lost');
      throw reviewMutationError.current;
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: /Good/ }));

    expect(await screen.findByRole('button', { name: 'Retry this review' })).toBeInTheDocument();
  });

  it('shows conflict recovery without offering a fresh review submission', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: studyOverviewData.current,
      cards: [baseCard],
    });
    mutateAsyncMock.mockImplementationOnce(async () => {
      reviewMutationError.current = new JsonRequestError('Out of order. (409)', 409, {
        code: 'review_out_of_order',
      });
      throw reviewMutationError.current;
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: /Good/ }));

    expect(
      await screen.findByText(
        'Review status changed on the server. Your Study session was refreshed.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry this review' })).not.toBeInTheDocument();
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('previews one lesson card at a time before starting the isolated quiz', async () => {
    const secondCard = {
      ...baseCard,
      id: 'card-2',
      noteId: 'note-2',
      prompt: { cueText: '学校', cueReading: 'がっこう' },
      answer: {
        expression: '学校',
        expressionReading: '学校[がっこう]',
        meaning: 'school',
      },
      state: {
        ...baseCard.state,
        queueState: 'new' as const,
      },
    };
    startStudyLessonMock.mockResolvedValue({
      overview: {
        dueCount: 0,
        newCount: 2,
        newCardsPerDay: 20,
        newCardsAvailableToday: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 2,
      },
      cards: [
        {
          ...baseCard,
          state: {
            ...baseCard.state,
            queueState: 'new' as const,
          },
        },
        secondCard,
      ],
    });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => {
      const card = cardId === secondCard.id ? secondCard : baseCard;
      return {
        ...card,
        answer: {
          ...card.answer,
          answerAudio: {
            filename: `${cardId}.mp3`,
            url: `https://example.com/${cardId}.mp3`,
            mediaKind: 'audio' as const,
            source: 'generated' as const,
          },
        },
        answerAudioSource: 'generated' as const,
      };
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lessons' }));

    expect(await screen.findByText('Card 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('会社')).toBeInTheDocument();
    expect(screen.queryByText('学校')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Start quiz' })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('学校')).toBeInTheDocument();
    expect(screen.queryByText('会社')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
  });

  it('autoplays an audio-recognition prompt when the lesson quiz starts', async () => {
    startStudyLessonMock.mockResolvedValue({
      overview: {
        dueCount: 0,
        newCount: 1,
        newCardsPerDay: 20,
        newCardsAvailableToday: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'lesson-prompt.mp3',
              url: 'https://example.com/lesson-prompt.mp3',
              mediaKind: 'audio' as const,
              source: 'imported' as const,
            },
          },
          state: {
            ...baseCard.state,
            queueState: 'new' as const,
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lessons' }));

    expect(await screen.findByText('Card 1 of 1')).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Start quiz' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps Reviews enabled while overview counts are loading', () => {
    studyOverviewLoading.current = true;
    studyOverviewData.current = undefined;

    renderStudyPage();

    const beginButton = screen.getByRole('button', { name: 'Reviews' });
    expect(beginButton).toBeEnabled();
    expect(beginButton).toHaveAccessibleDescription('0 reviews All caught up');
    expect(screen.getByText('Loading overview…')).toBeInTheDocument();
    expect(
      screen.queryByText('Open Cards to create your first card and start studying here.')
    ).not.toBeInTheDocument();
  });

  it('starts the study session only when Reviews is clicked', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    expect(startStudySessionMock).toHaveBeenCalledWith();
    expect(screen.getByText('Click or push space to reveal')).toBeInTheDocument();
    expect(screen.getByText('Tap to reveal')).toBeInTheDocument();
    expect(screen.getByTestId('study-review-header')).toHaveTextContent(
      '0Failed1Queued0NewEnd session'
    );
    expect(screen.getByTestId('study-review-metrics')).not.toHaveClass('border-b');
    expect(screen.getByRole('group', { name: '0 failed, 1 queued, 0 new' })).toBeInTheDocument();
    expect(screen.getByTestId('study-focus-shell')).toHaveClass('study-focus-shell');
    expect(screen.getByTestId('study-focus-shell')).toHaveClass('overflow-x-hidden');
    expect(screen.getByTestId('mastery-feedback-lane')).toHaveClass('mastery-feedback-lane');
    expect(screen.getByTestId('study-focus-card-scroll')).toHaveClass(
      'study-focus-scroll',
      'overflow-x-hidden',
      'pb-0'
    );
    expect(screen.getByTestId('study-focus-card-scroll').className).not.toContain('pb-24');
  });

  it('keeps grade controls accessible separately from revealed-card maintenance actions', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [
        {
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'answer.mp3',
              url: 'https://example.com/answer.mp3',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    const gradeTray = screen.getByTestId('study-grade-tray');
    expect(screen.getByTestId('study-focus-shell')).toHaveClass(
      'study-focus-shell',
      'h-[100dvh]',
      'min-h-0'
    );
    expect(screen.getByTestId('study-focus-card-scroll')).toHaveClass(
      'study-focus-scroll',
      'min-h-0',
      'overflow-y-auto',
      'overflow-x-hidden',
      'md:pb-16'
    );
    expect(gradeTray).toHaveClass('fixed');
    expect(gradeTray.className).not.toContain('md:static');
    expect(screen.getByTestId('study-grade-tray-inner')).toHaveClass('mx-auto', 'max-w-7xl');
    expect(gradeTray.className).not.toContain('md:pb-6');
    const againButton = within(gradeTray).getByRole('button', { name: /again/i });
    expect(againButton).toHaveClass('md:min-h-[2.25rem]');
    expect(againButton.className).not.toContain('md:min-h-[8.25rem]');
    expect(againButton).toBeInTheDocument();
    expect(within(gradeTray).getByRole('button', { name: 'Replay answer audio' })).toHaveClass(
      'md:min-h-[2.25rem]'
    );
    expect(within(gradeTray).getByRole('button', { name: /hard/i })).toBeInTheDocument();
    expect(within(gradeTray).getByRole('button', { name: /good/i })).toBeInTheDocument();
    expect(within(gradeTray).getByRole('button', { name: /easy/i })).toBeInTheDocument();
    expect(within(gradeTray).queryByRole('button', { name: 'Edit card' })).not.toBeInTheDocument();

    const reviewHeader = screen.getByTestId('study-review-header');
    const reviewActions = within(reviewHeader).getByTestId('study-review-actions');
    expect(within(reviewActions).getByRole('button', { name: 'Edit card' })).toBeInTheDocument();
    expect(within(reviewActions).getByRole('button', { name: 'Set due' })).toBeInTheDocument();
    expect(within(gradeTray).getByRole('button', { name: 'Replay answer audio' })).toBeEnabled();
  });

  it('autoplays prompt audio and reuses it on reveal without generating duplicate audio', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [
        {
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'listening.mp3',
              url: 'https://example.com/listening.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
          answer: {
            ...baseCard.answer,
            answerAudio: null,
          },
          answerAudioSource: 'missing',
        },
      ],
    });
    prepareStudyAnswerAudioMock.mockResolvedValue({
      ...baseCard,
      prompt: {
        cueAudio: {
          filename: 'listening.mp3',
          url: 'https://example.com/listening.mp3',
          mediaKind: 'audio',
          source: 'imported',
        },
      },
      answer: {
        ...baseCard.answer,
        answerAudio: {
          filename: 'answer.mp3',
          url: 'https://example.com/answer.mp3',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      answerAudioSource: 'generated',
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    expect(prepareStudyAnswerAudioMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Replay answer audio' })).toBeEnabled();
    });
  });

  it('replays prompt audio button clicks without revealing audio-led cards', async () => {
    const audioPrompt = {
      cueAudio: {
        filename: 'listening.mp3',
        url: 'https://example.com/listening.mp3',
        mediaKind: 'audio' as const,
        source: 'imported' as const,
      },
    };
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [
        {
          ...baseCard,
          prompt: audioPrompt,
        },
      ],
    });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => ({
      ...baseCard,
      id: cardId,
      prompt: audioPrompt,
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

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });
    const promptAudio = screen
      .getAllByLabelText('Replay prompt audio')
      .find((element): element is HTMLAudioElement => element instanceof HTMLAudioElement);
    expect(promptAudio).not.toBeNull();
    fireEvent.ended(promptAudio!);

    await userEvent.click(screen.getByRole('button', { name: 'Replay prompt audio' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('company')).not.toBeInTheDocument();
    expect(screen.getByText('Click or push space to reveal')).toBeInTheDocument();
    expect(screen.getByText('Tap to reveal')).toBeInTheDocument();
  });

  it('uses Space to reveal audio-led cards from the front side', async () => {
    const audioPrompt = {
      cueAudio: {
        filename: 'listening.mp3',
        url: 'https://example.com/listening.mp3',
        mediaKind: 'audio' as const,
        source: 'imported' as const,
      },
    };
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [
        {
          ...baseCard,
          prompt: audioPrompt,
        },
      ],
    });
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => ({
      ...baseCard,
      id: cardId,
      prompt: audioPrompt,
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

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(window, { code: 'Space' });

    await waitFor(() => {
      expect(screen.getByText('company')).toBeInTheDocument();
    });
    expect(screen.queryByText('Click or push space to reveal')).not.toBeInTheDocument();
    expect(screen.queryByText('Tap to reveal')).not.toBeInTheDocument();
  });

  it('autoplays existing answer audio immediately when revealing a card', async () => {
    const originalPlayDescriptor = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      'play'
    );
    const playMock = vi.fn().mockImplementation(() => new Promise<void>(() => {}));
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });

    try {
      startStudySessionMock.mockResolvedValue({
        overview: {
          dueCount: 1,
          newCount: 0,
          learningCount: 0,
          reviewCount: 1,
          suspendedCount: 0,
          totalCards: 1,
        },
        cards: [
          {
            ...baseCard,
            answer: {
              ...baseCard.answer,
              answerAudio: {
                filename: 'answer.mp3',
                url: 'https://example.com/answer.mp3',
                mediaKind: 'audio',
                source: 'generated',
              },
            },
            answerAudioSource: 'generated',
          },
        ],
      });

      renderStudyPage();
      await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

      await waitFor(() => {
        expect(startStudySessionMock).toHaveBeenCalledTimes(1);
      });
      expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

      expect(playMock).toHaveBeenCalledTimes(1);
      expect(prepareStudyAnswerAudioMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Replay answer audio' }));

      expect(playMock).toHaveBeenCalledTimes(2);
    } finally {
      if (originalPlayDescriptor) {
        Object.defineProperty(HTMLMediaElement.prototype, 'play', originalPlayDescriptor);
      }
    }
  });

  it('uses space to restart answer audio after reveal', async () => {
    const playMock = vi.fn().mockImplementation(() => Promise.resolve());
    const pauseMock = vi.fn();

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pauseMock,
    });

    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'answer.mp3',
              url: 'https://example.com/answer.mp3',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
          answerAudioSource: 'generated',
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Good/ })).toBeInTheDocument();
    });
    const answerAudio = screen
      .getAllByLabelText('Play answer audio')
      .find((element): element is HTMLAudioElement => element instanceof HTMLAudioElement);
    expect(answerAudio).not.toBeNull();
    fireEvent.play(answerAudio!);

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(3);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(4);
    });
  });

  it('keeps Space benign after reveal when the card has no answer audio', async () => {
    prepareStudyAnswerAudioMock.mockImplementation(async (cardId: string) => ({
      ...baseCard,
      id: cardId,
      answerAudioSource: 'missing' as const,
    }));
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });
    mutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-1',
      card: {
        ...baseCard,
        state: {
          ...baseCard.state,
          queueState: 'review' as const,
        },
      },
      overview: {
        dueCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Good/ })).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { code: 'Space' });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          grade: 'good',
        })
      );
    });
  });

  it('replays audio and accepts keyboard grading when failed cards return', async () => {
    const firstCard = {
      ...baseCard,
      prompt: {
        cueAudio: {
          filename: 'prompt-card-1.mp3',
          url: 'https://example.com/prompt-card-1.mp3',
          mediaKind: 'audio',
          source: 'imported',
        },
      },
      answer: {
        ...baseCard.answer,
        answerAudio: {
          filename: 'answer-card-1.mp3',
          url: 'https://example.com/answer-card-1.mp3',
          mediaKind: 'audio',
          source: 'imported',
        },
      },
    };
    const secondCard = {
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
        answerAudio: {
          filename: 'answer-card-2.mp3',
          url: 'https://example.com/answer-card-2.mp3',
          mediaKind: 'audio',
          source: 'imported',
        },
      },
    };

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

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    });

    fireEvent.keyDown(window, { code: 'Digit1', key: '1' });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          grade: 'again',
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('学校')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-2',
          grade: 'good',
        })
      );
    });

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(4);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(5);
    });

    const focusedAnswerAudio = screen
      .getAllByLabelText('Play answer audio')
      .find((element): element is HTMLAudioElement => element instanceof HTMLAudioElement);
    expect(focusedAnswerAudio).not.toBeNull();
    // Native audio controls can consume event.key; code-based fallback should still grade.
    fireEvent.keyDown(focusedAnswerAudio!, { code: 'Digit3', key: '' });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          grade: 'good',
        })
      );
    });
  });

  it('renders media-led prompt cards without leaking helper meaning text on the front', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [
        {
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'listening.mp3',
              url: 'https://example.com/listening.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
            cueImage: {
              filename: 'prompt.png',
              url: 'https://example.com/prompt.png',
              mediaKind: 'image',
              source: 'imported_image',
            },
            cueMeaning: 'this should stay hidden',
          },
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'answer.mp3',
              url: 'https://example.com/answer.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText('this should stay hidden')).not.toBeInTheDocument();
    expect(screen.getByAltText('Study prompt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play prompt audio' })).toBeInTheDocument();
  });

  it('renders image-front cards as image-only prompts', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [
        {
          ...baseCard,
          cardType: 'production' as const,
          prompt: {
            cueImage: {
              filename: 'prompt.png',
              url: 'https://example.com/prompt.png',
              mediaKind: 'image',
              source: 'imported_image',
            },
            cueMeaning: 'also hidden',
          },
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'answer.mp3',
              url: 'https://example.com/answer.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByAltText('Study prompt')).toBeInTheDocument();
    expect(screen.queryByText('also hidden')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play prompt audio' })).not.toBeInTheDocument();
  });

  it('undoes a reveal with command-z', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    expect(screen.getByText('company')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', metaKey: true });

    await waitFor(() => {
      expect(screen.queryByText('company')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Reveal answer' })).toBeInTheDocument();
  });

  it('undoes a reveal when the device is shaken on mobile', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await waitFor(() => {
      expect(MockDeviceMotionEvent.requestPermission).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    expect(screen.getByText('company')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(
        new MockDeviceMotionEvent('devicemotion', {
          accelerationIncludingGravity: { x: 2, y: 2, z: 2 },
        })
      );
      window.dispatchEvent(
        new MockDeviceMotionEvent('devicemotion', {
          accelerationIncludingGravity: { x: 12, y: 10, z: 10 },
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('company')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Reveal answer' })).toBeInTheDocument();
  });

  it('hides the unsupported shake-to-undo warning on non-motion devices', async () => {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: 0,
    });
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.queryByText('Shake to undo is not available on this device.')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable motion' })).not.toBeInTheDocument();
  });

  it('shows the motion permission affordance when device-motion access is denied', async () => {
    MockDeviceMotionEvent.requestPermission.mockResolvedValueOnce('denied');
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 4,
        newCount: 6,
        learningCount: 2,
        reviewCount: 8,
        suspendedCount: 0,
        totalCards: 20,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(
        screen.getByText('Shake to undo is off because motion access was denied.')
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('undoes a graded card with command-z and restores the previous revealed card', async () => {
    startStudySessionMock.mockResolvedValueOnce({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });
    mutateAsyncMock.mockResolvedValue({
      reviewLogId: 'review-1',
      card: {
        ...baseCard,
        state: {
          ...baseCard.state,
          queueState: 'review',
        },
      },
      overview: {
        dueCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
    });
    undoStudyReviewMock.mockResolvedValue({
      reviewLogId: 'review-1',
      card: baseCard,
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: /good/i }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/Nice work/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', metaKey: true });

    await waitFor(() => {
      expect(undoStudyReviewMock).toHaveBeenCalledWith(
        'review-1',
        expect.objectContaining({
          dueCount: 1,
          reviewCount: 1,
        })
      );
    });
    expect(screen.getByText('company')).toBeInTheDocument();
    expect(screen.queryByText(/Nice work/i)).not.toBeInTheDocument();
  });

  it('renders cloze cards with masked front text and restored furigana answer text', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          id: 'cloze-1',
          cardType: 'cloze',
          prompt: {
            clozeText: 'お風呂に虫{{c1::がいる::are (existence verb)}}！',
            clozeDisplayText: 'お風呂に虫[...]！',
            clozeAnswerText: 'がいる',
            clozeHint: 'backup hint',
            clozeResolvedHint: 'are (existence verb)',
          },
          answer: {
            restoredText: 'お風呂に虫がいる！',
            restoredTextReading: 'お風呂[ふろ]に虫[むし]がいる！',
            meaning: 'There are bugs in the bath!',
            notes: 'お風呂[ふろ]に虫[むし]がいる！',
            answerAudio: {
              filename: 'cloze.mp3',
              url: 'https://example.com/cloze.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
          answerAudioSource: 'imported',
        },
      ],
    });

    renderStudyPage({ knownKanji: ['風', '呂', '虫'], knownKanjiActive: true });
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));

    await waitFor(() => {
      expect(screen.getByTestId('study-cloze-prompt')).toBeInTheDocument();
    });
    const clozePrompt = screen.getByTestId('study-cloze-prompt');
    expect(clozePrompt).toHaveTextContent('お風呂ふろに虫むし[...]！');
    expect(screen.getByText('backup hint')).toBeInTheDocument();
    expect(screen.queryByText('are (existence verb)')).not.toBeInTheDocument();
    expect(screen.queryByText('Click or push space to reveal')).not.toBeInTheDocument();
    expect(screen.queryByText('Tap to reveal')).not.toBeInTheDocument();
    expect(
      screen.queryByText('お風呂に虫{{c1::がいる::are (existence verb)}}！')
    ).not.toBeInTheDocument();

    const bathReading = within(clozePrompt).getByText('ふろ', { selector: 'rt' });
    expect(bathReading).toHaveClass('opacity-0');
    await userEvent.click(within(clozePrompt).getByRole('button', { name: '風呂' }));
    expect(bathReading).not.toHaveClass('opacity-0');
    expect(screen.queryByText('There are bugs in the bath!')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reveal answer' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    await waitFor(() => {
      expect(screen.getByText('There are bugs in the bath!')).toBeInTheDocument();
    });
    const restoredHeading = screen.getByTestId('study-cloze-heading');
    expect(within(restoredHeading).getByText('ふろ', { selector: 'rt' })).toBeInTheDocument();
    expect(within(restoredHeading).getByText('むし', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.queryByText('• お風呂[ふろ]に虫[むし]がいる！')).not.toBeInTheDocument();
    expect(screen.getAllByText('ふろ', { selector: 'rt' })).toHaveLength(2);
    expect(screen.getAllByText('むし', { selector: 'rt' })).toHaveLength(2);
  });

  it('decodes numeric html entities in study text', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          id: 'entity-1',
          answer: {
            ...baseCard.answer,
            meaning: 'Someone, please come. It&#x27;s an accident.',
            answerAudio: {
              filename: 'entity-1.mp3',
              url: 'https://example.com/entity-1.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    await waitFor(() => {
      expect(screen.getByText("Someone, please come. It's an accident.")).toBeInTheDocument();
    });
    expect(
      screen.queryByText('Someone, please come. It&#x27;s an accident.')
    ).not.toBeInTheDocument();
  });

  it('keeps furigana aligned to kanji when particles and okurigana surround bracket readings', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          id: 'furigana-1',
          answer: {
            ...baseCard.answer,
            expression: '彼は深く息を吸っています',
            expressionReading: '彼[かれ]は深[ふか]く息[いき]を吸[す]っています',
            answerAudio: {
              filename: 'furigana-1.mp3',
              url: 'https://example.com/furigana-1.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    await waitFor(() => {
      expect(screen.getByText('company')).toBeInTheDocument();
    });

    const heading = screen.getByTestId('study-japanese-heading');
    expect(within(heading).getByText('かれ', { selector: 'rt' })).toBeInTheDocument();
    expect(within(heading).getByText('ふか', { selector: 'rt' })).toBeInTheDocument();
    expect(within(heading).getByText('いき', { selector: 'rt' })).toBeInTheDocument();
    expect(within(heading).getByText('す', { selector: 'rt' })).toBeInTheDocument();
    expect(within(heading).queryByText('は深', { selector: 'ruby' })).not.toBeInTheDocument();
  });

  it('opens an in-place editor on the answer side and returns to the front after save', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'card-1.mp3',
              url: 'https://example.com/card-1.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit card' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Edit card' }));

    const meaningInput = screen.getByLabelText('Answer meaning');
    await userEvent.clear(meaningInput);
    await userEvent.type(meaningInput, 'business');

    await userEvent.click(screen.getByRole('button', { name: 'Save card' }));

    await waitFor(() => {
      expect(updateStudyCardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          answer: expect.objectContaining({
            meaning: 'business',
          }),
        })
      );
    });

    expect(screen.getByRole('button', { name: 'Reveal answer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save card' })).not.toBeInTheDocument();
  });

  it('closes the delete confirmation and shows an error when card deletion fails', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });
    deleteStudyCardMock.mockRejectedValue(new Error('Delete failed.'));

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit card' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete card' }));

    expect(screen.getByText('Delete this card? This cannot be undone.')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('modal-button-confirm'));

    await waitFor(() => {
      expect(deleteStudyCardMock).toHaveBeenCalledWith('card-1');
    });
    await waitFor(() => {
      expect(
        screen.queryByText('Delete this card? This cannot be undone.')
      ).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Delete failed.')).toHaveLength(1);
  });

  it('deletes the current card from the review session after confirmation', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit card' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete card' }));
    await userEvent.click(screen.getByTestId('modal-button-confirm'));

    await waitFor(() => {
      expect(deleteStudyCardMock).toHaveBeenCalledWith('card-1');
    });
    await waitFor(() => {
      expect(
        screen.getByText(
          'No cards are ready right now. Import more cards or come back when something is due.'
        )
      ).toBeInTheDocument();
    });
    expect(screen.queryByText('Delete this card? This cannot be undone.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reveal answer' })).not.toBeInTheDocument();
    expect(screen.queryByText('company')).not.toBeInTheDocument();
  });

  it('regenerates answer audio from the in-place editor', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [
        {
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudioVoiceId: 'ja-JP-Wavenet-D',
            answerAudioTextOverride: 'かいしゃ',
            answerAudio: {
              filename: 'card-1.mp3',
              url: 'https://example.com/card-1.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        },
      ],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit card' }));

    expect(screen.getByLabelText('Answer audio voice')).toHaveTextContent('Naoki');
    expect(screen.getByLabelText('Phonetic audio override')).toHaveValue('かいしゃ');
    const currentAudio = screen.getByLabelText('Current card audio');
    const answerAudioVoice = screen.getByLabelText('Answer audio voice');
    expect(currentAudio).toBeInTheDocument();
    expect(currentAudio).toAppearBefore(answerAudioVoice);
    expect(screen.getByTestId('study-editor-answer-audio-source')).toHaveAttribute(
      'src',
      'https://example.com/card-1.mp3'
    );

    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    await chooseAnswerAudioVoice(/Sato/);
    await userEvent.clear(screen.getByLabelText('Phonetic audio override'));
    await userEvent.type(screen.getByLabelText('Phonetic audio override'), 'かぶしきがいしゃ');
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));

    await waitFor(() => {
      expect(regenerateStudyAnswerAudioMock).toHaveBeenCalledWith({
        cardId: 'card-1',
        answerAudioVoiceId: 'fishaudio:875668667eb94c20b09856b971d9ca2f',
        answerAudioTextOverride: 'かぶしきがいしゃ',
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('study-editor-answer-audio-source')).toHaveAttribute(
        'src',
        'https://example.com/card-1-regenerated.mp3'
      );
    });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });
  });

  it('buries the current card for the session and restores it with Cmd+Z', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bury for session' }));

    expect(
      screen.getByText(
        'No cards are ready right now. Import more cards or come back when something is due.'
      )
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', metaKey: true });

    expect(await screen.findByRole('button', { name: 'Bury for session' })).toBeInTheDocument();
  });

  it('suspends a revealed card and removes it from the active session', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    await waitFor(() => {
      expect(cardActionMutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          action: 'suspend',
        })
      );
    });

    expect(
      screen.getByText(
        'No cards are ready right now. Import more cards or come back when something is due.'
      )
    ).toBeInTheDocument();
  });

  it('sends the device timezone when setting a revealed card due tomorrow', async () => {
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [baseCard],
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Set due' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));

    await waitFor(() => {
      expect(cardActionMutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          action: 'set_due',
          mode: 'tomorrow',
          timeZone: 'America/New_York',
        })
      );
    });
  });

  it('shows the session wrap-up and practices toughest cards without new reviews', async () => {
    const cardBefore = {
      ...baseCard,
      state: {
        ...baseCard.state,
        scheduler: {
          due: '2026-08-25T12:00:00.000Z',
          stability: 6,
          difficulty: 5,
          elapsed_days: 3,
          scheduled_days: 6,
          learning_steps: 0,
          reps: 4,
          lapses: 0,
          state: 2,
          last_review: '2026-08-19T12:00:00.000Z',
        },
      },
    };
    startStudySessionMock.mockResolvedValue({
      overview: {
        dueCount: 1,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
      },
      cards: [cardBefore],
    });
    mutateAsyncMock.mockResolvedValueOnce({
      reviewLogId: 'review-wrap-up',
      card: {
        ...cardBefore,
        state: {
          ...cardBefore.state,
          dueAt: '2026-09-02T12:00:00.000Z',
          scheduler: {
            ...cardBefore.state.scheduler,
            due: '2026-09-02T12:00:00.000Z',
            stability: 8,
            scheduled_days: 8,
          },
        },
      },
      overview: {
        dueCount: 0,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 1,
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByText('Nice work')).toBeInTheDocument();
    expect(screen.getByText('First-pass recall')).toBeInTheDocument();
    expect(screen.queryByText(/Ranked using/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Practice 1' }));
    expect(screen.getByText('Practice only')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByText('Practice complete')).toBeInTheDocument();
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('shows a partial wrap-up when ending a review session with cards remaining', async () => {
    const remainingCard = {
      ...baseCard,
      id: 'card-2',
      noteId: 'note-2',
      prompt: { cueText: '学校', cueReading: 'がっこう' },
      answer: {
        expression: '学校',
        expressionReading: '学校[がっこう]',
        meaning: 'school',
      },
    };
    startStudySessionMock.mockResolvedValueOnce({
      overview: {
        dueCount: 2,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 2,
        suspendedCount: 0,
        totalCards: 2,
      },
      cards: [baseCard, remainingCard],
    });
    mutateAsyncMock.mockResolvedValueOnce({
      reviewLogId: 'review-before-early-exit',
      card: {
        ...baseCard,
        state: { ...baseCard.state, dueAt: '2026-09-25T12:00:00.000Z' },
      },
      overview: {
        dueCount: 1,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 2,
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Good' }));
    await userEvent.click(await screen.findByRole('button', { name: 'End session' }));

    expect(await screen.findByText('Nice work')).toBeInTheDocument();
    expect(screen.getByText('Here’s what you reviewed this session.')).toBeInTheDocument();
    expect(screen.queryByText('学校')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('study-session-wrap-up')).getByText('1', { selector: 'p' })
    ).toBeInTheDocument();
  });

  it('awards the Orbit milestone before wrap-up and moves it into recent milestones', async () => {
    evaluateStudyMilestonesMock
      .mockResolvedValueOnce({ milestones: [], pendingMilestones: [] })
      .mockResolvedValueOnce({ milestones: [], pendingMilestones: [] })
      .mockResolvedValueOnce({
        milestones: [
          {
            id: 'burned100',
            earnedAt: '2026-08-25T12:00:00.000Z',
            presentedAt: null,
          },
        ],
        pendingMilestones: [
          {
            id: 'burned100',
            earnedAt: '2026-08-25T12:00:00.000Z',
            presentedAt: null,
          },
        ],
      });
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList
    );
    startStudySessionMock.mockResolvedValueOnce({
      overview: {
        dueCount: 1,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 100,
        masterySpread: { apprentice: 0, guru: 0, master: 0, enlightened: 1, burned: 99 },
      },
      cards: [{ ...baseCard, masteryLevel: 'enlightened' }],
    });
    mutateAsyncMock.mockResolvedValueOnce({
      reviewLogId: 'review-burned-100',
      card: {
        ...baseCard,
        masteryLevel: 'burned',
        state: { ...baseCard.state, dueAt: '2027-08-25T12:00:00.000Z' },
      },
      overview: {
        dueCount: 0,
        failedCount: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
        suspendedCount: 0,
        totalCards: 100,
        masterySpread: { apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 100 },
      },
    });

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reviews' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByTestId('study-milestone-award')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '100 items burned' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Nice work')).toBeInTheDocument();
    expect(screen.getByTestId('study-recent-milestones')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByTestId('study-recent-milestones')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Recent milestones/ })).toHaveAttribute(
      'href',
      '/app/study/milestones'
    );
  });

  it('opens a requested lesson-follow-up cohort directly in lesson preview', async () => {
    startStudyIntroductionCohortLessonMock.mockResolvedValue({
      overview: studyOverviewData.current,
      cards: [{ ...baseCard, state: { ...baseCard.state, queueState: 'new' } }],
    });
    window.history.replaceState({}, '', '/app/study?lessonCohortId=01k00000000000000000000000');

    renderStudyPage();

    await waitFor(() =>
      expect(startStudyIntroductionCohortLessonMock).toHaveBeenCalledWith(
        '01k00000000000000000000000'
      )
    );
    expect(await screen.findByText('Preview this lesson')).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has('lessonCohortId')).toBe(false);
  });
});
