import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JournalOverflow from '../JournalOverflow';
import JournalCopyButton from '../JournalCopyButton';

const writeText = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => vi.useRealTimers());

it.each(['Draft text', 'Final text'])(
  'confirms %s above the closed menu and restarts the timeout',
  async (text) => {
    render(
      <JournalOverflow>
        <JournalCopyButton text={text} menu />
      </JournalOverflow>
    );
    const trigger = screen.getByLabelText('More journal options');
    async function copy() {
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole('button', { name: /Copy text|Copied/ }));
      await act(async () => {
        await Promise.resolve();
      });
    }
    await copy();
    expect(writeText).toHaveBeenCalledWith(text);
    expect(screen.getByRole('button', { name: /Copy text|Copied/ })).not.toBeVisible();
    expect(screen.getByText('Text copied')).toBeVisible();
    expect(trigger).toHaveFocus();
    act(() => vi.advanceTimersByTime(1500));
    await copy();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText('Text copied')).toBeVisible();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByText('Text copied')).not.toBeInTheDocument();
  }
);

it('keeps failed copies open and never announces success', async () => {
  writeText.mockRejectedValueOnce(new Error('Denied'));
  render(
    <JournalOverflow>
      <JournalCopyButton text="Draft" menu />
    </JournalOverflow>
  );
  const trigger = screen.getByLabelText('More journal options');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: /Copy text/ }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole('button', { name: /Copy text/ })).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('Could not copy');
  expect(screen.queryByText('Text copied')).not.toBeInTheDocument();
});
