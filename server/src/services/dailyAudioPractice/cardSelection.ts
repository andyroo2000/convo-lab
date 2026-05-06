import type { StudyCardType } from '@languageflow/shared/src/types.js';

import { prisma } from '../../db/client.js';
import { noteFieldValueToString, stripHtml } from '../study/shared/text.js';

import type {
  DailyAudioLearningAtom,
  DailyAudioSelectedCard,
  DailyAudioSelectionSummary,
} from './types.js';

const DEFAULT_SELECTION_LIMIT = 30;
const DEFAULT_CANDIDATE_POOL_SIZE = 80;
const ELIGIBLE_QUEUE_STATES = ['new', 'learning', 'review', 'relearning'];
const RECENTLY_INTRODUCED_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function plainText(value: unknown): string | null {
  const text = noteFieldValueToString(value);
  return stripHtml(text) ?? text;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = plainText(value);
    if (text?.trim()) return text.trim();
  }
  return null;
}

function asStudyCardType(value: string): StudyCardType {
  if (value === 'production' || value === 'cloze') return value;
  return 'recognition';
}

function scoreCard(card: DailyAudioSelectedCard, reviewCount: number, now: Date): number {
  let score = 0;
  const dueAtMs = card.dueAt instanceof Date ? card.dueAt.getTime() : null;
  const introducedAtMs = card.introducedAt instanceof Date ? card.introducedAt.getTime() : null;
  const lastReviewedAtMs =
    card.lastReviewedAt instanceof Date ? card.lastReviewedAt.getTime() : null;

  // Priority model: overdue, learning/relearning, lapses, recently introduced/reviewed, then new.
  if (dueAtMs !== null && dueAtMs <= now.getTime()) score += 140;
  if (card.queueState === 'learning' || card.queueState === 'relearning') score += 75;
  if (card.queueState === 'new') score += 55;
  if ((card.sourceLapses ?? 0) > 0) score += Math.min(60, (card.sourceLapses ?? 0) * 15);
  if (introducedAtMs !== null && now.getTime() - introducedAtMs < RECENTLY_INTRODUCED_WINDOW_MS) {
    score += 55;
  }
  if (lastReviewedAtMs !== null && now.getTime() - lastReviewedAtMs < 3 * 24 * 60 * 60 * 1000) {
    score += 20;
  }
  if (reviewCount === 0) score += 15;
  score -= Math.min(20, reviewCount);

  return score;
}

export async function selectDailyAudioPracticeCards(params: {
  userId: string;
  now?: Date;
  limit?: number;
  candidatePoolSize?: number;
}): Promise<{ cards: DailyAudioSelectedCard[]; summary: DailyAudioSelectionSummary }> {
  const now = params.now ?? new Date();
  const limit = params.limit ?? DEFAULT_SELECTION_LIMIT;
  const candidatePoolSize = params.candidatePoolSize ?? DEFAULT_CANDIDATE_POOL_SIZE;

  const cards = (await prisma.studyCard.findMany({
    where: {
      userId: params.userId,
      queueState: {
        notIn: ['suspended', 'buried'],
      },
    },
    include: {
      note: {
        select: {
          sourceNotetypeName: true,
          rawFieldsJson: true,
        },
      },
    },
    orderBy: [
      { dueAt: 'asc' },
      { lastReviewedAt: 'desc' },
      { introducedAt: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: candidatePoolSize,
  })) as DailyAudioSelectedCard[];

  const eligible = cards.filter((card) => ELIGIBLE_QUEUE_STATES.includes(card.queueState));
  const reviewCounts =
    eligible.length > 0
      ? await prisma.studyReviewLog.groupBy({
          by: ['cardId'],
          where: {
            userId: params.userId,
            cardId: {
              in: eligible.map((card) => card.id),
            },
          },
          _count: { _all: true },
          _max: { reviewedAt: true },
        })
      : [];
  const reviewCountByCardId = new Map(
    reviewCounts.map((row) => [String(row.cardId), Number(row._count._all)])
  );

  const ranked = [...eligible].sort((left, right) => {
    const leftScore = scoreCard(left, reviewCountByCardId.get(left.id) ?? 0, now);
    const rightScore = scoreCard(right, reviewCountByCardId.get(right.id) ?? 0, now);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });

  const newOrRecentlyIntroduced = ranked.filter((card) => {
    const introducedAtMs = card.introducedAt instanceof Date ? card.introducedAt.getTime() : null;
    return (
      card.queueState === 'new' ||
      (introducedAtMs !== null && now.getTime() - introducedAtMs < RECENTLY_INTRODUCED_WINDOW_MS)
    );
  });
  const minimumNewerCardCount = Math.min(newOrRecentlyIntroduced.length, Math.ceil(limit * 0.3));
  const selectedById = new Set<string>();
  const selected: DailyAudioSelectedCard[] = [];

  for (const card of newOrRecentlyIntroduced.slice(0, minimumNewerCardCount)) {
    selected.push(card);
    selectedById.add(card.id);
  }
  for (const card of ranked) {
    if (selected.length >= limit) break;
    if (selectedById.has(card.id)) continue;
    selected.push(card);
    selectedById.add(card.id);
  }
  const summary: DailyAudioSelectionSummary = {
    totalCandidates: cards.length,
    totalEligible: eligible.length,
    selectedCount: selected.length,
    dueCount: selected.filter((card) => card.dueAt && card.dueAt <= now).length,
    learningCount: selected.filter((card) => ['learning', 'relearning'].includes(card.queueState))
      .length,
    recentMissCount: selected.filter((card) => (card.sourceLapses ?? 0) > 0).length,
  };

  return { cards: selected, summary };
}

export async function buildDailyAudioLearningAtoms(
  cards: DailyAudioSelectedCard[]
): Promise<DailyAudioLearningAtom[]> {
  return cards
    .map((card) => {
      const prompt = isRecord(card.promptJson) ? card.promptJson : {};
      const answer = isRecord(card.answerJson) ? card.answerJson : {};
      const rawFields = isRecord(card.note?.rawFieldsJson) ? card.note.rawFieldsJson : {};

      const targetText =
        firstText(
          prompt.clozeAnswerText,
          answer.expression,
          answer.restoredText,
          prompt.cueText,
          rawFields.AnswerExpression,
          rawFields.Expression,
          rawFields.Text
        ) ?? '';
      const english =
        firstText(
          answer.meaning,
          answer.sentenceEn,
          prompt.cueMeaning,
          rawFields.Meaning,
          rawFields.English,
          rawFields.Translation
        ) ?? targetText;

      if (!targetText.trim()) return null;

      const atom: DailyAudioLearningAtom = {
        cardId: card.id,
        cardType: asStudyCardType(card.cardType),
        targetText,
        reading: firstText(
          answer.expressionReading,
          answer.restoredTextReading,
          prompt.cueReading,
          rawFields.Reading
        ),
        english,
        exampleJp: firstText(answer.sentenceJp, answer.restoredText, prompt.clozeDisplayText),
        exampleEn: firstText(answer.sentenceEn),
        deckName: card.sourceDeckName,
        noteType: card.note?.sourceNotetypeName ?? null,
      };
      return atom;
    })
    .filter((atom): atom is DailyAudioLearningAtom => atom !== null);
}
