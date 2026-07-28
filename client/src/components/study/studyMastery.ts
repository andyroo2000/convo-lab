import type { StudyMasteryLevel } from '@languageflow/shared/src/types';

export const STUDY_MASTERY_LEVELS: readonly StudyMasteryLevel[] = [
  'apprentice',
  'guru',
  'master',
  'enlightened',
  'burned',
];

export const normalizeStudyMasteryLevel = (
  level: string | null | undefined,
  fallback: StudyMasteryLevel = 'apprentice'
): StudyMasteryLevel =>
  STUDY_MASTERY_LEVELS.includes(level as StudyMasteryLevel)
    ? (level as StudyMasteryLevel)
    : fallback;

export const masteryReviewAnnouncementKind = (
  fromLevel: StudyMasteryLevel,
  toLevel: StudyMasteryLevel,
  passed: boolean
) => {
  if (!passed) {
    return fromLevel === toLevel ? 'failedSameStage' : 'failedMoved';
  }
  const movement = STUDY_MASTERY_LEVELS.indexOf(toLevel) - STUDY_MASTERY_LEVELS.indexOf(fromLevel);
  if (movement > 0) return 'advanced';
  if (movement < 0) return 'moved';
  return 'remained';
};
