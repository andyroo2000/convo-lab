import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StudyOverview } from '@languageflow/shared/src/types';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StudyPage from '../StudyPage';

const {
  cardActionMutateAsyncMock,
  startStudySessionMock,
  prepareStudyAnswerAudioMock,
  undoStudyReviewMock,
  mutateAsyncMock,
  updateStudyCardMock,
  regenerateStudyAnswerAudioMock,
  studyOverviewData,
  studyOverviewLoading,
} = vi.hoisted(() => ({
  cardActionMutateAsyncMock: vi.fn(),
  startStudySessionMock: vi.fn(),
  prepareStudyAnswerAudioMock: vi.fn(),
  undoStudyReviewMock: vi.fn(),
  mutateAsyncMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
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
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../hooks/useStudy', () => ({
  useStudyOverview: () => ({
    data: studyOverviewData.current,
    isLoading: studyOverviewLoading.current,
    error: null,
    refetch: vi.fn(),
  }),
  useSubmitStudyReview: () => ({
    mutateAsync: mutateAsyncMock,
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
  useRegenerateStudyAnswerAudio: () => ({
    mutateAsync: regenerateStudyAnswerAudioMock,
    isPending: false,
    error: null,
  }),
  startStudySession: startStudySessionMock,
  prepareStudyAnswerAudio: prepareStudyAnswerAudioMock,
  undoStudyReview: undoStudyReviewMock,
}));

vi.mock('../../components/study/studyTimeZoneUtils', () => ({
  default: () => 'America/New_York',
}));

vi.mock('../../components/common/VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => <span data-testid="voice-preview">{voiceId}</span>,
}));

const renderStudyPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StudyPage />
      </BrowserRouter>
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
  static requestPermission = vi.fn<[], Promise<'granted' | 'denied'>>(async () => 'granted');

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
    cardActionMutateAsyncMock.mockReset();
    startStudySessionMock.mockReset();
    prepareStudyAnswerAudioMock.mockReset();
    undoStudyReviewMock.mockReset();
    mutateAsyncMock.mockReset();
    updateStudyCardMock.mockReset();
    regenerateStudyAnswerAudioMock.mockReset();
    vi.restoreAllMocks();

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

    expect(screen.getByRole('button', { name: 'Begin Study' })).toBeInTheDocument();
    expect(screen.getByText('4 due, 6 new')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute(
      'href',
      '/app/study/browse'
    );
    expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute(
      'href',
      '/app/study/import'
    );
    expect(screen.getByRole('link', { name: 'Create Card' })).toHaveAttribute(
      'href',
      '/app/study/create'
    );
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

  it('associates the disabled Begin Study button with the empty-state message', () => {
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

    const emptyMessage = 'Import your `日本語` deck or create a card to start studying here.';
    const beginButton = screen.getByRole('button', { name: 'Begin Study' });
    const emptyState = screen.getByText(emptyMessage);
    expect(beginButton).toBeDisabled();
    expect(beginButton).toHaveAttribute('aria-describedby', emptyState.id);
    expect(beginButton).not.toHaveAttribute('title');
  });

  it('keeps Begin Study enabled while overview counts are loading', () => {
    studyOverviewLoading.current = true;
    studyOverviewData.current = undefined;

    renderStudyPage();

    const beginButton = screen.getByRole('button', { name: 'Begin Study' });
    expect(beginButton).toBeEnabled();
    expect(beginButton).not.toHaveAttribute('aria-describedby');
    expect(screen.getByText('Loading overview…')).toBeInTheDocument();
    expect(
      screen.queryByText('Import your `日本語` deck or create a card to start studying here.')
    ).not.toBeInTheDocument();
  });

  it('starts the study session only when Begin Study is clicked', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    expect(startStudySessionMock).toHaveBeenCalledWith();
    expect(screen.getByText('Tap, click, or press space to reveal')).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    const gradeTray = screen.getByTestId('study-grade-tray');
    expect(within(gradeTray).getByRole('button', { name: /again/i })).toBeInTheDocument();
    expect(within(gradeTray).getByRole('button', { name: /hard/i })).toBeInTheDocument();
    expect(within(gradeTray).getByRole('button', { name: /good/i })).toBeInTheDocument();
    expect(within(gradeTray).getByRole('button', { name: /easy/i })).toBeInTheDocument();
    expect(within(gradeTray).queryByRole('button', { name: 'Edit card' })).not.toBeInTheDocument();

    const reviewActions = screen.getByTestId('study-review-actions');
    expect(within(reviewActions).getByRole('button', { name: 'Edit card' })).toBeInTheDocument();
    expect(within(reviewActions).getByRole('button', { name: 'Set due' })).toBeInTheDocument();
    expect(screen.getByTestId('study-answer-audio-button')).toHaveAccessibleName(
      'Play answer audio'
    );
  });

  it('autoplays prompt audio for audio-led cards and prepares missing answer audio on reveal', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    await waitFor(() => {
      expect(prepareStudyAnswerAudioMock).toHaveBeenCalledWith('card-1');
    });
    await waitFor(() => {
      expect(screen.getByTestId('study-answer-audio-button')).toHaveAccessibleName(
        'Play answer audio'
      );
    });
  });

  it('autoplays existing answer audio immediately when revealing a card', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });
    expect(prepareStudyAnswerAudioMock).not.toHaveBeenCalled();
  });

  it('uses space to pause, resume, and replay answer audio after reveal', async () => {
    let paused = true;
    let ended = false;
    const playMock = vi.fn().mockImplementation(() => {
      paused = false;
      ended = false;
      return Promise.resolve();
    });
    const pauseMock = vi.fn().mockImplementation(() => {
      paused = true;
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pauseMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
      configurable: true,
      get: () => paused,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'ended', {
      configurable: true,
      get: () => ended,
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
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
      expect(pauseMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(2);
    });

    paused = true;
    ended = true;
    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(3);
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Good/ })).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { code: 'Space' });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        cardId: 'card-1',
        grade: 'good',
      });
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    });

    fireEvent.keyDown(window, { code: 'Digit1', key: '1' });
    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        cardId: 'card-1',
        grade: 'again',
      });
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
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        cardId: 'card-2',
        grade: 'good',
      });
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
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        cardId: 'card-1',
        grade: 'good',
      });
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));

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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(screen.getByRole('button', { name: /good/i }));

    await waitFor(() => {
      expect(startStudySessionMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/No cards are ready right now/i)).toBeInTheDocument();

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
    expect(screen.queryByText(/No cards are ready right now/i)).not.toBeInTheDocument();
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

    renderStudyPage();
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));

    await waitFor(() => {
      expect(screen.getByText('お風呂に虫[...]！')).toBeInTheDocument();
    });
    expect(screen.getByText('are (existence verb)')).toBeInTheDocument();
    expect(screen.queryByText('Tap, click, or press space to reveal')).not.toBeInTheDocument();
    expect(
      screen.queryByText('お風呂に虫{{c1::がいる::are (existence verb)}}！')
    ).not.toBeInTheDocument();

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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
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
            answerAudioVoiceId: 'ja-JP-Neural2-D',
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit card' }));

    expect(screen.getByLabelText('Answer audio voice')).toHaveValue('ja-JP-Neural2-D');
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
    await userEvent.selectOptions(screen.getByLabelText('Answer audio voice'), 'ja-JP-Neural2-C');
    await userEvent.clear(screen.getByLabelText('Phonetic audio override'));
    await userEvent.type(screen.getByLabelText('Phonetic audio override'), 'かぶしきがいしゃ');
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));

    await waitFor(() => {
      expect(regenerateStudyAnswerAudioMock).toHaveBeenCalledWith({
        cardId: 'card-1',
        answerAudioVoiceId: 'ja-JP-Neural2-C',
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Begin Study' }));
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
});
