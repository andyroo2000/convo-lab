import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { JsonRequestError } from '../../../lib/apiClient';
import { getJournalEntry, saveJournalDraft, submitJournalEntry } from '../journalApi';
import { JournalDraftStore, newJournalDraft } from '../journalDrafts';
import useJournalEditor from '../useJournalEditor';
import type { JournalEntry } from '../types';

vi.mock('../journalApi', () => ({
  getJournalEntry: vi.fn(),
  saveJournalDraft: vi.fn(),
  submitJournalEntry: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

function setup() {
  const draft = { ...newJournalDraft(), body: '映画を見ました。' };
  const store = new JournalDraftStore('a');
  store.put(draft);
  const onSaved = vi.fn();
  const utils = renderHook(() => useJournalEditor({ ownerId: 'a', entryId: draft.id, onSaved }));
  const entry: JournalEntry = {
    ...draft,
    title: 'Movie night',
    version: 2,
    createdAt: 'now',
    updatedAt: 'now',
  };
  return { ...utils, store, draft, entry, onSaved };
}

it('opens device drafts without requiring a connection and persists each edit', () => {
  const { result, store, draft } = setup();
  expect(getJournalEntry).not.toHaveBeenCalled();
  act(() => result.current.change({ body: '今日は雨でした。' }));
  expect(store.get(draft.id)?.body).toBe('今日は雨でした。');
  expect(result.current.locallySaved).toBe(true);
});

it('saves before submitting and uses the returned server version', async () => {
  const { result, entry, store, draft } = setup();
  vi.mocked(saveJournalDraft).mockResolvedValue(entry);
  await act(() => result.current.save(true));
  expect(submitJournalEntry).toHaveBeenCalledWith(entry);
  expect(store.get(draft.id)).toBeNull();
  expect(result.current.draft?.expectedVersion).toBe(2);
  expect(result.current.submitted).toBe(1);
});

it('keeps an offline draft and does not submit when saving fails', async () => {
  const { result, store, draft } = setup();
  vi.mocked(saveJournalDraft).mockRejectedValue(new Error('Offline'));
  await act(() => result.current.save(true));
  expect(result.current.error).toBe('Offline');
  expect(store.get(draft.id)?.body).toBe(draft.body);
  expect(submitJournalEntry).not.toHaveBeenCalled();
});

it('preserves conflicting writing as a separate draft without overwriting the server', async () => {
  const { result, draft, store } = setup();
  vi.mocked(saveJournalDraft).mockRejectedValue(new JsonRequestError('Changed', 409, {}));
  await act(() => result.current.save());
  expect(result.current.conflict).toBe(true);
  const copy = result.current.copyAsNew();
  expect(copy?.id).not.toBe(draft.id);
  expect(copy?.expectedVersion).toBe(0);
  expect(store.list()).toHaveLength(2);
});

it('does not replace an edited title with a generated title', () => {
  const { result, entry } = setup();
  act(() => result.current.change({ title: 'My title' }));
  act(() => result.current.acceptGeneratedEntry(entry));
  expect(result.current.draft?.title).toBe('My title');
});

it('ignores a save completing after switching accounts', async () => {
  const draft = newJournalDraft();
  new JournalDraftStore('a').put(draft);
  const other = newJournalDraft();
  new JournalDraftStore('b').put(other);
  let complete: (entry: JournalEntry) => void = () => undefined;
  vi.mocked(saveJournalDraft).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      })
  );
  const onSaved = vi.fn();
  const { result, rerender } = renderHook(
    ({ ownerId, entryId }) => useJournalEditor({ ownerId, entryId, onSaved }),
    {
      initialProps: { ownerId: 'a', entryId: draft.id },
    }
  );
  let pending: Promise<unknown>;
  act(() => {
    pending = result.current.save(true);
  });
  rerender({ ownerId: 'b', entryId: other.id });
  await act(async () => {
    complete({ ...draft, version: 1, createdAt: 'now', updatedAt: 'now' });
    await pending;
  });
  expect(result.current.draft?.id).toBe(other.id);
  expect(submitJournalEntry).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(new JournalDraftStore('a').get(draft.id)).toBeNull();
});

it('loads saved entries when no local draft exists', async () => {
  const draft = newJournalDraft();
  vi.mocked(getJournalEntry).mockResolvedValue({
    ...draft,
    version: 3,
    createdAt: 'now',
    updatedAt: 'now',
  });
  const { result } = renderHook(() =>
    useJournalEditor({ ownerId: 'a', entryId: draft.id, onSaved: vi.fn() })
  );
  await waitFor(() => expect(result.current.draft?.expectedVersion).toBe(3));
});

it('reports a submit failure separately after the writing was saved', async () => {
  const { result, entry, store, draft } = setup();
  vi.mocked(saveJournalDraft).mockResolvedValue(entry);
  vi.mocked(submitJournalEntry).mockRejectedValue(new Error('Unavailable'));
  await act(() => result.current.save(true));
  expect(result.current.error).toBe(
    'Saved, but feedback could not be requested. Try Submit again.'
  );
  expect(result.current.conflict).toBe(false);
  expect(store.get(draft.id)).toBeNull();
});

it('reports unsuccessful submission so the edit form can remain open', async () => {
  const { result, entry } = setup();
  vi.mocked(saveJournalDraft).mockResolvedValue(entry);
  vi.mocked(submitJournalEntry).mockRejectedValue(new Error('Offline'));
  let saved: unknown;
  await act(async () => {
    saved = await result.current.save(true);
  });
  expect(saved).not.toBe(true);
  expect(result.current.error).toContain('feedback could not be requested');
});
