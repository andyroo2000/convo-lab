import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import JournalLanding from '../JournalLanding';
import { newJournalDraft } from '../journalDrafts';

vi.mock('../JournalEntryContent', () => ({
  default: ({ onWritingChange }: { onWritingChange: (writing: boolean) => void }) => (
    <textarea
      aria-label="Notebook"
      onChange={(event) => onWritingChange(Boolean(event.target.value))}
    />
  ),
}));
vi.mock('../JournalResume', () => ({
  default: () => <button type="button">Continue draft</button>,
}));

function props(blank = false): ComponentProps<typeof JournalLanding> {
  const draft = { ...newJournalDraft(), body: 'Today', version: 1 };
  return {
    ownerId: 'owner',
    blank,
    onSelectToday: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onSaved: vi.fn(),
    onBusyChange: vi.fn(),
    archive: { entries: [draft], query: { isPending: false } } as unknown as ComponentProps<
      typeof JournalLanding
    >['archive'],
  };
}

it('automatically opens today only on arrival', async () => {
  const input = props();
  const { rerender } = render(<JournalLanding {...input} />);
  await waitFor(() =>
    expect(input.onSelectToday).toHaveBeenCalledExactlyOnceWith(input.archive.entries[0].id)
  );
  rerender(
    <JournalLanding
      {...input}
      archive={{ ...input.archive, entries: [...input.archive.entries] }}
    />
  );
  expect(input.onSelectToday).toHaveBeenCalledOnce();
});

it('keeps a deliberately closed draft closed and allows new writing without a focus-changing remount', () => {
  const input = props(true);
  render(<JournalLanding {...input} />);
  expect(input.onSelectToday).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Continue draft' })).toBeVisible();
  const notebook = screen.getByRole('textbox');
  notebook.focus();
  fireEvent.input(notebook, { target: { value: '今日' } });
  expect(screen.getByRole('textbox')).toBe(notebook);
  expect(notebook).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Continue draft' })).toBeNull();
});

it('waits for the initial archive without replacing writing after a late refresh', () => {
  const input = props();
  const { rerender } = render(
    <JournalLanding
      {...input}
      archive={{
        ...input.archive,
        query: { isPending: true } as unknown as ComponentProps<
          typeof JournalLanding
        >['archive']['query'],
      }}
    />
  );
  expect(screen.queryByRole('textbox')).toBeNull();
  rerender(<JournalLanding {...input} archive={{ ...input.archive, entries: [] }} />);
  const notebook = screen.getByRole('textbox');
  fireEvent.input(notebook, { target: { value: 'New' } });
  rerender(<JournalLanding {...input} />);
  expect(input.onSelectToday).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox')).toBe(notebook);
});
