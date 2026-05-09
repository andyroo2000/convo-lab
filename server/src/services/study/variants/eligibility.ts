import type { Prisma } from '@prisma/client';

import { STUDY_VARIANT_SUCCESS_RATINGS, STUDY_VARIANT_WIN_THRESHOLD } from './constants.js';

type ReviewLogLike = {
  rating: number;
};

export function hasRequiredRecentWins(reviewLogs: ReviewLogLike[]): boolean {
  let wins = 0;
  for (const log of reviewLogs) {
    // Reviews are supplied newest-first; the latest Again starts a fresh eligibility window.
    if (log.rating === 1) {
      return false;
    }
    if (STUDY_VARIANT_SUCCESS_RATINGS.has(log.rating)) {
      wins += 1;
    }
    if (wins >= STUDY_VARIANT_WIN_THRESHOLD) {
      return true;
    }
  }

  return false;
}

export async function stageCardsAreEligible(input: {
  tx: Prisma.TransactionClient;
  userId: string;
  variantGroupId: string;
  stage: number;
}): Promise<boolean> {
  const cards = await input.tx.studyCard.findMany({
    where: {
      userId: input.userId,
      variantGroupId: input.variantGroupId,
      variantStage: input.stage,
    },
    select: {
      id: true,
      reviewLogs: {
        where: {
          source: 'convolab',
        },
        orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
        select: {
          rating: true,
        },
        take: STUDY_VARIANT_WIN_THRESHOLD + 4,
      },
    },
  });

  return cards.length > 0 && cards.every((card) => hasRequiredRecentWins(card.reviewLogs));
}
