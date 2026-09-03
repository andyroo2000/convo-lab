import type { StudyOverview } from '@languageflow/shared/src/types';

import type { AchievementProgress } from '../components/study/achievementModel';
import type { StudyReviewSessionState } from './useStudyReviewSessionState';

interface StudyOverviewCache {
  getQueryData<T>(queryKey: readonly unknown[]): T | undefined;
}

export const getStudyUserId = (user: { id: string } | null | undefined) => user?.id ?? null;

export const getCachedStudyOverview = (cache: StudyOverviewCache) =>
  cache.getQueryData<StudyOverview>(['study', 'overview']) ?? null;

export const getAchievementAwards = (progress: AchievementProgress | null) =>
  progress?.awards ?? [];

export const isStudyAudioAutoplayBlocked = (
  state: Pick<
    StudyReviewSessionState,
    'lessonPhase' | 'masteryAnimation' | 'reviewSubmitPending' | 'sessionKind'
  >
) =>
  state.masteryAnimation !== null ||
  state.reviewSubmitPending ||
  (state.sessionKind === 'lessons' && state.lessonPhase !== 'quiz');

export const isStudyMotionUndoDisabled = (
  state: Pick<
    StudyReviewSessionState,
    'editing' | 'masteryAnimation' | 'sessionLoading' | 'undoPending'
  >,
  reviewPending: boolean,
  cardActionPending: boolean
) =>
  state.undoPending ||
  reviewPending ||
  cardActionPending ||
  state.sessionLoading ||
  state.editing ||
  state.masteryAnimation !== null;

export const isEmptySessionRefreshBlocked = (
  state: Pick<
    StudyReviewSessionState,
    'editing' | 'focusMode' | 'sessionError' | 'sessionLoading' | 'undoPending'
  >,
  practiceMode: boolean,
  hasCurrentCard: boolean,
  reviewBusy: boolean
) =>
  !state.focusMode ||
  practiceMode ||
  state.sessionLoading ||
  Boolean(state.sessionError) ||
  hasCurrentCard ||
  reviewBusy ||
  state.undoPending ||
  state.editing;

const ignoreEditingRequest: StudyReviewSessionState['setEditing'] = () => {};

export const getStudyEditingHandler = (
  practiceMode: boolean,
  setEditing: StudyReviewSessionState['setEditing']
) => (practiceMode ? ignoreEditingRequest : setEditing);
