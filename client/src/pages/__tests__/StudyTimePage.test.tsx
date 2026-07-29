import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyTimePage from '../StudyTimePage';

const { deleteMutateMock, logCompletedMock, saveMutateMock } = vi.hoisted(() => ({
  deleteMutateMock: vi.fn(),
  logCompletedMock: vi.fn(),
  saveMutateMock: vi.fn(),
}));

vi.mock('../../contexts/StudyActivityContext', () => ({
  useStudyActivityActions: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    logCompleted: logCompletedMock,
  }),
  useStudyActivityStatus: () => ({ active: null }),
}));

vi.mock('../../hooks/useStudyActivity', () => ({
  useStudyActivityAnalytics: () => ({
    data: {
      generatedAt: '2026-07-29T02:00:00Z',
      timezone: 'America/New_York',
      ranges: [
        {
          key: 'today',
          startsAt: '2026-07-29T04:00:00Z',
          endsAt: '2026-07-29T02:00:00Z',
          totalMs: 600_000,
          categories: {
            review: 600_000,
            create: 0,
            immerse: 0,
            conversation: 0,
            wanikani: 0,
          },
          buckets: [],
        },
        {
          key: 'week',
          startsAt: '2026-07-27T04:00:00Z',
          endsAt: '2026-07-29T02:00:00Z',
          totalMs: 5_400_000,
          categories: {
            review: 1_800_000,
            create: 1_800_000,
            immerse: 0,
            conversation: 1_800_000,
            wanikani: 0,
          },
          buckets: [],
        },
        {
          key: 'all',
          startsAt: '2025-01-01T05:00:00Z',
          endsAt: '2026-07-29T02:00:00Z',
          totalMs: 9_000_000,
          categories: {
            review: 3_600_000,
            create: 1_800_000,
            immerse: 1_800_000,
            conversation: 1_800_000,
            wanikani: 0,
          },
          buckets: [],
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useStudyActivitySessions: () => ({
    data: [
      {
        clientSessionId: '018f22d2-6d38-7000-8000-000000000002',
        category: 'create',
        activity: 'card_creation',
        source: 'manual',
        name: 'Episode 8 cards',
        startedAt: '2026-07-28T19:00:00Z',
        endedAt: '2026-07-28T19:45:00Z',
        durationMs: 2_700_000,
        audioPlaybackMs: null,
        cardsCreated: 12,
      },
      {
        clientSessionId: '018f22d2-6d38-7000-8000-000000000003',
        category: 'review',
        activity: 'card_review',
        source: 'automatic',
        name: 'Automatic review',
        startedAt: '2026-07-28T18:00:00Z',
        endedAt: '2026-07-28T18:30:00Z',
        durationMs: 1_800_000,
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useSaveStudyActivitySession: () => ({
    mutate: saveMutateMock,
    isPending: false,
    isError: false,
  }),
  useDeleteStudyActivitySession: () => ({
    mutate: deleteMutateMock,
    isPending: false,
    isError: false,
  }),
}));

describe('StudyTimePage', () => {
  beforeEach(() => {
    logCompletedMock.mockReset();
    saveMutateMock.mockReset();
    deleteMutateMock.mockReset();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '018f22d2-6d38-7000-8000-000000000001'
    );
  });

  it('renders the dashboard and durably logs a manual calendar entry', () => {
    render(<StudyTimePage />);

    expect(screen.getByRole('heading', { name: 'Study Rhythm' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Study rhythm overview' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log entry' }));

    expect(logCompletedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: 'card_creation',
        category: 'create',
        source: 'calendar',
        durationMs: 1_800_000,
      })
    );
  });

  it('switches analytics ranges', () => {
    render(<StudyTimePage />);

    const allRange = screen.getByRole('radio', { name: 'All' });
    fireEvent.click(allRange);

    expect(allRange).toBeChecked();
    expect(screen.getByText('2h 30m')).toBeInTheDocument();
  });

  it('edits a manual entry and remaps its category', () => {
    render(<StudyTimePage />);

    expect(screen.queryByText('Automatic review')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Episode 8 cards' }));

    expect(screen.getByRole('dialog', { name: 'Edit study time' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Edit name' })).toHaveValue('Episode 8 cards');

    fireEvent.change(screen.getByRole('combobox', { name: 'Edit activity' }), {
      target: { value: 'conversation' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Edit duration in minutes' }), {
      target: { value: '60' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(saveMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSessionId: '018f22d2-6d38-7000-8000-000000000002',
        activity: 'conversation',
        category: 'conversation',
        durationMs: 3_600_000,
        audioPlaybackMs: null,
        cardsCreated: null,
      }),
      expect.any(Object)
    );
  });

  it('confirms before deleting a manual entry', () => {
    render(<StudyTimePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Episode 8 cards' }));
    expect(deleteMutateMock).not.toHaveBeenCalled();
    expect(screen.getByText('Delete “Episode 8 cards”? This can’t be undone.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('modal-button-confirm'));

    expect(deleteMutateMock).toHaveBeenCalledWith(
      '018f22d2-6d38-7000-8000-000000000002',
      expect.any(Object)
    );
  });
});
