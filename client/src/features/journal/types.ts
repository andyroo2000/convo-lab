export interface JournalEntry {
  id: string;
  title: string | null;
  body: string;
  entryDate: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type JournalDraft = Pick<JournalEntry, 'id' | 'title' | 'body' | 'entryDate'> & {
  expectedVersion: number;
  editId: string;
};

export interface JournalSegment {
  text: string;
  reading: string;
  kind: 'plain' | 'correction' | 'optional' | 'keep';
  suggestion: string | null;
  suggestionReading: string | null;
  explanation: string | null;
  explanationReading: string | null;
}

export interface JournalFeedback {
  title: string;
  correctedText: string;
  correctedReading: string;
  question: string;
  questionReading: string;
  questionTranslation: string;
  segments: JournalSegment[];
}

export interface JournalReply {
  id: string;
  parentId: string | null;
  answer: string;
  status: JournalAnalysis['status'];
  result:
    | (JournalFeedback & { entryText: string; entryReading: string; previousReading: string })
    | null;
  error: string | null;
}

export interface JournalAnalysis {
  correctedDocument?: {
    text: string;
    reading: string;
    suggestions: { id: string; applied: boolean }[];
  } | null;
  replyRevision?: number;
  currentReply?: JournalReply | null;
  pendingReplyId?: string | null;
  id: string;
  sourceVersion: number;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  result: JournalFeedback | null;
  error: string | null;
  updatedAt: string;
}

export interface JournalPage {
  data: JournalEntry[];
  nextCursor: string | null;
}
