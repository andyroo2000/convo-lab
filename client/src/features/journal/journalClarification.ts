import { requestJson } from '../../lib/apiClient';
import type { JournalEntry } from './types';

export interface ClarificationQuestion {
  id: string;
  prompt: string;
  choices: string[];
}
export interface JournalClarification {
  id: string;
  sourceVersion: number;
  revision: number;
  status: 'queued' | 'processing' | 'waiting' | 'resolved' | 'failed';
  question: ClarificationQuestion | null;
  error: string | null;
  updatedAt: string;
}
export type ClarificationEntry = Pick<JournalEntry, 'id' | 'version'>;
const path = (id: string) => `/api/journal/entries/${encodeURIComponent(id)}/clarification`;
export async function startClarification(entry: ClarificationEntry, signal: AbortSignal) {
  const response = await requestJson<{ data: JournalClarification }>(path(entry.id), {
    method: 'POST',
    body: JSON.stringify({ expectedVersion: entry.version }),
    signal,
  });
  return response.data;
}
export async function readClarification(entry: ClarificationEntry, signal: AbortSignal) {
  const response = await requestJson<{ data: JournalClarification | null }>(path(entry.id), {
    signal,
  });
  if (!response.data) throw new Error('The draft changed. Go back and submit it again.');
  return response.data;
}
export async function answerClarification(
  entry: ClarificationEntry,
  state: JournalClarification,
  answer: string,
  signal: AbortSignal
) {
  const response = await requestJson<{ data: JournalClarification }>(
    `${path(entry.id)}/${encodeURIComponent(state.id)}/answer`,
    {
      method: 'POST',
      body: JSON.stringify({
        expectedVersion: entry.version,
        questionId: state.question?.id,
        answer,
      }),
      signal,
    }
  );
  return response.data;
}
export function clarificationPending(state: JournalClarification) {
  return state.status === 'queued' || state.status === 'processing';
}
