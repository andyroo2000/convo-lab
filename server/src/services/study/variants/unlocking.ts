import type { Prisma } from '@prisma/client';

import { prisma } from '../../../db/client.js';

import { STUDY_VOCAB_VARIANT_STAGES } from './constants.js';
import { stageCardsAreEligible } from './eligibility.js';

const MAX_VARIANT_STAGE = STUDY_VOCAB_VARIANT_STAGES.sentenceCloze;

async function getNextNewQueuePosition(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<number> {
  const aggregate = await tx.studyCard.aggregate({
    where: {
      userId,
      queueState: 'new',
      OR: [{ variantStatus: null }, { variantStatus: 'available' }],
    },
    _max: {
      newQueuePosition: true,
    },
  });

  return (aggregate._max.newQueuePosition ?? 0) + 1;
}

export async function unlockStudyVariantStagesAfterReview(input: {
  userId: string;
  cardId: string;
}): Promise<void> {
  const reviewedCard = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
      variantGroupId: {
        not: null,
      },
      variantStage: {
        not: null,
      },
    },
    select: {
      variantGroupId: true,
      variantStage: true,
    },
  });

  if (!reviewedCard?.variantGroupId || !reviewedCard.variantStage) {
    return;
  }

  const nextStage = reviewedCard.variantStage + 1;
  if (nextStage > MAX_VARIANT_STAGE) {
    return;
  }

  const variantGroupId = reviewedCard.variantGroupId;
  const reviewedStage = reviewedCard.variantStage;

  await prisma.$transaction(async (tx) => {
    const existingNextStage = await tx.studyCard.count({
      where: {
        userId: input.userId,
        variantGroupId,
        variantStage: nextStage,
        variantStatus: 'locked',
      },
    });
    if (existingNextStage === 0) {
      return;
    }

    const eligible = await stageCardsAreEligible({
      tx,
      userId: input.userId,
      variantGroupId,
      stage: reviewedStage,
    });
    if (!eligible) {
      return;
    }

    const lockedCards = await tx.studyCard.findMany({
      where: {
        userId: input.userId,
        variantGroupId,
        variantStage: nextStage,
        variantStatus: 'locked',
      },
      select: {
        id: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    let nextQueuePosition = await getNextNewQueuePosition(tx, input.userId);
    const now = new Date();
    for (const card of lockedCards) {
      await tx.studyCard.update({
        where: {
          id: card.id,
        },
        data: {
          variantStatus: 'available',
          variantUnlockedAt: now,
          newQueuePosition: nextQueuePosition,
        },
      });
      nextQueuePosition += 1;
    }
  });
}
