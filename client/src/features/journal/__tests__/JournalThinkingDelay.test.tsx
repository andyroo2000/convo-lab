import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import JournalThinkingDelay from '../JournalThinkingDelay';

afterEach(() => vi.useRealTimers());
it('offers a safe exit only after a long wait and clears its timer on unmount', () => {
  vi.useFakeTimers();
  const { unmount } = render(<JournalThinkingDelay />);
  act(() => vi.advanceTimersByTime(59999));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('status')).toHaveTextContent('Your writing is saved.');
  expect(screen.getByRole('link', { name: 'Return to journal' })).toHaveAttribute(
    'href',
    '/app/journal'
  );
  unmount();
  render(<JournalThinkingDelay />).unmount();
  expect(vi.getTimerCount()).toBe(0);
});
