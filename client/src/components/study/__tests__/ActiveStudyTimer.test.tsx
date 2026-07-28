import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import ActiveStudyTimer from '../ActiveStudyTimer';

const { stopMock } = vi.hoisted(() => ({ stopMock: vi.fn() }));

vi.mock('../../../contexts/StudyActivityContext', () => ({
  useStudyActivityActions: () => ({ stop: stopMock }),
  useStudyActivityStatus: () => ({
    active: {
      activity: 'card_review',
      startedAt: '2026-07-28T15:00:00.000Z',
    },
    elapsedMs: 65_000,
  }),
}));

describe('ActiveStudyTimer', () => {
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
});
