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
  StudyReviewResult,
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
  dateFromDayBoundary,
  DEFAULT_STUDY_LIMIT,
  getBestAnswerAudioText,
  getRequiredSchedulerState,
  getScheduledDaysForDue,
  normalizeClozePayload,
  normalizeStudyCardPayload,
  parseStudyImportStatus,
  parseStudyQueueState,
  scheduler,
  toConvolabReviewRawPayload,
  toPrismaJson,
  toStudyCardSummary,
  toStudyFsrsState,
  toStudyImportPreview,
} from './shared.js';

function isActiveDueQueueState(queueState: StudyQueueState): boolean {
  return queueState === 'learning' || queueState === 'review' || queueState === 'relearning';
}

export async function getStudyOverview(userId: string): Promise<StudyOverview> {
  const now = new Date();
  const [cardOverviewRows, latestImport] = await Promise.all([
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

  return {
    dueCount: toCount(cardOverview.due_count),
    newCount: toCount(cardOverview.new_count),
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

export async function startStudySession(userId: string, limit: number = DEFAULT_STUDY_LIMIT) {
  const now = new Date();
  const cards: StudyCardWithRelations[] = await prisma.studyCard.findMany({
    where: {
      userId,
      OR: [
        { queueState: 'new' },
        {
          queueState: {
            in: ['learning', 'review', 'relearning'],
          },
          dueAt: {
            lte: now,
          },
        },
      ],
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
    // sourceDue is raw Anki integer metadata; runtime session ordering uses dueAt plus a stable ID tie-break.
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });

  await ensureStudyCardMediaAvailable(cards);

  return {
    overview: await getStudyOverview(userId),
    cards: await Promise.all(cards.map((card) => toStudyCardSummary(card))),
  };
}

export async function recordStudyReview(params: {
  userId: string;
  cardId: string;
  grade: 'again' | 'hard' | 'good' | 'easy';
  durationMs?: number;
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
  const createdReviewLog = await prisma.$transaction(async (tx) => {
    const updatedCard = await tx.studyCard.updateMany({
      where: { id: params.cardId, userId: params.userId },
      data: {
        schedulerStateJson: toPrismaJson(serializedNextState),
        queueState: nextQueueState,
        dueAt: nextState.due,
        lastReviewedAt: now,
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

  const overview = params.currentOverview
    ? await getAdjustedStudyOverview(
        params.userId,
        params.currentOverview,
        getOverviewMutationCard(card),
        getOverviewMutationCard(refreshed)
      )
    : await getStudyOverview(params.userId);

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

  await prisma.$transaction(async (tx) => {
    const updatedCard = await tx.studyCard.updateMany({
      where: { id: String(reviewLog.cardId), userId: params.userId },
      data: {
        schedulerStateJson: toPrismaJson(serializeFsrsCard(previousState)),
        queueState: restoredQueueState,
        dueAt: restoredDueAt,
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

  const overview = params.currentOverview
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

  const overview = input.currentOverview
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

  const created: StudyCardWithRelations = await prisma.studyCard.create({
    data: {
      userId: input.userId,
      noteId: note.id,
      sourceKind: 'convolab',
      cardType: input.cardType,
      queueState: 'new',
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
