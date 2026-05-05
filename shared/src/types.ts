// Shared type definitions used across client and server

export {
  MAX_STUDY_ASYNC_IMPORT_BYTES,
  MAX_STUDY_IMPORT_BYTES,
  STUDY_IMPORT_UPLOAD_SESSION_TTL_MS,
  STUDY_BROWSER_PAGE_SIZE_DEFAULT,
  STUDY_BROWSER_PAGE_SIZE_MAX,
  STUDY_EXPORT_PAGE_SIZE_DEFAULT,
  STUDY_EXPORT_PAGE_SIZE_MAX,
  STUDY_NEW_CARDS_PER_DAY_DEFAULT,
  STUDY_NEW_CARDS_PER_DAY_MAX,
  STUDY_NEW_CARD_QUEUE_PAGE_SIZE_DEFAULT,
  STUDY_NEW_CARD_QUEUE_PAGE_SIZE_MAX,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_COMMIT_MAX_COUNT,
  STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH,
  STUDY_CANDIDATE_IMAGE_GENERATE_MAX_COUNT,
} from './studyConstants';

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

export type StudyCardCreationKind =
  | 'text-recognition'
  | 'audio-recognition'
  | 'production-text'
  | 'production-image'
  | 'cloze';

export type StudyCardImageRole = 'prompt' | 'answer' | 'both';

export type StudyCardImagePlacement = 'none' | StudyCardImageRole;

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
  answerAudioVoiceId?: string | null;
  answerAudioTextOverride?: string | null;
  answerAudio?: StudyMediaRef | null;
  answerImage?: StudyMediaRef | null;
  pitchAccent?: JapanesePitchAccentPayload | null;
}

export type JapanesePitchAccentSource = 'kanjium';

export type JapanesePitchAccentResolvedBy = 'single-candidate' | 'local-reading' | 'llm';

export type JapanesePitchAccentUnresolvedReason =
  | 'not-japanese'
  | 'no-expression'
  | 'not-found'
  | 'ambiguous-reading';

export interface JapanesePitchAccentAlternative {
  reading: string;
  pitchNum: number;
  morae: string[];
  pattern: number[];
  patternName: string;
}

export interface JapanesePitchAccentResolvedPayload extends JapanesePitchAccentAlternative {
  status: 'resolved';
  expression: string;
  source: JapanesePitchAccentSource;
  resolvedBy: JapanesePitchAccentResolvedBy;
  alternatives?: JapanesePitchAccentAlternative[];
}

export interface JapanesePitchAccentUnresolvedPayload {
  status: 'unresolved';
  expression: string;
  reason: JapanesePitchAccentUnresolvedReason;
  source: JapanesePitchAccentSource;
  resolvedBy: JapanesePitchAccentResolvedBy | 'none';
}

export type JapanesePitchAccentPayload =
  | JapanesePitchAccentResolvedPayload
  | JapanesePitchAccentUnresolvedPayload;

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
  introducedAt?: string | null;
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

export type StudyCardCandidateKind =
  | 'text-recognition'
  | 'audio-recognition'
  | 'production'
  | 'cloze';

export interface StudyCardCandidate {
  clientId: string;
  candidateKind: StudyCardCandidateKind;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  rationale: string;
  warnings?: string[];
  previewAudio?: StudyMediaRef | null;
  previewAudioRole?: 'prompt' | 'answer' | null;
  previewImage?: StudyMediaRef | null;
  imagePrompt?: string | null;
}

export interface StudyCardCandidateGenerateRequest {
  targetText: string;
  context?: string | null;
  includeLearnerContext?: boolean;
}

export interface StudyCardCandidateGenerateResponse {
  candidates: StudyCardCandidate[];
  learnerContextSummary?: string | null;
}

export interface StudyCardCandidateCommitItem {
  clientId: string;
  candidateKind: StudyCardCandidateKind;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  previewAudio?: StudyMediaRef | null;
  previewAudioRole?: 'prompt' | 'answer' | null;
  previewImage?: StudyMediaRef | null;
  imagePrompt?: string | null;
}

export interface StudyCardCandidateCommitRequest {
  candidates: StudyCardCandidateCommitItem[];
}

export interface StudyCardCandidateCommitResponse {
  cards: StudyCardSummary[];
}

export interface StudyCardCandidatePreviewAudioRequest {
  candidate: StudyCardCandidateCommitItem;
}

export interface StudyCardCandidatePreviewAudioResponse {
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  previewAudio: StudyMediaRef | null;
  previewAudioRole: 'prompt' | 'answer' | null;
}

export interface StudyCardCandidatePreviewImageRequest {
  candidate: StudyCardCandidateCommitItem;
  imagePrompt: string;
}

export interface StudyCardCandidatePreviewImageResponse {
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  previewImage: StudyMediaRef;
  imagePrompt: string;
}

export interface StudyCardRegenerateImageRequest {
  imagePrompt: string;
  imageRole: StudyCardImageRole;
}

export interface StudyCardDraftCompleteRequest {
  creationKind: StudyCardCreationKind;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  imagePlacement?: StudyCardImagePlacement;
  imagePrompt?: string | null;
}

export interface StudyCardDraftCompleteResponse {
  creationKind: StudyCardCreationKind;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  imagePlacement: StudyCardImagePlacement;
  imagePrompt: string | null;
  previewAudio: StudyMediaRef | null;
  previewAudioRole: 'prompt' | 'answer' | null;
  previewImage: StudyMediaRef | null;
}

export interface StudyCardDraftImageRequest {
  imagePrompt: string;
  imagePlacement: StudyCardImagePlacement;
}

export interface StudyCardDraftImageResponse {
  previewImage: StudyMediaRef;
  imagePrompt: string;
  imagePlacement: StudyCardImagePlacement;
}

export interface StudyOverview {
  dueCount: number;
  newCount: number;
  newCardsPerDay?: number;
  newCardsIntroducedToday?: number;
  newCardsAvailableToday?: number;
  learningCount: number;
  reviewCount: number;
  suspendedCount: number;
  totalCards: number;
  latestImport?: StudyImportResult | null;
  nextDueAt?: string | null;
}

export interface StudySettings {
  newCardsPerDay: number;
}

export interface StudyNewCardQueueItem {
  id: string;
  noteId: string;
  cardType: StudyCardType;
  displayText: string;
  meaning: string | null;
  queuePosition: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyNewCardQueueResponse {
  items: StudyNewCardQueueItem[];
  total: number;
  limit: number;
  nextCursor: string | null;
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

export interface StudyCardActionRequest {
  action: StudyCardActionName;
  mode?: StudyCardSetDueMode;
  dueAt?: string;
  timeZone?: string;
  currentOverview?: StudyOverview;
}

export interface StudyCardActionResult {
  card: StudyCardSummary;
  overview: StudyOverview;
}

export type StudyBrowserSortField =
  | 'created_on'
  | 'updated_on'
  | 'sort_field'
  | 'note_type'
  | 'card_count'
  | 'review_count';

export type StudyBrowserSortDirection = 'asc' | 'desc';

export interface StudyBrowserRow {
  noteId: string;
  displayText: string;
  noteTypeName: string | null;
  cardCount: number;
  reviewCount: number;
  queueSummary: Partial<Record<StudyQueueState, number>>;
  createdAt: string;
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
  limit: number;
  nextCursor: string | null;
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

export interface StudyImportPreview {
  deckName: string;
  cardCount: number;
  noteCount: number;
  reviewLogCount: number;
  mediaReferenceCount: number;
  skippedMediaCount: number;
  warnings: string[];
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
  uploadedAt?: string | null;
  uploadExpiresAt?: string | null;
  sourceSizeBytes?: number | null;
  importedAt?: string | null;
  errorMessage?: string | null;
}

export interface StudyImportUploadReadiness {
  ready: boolean;
  message: string | null;
}

export interface StudyImportUploadSession {
  importJob: StudyImportResult;
  upload: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
  };
}

export interface StudyExportManifest {
  exportedAt: string;
  sections: {
    cards: {
      total: number;
    };
    reviewLogs: {
      total: number;
    };
    media: {
      total: number;
    };
    imports: {
      total: number;
    };
  };
}

export interface StudyExportSectionResponse<T> {
  items: T[];
  nextCursor: string | null;
}
