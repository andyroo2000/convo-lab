import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import shiftStudyTimeAnchor from '../../utils/studyTimePeriod';
import StudyTimePage from '../StudyTimePage';

const {
  analyticsAnchorMock,
  deleteMutateMock,
  deleteResetMock,
  logCompletedMock,
  saveMutateMock,
  saveResetMock,
} = vi.hoisted(() => ({
  analyticsAnchorMock: vi.fn(),
  deleteMutateMock: vi.fn(),
  deleteResetMock: vi.fn(),
  logCompletedMock: vi.fn(),
  saveMutateMock: vi.fn(),
  saveResetMock: vi.fn(),
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
  useStudyActivityAnalytics: (anchorDate: string) => {
    const initialAnchor =
      (analyticsAnchorMock.mock.calls[0]?.[0] as string | undefined) ?? anchorDate;
    const isHistorical = anchorDate !== initialAnchor;
    analyticsAnchorMock(anchorDate);

    return {
      data: {
        generatedAt: '2026-07-29T16:00:00Z',
        anchorDate,
        timezone: 'America/New_York',
        ranges: [
          {
            key: 'today',
            startsAt: '2026-07-29T04:00:00Z',
            endsAt: '2026-07-30T04:00:00Z',
            totalMs: 600_000,
            categories: {
              review: 600_000,
              listen: 0,
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
            endsAt: isHistorical ? '2026-07-27T04:00:00Z' : '2026-08-03T04:00:00Z',
            totalMs: 5_400_000,
            categories: {
              review: 1_800_000,
              listen: 0,
              create: 1_800_000,
              immerse: 0,
              conversation: 1_800_000,
              wanikani: 0,
            },
            buckets: [],
          },
          {
            key: 'month',
            startsAt: '2026-07-01T04:00:00Z',
            endsAt: '2026-08-01T04:00:00Z',
            totalMs: 5_400_000,
            categories: {
              review: 1_800_000,
              listen: 0,
              create: 1_800_000,
              immerse: 0,
              conversation: 1_800_000,
              wanikani: 0,
            },
            buckets: Array.from({ length: 31 }, (_, index) => ({
              startsAt: new Date(Date.UTC(2026, 6, index + 1, 4)).toISOString(),
              endsAt: new Date(Date.UTC(2026, 6, index + 2, 4)).toISOString(),
              totalMs: index < 29 ? 180_000 : 0,
              categories: {
                review: index < 29 ? 60_000 : 0,
                listen: 0,
                create: index < 29 ? 60_000 : 0,
                immerse: 0,
                conversation: index < 29 ? 60_000 : 0,
                wanikani: 0,
              },
            })),
          },
          {
            key: 'all',
            startsAt: '2025-01-01T05:00:00Z',
            endsAt: '2026-07-29T16:00:00Z',
            bucketUnit: 'month',
            bucketStep: 1,
            totalMs: 9_000_000,
            categories: {
              review: 3_600_000,
              listen: 0,
              create: 1_800_000,
              immerse: 1_800_000,
              conversation: 1_800_000,
              wanikani: 0,
            },
            buckets: [
              {
                startsAt: '2025-01-01T05:00:00Z',
                endsAt: '2025-02-01T05:00:00Z',
                totalMs: 3_600_000,
                categories: {
                  review: 3_600_000,
                  listen: 0,
                  create: 0,
                  immerse: 0,
                  conversation: 0,
                  wanikani: 0,
                },
              },
              {
                startsAt: '2026-07-01T04:00:00Z',
                endsAt: '2026-07-29T16:00:00Z',
                totalMs: 5_400_000,
                categories: {
                  review: 0,
                  listen: 0,
                  create: 1_800_000,
                  immerse: 1_800_000,
                  conversation: 1_800_000,
                  wanikani: 0,
                },
              },
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    };
  },
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
    reset: saveResetMock,
    isPending: false,
    isError: false,
  }),
  useDeleteStudyActivitySession: () => ({
    mutate: deleteMutateMock,
    reset: deleteResetMock,
    isPending: false,
    isError: false,
  }),
}));

describe('StudyTimePage', () => {
  beforeEach(() => {
    analyticsAnchorMock.mockReset();
    logCompletedMock.mockReset();
    saveMutateMock.mockReset();
    deleteMutateMock.mockReset();
    deleteResetMock.mockReset();
    saveResetMock.mockReset();
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
    expect(screen.getByText(/Jan.*25/)).toBeInTheDocument();
    expect(screen.getAllByText(/Jul.*26/)).not.toHaveLength(0);
  });

  it('navigates to an earlier period and prevents future navigation', () => {
    render(<StudyTimePage />);

    const initialAnchor = analyticsAnchorMock.mock.calls[0][0] as string;
    expect(screen.getAllByRole('button', { name: 'Next period' })).toHaveLength(2);
    screen
      .getAllByRole('button', { name: 'Next period' })
      .forEach((button) => expect(button).toBeDisabled());

    fireEvent.click(screen.getAllByRole('button', { name: 'Previous period' })[0]);

    expect(analyticsAnchorMock).toHaveBeenLastCalledWith(
      shiftStudyTimeAnchor(initialAnchor, 'week', -1)
    );
    screen
      .getAllByRole('button', { name: 'Next period' })
      .forEach((button) => expect(button).toBeEnabled());

    fireEvent.click(screen.getAllByRole('button', { name: 'Next period' })[0]);

    expect(analyticsAnchorMock).toHaveBeenLastCalledWith(initialAnchor);
    screen
      .getAllByRole('button', { name: 'Next period' })
      .forEach((button) => expect(button).toBeDisabled());
    expect(screen.getByTestId('study-time-period-label')).toHaveTextContent('Jul 27 – Aug 2, 2026');
  });

  it('fits the full analytics period inside the chart container', () => {
    render(<StudyTimePage />);

    fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    const chart = screen.getByTestId('study-rhythm-chart-month');

    expect(screen.getAllByTestId('study-rhythm-chart-bucket')).toHaveLength(31);
    expect(chart).toHaveClass('w-full', 'min-w-0');
    expect(chart.style.minWidth).toBe('');
    const container = screen.getByTestId('study-rhythm-chart-container-month');
    expect(container).toHaveClass('min-w-0', 'overflow-hidden');
    expect(container).not.toHaveClass('overflow-x-auto');
    expect(screen.getAllByTitle('Card review: 1m')).toHaveLength(29);
  });

  it('edits a manual entry and remaps its category', () => {
    render(<StudyTimePage />);

    expect(screen.queryByText('Automatic review')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Episode 8 cards' }));

    expect(saveResetMock).toHaveBeenCalledOnce();
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
    expect(deleteResetMock).toHaveBeenCalledOnce();
    expect(deleteMutateMock).not.toHaveBeenCalled();
    expect(screen.getByText('Delete “Episode 8 cards”? This can’t be undone.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('modal-button-confirm'));

    expect(deleteMutateMock).toHaveBeenCalledWith(
      '018f22d2-6d38-7000-8000-000000000002',
      expect.any(Object)
    );
  });
});
