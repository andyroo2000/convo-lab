export type {
  CreateStudyCardInput,
  JsonRecord,
  StudyCardWithRelations,
  StudyImportJobRecord,
  StudyMediaAccessResult,
  StudyMediaRecord,
  StudyReviewLogRecord,
  UpdateStudyCardInput,
  PerformStudyCardActionInput,
  PersistedStudyMediaRecord,
} from './shared/types.js';

export {
  ANKI_DECK_NAME,
  STUDY_AUDIO_LOCK_POLL_INTERVAL_MS,
  STUDY_AUDIO_REPAIR_FAILURE_COOLDOWN_MS,
  STUDY_AUDIO_LOCK_TTL_MS,
  STUDY_GENERATED_IMPORT_JOB_ID,
  STUDY_SESSION_EAGER_MEDIA_CARD_LIMIT,
  STUDY_SESSION_READY_CARD_LIMIT,
  STUDY_MEDIA_SIGNED_URL_REFRESH_WINDOW_MS,
  STUDY_MEDIA_SIGNED_URL_TTL_SECONDS,
} from './shared/constants.js';

export {
  isRecord,
  parseJsonRecord,
  parseOptionalStudyOverview,
  parseStudyAudioSource,
  parseStudyCardType,
  parseStudyImportStatus,
  parseStudyMediaKind,
  parseStudyQueueState,
  parseStudyReviewSource,
  sanitizeText,
  toBigIntOrNull,
  toNullablePrismaJson,
  toPrismaJson,
} from './shared/guards.js';

export {
  cardTypeForStudyCardCreationKind,
  cardTypeForStudyCardCandidateKind,
  STUDY_CARD_CREATION_KINDS,
  STUDY_CARD_CANDIDATE_KINDS,
  STUDY_CARD_IMAGE_PLACEMENTS,
} from './shared/candidates.js';

export { noteFieldValueToString, stripHtml, toSearchText } from './shared/text.js';

export {
  deletePersistedStudyMediaByStoragePath,
  findAccessibleLocalStudyMediaPath,
  findLocalAnkiMediaFile,
  getContentType,
  getDefaultAnkiMediaDirectory,
  getLegacyPublicStudyMediaRoot,
  getPrivateStudyMediaRoot,
  getStudyMediaApiPath,
  hasConfiguredStudyGcsStorage,
  isSafeZipBasename,
  isUnsafeZipPath,
  normalizeFilename,
  normalizeZipPath,
  pruneStudyMediaRedirectCache,
  resolveStudyMediaAbsolutePath,
  sanitizePathSegment,
  shouldMirrorStudyMediaLocally,
  studyMediaRedirectCache,
} from './shared/paths.js';

export {
  toBoundedReviewRawPayload,
  toConvolabReviewRawPayload,
  toStudyFsrsState,
  toStudyImportPreview,
  toStudyReviewEvent,
} from './shared/payloads.js';

export {
  assertValidStudyTimeZone,
  createFreshSchedulerState,
  dateFromDayBoundary,
  dateFromLocalDayStart,
  getBestAnswerAudioText,
  getRequiredSchedulerState,
  getScheduledDaysForDue,
  scheduler,
} from './shared/time.js';

export {
  buildStudyCardSearchText,
  buildStudyNoteSearchText,
  normalizeClozePayload,
} from './shared/importHelpers.js';

export {
  buildMediaLookup,
  mergeStudyMediaRecord,
  normalizeStudyCardPayload,
  toStudyCardSummary,
} from './shared/cardMappers.js';

export {
  backfillImportedStudyMedia,
  ensureGeneratedAnswerAudio,
  getStudyAudioRedisClient,
  persistStudyMediaBuffer,
} from './shared/mediaHelpers.js';

export { isAudioRecognitionPrompt } from './shared/audioRecognitionUtils.js';
