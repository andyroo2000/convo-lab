import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import shiftStudyTimeAnchor from '../../utils/studyTimePeriod';
import StudyTimePage from '../StudyTimePage';

const {
  analyticsAnchorMock,
  deleteMutateMock,
  deleteResetMock,
  fetchNextPageMock,
  logCompletedMock,
  saveMutateMock,
  saveResetMock,
  studyActivityStatusMock,
  stopMock,
} = vi.hoisted(() => ({
  analyticsAnchorMock: vi.fn(),
  deleteMutateMock: vi.fn(),
  deleteResetMock: vi.fn(),
  fetchNextPageMock: vi.fn(),
  logCompletedMock: vi.fn(),
  saveMutateMock: vi.fn(),
  saveResetMock: vi.fn(),
  studyActivityStatusMock: vi.fn(),
  stopMock: vi.fn(),
}));

vi.mock('../../contexts/StudyActivityContext', () => ({
  useStudyActivityActions: () => ({
    start: vi.fn(),
    stopAndWait: stopMock,
    logCompleted: logCompletedMock,
    logCompletedAndWait: logCompletedMock,
  }),
  useStudyActivityStatus: () => studyActivityStatusMock(),
}));

vi.mock('../../components/study/GoogleCalendarConnectionCard', () => ({
  default: () => null,
}));

vi.mock('../../components/study/WeeklyStudyRecapCard', () => ({
  default: () => <div data-testid="weekly-study-recap-card" />,
}));

vi.mock('../../components/study/JlptMasteryCard', () => ({
  default: () => <div data-testid="jlpt-mastery-card" />,
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
            buckets: [
              {
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
              },
            ],
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
            buckets: [
              {
                startsAt: '2026-07-29T04:00:00Z',
                endsAt: '2026-07-30T04:00:00Z',
                totalMs: 5_400_000,
                categories: {
                  review: 1_800_000,
                  listen: 0,
                  create: 1_800_000,
                  immerse: 0,
                  conversation: 1_800_000,
                  wanikani: 0,
                },
              },
            ],
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
            key: 'year',
            startsAt: '2026-01-01T05:00:00Z',
            endsAt: '2027-01-01T05:00:00Z',
            totalMs: 7_200_000,
            categories: {
              review: 3_600_000,
              listen: 1_800_000,
              create: 0,
              immerse: 0,
              conversation: 1_800_000,
              wanikani: 0,
            },
            buckets: Array.from({ length: 12 }, (_, index) => ({
              startsAt: new Date(Date.UTC(2026, index, 1, 5)).toISOString(),
              endsAt: new Date(Date.UTC(2026, index + 1, 1, 5)).toISOString(),
              totalMs: 600_000,
              categories: {
                review: 300_000,
                listen: 150_000,
                create: 0,
                immerse: 0,
                conversation: 150_000,
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
  useEditableStudyActivitySessions: () => ({
    data: {
      pages: [
        {
          items: [
            {
              clientSessionId: '018f22d2-6d38-7000-8000-000000000002',
              category: 'create',
              activity: 'card_creation',
              source: 'manual',
              origin: 'legacy',
              provider: null,
              editable: true,
              name: 'Episode 8 cards',
              startedAt: '2026-07-28T19:00:00Z',
              endedAt: '2026-07-28T19:45:00Z',
              durationMs: 2_700_000,
              audioPlaybackMs: null,
              cardsCreated: 12,
            },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: fetchNextPageMock,
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

const expandManualTimeEntry = () => {
  const disclosure = screen.getByTestId('manual-study-time-section');
  expect(disclosure).not.toHaveAttribute('open');
  fireEvent.click(screen.getByRole('heading', { name: 'Manual time entry' }));
  expect(disclosure).toHaveAttribute('open');
  return disclosure;
};

describe('StudyTimePage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    analyticsAnchorMock.mockReset();
    logCompletedMock.mockReset();
    saveMutateMock.mockReset();
    deleteMutateMock.mockReset();
    deleteResetMock.mockReset();
    saveResetMock.mockReset();
    fetchNextPageMock.mockReset();
    stopMock.mockReset();
    studyActivityStatusMock.mockReset();
    studyActivityStatusMock.mockReturnValue({ active: null });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '018f22d2-6d38-7000-8000-000000000001'
    );
  });

  it('renders the dashboard and durably logs a manual calendar entry', () => {
    render(<StudyTimePage />);

    expect(screen.getByRole('heading', { name: 'Study Time' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Study time analytics' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Study rhythm overview' })
    ).not.toBeInTheDocument();
    const weeklyRecap = screen.getByTestId('weekly-study-recap-card');
    const jlptMastery = screen.getByTestId('jlpt-mastery-card');
    const manualTimeEntry = screen.getByTestId('manual-study-time-section');
    expect(jlptMastery.compareDocumentPosition(manualTimeEntry)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    expandManualTimeEntry();

    const manualEntries = screen.getByRole('heading', { name: 'Manual entries' });
    expect(weeklyRecap.compareDocumentPosition(jlptMastery)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(manualTimeEntry).toContainElement(manualEntries);
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

  it('loads additional editable entries without expanding the sync window', () => {
    render(<StudyTimePage />);
    expandManualTimeEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Load more entries' }));
    expect(fetchNextPageMock).toHaveBeenCalledOnce();
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

    expect(within(chart).getAllByTestId('study-rhythm-chart-bucket')).toHaveLength(31);
    expect(within(chart).getByText('1')).toBeInTheDocument();
    expect(within(chart).queryByText('Jul 1')).not.toBeInTheDocument();
    expect(chart).toHaveClass('w-full', 'min-w-0');
    expect(chart.style.minWidth).toBe('');
    const container = screen.getByTestId('study-rhythm-chart-container-month');
    expect(container).toHaveClass('min-w-0', 'overflow-hidden');
    expect(container).not.toHaveClass('overflow-x-auto');
    expect(screen.getAllByTitle('Card review: 1m')).toHaveLength(29);
  });

  it('filters chart categories and recomputes the summary metrics', () => {
    render(<StudyTimePage />);

    const filters = screen.getByLabelText('Study category filters');
    const conversation = within(filters).getByRole('button', {
      name: /Conversation: 30m/,
    });
    const totalMetric = screen.getByTestId('study-time-total');

    expect(conversation).toHaveAttribute('aria-pressed', 'true');
    expect(within(totalMetric).getByText('1h 30m')).toBeInTheDocument();

    fireEvent.doubleClick(conversation);

    expect(conversation).toHaveAttribute('aria-pressed', 'false');
    expect(within(totalMetric).getByText('1h')).toBeInTheDocument();
  });

  it('drills from a year month into the existing month view', () => {
    render(<StudyTimePage />);

    fireEvent.click(screen.getByRole('radio', { name: 'Year' }));
    const yearChart = screen.getByTestId('study-rhythm-chart-year');
    fireEvent.doubleClick(within(yearChart).getByRole('button', { name: /Mar: 10m/ }));

    expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
    expect(analyticsAnchorMock).toHaveBeenLastCalledWith('2026-03-01');
  });

  it.each(['Week', 'Month'])('drills from %s into the existing day view', (rangeName) => {
    render(<StudyTimePage />);

    fireEvent.click(screen.getByRole('radio', { name: rangeName }));
    const rangeKey = rangeName.toLowerCase();
    const chart = screen.getByTestId(`study-rhythm-chart-${rangeKey}`);
    const drillableBar = within(chart).getAllByRole('button')[0];
    fireEvent.doubleClick(drillableBar);

    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
  });

  it('edits a manual entry and remaps its category', () => {
    render(<StudyTimePage />);
    expandManualTimeEntry();

    expect(screen.queryByText('Automatic review')).not.toBeInTheDocument();
    expect(screen.queryByText('Imported iTalki lesson')).not.toBeInTheDocument();
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
    expandManualTimeEntry();

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
