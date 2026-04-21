// Shared type definitions used across client and server

export type LanguageCode = 'ja' | 'en';

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'native';

export type ToneStyle = 'casual' | 'polite' | 'formal';

export type EpisodeStatus = 'draft' | 'generating' | 'ready' | 'error';

export type JobState = 'waiting' | 'active' | 'completed' | 'failed';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export type StudyCardType = 'recognition' | 'production' | 'cloze';

export type StudyQueueState = 'new' | 'learning' | 'review' | 'relearning' | 'suspended' | 'buried';

export type StudyAudioSource = 'imported' | 'generated' | 'missing';

export interface StudyMediaRef {
  id?: string;
  filename: string;
  url?: string | null;
  mediaKind: 'audio' | 'image' | 'other';
  source: StudyAudioSource | 'imported_image' | 'imported_other';
}

export interface StudyPromptPayload {
  cueText?: string | null;
  cueHtml?: string | null;
  cueReading?: string | null;
  cueMeaning?: string | null;
  cueAudio?: StudyMediaRef | null;
  cueImage?: StudyMediaRef | null;
  clozeText?: string | null;
  clozeDisplayText?: string | null;
  clozeAnswerText?: string | null;
  clozeHint?: string | null;
  clozeResolvedHint?: string | null;
}

export interface StudyAnswerPayload {
  expression?: string | null;
  expressionReading?: string | null;
  meaning?: string | null;
  notes?: string | null;
  sentenceJp?: string | null;
  sentenceJpKana?: string | null;
  sentenceEn?: string | null;
  restoredText?: string | null;
  restoredTextReading?: string | null;
  answerAudio?: StudyMediaRef | null;
  answerImage?: StudyMediaRef | null;
}

export interface StudySourceSnapshot {
  noteId?: string | null;
  noteGuid?: string | null;
  cardId?: string | null;
  deckId?: string | null;
  deckName?: string | null;
  notetypeId?: string | null;
  notetypeName?: string | null;
  templateOrd?: number | null;
  templateName?: string | null;
  queue?: number | null;
  type?: number | null;
  due?: number | null;
  ivl?: number | null;
  factor?: number | null;
  reps?: number | null;
  lapses?: number | null;
  left?: number | null;
  odue?: number | null;
  odid?: string | null;
}

export interface StudyFsrsState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string | null;
}

export interface StudyCardState {
  dueAt: string | null;
  queueState: StudyQueueState;
  scheduler: StudyFsrsState | null;
  source: StudySourceSnapshot;
  rawFsrs?: Record<string, unknown> | null;
}

export interface StudyCardSummary {
  id: string;
  noteId: string;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  state: StudyCardState;
  answerAudioSource: StudyAudioSource;
  createdAt: string;
  updatedAt: string;
}

export interface StudyOverview {
  dueCount: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  suspendedCount: number;
  totalCards: number;
  latestImport?: StudyImportResult | null;
  nextDueAt?: string | null;
}

export interface StudyReviewEvent {
  id: string;
  cardId: string;
  source: 'anki_import' | 'convolab';
  reviewedAt: string;
  rating: number;
  durationMs?: number | null;
  sourceReviewId?: string | null;
  stateBefore?: StudyFsrsState | null;
  stateAfter?: StudyFsrsState | null;
  rawPayload?: Record<string, unknown> | null;
}

export interface StudyReviewResult {
  reviewLogId: string;
  card: StudyCardSummary;
  overview: StudyOverview;
}

export interface StudyUndoReviewResult {
  reviewLogId: string;
  card: StudyCardSummary;
  overview: StudyOverview;
}

export type StudyCardActionName = 'suspend' | 'unsuspend' | 'forget' | 'set_due';

export type StudyCardSetDueMode = 'now' | 'tomorrow' | 'custom_date';

export interface StudyCardActionResult {
  card: StudyCardSummary;
  overview: StudyOverview;
}

export interface StudyBrowserRow {
  noteId: string;
  displayText: string;
  noteTypeName: string | null;
  cardCount: number;
  reviewCount: number;
  queueSummary: Partial<Record<StudyQueueState, number>>;
  updatedAt: string;
}

export interface StudyBrowserFilterOptions {
  noteTypes: string[];
  cardTypes: StudyCardType[];
  queueStates: StudyQueueState[];
}

export interface StudyBrowserListResponse {
  rows: StudyBrowserRow[];
  total: number;
  page: number;
  pageSize: number;
  filterOptions: StudyBrowserFilterOptions;
}

export interface StudyBrowserField {
  name: string;
  value: string | null;
  textValue?: string | null;
  audio?: StudyMediaRef | null;
  image?: StudyMediaRef | null;
}

export interface StudyBrowserCardStats {
  cardId: string;
  reviewCount: number;
  lastReviewedAt: string | null;
}

export interface StudyBrowserNoteDetail {
  noteId: string;
  displayText: string;
  noteTypeName: string | null;
  sourceKind: string;
  updatedAt: string;
  rawFields: StudyBrowserField[];
  canonicalFields: StudyBrowserField[];
  cards: StudyCardSummary[];
  cardStats: StudyBrowserCardStats[];
  selectedCardId: string | null;
}

export interface StudyCardOption {
  id: string;
  label: string;
}

export interface StudyCardOptionsResponse {
  total: number;
  options: StudyCardOption[];
}

export interface StudyImportPreview {
  deckName: string;
  cardCount: number;
  noteCount: number;
  reviewLogCount: number;
  mediaReferenceCount: number;
  noteTypeBreakdown: Array<{
    notetypeName: string;
    noteCount: number;
    cardCount: number;
  }>;
}

export interface StudyImportResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  sourceFilename: string;
  deckName: string;
  preview: StudyImportPreview;
  importedAt?: string | null;
  errorMessage?: string | null;
}

export interface StudyExportManifest {
  exportedAt: string;
  cards: StudyCardSummary[];
  reviewLogs: StudyReviewEvent[];
  media: StudyMediaRef[];
  imports: StudyImportResult[];
}
