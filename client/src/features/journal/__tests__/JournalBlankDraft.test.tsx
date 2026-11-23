import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { getJournalEntry } from '../journalApi';
import { JournalDraftStore, newJournalDraft } from '../journalDrafts';
import useJournalEditor from '../useJournalEditor';
import JournalDraftActions from '../JournalDraftActions';
import todayJournalEntry from '../journalLandingSelection';

vi.mock('../journalApi', () => ({ getJournalEntry: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

it('opens an unsaved notebook without a request or storage write and preserves Japanese input under one id', () => {
  const draft = newJournalDraft();
  const store = new JournalDraftStore('owner');
  const { result } = renderHook(() =>
    useJournalEditor({ ownerId: 'owner', entryId: draft.id, initialDraft: draft, onSaved: vi.fn() })
  );
  expect(result.current.draft?.body).toBe('');
  expect(store.list()).toEqual([]);
  expect(getJournalEntry).not.toHaveBeenCalled();
  act(() => result.current.change({ body: ' ' }));
  expect(store.list()).toEqual([]);
  act(() => result.current.change({ body: 'きょう' }));
  act(() => result.current.change({ body: '今日、映画を見た。' }));
  expect(store.list()).toHaveLength(1);
  expect(store.get(draft.id)?.body).toBe('今日、映画を見た。');
  act(() => result.current.change({ body: '' }));
  expect(store.get(draft.id)?.body).toBe('');
});

it('chooses the newest nonempty entry dated today and never opens yesterday or tomorrow', () => {
  const entry = { ...newJournalDraft(new Date(2026, 10, 16)), body: 'Writing', version: 1 };
  const older = { ...entry, id: 'a' };
  const newer = { ...entry, id: 'b' };
  const yesterday = { ...entry, id: 'c', entryDate: '2026-11-15' };
  const tomorrow = { ...entry, id: 'd', entryDate: '2026-11-17' };
  expect(todayJournalEntry([older, tomorrow, newer, yesterday], '2026-11-16')?.id).toBe('b');
  expect(todayJournalEntry([newer], '2026-11-16', [])).toBeUndefined();
  expect(todayJournalEntry([{ ...newer, version: 0 }], '2026-11-16', [])?.id).toBe('b');
  expect(
    todayJournalEntry([yesterday, tomorrow, { ...newer, body: '' }], '2026-11-16')
  ).toBeUndefined();
});

it('closes an unwritten notebook immediately without a keep/delete modal', () => {
  const draft = newJournalDraft();
  const { result } = renderHook(() =>
    useJournalEditor({ ownerId: 'owner', entryId: draft.id, initialDraft: draft, onSaved: vi.fn() })
  );
  const close = vi.fn();
  render(
    <JournalDraftActions
      editor={result.current}
      ownerId="owner"
      processing={false}
      canSubmit={false}
      onClose={close}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(close).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(new JournalDraftStore('owner').list()).toEqual([]);
});

it('dates a new draft when writing begins, even if the blank notebook was opened yesterday', () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date(2026, 10, 16, 23, 59));
    const draft = newJournalDraft();
    const { result } = renderHook(() =>
      useJournalEditor({
        ownerId: 'owner',
        entryId: draft.id,
        initialDraft: draft,
        onSaved: vi.fn(),
      })
    );
    vi.setSystemTime(new Date(2026, 10, 17, 0, 1));
    act(() => result.current.change({ body: '新しい日' }));
    expect(new JournalDraftStore('owner').get(draft.id)?.entryDate).toBe('2026-11-17');
  } finally {
    vi.useRealTimers();
  }
});

it('leaves a successfully synced notebook quiet and still identifies unsynced edits', async () => {
  const draft = { ...newJournalDraft(), body: '今日の練習' };
  const entry = { ...draft, version: 1, createdAt: 'now', updatedAt: 'now' };
  const { result } = renderHook(() =>
    useJournalEditor({ ownerId: 'owner', entryId: entry.id, initialEntry: entry, onSaved: vi.fn() })
  );
  await waitFor(() => expect(result.current.draft?.body).toBe(draft.body));
  expect(result.current.syncStatus).toBeNull();
  expect(result.current.canLoadFeedback).toBe(true);
  act(() => result.current.change({ body: '今日の練習です。' }));
  expect(result.current.syncStatus).toBe('Saved on this device');
  expect(result.current.canLoadFeedback).toBe(false);
});
