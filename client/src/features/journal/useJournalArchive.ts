import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { deleteJournalEntry, listJournalEntries } from './journalApi';
import { JournalDraftStore } from './journalDrafts';
import renameJournalEntry from './journalRename';
import { removeJournalDeviceData } from './journalDeviceCleanup';
import type { JournalDraft, JournalEntry } from './types';

export default function useJournalArchive(ownerId: string) {
  const client = useQueryClient();
  const store = useMemo(() => new JournalDraftStore(ownerId), [ownerId]);
  const [drafts, setDrafts] = useState<JournalDraft[]>([]);
  const [error, setError] = useState('');
  const [draftReadError, setDraftReadError] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['journal-archive', ownerId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => listJournalEntries(pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    networkMode: 'offlineFirst',
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: 'always',
  });
  const refresh = useCallback(() => {
    try {
      setDrafts(store.list().filter((draft) => !draft.rootEntryId));
      setDraftReadError('');
    } catch {
      setDraftReadError('Device drafts could not be read. Keep open entries on screen.');
    }
  }, [store]);
  useEffect(() => {
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const entries = useMemo(() => {
    const items = new Map<
      string,
      Pick<JournalEntry, 'id' | 'title' | 'entryDate' | 'version' | 'body'>
    >();
    query.data?.pages.forEach((page) => page.data.forEach((entry) => items.set(entry.id, entry)));
    drafts.forEach((draft) =>
      items.set(draft.id, {
        ...draft,
        version: items.get(draft.id)?.version ?? draft.expectedVersion,
      })
    );
    return [...items.values()].sort(
      (a, b) => b.entryDate.localeCompare(a.entryDate) || b.id.localeCompare(a.id)
    );
  }, [drafts, query.data]);

  const saved = useCallback(() => {
    refresh();
    client.invalidateQueries({ queryKey: ['journal-archive', ownerId] }).catch(() => undefined);
  }, [client, ownerId, refresh]);

  const { refetch } = query;
  const refreshContents = useCallback(() => {
    refresh();
    refetch({ cancelRefetch: false }).catch(() => undefined);
  }, [refresh, refetch]);

  async function remove(entry: Pick<JournalEntry, 'id' | 'version'>) {
    try {
      if (entry.version > 0) await deleteJournalEntry(entry);
    } catch {
      setError('Could not delete this entry online. Refresh and try again.');
      return false;
    }
    try {
      const local = store.get(entry.id);
      if (local) store.discard(local);
      removeJournalDeviceData(ownerId, entry.id);
      saved();
      setError('');
      return true;
    } catch {
      setError(
        'The device copy could not be removed. Any online deletion succeeded; retry to clear this copy.'
      );
      return false;
    }
  }

  async function rename(entry: Pick<JournalEntry, 'id' | 'version'>, title: string) {
    try {
      await renameJournalEntry(store, entry, title);
    } finally {
      saved();
    }
  }

  function snapshot(entry: (typeof entries)[number]) {
    const local = store.get(entry.id);
    return local ? { ...entry, title: local.title, body: local.body } : entry;
  }

  return {
    query,
    entries,
    drafts,
    error: error || draftReadError,
    saved,
    remove,
    rename,
    snapshot,
    refresh: refreshContents,
  };
}
