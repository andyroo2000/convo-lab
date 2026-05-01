import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyBrowsePage from '../StudyBrowsePage';

const {
  useStudyBrowserMock,
  useStudyBrowserNoteDetailMock,
  updateStudyCardMock,
  regenerateStudyAnswerAudioMock,
  cardActionMutateAsyncMock,
} = vi.hoisted(() => ({
  useStudyBrowserMock: vi.fn(),
  useStudyBrowserNoteDetailMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
  regenerateStudyAnswerAudioMock: vi.fn(),
  cardActionMutateAsyncMock: vi.fn(),
}));

vi.mock('../../components/study/studyTimeZoneUtils', () => ({
  default: () => 'America/New_York',
}));

vi.mock('../../components/common/VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => <span data-testid="voice-preview">{voiceId}</span>,
}));

const browserData = {
  rows: [
    {
      noteId: 'note-1',
      displayText: '会社',
      noteTypeName: 'Japanese - Vocab',
      cardCount: 2,
      reviewCount: 4,
      queueSummary: { review: 1, new: 1 },
      updatedAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
    },
    {
      noteId: 'note-2',
      displayText: 'お風呂に虫[...]！',
      noteTypeName: 'Cloze',
      cardCount: 1,
      reviewCount: 1,
      queueSummary: { review: 1 },
      updatedAt: new Date('2026-04-11T00:00:00.000Z').toISOString(),
    },
  ],
  total: 2,
  limit: 100,
  nextCursor: null,
  filterOptions: {
    noteTypes: ['Cloze', 'Japanese - Vocab'],
    cardTypes: ['cloze', 'recognition'],
    queueStates: ['new', 'review'],
  },
};

const noteDetailById = {
  'note-1': {
    noteId: 'note-1',
    displayText: '会社',
    noteTypeName: 'Japanese - Vocab',
    sourceKind: 'anki_import',
    updatedAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
    rawFields: [
      { name: 'Expression', value: '会社', textValue: '会社' },
      { name: 'Meaning', value: 'company', textValue: 'company' },
    ],
    canonicalFields: [],
    cardStats: [{ cardId: 'card-1', reviewCount: 4, lastReviewedAt: null }],
    selectedCardId: 'card-1',
    cards: [
      {
        id: 'card-1',
        noteId: 'note-1',
        cardType: 'recognition' as const,
        prompt: { cueText: '会社' },
        answer: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: 'ja-JP-Neural2-D',
          answerAudioTextOverride: 'かいしゃ',
        },
        state: {
          dueAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          queueState: 'review' as const,
          scheduler: null,
          source: { templateName: 'Word -> Meaning' },
        },
        answerAudioSource: 'missing' as const,
        createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
      },
    ],
  },
  'note-2': {
    noteId: 'note-2',
    displayText: 'お風呂に虫[...]！',
    noteTypeName: 'Cloze',
    sourceKind: 'anki_import',
    updatedAt: new Date('2026-04-11T00:00:00.000Z').toISOString(),
    rawFields: [
      {
        name: 'Text',
        value: 'お風呂に虫{{c1::がいる}}！',
        textValue: 'お風呂に虫{{c1::がいる}}！',
      },
    ],
    canonicalFields: [],
    cardStats: [{ cardId: 'card-2', reviewCount: 1, lastReviewedAt: null }],
    selectedCardId: 'card-2',
    cards: [
      {
        id: 'card-2',
        noteId: 'note-2',
        cardType: 'cloze' as const,
        prompt: { clozeDisplayText: 'お風呂に虫[...]！', clozeResolvedHint: 'are' },
        answer: {
          restoredText: 'お風呂に虫がいる！',
          restoredTextReading: 'お風呂[ふろ]に虫[むし]がいる！',
          meaning: 'There are bugs in the bath!',
          answerAudio: {
            filename: 'card-2.mp3',
            url: 'https://example.com/card-2.mp3',
            mediaKind: 'audio',
            source: 'imported',
          },
        },
        state: {
          dueAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          queueState: 'review' as const,
          scheduler: null,
          source: { templateName: 'Cloze' },
        },
        answerAudioSource: 'missing' as const,
        createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
      },
    ],
  },
};

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../hooks/useStudy', () => ({
  useStudyBrowser: (enabled: boolean, query: unknown) => useStudyBrowserMock(enabled, query),
  useStudyBrowserNoteDetail: (enabled: boolean, noteId?: string) =>
    useStudyBrowserNoteDetailMock(enabled, noteId),
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
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StudyBrowsePage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const getNoteRow = (text: string) => {
  const noteRows = screen.getAllByRole('row').slice(1);
  const matchingRow = noteRows.find((row) => within(row).queryByText(text));
  if (!matchingRow) {
    throw new Error(`Could not find note row for "${text}"`);
  }
  return matchingRow;
};

describe('StudyBrowsePage', () => {
  beforeEach(() => {
    useStudyBrowserMock.mockReset();
    useStudyBrowserNoteDetailMock.mockReset();
    updateStudyCardMock.mockReset();
    regenerateStudyAnswerAudioMock.mockReset();
    cardActionMutateAsyncMock.mockReset();

    useStudyBrowserMock.mockReturnValue({
      data: browserData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useStudyBrowserNoteDetailMock.mockImplementation((_enabled: boolean, noteId?: string) => ({
      data: noteId ? noteDetailById[noteId as keyof typeof noteDetailById] : undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    }));
    updateStudyCardMock.mockImplementation(
      async (payload: {
        cardId: string;
        prompt: Record<string, unknown>;
        answer: Record<string, unknown>;
      }) => ({
        ...(noteDetailById['note-1'].cards[0] ?? {}),
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
        ...(noteDetailById['note-1'].cards[0] ?? {}),
        id: payload.cardId,
        answerAudioSource: 'generated' as const,
        answer: {
          ...(noteDetailById['note-1'].cards[0]?.answer ?? {}),
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
        action: string;
        mode?: string;
        dueAt?: string;
        timeZone?: string;
      }) => ({
        card: {
          ...(noteDetailById['note-1'].cards[0] ?? {}),
          id: payload.cardId,
          state: {
            ...(noteDetailById['note-1'].cards[0]?.state ?? {}),
            queueState: payload.action === 'suspend' ? 'suspended' : 'review',
            dueAt:
              payload.action === 'set_due' && payload.mode === 'tomorrow'
                ? new Date('2026-04-13T09:00:00.000Z').toISOString()
                : (noteDetailById['note-1'].cards[0]?.state.dueAt ?? null),
          },
        },
        overview: {
          dueCount: 0,
          newCount: 0,
          learningCount: 0,
          reviewCount: 0,
          suspendedCount: payload.action === 'suspend' ? 1 : 0,
          totalCards: 2,
        },
      })
    );
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('renders note rows and selects the first note by default', async () => {
    renderPage();

    expect(screen.getByText('Browse cards')).toBeInTheDocument();
    expect(screen.getAllByText('会社').length).toBeGreaterThan(0);
    expect(await screen.findByText('Imported fields')).toBeInTheDocument();
  });

  it('updates the reusable editor when another note row is selected', async () => {
    renderPage();

    const noteItems = await screen.findAllByTestId('study-browser-note-item');
    await userEvent.click(within(noteItems[1]).getByText('お風呂に虫[...]！'));

    expect(await screen.findByTestId('study-card-editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Restored answer')).toHaveValue('お風呂に虫がいる！');
    expect(screen.getByLabelText('Restored answer reading')).toHaveValue(
      'お風呂[ふろ]に虫[むし]がいる！'
    );
    expect(screen.getByLabelText('Restored answer reading')).toBeEnabled();
    expect(screen.getByLabelText('Answer meaning')).toHaveValue('There are bugs in the bath!');
    expect(screen.queryByRole('button', { name: 'Front' })).not.toBeInTheDocument();
  });

  it('updates the browser query when search and filters are submitted', async () => {
    renderPage();

    await userEvent.type(screen.getByRole('textbox', { name: 'Search cards/notes' }), '会社');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Note type' }),
      'Japanese - Vocab'
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Card type' }),
      'recognition'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(useStudyBrowserMock).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({
          q: '会社',
          noteType: 'Japanese - Vocab',
          cardType: 'recognition',
          cursor: undefined,
          limit: 100,
        })
      );
    });
  });

  it('supports selected-card maintenance actions from the detail pane', async () => {
    renderPage();

    await userEvent.click(getNoteRow('会社'));
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    await waitFor(() => {
      expect(cardActionMutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          action: 'suspend',
        })
      );
    });
  });

  it('sends the device timezone when setting a browse card due tomorrow', async () => {
    renderPage();

    await userEvent.click(getNoteRow('会社'));
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

  it('shows the full editor for the selected card and saves changes', async () => {
    renderPage();

    await userEvent.click(getNoteRow('会社'));

    expect(screen.getByTestId('study-card-editor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Answer audio voice')).toHaveValue('ja-JP-Neural2-D');
    expect(screen.getByLabelText('Phonetic audio override')).toHaveValue('かいしゃ');

    await userEvent.clear(screen.getByLabelText('Answer meaning'));
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'business');
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
  });

  it('regenerates answer audio from the edit pane using saved voice settings', async () => {
    renderPage();

    await userEvent.click(getNoteRow('会社'));
    expect(screen.getByText('No card audio is available yet.')).toBeInTheDocument();
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

  it('does not autoplay another selected card after regenerating audio', async () => {
    renderPage();

    await userEvent.click(getNoteRow('会社'));
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));

    await waitFor(() => {
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    });

    const noteItems = await screen.findAllByTestId('study-browser-note-item');
    await userEvent.click(within(noteItems[1]).getByText('お風呂に虫[...]！'));

    expect(await screen.findByLabelText('Restored answer')).toHaveValue('お風呂に虫がいる！');
    await waitFor(() => {
      expect(screen.getByTestId('study-editor-answer-audio-source')).toHaveAttribute(
        'src',
        'https://example.com/card-2.mp3'
      );
    });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });
});
