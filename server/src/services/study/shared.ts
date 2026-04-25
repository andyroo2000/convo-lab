export type {
  CreateStudyCardInput,
  GetStudyHistoryInput,
  JsonRecord,
  ParsedImportDataset,
  StudyBrowserDetailNoteRecord,
  StudyBrowserListCardRecord,
  StudyBrowserListNoteRecord,
  StudyCardOptionRecord,
  StudyCardWithRelations,
  StudyImportErrorWithMedia,
  StudyImportJobRecord,
  StudyMediaAccessResult,
  StudyMediaRecord,
  StudyReviewLogRecord,
  UpdateStudyCardInput,
  PerformStudyCardActionInput,
  StudyBrowserCursor,
  StudyExportCursor,
  StudyHistoryCursor,
  ParsedAnkiMediaRecord,
  PersistedStudyMediaRecord,
  StudyImportWarningAccumulator,
} from './shared/types.js';

export {
  ANKI_DECK_NAME,
  STUDY_AUDIO_LOCK_POLL_INTERVAL_MS,
  STUDY_AUDIO_LOCK_TTL_MS,
  STUDY_SESSION_EAGER_MEDIA_CARD_LIMIT,
  STUDY_SESSION_READY_CARD_LIMIT,
  STUDY_MEDIA_SIGNED_URL_REFRESH_WINDOW_MS,
  STUDY_MEDIA_SIGNED_URL_TTL_SECONDS,
  STUDY_EXPORT_SECTION_LIMIT_DEFAULT,
  STUDY_EXPORT_SECTION_LIMIT_MAX,
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
  toSafeStudyImportError,
} from './shared/guards.js';

export {
  decodeStudyBrowserCursor,
  decodeStudyExportCursor,
  decodeStudyHistoryCursor,
  encodeStudyBrowserCursor,
  encodeStudyExportCursor,
  encodeStudyHistoryCursor,
} from './shared/cursors.js';

export { noteFieldValueToString, stripHtml, toSearchText } from './shared/text.js';

export {
  deletePersistedStudyMediaByStoragePath,
  findAccessibleLocalStudyMediaPath,
  findLocalAnkiMediaFile,
  getContentType,
  getDefaultAnkiMediaDirectory,
  getLegacyPublicStudyMediaRoot,
  getMediaKind,
  getPrivateStudyMediaRoot,
  getStudyMediaApiPath,
  hasConfiguredStudyGcsStorage,
  isAllowedStudyImportZipEntryName,
  isSafeZipBasename,
  isUnsafeZipPath,
  normalizeFilename,
  normalizeZipPath,
  pruneStudyMediaRedirectCache,
  resolveStudyMediaAbsolutePath,
  sanitizePathSegment,
  studyMediaRedirectCache,
} from './shared/paths.js';

export {
  createStudyImportWarningAccumulator,
  recordStudyImportWarning,
  toBoundedReviewRawPayload,
  toConvolabReviewRawPayload,
  toImportReviewRawPayload,
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
  getSqlJs,
  normalizeClozePayload,
  parseColpkgUpload,
} from './shared/importHelpers.js';

export {
  buildMediaLookup,
  getNoteDisplayText,
  mergeStudyMediaRecord,
  normalizeStudyCardPayload,
  toStudyBrowserField,
  toStudyCardSummary,
} from './shared/cardMappers.js';

export {
  backfillImportedStudyMedia,
  ensureGeneratedAnswerAudio,
  ensureStudyCardMediaAvailable,
  getStudyAudioRedisClient,
  persistStudyMediaBuffer,
} from './shared/mediaHelpers.js';
