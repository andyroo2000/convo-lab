import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActiveStudyTimer from '../ActiveStudyTimer';

const { activityState, stopMock } = vi.hoisted(() => ({
  activityState: { activity: 'card_review' },
  stopMock: vi.fn(),
}));

vi.mock('../../../contexts/StudyActivityContext', () => ({
  useStudyActivityActions: () => ({ stop: stopMock }),
  useStudyActivityStatus: () => ({
    active: {
      activity: activityState.activity,
      startedAt: '2026-07-28T15:00:00.000Z',
    },
    elapsedMs: 65_000,
  }),
}));

describe('ActiveStudyTimer', () => {
  beforeEach(() => {
    activityState.activity = 'card_review';
    stopMock.mockClear();
  });

  it('renders elapsed time and stops the active session', () => {
    render(
      <MemoryRouter>
        <ActiveStudyTimer />
      </MemoryRouter>
    );

    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('Card review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop study timer' }));
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('does not show timer controls while card creation is tracked', () => {
    activityState.activity = 'card_creation';

    render(
      <MemoryRouter>
        <ActiveStudyTimer />
      </MemoryRouter>
    );

    expect(screen.queryByText('1:05')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop study timer' })).not.toBeInTheDocument();
  });
});
