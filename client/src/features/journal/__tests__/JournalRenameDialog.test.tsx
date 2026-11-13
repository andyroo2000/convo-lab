import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import JournalRowActions from '../JournalRowActions';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});
function setup(rename = vi.fn().mockResolvedValue(undefined)) {
  const onRenamed = vi.fn();
  const entry = {
    id: 'entry',
    title: 'Old title',
    body: 'Writing',
    entryDate: '2026-11-13',
    version: 1,
  };
  render(
    <JournalRowActions
      entry={entry}
      rename={rename}
      remove={vi.fn()}
      snapshot={(value) => value}
      onRenamed={onRenamed}
      onDeleted={vi.fn()}
    />
  );
  const trigger = screen.getByRole('button', { name: 'Actions for Old title' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
  return { entry, rename, onRenamed, trigger };
}

it('shows the simple field and Save, and cancellation restores focus without saving', () => {
  const { rename, trigger } = setup();
  expect(screen.getByRole('dialog', { name: 'Rename entry' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Entry title' })).toHaveValue('Old title');
  expect(screen.queryByText('Entry title')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(rename).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
});

it('blocks blank names, duplicates, and dismissal while saving; reports success', async () => {
  let finish!: () => void;
  const rename = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const { entry, onRenamed } = setup(rename);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: '  ' } });
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.change(input, { target: { value: 'New title' } });
  fireEvent.click(screen.getByRole('button', { name: /Sav/ }));
  fireEvent.click(screen.getByRole('button', { name: /Sav/ }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(rename).toHaveBeenCalledExactlyOnceWith(entry, 'New title');
  await act(async () => finish());
  expect(onRenamed).toHaveBeenCalledWith(entry.id);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps the entered title and allows retry when saving fails', async () => {
  const rename = vi
    .fn()
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(undefined);
  setup(rename);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New title' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Offline'));
  expect(screen.getByRole('textbox')).toHaveValue('New title');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
