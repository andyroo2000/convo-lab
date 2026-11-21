import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import JournalWritingField from '../JournalWritingField';
import { saveKeyboardMode } from '../journalKeyboardPreference';
import { loadKeyboard } from '../journalKeyboardRuntime';

vi.mock('../journalKeyboardRuntime', () => ({ loadKeyboard: vi.fn() }));
const dispose = vi.fn();
const changed = vi.fn();
const attach = vi.fn(() => ({ dispose }));
const readiness = vi.fn(() => ({ state: 'ready' }));
const retry = vi.fn(async () => {
  readiness.mockReturnValue({ state: 'ready' });
});
const Editor = () => {
  const [text, setText] = useState('前後');
  return (
    <>
      <output aria-label="Saved writing">{text}</output>
      <JournalWritingField
        aria-label="Writing"
        value={text}
        onChange={(event) => {
          changed(event.target.value);
          setText(event.target.value);
        }}
      />
    </>
  );
};
beforeEach(() => {
  vi.clearAllMocks();
  readiness.mockReturnValue({ state: 'ready' });
  vi.mocked(loadKeyboard).mockResolvedValue({ attach, readiness, retry });
  saveKeyboardMode('device');
});
it('does not download the engine when using the device keyboard', () => {
  render(<Editor />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '日本語' } });
  expect(screen.getByRole('textbox')).toHaveValue('日本語');
  expect(loadKeyboard).not.toHaveBeenCalled();
});
it('keeps converted DOM edits in React state and releases the editor when switching keyboards', async () => {
  saveKeyboardMode('built-in');
  render(<Editor />);
  await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  field.setRangeText('雨', 1, 1, 'end');
  fireEvent(field, new Event('input', { bubbles: true }));
  expect(field).toHaveValue('前雨後');
  expect(changed).toHaveBeenCalledExactlyOnceWith('前雨後');
  expect(screen.getByLabelText('Saved writing')).toHaveTextContent('前雨後');
  saveKeyboardMode('device');
  await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
  expect(field).toHaveValue('前雨後');
});
it('forwards runtime value assignments exactly once when React has already tracked the value', () => {
  render(<Editor />);
  const field = screen.getByRole('textbox') as HTMLTextAreaElement;
  field.value = '直接';
  fireEvent(field, new Event('input', { bubbles: true }));
  expect(changed).toHaveBeenCalledExactlyOnceWith('直接');
  expect(screen.getByLabelText('Saved writing')).toHaveTextContent('直接');
});
it('preserves writing and offers retry or the device keyboard when preparation fails', async () => {
  saveKeyboardMode('built-in');
  readiness.mockReturnValue({ state: 'error' });
  render(<Editor />);
  await screen.findByText('Couldn’t prepare Japanese input.');
  expect(screen.getByRole('textbox')).toHaveValue('前後');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly');
});
it('does not attach a late engine response to an unmounted editor', async () => {
  saveKeyboardMode('built-in');
  let finish!: (value: Awaited<ReturnType<typeof loadKeyboard>>) => void;
  vi.mocked(loadKeyboard).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const { unmount } = render(<Editor />);
  unmount();
  finish({ attach, readiness, retry });
  await Promise.resolve();
  expect(attach).not.toHaveBeenCalled();
});
