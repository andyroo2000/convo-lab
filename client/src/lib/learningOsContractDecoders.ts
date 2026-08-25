import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type {
  DailyAudioPractice,
  DailyAudioPracticeMode,
  DailyAudioPracticeStatusResponse,
  DailyAudioPracticeTiming,
  LessonScriptUnit,
} from '../types';
import { STUDY_ACTIVITY_CATEGORIES } from '../types/studyActivity';
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

function numericCategories(value: unknown, path: string) {
  const categories = record(value, path);
  STUDY_ACTIVITY_CATEGORIES.forEach((category) =>
    number(categories[category], `${path}.${category}`)
  );
}

export function decodeKnownKanjiResponse(value: unknown): KnownKanjiResponse {
  const response = record(value, 'known kanji');
  number(response.version, 'known kanji.version');
  array(response.kanji, 'known kanji.kanji').forEach((kanji, index) =>
    string(kanji, `known kanji.kanji[${index}]`)
  );
  array(response.manualKanji, 'known kanji.manualKanji').forEach((kanji, index) =>
    string(kanji, `known kanji.manualKanji[${index}]`)
  );

  const wanikani = record(response.wanikani, 'known kanji.wanikani');
  boolean(wanikani.connected, 'known kanji.wanikani.connected');
  nullableString(wanikani.lastSyncedAt, 'known kanji.wanikani.lastSyncedAt');
  optionalNullableNumber(wanikani.reviewCount, 'known kanji.wanikani.reviewCount');
  optionalNullableString(
    wanikani.reviewCountUpdatedAt,
    'known kanji.wanikani.reviewCountUpdatedAt'
  );

  if (wanikani.transferBridge !== undefined) {
    const transferBridge = record(wanikani.transferBridge, 'known kanji.wanikani.transferBridge');
    boolean(transferBridge.enabled, 'known kanji.wanikani.transferBridge.enabled');
    number(
      transferBridge.importedVocabularyCount,
      'known kanji.wanikani.transferBridge.importedVocabularyCount'
    );
    number(
      transferBridge.pendingVocabularyCount,
      'known kanji.wanikani.transferBridge.pendingVocabularyCount'
    );
    number(
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
  string(card.cardType, 'study card.cardType');
  record(card.prompt, 'study card.prompt');
  record(card.answer, 'study card.answer');
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

function decodeDailyAudioTiming(
  value: unknown,
  index: number,
  legacyUnitIndices: number[]
): DailyAudioPracticeTiming {
  const path = `Daily Audio timing[${index}]`;
  const timing = record(value, path);
  if ('unitIndex' in timing && 'startTime' in timing && 'endTime' in timing) {
    return {
      unitIndex: number(timing.unitIndex, `${path}.unitIndex`),
      startTime: number(timing.startTime, `${path}.startTime`),
      endTime: number(timing.endTime, `${path}.endTime`),
    };
  }
  const unitIndex = legacyUnitIndices[index];
  if (unitIndex === undefined) {
    throw new Error(`${path} has no matching script unit.`);
  }
  return {
    unitIndex,
    startTime: number(timing.startMs, `${path}.startMs`),
    endTime: number(timing.endMs, `${path}.endMs`),
  };
}

function decodeDailyAudioScriptUnit(value: unknown): LessonScriptUnit {
  const unit = record(value, 'Daily Audio script unit');
  if ('type' in unit) {
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
  const kind = string(unit.kind, 'Daily Audio script unit.kind');
  const text = string(unit.text, 'Daily Audio script unit.text');
  if (kind === 'target_language') return { type: 'L2', text, voiceId: '' };
  if (kind === 'native_language') return { type: 'narration_L1', text, voiceId: '' };
  throw new Error(`Daily Audio script unit kind ${kind} is not supported.`);
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
    const legacyUnitIndices = (scriptUnitsJson ?? []).flatMap((unit, unitIndex) =>
      unit.type === 'marker' ? [] : [unitIndex]
    );
    return {
      ...track,
      mode: mode as DailyAudioPracticeMode,
      scriptUnitsJson,
      timingData: optionalNullableArray(
        track.timingData,
        `${path}.timingData`,
        (timing, timingIndex) => decodeDailyAudioTiming(timing, timingIndex, legacyUnitIndices)
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
