import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

interface MasteryReviewAnimationProps {
  label: string;
  fromLevel: string;
  toLevel: string;
  passed: boolean;
  announcement: string;
  onFinished: () => void;
}

const MASTERY_LEVELS = ['apprentice', 'guru', 'master', 'enlightened', 'burned'] as const;
const SEGMENT_WIDTH_REM = 12;

const MasteryReviewAnimation = ({
  label,
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
  const duration = reduceMotion ? 650 : 1_450;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const fromIndex = Math.max(
    0,
    MASTERY_LEVELS.indexOf(fromLevel as (typeof MASTERY_LEVELS)[number])
  );
  const toIndex = Math.max(0, MASTERY_LEVELS.indexOf(toLevel as (typeof MASTERY_LEVELS)[number]));
  const moved = fromIndex !== toIndex;
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
    const timeout = window.setTimeout(() => onFinishedRef.current(), duration);
    return () => window.clearTimeout(timeout);
  }, [duration]);

  return (
    <div className={rootClassName} role="status" aria-live="polite" aria-atomic="true">
      <span className="sr-only">{announcement}</span>
      <div className="mastery-level-window" aria-hidden="true">
        <div className="mastery-level-track" style={railStyle}>
          {MASTERY_LEVELS.map((masteryLevel, index) => (
            <div
              className={[
                'mastery-level-segment',
                index === fromIndex ? 'mastery-level-segment--from' : '',
                index === toIndex ? 'mastery-level-segment--to' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-level={masteryLevel}
              key={masteryLevel}
            >
              <span>{masteryLevel}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mastery-promotion-item" aria-hidden="true">
        {label}
      </div>
    </div>
  );
};

export default MasteryReviewAnimation;
