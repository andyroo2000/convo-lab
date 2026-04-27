import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudySettingsPage from '../StudySettingsPage';

const {
  updateStudySettingsMock,
  reorderStudyNewCardQueueMock,
  useStudySettingsMock,
  useStudyNewCardQueueMock,
  dndContextProps,
} = vi.hoisted(() => ({
  updateStudySettingsMock: vi.fn(),
  reorderStudyNewCardQueueMock: vi.fn(),
  useStudySettingsMock: vi.fn(),
  useStudyNewCardQueueMock: vi.fn(),
  dndContextProps: {
    current: null as null | { onDragEnd?: (event: DragEndEvent) => void },
  },
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
    return <div data-testid="dnd-context">{children}</div>;
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
    if (item !== undefined) {
      next.splice(to, 0, item);
    }
    return next;
  },
  SortableContext: ({ children }: { children: ReactNode }) => (
    <div data-testid="sortable-context">{children}</div>
  ),
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
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../hooks/useStudyBackgroundTask', () => ({
  default: () => (task?: Promise<unknown> | (() => Promise<unknown> | unknown)) => {
    if (typeof task === 'function') {
      Promise.resolve(task()).catch(() => undefined);
    } else {
      Promise.resolve(task).catch(() => undefined);
    }
  },
}));

vi.mock('../../hooks/useStudy', () => ({
  getStudyNewCardQueue: vi.fn(),
  useStudySettings: (...args: unknown[]) => useStudySettingsMock(...args),
  useStudyNewCardQueue: (...args: unknown[]) => useStudyNewCardQueueMock(...args),
  useUpdateStudySettings: () => ({
    mutateAsync: updateStudySettingsMock,
    isPending: false,
    isSuccess: false,
  }),
  useReorderStudyNewCardQueue: () => ({
    mutateAsync: reorderStudyNewCardQueueMock,
    isPending: false,
  }),
}));

const renderPage = () => {
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
        <StudySettingsPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('StudySettingsPage', () => {
  beforeEach(() => {
    updateStudySettingsMock.mockReset();
    reorderStudyNewCardQueueMock.mockReset();
    dndContextProps.current = null;
    useStudySettingsMock.mockReturnValue({
      data: { newCardsPerDay: 20 },
      isLoading: false,
      error: null,
    });
    useStudyNewCardQueueMock.mockReturnValue({
      data: {
        items: [
          {
            id: 'card-1',
            noteId: 'note-1',
            cardType: 'recognition',
            displayText: '会社',
            meaning: 'company',
            queuePosition: 1,
            createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
          },
          {
            id: 'card-2',
            noteId: 'note-2',
            cardType: 'production',
            displayText: '学校',
            meaning: 'school',
            queuePosition: 2,
            createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
          },
        ],
        total: 2,
        limit: 100,
        nextCursor: null,
      },
      isLoading: false,
      error: null,
    });
  });

  it('renders the daily limit and new-card queue rows', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /study settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/new cards per day/i)).toHaveValue(20);
    expect(screen.getByText('会社')).toBeInTheDocument();
    expect(screen.getByText('学校')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reorder 会社/i })).toBeInTheDocument();
  });

  it('shows a settings load error without blocking the queue', () => {
    useStudySettingsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Settings endpoint failed'),
    });

    renderPage();

    expect(screen.getByText(/failed to load study settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/settings endpoint failed/i)).not.toBeInTheDocument();
    expect(screen.getByText('会社')).toBeInTheDocument();
  });

  it('shows a localized queue load error', () => {
    useStudyNewCardQueueMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Queue endpoint failed'),
    });

    renderPage();

    expect(screen.getByText(/failed to load the new-card queue/i)).toBeInTheDocument();
    expect(screen.queryByText(/queue endpoint failed/i)).not.toBeInTheDocument();
  });

  it('saves the daily new-card limit', async () => {
    const user = userEvent.setup();
    updateStudySettingsMock.mockResolvedValue({ newCardsPerDay: 12 });
    renderPage();

    const input = screen.getByLabelText(/new cards per day/i);
    await user.clear(input);
    await user.type(input, '12');
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() =>
      expect(updateStudySettingsMock).toHaveBeenCalledWith({ newCardsPerDay: 12 })
    );
  });

  it('shows localized feedback when saving the daily limit fails', async () => {
    updateStudySettingsMock.mockRejectedValue(new Error('Save endpoint failed'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    expect(await screen.findByText(/failed to save study settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/save endpoint failed/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/new cards per day/i), { target: { value: '12' } });
    expect(screen.queryByText(/failed to save study settings/i)).not.toBeInTheDocument();
  });

  it('clears and auto-dismisses the saved settings confirmation', async () => {
    vi.useFakeTimers();
    updateStudySettingsMock.mockResolvedValue({ newCardsPerDay: 12 });

    try {
      renderPage();

      const input = screen.getByLabelText(/new cards per day/i);
      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/saved/i)).toBeInTheDocument();

      fireEvent.change(input, { target: { value: '13' } });
      expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/saved/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists one reorder request and resets pagination from the returned first page', async () => {
    reorderStudyNewCardQueueMock.mockResolvedValue({
      items: [
        {
          id: 'card-3',
          noteId: 'note-3',
          cardType: 'recognition',
          displayText: '新しい',
          meaning: 'new',
          queuePosition: 1,
          createdAt: new Date('2026-04-02T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-04-02T00:00:00.000Z').toISOString(),
        },
      ],
      total: 101,
      limit: 100,
      nextCursor: '100',
    });

    renderPage();

    await act(async () => {
      dndContextProps.current?.onDragEnd?.({
        active: { id: 'card-1' },
        over: { id: 'card-2' },
      } as DragEndEvent);
    });

    await waitFor(() => expect(reorderStudyNewCardQueueMock).toHaveBeenCalledTimes(1));
    expect(reorderStudyNewCardQueueMock).toHaveBeenCalledWith(['card-2', 'card-1']);
    expect(screen.getByText('新しい')).toBeInTheDocument();
    expect(screen.queryByText('会社')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('rolls back optimistic reorder state when the reorder request fails', async () => {
    useStudyNewCardQueueMock.mockReturnValue({
      data: {
        items: [
          {
            id: 'card-1',
            noteId: 'note-1',
            cardType: 'recognition',
            displayText: '会社',
            meaning: 'company',
            queuePosition: 1,
            createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
          },
          {
            id: 'card-2',
            noteId: 'note-2',
            cardType: 'production',
            displayText: '学校',
            meaning: 'school',
            queuePosition: 2,
            createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
          },
        ],
        total: 101,
        limit: 100,
        nextCursor: '100',
      },
      isLoading: false,
      error: null,
    });
    reorderStudyNewCardQueueMock.mockRejectedValue(new Error('Reorder failed'));

    renderPage();

    await act(async () => {
      dndContextProps.current?.onDragEnd?.({
        active: { id: 'card-1' },
        over: { id: 'card-2' },
      } as DragEndEvent);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(reorderStudyNewCardQueueMock).toHaveBeenCalledTimes(1));
    const rows = screen.getAllByTestId('study-new-queue-row');
    expect(rows[0]).toHaveTextContent('会社');
    expect(rows[1]).toHaveTextContent('学校');
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });
});
