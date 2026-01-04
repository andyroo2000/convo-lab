import { FSRS, Rating, Card as FSRSCard, State, RecordLog } from 'ts-fsrs';
import { prisma } from '../db/client.js';

const fsrs = new FSRS();

export interface ReviewCardInput {
  cardId: string;
  userId: string;
  cardType: 'recognition' | 'audio';
  rating: 1 | 2 | 3 | 4;
  durationMs?: number;
}

export async function reviewCard(input: ReviewCardInput) {
  const { cardId, userId, cardType, rating, durationMs } = input;

  // Get current card state from database
  const card = await prisma.card.findFirst({
    where: { id: cardId, userId },
  });

  if (!card) {
    throw new Error('Card not found');
  }

  // Map database state to FSRS card format
  const isRecognition = cardType === 'recognition';
  const currentState = isRecognition ? card.recognitionState : card.audioState;
  const currentDue = isRecognition ? card.recognitionDue : card.audioDue;
  const currentStability = isRecognition ? card.recognitionStability : card.audioStability;
  const currentDifficulty = isRecognition ? card.recognitionDifficulty : card.audioDifficulty;
  const currentElapsedDays = isRecognition ? card.recognitionElapsedDays : card.audioElapsedDays;
  const currentScheduledDays = isRecognition
    ? card.recognitionScheduledDays
    : card.audioScheduledDays;
  const currentReps = isRecognition ? card.recognitionReps : card.audioReps;
  const currentLapses = isRecognition ? card.recognitionLapses : card.audioLapses;
  const currentLastReview = isRecognition ? card.recognitionLastReview : card.audioLastReview;

  // Create FSRS card object
  const fsrsCard: FSRSCard = {
    due: currentDue,
    stability: currentStability ?? 0,
    difficulty: currentDifficulty ?? 0,
    elapsed_days: currentElapsedDays,
    scheduled_days: currentScheduledDays,
    reps: currentReps,
    lapses: currentLapses,
    state: mapStateToFSRS(currentState),
    last_review: currentLastReview ?? undefined,
  };

  // Review the card with FSRS algorithm
  const now = new Date();
  const recordLog: RecordLog = fsrs.repeat(fsrsCard, now);

  // Get the appropriate rating record (Again=1, Hard=2, Good=3, Easy=4)
  const ratingMap: Record<number, Rating> = {
    1: Rating.Again,
    2: Rating.Hard,
    3: Rating.Good,
    4: Rating.Easy,
  };
  const fsrsRating = ratingMap[rating];
  const schedulingResult = recordLog[fsrsRating];

  // Update database with new FSRS state
  const updateData = isRecognition
    ? {
        recognitionState: mapFSRSToState(schedulingResult.card.state),
        recognitionDue: schedulingResult.card.due,
        recognitionStability: schedulingResult.card.stability,
        recognitionDifficulty: schedulingResult.card.difficulty,
        recognitionElapsedDays: schedulingResult.card.elapsed_days,
        recognitionScheduledDays: schedulingResult.card.scheduled_days,
        recognitionReps: schedulingResult.card.reps,
        recognitionLapses: schedulingResult.card.lapses,
        recognitionLastReview: now,
      }
    : {
        audioState: mapFSRSToState(schedulingResult.card.state),
        audioDue: schedulingResult.card.due,
        audioStability: schedulingResult.card.stability,
        audioDifficulty: schedulingResult.card.difficulty,
        audioElapsedDays: schedulingResult.card.elapsed_days,
        audioScheduledDays: schedulingResult.card.scheduled_days,
        audioReps: schedulingResult.card.reps,
        audioLapses: schedulingResult.card.lapses,
        audioLastReview: now,
      };

  // Update card and create review record in transaction
  const [updatedCard, review] = await prisma.$transaction([
    prisma.card.update({
      where: { id: cardId },
      data: updateData,
    }),
    prisma.review.create({
      data: {
        cardId,
        userId,
        cardType,
        rating,
        stateBefore: currentState,
        stateAfter: mapFSRSToState(schedulingResult.card.state),
        dueBefore: currentDue,
        dueAfter: schedulingResult.card.due,
        reviewedAt: now,
        durationMs,
      },
    }),
  ]);

  return { card: updatedCard, review, nextDue: schedulingResult.card.due };
}

// Helper functions to map between database state and FSRS state
function mapStateToFSRS(state: string): State {
  switch (state) {
    case 'new':
      return State.New;
    case 'learning':
      return State.Learning;
    case 'review':
      return State.Review;
    case 'relearning':
      return State.Relearning;
    default:
      return State.New;
  }
}

function mapFSRSToState(state: State): string {
  switch (state) {
    case State.New:
      return 'new';
    case State.Learning:
      return 'learning';
    case State.Review:
      return 'review';
    case State.Relearning:
      return 'relearning';
    default:
      return 'new';
  }
}

export async function getDueCards(userId: string, deckId: string, limit: number = 20) {
  const now = new Date();

  // Get cards due for review (either recognition or audio type)
  const cards = await prisma.card.findMany({
    where: {
      deckId,
      userId,
      OR: [
        { recognitionDue: { lte: now }, enableRecognition: true },
        { audioDue: { lte: now }, enableAudio: true },
      ],
    },
    orderBy: [{ recognitionDue: 'asc' }, { audioDue: 'asc' }],
    take: limit,
  });

  return cards;
}

export async function getDeckStats(userId: string, deckId: string) {
  const now = new Date();

  const totalCards = await prisma.card.count({ where: { deckId, userId } });

  const dueRecognition = await prisma.card.count({
    where: {
      deckId,
      userId,
      recognitionDue: { lte: now },
      enableRecognition: true,
    },
  });

  const dueAudio = await prisma.card.count({
    where: {
      deckId,
      userId,
      audioDue: { lte: now },
      enableAudio: true,
    },
  });

  const newCards = await prisma.card.count({
    where: {
      deckId,
      userId,
      OR: [{ recognitionState: 'new' }, { audioState: 'new' }],
    },
  });

  const learningCards = await prisma.card.count({
    where: {
      deckId,
      userId,
      OR: [{ recognitionState: 'learning' }, { audioState: 'learning' }],
    },
  });

  const reviewCards = await prisma.card.count({
    where: {
      deckId,
      userId,
      OR: [{ recognitionState: 'review' }, { audioState: 'review' }],
    },
  });

  return {
    totalCards,
    dueRecognition,
    dueAudio,
    dueTotal: dueRecognition + dueAudio,
    newCards,
    learningCards,
    reviewCards,
  };
}
