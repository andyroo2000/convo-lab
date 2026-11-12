import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JournalCopyButton from '../JournalCopyButton';

const writeText = vi.fn();
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => vi.useRealTimers());

it('copies the corrected text, announces success, and resets the icon', async () => {
  vi.useFakeTimers();
  render(<JournalCopyButton text="映画を見た。" />);
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Copy corrected version' }))
  );
  expect(writeText).toHaveBeenCalledWith('映画を見た。');
  expect(screen.getByRole('status')).toHaveTextContent('Copied');
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByRole('button', { name: 'Copy corrected version' })).toBeInTheDocument();
});

it('leaves a failed copy retryable and reports the failure outside the header layout', async () => {
  writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
  render(<JournalCopyButton text="映画を見た。" />);
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy');
  fireEvent.click(screen.getByRole('button'));
  await screen.findByRole('button', { name: 'Copied' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
