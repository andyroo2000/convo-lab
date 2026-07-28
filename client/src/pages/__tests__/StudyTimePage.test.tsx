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
  useStudyActivitySessions: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
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

    expect(screen.getByRole('heading', { name: 'Your learning week' })).toBeInTheDocument();
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
