// Shared type definitions used across client and server

export {
  STUDY_BROWSER_PAGE_SIZE_DEFAULT,
  STUDY_BROWSER_PAGE_SIZE_MAX,
  STUDY_NEW_CARD_QUEUE_PAGE_SIZE_DEFAULT,
  STUDY_NEW_CARD_QUEUE_PAGE_SIZE_MAX,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_COMMIT_MAX_COUNT,
  STUDY_CANDIDATE_IMAGE_GENERATE_MAX_COUNT,
  STUDY_VOCAB_BUNDLE_CARD_COUNT,
  STUDY_VOCAB_BUNDLE_SENTENCE_COUNT,
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

export interface StudyIntegerCapability {
  default: number;
  min: number;
  max: number;
}

export const STUDY_ACTIVITY_CATEGORIES = [
  'review',
  'listen',
  'create',
  'immerse',
  'conversation',
  'wanikani',
] as const;
export type StudyActivityCategory = (typeof STUDY_ACTIVITY_CATEGORIES)[number];

export const STUDY_ACTIVITY_KINDS = [
  'card_review',
  'daily_audio',
  'card_creation',
  'tv',
  'podcast',
  'reading',
  'conversation',
  'wanikani_review',
  'other',
] as const;
export type StudyActivityKind = (typeof STUDY_ACTIVITY_KINDS)[number];

export interface StudyClientCapabilities {
  version: number;
  settings: {
    newCardsPerDay: StudyIntegerCapability;
    lessonBatchSize: StudyIntegerCapability;
    reviewTimeBudgetMinutes: StudyIntegerCapability;
    newCardLaneWeights: Record<keyof StudyNewCardLaneWeights, StudyIntegerCapability>;
  };
  cardAuthoring: {
    creationKinds: StudyCardCreationKind[];
    imagePlacements: StudyCardImagePlacement[];
    previewAudioRoles: Array<'prompt' | 'answer'>;
    defaultAnswerAudioVoiceId: string;
    defaultFemaleAnswerAudioVoiceId: string;
    limits: {
      combinedPayloadBytes: number;
      payloadDepth: number;
      imagePromptCharacters: number;
      imageUploadBytes: number;
    };
  };
  dailyAudio: { targetDurationMinutes: StudyIntegerCapability };
  offlineReserve: { days: number; maxScheduledCards: number };
  imports: { maxArchiveBytes: number };
  studyActivity: {
    categoriesByActivity: Record<StudyActivityKind, StudyActivityCategory>;
  };
}

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

export type StudyCardPresentationMediaRef = {
  [Key in keyof StudyMediaRef]?: StudyMediaRef[Key] | null;
};

export interface StudyCardPresentationText {
  text: string | null;
  ruby: string | null;
}

export interface StudyCardPresentationV1 {
  version: 1;
  front: {
    mode: 'text' | 'media' | 'cloze';
    text: string | null;
    ruby: string | null;
    hint: string | null;
    media: {
      audio: StudyCardPresentationMediaRef | null;
      image: StudyCardPresentationMediaRef | null;
    };
    autoplayAudio: boolean;
  };
  answer: {
    heading: string | null;
    ruby: string | null;
    restored: string | null;
    meaning: string | null;
    sentences: {
      japanese: StudyCardPresentationText;
      english: StudyCardPresentationText;
    };
    notes: string[];
    media: { image: StudyCardPresentationMediaRef | null };
    audio: StudyCardPresentationMediaRef | null;
    pitchAccent: JapanesePitchAccentResolvedPayload | null;
  };
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
  failedAt?: string | null;
  queueState: StudyQueueState;
  scheduler: StudyFsrsState | null;
  source: StudySourceSnapshot;
  rawFsrs?: Record<string, unknown> | null;
}

export interface StudyCardSummary {
  id: string;
  syncId?: string;
  noteId: string | null;
  /** Required at the API boundary; optional only for local synthetic and test cards. */
  revision?: number;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  /** Server-owned review rendering projection. Missing/unknown versions fall back to raw fields. */
  presentation?: StudyCardPresentationV1 | null;
  state: StudyCardState;
  masteryLevel?: StudyMasteryLevel;
  answerAudioSource: StudyAudioSource;
  createdAt: string;
  updatedAt: string;
}

export type StudyMasteryLevel = 'apprentice' | 'guru' | 'master' | 'enlightened' | 'burned';

export interface StudyMasterySpread {
  apprentice: number;
  guru: number;
  master: number;
  enlightened: number;
  burned: number;
}

export interface StudyJlptMasteryMetric {
  masteryPercent: number;
  known?: number | null;
  knownFromCards?: number | null;
  knownFromWaniKani?: number | null;
  knownFromBoth?: number | null;
  matched?: number | null;
  covered: number;
  total: number;
}

export interface StudyJlptLevelMastery {
  vocabulary: StudyJlptMasteryMetric;
  grammar: StudyJlptMasteryMetric;
}

export interface StudyJlptMastery {
  N5: StudyJlptLevelMastery;
  N4?: StudyJlptLevelMastery;
}

export interface StudyLearningReadiness {
  recommendation: 'ready' | 'caution' | 'pause';
  readinessLevel?: string | null;
  sampleSize: number;
  sufficientData: boolean;
  recentRecall: number | null;
  targetRecall: number;
  dueBacklog: number;
  apprenticeCount: number;
  projectedSevenDayReviews: number;
  timedReviewSampleSize?: number | null;
  medianReviewDurationSeconds?: number | null;
  projectedDailyReviewMinutes?: number | null;
  reviewTimeBudgetMinutes?: number | null;
  reviewTimeHeadroomMinutes?: number | null;
  suggestedBatchSize: number;
  displayStatus?: string;
  displaySummary?: string;
}

export type StudyCardCandidateKind =
  | 'text-recognition'
  | 'audio-recognition'
  | 'production'
  | 'cloze';

export type StudyVocabVariantKind =
  | 'sentence_audio_recognition'
  | 'sentence_text_recognition'
  | 'word_audio_recognition'
  | 'word_text_recognition'
  | 'sentence_cloze';

export type StudyVocabVariantStatus = 'available' | 'locked';

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

export interface StudyVocabBundleGenerateRequest {
  targetWord: string;
  sourceSentence?: string | null;
  context?: string | null;
  includeLearnerContext?: boolean;
}

export interface StudyVocabBundleSentence {
  ordinal: number;
  sentenceJp: string;
  sentenceReading?: string | null;
  sentenceEn: string;
  notes?: string | null;
}

export interface StudyVocabBundleCandidate {
  clientId: string;
  stage: number;
  variantKind: StudyVocabVariantKind;
  variantSentenceOrdinal?: number | null;
  candidate: StudyCardCandidate;
}

export interface StudyVocabBundle {
  targetWord: string;
  targetReading?: string | null;
  targetMeaning?: string | null;
  sourceSentence?: string | null;
  sourceContext?: string | null;
  sentences: StudyVocabBundleSentence[];
  variants: StudyVocabBundleCandidate[];
}

export interface StudyVocabBundleGenerateResponse {
  bundle: StudyVocabBundle;
  learnerContextSummary?: string | null;
}

export interface StudyVocabBundleDraftCreateResponse {
  groupId: string;
  drafts: StudyManualCardDraft[];
}

export interface StudyCardDraftPreviewAudioResponse {
  revision: number;
  previewAudio: StudyMediaRef | null;
  previewAudioRole: 'prompt' | 'answer' | null;
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
  revision: number;
  previewImage: StudyMediaRef;
  imagePrompt: string;
  imagePlacement: StudyCardImagePlacement;
}

export type StudyManualCardDraftStatus = 'generating' | 'ready' | 'error';

export interface StudyManualCardDraft {
  id: string;
  revision: number;
  status: StudyManualCardDraftStatus;
  committedCardId?: string | null;
  creationKind: StudyCardCreationKind;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  imagePlacement: StudyCardImagePlacement;
  imagePrompt: string | null;
  previewAudio: StudyMediaRef | null;
  previewAudioRole: 'prompt' | 'answer' | null;
  previewImage: StudyMediaRef | null;
  variantGroupId?: string | null;
  variantSentenceId?: string | null;
  variantKind?: StudyVocabVariantKind | null;
  variantStage?: number | null;
  variantStatus?: StudyVocabVariantStatus | null;
  variantUnlockedAt?: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyManualCardDraftListResponse {
  drafts: StudyManualCardDraft[];
  total: number | null;
  limit: number;
  nextCursor: string | null;
}

export interface StudyManualCardDraftCreateRequest {
  creationKind: StudyCardCreationKind;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  imagePlacement?: StudyCardImagePlacement;
  imagePrompt?: string | null;
}

export interface StudyManualCardDraftUpdateRequest {
  expectedRevision: number;
  prompt?: StudyPromptPayload;
  answer?: StudyAnswerPayload;
  imagePlacement?: StudyCardImagePlacement;
  imagePrompt?: string | null;
  previewAudio?: StudyMediaRef | null;
  previewAudioRole?: 'prompt' | 'answer' | null;
  previewImage?: StudyMediaRef | null;
}

export interface StudyManualCardDraftCreateCardResponse {
  card: StudyCardSummary;
  draftId: string;
}

export interface StudyOverview {
  dueCount: number;
  failedCount?: number;
  failedDueCount?: number;
  newCount: number;
  newCardsPerDay?: number;
  lessonBatchSize?: number;
  newCardsIntroducedToday?: number;
  newCardsAvailableToday?: number;
  learningCount: number;
  reviewCount: number;
  suspendedCount: number;
  totalCards: number;
  latestImport?: StudyImportResult | null;
  nextDueAt?: string | null;
  masterySpread?: StudyMasterySpread;
  jlptMastery?: StudyJlptMastery | null;
  learningReadiness?: StudyLearningReadiness;
}

export interface StudySettings {
  newCardsPerDay: number;
  lessonBatchSize?: number;
  newCardLaneWeights?: StudyNewCardLaneWeights;
}

export interface StudyNewCardLaneWeights {
  standard: number;
  lessonFollowup: number;
  wanikani: number;
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

export interface StudyIntroductionCohort {
  id: string;
  sourceKind: 'lesson_followup' | 'wanikani';
  label: string | null;
  priorityUntil: string;
  cards: StudyCardSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface StudyCardListResponse {
  items: StudyCardSummary[];
  limit: number;
  nextCursor: string | null;
}

export type StudyLearningItemStageStatus = 'locked' | 'available' | 'retired' | null;

export interface StudyLearningItemCard {
  id: string;
  syncId: string;
  noteId: string | null;
  cardType: StudyCardType;
  displayText: string;
  meaning: string | null;
  variantKind: StudyVocabVariantKind | null;
}

export interface StudyLearningItemStage {
  number: number | null;
  status: StudyLearningItemStageStatus;
  cardCount: number;
  representativeCard: StudyLearningItemCard;
  cards: StudyLearningItemCard[];
}

export interface StudyLearningItem {
  id: string;
  groupId: string | null;
  representativeCard: StudyLearningItemCard;
  currentStageNumber: number | null;
  stageCount: number;
  cardCount: number;
  retiredStageCount: number;
  transferDemonstrated: boolean;
  stages: StudyLearningItemStage[];
}

export interface StudyLearningItemListResponse {
  items: StudyLearningItem[];
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
  card: StudyCardSummary | null;
  overview: StudyOverview;
  committed?: boolean;
  cardFetchFailed?: boolean;
  message?: string;
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
