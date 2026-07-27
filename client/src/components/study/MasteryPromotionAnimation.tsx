import { useEffect, useMemo, useRef, useState } from 'react';

interface MasteryPromotionAnimationProps {
  label: string;
  level: string;
  announcement: string;
  onFinished: () => void;
}

const MasteryPromotionAnimation = ({
  label,
  level,
  announcement,
  onFinished,
}: MasteryPromotionAnimationProps) => {
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const duration = reduceMotion ? 1_150 : 2_650;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const rootClassName = useMemo(
    () =>
      `mastery-promotion-animation${reduceMotion ? ' mastery-promotion-animation--reduced' : ''}`,
    [reduceMotion]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => onFinishedRef.current(), duration);
    return () => window.clearTimeout(timeout);
  }, [duration]);

  return (
    <div className={rootClassName} role="status" aria-live="polite" aria-atomic="true">
      <span className="sr-only">{announcement}</span>
      <div className="mastery-promotion-cloud" aria-hidden="true">
        <svg viewBox="0 0 190 118" focusable="false">
          <path d="M43 99C20 99 8 85 12 67C15 51 29 42 45 43C50 24 67 12 87 16C102 2 128 7 137 27C159 27 176 42 178 62C181 84 164 99 143 99H43Z" />
        </svg>
        <span>{level.toUpperCase()}</span>
      </div>
      <div className="mastery-promotion-item" aria-hidden="true">
        {label}
      </div>
    </div>
  );
};

export default MasteryPromotionAnimation;
