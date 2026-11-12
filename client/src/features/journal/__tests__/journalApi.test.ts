import { beforeEach, expect, it, vi } from 'vitest';
import { requestJson } from '../../../lib/apiClient';
import {
  deleteJournalEntry,
  getJournalAnalysis,
  listJournalEntries,
  saveJournalDraft,
  submitJournalEntry,
} from '../journalApi';
import { newJournalDraft } from '../journalDrafts';

vi.mock('../../../lib/apiClient', () => ({ requestJson: vi.fn() }));
beforeEach(() => {
  vi.mocked(requestJson).mockReset();
});

it('uses stable client IDs and sends only the versioned draft contract', async () => {
  const draft = { ...newJournalDraft(), body: ' 映画\n', expectedVersion: 4 };
  vi.mocked(requestJson).mockResolvedValue({ data: { id: draft.id, version: 5 } });
  expect(await saveJournalDraft(draft)).toEqual({ id: draft.id, version: 5 });
  expect(requestJson).toHaveBeenCalledWith(`/api/journal/entries/${draft.id}`, {
    method: 'PUT',
    signal: undefined,
    body: JSON.stringify({
      title: null,
      body: ' 映画\n',
      entryDate: draft.entryDate,
      expectedVersion: 4,
    }),
  });
});

it('preserves conflicts for the editor to resolve without an automatic overwrite', async () => {
  const conflict = new Error('version conflict');
  vi.mocked(requestJson).mockRejectedValue(conflict);
  await expect(saveJournalDraft(newJournalDraft())).rejects.toBe(conflict);
  expect(requestJson).toHaveBeenCalledTimes(1);
});

it('encodes archive cursors and supports aborting navigation requests', async () => {
  const { signal } = new AbortController();
  await listJournalEntries('a+b/=', signal);
  expect(requestJson).toHaveBeenCalledWith('/api/journal/entries?limit=30&cursor=a%2Bb%2F%3D', {
    signal,
  });
  await getJournalAnalysis('entry', signal);
  expect(requestJson).toHaveBeenLastCalledWith('/api/journal/entries/entry/analysis', { signal });
});

it('includes optimistic versions when submitting or deleting', async () => {
  vi.mocked(requestJson).mockResolvedValue({ data: { status: 'queued' } });
  expect(await submitJournalEntry('entry', 3)).toEqual({ status: 'queued' });
  expect(requestJson).toHaveBeenLastCalledWith('/api/journal/entries/entry/submit', {
    method: 'POST',
    body: '{"expectedVersion":3}',
  });
  await deleteJournalEntry('entry', 4);
  expect(requestJson).toHaveBeenLastCalledWith('/api/journal/entries/entry', {
    method: 'DELETE',
    body: '{"expectedVersion":4}',
  });
});
