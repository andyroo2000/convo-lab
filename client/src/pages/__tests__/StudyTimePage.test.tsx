import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { studyTimeBucket, studyTimeRange } from '../../test/fixtures/studyTimeAnalytics';
import shiftStudyTimeAnchor from '../../utils/studyTimePeriod';
import StudyTimePage from '../StudyTimePage';

const {
  analyticsAnchorMock,
  deleteMutateMock,
  deleteResetMock,
  fetchNextPageMock,
  logCompletedMock,
  capabilitiesQueryMock,
  capabilitiesRefetchMock,
  saveMutateMock,
  saveResetMock,
  studyActivityStatusMock,
  stopMock,
} = vi.hoisted(() => ({
  analyticsAnchorMock: vi.fn(),
  capabilitiesQueryMock: vi.fn(),
  capabilitiesRefetchMock: vi.fn(),
  deleteMutateMock: vi.fn(),
  deleteResetMock: vi.fn(),
  fetchNextPageMock: vi.fn(),
  logCompletedMock: vi.fn(),
  saveMutateMock: vi.fn(),
  saveResetMock: vi.fn(),
  studyActivityStatusMock: vi.fn(),
  stopMock: vi.fn(),
}));

vi.mock('../../hooks/useStudyCapabilities', () => ({
  useStudyCapabilities: (enabled?: boolean) => capabilitiesQueryMock(enabled),
}));

vi.mock('../../contexts/StudyActivityContext', () => ({
  useStudyActivityActions: () => ({
    start: vi.fn(),
    stopAndWait: stopMock,
    logCompleted: logCompletedMock,
    logCompletedAndWait: logCompletedMock,
  }),
  useStudyActivityStatus: () => ({ enabled: true, ...studyActivityStatusMock() }),
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

function studyTimePageRanges(historical: boolean) {
  const dayStart = '2026-07-29T04:00:00Z';
  const dayEnd = '2026-07-30T04:00:00Z';
  const nyDate = (month: number, day: number, hour: number) =>
    new Date(Date.UTC(2026, month, day, hour)).toISOString();
  const mixed = (duration: number) => ({
    review: duration,
    create: duration,
    conversation: duration,
  });
  const months = Array.from({ length: 12 }, (_, i) =>
    studyTimeBucket(nyDate(i, 1, 5), nyDate(i + 1, 1, 5), {
      review: 300_000,
      listen: 150_000,
      conversation: 150_000,
    })
  );
  const days = Array.from({ length: 31 }, (_, i) =>
    studyTimeBucket(nyDate(6, i + 1, 4), nyDate(6, i + 2, 4), mixed(i < 29 ? 60_000 : 0))
  );
  return [
    studyTimeRange({
      key: 'today',
      startsAt: dayStart,
      endsAt: dayEnd,
      buckets: [studyTimeBucket(dayStart, dayEnd, { review: 600_000 })],
    }),
    studyTimeRange({
      key: 'week',
      startsAt: historical ? '2026-07-20T04:00:00Z' : '2026-07-27T04:00:00Z',
      endsAt: historical ? '2026-07-27T04:00:00Z' : '2026-08-03T04:00:00Z',
      buckets: [studyTimeBucket(dayStart, dayEnd, mixed(1_800_000))],
    }),
    studyTimeRange({
      key: 'month',
      startsAt: nyDate(6, 1, 4),
      endsAt: nyDate(7, 1, 4),
      buckets: days,
    }),
    studyTimeRange({
      key: 'year',
      startsAt: nyDate(0, 1, 5),
      endsAt: nyDate(12, 1, 5),
      buckets: months,
    }),
    studyTimeRange({
      key: 'all',
      startsAt: '2025-01-01T05:00:00Z',
      endsAt: '2026-07-29T16:00:00Z',
      bucketUnit: 'month',
      bucketStep: 1,
      buckets: [
        studyTimeBucket('2025-01-01T05:00:00Z', '2025-02-01T05:00:00Z', { review: 3_600_000 }),
        studyTimeBucket(nyDate(6, 1, 4), '2026-07-29T16:00:00Z', {
          create: 1_800_000,
          immerse: 1_800_000,
          conversation: 1_800_000,
        }),
      ],
    }),
  ];
}

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
        ranges: studyTimePageRanges(isHistorical),
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

const openLog = () => fireEvent.click(screen.getByRole('button', { name: 'Log time' }));
const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

describe('StudyTimePage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    analyticsAnchorMock.mockReset();
    capabilitiesRefetchMock.mockReset().mockResolvedValue({});
    capabilitiesQueryMock.mockReset().mockReturnValue({
      data: {
        studyActivity: {
          categoriesByActivity: {
            card_review: 'review',
            daily_audio: 'listen',
            card_creation: 'create',
            tv: 'immerse',
            podcast: 'immerse',
            reading: 'immerse',
            conversation: 'conversation',
            wanikani_review: 'wanikani',
            other: 'immerse',
          },
        },
      },
      isError: false,
      isFetching: false,
      refetch: capabilitiesRefetchMock,
    });
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
    expect(screen.getByRole('tab', { name: 'Rhythm' })).toHaveAttribute('aria-selected', 'true');
    openTab('Recap');
    expect(screen.getByRole('tabpanel')).toContainElement(
      screen.getByTestId('weekly-study-recap-card')
    );
    openTab('Mastery');
    expect(screen.getByRole('tabpanel')).toContainElement(screen.getByTestId('jlpt-mastery-card'));
    openLog();
    expect(screen.getByRole('tab', { name: 'Entries' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Log entry' }));

    expect(logCompletedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: 'card_creation',
        source: 'calendar',
        durationMs: 1_800_000,
      })
    );
  });

  it('keeps the timer and form values available across tabs and form toggles', () => {
    studyActivityStatusMock.mockReturnValue({ active: { name: 'Reading', activity: 'reading' } });
    render(<StudyTimePage />);
    expect(screen.queryByRole('button', { name: 'Start session' })).toBeNull();
    openLog();
    const nameField = { name: 'Source, show, or project' };
    fireEvent.change(screen.getByRole('textbox', nameField), { target: { value: 'Chapter 3' } });
    openTab('Recap');
    openTab('Entries');
    expect(screen.getByRole('button', { name: 'Stop Reading' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close form' }));
    expect(screen.queryByRole('textbox', nameField)).toBeNull();
    expect(stopMock).not.toHaveBeenCalled();
    openLog();
    expect(screen.getByRole('textbox', nameField)).toHaveValue('Chapter 3');
    fireEvent.click(screen.getByRole('button', { name: 'Stop Reading' }));
    expect(stopMock).toHaveBeenCalledOnce();
  });

  it('moves tab focus and selection with arrow, Home and End keys', () => {
    render(<StudyTimePage />);
    const steps = [
      ['Rhythm', 'ArrowLeft', 'Entries'],
      ['Entries', 'ArrowRight', 'Rhythm'],
      ['Rhythm', 'End', 'Entries'],
      ['Entries', 'Home', 'Rhythm'],
    ];
    steps.forEach(([current, key, target]) => {
      fireEvent.keyDown(screen.getByRole('tab', { name: current }), { key });
      const selected = screen.getByRole('tab', { name: target, selected: true });
      expect(selected).toHaveFocus();
      expect(screen.getByRole('tabpanel')).toHaveAccessibleName(target);
    });
  });

  it('shows a retryable capability error and disables new optimistic timers', () => {
    capabilitiesQueryMock.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      refetch: capabilitiesRefetchMock,
    });
    render(<StudyTimePage />);
    openLog();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Study limits and defaults couldn’t be loaded.'
    );
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Log entry' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(capabilitiesRefetchMock).toHaveBeenCalledOnce();
  });

  it('does not load capabilities when study activity tracking is disabled', () => {
    studyActivityStatusMock.mockReturnValue({ active: null, enabled: false });

    render(<StudyTimePage />);

    openTab('Entries');
    expect(capabilitiesQueryMock).toHaveBeenCalledWith(false);
  });

  it('loads additional editable entries without expanding the sync window', () => {
    render(<StudyTimePage />);
    openTab('Entries');
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

    openTab('Mastery');
    const initialAnchor = analyticsAnchorMock.mock.calls[0][0] as string;
    const next = screen.getByRole('button', { name: 'Next period' });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    expect(screen.getByRole('tab', { name: 'Rhythm', selected: true })).toBeVisible();
    expect(analyticsAnchorMock).toHaveBeenLastCalledWith(
      shiftStudyTimeAnchor(initialAnchor, 'week', -1)
    );
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(analyticsAnchorMock).toHaveBeenLastCalledWith(initialAnchor);
    expect(next).toBeDisabled();
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
    openTab('Entries');

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
    openTab('Entries');

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
