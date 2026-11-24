import { type CSSProperties, useEffect, useRef } from 'react';
import type { StudyMasteryLevel } from '@languageflow/shared/src/types';
import { STUDY_MASTERY_LEVELS } from './studyMastery';

interface MasteryReviewAnimationProps {
  fromLevel: StudyMasteryLevel;
  toLevel: StudyMasteryLevel;
  announcement: string;
  onFinished: () => void;
}

const DURATION_MS = 1160;

const MasteryReviewAnimation = ({
  fromLevel,
  toLevel,
  announcement,
  onFinished,
}: MasteryReviewAnimationProps) => {
  const movement = STUDY_MASTERY_LEVELS.indexOf(toLevel) - STUDY_MASTERY_LEVELS.indexOf(fromLevel);
  const finish = useRef(onFinished);
  finish.current = onFinished;
  useEffect(() => {
    const timer = window.setTimeout(() => finish.current(), movement === 0 ? 0 : DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [movement]);

  if (!movement) return null;
  return (
    <div role="status">
      <span className="sr-only">{announcement}</span>
      <span
        aria-hidden="true"
        className={`study-mastery-label study-mastery-${movement > 0 ? 'promotion' : 'demotion'}`}
        style={{ '--mastery-duration': `${DURATION_MS}ms` } as CSSProperties}
      >
        {toLevel}
      </span>
    </div>
  );
};

export default MasteryReviewAnimation;
