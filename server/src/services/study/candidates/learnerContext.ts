import { prisma } from '../../../db/client.js';

import { STUDY_CANDIDATE_LEARNER_CONTEXT_LIMIT } from './constants.js';
import { parseNullableString } from './textUtils.js';

function getRecordText(record: unknown): string | null {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return null;
  const value = record as Record<string, unknown>;
  const text =
    parseNullableString(value.expression) ??
    parseNullableString(value.restoredText) ??
    parseNullableString(value.cueText) ??
    parseNullableString(value.clozeText);
  const meaning = parseNullableString(value.meaning) ?? parseNullableString(value.cueMeaning);
  return [text, meaning].filter(Boolean).join(' - ') || null;
}

export async function buildLearnerContextSummary(userId: string): Promise<string | null> {
  try {
    const cards = await prisma.studyCard.findMany({
      where: {
        userId,
        queueState: {
          in: ['learning', 'relearning', 'review'],
        },
      },
      orderBy: [{ lastReviewedAt: 'desc' }, { updatedAt: 'desc' }],
      take: STUDY_CANDIDATE_LEARNER_CONTEXT_LIMIT,
      select: {
        cardType: true,
        queueState: true,
        promptJson: true,
        answerJson: true,
        sourceLapses: true,
      },
    });

    const lines = cards
      .map((card) => {
        const answerText = getRecordText(card.answerJson);
        const promptText = getRecordText(card.promptJson);
        const label = answerText ?? promptText;
        if (!label) return null;
        return `- ${card.cardType}/${card.queueState}${card.sourceLapses ? ` (${card.sourceLapses} lapses)` : ''}: ${label}`;
      })
      .filter((line): line is string => Boolean(line));

    return lines.length > 0 ? lines.join('\n') : null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[Study candidates] Learner context unavailable.', error);
    return null;
  }
}
