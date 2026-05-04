import { useEffect, useRef, useState } from 'react';

const DEFAULT_EXPECTED_MS = 40_000;
const DEFAULT_TICK_MS = 250;
const COMPLETE_VISIBLE_MS = 450;

function calculateFakeProgress(elapsedMs: number, expectedMs: number): number {
  if (elapsedMs <= 0) return 0;

  const warmupMs = Math.min(4_000, expectedMs * 0.25);
  if (elapsedMs <= warmupMs) {
    const ratio = elapsedMs / warmupMs;
    return 25 * (1 - (1 - ratio) ** 2);
  }

  if (elapsedMs <= expectedMs) {
    const ratio = (elapsedMs - warmupMs) / (expectedMs - warmupMs);
    return 25 + 67 * (1 - (1 - ratio) ** 1.6);
  }

  const overtimeRatio = 1 - Math.exp(-(elapsedMs - expectedMs) / 20_000);
  return Math.min(98, 92 + 6 * overtimeRatio);
}

function useFakeProgress(
  isActive: boolean,
  options: { expectedMs?: number; tickMs?: number } = {}
): { isVisible: boolean; progress: number } {
  const expectedMs = options.expectedMs ?? DEFAULT_EXPECTED_MS;
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      if (wasActiveRef.current) {
        setProgress(100);
        const timeoutId = window.setTimeout(() => {
          setIsVisible(false);
          setProgress(0);
        }, COMPLETE_VISIBLE_MS);

        wasActiveRef.current = false;
        return () => window.clearTimeout(timeoutId);
      }

      setIsVisible(false);
      setProgress(0);
      return undefined;
    }

    wasActiveRef.current = true;
    setIsVisible(true);
    setProgress(0);

    let elapsedMs = 0;
    const intervalId = window.setInterval(() => {
      elapsedMs += tickMs;
      setProgress(calculateFakeProgress(elapsedMs, expectedMs));
    }, tickMs);

    return () => window.clearInterval(intervalId);
  }, [expectedMs, isActive, tickMs]);

  return { isVisible, progress };
}

export default useFakeProgress;
