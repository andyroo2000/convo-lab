import type { StudyFsrsState } from './types.js';

export const IMPORTED_STUDY_DIFFICULTY_DEFAULT = 5;
export const IMPORTED_STUDY_STABILITY_MIN = 0.1;

export interface StudyFsrsCardLike {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: Date;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function serializeStudyFsrsCard(card: StudyFsrsCardLike): StudyFsrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function deserializeStudyFsrsCard(
  state: StudyFsrsState | Record<string, unknown> | null | undefined
): StudyFsrsCardLike | null {
  if (!state || !isRecord(state)) {
    return null;
  }

  const dueValue = typeof state.due === 'string' ? new Date(state.due) : null;
  if (!dueValue || Number.isNaN(dueValue.getTime())) {
    return null;
  }

  const stability = toNumber(state.stability);
  const difficulty = toNumber(state.difficulty);
  const elapsedDays = toNumber(state.elapsed_days);
  const scheduledDays = toNumber(state.scheduled_days);
  const learningSteps = toNumber(state.learning_steps);
  const reps = toNumber(state.reps);
  const lapses = toNumber(state.lapses);
  const queueState = toNumber(state.state);

  if (
    stability === null ||
    difficulty === null ||
    elapsedDays === null ||
    scheduledDays === null ||
    learningSteps === null ||
    reps === null ||
    lapses === null ||
    queueState === null
  ) {
    return null;
  }

  const lastReview =
    typeof state.last_review === 'string' && state.last_review.length > 0
      ? new Date(state.last_review)
      : undefined;
  if (lastReview && Number.isNaN(lastReview.getTime())) {
    return null;
  }

  return {
    due: dueValue,
    stability,
    difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: scheduledDays,
    learning_steps: learningSteps,
    reps,
    lapses,
    state: queueState,
    last_review: lastReview,
  };
}
