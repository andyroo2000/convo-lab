import {
  STUDY_HISTORY_PAGE_SIZE_DEFAULT,
  STUDY_HISTORY_PAGE_SIZE_MAX,
} from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyBrowserCardStats,
  StudyBrowserFilterOptions,
  StudyBrowserListResponse,
  StudyBrowserNoteDetail,
  StudyBrowserRow,
  StudyCardOption,
  StudyCardOptionsResponse,
  StudyCardType,
  StudyHistoryResponse,
  StudyQueueState,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

import { prisma } from '../../db/client.js';

import { ensureStudyCardMediaAvailable } from './media.js';
import type {
  GetStudyHistoryInput,
  StudyBrowserDetailNoteRecord,
  StudyBrowserListCardRecord,
  StudyBrowserListNoteRecord,
  StudyCardOptionRecord,
  StudyReviewLogRecord,
} from './shared.js';
import {
  buildMediaLookup,
  decodeStudyBrowserCursor,
  decodeStudyHistoryCursor,
  encodeStudyBrowserCursor,
  encodeStudyHistoryCursor,
  getNoteDisplayText,
  noteFieldValueToString,
  parseStudyQueueState,
  parseStudyReviewSource,
  stripHtml,
  toStudyBrowserField,
  toStudyCardSummary,
  toStudyFsrsState,
} from './shared.js';

function escapeLikePattern(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function buildStudyBrowserWhereSql(
  params: {
    userId: string;
    q?: string;
    noteType?: string;
    cardType?: StudyCardType;
    queueState?: StudyQueueState;
  },
  options: {
    omitNoteType?: boolean;
    omitCardType?: boolean;
    omitQueueState?: boolean;
  } = {}
) {
  const clauses: Prisma.Sql[] = [Prisma.sql`n."userId" = ${params.userId}`];

  if (params.noteType && !options.omitNoteType) {
    clauses.push(Prisma.sql`n."sourceNotetypeName" = ${params.noteType}`);
  }

  if (params.cardType && !options.omitCardType) {
    clauses.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "study_cards" sc_filter
        WHERE sc_filter."noteId" = n.id
          AND sc_filter."userId" = ${params.userId}
          AND sc_filter."cardType" = ${params.cardType}
      )`
    );
  }

  if (params.queueState && !options.omitQueueState) {
    clauses.push(
      Prisma.sql`EXISTS (
        SELECT 1
        FROM "study_cards" sq_filter
        WHERE sq_filter."noteId" = n.id
          AND sq_filter."userId" = ${params.userId}
          AND sq_filter."queueState" = ${params.queueState}
      )`
    );
  }

  const searchNeedle = params.q?.trim().toLowerCase() ?? '';
  if (searchNeedle) {
    const searchPattern = `%${escapeLikePattern(searchNeedle)}%`;
    clauses.push(
      Prisma.sql`(
        COALESCE(n."searchText", '') ILIKE ${searchPattern} ESCAPE '\'
        OR EXISTS (
          SELECT 1
          FROM "study_cards" sc_search
          WHERE sc_search."noteId" = n.id
            AND sc_search."userId" = ${params.userId}
            AND COALESCE(sc_search."searchText", '') ILIKE ${searchPattern} ESCAPE '\'
        )
      )`
    );
  }

  return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
}

function buildStudyCardOptionLabel(card: StudyCardOptionRecord): string {
  const prompt =
    card.promptJson && typeof card.promptJson === 'object'
      ? (card.promptJson as Record<string, unknown>)
      : {};
  const answer =
    card.answerJson && typeof card.answerJson === 'object'
      ? (card.answerJson as Record<string, unknown>)
      : {};
  const label =
    noteFieldValueToString(answer.expression) ??
    noteFieldValueToString(answer.restoredText) ??
    noteFieldValueToString(prompt.cueText) ??
    noteFieldValueToString(prompt.clozeDisplayText) ??
    noteFieldValueToString(answer.meaning) ??
    String(card.id);

  return stripHtml(label) ?? label;
}

export async function getStudyHistory(input: GetStudyHistoryInput): Promise<StudyHistoryResponse> {
  const pageSize = Math.max(
    1,
    Math.min(STUDY_HISTORY_PAGE_SIZE_MAX, input.limit ?? STUDY_HISTORY_PAGE_SIZE_DEFAULT)
  );
  const cursor = input.cursor ? decodeStudyHistoryCursor(input.cursor) : null;
  const logs: StudyReviewLogRecord[] = await prisma.studyReviewLog.findMany({
    where: {
      userId: input.userId,
      ...(input.cardId ? { cardId: input.cardId } : {}),
      ...(cursor
        ? {
            OR: [
              { reviewedAt: { lt: new Date(cursor.reviewedAt) } },
              {
                reviewedAt: new Date(cursor.reviewedAt),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
  });

  const hasMore = logs.length > pageSize;
  const pageLogs = hasMore ? logs.slice(0, pageSize) : logs;
  const events = pageLogs.map((log) => ({
    id: log.id,
    cardId: log.cardId,
    source: parseStudyReviewSource(log.source),
    reviewedAt: log.reviewedAt.toISOString(),
    rating: log.rating,
    durationMs: typeof log.durationMs === 'number' ? log.durationMs : null,
    sourceReviewId: typeof log.sourceReviewId === 'bigint' ? String(log.sourceReviewId) : null,
    stateBefore: toStudyFsrsState(log.stateBeforeJson),
    stateAfter: toStudyFsrsState(log.stateAfterJson),
    rawPayload:
      log.rawPayloadJson && typeof log.rawPayloadJson === 'object'
        ? (log.rawPayloadJson as Record<string, unknown>)
        : null,
  }));

  const lastLog = pageLogs.at(-1);

  return {
    events,
    nextCursor:
      hasMore && lastLog
        ? encodeStudyHistoryCursor({
            reviewedAt: lastLog.reviewedAt.toISOString(),
            id: lastLog.id,
          })
        : null,
  };
}

export async function getStudyCardOptions(
  userId: string,
  limit: number
): Promise<StudyCardOptionsResponse> {
  const [total, cards] = await Promise.all([
    prisma.studyCard.count({
      where: { userId },
    }),
    prisma.studyCard.findMany({
      where: { userId },
      select: {
        id: true,
        promptJson: true,
        answerJson: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }) as Promise<StudyCardOptionRecord[]>,
  ]);

  return {
    total,
    options: cards.map<StudyCardOption>((card) => ({
      id: card.id,
      label: buildStudyCardOptionLabel(card),
    })),
  };
}

export async function getStudyBrowserList(params: {
  userId: string;
  q?: string;
  noteType?: string;
  cardType?: StudyCardType;
  queueState?: StudyQueueState;
  cursor?: string;
  limit?: number;
}): Promise<StudyBrowserListResponse> {
  const limit = Math.max(1, Math.min(100, params.limit ?? 100));
  const cursor = params.cursor ? decodeStudyBrowserCursor(params.cursor) : null;
  const whereSql = buildStudyBrowserWhereSql(params);
  const cursorSql =
    cursor === null
      ? Prisma.empty
      : Prisma.sql`
          AND (
            n."updatedAt" < ${new Date(cursor.updatedAt)}
            OR (n."updatedAt" = ${new Date(cursor.updatedAt)} AND n.id < ${cursor.id})
          )
        `;

  const [totalRows, pagedNoteRows, noteTypeRows, cardTypeRows, queueStateRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM "study_notes" n
      ${whereSql}
    `),
    prisma.$queryRaw<Array<{ id: string; updatedAt: Date }>>(Prisma.sql`
      SELECT n.id, n."updatedAt"
      FROM "study_notes" n
      ${whereSql}
      ${cursorSql}
      ORDER BY n."updatedAt" DESC, n.id DESC
      LIMIT ${limit + 1}
    `),
    prisma.$queryRaw<Array<{ value: string | null }>>(Prisma.sql`
      SELECT DISTINCT n."sourceNotetypeName" AS value
      FROM "study_notes" n
      ${buildStudyBrowserWhereSql(params, { omitNoteType: true })}
      ORDER BY value ASC
    `),
    prisma.$queryRaw<Array<{ value: string | null }>>(Prisma.sql`
      SELECT DISTINCT c."cardType" AS value
      FROM "study_cards" c
      JOIN "study_notes" n ON n.id = c."noteId"
      ${buildStudyBrowserWhereSql(params, { omitCardType: true })}
      AND c."userId" = ${params.userId}
      ORDER BY value ASC
    `),
    prisma.$queryRaw<Array<{ value: string | null }>>(Prisma.sql`
      SELECT DISTINCT c."queueState" AS value
      FROM "study_cards" c
      JOIN "study_notes" n ON n.id = c."noteId"
      ${buildStudyBrowserWhereSql(params, { omitQueueState: true })}
      AND c."userId" = ${params.userId}
      ORDER BY value ASC
    `),
  ]);

  const hasMore = pagedNoteRows.length > limit;
  const pageNoteRows = hasMore ? pagedNoteRows.slice(0, limit) : pagedNoteRows;
  const noteIds = pageNoteRows.map((row) => row.id);
  const notes: StudyBrowserListNoteRecord[] =
    noteIds.length > 0
      ? await prisma.studyNote.findMany({
          where: {
            userId: params.userId,
            id: {
              in: noteIds,
            },
          },
          include: {
            cards: {
              select: {
                id: true,
                cardType: true,
                queueState: true,
                promptJson: true,
                answerJson: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

  const noteOrder = new Map(noteIds.map((noteId, index) => [noteId, index]));
  notes.sort((left, right) => (noteOrder.get(left.id) ?? 0) - (noteOrder.get(right.id) ?? 0));

  const cardIds = notes.flatMap((note) => note.cards.map((card) => card.id));
  const reviewCounts =
    cardIds.length > 0
      ? await prisma.studyReviewLog.groupBy({
          by: ['cardId'],
          where: {
            userId: params.userId,
            cardId: {
              in: cardIds,
            },
          },
          _count: { _all: true },
        })
      : [];

  const reviewCountsByCard = new Map(
    reviewCounts.map((row) => [String(row.cardId), row._count._all])
  );
  const filterOptions: StudyBrowserFilterOptions = {
    noteTypes: noteTypeRows
      .map((row) => row.value)
      .filter((value): value is string => Boolean(value)),
    cardTypes: cardTypeRows
      .map((row) => row.value)
      .filter(
        (value): value is StudyCardType =>
          value === 'recognition' || value === 'production' || value === 'cloze'
      ),
    queueStates: queueStateRows
      .map((row) => row.value)
      .filter(
        (value): value is StudyQueueState =>
          value === 'new' ||
          value === 'learning' ||
          value === 'review' ||
          value === 'relearning' ||
          value === 'suspended' ||
          value === 'buried'
      ),
  };
  const totalValue = totalRows[0]?.count ?? 0;
  const total = typeof totalValue === 'bigint' ? Number(totalValue) : Number(totalValue);
  const lastVisibleNote = pageNoteRows.at(-1);
  const lastVisibleUpdatedAt =
    lastVisibleNote?.updatedAt instanceof Date
      ? lastVisibleNote.updatedAt.toISOString()
      : lastVisibleNote?.updatedAt
        ? new Date(lastVisibleNote.updatedAt).toISOString()
        : null;

  const rows: StudyBrowserRow[] = notes.map((note) => {
    const cards: StudyBrowserListCardRecord[] = note.cards;
    const queueSummary = cards.reduce<Partial<Record<StudyQueueState, number>>>((acc, card) => {
      const state = parseStudyQueueState(card.queueState);
      if (state) {
        acc[state] = (acc[state] ?? 0) + 1;
      }
      return acc;
    }, {});
    const reviewCount = cards.reduce((totalForNote, card) => {
      return totalForNote + (reviewCountsByCard.get(String(card.id)) ?? 0);
    }, 0);

    return {
      noteId: note.id,
      displayText: getNoteDisplayText(note, cards),
      noteTypeName: typeof note.sourceNotetypeName === 'string' ? note.sourceNotetypeName : null,
      cardCount: cards.length,
      reviewCount,
      queueSummary,
      updatedAt: note.updatedAt.toISOString(),
    };
  });

  return {
    rows,
    total,
    limit,
    nextCursor:
      hasMore && lastVisibleNote && lastVisibleUpdatedAt
        ? encodeStudyBrowserCursor({
            updatedAt: lastVisibleUpdatedAt,
            id: lastVisibleNote.id,
          })
        : null,
    filterOptions,
  };
}

export async function getStudyBrowserNoteDetail(
  userId: string,
  noteId: string
): Promise<StudyBrowserNoteDetail | null> {
  const note: StudyBrowserDetailNoteRecord | null = await prisma.studyNote.findFirst({
    where: {
      id: noteId,
      userId,
    },
    include: {
      cards: {
        include: {
          note: true,
          promptAudioMedia: true,
          answerAudioMedia: true,
          imageMedia: true,
        },
        orderBy: [{ sourceTemplateOrd: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!note) {
    return null;
  }

  const cards = note.cards.filter((card) => card.userId === userId);
  await ensureStudyCardMediaAvailable(cards);
  const cardSummaries = await Promise.all(cards.map((card) => toStudyCardSummary(card)));

  const reviewCounts =
    cards.length > 0
      ? await prisma.studyReviewLog.groupBy({
          by: ['cardId'],
          where: {
            userId,
            cardId: {
              in: cards.map((card) => card.id),
            },
          },
          _count: { _all: true },
          _max: { reviewedAt: true },
        })
      : [];

  const cardStats: StudyBrowserCardStats[] = reviewCounts.map((row) => ({
    cardId: String(row.cardId),
    reviewCount: row._count._all,
    lastReviewedAt: row._max.reviewedAt instanceof Date ? row._max.reviewedAt.toISOString() : null,
  }));

  const statsByCardId = new Map(cardStats.map((entry) => [entry.cardId, entry]));
  for (const card of cardSummaries) {
    if (!statsByCardId.has(card.id)) {
      cardStats.push({
        cardId: card.id,
        reviewCount: 0,
        lastReviewedAt: null,
      });
    }
  }

  const mediaLookup = buildMediaLookup(cardSummaries);
  const rawFieldsRecord =
    note.rawFieldsJson && typeof note.rawFieldsJson === 'object'
      ? (note.rawFieldsJson as Record<string, unknown>)
      : {};
  const canonicalFieldsRecord =
    note.canonicalJson && typeof note.canonicalJson === 'object'
      ? (note.canonicalJson as Record<string, unknown>)
      : {};

  return {
    noteId: note.id,
    displayText: getNoteDisplayText(note, cards),
    noteTypeName: typeof note.sourceNotetypeName === 'string' ? note.sourceNotetypeName : null,
    sourceKind: typeof note.sourceKind === 'string' ? note.sourceKind : 'anki_import',
    updatedAt: note.updatedAt.toISOString(),
    rawFields: Object.entries(rawFieldsRecord).map(([name, value]) =>
      toStudyBrowserField(name, value, mediaLookup)
    ),
    canonicalFields: Object.entries(canonicalFieldsRecord).map(([name, value]) =>
      toStudyBrowserField(name, value, mediaLookup)
    ),
    cards: cardSummaries,
    cardStats,
    selectedCardId: cardSummaries[0]?.id ?? null,
  };
}
