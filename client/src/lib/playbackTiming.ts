import type { AudioSpeed, Sentence } from '../types';

export interface SentenceTiming {
  startTime?: number;
  endTime?: number;
}

export type SentenceNavigationDirection = 'previous' | 'next';

export function getSentenceTiming(sentence: Sentence, speed: AudioSpeed): SentenceTiming {
  let speedStartTime: number | undefined;
  let speedEndTime: number | undefined;

  if (speed === 'slow') {
    speedStartTime = sentence.startTime_0_7;
    speedEndTime = sentence.endTime_0_7;
  } else if (speed === 'medium') {
    speedStartTime = sentence.startTime_0_85;
    speedEndTime = sentence.endTime_0_85;
  } else {
    speedStartTime = sentence.startTime_1_0;
    speedEndTime = sentence.endTime_1_0;
  }

  return {
    startTime: speedStartTime ?? sentence.startTime,
    endTime: speedEndTime ?? sentence.endTime,
  };
}

export function isSentenceActive(
  sentence: Sentence,
  speed: AudioSpeed,
  currentTimeMs: number
): boolean {
  const { startTime, endTime } = getSentenceTiming(sentence, speed);

  return (
    startTime !== undefined &&
    endTime !== undefined &&
    currentTimeMs >= startTime &&
    currentTimeMs < endTime
  );
}

function findStartTime(
  sentences: Sentence[],
  speed: AudioSpeed,
  startIndex: number,
  step: 1 | -1
): number | undefined {
  for (let index = startIndex; index >= 0 && index < sentences.length; index += step) {
    const { startTime } = getSentenceTiming(sentences[index], speed);
    if (startTime !== undefined) return startTime;
  }

  return undefined;
}

export function getSentenceNavigationTargetMs(
  sentences: Sentence[],
  speed: AudioSpeed,
  currentTimeMs: number,
  direction: SentenceNavigationDirection
): number | undefined {
  if (sentences.length === 0) return undefined;

  const activeIndex = sentences.findIndex((sentence) =>
    isSentenceActive(sentence, speed, currentTimeMs)
  );

  if (activeIndex >= 0) {
    const currentStartTime = getSentenceTiming(sentences[activeIndex], speed).startTime;
    if (direction === 'next') {
      return findStartTime(sentences, speed, activeIndex + 1, 1) ?? currentStartTime;
    }

    if (currentStartTime !== undefined && currentTimeMs - currentStartTime > 1000) {
      return currentStartTime;
    }

    return findStartTime(sentences, speed, activeIndex - 1, -1) ?? currentStartTime;
  }

  const nextIndex = sentences.findIndex((sentence) => {
    const { startTime } = getSentenceTiming(sentence, speed);
    return startTime !== undefined && currentTimeMs < startTime;
  });
  const previousIndex = nextIndex === -1 ? sentences.length - 1 : nextIndex - 1;

  if (direction === 'next') {
    return nextIndex >= 0
      ? findStartTime(sentences, speed, nextIndex, 1)
      : findStartTime(sentences, speed, previousIndex, -1);
  }

  const previousStartTime = findStartTime(sentences, speed, previousIndex, -1);
  if (previousStartTime === undefined) {
    return nextIndex >= 0 ? findStartTime(sentences, speed, nextIndex, 1) : undefined;
  }

  if (currentTimeMs - previousStartTime > 1000) return previousStartTime;

  return findStartTime(sentences, speed, previousIndex - 1, -1) ?? previousStartTime;
}
