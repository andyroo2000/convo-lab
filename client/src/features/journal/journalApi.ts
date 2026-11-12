import { requestJson } from '../../lib/apiClient';
import type { JournalAnalysis, JournalDraft, JournalEntry, JournalPage } from './types';

const base = '/api/journal/entries';
const entryPath = (id: string) => `${base}/${encodeURIComponent(id)}`;

export function listJournalEntries(cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: '30' });
  if (cursor) query.set('cursor', cursor);
  return requestJson<JournalPage>(`${base}?${query}`, { signal });
}

export async function getJournalEntry(id: string, signal?: AbortSignal) {
  const response = await requestJson<{ data: JournalEntry }>(entryPath(id), { signal });
  return response.data;
}

export async function saveJournalDraft(draft: JournalDraft, signal?: AbortSignal) {
  const { title, body, entryDate, expectedVersion } = draft;
  const response = await requestJson<{ data: JournalEntry }>(entryPath(draft.id), {
    method: 'PUT',
    body: JSON.stringify({ title, body, entryDate, expectedVersion }),
    signal,
  });
  return response.data;
}

export function deleteJournalEntry(id: string, expectedVersion: number) {
  return requestJson<void>(entryPath(id), {
    method: 'DELETE',
    body: JSON.stringify({ expectedVersion }),
  });
}

export async function submitJournalEntry(id: string, expectedVersion: number) {
  const response = await requestJson<{ data: JournalAnalysis }>(`${entryPath(id)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  });
  return response.data;
}

export function getJournalAnalysis(id: string, signal?: AbortSignal) {
  return requestJson<{ data: JournalAnalysis | null; entry: JournalEntry }>(
    `${entryPath(id)}/analysis`,
    { signal }
  );
}
