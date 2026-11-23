import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import JournalLanding from '../JournalLanding';
import { newJournalDraft } from '../journalDrafts';

vi.mock('../JournalEntryContent', () => ({
  default: () => <textarea aria-label="Notebook" />,
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
  expect(screen.queryByRole('button', { name: 'Continue draft' })).toBeNull();
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

it('opens a blank notebook when an old device edit points to a missing entry', () => {
  const input = props();
  const query = {
    ...input.archive.query,
    isSuccess: true,
    hasNextPage: false,
    data: { pages: [{ data: [], nextCursor: null }], pageParams: [undefined] },
  } as typeof input.archive.query;
  render(<JournalLanding {...input} archive={{ ...input.archive, query }} />);
  expect(screen.getByRole('textbox')).toBeVisible();
  expect(input.onSelectToday).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Continue draft' })).toBeNull();
});
