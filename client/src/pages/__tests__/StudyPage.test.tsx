import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
} = vi.hoisted(() => ({
  cardActionMutateAsyncMock: vi.fn(),
  startStudySessionMock: vi.fn(),
  prepareStudyAnswerAudioMock: vi.fn(),
  undoStudyReviewMock: vi.fn(),
  mutateAsyncMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../hooks/useStudy', () => ({
  useStudyOverview: () => ({
    data: {
      dueCount: 4,
      newCount: 6,
      learningCount: 2,
      reviewCount: 8,
      suspendedCount: 0,
      totalCards: 20,
    },
    isLoading: false,
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
  startStudySession: startStudySessionMock,
  prepareStudyAnswerAudio: prepareStudyAnswerAudioMock,
  undoStudyReview: undoStudyReviewMock,
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
    cueHtml: '会社',
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
    cardActionMutateAsyncMock.mockImplementation(
      async (payload: {
        cardId: string;
        action: 'suspend' | 'unsuspend' | 'forget' | 'set_due';
        mode?: 'now' | 'tomorrow' | 'custom_date';
        dueAt?: string;
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
  });

  it('renders overview counts without eagerly starting a study session', () => {
    renderStudyPage();

    expect(screen.getByText('Study')).toBeInTheDocument();
    expect(screen.getByText('4 due, 6 new')).toBeInTheDocument();
    expect(screen.getByText('Ready to study')).toBeInTheDocument();
    expect(startStudySessionMock).not.toHaveBeenCalled();
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
    expect(startStudySessionMock).toHaveBeenCalledWith(10);
    expect(screen.getByText('Tap, click, or press space to reveal')).toBeInTheDocument();
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
      expect(screen.getByLabelText('Play answer audio')).toBeInTheDocument();
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
      expect(undoStudyReviewMock).toHaveBeenCalledWith('review-1');
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
});
