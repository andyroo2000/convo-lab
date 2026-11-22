import { beforeEach, expect, it, vi } from 'vitest';
import { JsonRequestError } from '../../../lib/apiClient';
import JournalDraftOutbox from '../journalDraftOutbox';
import { JournalDraftStore, newJournalDraft } from '../journalDrafts';
import { removeJournalDeviceData } from '../journalDeviceCleanup';
import type { JournalDraft, JournalEntry } from '../types';

beforeEach(() => localStorage.clear());
const entry = (draft: JournalDraft): JournalEntry => ({
  ...draft,
  version: draft.expectedVersion + 1,
  createdAt: 'now',
  updatedAt: 'now',
});
function setup() {
  const draft = { ...newJournalDraft(), body: 'Private offline writing' };
  const store = new JournalDraftStore('owner');
  store.put(draft);
  const send = vi.fn(async (sent: JournalDraft) => entry(sent));
  const outbox = new JournalDraftOutbox('owner', localStorage, send);
  return { draft, store, send, outbox };
}

it('retries offline writing after reconstruction without opening its editor', async () => {
  const { draft, store, send, outbox } = setup();
  send.mockRejectedValueOnce(new Error('offline'));
  await outbox.synchronize(0);
  expect(store.get(draft.id)).toEqual(draft);
  const restarted = new JournalDraftOutbox('owner', localStorage, send);
  await restarted.synchronize(0);
  expect(store.get(draft.id)).toBeNull();
  expect(send).toHaveBeenLastCalledWith(draft, expect.any(AbortSignal), 'owner');
  expect(restarted.receipts.get(draft.id)?.entry.body).toBe(draft.body);
});

it('retries the exact interrupted payload before newer writing', async () => {
  const { draft, store, send, outbox } = setup();
  send.mockRejectedValueOnce(new Error('response lost'));
  await outbox.synchronize(0);
  const newer = { ...draft, body: 'Newer typing', editId: 'second-edit' };
  store.put(newer);
  const restarted = new JournalDraftOutbox('owner', localStorage, send);
  await restarted.synchronize(0);
  expect(send.mock.calls[1]?.[0]).toEqual(draft);
  expect(store.get(draft.id)).toEqual({ ...newer, expectedVersion: 1 });
  await restarted.synchronize(0);
  expect(send.mock.calls[2]?.[0]).toEqual({ ...newer, expectedVersion: 1 });
  expect(store.get(draft.id)).toBeNull();
});

it.each([404, 409])('pauses a rejected draft across restart (%s)', async (status) => {
  const { draft, store, send, outbox } = setup();
  send.mockRejectedValueOnce(new JsonRequestError('Rejected', status, {}));
  await outbox.synchronize(0);
  const restarted = new JournalDraftOutbox('owner', localStorage, send);
  await restarted.synchronize(0);
  expect(send).toHaveBeenCalledTimes(1);
  expect(store.get(draft.id)?.body).toBe(draft.body);
  expect(restarted.blocked.get(draft.id)).toBe(status);
});

it('keeps edits made during a request and joins simultaneous save attempts', async () => {
  const { draft, store, send, outbox } = setup();
  let resolve!: (value: JournalEntry) => void;
  send.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const first = outbox.save(draft);
  const second = outbox.save(draft);
  const newer = { ...draft, body: 'Typed while sending', editId: 'newer' };
  store.put(newer);
  resolve(entry(draft));
  await Promise.all([first, second]);
  expect(send).toHaveBeenCalledTimes(1);
  expect(store.get(draft.id)).toEqual({ ...newer, expectedVersion: 1 });
});

it('waits for an in-flight creation before deletion and uses its acknowledged version', async () => {
  const { draft, send, outbox } = setup();
  let resolve!: (value: JournalEntry) => void;
  send.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const saving = outbox.save(draft);
  const remove = vi.fn(async (version: number) => {
    expect(version).toBe(1);
    removeJournalDeviceData('owner', draft.id);
  });
  const deleting = outbox.mutate(draft.id, remove);
  expect(remove).not.toHaveBeenCalled();
  resolve(entry(draft));
  await Promise.all([saving, deleting]);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(outbox.drafts.get(draft.id)).toBeNull();
});

it('stopping an account prevents queued requests and keeps its drafts isolated', async () => {
  const { draft, store, send, outbox } = setup();
  outbox.stop();
  await outbox.synchronize(0);
  await expect(outbox.save(draft)).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
  expect(store.get(draft.id)).not.toBeNull();
  await new JournalDraftOutbox('other', localStorage, send).synchronize(0);
  expect(send).not.toHaveBeenCalled();
});

it('never uploads blank drafts or conversation answers automatically', async () => {
  const { draft, store, send, outbox } = setup();
  store.put({ ...draft, body: '' });
  store.put({ ...newJournalDraft(), body: 'Answer', rootEntryId: draft.id });
  await outbox.synchronize(0);
  expect(send).not.toHaveBeenCalled();
});

it('backs off until reconnect and removes pending payloads during account cleanup', async () => {
  const { draft, store, send, outbox } = setup();
  send.mockRejectedValueOnce(new Error('offline'));
  await outbox.synchronize(0);
  await outbox.synchronize(1);
  expect(send).toHaveBeenCalledTimes(1);
  expect(outbox.checkpoints.get(draft.id).pending).toEqual(draft);
  outbox.reconnect();
  await outbox.synchronize(1);
  expect(store.get(draft.id)).toBeNull();
  store.put(draft);
  outbox.checkpoints.put(draft.id, { pending: draft });
  removeJournalDeviceData('owner');
  expect(outbox.checkpoints.get(draft.id)).toEqual({});
  expect(store.list()).toEqual([]);
});

it('preserves malformed pending state instead of sending a replacement', async () => {
  const { draft, send, outbox } = setup();
  localStorage.setItem(`convolab:journal-sync:v1:owner:${draft.id}`, 'damaged');
  await outbox.synchronize(0);
  expect(send).not.toHaveBeenCalled();
  expect(outbox.blocked.get(draft.id)).toBe(503);
  expect(localStorage.getItem(`convolab:journal-sync:v1:owner:${draft.id}`)).toBe('damaged');
});

it('retries a session rejection safely after the original account returns', async () => {
  const { draft, store, send, outbox } = setup();
  send.mockRejectedValueOnce(new JsonRequestError('Session changed', 403, {}));
  await outbox.synchronize(0);
  expect(outbox.blocked.get(draft.id)).toBe(403);
  expect(store.get(draft.id)).toEqual(draft);
  outbox.reconnect();
  await outbox.synchronize(0);
  expect(send).toHaveBeenLastCalledWith(draft, expect.any(AbortSignal), 'owner');
  expect(store.get(draft.id)).toBeNull();
  expect(outbox.blocked.has(draft.id)).toBe(false);
});

it('retries corrected writing after validation fails', async () => {
  const { draft, store, send, outbox } = setup();
  send.mockRejectedValueOnce(new JsonRequestError('Invalid', 422, {}));
  await outbox.synchronize(0);
  const corrected = { ...draft, body: 'Corrected writing', editId: 'corrected' };
  store.put(corrected);
  outbox.edited(corrected);
  await outbox.synchronize(0);
  expect(send.mock.calls[1]?.[0]).toEqual(corrected);
  expect(store.get(draft.id)).toBeNull();
});

it('stops explicit Save safely if another editor continuously changes the draft', async () => {
  const { draft, store, send, outbox } = setup();
  send.mockImplementation(async (sent) => {
    store.put({ ...sent, body: `${sent.body} more`, editId: `${sent.editId}-next` });
    return entry(sent);
  });
  await expect(outbox.saveLatest(draft)).rejects.toThrow('Writing is still changing');
  expect(send).toHaveBeenCalledTimes(3);
  expect(store.get(draft.id)?.body).toContain('more more more');
});

it('keeps local saving available when a checkpoint is damaged', () => {
  const { draft, store, outbox } = setup();
  localStorage.setItem(`convolab:journal-sync:v1:owner:${draft.id}`, 'damaged');
  const newer = { ...draft, body: 'Writing is still safe', editId: 'safe' };
  store.put(newer);
  expect(() => outbox.edited(newer)).not.toThrow();
  expect(store.get(draft.id)).toEqual(newer);
  expect(outbox.blocked.get(draft.id)).toBe(503);
  expect(localStorage.getItem(`convolab:journal-sync:v1:owner:${draft.id}`)).toBe('damaged');
});

it('releases a hung save after its deadline without losing the pending payload', async () => {
  vi.useFakeTimers();
  try {
    const { draft, store, send, outbox } = setup();
    send.mockImplementationOnce(() => new Promise(() => {}));
    const saving = outbox.synchronize(0);
    await vi.advanceTimersByTimeAsync(15001);
    await saving;
    expect(outbox.isSyncing(draft.id)).toBe(false);
    expect(outbox.checkpoints.get(draft.id).pending).toEqual(draft);
    expect(store.get(draft.id)).toEqual(draft);
    outbox.reconnect();
    await outbox.synchronize(15001);
    expect(store.get(draft.id)).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
