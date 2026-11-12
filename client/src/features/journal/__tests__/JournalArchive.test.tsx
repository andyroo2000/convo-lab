import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { deleteJournalEntry, listJournalEntries } from '../journalApi';
import { JournalDraftStore, newJournalDraft } from '../journalDrafts';
import JournalArchiveRow from '../JournalArchiveRow';
import useJournalArchive from '../useJournalArchive';

vi.mock('../journalApi', () => ({ listJournalEntries: vi.fn(), deleteJournalEntry: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

function setup(owner = 'a') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useJournalArchive(owner), { wrapper });
}

it('creates and deletes an offline draft without sending a server delete', async () => {
  vi.mocked(listJournalEntries).mockRejectedValue(new Error('Offline'));
  const { result } = setup();
  await waitFor(() => expect(result.current.query.isError).toBe(true));
  let id: string | null = null;
  act(() => {
    id = result.current.create();
  });
  expect(result.current.entries[0].id).toBe(id);
  await act(() => result.current.remove(result.current.entries[0]));
  expect(result.current.entries).toHaveLength(0);
  expect(deleteJournalEntry).not.toHaveBeenCalled();
});

it('merges local titles over server entries without losing the server delete version', async () => {
  const draft = { ...newJournalDraft(), title: 'Local title', expectedVersion: 1 };
  new JournalDraftStore('a').put(draft);
  new JournalDraftStore('b').put(newJournalDraft());
  vi.mocked(listJournalEntries).mockResolvedValue({
    data: [{ ...draft, title: 'Server title', version: 3, createdAt: 'now', updatedAt: 'now' }],
    nextCursor: null,
  });
  const { result } = setup();
  await waitFor(() => expect(result.current.entries[0]?.version).toBe(3));
  expect(result.current.entries).toHaveLength(1);
  expect(result.current.entries[0].title).toBe('Local title');
  vi.mocked(deleteJournalEntry).mockRejectedValue(new Error('Changed elsewhere'));
  await act(() => result.current.remove(result.current.entries[0]));
  expect(result.current.error).toContain('Could not delete');
  expect(new JournalDraftStore('a').get(draft.id)).not.toBeNull();
});

it('requires confirmation and preserves the row when deletion fails', async () => {
  const remove = vi.fn().mockResolvedValue(false);
  const onDeleted = vi.fn();
  const entry = { id: 'entry', title: 'Movie night', entryDate: '2026-11-12', version: 2 };
  render(
    <MemoryRouter>
      <JournalArchiveRow entry={entry} selected remove={remove} onDeleted={onDeleted} />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: /Movie night/ })).toHaveAttribute(
    'href',
    '/app/journal/entry'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete Movie night' }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByText('Delete this entry?')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Movie night' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete Movie night' }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith(entry));
  expect(onDeleted).not.toHaveBeenCalled();
});
