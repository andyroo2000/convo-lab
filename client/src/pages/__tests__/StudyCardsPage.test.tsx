import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyCardsPage from '../StudyCardsPage';

const {
  queueFetchNextPage,
  cardsFetchNextPage,
  reorderMock,
  createLessonFollowupMock,
  dndContextProps,
  observerCallbacks,
  queuePages,
} = vi.hoisted(() => ({
  queueFetchNextPage: vi.fn(),
  cardsFetchNextPage: vi.fn(),
  reorderMock: vi.fn(),
  createLessonFollowupMock: vi.fn(),
  dndContextProps: { current: null as null | { onDragEnd?: (event: DragEndEvent) => void } },
  observerCallbacks: [] as IntersectionObserverCallback[],
  queuePages: { current: [] as Array<Record<string, unknown>> },
}));

vi.mock('@dnd-kit/core', () => ({
  closestCenter: vi.fn(),
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd?: (event: DragEndEvent) => void;
  }) => {
    dndContextProps.current = { onDragEnd };
    return <div>{children}</div>;
  },
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn((sensor, options) => ({ sensor, options })),
  useSensors: vi.fn((...sensors) => sensors),
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(array: T[], from: number, to: number) => {
    const next = [...array];
    const [item] = next.splice(from, 1);
    if (item !== undefined) next.splice(to, 0, item);
    return next;
  },
  SortableContext: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ isFeatureEnabled: () => true }),
}));

vi.mock('../../hooks/useStudyBackgroundTask', () => ({
  default: () => (task: () => Promise<unknown>) => task().catch(() => undefined),
}));

vi.mock('../../hooks/useStudy', () => ({
  createStudyIntroductionCohortId: () => '01K00000000000000000000000',
  useStudyNewCardQueueInfinite: () => ({
    data: {
      pages: queuePages.current,
    },
    isLoading: false,
    error: null,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: queueFetchNextPage,
  }),
  useStudyLearningItemsInfinite: () => ({
    data: {
      pages: [
        {
          items: [
            {
              id: 'card:card-3',
              groupId: null,
              representativeCard: {
                id: 'card-3',
                syncId: 'sync-3',
                noteId: null,
                cardType: 'recognition',
                displayText: '猫',
                meaning: 'cat',
                variantKind: null,
              },
              currentStageNumber: null,
              stageCount: 1,
              cardCount: 1,
              retiredStageCount: 0,
              transferDemonstrated: false,
              stages: [],
            },
            {
              id: 'path:company-path',
              groupId: 'company-path',
              representativeCard: {
                id: 'card-4',
                syncId: 'sync-4',
                noteId: 'note-4',
                cardType: 'recognition',
                displayText: '会社で働いています。',
                meaning: 'I work at a company.',
                variantKind: 'sentence_audio_recognition',
              },
              currentStageNumber: 2,
              stageCount: 3,
              cardCount: 4,
              retiredStageCount: 0,
              transferDemonstrated: false,
              stages: [
                {
                  number: 1,
                  status: 'available',
                  cardCount: 2,
                  representativeCard: {
                    id: 'card-4',
                    syncId: 'sync-4',
                    noteId: 'note-4',
                    cardType: 'recognition',
                    displayText: '会社で働いています。',
                    meaning: 'I work at a company.',
                    variantKind: 'sentence_audio_recognition',
                  },
                  cards: [
                    {
                      id: 'card-4',
                      syncId: 'sync-4',
                      noteId: 'note-4',
                      cardType: 'recognition',
                      displayText: '会社で働いています。',
                      meaning: 'I work at a company.',
                      variantKind: 'sentence_audio_recognition',
                    },
                    {
                      id: 'card-5',
                      syncId: 'sync-5',
                      noteId: 'note-5',
                      cardType: 'recognition',
                      displayText: '会社を辞めました。',
                      meaning: 'I left the company.',
                      variantKind: 'sentence_audio_recognition',
                    },
                  ],
                },
                {
                  number: 2,
                  status: 'available',
                  cardCount: 1,
                  representativeCard: {
                    id: 'card-6',
                    syncId: 'sync-6',
                    noteId: 'note-6',
                    cardType: 'recognition',
                    displayText: '会社',
                    meaning: 'company',
                    variantKind: 'word_audio_recognition',
                  },
                  cards: [
                    {
                      id: 'card-6',
                      syncId: 'sync-6',
                      noteId: 'note-6',
                      cardType: 'recognition',
                      displayText: '会社',
                      meaning: 'company',
                      variantKind: 'word_audio_recognition',
                    },
                  ],
                },
                {
                  number: 3,
                  status: 'locked',
                  cardCount: 1,
                  representativeCard: {
                    id: 'card-7',
                    syncId: 'sync-7',
                    noteId: 'note-7',
                    cardType: 'cloze',
                    displayText: '＿＿で働いています。',
                    meaning: 'I work at a company.',
                    variantKind: 'cloze',
                  },
                  cards: [
                    {
                      id: 'card-7',
                      syncId: 'sync-7',
                      noteId: 'note-7',
                      cardType: 'cloze',
                      displayText: '＿＿で働いています。',
                      meaning: 'I work at a company.',
                      variantKind: 'cloze',
                    },
                  ],
                },
              ],
            },
          ],
          limit: 50,
          nextCursor: 'cards-2',
        },
      ],
    },
    isLoading: false,
    error: null,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: cardsFetchNextPage,
  }),
  useReorderStudyNewCardQueue: () => ({ mutateAsync: reorderMock, isPending: false }),
  useCreateStudyLessonFollowupCohort: () => ({
    mutateAsync: createLessonFollowupMock,
    isPending: false,
  }),
}));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BrowserRouter>
        <StudyCardsPage />
      </BrowserRouter>
    </QueryClientProvider>
  );

describe('StudyCardsPage', () => {
  beforeEach(() => {
    queueFetchNextPage.mockReset();
    cardsFetchNextPage.mockReset();
    reorderMock.mockReset().mockResolvedValue({});
    createLessonFollowupMock.mockReset().mockResolvedValue({
      id: '01k00000000000000000000000',
    });
    window.history.replaceState({}, '', '/app/study/cards');
    observerCallbacks.length = 0;
    queuePages.current = [
      {
        items: [
          {
            id: 'card-1',
            noteId: 'note-1',
            cardType: 'recognition',
            displayText: '会社',
            meaning: 'company',
            queuePosition: 1,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
          {
            id: 'card-2',
            noteId: 'note-2',
            cardType: 'production',
            displayText: '学校',
            meaning: 'school',
            queuePosition: 2,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
        total: 3,
        limit: 2,
        nextCursor: '2',
      },
    ];
    global.IntersectionObserver = class IntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallbacks.push(callback);
      }

      // eslint-disable-next-line class-methods-use-this
      disconnect() {}

      // eslint-disable-next-line class-methods-use-this
      observe() {}

      // eslint-disable-next-line class-methods-use-this
      unobserve() {}

      // eslint-disable-next-line class-methods-use-this
      takeRecords() {
        return [];
      }

      readonly root = null;

      readonly rootMargin = '';

      readonly thresholds = [];
    };
  });

  it('shows the iOS-style Queue and All Cards collections', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Cards' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Queue' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('会社')).toBeInTheDocument();
    expect(screen.getByText('3 queued')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'All Cards' }));

    expect(screen.getByText('猫')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /猫/ })).toHaveAttribute(
      'href',
      '/app/study/browse?cardId=card-3&noteId=card-3'
    );

    const learningItem = screen.getByTestId('study-learning-item');
    expect(within(learningItem).getByText('Stage 2 of 3', { exact: false })).toBeInTheDocument();
    expect(within(learningItem).getByText('4 cards', { exact: false })).toBeInTheDocument();
    expect(
      within(learningItem).getByRole('link', { name: /Learning path.*Stage 2 of 3/ })
    ).toHaveAttribute('href', '/app/study/browse?cardId=card-4&noteId=note-4');

    await userEvent.click(within(learningItem).getByText('View 3 stages'));
    expect(within(learningItem).getByText('会社を辞めました。')).toBeInTheDocument();
    expect(within(learningItem).getByText('Locked', { exact: false })).toBeInTheDocument();
  });

  it('loads more at the scroll sentinel and preserves queue reorder', async () => {
    const view = renderPage();

    act(() => {
      observerCallbacks[0]?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(queueFetchNextPage).toHaveBeenCalledTimes(1);

    await act(async () => {
      dndContextProps.current?.onDragEnd?.({
        active: { id: 'card-1' },
        over: { id: 'card-2' },
      } as DragEndEvent);
    });

    await waitFor(() => expect(reorderMock).toHaveBeenCalledWith(['card-2', 'card-1']));
    queuePages.current = [
      ...queuePages.current,
      {
        items: [
          {
            id: 'card-4',
            noteId: 'note-4',
            cardType: 'recognition',
            displayText: '先生',
            meaning: 'teacher',
            queuePosition: 3,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
        total: 3,
        limit: 2,
        nextCursor: null,
      },
    ];
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <BrowserRouter>
          <StudyCardsPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const rows = await screen.findAllByTestId('study-new-queue-row');
    expect(within(rows[0]).getByText('学校')).toBeInTheDocument();
    expect(within(rows[1]).getByText('会社')).toBeInTheDocument();
    expect(within(rows[2]).getByText('先生')).toBeInTheDocument();
  });

  it('rolls back an optimistic queue reorder when the request fails', async () => {
    reorderMock.mockRejectedValue(new Error('Reorder failed'));
    renderPage();

    await act(async () => {
      dndContextProps.current?.onDragEnd?.({
        active: { id: 'card-1' },
        over: { id: 'card-2' },
      } as DragEndEvent);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Reorder failed');
    const rows = screen.getAllByTestId('study-new-queue-row');
    expect(within(rows[0]).getByText('会社')).toBeInTheDocument();
    expect(within(rows[1]).getByText('学校')).toBeInTheDocument();
  });

  it('creates a prioritized lesson follow-up and routes directly into its lesson', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Make lesson follow-up' }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select 学校 for lesson follow-up' })
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select 会社 for lesson follow-up' })
    );
    await userEvent.type(screen.getByLabelText('Lesson label (optional)'), 'iTalki · August 26');
    await userEvent.click(screen.getByRole('button', { name: 'Study 2 selected cards now' }));

    await waitFor(() =>
      expect(createLessonFollowupMock).toHaveBeenCalledWith({
        cohortId: '01K00000000000000000000000',
        cardIds: ['card-1', 'card-2'],
        label: 'iTalki · August 26',
      })
    );
    expect(window.location.pathname).toBe('/app/study');
    expect(new URLSearchParams(window.location.search).get('lessonCohortId')).toBe(
      '01k00000000000000000000000'
    );
  });
});
