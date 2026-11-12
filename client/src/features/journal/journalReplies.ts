import { requestJson } from '../../lib/apiClient';
import type { JournalAnalysis, JournalReply } from './types';

export interface JournalAnswerRequest {
  id: string;
  analysisId: string;
  answer: string;
  expectedRevision: number;
  replace: boolean;
}
const path = (entryId: string) => `/api/journal/entries/${encodeURIComponent(entryId)}`;
export const sendJournalAnswer = (entryId: string, input: JournalAnswerRequest) =>
  requestJson<{ data: JournalReply }>(`${path(entryId)}/replies/${encodeURIComponent(input.id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
export const getJournalReply = (entryId: string, id: string, signal: AbortSignal) =>
  requestJson<{ data: JournalReply }>(`${path(entryId)}/replies/${encodeURIComponent(id)}`, {
    signal,
  });
export const undoJournalAnswer = (entryId: string, analysis: JournalAnalysis) =>
  requestJson<{ data: JournalAnalysis }>(`${path(entryId)}/undo`, {
    method: 'POST',
    body: JSON.stringify({
      analysisId: analysis.id,
      expectedRevision: analysis.replyRevision ?? 0,
    }),
  });
