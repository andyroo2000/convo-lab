import type { LearnSession } from './types';

export default function learnStepKey(state: LearnSession['state']): string {
  return state.reviewing
    ? `review:${state.reviewRun}:${state.index}`
    : `${state.phase}:${state.index}`;
}
