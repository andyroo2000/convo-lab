import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getJournalEntry, saveJournalDraft } from '../journalApi';
import { draftFromEntry, JournalDraftStore, newJournalDraft } from '../journalDrafts';
import renameJournalEntry from '../journalRename';
import { JsonRequestError } from '../../../lib/apiClient';
import type { JournalEntry } from '../types';

vi.mock('../journalApi', () => ({ getJournalEntry: vi.fn(), saveJournalDraft: vi.fn() }));
const store = new JournalDraftStore('rename-tests');
afterEach(() => vi.restoreAllMocks());
function serverEntry(): JournalEntry {
  return {
    ...newJournalDraft(),
    title: 'Original',
    body: 'Saved writing',
    version: 3,
    createdAt: 'now',
    updatedAt: 'now',
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

it('renames an offline draft locally and preserves its writing', async () => {
  const draft = { ...newJournalDraft(), body: 'Unsaved writing' };
  store.put(draft);
  await renameJournalEntry(store, { id: draft.id, version: 0 }, '  New title  ');
  expect(store.get(draft.id)).toMatchObject({
    title: 'New title',
    body: draft.body,
    expectedVersion: 0,
  });
  expect(saveJournalDraft).not.toHaveBeenCalled();
  expect(getJournalEntry).not.toHaveBeenCalled();
});

it('saves only the title online and preserves newer local writing', async () => {
  const server = serverEntry();
  const local = { ...draftFromEntry(server), body: 'Private unsaved writing' };
  store.put(local);
  vi.mocked(getJournalEntry).mockResolvedValue(server);
  vi.mocked(saveJournalDraft).mockImplementation(async (sent) => {
    store.put({ ...local, body: 'Typed during rename', editId: 'new-edit' });
    return { ...server, title: sent.title, version: 4 };
  });
  await renameJournalEntry(store, server, 'New title');
  expect(saveJournalDraft).toHaveBeenCalledWith(
    expect.objectContaining({ body: server.body, title: 'New title', expectedVersion: 3 })
  );
  expect(store.get(server.id)).toMatchObject({
    title: 'New title',
    body: 'Typed during rename',
    expectedVersion: 4,
  });
});

it('retains a newer local title and keeps stale body conflict detection', async () => {
  const server = serverEntry();
  store.put({ ...draftFromEntry(server), expectedVersion: 1 });
  vi.mocked(getJournalEntry).mockResolvedValue(server);
  vi.mocked(saveJournalDraft).mockImplementation(async () => {
    store.put({ ...store.get(server.id)!, title: 'Changed in another tab', editId: 'new-edit' });
    return { ...server, title: 'New title', version: 4 };
  });
  await renameJournalEntry(store, server, 'New title');
  expect(store.get(server.id)).toMatchObject({
    title: 'Changed in another tab',
    expectedVersion: 1,
  });
});

it('rejects a changed saved entry without changing local writing', async () => {
  const server = serverEntry();
  const local = draftFromEntry(server);
  store.put(local);
  vi.mocked(getJournalEntry).mockResolvedValue({ ...server, version: 4 });
  await expect(renameJournalEntry(store, server, 'New title')).rejects.toThrow('changed elsewhere');
  expect(saveJournalDraft).not.toHaveBeenCalled();
  expect(store.get(server.id)).toEqual(local);
});

it('keeps body conflict protection when a newer server title already matches', async () => {
  const server = serverEntry();
  store.put(draftFromEntry(server));
  vi.mocked(getJournalEntry).mockResolvedValue({
    ...server,
    title: 'New title',
    body: 'Changed on another device',
    version: 4,
  });
  await renameJournalEntry(store, server, 'New title');
  expect(saveJournalDraft).not.toHaveBeenCalled();
  expect(store.get(server.id)).toMatchObject({
    title: 'New title',
    expectedVersion: 3,
    body: server.body,
  });
});

it('preserves the local draft after a failed online save and rejects blank titles', async () => {
  const server = serverEntry();
  const local = draftFromEntry(server);
  store.put(local);
  vi.mocked(getJournalEntry).mockResolvedValue(server);
  vi.mocked(saveJournalDraft).mockRejectedValue(new Error('Offline'));
  await expect(renameJournalEntry(store, server, 'New title')).rejects.toThrow('Offline');
  await expect(renameJournalEntry(store, server, '   ')).rejects.toThrow('Enter a title');
  expect(store.get(server.id)).toEqual(local);
});

it('retains writing when the server rejects a race between GET and PUT', async () => {
  const server = serverEntry();
  const local = draftFromEntry(server);
  store.put(local);
  vi.mocked(getJournalEntry).mockResolvedValue(server);
  const conflict = new JsonRequestError('Changed on another device', 409, {});
  vi.mocked(saveJournalDraft).mockRejectedValue(conflict);
  await expect(renameJournalEntry(store, server, 'New title')).rejects.toBe(conflict);
  expect(saveJournalDraft).toHaveBeenCalledWith(
    expect.objectContaining({ expectedVersion: server.version })
  );
  expect(store.get(server.id)).toEqual(local);
});

it('reports a partial save and retries without accepting a newer body version', async () => {
  const server = serverEntry();
  const local = draftFromEntry(server);
  store.put(local);
  const saved = { ...server, title: 'New title', version: 4 };
  vi.mocked(getJournalEntry).mockResolvedValueOnce(server).mockResolvedValueOnce(saved);
  vi.mocked(saveJournalDraft).mockResolvedValue(saved);
  const put = vi.spyOn(store, 'put').mockImplementationOnce(() => {
    throw new Error('Storage full');
  });
  await expect(renameJournalEntry(store, server, 'New title')).rejects.toThrow('saved online');
  expect(store.get(server.id)).toEqual(local);
  put.mockRestore();
  await renameJournalEntry(store, server, 'New title');
  expect(saveJournalDraft).toHaveBeenCalledTimes(1);
  expect(store.get(server.id)).toMatchObject({ title: 'New title', expectedVersion: 3 });
});
