import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  StudyAnswerPayload,
  StudyBrowserListResponse,
  StudyBrowserNoteDetail,
  StudyPromptPayload,
} from '@languageflow/shared/src/types';

import useStudyBrowseController from '../useStudyBrowseController';

const {
  browserRefetchMock,
  detailRefetchMock,
  updateStudyCardMock,
  useStudyBrowserMock,
  useStudyBrowserNoteDetailMock,
} = vi.hoisted(() => ({
  browserRefetchMock: vi.fn(),
  detailRefetchMock: vi.fn(),
  updateStudyCardMock: vi.fn(),
  useStudyBrowserMock: vi.fn(),
  useStudyBrowserNoteDetailMock: vi.fn(),
}));

function mutation(mutateAsync = vi.fn()) {
  return {
    mutateAsync,
    isPending: false,
    error: null,
    reset: vi.fn(),
  };
}

vi.mock('../useStudy', () => ({
  useStudyBrowser: (enabled: boolean, query: unknown) => useStudyBrowserMock(enabled, query),
  useStudyBrowserNoteDetail: (enabled: boolean, noteId?: string) =>
    useStudyBrowserNoteDetailMock(enabled, noteId),
  useStudyCardAction: () => mutation(),
  usePromoteStudyNewCardToFront: () => mutation(),
  useUpdateStudyCard: () => mutation(updateStudyCardMock),
  useRegenerateStudyAnswerAudio: () => mutation(),
  useRegenerateStudyCardImage: () => mutation(),
  useDeleteStudyCard: () => mutation(),
}));

vi.mock('../useStudyBackgroundTask', () => ({
  default: () => (task: () => Promise<unknown>) => {
    task().catch(() => undefined);
  },
}));

vi.mock('../../components/study/studyTimeZoneUtils', () => ({
  default: () => 'America/New_York',
}));

const firstPage: StudyBrowserListResponse = {
  rows: [
    {
      noteId: 'note-1',
      displayText: '会社',
      noteTypeName: 'Japanese - Vocab',
      cardCount: 1,
      reviewCount: 4,
      queueSummary: { new: 1 },
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    },
  ],
  total: 2,
  limit: 100,
  nextCursor: 'next-page',
  filterOptions: {
    noteTypes: ['Japanese - Vocab'],
    cardTypes: ['recognition'],
    queueStates: ['new'],
  },
};

const secondPage: StudyBrowserListResponse = {
  ...firstPage,
  rows: [
    firstPage.rows[0]!,
    {
      noteId: 'note-2',
      displayText: '風呂',
      noteTypeName: 'Japanese - Vocab',
      cardCount: 1,
      reviewCount: 1,
      queueSummary: { review: 1 },
      createdAt: '2026-04-11T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    },
  ],
  nextCursor: null,
};

const detail = {
  noteId: 'note-1',
  displayText: '会社',
  noteTypeName: 'Japanese - Vocab',
  sourceKind: 'anki_import',
  updatedAt: '2026-04-12T00:00:00.000Z',
  rawFields: [],
  canonicalFields: [],
  cardStats: [{ cardId: 'card-1', reviewCount: 4, lastReviewedAt: null }],
  selectedCardId: 'card-1',
  cards: [
    {
      id: 'card-1',
      noteId: 'note-1',
      cardType: 'recognition',
      prompt: { cueText: '会社' },
      answer: { expression: '会社', meaning: 'company' },
      state: {
        dueAt: null,
        queueState: 'new',
        scheduler: null,
        source: { templateName: 'Word -> Meaning' },
      },
      answerAudioSource: 'missing',
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-12T00:00:00.000Z',
    },
  ],
} as StudyBrowserNoteDetail;

const createWrapper = (initialEntry = '/app/study/browse?noteId=note-1&cardId=card-1') => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );
  return Wrapper;
};

const wrapper = createWrapper();

describe('useStudyBrowseController', () => {
  beforeEach(() => {
    browserRefetchMock.mockReset().mockResolvedValue(undefined);
    detailRefetchMock.mockReset().mockResolvedValue(undefined);
    updateStudyCardMock.mockReset().mockResolvedValue(detail.cards[0]);
    useStudyBrowserMock.mockReset().mockImplementation((_enabled, query) => ({
      data: query.cursor ? secondPage : firstPage,
      isLoading: false,
      error: null,
      refetch: browserRefetchMock,
    }));
    useStudyBrowserNoteDetailMock.mockReset().mockReturnValue({
      data: detail,
      isLoading: false,
      error: null,
      refetch: detailRefetchMock,
    });
  });

  it('owns the canonical search, filter, and sort query state', async () => {
    const { result } = renderHook(() => useStudyBrowseController(true), { wrapper });

    expect(useStudyBrowserMock).toHaveBeenCalledWith(true, {
      limit: 100,
      sortField: 'created_on',
      sortDirection: 'desc',
    });

    act(() => {
      result.current.setSearchInput('  会社  ');
      result.current.setNoteType('Japanese - Vocab');
      result.current.setCardType('recognition');
      result.current.setQueueState('new');
      result.current.setSortField('note_type');
      result.current.setSortDirection('asc');
    });
    act(() => result.current.submitSearch());

    await waitFor(() => {
      expect(result.current.query).toEqual({
        q: '会社',
        noteType: 'Japanese - Vocab',
        cardType: 'recognition',
        queueState: 'new',
        sortField: 'note_type',
        sortDirection: 'asc',
        cursor: undefined,
        limit: 100,
      });
    });
  });

  it('appends cursor pages without duplicating notes', async () => {
    const { result } = renderHook(() => useStudyBrowseController(true), { wrapper });

    await waitFor(() => expect(result.current.rows.map((row) => row.noteId)).toEqual(['note-1']));
    act(() => result.current.loadMore());

    await waitFor(() => {
      expect(result.current.query.cursor).toBe('next-page');
      expect(result.current.rows.map((row) => row.noteId)).toEqual(['note-1', 'note-2']);
    });
  });

  it('preserves a valid deep link during hydration and still allows later note selection', async () => {
    useStudyBrowserMock.mockReturnValue({
      data: { ...firstPage, rows: secondPage.rows },
      isLoading: false,
      error: null,
      refetch: browserRefetchMock,
    });

    const { result } = renderHook(() => useStudyBrowseController(true), {
      wrapper: createWrapper('/app/study/browse?noteId=note-2&cardId=card-2'),
    });

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.selectedNoteId).toBe('note-2');

    act(() => result.current.selectNote('note-1'));
    await waitFor(() => expect(result.current.selectedNoteId).toBe('note-1'));
  });

  it('falls back deterministically when a deep-linked note is not in the result set', async () => {
    useStudyBrowserMock.mockReturnValue({
      data: { ...firstPage, rows: secondPage.rows },
      isLoading: false,
      error: null,
      refetch: browserRefetchMock,
    });

    const { result } = renderHook(() => useStudyBrowseController(true), {
      wrapper: createWrapper('/app/study/browse?noteId=missing-note&cardId=missing-card'),
    });

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    await waitFor(() => expect(result.current.selectedNoteId).toBe('note-1'));

    const callsAfterFallback = useStudyBrowserMock.mock.calls.length;
    await act(async () => Promise.resolve());
    expect(result.current.selectedNoteId).toBe('note-1');
    expect(useStudyBrowserMock).toHaveBeenCalledTimes(callsAfterFallback);
  });

  it('preserves URL selection and refetches both browse contracts after a save', async () => {
    const { result } = renderHook(() => useStudyBrowseController(true), { wrapper });

    await waitFor(() => {
      expect(result.current.selectedNoteId).toBe('note-1');
      expect(result.current.selectedCard?.id).toBe('card-1');
    });

    const prompt: StudyPromptPayload = { cueText: '会社' };
    const answer: StudyAnswerPayload = { expression: '会社', meaning: 'business' };
    await act(async () => result.current.saveSelectedCard({ prompt, answer }));

    expect(updateStudyCardMock).toHaveBeenCalledWith({
      cardId: 'card-1',
      expectedRevision: 0,
      prompt,
      answer,
    });
    expect(detailRefetchMock).toHaveBeenCalledTimes(1);
    expect(browserRefetchMock).toHaveBeenCalledTimes(1);
  });
});
