import { Card as FSRSCard, State, Rating, RecordLog } from 'ts-fsrs';

/**
 * FSRS state fixtures for testing
 * These represent typical card states in the FSRS spaced repetition algorithm
 */

// New card - never reviewed
export const newCardState: FSRSCard = {
  due: new Date(),
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  reps: 0,
  lapses: 0,
  state: State.New,
  last_review: undefined,
};

// Learning card - reviewed once, in learning phase
export const learningCardState: FSRSCard = {
  due: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 1 day
  stability: 1.5,
  difficulty: 5.0,
  elapsed_days: 0,
  scheduled_days: 1,
  reps: 1,
  lapses: 0,
  state: State.Learning,
  last_review: new Date(),
};

// Review card - graduated to review stage
export const reviewCardState: FSRSCard = {
  due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
  stability: 10.0,
  difficulty: 4.5,
  elapsed_days: 3,
  scheduled_days: 7,
  reps: 5,
  lapses: 0,
  state: State.Review,
  last_review: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Last reviewed 3 days ago
};

// Relearning card - lapsed and being relearned
export const relearningCardState: FSRSCard = {
  due: new Date(Date.now() + 12 * 60 * 60 * 1000), // Due in 12 hours
  stability: 0.8,
  difficulty: 6.5,
  elapsed_days: 1,
  scheduled_days: 0.5,
  reps: 8,
  lapses: 2,
  state: State.Relearning,
  last_review: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last reviewed 1 day ago
};

// Due card - overdue for review
export const dueCardState: FSRSCard = {
  due: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Due 2 days ago (overdue)
  stability: 15.0,
  difficulty: 3.8,
  elapsed_days: 9,
  scheduled_days: 7,
  reps: 10,
  lapses: 1,
  state: State.Review,
  last_review: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
};

/**
 * Mock FSRS scheduling results for different ratings
 * These simulate what the FSRS algorithm would return for each rating
 */
export function createMockRecordLog(currentCard: FSRSCard): RecordLog {
  const now = new Date();

  return {
    [Rating.Again]: {
      card: {
        ...currentCard,
        due: new Date(now.getTime() + 10 * 60 * 1000), // 10 minutes
        stability: Math.max(0.5, currentCard.stability * 0.5),
        difficulty: Math.min(10, currentCard.difficulty + 1),
        elapsed_days: 0,
        scheduled_days: 0.007, // ~10 minutes
        reps: currentCard.reps + 1,
        lapses: currentCard.lapses + 1,
        state: State.Relearning,
        last_review: now,
      },
      log: {
        rating: Rating.Again,
        state: currentCard.state,
        due: currentCard.due,
        stability: currentCard.stability,
        difficulty: currentCard.difficulty,
        elapsed_days: currentCard.elapsed_days,
        last_elapsed_days: 0,
        scheduled_days: currentCard.scheduled_days,
        review: now,
      },
    },
    [Rating.Hard]: {
      card: {
        ...currentCard,
        due: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day
        stability: currentCard.stability * 1.2,
        difficulty: Math.min(10, currentCard.difficulty + 0.5),
        elapsed_days: 0,
        scheduled_days: 1,
        reps: currentCard.reps + 1,
        lapses: currentCard.lapses,
        state: currentCard.state === State.New ? State.Learning : currentCard.state,
        last_review: now,
      },
      log: {
        rating: Rating.Hard,
        state: currentCard.state,
        due: currentCard.due,
        stability: currentCard.stability,
        difficulty: currentCard.difficulty,
        elapsed_days: currentCard.elapsed_days,
        last_elapsed_days: 0,
        scheduled_days: currentCard.scheduled_days,
        review: now,
      },
    },
    [Rating.Good]: {
      card: {
        ...currentCard,
        due: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
        stability: currentCard.stability * 2.5,
        difficulty: currentCard.difficulty,
        elapsed_days: 0,
        scheduled_days: 3,
        reps: currentCard.reps + 1,
        lapses: currentCard.lapses,
        state:
          currentCard.state === State.New || currentCard.state === State.Learning
            ? State.Review
            : currentCard.state,
        last_review: now,
      },
      log: {
        rating: Rating.Good,
        state: currentCard.state,
        due: currentCard.due,
        stability: currentCard.stability,
        difficulty: currentCard.difficulty,
        elapsed_days: currentCard.elapsed_days,
        last_elapsed_days: 0,
        scheduled_days: currentCard.scheduled_days,
        review: now,
      },
    },
    [Rating.Easy]: {
      card: {
        ...currentCard,
        due: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        stability: currentCard.stability * 4.0,
        difficulty: Math.max(1, currentCard.difficulty - 0.5),
        elapsed_days: 0,
        scheduled_days: 7,
        reps: currentCard.reps + 1,
        lapses: currentCard.lapses,
        state: State.Review,
        last_review: now,
      },
      log: {
        rating: Rating.Easy,
        state: currentCard.state,
        due: currentCard.due,
        stability: currentCard.stability,
        difficulty: currentCard.difficulty,
        elapsed_days: currentCard.elapsed_days,
        last_elapsed_days: 0,
        scheduled_days: currentCard.scheduled_days,
        review: now,
      },
    },
  };
}

/**
 * Database card state fixtures matching Prisma schema
 */
export const mockDatabaseCard = {
  id: 'card-123',
  deckId: 'deck-123',
  userId: 'user-123',
  coreItemId: null,
  textL2: 'こんにちは',
  readingL2: 'こんにちは',
  translationL1: 'hello',
  audioUrl: 'https://example.com/audio.mp3',
  imageUrl: null,
  notes: null,
  tags: null,

  // Recognition card fields
  recognitionState: 'new' as const,
  recognitionDue: new Date(),
  recognitionStability: 0,
  recognitionDifficulty: 0,
  recognitionElapsedDays: 0,
  recognitionScheduledDays: 0,
  recognitionReps: 0,
  recognitionLapses: 0,
  recognitionLastReview: null,
  enableRecognition: true,

  // Audio card fields
  audioState: 'new' as const,
  audioDue: new Date(),
  audioStability: 0,
  audioDifficulty: 0,
  audioElapsedDays: 0,
  audioScheduledDays: 0,
  audioReps: 0,
  audioLapses: 0,
  audioLastReview: null,
  enableAudio: true,

  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDeck = {
  id: 'deck-123',
  userId: 'user-123',
  language: 'ja',
  name: 'Japanese Vocabulary',
  description: 'Test deck',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockReview = {
  id: 'review-123',
  cardId: 'card-123',
  userId: 'user-123',
  cardType: 'recognition' as const,
  rating: 3,
  stateBefore: 'new' as const,
  stateAfter: 'learning' as const,
  dueBefore: new Date(),
  dueAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
  reviewedAt: new Date(),
  durationMs: 3500,
  createdAt: new Date(),
};
