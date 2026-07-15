import { AppError } from '../../middleware/errorHandler.js';

export type LearningOsStudyReadFeature = 'settings' | 'overview' | 'browser' | 'newQueue';

type JsonRecord = Record<string, unknown>;

const IMPORT_STATUSES = new Set(['pending', 'processing', 'completed', 'failed']);
const CARD_TYPES = new Set(['recognition', 'production', 'cloze']);
const QUEUE_STATES = new Set(['new', 'learning', 'review', 'relearning', 'suspended', 'buried']);
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
  const preview = adaptImportPreview(source.preview);

  return {
    id: stringValue(source.id, 'overview'),
    status: enumString(source.status, IMPORT_STATUSES, 'overview'),
    sourceFilename: stringValue(source.source_filename, 'overview'),
    deckName: stringValue(source.deck_name, 'overview'),
    preview,
    importedAt: nullableIsoTimestamp(source.completed_at, 'overview'),
    errorMessage: nullableString(source.error_message, 'overview'),
  };
}

function adaptImportPreview(value: unknown) {
  if (value === null) {
    return {
      deckName: '日本語',
      cardCount: 0,
      noteCount: 0,
      reviewLogCount: 0,
      mediaReferenceCount: 0,
      skippedMediaCount: 0,
      warnings: [],
      noteTypeBreakdown: [],
    };
  }

  const preview = record(value, 'overview');
  return {
    deckName: stringValue(preview.deckName, 'overview'),
    cardCount: nonNegativeInteger(preview.cardCount, 'overview'),
    noteCount: nonNegativeInteger(preview.noteCount, 'overview'),
    reviewLogCount: nonNegativeInteger(preview.reviewLogCount, 'overview'),
    mediaReferenceCount: nonNegativeInteger(preview.mediaReferenceCount, 'overview'),
    skippedMediaCount: nonNegativeInteger(preview.skippedMediaCount, 'overview'),
    warnings: stringList(preview.warnings, 'overview'),
    noteTypeBreakdown: list(preview.noteTypeBreakdown, 'overview').map((value) => {
      const item = record(value, 'overview');
      return {
        notetypeName: stringValue(item.notetypeName, 'overview'),
        noteCount: nonNegativeInteger(item.noteCount, 'overview'),
        cardCount: nonNegativeInteger(item.cardCount, 'overview'),
      };
    }),
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
    selectedCardId: stringValue(row.selectedCardId, 'browser'),
    displayText: stringValue(row.displayText, 'browser'),
    noteTypeName: nullableString(row.noteTypeName, 'browser'),
    sourceKind: stringValue(row.sourceKind, 'browser'),
    cardCount: nonNegativeInteger(row.cardCount, 'browser'),
    reviewCount: nonNegativeInteger(row.reviewCount, 'browser'),
    lastReviewedAt: nullableIsoTimestamp(row.lastReviewedAt, 'browser'),
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
    case 'newQueue':
      return adaptNewQueue(value);
  }
}
