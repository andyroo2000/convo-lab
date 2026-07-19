export type {
  JsonRecord,
  StudyMediaAccessResult,
  PersistedStudyMediaRecord,
} from './shared/types.js';

export {
  STUDY_AUDIO_LOCK_POLL_INTERVAL_MS,
  STUDY_AUDIO_REPAIR_FAILURE_COOLDOWN_MS,
  STUDY_AUDIO_LOCK_TTL_MS,
  STUDY_GENERATED_IMPORT_JOB_ID,
  STUDY_MEDIA_SIGNED_URL_REFRESH_WINDOW_MS,
  STUDY_MEDIA_SIGNED_URL_TTL_SECONDS,
} from './shared/constants.js';

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
  backfillImportedStudyMedia,
  ensureGeneratedAnswerAudio,
  getStudyAudioRedisClient,
  persistStudyMediaBuffer,
} from './shared/mediaHelpers.js';
