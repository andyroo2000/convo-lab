import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import JournalProgress from '../JournalProgress';

afterEach(() => vi.useRealTimers());

it('shows the actual phase, elapsed time, and an estimate that never claims completion', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
  const startedAt = new Date().toISOString();
  const { rerender, unmount } = render(<JournalProgress status="queued" startedAt={startedAt} />);
  expect(screen.getByRole('status')).toHaveTextContent('Waiting to begin');
  rerender(<JournalProgress status="processing" startedAt={startedAt} />);
  expect(screen.getByRole('status')).toHaveTextContent('Reviewing your Japanese');
  expect(screen.getByText(/30–60 seconds/)).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(65_000));
  expect(screen.getByText('65s')).toBeInTheDocument();
  expect(screen.getByText(/Still working/)).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  act(() => vi.advanceTimersByTime(600_000));
  expect(screen.getByRole('progressbar')).not.toHaveStyle({ width: '100%' });
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuetext',
    'Reviewing; time estimate only'
  );
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it.each([undefined, 'invalid', '2026-11-12T10:00:00Z', '2026-11-12T14:00:00Z'])(
  'uses time on this screen when the start time is missing or skewed: %s',
  (startedAt) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
    render(<JournalProgress status="processing" startedAt={startedAt} />);
    expect(screen.getByText('0s')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('5s')).toBeInTheDocument();
  }
);
