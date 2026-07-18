import { AppError } from '../../middleware/errorHandler.js';

import { rewriteLearningOsStudyMediaUrl } from './studyMediaUrls.js';

export type LearningOsStudyReadFeature =
  | 'settings'
  | 'overview'
  | 'browser'
  | 'browserDetail'
  | 'newQueue'
  | 'importJob'
  | 'importCurrent'
  | 'importReadiness'
  | 'importSession'
  | 'session'
  | 'review'
  | 'reviewUndo';

type JsonRecord = Record<string, unknown>;

const IMPORT_STATUSES = new Set(['pending', 'processing', 'completed', 'failed']);
const CARD_TYPES = new Set(['recognition', 'production', 'cloze']);
const QUEUE_STATES = new Set(['new', 'learning', 'review', 'relearning', 'suspended', 'buried']);
const MEDIA_KINDS = new Set(['audio', 'image', 'other']);
const MEDIA_SOURCES = new Set([
  'imported',
  'generated',
  'missing',
  'imported_image',
  'imported_other',
]);
const AUDIO_SOURCES = new Set(['imported', 'generated', 'missing']);
const SERVER_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/;

function invalidResponse(feature: LearningOsStudyReadFeature): never {
  throw new AppError(`Learning OS Study API returned an invalid ${feature} response.`, 502);
}

function record(value: unknown, feature: LearningOsStudyReadFeature): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalidResponse(feature);
  }

  return value as JsonRecord;
}

function list(value: unknown, feature: LearningOsStudyReadFeature): unknown[] {
  if (!Array.isArray(value)) {
    return invalidResponse(feature);
  }

  return value;
}

function stringValue(value: unknown, feature: LearningOsStudyReadFeature): string {
  if (typeof value !== 'string') {
    return invalidResponse(feature);
  }

  return value;
}

function nullableString(value: unknown, feature: LearningOsStudyReadFeature): string | null {
  if (value === null) {
    return null;
  }

  return stringValue(value, feature);
}

function isoTimestamp(value: unknown, feature: LearningOsStudyReadFeature): string {
  const source = stringValue(value, feature);
  if (!SERVER_TIMESTAMP_PATTERN.test(source)) {
    return invalidResponse(feature);
  }

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    return invalidResponse(feature);
  }

  return parsed.toISOString();
}

function nullableIsoTimestamp(value: unknown, feature: LearningOsStudyReadFeature): string | null {
  if (value === null) {
    return null;
  }

  return isoTimestamp(value, feature);
}

function nonNegativeInteger(value: unknown, feature: LearningOsStudyReadFeature): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return invalidResponse(feature);
  }

  return value;
}

function nullableNonNegativeInteger(
  value: unknown,
  feature: LearningOsStudyReadFeature
): number | null {
  if (value === null) {
    return null;
  }

  return nonNegativeInteger(value, feature);
}

function integer(value: unknown, feature: LearningOsStudyReadFeature): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return invalidResponse(feature);
  }

  return value;
}

function booleanValue(value: unknown, feature: LearningOsStudyReadFeature): boolean {
  if (typeof value !== 'boolean') {
    return invalidResponse(feature);
  }

  return value;
}

function nullableInteger(value: unknown, feature: LearningOsStudyReadFeature): number | null {
  return value === null ? null : integer(value, feature);
}

function nullableRecord(value: unknown, feature: LearningOsStudyReadFeature): JsonRecord | null {
  return value === null ? null : record(value, feature);
}

function aliasedValue(source: JsonRecord, camelCase: string, snakeCase: string): unknown {
  return camelCase in source ? source[camelCase] : source[snakeCase];
}

function stringList(value: unknown, feature: LearningOsStudyReadFeature): string[] {
  return list(value, feature).map((item) => stringValue(item, feature));
}

function enumString(
  value: unknown,
  allowed: ReadonlySet<string>,
  feature: LearningOsStudyReadFeature
): string {
  const parsed = stringValue(value, feature);
  if (!allowed.has(parsed)) {
    return invalidResponse(feature);
  }

  return parsed;
}

function adaptSettings(value: unknown) {
  const data = record(record(value, 'settings').data, 'settings');

  return {
    newCardsPerDay: nonNegativeInteger(data.new_cards_per_day, 'settings'),
  };
}

function adaptLatestImport(value: unknown) {
  if (value === null) {
    return null;
  }

  const source = record(value, 'overview');
  const deckName = stringValue(source.deck_name, 'overview');
  const preview = adaptImportPreview(source.preview, 'overview', deckName);

  return {
    id: stringValue(source.id, 'overview'),
    status: enumString(source.status, IMPORT_STATUSES, 'overview'),
    sourceFilename: stringValue(source.source_filename, 'overview'),
    deckName,
    preview,
    importedAt: nullableIsoTimestamp(source.completed_at, 'overview'),
    errorMessage: nullableString(source.error_message, 'overview'),
  };
}

function adaptImportPreview(
  value: unknown,
  feature: Extract<
    LearningOsStudyReadFeature,
    'overview' | 'importJob' | 'importCurrent' | 'importSession' | 'review' | 'reviewUndo'
  > = 'overview',
  fallbackDeckName = '日本語'
) {
  if (value === null) {
    return {
      deckName: fallbackDeckName,
      cardCount: 0,
      noteCount: 0,
      reviewLogCount: 0,
      mediaReferenceCount: 0,
      skippedMediaCount: 0,
      warnings: [],
      noteTypeBreakdown: [],
    };
  }

  const preview = record(value, feature);
  return {
    deckName: stringValue(aliasedValue(preview, 'deckName', 'deck_name'), feature),
    cardCount: nonNegativeInteger(aliasedValue(preview, 'cardCount', 'card_count'), feature),
    noteCount: nonNegativeInteger(aliasedValue(preview, 'noteCount', 'note_count'), feature),
    reviewLogCount: nonNegativeInteger(
      aliasedValue(preview, 'reviewLogCount', 'review_log_count'),
      feature
    ),
    mediaReferenceCount: nonNegativeInteger(
      aliasedValue(preview, 'mediaReferenceCount', 'media_reference_count'),
      feature
    ),
    skippedMediaCount: nonNegativeInteger(
      aliasedValue(preview, 'skippedMediaCount', 'skipped_media_count'),
      feature
    ),
    warnings: stringList(preview.warnings, feature),
    noteTypeBreakdown: list(
      aliasedValue(preview, 'noteTypeBreakdown', 'note_type_breakdown'),
      feature
    ).map((value) => {
      const item = record(value, feature);
      return {
        notetypeName: stringValue(aliasedValue(item, 'notetypeName', 'note_type_name'), feature),
        noteCount: nonNegativeInteger(aliasedValue(item, 'noteCount', 'note_count'), feature),
        cardCount: nonNegativeInteger(aliasedValue(item, 'cardCount', 'card_count'), feature),
      };
    }),
  };
}

function adaptImportJobData(
  value: unknown,
  feature: Extract<LearningOsStudyReadFeature, 'importJob' | 'importCurrent' | 'importSession'>
) {
  const source = record(value, feature);
  const deckName = stringValue(source.deck_name, feature);

  return {
    id: stringValue(source.id, feature),
    status: enumString(source.status, IMPORT_STATUSES, feature),
    sourceFilename: stringValue(source.source_filename, feature),
    deckName,
    preview: adaptImportPreview(source.preview, feature, deckName),
    uploadedAt: nullableIsoTimestamp(source.uploaded_at, feature),
    uploadExpiresAt: nullableIsoTimestamp(source.upload_expires_at, feature),
    sourceSizeBytes: nullableNonNegativeInteger(source.source_size_bytes, feature),
    importedAt: nullableIsoTimestamp(source.completed_at, feature),
    errorMessage: nullableString(source.error_message, feature),
  };
}

function adaptImportJob(value: unknown) {
  return adaptImportJobData(record(value, 'importJob').data, 'importJob');
}

function adaptCurrentImport(value: unknown) {
  const data = record(value, 'importCurrent').data;
  return data === null ? null : adaptImportJobData(data, 'importCurrent');
}

function adaptImportReadiness(value: unknown) {
  const source = record(value, 'importReadiness');
  return {
    ready: booleanValue(source.ready, 'importReadiness'),
    message: nullableString(source.message, 'importReadiness'),
  };
}

function adaptImportSession(value: unknown) {
  const data = record(record(value, 'importSession').data, 'importSession');
  const importJob = adaptImportJobData(data.import_job, 'importSession');
  const upload = record(data.upload, 'importSession');
  const headers = record(upload.headers, 'importSession');

  if (stringValue(upload.method, 'importSession') !== 'PUT') {
    return invalidResponse('importSession');
  }

  const contentType = stringValue(headers['Content-Type'], 'importSession');
  return {
    importJob,
    upload: {
      method: 'PUT' as const,
      url: `/api/learning-os/study/imports/${encodeURIComponent(importJob.id)}/upload`,
      headers: { 'Content-Type': contentType },
    },
  };
}

function adaptOverview(value: unknown) {
  const data = record(record(value, 'overview').data, 'overview');

  return {
    dueCount: nonNegativeInteger(data.due_count, 'overview'),
    failedCount: nonNegativeInteger(data.failed_count, 'overview'),
    newCount: nonNegativeInteger(data.new_count, 'overview'),
    newCardsPerDay: nonNegativeInteger(data.new_cards_per_day, 'overview'),
    newCardsIntroducedToday: nonNegativeInteger(data.new_cards_introduced_today, 'overview'),
    newCardsAvailableToday: nonNegativeInteger(data.new_cards_available_today, 'overview'),
    learningCount: nonNegativeInteger(data.learning_count, 'overview'),
    reviewCount: nonNegativeInteger(data.review_count, 'overview'),
    suspendedCount: nonNegativeInteger(data.suspended_count, 'overview'),
    totalCards: nonNegativeInteger(data.total_cards, 'overview'),
    latestImport: adaptLatestImport(data.latest_import),
    nextDueAt: nullableIsoTimestamp(data.next_due_at, 'overview'),
  };
}

function adaptQueueSummary(value: unknown): Record<string, number> {
  const source = record(value, 'browser');

  // Fail closed so a new backend queue state cannot silently escape the shared client contract.
  return Object.fromEntries(
    Object.entries(source).map(([state, count]) => {
      if (!QUEUE_STATES.has(state)) {
        return invalidResponse('browser');
      }

      return [state, nonNegativeInteger(count, 'browser')];
    })
  );
}

function adaptBrowserRow(value: unknown) {
  const row = record(value, 'browser');

  return {
    noteId: stringValue(row.noteId, 'browser'),
    displayText: stringValue(row.displayText, 'browser'),
    noteTypeName: nullableString(row.noteTypeName, 'browser'),
    cardCount: nonNegativeInteger(row.cardCount, 'browser'),
    reviewCount: nonNegativeInteger(row.reviewCount, 'browser'),
    queueSummary: adaptQueueSummary(row.queueSummary),
    createdAt: isoTimestamp(row.createdAt, 'browser'),
    updatedAt: isoTimestamp(row.updatedAt, 'browser'),
  };
}

function adaptBrowser(value: unknown) {
  const source = record(value, 'browser');
  const filterOptions = record(source.filterOptions, 'browser');

  return {
    rows: list(source.rows, 'browser').map(adaptBrowserRow),
    total: nonNegativeInteger(source.total, 'browser'),
    limit: nonNegativeInteger(source.limit, 'browser'),
    nextCursor: nullableString(source.nextCursor, 'browser'),
    filterOptions: {
      noteTypes: stringList(filterOptions.noteTypes, 'browser'),
      cardTypes: list(filterOptions.cardTypes, 'browser').map((item) =>
        enumString(item, CARD_TYPES, 'browser')
      ),
      queueStates: list(filterOptions.queueStates, 'browser').map((item) =>
        enumString(item, QUEUE_STATES, 'browser')
      ),
    },
  };
}

function adaptMedia(value: unknown) {
  if (value === null) return null;

  const media = record(value, 'browserDetail');
  const id =
    media.id === null || media.id === undefined
      ? undefined
      : stringValue(media.id, 'browserDetail');
  const url =
    media.url === undefined
      ? undefined
      : rewriteLearningOsStudyMediaUrl(nullableString(media.url, 'browserDetail'));

  return {
    ...(id === undefined ? {} : { id }),
    filename: stringValue(media.filename, 'browserDetail'),
    ...(url === undefined ? {} : { url }),
    mediaKind: enumString(media.mediaKind, MEDIA_KINDS, 'browserDetail'),
    source: enumString(media.source, MEDIA_SOURCES, 'browserDetail'),
  };
}

function adaptBrowserField(value: unknown) {
  const field = record(value, 'browserDetail');

  return {
    name: stringValue(field.name, 'browserDetail'),
    value: nullableString(field.value, 'browserDetail'),
    textValue: nullableString(field.textValue, 'browserDetail'),
    audio: adaptMedia(field.audio),
    image: adaptMedia(field.image),
  };
}

function adaptPrompt(value: unknown) {
  const prompt = record(value, 'browserDetail');

  return {
    cueText: nullableString(prompt.cueText ?? null, 'browserDetail'),
    cueReading: nullableString(prompt.cueReading ?? null, 'browserDetail'),
    cueMeaning: nullableString(prompt.cueMeaning ?? null, 'browserDetail'),
    cueAudio: adaptMedia(prompt.cueAudio ?? null),
    cueImage: adaptMedia(prompt.cueImage ?? null),
    clozeText: nullableString(prompt.clozeText ?? null, 'browserDetail'),
    clozeDisplayText: nullableString(prompt.clozeDisplayText ?? null, 'browserDetail'),
    clozeAnswerText: nullableString(prompt.clozeAnswerText ?? null, 'browserDetail'),
    clozeHint: nullableString(prompt.clozeHint ?? null, 'browserDetail'),
    clozeResolvedHint: nullableString(prompt.clozeResolvedHint ?? null, 'browserDetail'),
  };
}

function optionalNullableString(source: JsonRecord, key: string) {
  return key in source ? { [key]: nullableString(source[key], 'browserDetail') } : {};
}

function optionalMedia(source: JsonRecord, key: string) {
  return key in source ? { [key]: adaptMedia(source[key]) } : {};
}

function adaptAnswer(value: unknown) {
  const answer = record(value, 'browserDetail');

  return {
    ...optionalNullableString(answer, 'expression'),
    ...optionalNullableString(answer, 'expressionReading'),
    ...optionalNullableString(answer, 'meaning'),
    ...optionalNullableString(answer, 'notes'),
    ...optionalNullableString(answer, 'sentenceJp'),
    ...optionalNullableString(answer, 'sentenceJpKana'),
    ...optionalNullableString(answer, 'sentenceEn'),
    ...optionalNullableString(answer, 'restoredText'),
    ...optionalNullableString(answer, 'restoredTextReading'),
    answerAudioVoiceId: nullableString(answer.answerAudioVoiceId ?? null, 'browserDetail'),
    answerAudioTextOverride: nullableString(
      answer.answerAudioTextOverride ?? null,
      'browserDetail'
    ),
    ...optionalMedia(answer, 'answerAudio'),
    ...optionalMedia(answer, 'answerImage'),
    ...(answer.pitchAccent === undefined
      ? {}
      : { pitchAccent: nullableRecord(answer.pitchAccent, 'browserDetail') }),
  };
}

function adaptSourceSnapshot(value: unknown) {
  const source = record(value, 'browserDetail');

  return {
    noteId: nullableString(source.noteId, 'browserDetail'),
    noteGuid: nullableString(source.noteGuid, 'browserDetail'),
    cardId: nullableString(source.cardId, 'browserDetail'),
    deckId: nullableString(source.deckId, 'browserDetail'),
    deckName: nullableString(source.deckName, 'browserDetail'),
    notetypeId: nullableString(source.notetypeId, 'browserDetail'),
    notetypeName: nullableString(source.notetypeName, 'browserDetail'),
    templateOrd: nullableInteger(source.templateOrd, 'browserDetail'),
    templateName: nullableString(source.templateName, 'browserDetail'),
    queue: nullableInteger(source.queue, 'browserDetail'),
    type: nullableInteger(source.type, 'browserDetail'),
    due: nullableInteger(source.due, 'browserDetail'),
    ivl: nullableInteger(source.ivl, 'browserDetail'),
    factor: nullableInteger(source.factor, 'browserDetail'),
    reps: nullableInteger(source.reps, 'browserDetail'),
    lapses: nullableInteger(source.lapses, 'browserDetail'),
    left: nullableInteger(source.left, 'browserDetail'),
    odue: nullableInteger(source.odue, 'browserDetail'),
    odid: nullableString(source.odid, 'browserDetail'),
  };
}

function adaptBrowserCard(
  value: unknown,
  feature: Extract<
    LearningOsStudyReadFeature,
    'browserDetail' | 'session' | 'review' | 'reviewUndo'
  > = 'browserDetail'
) {
  const card = record(value, feature);
  const state = record(card.state, feature);

  return {
    id: stringValue(card.id, feature),
    noteId:
      feature === 'browserDetail'
        ? stringValue(card.noteId, feature)
        : nullableString(card.noteId, feature),
    cardType: enumString(card.cardType, CARD_TYPES, feature),
    prompt: adaptPrompt(card.prompt),
    answer: adaptAnswer(card.answer),
    state: {
      dueAt: nullableIsoTimestamp(state.dueAt, feature),
      introducedAt: nullableIsoTimestamp(state.introducedAt, feature),
      failedAt: nullableIsoTimestamp(state.failedAt, feature),
      queueState: enumString(state.queueState, QUEUE_STATES, feature),
      scheduler: nullableRecord(state.scheduler, feature),
      source: adaptSourceSnapshot(state.source),
      rawFsrs: nullableRecord(state.rawFsrs, feature),
    },
    answerAudioSource: enumString(card.answerAudioSource, AUDIO_SOURCES, feature),
    createdAt: isoTimestamp(card.createdAt, feature),
    updatedAt: isoTimestamp(card.updatedAt, feature),
  };
}

function adaptBrowserDetail(value: unknown) {
  const detail = record(value, 'browserDetail');

  return {
    noteId: stringValue(detail.noteId, 'browserDetail'),
    displayText: stringValue(detail.displayText, 'browserDetail'),
    noteTypeName: nullableString(detail.noteTypeName, 'browserDetail'),
    sourceKind: stringValue(detail.sourceKind, 'browserDetail'),
    updatedAt: isoTimestamp(detail.updatedAt, 'browserDetail'),
    rawFields: list(detail.rawFields, 'browserDetail').map(adaptBrowserField),
    canonicalFields: list(detail.canonicalFields, 'browserDetail').map(adaptBrowserField),
    cards: list(detail.cards, 'browserDetail').map((card) => adaptBrowserCard(card)),
    cardStats: list(detail.cardStats, 'browserDetail').map((value) => {
      const stats = record(value, 'browserDetail');
      return {
        cardId: stringValue(stats.cardId, 'browserDetail'),
        reviewCount: nonNegativeInteger(stats.reviewCount, 'browserDetail'),
        lastReviewedAt: nullableIsoTimestamp(stats.lastReviewedAt, 'browserDetail'),
      };
    }),
    selectedCardId: nullableString(detail.selectedCardId, 'browserDetail'),
  };
}

function adaptNewQueueItem(value: unknown) {
  const item = record(value, 'newQueue');

  return {
    id: stringValue(item.id, 'newQueue'),
    noteId: stringValue(item.noteId, 'newQueue'),
    cardType: enumString(item.cardType, CARD_TYPES, 'newQueue'),
    displayText: stringValue(item.displayText, 'newQueue'),
    meaning: nullableString(item.meaning, 'newQueue'),
    queuePosition: nullableNonNegativeInteger(item.queuePosition, 'newQueue'),
    createdAt: isoTimestamp(item.createdAt, 'newQueue'),
    updatedAt: isoTimestamp(item.updatedAt, 'newQueue'),
  };
}

function adaptNewQueue(value: unknown) {
  const source = record(value, 'newQueue');

  return {
    items: list(source.items, 'newQueue').map(adaptNewQueueItem),
    total: nonNegativeInteger(source.total, 'newQueue'),
    limit: nonNegativeInteger(source.limit, 'newQueue'),
    nextCursor: nullableString(source.nextCursor, 'newQueue'),
  };
}

function adaptCompatibilityOverview(
  value: unknown,
  feature: Extract<LearningOsStudyReadFeature, 'review' | 'reviewUndo'>
) {
  const source = record(value, feature);

  const latestImport = (() => {
    if (source.latestImport === null) {
      return null;
    }

    const importJob = record(source.latestImport, feature);
    return {
      id: stringValue(importJob.id, feature),
      status: enumString(importJob.status, IMPORT_STATUSES, feature),
      sourceFilename: stringValue(importJob.sourceFilename, feature),
      deckName: stringValue(importJob.deckName, feature),
      preview: adaptImportPreview(
        importJob.preview,
        feature,
        stringValue(importJob.deckName, feature)
      ),
      uploadedAt: nullableIsoTimestamp(importJob.uploadedAt, feature),
      uploadExpiresAt: nullableIsoTimestamp(importJob.uploadExpiresAt, feature),
      sourceSizeBytes: nullableNonNegativeInteger(importJob.sourceSizeBytes, feature),
      importedAt: nullableIsoTimestamp(importJob.completedAt, feature),
      errorMessage: nullableString(importJob.errorMessage, feature),
    };
  })();

  return {
    dueCount: nonNegativeInteger(source.dueCount, feature),
    failedCount: nonNegativeInteger(source.failedCount, feature),
    newCount: nonNegativeInteger(source.newCount, feature),
    newCardsPerDay: nonNegativeInteger(source.newCardsPerDay, feature),
    newCardsIntroducedToday: nonNegativeInteger(source.newCardsIntroducedToday, feature),
    newCardsAvailableToday: nonNegativeInteger(source.newCardsAvailableToday, feature),
    learningCount: nonNegativeInteger(source.learningCount, feature),
    reviewCount: nonNegativeInteger(source.reviewCount, feature),
    suspendedCount: nonNegativeInteger(source.suspendedCount, feature),
    totalCards: nonNegativeInteger(source.totalCards, feature),
    latestImport,
    nextDueAt: nullableIsoTimestamp(source.nextDueAt, feature),
  };
}

function adaptSession(value: unknown) {
  const data = record(record(value, 'session').data, 'session');

  return {
    overview: adaptOverview({ data: data.overview }),
    cards: list(data.cards, 'session').map((card) => adaptBrowserCard(card, 'session')),
  };
}

function adaptReviewResult(value: unknown) {
  const source = record(value, 'review');
  const reviewLogId = stringValue(source.reviewLogId, 'review');
  const overview = adaptCompatibilityOverview(source.overview, 'review');

  if (source.card === null) {
    if (
      booleanValue(source.committed, 'review') !== true ||
      booleanValue(source.cardFetchFailed, 'review') !== true
    ) {
      return invalidResponse('review');
    }

    return {
      message: stringValue(source.message, 'review'),
      reviewLogId,
      committed: true,
      cardFetchFailed: true,
      card: null,
      overview,
    };
  }

  return {
    reviewLogId,
    card: adaptBrowserCard(source.card, 'review'),
    overview,
  };
}

function adaptReviewUndoResult(value: unknown) {
  const source = record(value, 'reviewUndo');

  return {
    reviewLogId: stringValue(source.reviewLogId, 'reviewUndo'),
    card: adaptBrowserCard(source.card, 'reviewUndo'),
    overview: adaptCompatibilityOverview(source.overview, 'reviewUndo'),
  };
}

export function adaptLearningOsStudyReadResponse(
  feature: LearningOsStudyReadFeature,
  value: unknown
): unknown {
  switch (feature) {
    case 'settings':
      return adaptSettings(value);
    case 'overview':
      return adaptOverview(value);
    case 'browser':
      return adaptBrowser(value);
    case 'browserDetail':
      return adaptBrowserDetail(value);
    case 'newQueue':
      return adaptNewQueue(value);
    case 'importJob':
      return adaptImportJob(value);
    case 'importCurrent':
      return adaptCurrentImport(value);
    case 'importReadiness':
      return adaptImportReadiness(value);
    case 'importSession':
      return adaptImportSession(value);
    case 'session':
      return adaptSession(value);
    case 'review':
      return adaptReviewResult(value);
    case 'reviewUndo':
      return adaptReviewUndoResult(value);
  }
}
