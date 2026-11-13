import { requestJson } from '../../lib/apiClient';
import type { JournalEntry, JournalAnalysis } from './types';
import type { TutorQuestion } from './journalTutor';

export interface JournalConversationNode {
  entry: JournalEntry;
  analysis: JournalAnalysis | null;
  question: TutorQuestion | null;
  parentEntryId: string | null;
}
export interface ConversationAnswer {
  id: string;
  questionId: string;
  body: string;
}
export const getJournalConversation = (rootId: string, signal?: AbortSignal) =>
  requestJson<{ data: JournalConversationNode[] }>(
    `/api/journal/entries/${encodeURIComponent(rootId)}/conversation`,
    { signal }
  );
export const createConversationAnswer = (parentId: string, input: ConversationAnswer) =>
  requestJson<{ data: JournalEntry }>(
    `/api/journal/entries/${encodeURIComponent(parentId)}/conversation`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
export const retrySavedQuestion = (entryId: string, questionId: string) =>
  requestJson<{ data: TutorQuestion }>(
    `/api/journal/entries/${encodeURIComponent(entryId)}/questions/${encodeURIComponent(questionId)}/retry`,
    { method: 'POST' }
  );
