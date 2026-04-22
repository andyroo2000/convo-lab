import {
  IMPORTED_STUDY_DIFFICULTY_DEFAULT,
  IMPORTED_STUDY_STABILITY_MIN,
  createStudyFsrsScheduler,
  serializeStudyFsrsCard as serializeFsrsCard,
} from '@languageflow/shared/src/studyFsrs.js';
import type {
  StudyAnswerPayload,
  StudyFsrsState,
  StudyQueueState,
} from '@languageflow/shared/src/types.js';
import { State, type Card } from 'ts-fsrs';

import { AppError } from '../../../middleware/errorHandler.js';

import { parseStudyQueueState } from './guards.js';
import { toStudyFsrsState } from './payloads.js';

export const scheduler = createStudyFsrsScheduler();
export const DEFAULT_STUDY_LIMIT = 20;

export function createFreshSchedulerState(
  due: Date = new Date(),
  state: State = State.New
): StudyFsrsState {
  return serializeFsrsCard({
    due,
    stability: IMPORTED_STUDY_STABILITY_MIN,
    difficulty: IMPORTED_STUDY_DIFFICULTY_DEFAULT,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state,
    last_review: undefined,
  });
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const lookup = (type: string) => parts.find((part) => part.type === type)?.value;

  return {
    year: Number(lookup('year')),
    month: Number(lookup('month')),
    day: Number(lookup('day')),
    hour: Number(lookup('hour')),
    minute: Number(lookup('minute')),
    second: Number(lookup('second')),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtcDate(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timeZone: string
): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const corrected = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(corrected), timeZone);
  return new Date(utcGuess - secondOffset);
}

export function assertValidStudyTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    throw new AppError('timeZone must be a valid IANA timezone.', 400);
  }
}

export function dateFromDayBoundary(
  daysFromToday: number,
  timeZone: string,
  now: Date = new Date()
): Date {
  const validTimeZone = assertValidStudyTimeZone(timeZone);
  const localNow = getTimeZoneParts(now, validTimeZone);
  const localDay = new Date(
    Date.UTC(localNow.year, localNow.month - 1, localNow.day + daysFromToday)
  );

  return zonedDateTimeToUtcDate(
    {
      year: localDay.getUTCFullYear(),
      month: localDay.getUTCMonth() + 1,
      day: localDay.getUTCDate(),
      hour: 9,
      minute: 0,
      second: 0,
    },
    validTimeZone
  );
}

export function getScheduledDaysForDue(dueAt: Date, from: Date = new Date()): number {
  return Math.max(0, Math.round((dueAt.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getRequiredSchedulerState(record: {
  schedulerStateJson: unknown;
  sourceFsrsJson?: unknown;
  dueAt: Date | null;
  queueState: string;
  sourceInterval?: number | null;
  sourceReps?: number | null;
  sourceLapses?: number | null;
  lastReviewedAt: Date | null;
}): StudyFsrsState {
  const existingState = toStudyFsrsState(record.schedulerStateJson as never);
  if (existingState) {
    return existingState;
  }

  return toSchedulerState(
    typeof record.sourceFsrsJson === 'object' && record.sourceFsrsJson !== null
      ? (record.sourceFsrsJson as Record<string, unknown>)
      : null,
    record.dueAt instanceof Date ? record.dueAt : null,
    parseStudyQueueState(record.queueState, 'new'),
    typeof record.sourceInterval === 'number' ? record.sourceInterval : 0,
    typeof record.sourceReps === 'number' ? record.sourceReps : 0,
    typeof record.sourceLapses === 'number' ? record.sourceLapses : 0,
    record.lastReviewedAt instanceof Date ? record.lastReviewedAt : null
  );
}

export function getBestAnswerAudioText(answer: StudyAnswerPayload): string | null {
  return answer.expression ?? answer.restoredText ?? answer.sentenceJp ?? answer.meaning ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toSchedulerState(
  sourceFsrs: Record<string, unknown> | null,
  dueAt: Date | null,
  queueState: StudyQueueState,
  sourceInterval: number,
  sourceReps: number,
  sourceLapses: number,
  lastReviewedAt: Date | null
): StudyFsrsState {
  const state =
    queueState === 'new'
      ? State.New
      : queueState === 'learning'
        ? State.Learning
        : queueState === 'relearning'
          ? State.Relearning
          : State.Review;

  const card: Card = {
    due: dueAt ?? new Date(),
    stability: typeof sourceFsrs?.s === 'number' ? sourceFsrs.s : Math.max(sourceInterval, 0.1),
    difficulty: clamp(typeof sourceFsrs?.d === 'number' ? sourceFsrs.d : 5, 1, 10),
    elapsed_days:
      lastReviewedAt === null
        ? 0
        : Math.max(0, Math.floor((Date.now() - lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24))),
    scheduled_days: Math.max(sourceInterval, 0),
    learning_steps: 0,
    reps: Math.max(sourceReps, 0),
    lapses: Math.max(sourceLapses, 0),
    state,
    last_review: lastReviewedAt ?? undefined,
  };

  return serializeFsrsCard(card);
}
