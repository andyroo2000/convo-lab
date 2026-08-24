import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import type { StudyMasteryLevel } from '@languageflow/shared/src/types';

import { STUDY_MASTERY_LEVELS } from './studyMastery';

interface MasteryReviewAnimationProps {
  fromLevel: StudyMasteryLevel;
  toLevel: StudyMasteryLevel;
  passed: boolean;
  announcement: string;
  onFinished: () => void;
}

const SEGMENT_WIDTH_REM = 12;
const ANIMATION_DURATION_MS = 1_450;
const LEVEL_SWAP_MS = 720;

const MasteryReviewAnimation = ({
  fromLevel,
  toLevel,
  passed,
  announcement,
  onFinished,
}: MasteryReviewAnimationProps) => {
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const duration = reduceMotion ? 650 : ANIMATION_DURATION_MS;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const fromIndex = Math.max(0, STUDY_MASTERY_LEVELS.indexOf(fromLevel));
  const toIndex = Math.max(0, STUDY_MASTERY_LEVELS.indexOf(toLevel));
  const moved = fromIndex !== toIndex;
  const [activeLevel, setActiveLevel] = useState<StudyMasteryLevel>(
    reduceMotion ? toLevel : fromLevel
  );
  const rootClassName = useMemo(() => {
    const classes = ['mastery-promotion-animation'];
    if (reduceMotion) classes.push('mastery-promotion-animation--reduced');
    if (moved) classes.push('mastery-promotion-animation--moved');
    if (!passed) classes.push('mastery-promotion-animation--failed');
    return classes.join(' ');
  }, [moved, passed, reduceMotion]);
  const railStyle = {
    '--mastery-from-offset': `${String((fromIndex + 0.5) * SEGMENT_WIDTH_REM)}rem`,
    '--mastery-to-offset': `${String((toIndex + 0.5) * SEGMENT_WIDTH_REM)}rem`,
  } as CSSProperties;

  useEffect(() => {
    const levelTimeout = window.setTimeout(
      () => setActiveLevel(toLevel),
      reduceMotion || !moved ? 0 : LEVEL_SWAP_MS
    );
    const finishTimeout = window.setTimeout(() => onFinishedRef.current(), duration);
    return () => {
      window.clearTimeout(levelTimeout);
      window.clearTimeout(finishTimeout);
    };
  }, [duration, moved, reduceMotion, toLevel]);

  return (
    <div className={rootClassName} role="status" aria-live="polite" aria-atomic="true">
      <span className="sr-only">{announcement}</span>
      <div className="mastery-level-window" aria-hidden="true">
        <div className="mastery-level-name">{activeLevel}</div>
        <div className="mastery-level-track" style={railStyle}>
          {STUDY_MASTERY_LEVELS.map((masteryLevel, index) => (
            <div
              className={[
                'mastery-stage-color',
                'mastery-level-segment',
                index === fromIndex ? 'mastery-level-segment--from' : '',
                index === toIndex ? 'mastery-level-segment--to' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-testid="mastery-level-segment"
              data-level={masteryLevel}
              key={masteryLevel}
            />
          ))}
        </div>
      </div>
      <div
        className={`mastery-review-result ${
          passed ? 'mastery-review-result--passed' : 'mastery-review-result--failed'
        }`}
        aria-hidden="true"
      >
        <span>{passed ? '✓' : '×'}</span>
        {passed ? 'Passed' : 'Try again'}
      </div>
    </div>
  );
};

export default MasteryReviewAnimation;
