import { useCallback, useEffect, useRef, useState } from 'react';

interface AwardControlsOptions {
  achievementId: string | undefined;
  hasNext: boolean;
  onContinue: () => void;
  onSkip: () => void;
  onSkipAll: () => void;
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isSkipShortcut = (event: KeyboardEvent) => {
  if (event.key !== 'ArrowRight') return false;
  if (event.repeat || event.defaultPrevented) return false;
  return ![event.altKey, event.ctrlKey, event.metaKey, event.shiftKey].some(Boolean);
};

const useAchievementAwardControls = ({
  achievementId,
  hasNext,
  onContinue,
  onSkip,
  onSkipAll,
}: AwardControlsOptions) => {
  const [animationKey, setAnimationKey] = useState(0);
  const [canContinue, setCanContinue] = useState(prefersReducedMotion);
  const [advancing, setAdvancing] = useState(false);
  const advanceTimeoutRef = useRef<number | null>(null);

  const cancelAdvance = useCallback(() => {
    if (advanceTimeoutRef.current === null) return;
    window.clearTimeout(advanceTimeoutRef.current);
    advanceTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    setAdvancing(false);
    setCanContinue(prefersReducedMotion());
    const timeoutId = window.setTimeout(() => setCanContinue(true), 4_800);
    return () => {
      window.clearTimeout(timeoutId);
      cancelAdvance();
    };
  }, [achievementId, animationKey, cancelAdvance]);

  const skip = useCallback(
    (all: boolean) => {
      cancelAdvance();
      setAdvancing(false);
      if (all) onSkipAll();
      else onSkip();
    },
    [cancelAdvance, onSkip, onSkipAll]
  );

  useEffect(() => {
    if (!achievementId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSkipShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      skip(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [achievementId, skip]);

  const advance = () => {
    if (advanceTimeoutRef.current !== null) return;
    if (!hasNext || prefersReducedMotion()) {
      onContinue();
      return;
    }
    setAdvancing(true);
    advanceTimeoutRef.current = window.setTimeout(() => {
      advanceTimeoutRef.current = null;
      setAdvancing(false);
      onContinue();
    }, 560);
  };

  return {
    animationKey,
    canContinue,
    advancing,
    advance,
    skip,
    replay: () => setAnimationKey((current) => current + 1),
  };
};

export default useAchievementAwardControls;
