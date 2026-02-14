export type TimePracticeMode = 'fsrs' | 'random';
export type TimeDisplayMode = 'script' | 'digital';

export interface TimePracticeCard {
  id: string;
  hour24: number;
  minute: number;
}

export interface TimePracticeSettings {
  revealDelaySeconds: number;
  showFurigana: boolean;
  autoPlayAudio: boolean;
  displayMode: TimeDisplayMode;
  maxNewCardsPerDay: number;
  randomAutoLoop: boolean;
}

export const DEFAULT_TIME_PRACTICE_SETTINGS: TimePracticeSettings = {
  revealDelaySeconds: 5,
  showFurigana: true,
  autoPlayAudio: true,
  displayMode: 'script',
  maxNewCardsPerDay: 20,
  randomAutoLoop: true,
};

export function createTimeCard(hour24: number, minute: number): TimePracticeCard {
  const clampedHour = Math.max(0, Math.min(23, Math.trunc(hour24)));
  const clampedMinute = Math.max(0, Math.min(59, Math.trunc(minute)));

  return {
    id: `jp-time:24h:${clampedHour}:${clampedMinute}`,
    hour24: clampedHour,
    minute: clampedMinute,
  };
}

export function createRandomTimeCard(): TimePracticeCard {
  const hour24 = Math.floor(Math.random() * 24);
  const minute = Math.floor(Math.random() * 60);
  return createTimeCard(hour24, minute);
}

export const FULL_DAY_TIME_CARD_POOL: TimePracticeCard[] = Array.from(
  { length: 24 * 60 },
  (_, index) => {
    const hour24 = Math.floor(index / 60);
    const minute = index % 60;
    return createTimeCard(hour24, minute);
  }
);
