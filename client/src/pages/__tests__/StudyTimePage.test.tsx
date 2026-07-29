import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyTimePage from '../StudyTimePage';

const { logCompletedMock } = vi.hoisted(() => ({
  logCompletedMock: vi.fn(),
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
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useStudyActivitySessions: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useSaveStudyActivitySession: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteStudyActivitySession: () => ({ mutate: vi.fn() }),
}));

describe('StudyTimePage', () => {
  beforeEach(() => {
    logCompletedMock.mockReset();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '018f22d2-6d38-7000-8000-000000000001'
    );
  });

  it('renders the dashboard and durably logs a manual calendar entry', () => {
    render(<StudyTimePage />);

    expect(screen.getAllByRole('heading', { name: 'Study Rhythm' })).toHaveLength(2);
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
});
