import { act, renderHook, waitFor } from '@testing-library/react';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JsonRequestError } from '../../../lib/apiClient';
import { deleteJournalEntry, listJournalEntries, saveJournalDraft } from '../journalApi';
import { draftFromEntry, JournalDraftStore, newJournalDraft } from '../journalDrafts';
import useJournalArchive from '../useJournalArchive';
import useJournalEditor from '../useJournalEditor';
import type { JournalEntry, JournalPage } from '../types';

vi.mock('../journalApi', () => ({
  listJournalEntries: vi.fn(),
  deleteJournalEntry: vi.fn(),
  saveJournalDraft: vi.fn(),
}));

const clients: QueryClient[] = [];
const entry = (body = '映画を見た。', version = 1): JournalEntry => ({
  ...newJournalDraft(),
  body,
  version,
  createdAt: 'now',
  updatedAt: 'now',
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

function archive() {
  // Match the application's cache defaults; Journal must override them.
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 300_000,
        refetchOnWindowFocus: false,
      },
    },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useJournalArchive('sync-test'), { wrapper });
}

it.each([0, 3])(
  'retries an offline draft at version %s after reopening without changing its identity',
  async (version) => {
    const draft = {
      ...newJournalDraft(),
      expectedVersion: version,
      body: '接続がなくても書ける。',
    };
    const store = new JournalDraftStore('sync-test');
    store.put(draft);
    const saved = { ...entry(), ...draft, version: version + 1 };
    vi.mocked(saveJournalDraft)
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockResolvedValueOnce(saved);
    const open = () =>
      renderHook(() =>
        useJournalEditor({ ownerId: 'sync-test', entryId: draft.id, onSaved: vi.fn() })
      );
    const { result: first, unmount } = open();
    await act(async () => {
      expect(await first.current.save()).toBe(false);
    });
    unmount();
    const { result: reopened } = open();
    expect(reopened.current.draft).toEqual(draft);
    await act(async () => {
      expect(await reopened.current.save()).toBe(true);
    });
    expect(saveJournalDraft).toHaveBeenNthCalledWith(1, draft);
    expect(saveJournalDraft).toHaveBeenNthCalledWith(2, draft);
    expect(store.get(draft.id)).toBeNull();
    expect(reopened.current.draft?.expectedVersion).toBe(version + 1);
  }
);

it('reopening Contents reads remote creates, edits and deletions even inside the global cache lifetime', async () => {
  let remote = [entry()];
  vi.mocked(listJournalEntries).mockImplementation(async () => ({
    data: remote,
    nextCursor: null,
  }));
  const { result } = archive();
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  const created = entry('別の端末で書いた。');
  remote = [{ ...remote[0], body: '編集した。', title: 'Edited elsewhere', version: 2 }, created];
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.entries).toHaveLength(2));
  expect(result.current.entries.find((row) => row.id !== created.id)?.body).toBe('編集した。');
  remote = [created];
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.entries.map((row) => row.id)).toEqual([created.id]));
});

it.each(['focus', 'reconnect'])(
  'refreshes on %s while retaining an offline edit of a remotely deleted entry',
  async (trigger) => {
    const original = entry();
    let remote = [original];
    vi.mocked(listJournalEntries).mockImplementation(async () => ({
      data: remote,
      nextCursor: null,
    }));
    const { result } = archive();
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    const local = { ...draftFromEntry(original), body: 'まだ保存していない文章。' };
    const store = new JournalDraftStore('sync-test');
    store.put(local);
    remote = [entry('新しく作成した。')];
    act(() => {
      if (trigger === 'focus') {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      } else {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      }
      window.dispatchEvent(new Event('storage'));
    });
    await waitFor(() => expect(result.current.query.data?.pages[0].data).toEqual(remote));
    expect(result.current.entries.find((row) => row.id === original.id)?.body).toBe(local.body);
    expect(store.get(original.id)).toEqual(local);
  }
);

it('retains a failed offline deletion and clears it only after the retry succeeds', async () => {
  const original = entry();
  let remote = [original];
  vi.mocked(listJournalEntries).mockImplementation(async () => ({
    data: remote,
    nextCursor: null,
  }));
  vi.mocked(deleteJournalEntry)
    .mockRejectedValueOnce(new TypeError('Offline'))
    .mockImplementationOnce(async () => {
      remote = [];
    });
  const { result } = archive();
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  await act(async () => {
    expect(await result.current.remove(original)).toBe(false);
  });
  expect(result.current.entries[0].id).toBe(original.id);
  await act(async () => {
    expect(await result.current.remove(original)).toBe(true);
  });
  await waitFor(() => expect(result.current.entries).toHaveLength(0));
});

it('shares an in-flight Contents refresh instead of cancelling it and sending another request', async () => {
  let release!: (page: JournalPage) => void;
  const pending = new Promise<JournalPage>((resolve) => {
    release = resolve;
  });
  vi.mocked(listJournalEntries)
    .mockResolvedValueOnce({ data: [entry()], nextCursor: null })
    .mockReturnValue(pending);
  const { result } = archive();
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  expect(listJournalEntries).toHaveBeenCalledTimes(1);
  act(() => {
    result.current.refresh();
    result.current.refresh();
  });
  expect(listJournalEntries).toHaveBeenCalledTimes(2);
  await act(async () => {
    release({ data: [], nextCursor: null });
  });
  await waitFor(() => expect(result.current.entries).toHaveLength(0));
  expect(listJournalEntries).toHaveBeenCalledTimes(2);
});

it.each([404, 409])(
  'keeps offline writing after a %s rejection and offers a new identity for recovery',
  async (status) => {
    const draft = { ...draftFromEntry(entry()), body: 'オフラインで書き直した。' };
    const store = new JournalDraftStore('sync-test');
    store.put(draft);
    vi.mocked(saveJournalDraft).mockRejectedValue(new JsonRequestError('Rejected', status, {}));
    const { result } = renderHook(() =>
      useJournalEditor({ ownerId: 'sync-test', entryId: draft.id, onSaved: vi.fn() })
    );
    await act(async () => {
      expect(await result.current.save()).toBe(false);
    });
    expect(result.current.conflict).toBe(true);
    expect(result.current.error).toContain(
      status === 404 ? 'unavailable online' : 'changed online'
    );
    expect(store.get(draft.id)).toEqual(draft);
    const copy = result.current.copyAsNew();
    expect(copy?.id).not.toBe(draft.id);
    expect(copy?.expectedVersion).toBe(0);
    expect(copy?.body).toBe(draft.body);
    expect(store.list()).toHaveLength(2);
  }
);
