import {
  STUDY_NEW_CARDS_PER_DAY_DEFAULT,
  STUDY_NEW_CARDS_PER_DAY_MAX,
  STUDY_NEW_CARD_QUEUE_PAGE_SIZE_DEFAULT,
  STUDY_NEW_CARD_QUEUE_PAGE_SIZE_MAX,
} from '@languageflow/shared/src/studyConstants.js';
import {
  serializeStudyFsrsCard as serializeFsrsCard,
  deserializeStudyFsrsCard as deserializeFsrsCard,
} from '@languageflow/shared/src/studyFsrs.js';
import type {
  StudyCardActionResult,
  StudyCardSetDueMode,
  StudyCardSummary,
  StudyFsrsState,
  StudyOverview,
  StudyPromptPayload,
  StudyQueueState,
  StudyAnswerPayload,
  StudyNewCardQueueItem,
  StudyNewCardQueueResponse,
  StudyReviewResult,
  StudySettings,
  StudyUndoReviewResult,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';
import { State, Rating, type Grade } from 'ts-fsrs';

import { prisma } from '../../db/client.js';
import { AppError } from '../../middleware/errorHandler.js';

import { ensureGeneratedAnswerAudio, ensureStudyCardMediaAvailable } from './media.js';
import type {
  CreateStudyCardInput,
  PerformStudyCardActionInput,
  StudyCardWithRelations,
  UpdateStudyCardInput,
} from './shared.js';
import {
  assertValidStudyTimeZone,
  buildStudyCardSearchText,
  createFreshSchedulerState,
  dateFromLocalDayStart,
  dateFromDayBoundary,
  getBestAnswerAudioText,
  getRequiredSchedulerState,
  getScheduledDaysForDue,
  normalizeClozePayload,
  normalizeStudyCardPayload,
  parseStudyImportStatus,
  parseStudyCardType,
  parseStudyQueueState,
  scheduler,
  STUDY_SESSION_EAGER_MEDIA_CARD_LIMIT,
  STUDY_SESSION_READY_CARD_LIMIT,
  toConvolabReviewRawPayload,
  toPrismaJson,
  toStudyCardSummary,
  toStudyFsrsState,
  toStudyImportPreview,
} from './shared.js';

const ACTIVE_DUE_QUEUE_STATES = ['learning', 'review', 'relearning'] as const;
const STUDY_CARD_SUMMARY_INCLUDE = {
  note: true,
  promptAudioMedia: true,
  answerAudioMedia: true,
  imageMedia: true,
} satisfies Prisma.StudyCardInclude;
const NEW_CARD_QUEUE_ORDER = [
  { newQueuePosition: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.StudyCardOrderByWithRelationInput[];
const DUE_CARD_ORDER = [
  { dueAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.StudyCardOrderByWithRelationInput[];

function isActiveDueQueueState(queueState: StudyQueueState): boolean {
  return ACTIVE_DUE_QUEUE_STATES.includes(queueState as (typeof ACTIVE_DUE_QUEUE_STATES)[number]);
}

function getStudyDayWindow(timeZone?: string, now: Date = new Date()) {
  const resolvedTimeZone = timeZone ? assertValidStudyTimeZone(timeZone) : 'UTC';

  return {
    start: dateFromLocalDayStart(0, resolvedTimeZone, now),
    end: dateFromLocalDayStart(1, resolvedTimeZone, now),
    timeZone: resolvedTimeZone,
  };
}

function assertValidNewCardsPerDay(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > STUDY_NEW_CARDS_PER_DAY_MAX) {
    throw new AppError(
      `newCardsPerDay must be an integer between 0 and ${String(STUDY_NEW_CARDS_PER_DAY_MAX)}.`,
      400
    );
  }

  return value;
}

export async function getStudySettings(userId: string): Promise<StudySettings> {
  const settings = await prisma.studySettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    },
  });

  return {
    newCardsPerDay: settings.newCardsPerDay,
  };
}

export async function updateStudySettings(params: {
  userId: string;
  newCardsPerDay: number;
}): Promise<StudySettings> {
  const newCardsPerDay = assertValidNewCardsPerDay(params.newCardsPerDay);
  const settings = await prisma.studySettings.upsert({
    where: { userId: params.userId },
    update: { newCardsPerDay },
    create: {
      userId: params.userId,
      newCardsPerDay,
    },
  });

  return {
    newCardsPerDay: settings.newCardsPerDay,
  };
}

async function getNextNewQueuePosition(userId: string): Promise<number> {
  const aggregate = await prisma.studyCard.aggregate({
    where: {
      userId,
      queueState: 'new',
    },
    _max: {
      newQueuePosition: true,
    },
  });

  return (aggregate._max.newQueuePosition ?? 0) + 1;
}

function parseQueueCursor(cursor?: string): number {
  if (!cursor) return 0;
  if (!/^\d+$/.test(cursor)) {
    throw new AppError('cursor must be a non-negative integer.', 400);
  }

  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AppError('cursor must be a non-negative integer.', 400);
  }

  return parsed;
}

function clampNewQueueLimit(limit?: number): number {
  if (typeof limit === 'undefined') return STUDY_NEW_CARD_QUEUE_PAGE_SIZE_DEFAULT;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > STUDY_NEW_CARD_QUEUE_PAGE_SIZE_MAX) {
    throw new AppError(
      `limit must be an integer between 1 and ${String(STUDY_NEW_CARD_QUEUE_PAGE_SIZE_MAX)}.`,
      400
    );
  }

  return limit;
}

function getStringField(payload: Prisma.JsonValue, ...keys: string[]): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  for (const key of keys) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function toNewCardQueueItem(record: {
  id: string;
  noteId: string;
  cardType: string;
  promptJson: Prisma.JsonValue;
  answerJson: Prisma.JsonValue;
  newQueuePosition: number | null;
  createdAt: Date;
  updatedAt: Date;
}): StudyNewCardQueueItem {
  const displayText =
    getStringField(record.promptJson, 'cueText', 'clozeDisplayText', 'clozeText') ??
    getStringField(record.answerJson, 'expression', 'restoredText', 'meaning') ??
    'Untitled card';
  const meaning =
    getStringField(record.answerJson, 'meaning', 'sentenceEn') ??
    getStringField(record.promptJson, 'cueMeaning');

  return {
    id: record.id,
    noteId: record.noteId,
    cardType: parseStudyCardType(record.cardType),
    displayText,
    meaning,
    queuePosition: record.newQueuePosition,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getStudyNewCardQueue(params: {
  userId: string;
  cursor?: string;
  limit?: number;
  q?: string;
}): Promise<StudyNewCardQueueResponse> {
  const offset = parseQueueCursor(params.cursor);
  const limit = clampNewQueueLimit(params.limit);
  const query = params.q?.trim();
  const where: Prisma.StudyCardWhereInput = {
    userId: params.userId,
    queueState: 'new',
    ...(query
      ? {
          searchText: {
            contains: query,
            mode: 'insensitive',
          },
        }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.studyCard.count({ where }),
    prisma.studyCard.findMany({
      where,
      select: {
        id: true,
        noteId: true,
        cardType: true,
        promptJson: true,
        answerJson: true,
        newQueuePosition: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ newQueuePosition: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit,
    }),
  ]);
  const nextOffset = offset + items.length;

  return {
    items: items.map(toNewCardQueueItem),
    total,
    limit,
    nextCursor: nextOffset < total ? String(nextOffset) : null,
  };
}

export async function reorderStudyNewCardQueue(params: {
  userId: string;
  cardIds: string[];
}): Promise<StudyNewCardQueueResponse> {
  if (params.cardIds.length === 0 || params.cardIds.length > STUDY_NEW_CARD_QUEUE_PAGE_SIZE_MAX) {
    throw new AppError(
      `cardIds must include between 1 and ${String(STUDY_NEW_CARD_QUEUE_PAGE_SIZE_MAX)} cards.`,
      400
    );
  }

  const uniqueIds = new Set(params.cardIds);
  if (uniqueIds.size !== params.cardIds.length) {
    throw new AppError('cardIds must not contain duplicates.', 400);
  }

  const existingCards = await prisma.studyCard.findMany({
    where: {
      userId: params.userId,
      queueState: 'new',
      id: {
        in: params.cardIds,
      },
    },
    select: {
      id: true,
      newQueuePosition: true,
    },
    orderBy: [{ newQueuePosition: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });

  if (existingCards.length !== params.cardIds.length) {
    throw new AppError('Every reordered card must be an active new card owned by the user.', 400);
  }

  const positions = existingCards.map((card, index) => card.newQueuePosition ?? index + 1);
  await prisma.$transaction(
    params.cardIds.map((cardId, index) =>
      prisma.studyCard.updateMany({
        where: {
          id: cardId,
          userId: params.userId,
          queueState: 'new',
        },
        data: {
          newQueuePosition: positions[index],
        },
      })
    )
  );

  return getStudyNewCardQueue({
    userId: params.userId,
    limit: STUDY_NEW_CARD_QUEUE_PAGE_SIZE_DEFAULT,
  });
}

export async function getStudyOverview(userId: string, timeZone?: string): Promise<StudyOverview> {
  const now = new Date();
  const dayWindow = getStudyDayWindow(timeZone, now);
  const [settings, introducedToday, cardOverviewRows, latestImport] = await Promise.all([
    getStudySettings(userId),
    prisma.studyCard.count({
      where: {
        userId,
        introducedAt: {
          gte: dayWindow.start,
          lt: dayWindow.end,
        },
      },
    }),
    // Keep overview card work to one aggregate query; hot mutation paths update cached
    // counts incrementally, and the initial load only needs this summary plus latest import.
    prisma.$queryRaw<
      Array<{
        due_count: bigint | number | null;
        new_count: bigint | number | null;
        learning_count: bigint | number | null;
        review_count: bigint | number | null;
        suspended_count: bigint | number | null;
        total_cards: bigint | number | null;
        next_due_at: Date | null;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(SUM(CASE
          WHEN "queueState" IN ('learning', 'review', 'relearning') AND "dueAt" <= ${now} THEN 1
          ELSE 0
        END), 0) AS due_count,
        COALESCE(SUM(CASE WHEN "queueState" = 'new' THEN 1 ELSE 0 END), 0) AS new_count,
        COALESCE(SUM(CASE WHEN "queueState" IN ('learning', 'relearning') THEN 1 ELSE 0 END), 0) AS learning_count,
        COALESCE(SUM(CASE WHEN "queueState" = 'review' THEN 1 ELSE 0 END), 0) AS review_count,
        COALESCE(SUM(CASE WHEN "queueState" IN ('suspended', 'buried') THEN 1 ELSE 0 END), 0) AS suspended_count,
        COUNT(*) AS total_cards,
        MIN(CASE
          WHEN "queueState" IN ('learning', 'review', 'relearning') THEN "dueAt"
          ELSE NULL
        END) AS next_due_at
      FROM "study_cards"
      WHERE "userId" = ${userId}
    `),
    prisma.studyImportJob.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const cardOverview = cardOverviewRows[0] ?? {
    due_count: 0,
    new_count: 0,
    learning_count: 0,
    review_count: 0,
    suspended_count: 0,
    total_cards: 0,
    next_due_at: null,
  };
  const toCount = (value: bigint | number | null | undefined): number => Number(value ?? 0);
  const newCount = toCount(cardOverview.new_count);
  const newCardsAvailableToday = Math.min(
    newCount,
    Math.max(0, settings.newCardsPerDay - introducedToday)
  );

  return {
    dueCount: toCount(cardOverview.due_count),
    newCount,
    newCardsPerDay: settings.newCardsPerDay,
    newCardsIntroducedToday: introducedToday,
    newCardsAvailableToday,
    learningCount: toCount(cardOverview.learning_count),
    reviewCount: toCount(cardOverview.review_count),
    suspendedCount: toCount(cardOverview.suspended_count),
    totalCards: toCount(cardOverview.total_cards),
    latestImport: latestImport
      ? {
          id: latestImport.id,
          status: parseStudyImportStatus(latestImport.status),
          sourceFilename: latestImport.sourceFilename,
          deckName: latestImport.deckName,
          preview: toStudyImportPreview(latestImport.previewJson),
          importedAt:
            latestImport.completedAt instanceof Date
              ? latestImport.completedAt.toISOString()
              : null,
          errorMessage:
            typeof latestImport.errorMessage === 'string'
              ? String(latestImport.errorMessage)
              : null,
        }
      : null,
    nextDueAt:
      cardOverview.next_due_at instanceof Date ? cardOverview.next_due_at.toISOString() : null,
  };
}

interface StudyOverviewMutationCardLike {
  queueState: StudyQueueState;
  dueAt: Date | null;
}

function getStudyOverviewBucket(
  queueState: StudyQueueState
): 'newCount' | 'learningCount' | 'reviewCount' | 'suspendedCount' {
  if (queueState === 'new') {
    return 'newCount';
  }

  if (queueState === 'learning' || queueState === 'relearning') {
    return 'learningCount';
  }

  if (queueState === 'review') {
    return 'reviewCount';
  }

  return 'suspendedCount';
}

function countsAsDue(card: StudyOverviewMutationCardLike, now: Date): boolean {
  if (!card.dueAt) {
    return false;
  }

  return isActiveDueQueueState(card.queueState) && card.dueAt.getTime() <= now.getTime();
}

function countsAsNextDueCandidate(card: StudyOverviewMutationCardLike): boolean {
  return isActiveDueQueueState(card.queueState) && Boolean(card.dueAt);
}

function getOverviewMutationCard(record: {
  queueState: string;
  dueAt: Date | null;
}): StudyOverviewMutationCardLike {
  return {
    queueState: parseStudyQueueState(record.queueState),
    dueAt: record.dueAt instanceof Date ? record.dueAt : null,
  };
}

async function getNextDueAtForOverview(userId: string): Promise<string | null> {
  const nextDueCard = await prisma.studyCard.findFirst({
    where: {
      userId,
      queueState: {
        in: ['learning', 'review', 'relearning'],
      },
      dueAt: {
        not: null,
      },
    },
    orderBy: {
      dueAt: 'asc',
    },
    select: {
      dueAt: true,
    },
  });

  return nextDueCard?.dueAt instanceof Date ? nextDueCard.dueAt.toISOString() : null;
}

async function getAdjustedStudyOverview(
  userId: string,
  currentOverview: StudyOverview,
  previousCard: StudyOverviewMutationCardLike,
  nextCard: StudyOverviewMutationCardLike
): Promise<StudyOverview> {
  const now = new Date();
  const nextOverview: StudyOverview = {
    ...currentOverview,
    latestImport: currentOverview.latestImport ?? null,
    nextDueAt: currentOverview.nextDueAt ?? null,
  };

  const previousBucket = getStudyOverviewBucket(previousCard.queueState);
  const nextBucket = getStudyOverviewBucket(nextCard.queueState);

  if (previousBucket !== nextBucket) {
    nextOverview[previousBucket] = Math.max(0, nextOverview[previousBucket] - 1);
    nextOverview[nextBucket] += 1;
  }

  nextOverview.totalCards =
    nextOverview.newCount +
    nextOverview.learningCount +
    nextOverview.reviewCount +
    nextOverview.suspendedCount;

  const previousCountedAsDue = countsAsDue(previousCard, now);
  const nextCountedAsDue = countsAsDue(nextCard, now);

  if (previousCountedAsDue !== nextCountedAsDue) {
    nextOverview.dueCount = Math.max(0, nextOverview.dueCount + (nextCountedAsDue ? 1 : -1));
  }

  const currentNextDueAt =
    typeof currentOverview.nextDueAt === 'string' ? new Date(currentOverview.nextDueAt) : null;
  const currentNextDueMs =
    currentNextDueAt && !Number.isNaN(currentNextDueAt.getTime())
      ? currentNextDueAt.getTime()
      : null;
  const previousDueMs = previousCard.dueAt?.getTime() ?? null;
  const nextDueMs = nextCard.dueAt?.getTime() ?? null;

  if (currentNextDueMs === null) {
    nextOverview.nextDueAt = countsAsNextDueCandidate(nextCard)
      ? (nextCard.dueAt?.toISOString() ?? null)
      : null;
    return nextOverview;
  }

  if (countsAsNextDueCandidate(nextCard) && nextDueMs !== null && nextDueMs < currentNextDueMs) {
    nextOverview.nextDueAt = nextCard.dueAt?.toISOString() ?? null;
    return nextOverview;
  }

  if (
    countsAsNextDueCandidate(previousCard) &&
    previousDueMs === currentNextDueMs &&
    nextDueMs !== currentNextDueMs
  ) {
    nextOverview.nextDueAt = await getNextDueAtForOverview(userId);
    return nextOverview;
  }

  return nextOverview;
}

function toQueueStateFromFsrsState(state: number): StudyQueueState {
  return state === State.New
    ? 'new'
    : state === State.Learning
      ? 'learning'
      : state === State.Relearning
        ? 'relearning'
        : 'review';
}

function getRestoredQueueState(record: StudyCardWithRelations): StudyQueueState {
  const schedulerState = deserializeFsrsCard(getRequiredSchedulerState(record));
  if (schedulerState) {
    return toQueueStateFromFsrsState(schedulerState.state);
  }

  const currentQueueState = parseStudyQueueState(record.queueState);
  return currentQueueState === 'suspended' || currentQueueState === 'buried'
    ? 'review'
    : currentQueueState;
}

function getRestoredDueAt(
  record: StudyCardWithRelations,
  queueState: StudyQueueState
): Date | null {
  if (queueState === 'new') return null;

  const schedulerState = deserializeFsrsCard(getRequiredSchedulerState(record));
  if (schedulerState) {
    return schedulerState.due;
  }

  return record.dueAt instanceof Date ? record.dueAt : new Date();
}

function resolveDueDate(mode: StudyCardSetDueMode, dueAt?: string, timeZone?: string): Date {
  if (mode === 'now') {
    return new Date();
  }

  if (mode === 'tomorrow') {
    if (!timeZone) {
      throw new AppError('A valid IANA timezone is required for tomorrow.', 400);
    }

    return dateFromDayBoundary(1, assertValidStudyTimeZone(timeZone));
  }

  const customDueAt = dueAt ? new Date(dueAt) : null;
  if (!customDueAt || Number.isNaN(customDueAt.getTime())) {
    throw new AppError('A valid due date is required for custom_date.', 400);
  }

  return customDueAt;
}

function getSetDueSchedulerState(record: StudyCardWithRelations, dueAt: Date): StudyFsrsState {
  const existingScheduler = deserializeFsrsCard(getRequiredSchedulerState(record));
  const now = new Date();

  if (existingScheduler && existingScheduler.state !== State.New) {
    return serializeFsrsCard({
      ...existingScheduler,
      due: dueAt,
      scheduled_days: getScheduledDaysForDue(dueAt, now),
    });
  }

  const freshReviewState = deserializeFsrsCard(createFreshSchedulerState(dueAt, State.Review));
  if (!freshReviewState) {
    throw new AppError('Unable to create scheduler state for due override.', 500);
  }

  return serializeFsrsCard({
    ...freshReviewState,
    due: dueAt,
    scheduled_days: getScheduledDaysForDue(dueAt, now),
  });
}

function getRemainingNewCardAllowance(settings: StudySettings, introducedToday: number): number {
  return Math.max(0, settings.newCardsPerDay - introducedToday);
}

function getNewCardLimitForSession(remainingNewAllowance: number): number {
  return Math.min(STUDY_SESSION_READY_CARD_LIMIT, remainingNewAllowance);
}

function getDueCardLimitForSession(newCardCount: number): number {
  return Math.max(0, STUDY_SESSION_READY_CARD_LIMIT - newCardCount);
}

async function fetchQueuedNewStudyCards(
  userId: string,
  limit: number
): Promise<StudyCardWithRelations[]> {
  if (limit <= 0) {
    return [];
  }

  return prisma.studyCard.findMany({
    where: {
      userId,
      queueState: 'new',
    },
    include: STUDY_CARD_SUMMARY_INCLUDE,
    orderBy: NEW_CARD_QUEUE_ORDER,
    take: limit,
  });
}

async function fetchDueStudyCards(
  userId: string,
  now: Date,
  limit: number
): Promise<StudyCardWithRelations[]> {
  if (limit <= 0) {
    return [];
  }

  return prisma.studyCard.findMany({
    where: {
      userId,
      queueState: {
        in: [...ACTIVE_DUE_QUEUE_STATES],
      },
      dueAt: {
        lte: now,
      },
    },
    include: STUDY_CARD_SUMMARY_INCLUDE,
    orderBy: DUE_CARD_ORDER,
    take: limit,
  });
}

export async function startStudySession(userId: string, options: { timeZone?: string } = {}) {
  const now = new Date();
  const dayWindow = getStudyDayWindow(options.timeZone, now);
  const [settings, introducedToday] = await Promise.all([
    getStudySettings(userId),
    prisma.studyCard.count({
      where: {
        userId,
        introducedAt: {
          gte: dayWindow.start,
          lt: dayWindow.end,
        },
      },
    }),
  ]);

  const remainingNewAllowance = getRemainingNewCardAllowance(settings, introducedToday);
  const newCards = await fetchQueuedNewStudyCards(
    userId,
    getNewCardLimitForSession(remainingNewAllowance)
  );
  const dueCards = await fetchDueStudyCards(
    userId,
    now,
    getDueCardLimitForSession(newCards.length)
  );
  const cards = [...dueCards, ...newCards];

  await ensureStudyCardMediaAvailable(cards.slice(0, STUDY_SESSION_EAGER_MEDIA_CARD_LIMIT));

  return {
    overview: await getStudyOverview(userId, options.timeZone),
    cards: await Promise.all(cards.map((card) => toStudyCardSummary(card))),
  };
}

export async function recordStudyReview(params: {
  userId: string;
  cardId: string;
  grade: 'again' | 'hard' | 'good' | 'easy';
  durationMs?: number;
  timeZone?: string;
  currentOverview?: StudyOverview;
}): Promise<StudyReviewResult> {
  const gradeToRating: Record<typeof params.grade, Grade> = {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
    easy: Rating.Easy,
  };

  const card: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: params.cardId,
      userId: params.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!card) {
    throw new AppError('Study card not found.', 404);
  }

  const previousState = deserializeFsrsCard(getRequiredSchedulerState(card));
  if (!previousState) {
    throw new AppError('Study card is missing scheduler state.', 400);
  }

  const now = new Date();
  const nextState = scheduler.next(previousState, now, gradeToRating[params.grade]).card;
  const serializedNextState = serializeFsrsCard(nextState);
  const nextQueueState = toQueueStateFromFsrsState(nextState.state);
  const wasIntroducedNow =
    parseStudyQueueState(card.queueState) === 'new' && !(card.introducedAt instanceof Date);
  const createdReviewLog = await prisma.$transaction(async (tx) => {
    const updatedCard = await tx.studyCard.updateMany({
      where: { id: params.cardId, userId: params.userId },
      data: {
        schedulerStateJson: toPrismaJson(serializedNextState),
        queueState: nextQueueState,
        dueAt: nextState.due,
        lastReviewedAt: now,
        introducedAt: wasIntroducedNow ? now : undefined,
      },
    });

    if (updatedCard.count !== 1) {
      throw new AppError('Study card not found.', 404);
    }

    return tx.studyReviewLog.create({
      data: {
        userId: params.userId,
        cardId: params.cardId,
        source: 'convolab',
        reviewedAt: now,
        rating: gradeToRating[params.grade],
        durationMs: params.durationMs ?? null,
        stateBeforeJson: toPrismaJson(serializeFsrsCard(previousState)),
        stateAfterJson: toPrismaJson(serializedNextState),
        rawPayloadJson: toConvolabReviewRawPayload({
          grade: params.grade,
          beforeQueueState: String(card.queueState),
          beforeDueAt: card.dueAt instanceof Date ? card.dueAt.toISOString() : null,
          beforeIntroducedAt:
            card.introducedAt instanceof Date ? card.introducedAt.toISOString() : null,
          beforeLastReviewedAt:
            card.lastReviewedAt instanceof Date ? card.lastReviewedAt.toISOString() : null,
        }),
      },
    });
  });

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: params.cardId,
      userId: params.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after review.', 404);
  }

  const overview =
    params.currentOverview && parseStudyQueueState(card.queueState) !== 'new'
      ? await getAdjustedStudyOverview(
          params.userId,
          params.currentOverview,
          getOverviewMutationCard(card),
          getOverviewMutationCard(refreshed)
        )
      : await getStudyOverview(params.userId, params.timeZone);

  return {
    reviewLogId: createdReviewLog.id,
    card: await toStudyCardSummary(refreshed),
    overview,
  };
}

export async function undoStudyReview(params: {
  userId: string;
  reviewLogId: string;
  currentOverview?: StudyOverview;
}): Promise<StudyUndoReviewResult> {
  const reviewLog = await prisma.studyReviewLog.findFirst({
    where: {
      id: params.reviewLogId,
      userId: params.userId,
      source: 'convolab',
    },
    include: {
      card: {
        include: {
          note: true,
        },
      },
    },
  });

  if (!reviewLog) {
    throw new AppError('Undo target not found.', 404);
  }

  const cardRecord = reviewLog.card;
  if (!cardRecord) {
    throw new AppError('Study card not found for undo.', 404);
  }

  const newerReview = await prisma.studyReviewLog.findFirst({
    where: {
      userId: params.userId,
      cardId: String(reviewLog.cardId),
      source: 'convolab',
      OR: [
        {
          reviewedAt: {
            gt: reviewLog.reviewedAt as Date,
          },
        },
        {
          reviewedAt: reviewLog.reviewedAt as Date,
          id: {
            gt: reviewLog.id,
          },
        },
      ],
    },
  });

  if (newerReview) {
    throw new AppError('Only the latest review for this card can be undone.', 409);
  }

  const previousState = deserializeFsrsCard(toStudyFsrsState(reviewLog.stateBeforeJson));
  if (!previousState) {
    throw new AppError('Undo state is missing for this review.', 400);
  }

  const rawPayload =
    reviewLog.rawPayloadJson && typeof reviewLog.rawPayloadJson === 'object'
      ? (reviewLog.rawPayloadJson as Record<string, unknown>)
      : {};
  const restoredQueueState =
    typeof rawPayload.beforeQueueState === 'string'
      ? parseStudyQueueState(rawPayload.beforeQueueState)
      : toQueueStateFromFsrsState(previousState.state);
  const restoredDueAt =
    typeof rawPayload.beforeDueAt === 'string'
      ? new Date(rawPayload.beforeDueAt)
      : restoredQueueState === 'new'
        ? null
        : previousState.due;
  const restoredLastReviewedAt =
    typeof rawPayload.beforeLastReviewedAt === 'string'
      ? new Date(rawPayload.beforeLastReviewedAt)
      : (previousState.last_review ?? null);
  const restoredIntroducedAt =
    typeof rawPayload.beforeIntroducedAt === 'string'
      ? new Date(rawPayload.beforeIntroducedAt)
      : restoredQueueState === 'new'
        ? null
        : cardRecord.introducedAt;

  await prisma.$transaction(async (tx) => {
    const updatedCard = await tx.studyCard.updateMany({
      where: { id: String(reviewLog.cardId), userId: params.userId },
      data: {
        schedulerStateJson: toPrismaJson(serializeFsrsCard(previousState)),
        queueState: restoredQueueState,
        dueAt: restoredDueAt,
        introducedAt: restoredIntroducedAt,
        lastReviewedAt: restoredLastReviewedAt,
      },
    });

    if (updatedCard.count !== 1) {
      throw new AppError('Study card not found.', 404);
    }

    await tx.studyReviewLog.delete({
      where: { id: params.reviewLogId },
    });
  });

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: reviewLog.cardId,
      userId: params.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after undo.', 404);
  }

  const overview =
    params.currentOverview && restoredQueueState !== 'new'
      ? await getAdjustedStudyOverview(
          params.userId,
          params.currentOverview,
          getOverviewMutationCard(cardRecord),
          getOverviewMutationCard(refreshed)
        )
      : await getStudyOverview(params.userId);

  return {
    reviewLogId: params.reviewLogId,
    card: await toStudyCardSummary(refreshed),
    overview,
  };
}

export async function performStudyCardAction(
  input: PerformStudyCardActionInput
): Promise<StudyCardActionResult> {
  const existing: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!existing) {
    throw new AppError('Study card not found.', 404);
  }

  let nextQueueState = parseStudyQueueState(existing.queueState);
  let nextDueAt = existing.dueAt instanceof Date ? existing.dueAt : null;
  let nextSchedulerState = getRequiredSchedulerState(existing);
  let nextLastReviewedAt = existing.lastReviewedAt instanceof Date ? existing.lastReviewedAt : null;
  let nextIntroducedAt = existing.introducedAt instanceof Date ? existing.introducedAt : null;
  let nextNewQueuePosition =
    typeof existing.newQueuePosition === 'number' ? existing.newQueuePosition : null;

  if (input.action === 'suspend') {
    nextQueueState = 'suspended';
  } else if (input.action === 'unsuspend') {
    nextQueueState = getRestoredQueueState(existing);
    nextDueAt = getRestoredDueAt(existing, nextQueueState);
  } else if (input.action === 'forget') {
    nextQueueState = 'new';
    nextDueAt = null;
    nextSchedulerState = createFreshSchedulerState();
    nextLastReviewedAt = null;
    nextIntroducedAt = null;
    nextNewQueuePosition = await getNextNewQueuePosition(input.userId);
  } else if (input.action === 'set_due') {
    const mode = input.mode;
    if (!mode) {
      throw new AppError('A due mode is required for set_due.', 400);
    }

    const resolvedDueAt = resolveDueDate(mode, input.dueAt, input.timeZone);
    nextQueueState = getRestoredQueueState(existing);
    nextQueueState = nextQueueState === 'new' ? 'review' : nextQueueState;
    nextDueAt = resolvedDueAt;
    nextSchedulerState = getSetDueSchedulerState(existing, resolvedDueAt);
  }

  const updatedCard = await prisma.studyCard.updateMany({
    where: { id: input.cardId, userId: input.userId },
    data: {
      queueState: nextQueueState,
      dueAt: nextDueAt,
      schedulerStateJson: toPrismaJson(nextSchedulerState),
      lastReviewedAt: nextLastReviewedAt,
      introducedAt: nextIntroducedAt,
      newQueuePosition: nextNewQueuePosition,
    },
  });

  if (updatedCard.count !== 1) {
    throw new AppError('Study card not found.', 404);
  }

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after update.', 404);
  }

  const overview =
    input.currentOverview &&
    parseStudyQueueState(existing.queueState) !== 'new' &&
    parseStudyQueueState(refreshed.queueState) !== 'new'
      ? await getAdjustedStudyOverview(
          input.userId,
          input.currentOverview,
          getOverviewMutationCard(existing),
          getOverviewMutationCard(refreshed)
        )
      : await getStudyOverview(input.userId);

  return {
    card: await toStudyCardSummary(refreshed),
    overview,
  };
}

export async function updateStudyCard(input: UpdateStudyCardInput): Promise<StudyCardSummary> {
  const existing: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!existing) {
    throw new AppError('Study card not found.', 404);
  }

  const currentNormalized = await normalizeStudyCardPayload(existing);
  const mergedPrompt: StudyPromptPayload = {
    ...currentNormalized.prompt,
    ...input.prompt,
  };
  const mergedAnswer: StudyAnswerPayload = {
    ...currentNormalized.answer,
    ...input.answer,
  };

  const normalizedPayload =
    existing.cardType === 'cloze'
      ? await normalizeClozePayload({
          activeOrdinal:
            typeof existing.sourceTemplateOrd === 'number' ? existing.sourceTemplateOrd : 0,
          prompt: mergedPrompt,
          answer: mergedAnswer,
        })
      : {
          prompt: mergedPrompt,
          answer: mergedAnswer,
        };

  const previousAudioText = getBestAnswerAudioText(currentNormalized.answer);
  const nextAudioText = getBestAnswerAudioText(normalizedPayload.answer);
  const shouldRegenerateAnswerAudio = previousAudioText !== nextAudioText;

  const nextAnswer: StudyAnswerPayload = shouldRegenerateAnswerAudio
    ? {
        ...normalizedPayload.answer,
        answerAudio: null,
      }
    : normalizedPayload.answer;

  const updatedCardResult = await prisma.studyCard.updateMany({
    where: { id: input.cardId, userId: input.userId },
    data: {
      promptJson: toPrismaJson(normalizedPayload.prompt),
      answerJson: toPrismaJson(nextAnswer),
      searchText: buildStudyCardSearchText({
        prompt: normalizedPayload.prompt,
        answer: nextAnswer,
      }),
      answerAudioSource: shouldRegenerateAnswerAudio ? 'missing' : existing.answerAudioSource,
      answerAudioMediaId: shouldRegenerateAnswerAudio ? null : existing.answerAudioMediaId,
    },
  });

  if (updatedCardResult.count !== 1) {
    throw new AppError('Study card not found.', 404);
  }

  if (shouldRegenerateAnswerAudio) {
    await ensureGeneratedAnswerAudio(input.userId, input.cardId);
  }

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after update.', 404);
  }

  return await toStudyCardSummary(refreshed);
}

export async function createStudyCard(input: CreateStudyCardInput): Promise<StudyCardSummary> {
  const normalizedPayload =
    input.cardType === 'cloze'
      ? await normalizeClozePayload({
          activeOrdinal: 0,
          prompt: input.prompt,
          answer: input.answer,
        })
      : { prompt: input.prompt, answer: input.answer };

  const note = await prisma.studyNote.create({
    data: {
      userId: input.userId,
      sourceKind: 'convolab',
      rawFieldsJson: toPrismaJson({}),
      canonicalJson: toPrismaJson({
        createdInApp: true,
      }),
      searchText: '',
    },
  });

  const initialState = createFreshSchedulerState();
  const newQueuePosition = await getNextNewQueuePosition(input.userId);

  const created: StudyCardWithRelations = await prisma.studyCard.create({
    data: {
      userId: input.userId,
      noteId: note.id,
      sourceKind: 'convolab',
      cardType: input.cardType,
      queueState: 'new',
      newQueuePosition,
      promptJson: toPrismaJson(normalizedPayload.prompt),
      answerJson: toPrismaJson(normalizedPayload.answer),
      searchText: buildStudyCardSearchText(normalizedPayload),
      schedulerStateJson: toPrismaJson(initialState),
      answerAudioSource: 'missing',
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  await ensureGeneratedAnswerAudio(input.userId, created.id);

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: created.id,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after creation.', 404);
  }

  return await toStudyCardSummary(refreshed);
}
