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
  cardActionMutateAsyncMock,
} = vi.hoisted(() => ({
  useStudyBrowserMock: vi.fn(),
  useStudyBrowserNoteDetailMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
  cardActionMutateAsyncMock: vi.fn(),
}));

vi.mock('../../components/study/studyTimeZoneUtils', () => ({
  default: () => 'America/New_York',
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
        answer: { expression: '会社', meaning: 'company' },
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
        answer: { restoredText: 'お風呂に虫がいる！', meaning: 'There are bugs in the bath!' },
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
  });

  it('renders note rows and selects the first note by default', async () => {
    renderPage();

    expect(screen.getByText('Browse cards')).toBeInTheDocument();
    expect(screen.getAllByText('会社').length).toBeGreaterThan(0);
    expect(await screen.findByText('Imported fields')).toBeInTheDocument();
  });

  it('updates the preview pane when another note row is selected and flipped', async () => {
    renderPage();

    const noteItems = await screen.findAllByTestId('study-browser-note-item');
    await userEvent.click(within(noteItems[1]).getByText('お風呂に虫[...]！'));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('There are bugs in the bath!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Front' })).toBeInTheDocument();
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

  it('opens the inline editor for the selected card and saves changes', async () => {
    renderPage();

    await userEvent.click(getNoteRow('会社'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
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
});
