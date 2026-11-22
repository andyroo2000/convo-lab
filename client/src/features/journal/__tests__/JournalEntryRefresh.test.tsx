import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JsonRequestError } from '../../../lib/apiClient';
import { getJournalAnalysis, getJournalEntry, saveJournalDraft } from '../journalApi';
import { JournalDraftStore, newJournalDraft } from '../journalDrafts';
import useJournalAnalysis from '../useJournalAnalysis';
import useJournalEditor from '../useJournalEditor';
import type { JournalAnalysis, JournalEntry } from '../types';

vi.mock('../journalApi', () => ({
  getJournalEntry: vi.fn(),
  getJournalAnalysis: vi.fn(),
  saveJournalDraft: vi.fn(),
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  clients.splice(0).forEach((client) => client.clear());
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function reopen() {
  const cached: JournalEntry = {
    ...newJournalDraft(),
    body: 'Cached writing',
    version: 2,
    createdAt: 'now',
    updatedAt: 'now',
  };
  const latest = { ...cached, body: 'New writing from iOS', version: 4 };
  const entryRead = deferred<JournalEntry>();
  const analysisRead = deferred<{ data: JournalAnalysis | null; entry: JournalEntry }>();
  vi.mocked(getJournalEntry).mockReturnValue(entryRead.promise);
  vi.mocked(getJournalAnalysis).mockReturnValue(analysisRead.promise);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 300_000 } },
  });
  clients.push(client);
  client.setQueryData(['journal-analysis', 'sync-test', cached.id, 0], {
    data: null,
    entry: cached,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    () => {
      const editor = useJournalEditor({
        ownerId: 'sync-test',
        entryId: cached.id,
        onSaved: vi.fn(),
      });
      useJournalAnalysis({
        ownerId: 'sync-test',
        entryId: cached.id,
        enabled: Boolean(editor.draft?.expectedVersion),
        submitted: 0,
        onEntry: editor.acceptGeneratedEntry,
      });
      return editor;
    },
    { wrapper }
  );
  return { ...view, cached, latest, entryRead, analysisRead };
}

it.each(['analysis', 'entry'])(
  'adopts remote text when the fresh %s response arrives first',
  async (first) => {
    const { result, cached, latest, entryRead, analysisRead } = reopen();
    await waitFor(() => expect(result.current.draft?.body).toBe(cached.body));
    await act(async () => {
      if (first === 'analysis') analysisRead.resolve({ data: null, entry: latest });
      else entryRead.resolve(latest);
    });
    await waitFor(() => expect(result.current.draft?.body).toBe(latest.body));
    await act(async () => {
      entryRead.resolve(latest);
      analysisRead.resolve({ data: null, entry: latest });
    });
    expect(result.current.draft?.expectedVersion).toBe(latest.version);
    expect(new JournalDraftStore('sync-test').get(cached.id)).toBeNull();
  }
);

it.each([false, true])(
  'preserves writing started while reads are pending (storage failure: %s)',
  async (storageFails) => {
    const { result, cached, latest, entryRead, analysisRead } = reopen();
    await waitFor(() => expect(result.current.draft?.body).toBe(cached.body));
    if (storageFails)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Full');
      });
    act(() => result.current.change({ body: 'My unsaved writing' }));
    await act(async () => {
      analysisRead.resolve({ data: null, entry: latest });
      entryRead.resolve(latest);
    });
    expect(result.current.draft?.body).toBe('My unsaved writing');
    expect(result.current.draft?.expectedVersion).toBe(cached.version);
  }
);

it('removes a cached body when the authoritative entry read confirms it is unavailable', async () => {
  const { result, cached, entryRead } = reopen();
  await waitFor(() => expect(result.current.draft?.body).toBe(cached.body));
  await act(async () => entryRead.reject(new JsonRequestError('Unavailable', 404, {})));
  expect(result.current.notFound).toBe(true);
  expect(result.current.draft).toBeNull();
  act(() => result.current.acceptGeneratedEntry({ ...cached, version: 3 }));
  expect(result.current.draft).toBeNull();
});

it('keeps writing started before an unavailable-entry response', async () => {
  const { result, cached, entryRead } = reopen();
  await waitFor(() => expect(result.current.draft?.body).toBe(cached.body));
  act(() => result.current.change({ body: 'Keep this local recovery' }));
  await act(async () => entryRead.reject(new JsonRequestError('Unavailable', 404, {})));
  expect(result.current.draft?.body).toBe('Keep this local recovery');
  expect(new JournalDraftStore('sync-test').get(cached.id)?.body).toBe('Keep this local recovery');
});

it('clears an unavailable response after a later save proves the entry is accessible', async () => {
  const { result, cached, latest, entryRead } = reopen();
  await waitFor(() => expect(result.current.draft?.body).toBe(cached.body));
  act(() => result.current.change({ body: 'Local writing' }));
  await act(async () => entryRead.reject(new JsonRequestError('Unavailable', 404, {})));
  vi.mocked(saveJournalDraft).mockResolvedValue({ ...latest, body: 'Local writing' });
  await act(async () => {
    expect(await result.current.save()).toBe(true);
  });
  expect(result.current.notFound).toBe(false);
  act(() =>
    result.current.acceptGeneratedEntry({ ...latest, version: 5, title: 'Generated title' })
  );
  expect(result.current.draft?.title).toBe('Generated title');
});
