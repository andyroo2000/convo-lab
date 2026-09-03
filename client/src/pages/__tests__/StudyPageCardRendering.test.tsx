import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KnownKanjiContextProvider } from '../../contexts/KnownKanjiContext';
import studyCapabilitiesFixture from '../../test/studyCapabilitiesFixture';
import StudyPage from '../StudyPage';

const {
  cardActionMutateAsyncMock,
  createStudyReviewRequestMock,
  deleteStudyCardMock,
  masteryAnimationFinishesImmediately,
  mutateAsyncMock,
  prepareStudyAnswerAudioMock,
  regenerateStudyAnswerAudioMock,
  resolveStudyCardPitchAccentMock,
  startStudyIntroductionCohortLessonMock,
  startStudyLessonMock,
  startStudySessionMock,
  undoStudyReviewMock,
  updateStudyCardMock,
} = vi.hoisted(() => ({
  cardActionMutateAsyncMock: vi.fn(),
  createStudyReviewRequestMock: vi.fn(),
  deleteStudyCardMock: vi.fn(),
  masteryAnimationFinishesImmediately: { current: true },
  mutateAsyncMock: vi.fn(),
  prepareStudyAnswerAudioMock: vi.fn(),
  regenerateStudyAnswerAudioMock: vi.fn(),
  resolveStudyCardPitchAccentMock: vi.fn(),
  startStudyIntroductionCohortLessonMock: vi.fn(),
  startStudyLessonMock: vi.fn(),
  startStudySessionMock: vi.fn(),
  undoStudyReviewMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
}));

vi.mock('../../hooks/useStudyCapabilities', () => ({
  useStudyCapabilities: () => ({
    data: studyCapabilitiesFixture,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      id: 'default',
      dialoguesEnabled: false,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
      updatedAt: '2026-07-16T12:00:00.000Z',
    },
    isLoading: false,
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
    data: {
      dueCount: 4,
      newCount: 6,
      newCardsPerDay: 20,
      newCardsIntroducedToday: 18,
      newCardsAvailableToday: 2,
      learningCount: 2,
      reviewCount: 8,
      suspendedCount: 0,
      totalCards: 20,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSubmitStudyReview: () => ({ mutateAsync: mutateAsyncMock, isPending: false, error: null }),
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
  resolveStudyCardPitchAccent: resolveStudyCardPitchAccentMock,
  undoStudyReview: undoStudyReviewMock,
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
    defaultOptions: { queries: { retry: false } },
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
  prompt: { cueText: '会社', cueReading: 'かいしゃ' },
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

describe('StudyPage card rendering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cardActionMutateAsyncMock.mockReset();
    createStudyReviewRequestMock.mockReset();
    deleteStudyCardMock.mockReset();
    mutateAsyncMock.mockReset();
    startStudySessionMock.mockReset();
    startStudyLessonMock.mockReset();
    startStudyIntroductionCohortLessonMock.mockReset();
    prepareStudyAnswerAudioMock.mockReset();
    regenerateStudyAnswerAudioMock.mockReset();
    resolveStudyCardPitchAccentMock.mockReset();
    undoStudyReviewMock.mockReset();
    updateStudyCardMock.mockReset();
    masteryAnimationFinishesImmediately.current = true;
    resolveStudyCardPitchAccentMock.mockImplementation(async (cardId: string) => ({
      ...baseCard,
      id: cardId,
      answer: { ...baseCard.answer, pitchAccent: null },
    }));
    window.history.replaceState({}, '', '/app/study');
    window.localStorage.clear();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
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
});
