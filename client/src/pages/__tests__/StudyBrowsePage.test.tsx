import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyBrowsePage from '../StudyBrowsePage';

const { useStudyBrowserMock, useStudyBrowserNoteDetailMock } = vi.hoisted(() => ({
  useStudyBrowserMock: vi.fn(),
  useStudyBrowserNoteDetailMock: vi.fn(),
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
  page: 1,
  pageSize: 100,
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

describe('StudyBrowsePage', () => {
  beforeEach(() => {
    useStudyBrowserMock.mockReset();
    useStudyBrowserNoteDetailMock.mockReset();

    useStudyBrowserMock.mockReturnValue({
      data: browserData,
      isLoading: false,
      error: null,
    });
    useStudyBrowserNoteDetailMock.mockImplementation((_enabled: boolean, noteId?: string) => ({
      data: noteId ? noteDetailById[noteId as keyof typeof noteDetailById] : undefined,
      isLoading: false,
      error: null,
    }));
  });

  it('renders note rows and selects the first note by default', async () => {
    renderPage();

    expect(screen.getByText('Browse cards')).toBeInTheDocument();
    expect(screen.getAllByText('会社').length).toBeGreaterThan(0);
    expect(await screen.findByText('Imported fields')).toBeInTheDocument();
  });

  it('updates the preview pane when another note row is selected and flipped', async () => {
    renderPage();

    await userEvent.click(screen.getByText('お風呂に虫[...]！'));
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
          page: 1,
          pageSize: 100,
        })
      );
    });
  });
});
