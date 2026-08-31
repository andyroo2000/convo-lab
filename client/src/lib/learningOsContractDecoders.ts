import type {
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyCardSummary,
  StudyClientCapabilities,
  StudyIntegerCapability,
} from '@languageflow/shared/src/types';

import type {
  DailyAudioPractice,
  DailyAudioPracticeMode,
  DailyAudioPracticeStatusResponse,
  DailyAudioPracticeTiming,
  LessonScriptUnit,
} from '../types';
import { STUDY_ACTIVITY_CATEGORIES, STUDY_ACTIVITY_KINDS } from '../types/studyActivity';
import type { StudyTimeAnalytics, StudyTimeRange } from '../types/studyActivity';
import type { GoogleCalendarConnectionStatus } from '../hooks/useGoogleCalendarConnection';
import type { KnownKanjiResponse } from '../hooks/useKnownKanji';
import type { WeeklyStudyRecap } from '../hooks/useWeeklyStudyRecap';

type JsonRecord = Record<string, unknown>;

const STUDY_TIME_RANGES: readonly StudyTimeRange[] = ['today', 'week', 'month', 'year', 'all'];
const STUDY_TIME_BUCKET_UNITS = ['hour', 'day', 'week', 'month', 'quarter', 'year'] as const;
const DAILY_AUDIO_MODES: readonly DailyAudioPracticeMode[] = [
  'drill',
  'dialogue',
  'story',
  'context',
];
const DAILY_AUDIO_PRACTICE_STATUSES = ['draft', 'generating', 'ready', 'error'] as const;
const DAILY_AUDIO_TRACK_STATUSES = ['draft', 'generating', 'ready', 'error', 'skipped'] as const;
const STUDY_CARD_CREATION_KINDS: readonly StudyCardCreationKind[] = [
  'text-recognition',
  'audio-recognition',
  'production-text',
  'production-image',
  'cloze',
];
const STUDY_CARD_IMAGE_PLACEMENTS: readonly StudyCardImagePlacement[] = [
  'none',
  'prompt',
  'answer',
  'both',
];

function record(value: unknown, path: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as JsonRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new Error(`${path} must be a string.`);
  return value;
}

function number(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  const decoded = number(value, path);
  if (!Number.isInteger(decoded) || decoded < 0) {
    throw new Error(`${path} must be a nonnegative integer.`);
  }
  return decoded;
}

function integerCapability(value: unknown, path: string): StudyIntegerCapability {
  const capability = record(value, path);
  const defaultValue = nonNegativeInteger(capability.default, `${path}.default`);
  const min = nonNegativeInteger(capability.min, `${path}.min`);
  const max = nonNegativeInteger(capability.max, `${path}.max`);
  if (min > max || defaultValue < min || defaultValue > max) {
    throw new Error(`${path} must have an ordered range containing its default.`);
  }
  return { default: defaultValue, min, max };
}

function supportedStrings<T extends string>(
  value: unknown,
  path: string,
  supported: readonly T[]
): T[] {
  return array(value, path).map((item, index) => {
    const decoded = string(item, `${path}[${index}]`);
    if (!supported.includes(decoded as T)) {
      throw new Error(`${path}[${index}] is not supported.`);
    }
    return decoded as T;
  });
}

function studyActivityCategories(
  value: unknown
): StudyClientCapabilities['studyActivity']['categoriesByActivity'] {
  const categories = record(value, 'study capabilities.studyActivity.categoriesByActivity');

  return Object.fromEntries(
    STUDY_ACTIVITY_KINDS.map((activity) => {
      const category = string(
        categories[activity],
        `study capabilities.studyActivity.categoriesByActivity.${activity}`
      );
      if (
        !STUDY_ACTIVITY_CATEGORIES.includes(category as (typeof STUDY_ACTIVITY_CATEGORIES)[number])
      ) {
        throw new Error(
          `study capabilities.studyActivity.categoriesByActivity.${activity} is not supported.`
        );
      }
      return [activity, category];
    })
  ) as StudyClientCapabilities['studyActivity']['categoriesByActivity'];
}

export function decodeStudyClientCapabilities(value: unknown): StudyClientCapabilities {
  const capabilities = record(value, 'study capabilities');
  const version = nonNegativeInteger(capabilities.version, 'study capabilities.version');
  if (version !== 1) throw new Error('study capabilities.version is not supported.');

  const settings = record(capabilities.settings, 'study capabilities.settings');
  const laneWeights = record(
    settings.newCardLaneWeights,
    'study capabilities.settings.newCardLaneWeights'
  );
  const cardAuthoring = record(capabilities.cardAuthoring, 'study capabilities.cardAuthoring');
  const limits = record(cardAuthoring.limits, 'study capabilities.cardAuthoring.limits');
  const dailyAudio = record(capabilities.dailyAudio, 'study capabilities.dailyAudio');
  const offlineReserve = record(capabilities.offlineReserve, 'study capabilities.offlineReserve');
  const imports = record(capabilities.imports, 'study capabilities.imports');
  const studyActivity = record(capabilities.studyActivity, 'study capabilities.studyActivity');
  const previewAudioRoles = supportedStrings(
    cardAuthoring.previewAudioRoles,
    'study capabilities.cardAuthoring.previewAudioRoles',
    ['prompt', 'answer'] as const
  );

  return {
    version,
    settings: {
      newCardsPerDay: integerCapability(
        settings.newCardsPerDay,
        'study capabilities.settings.newCardsPerDay'
      ),
      lessonBatchSize: integerCapability(
        settings.lessonBatchSize,
        'study capabilities.settings.lessonBatchSize'
      ),
      reviewTimeBudgetMinutes: integerCapability(
        settings.reviewTimeBudgetMinutes,
        'study capabilities.settings.reviewTimeBudgetMinutes'
      ),
      newCardLaneWeights: {
        standard: integerCapability(
          laneWeights.standard,
          'study capabilities.settings.newCardLaneWeights.standard'
        ),
        lessonFollowup: integerCapability(
          laneWeights.lessonFollowup,
          'study capabilities.settings.newCardLaneWeights.lessonFollowup'
        ),
        wanikani: integerCapability(
          laneWeights.wanikani,
          'study capabilities.settings.newCardLaneWeights.wanikani'
        ),
      },
    },
    cardAuthoring: {
      creationKinds: supportedStrings(
        cardAuthoring.creationKinds,
        'study capabilities.cardAuthoring.creationKinds',
        STUDY_CARD_CREATION_KINDS
      ),
      imagePlacements: supportedStrings(
        cardAuthoring.imagePlacements,
        'study capabilities.cardAuthoring.imagePlacements',
        STUDY_CARD_IMAGE_PLACEMENTS
      ),
      previewAudioRoles,
      defaultAnswerAudioVoiceId: string(
        cardAuthoring.defaultAnswerAudioVoiceId,
        'study capabilities.cardAuthoring.defaultAnswerAudioVoiceId'
      ),
      defaultFemaleAnswerAudioVoiceId: string(
        cardAuthoring.defaultFemaleAnswerAudioVoiceId,
        'study capabilities.cardAuthoring.defaultFemaleAnswerAudioVoiceId'
      ),
      limits: {
        combinedPayloadBytes: nonNegativeInteger(
          limits.combinedPayloadBytes,
          'study capabilities.cardAuthoring.limits.combinedPayloadBytes'
        ),
        payloadDepth: nonNegativeInteger(
          limits.payloadDepth,
          'study capabilities.cardAuthoring.limits.payloadDepth'
        ),
        imagePromptCharacters: nonNegativeInteger(
          limits.imagePromptCharacters,
          'study capabilities.cardAuthoring.limits.imagePromptCharacters'
        ),
        imageUploadBytes: nonNegativeInteger(
          limits.imageUploadBytes,
          'study capabilities.cardAuthoring.limits.imageUploadBytes'
        ),
      },
    },
    dailyAudio: {
      targetDurationMinutes: integerCapability(
        dailyAudio.targetDurationMinutes,
        'study capabilities.dailyAudio.targetDurationMinutes'
      ),
    },
    offlineReserve: {
      days: nonNegativeInteger(offlineReserve.days, 'study capabilities.offlineReserve.days'),
      maxScheduledCards: nonNegativeInteger(
        offlineReserve.maxScheduledCards,
        'study capabilities.offlineReserve.maxScheduledCards'
      ),
    },
    imports: {
      maxArchiveBytes: nonNegativeInteger(
        imports.maxArchiveBytes,
        'study capabilities.imports.maxArchiveBytes'
      ),
    },
    studyActivity: {
      categoriesByActivity: studyActivityCategories(studyActivity.categoriesByActivity),
    },
  };
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean.`);
  return value;
}

function nullableString(value: unknown, path: string): string | null {
  if (value === null) return null;
  return string(value, path);
}

function optionalNullableNumber(value: unknown, path: string): number | null | undefined {
  if (value === undefined || value === null) return value;
  return number(value, path);
}

function optionalNullableNonNegativeInteger(
  value: unknown,
  path: string
): number | null | undefined {
  if (value === undefined || value === null) return value;
  return nonNegativeInteger(value, path);
}

function optionalNullableArray<T>(
  value: unknown,
  path: string,
  decode: (item: unknown, index: number) => T
): T[] | null | undefined {
  if (value === undefined || value === null) return value;
  return array(value, path).map(decode);
}

function optionalNullableRecord(value: unknown, path: string): JsonRecord | null | undefined {
  if (value === undefined || value === null) return value;
  return record(value, path);
}

function optionalNullableString(value: unknown, path: string): string | null | undefined {
  if (value === undefined) return undefined;
  return nullableString(value, path);
}

function decodePresentationMedia(value: unknown, path: string) {
  if (value === null) return;
  const media = record(value, path);
  if (media.id !== undefined) string(media.id, `${path}.id`);
  if (media.filename !== undefined) string(media.filename, `${path}.filename`);
  if (media.url !== undefined) nullableString(media.url, `${path}.url`);
  if (media.mediaKind !== undefined) string(media.mediaKind, `${path}.mediaKind`);
  if (media.source !== undefined) string(media.source, `${path}.source`);
}

function decodePresentationText(value: unknown, path: string) {
  const text = record(value, path);
  nullableString(text.text, `${path}.text`);
  nullableString(text.ruby, `${path}.ruby`);
}

function decodeStudyCardPresentationV1(value: JsonRecord) {
  const front = record(value.front, 'study card.presentation.front');
  const mode = string(front.mode, 'study card.presentation.front.mode');
  if (!['text', 'media', 'cloze'].includes(mode)) {
    throw new Error('study card.presentation.front.mode is not supported.');
  }
  nullableString(front.text, 'study card.presentation.front.text');
  nullableString(front.ruby, 'study card.presentation.front.ruby');
  nullableString(front.hint, 'study card.presentation.front.hint');
  const frontMedia = record(front.media, 'study card.presentation.front.media');
  decodePresentationMedia(frontMedia.audio, 'study card.presentation.front.media.audio');
  decodePresentationMedia(frontMedia.image, 'study card.presentation.front.media.image');
  boolean(front.autoplayAudio, 'study card.presentation.front.autoplayAudio');

  const answer = record(value.answer, 'study card.presentation.answer');
  nullableString(answer.heading, 'study card.presentation.answer.heading');
  nullableString(answer.ruby, 'study card.presentation.answer.ruby');
  nullableString(answer.restored, 'study card.presentation.answer.restored');
  nullableString(answer.meaning, 'study card.presentation.answer.meaning');
  const sentences = record(answer.sentences, 'study card.presentation.answer.sentences');
  decodePresentationText(sentences.japanese, 'study card.presentation.answer.sentences.japanese');
  decodePresentationText(sentences.english, 'study card.presentation.answer.sentences.english');
  array(answer.notes, 'study card.presentation.answer.notes').forEach((note, index) =>
    string(note, `study card.presentation.answer.notes[${index}]`)
  );
  const answerMedia = record(answer.media, 'study card.presentation.answer.media');
  decodePresentationMedia(answerMedia.image, 'study card.presentation.answer.media.image');
  decodePresentationMedia(answer.audio, 'study card.presentation.answer.audio');
  if (answer.pitchAccent !== null) {
    const pitchAccent = record(answer.pitchAccent, 'study card.presentation.answer.pitchAccent');
    if (
      string(pitchAccent.status, 'study card.presentation.answer.pitchAccent.status') !== 'resolved'
    ) {
      throw new Error('study card.presentation.answer.pitchAccent.status must be resolved.');
    }
  }
}

function numericCategories(value: unknown, path: string) {
  const categories = record(value, path);
  STUDY_ACTIVITY_CATEGORIES.forEach((category) =>
    number(categories[category], `${path}.${category}`)
  );
}

export function decodeKnownKanjiResponse(value: unknown): KnownKanjiResponse {
  const response = record(value, 'known kanji');
  nonNegativeInteger(response.version, 'known kanji.version');
  array(response.kanji, 'known kanji.kanji').forEach((kanji, index) =>
    string(kanji, `known kanji.kanji[${index}]`)
  );
  array(response.manualKanji, 'known kanji.manualKanji').forEach((kanji, index) =>
    string(kanji, `known kanji.manualKanji[${index}]`)
  );

  const wanikani = record(response.wanikani, 'known kanji.wanikani');
  boolean(wanikani.connected, 'known kanji.wanikani.connected');
  nullableString(wanikani.lastSyncedAt, 'known kanji.wanikani.lastSyncedAt');
  optionalNullableNonNegativeInteger(wanikani.reviewCount, 'known kanji.wanikani.reviewCount');
  optionalNullableString(
    wanikani.reviewCountUpdatedAt,
    'known kanji.wanikani.reviewCountUpdatedAt'
  );

  if (wanikani.transferBridge !== undefined) {
    const transferBridge = record(wanikani.transferBridge, 'known kanji.wanikani.transferBridge');
    boolean(transferBridge.enabled, 'known kanji.wanikani.transferBridge.enabled');
    nonNegativeInteger(
      transferBridge.importedVocabularyCount,
      'known kanji.wanikani.transferBridge.importedVocabularyCount'
    );
    nonNegativeInteger(
      transferBridge.pendingVocabularyCount,
      'known kanji.wanikani.transferBridge.pendingVocabularyCount'
    );
    nonNegativeInteger(
      transferBridge.failedVocabularyCount,
      'known kanji.wanikani.transferBridge.failedVocabularyCount'
    );
    nullableString(
      transferBridge.lastImportedAt,
      'known kanji.wanikani.transferBridge.lastImportedAt'
    );
  }

  return response as unknown as KnownKanjiResponse;
}

export function decodeStudyCardSummary(value: unknown): StudyCardSummary {
  const card = record(value, 'study card');
  string(card.id, 'study card.id');
  if (card.syncId !== undefined) string(card.syncId, 'study card.syncId');
  nullableString(card.noteId, 'study card.noteId');
  nonNegativeInteger(card.revision, 'study card.revision');
  string(card.cardType, 'study card.cardType');
  record(card.prompt, 'study card.prompt');
  record(card.answer, 'study card.answer');
  if (card.presentation !== undefined && card.presentation !== null) {
    const presentation = record(card.presentation, 'study card.presentation');
    const version = nonNegativeInteger(presentation.version, 'study card.presentation.version');
    if (version === 1) {
      decodeStudyCardPresentationV1(presentation);
    } else {
      // Unknown additive versions must not prevent raw prompt/answer fallback.
      card.presentation = null;
    }
  }
  const state = record(card.state, 'study card.state');
  nullableString(state.dueAt, 'study card.state.dueAt');
  optionalNullableString(state.introducedAt, 'study card.state.introducedAt');
  optionalNullableString(state.failedAt, 'study card.state.failedAt');
  string(state.queueState, 'study card.state.queueState');
  if (state.scheduler !== null) record(state.scheduler, 'study card.state.scheduler');
  record(state.source, 'study card.state.source');
  string(card.answerAudioSource, 'study card.answerAudioSource');
  string(card.createdAt, 'study card.createdAt');
  string(card.updatedAt, 'study card.updatedAt');
  return card as unknown as StudyCardSummary;
}

export function decodeGoogleCalendarConnectionStatus(
  value: unknown
): GoogleCalendarConnectionStatus {
  const connection = record(value, 'Google Calendar connection');
  boolean(connection.connected, 'Google Calendar connection.connected');
  nullableString(connection.accountEmail, 'Google Calendar connection.accountEmail');
  array(connection.scopes, 'Google Calendar connection.scopes').forEach((scope, index) =>
    string(scope, `Google Calendar connection.scopes[${index}]`)
  );
  nullableString(connection.connectedAt, 'Google Calendar connection.connectedAt');
  nullableString(connection.lastSyncedAt, 'Google Calendar connection.lastSyncedAt');

  if (connection.settings !== null) {
    const settings = record(connection.settings, 'Google Calendar connection.settings');
    array(settings.calendarIds, 'Google Calendar connection.settings.calendarIds').forEach(
      (calendarId, index) =>
        string(calendarId, `Google Calendar connection.settings.calendarIds[${index}]`)
    );
    array(settings.titleMatchTerms, 'Google Calendar connection.settings.titleMatchTerms').forEach(
      (term, index) => string(term, `Google Calendar connection.settings.titleMatchTerms[${index}]`)
    );
    boolean(settings.syncEnabled, 'Google Calendar connection.settings.syncEnabled');
  }

  if (connection.sync !== null) {
    const sync = record(connection.sync, 'Google Calendar connection.sync');
    string(sync.status, 'Google Calendar connection.sync.status');
    nullableString(sync.errorCode, 'Google Calendar connection.sync.errorCode');
    nullableString(sync.statusAt, 'Google Calendar connection.sync.statusAt');
  }

  if (connection.nextLesson !== null && connection.nextLesson !== undefined) {
    const lesson = record(connection.nextLesson, 'Google Calendar connection.nextLesson');
    string(lesson.title, 'Google Calendar connection.nextLesson.title');
    string(lesson.startsAt, 'Google Calendar connection.nextLesson.startsAt');
    string(lesson.endsAt, 'Google Calendar connection.nextLesson.endsAt');
  }
  return connection as unknown as GoogleCalendarConnectionStatus;
}

export function decodeStudyTimeAnalytics(value: unknown): StudyTimeAnalytics {
  const analytics = record(value, 'study activity analytics');
  string(analytics.generatedAt, 'study activity analytics.generatedAt');
  string(analytics.anchorDate, 'study activity analytics.anchorDate');
  string(analytics.timezone, 'study activity analytics.timezone');
  const rangeKeys = array(analytics.ranges, 'study activity analytics.ranges').map(
    (rangeValue, rangeIndex) => {
      const path = `study activity analytics.ranges[${rangeIndex}]`;
      const range = record(rangeValue, path);
      const key = string(range.key, `${path}.key`);
      if (!STUDY_TIME_RANGES.includes(key as StudyTimeRange)) {
        throw new Error(`${path}.key is not a supported range.`);
      }
      string(range.startsAt, `${path}.startsAt`);
      string(range.endsAt, `${path}.endsAt`);
      if (range.bucketUnit !== undefined) {
        const bucketUnit = string(range.bucketUnit, `${path}.bucketUnit`);
        if (!(STUDY_TIME_BUCKET_UNITS as readonly string[]).includes(bucketUnit)) {
          throw new Error(`${path}.bucketUnit is not supported.`);
        }
      }
      if (range.bucketStep !== undefined) number(range.bucketStep, `${path}.bucketStep`);
      number(range.totalMs, `${path}.totalMs`);
      numericCategories(range.categories, `${path}.categories`);
      array(range.buckets, `${path}.buckets`).forEach((bucketValue, bucketIndex) => {
        const bucketPath = `${path}.buckets[${bucketIndex}]`;
        const bucket = record(bucketValue, bucketPath);
        string(bucket.startsAt, `${bucketPath}.startsAt`);
        string(bucket.endsAt, `${bucketPath}.endsAt`);
        number(bucket.totalMs, `${bucketPath}.totalMs`);
        numericCategories(bucket.categories, `${bucketPath}.categories`);
      });
      return key as StudyTimeRange;
    }
  );
  if (
    rangeKeys.length !== STUDY_TIME_RANGES.length ||
    STUDY_TIME_RANGES.some((expected) => !rangeKeys.includes(expected))
  ) {
    throw new Error('study activity analytics.ranges must contain each supported range once.');
  }
  return analytics as unknown as StudyTimeAnalytics;
}

function decodeDailyAudioTiming(value: unknown, index: number): DailyAudioPracticeTiming {
  const path = `Daily Audio timing[${index}]`;
  const timing = record(value, path);
  return {
    unitIndex: number(timing.unitIndex, `${path}.unitIndex`),
    startTime: number(timing.startTime, `${path}.startTime`),
    endTime: number(timing.endTime, `${path}.endTime`),
  };
}

function decodeDailyAudioScriptUnit(value: unknown): LessonScriptUnit {
  const unit = record(value, 'Daily Audio script unit');
  const type = string(unit.type, 'Daily Audio script unit.type');
  if (type === 'pause') {
    return { type, seconds: number(unit.seconds, 'Daily Audio script unit.seconds') };
  }
  if (type === 'marker') {
    return { type, label: string(unit.label, 'Daily Audio script unit.label') };
  }
  if (type === 'narration_L1') {
    return {
      type,
      text: string(unit.text, 'Daily Audio script unit.text'),
      voiceId: string(unit.voiceId, 'Daily Audio script unit.voiceId'),
    };
  }
  if (type === 'L2') {
    const decoded: Extract<LessonScriptUnit, { type: 'L2' }> = {
      type,
      text: string(unit.text, 'Daily Audio script unit.text'),
      voiceId: string(unit.voiceId, 'Daily Audio script unit.voiceId'),
    };
    if (unit.reading !== undefined)
      decoded.reading = string(unit.reading, 'Daily Audio script unit.reading');
    if (unit.translation !== undefined)
      decoded.translation = string(unit.translation, 'Daily Audio script unit.translation');
    if (unit.speed !== undefined)
      decoded.speed = number(unit.speed, 'Daily Audio script unit.speed');
    return decoded;
  }
  throw new Error(`Daily Audio script unit type ${type} is not supported.`);
}

export function decodeDailyAudioPractice(value: unknown): DailyAudioPractice {
  const practice = record(value, 'Daily Audio practice');
  string(practice.id, 'Daily Audio practice.id');
  string(practice.userId, 'Daily Audio practice.userId');
  string(practice.practiceDate, 'Daily Audio practice.practiceDate');
  const practiceStatus = string(practice.status, 'Daily Audio practice.status');
  if (!(DAILY_AUDIO_PRACTICE_STATUSES as readonly string[]).includes(practiceStatus)) {
    throw new Error('Daily Audio practice.status is not supported.');
  }
  number(practice.targetDurationMinutes, 'Daily Audio practice.targetDurationMinutes');
  string(practice.targetLanguage, 'Daily Audio practice.targetLanguage');
  string(practice.nativeLanguage, 'Daily Audio practice.nativeLanguage');
  optionalNullableString(practice.errorMessage, 'Daily Audio practice.errorMessage');
  string(practice.createdAt, 'Daily Audio practice.createdAt');
  string(practice.updatedAt, 'Daily Audio practice.updatedAt');

  const sourceCardIds = optionalNullableArray(
    practice.sourceCardIdsJson,
    'Daily Audio practice.sourceCardIdsJson',
    (cardId, index) => string(cardId, `Daily Audio practice.sourceCardIdsJson[${index}]`)
  );
  const rawSummary = optionalNullableRecord(
    practice.selectionSummaryJson,
    'Daily Audio practice.selectionSummaryJson'
  );
  let selectionSummary: DailyAudioPractice['selectionSummaryJson'];
  if (rawSummary) {
    selectionSummary = {
      totalCandidates:
        optionalNullableNumber(rawSummary.totalCandidates, 'selection totalCandidates') ??
        undefined,
      totalEligible:
        optionalNullableNumber(rawSummary.totalEligible, 'selection totalEligible') ?? undefined,
      selectedCount:
        optionalNullableNumber(rawSummary.selectedCount, 'selection selectedCount') ?? undefined,
      dueCount: optionalNullableNumber(rawSummary.dueCount, 'selection dueCount') ?? undefined,
      learningCount:
        optionalNullableNumber(rawSummary.learningCount, 'selection learningCount') ?? undefined,
      recentMissCount:
        optionalNullableNumber(rawSummary.recentMissCount, 'selection recentMissCount') ??
        undefined,
    };
  } else {
    selectionSummary = rawSummary;
  }

  const tracks = array(practice.tracks, 'Daily Audio practice.tracks').map((trackValue, index) => {
    const path = `Daily Audio practice.tracks[${index}]`;
    const track = record(trackValue, path);
    string(track.id, `${path}.id`);
    string(track.practiceId, `${path}.practiceId`);
    const mode = string(track.mode, `${path}.mode`);
    if (!DAILY_AUDIO_MODES.includes(mode as DailyAudioPracticeMode)) {
      throw new Error(`${path}.mode is not supported.`);
    }
    const status = string(track.status, `${path}.status`);
    if (!(DAILY_AUDIO_TRACK_STATUSES as readonly string[]).includes(status)) {
      throw new Error(`${path}.status is not supported.`);
    }
    string(track.title, `${path}.title`);
    number(track.sortOrder, `${path}.sortOrder`);
    optionalNullableString(track.audioUrl, `${path}.audioUrl`);
    optionalNullableNumber(track.approxDurationSeconds, `${path}.approxDurationSeconds`);
    if (track.generationMetadataJson !== undefined && track.generationMetadataJson !== null) {
      record(track.generationMetadataJson, `${path}.generationMetadataJson`);
    }
    optionalNullableString(track.errorMessage, `${path}.errorMessage`);
    string(track.createdAt, `${path}.createdAt`);
    string(track.updatedAt, `${path}.updatedAt`);
    const scriptUnitsJson = optionalNullableArray(
      track.scriptUnitsJson,
      `${path}.scriptUnitsJson`,
      decodeDailyAudioScriptUnit
    );
    return {
      ...track,
      mode: mode as DailyAudioPracticeMode,
      scriptUnitsJson,
      timingData: optionalNullableArray(
        track.timingData,
        `${path}.timingData`,
        decodeDailyAudioTiming
      ),
    };
  });

  return {
    ...(practice as unknown as DailyAudioPractice),
    sourceCardIdsJson: sourceCardIds,
    selectionSummaryJson: selectionSummary,
    tracks: tracks as DailyAudioPractice['tracks'],
  };
}

export function decodeDailyAudioPracticeStatus(value: unknown): DailyAudioPracticeStatusResponse {
  const response = record(value, 'Daily Audio practice status');
  string(response.id, 'Daily Audio practice status.id');
  const status = string(response.status, 'Daily Audio practice status.status');
  if (!(DAILY_AUDIO_PRACTICE_STATUSES as readonly string[]).includes(status)) {
    throw new Error('Daily Audio practice status.status is not supported.');
  }
  if (response.progress !== null) number(response.progress, 'Daily Audio practice status.progress');
  array(response.tracks, 'Daily Audio practice status.tracks').forEach((trackValue, index) => {
    const path = `Daily Audio practice status.tracks[${index}]`;
    const track = record(trackValue, path);
    string(track.id, `${path}.id`);
    const mode = string(track.mode, `${path}.mode`);
    if (!DAILY_AUDIO_MODES.includes(mode as DailyAudioPracticeMode)) {
      throw new Error(`${path}.mode is not supported.`);
    }
    const trackStatus = string(track.status, `${path}.status`);
    if (!(DAILY_AUDIO_TRACK_STATUSES as readonly string[]).includes(trackStatus)) {
      throw new Error(`${path}.status is not supported.`);
    }
    optionalNullableString(track.audioUrl, `${path}.audioUrl`);
    optionalNullableNumber(track.approxDurationSeconds, `${path}.approxDurationSeconds`);
  });
  return response as unknown as DailyAudioPracticeStatusResponse;
}

function decodeWeeklyStats(value: unknown, path: string) {
  const stats = record(value, path);
  number(stats.totalMs, `${path}.totalMs`);
  number(stats.activeDays, `${path}.activeDays`);
  number(stats.reviewCount, `${path}.reviewCount`);
  if (stats.recallRate !== null) number(stats.recallRate, `${path}.recallRate`);
  number(stats.newCardsIntroduced, `${path}.newCardsIntroduced`);
  return stats;
}

export function decodeWeeklyStudyRecap(value: unknown): WeeklyStudyRecap {
  const recap = record(value, 'weekly study recap');
  string(recap.generatedAt, 'weekly study recap.generatedAt');
  const week = decodeWeeklyStats(recap.week, 'weekly study recap.week');
  string(week.startsAt, 'weekly study recap.week.startsAt');
  string(week.endsAt, 'weekly study recap.week.endsAt');
  numericCategories(week.categories, 'weekly study recap.week.categories');
  if (week.bestDay !== null) {
    const bestDay = record(week.bestDay, 'weekly study recap.week.bestDay');
    string(bestDay.date, 'weekly study recap.week.bestDay.date');
    number(bestDay.totalMs, 'weekly study recap.week.bestDay.totalMs');
  }
  decodeWeeklyStats(recap.previousWeek, 'weekly study recap.previousWeek');
  return recap as unknown as WeeklyStudyRecap;
}
