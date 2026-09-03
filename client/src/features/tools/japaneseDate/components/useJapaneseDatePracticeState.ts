import { useMemo, useRef, useState } from 'react';

import type { AudioSequencePlayback } from '../../logic/audioClipPlayback';
import {
  generateJapaneseDateTimeReading,
  parseLocalDateTimeInput,
  toLocalDateInputValue,
} from '../logic/readingEngine';
import { getDateAudioYearRange } from '../logic/preRenderedDateAudio';

export interface DatePracticeCard {
  id: string;
  date: Date;
}

export interface DateCardSnapshot {
  card: DatePracticeCard;
  isRevealed: boolean;
}

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

export const createDateCard = (date: Date): DatePracticeCard => {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0);
  return {
    id: `${normalized.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    date: normalized,
  };
};

const createCurrentLocalDateCard = () => createDateCard(new Date());

const formatDateDisplay = (date: Date, showYear: boolean) => {
  const year = String(date.getFullYear());
  const month = toTwoDigits(date.getMonth() + 1);
  const day = toTwoDigits(date.getDate());
  return showYear ? `${year}/${month}/${day}` : `${month}/${day}`;
};

const getStatusText = (
  isPowerOn: boolean,
  countdownSeconds: number | null,
  isRevealed: boolean,
  isPlaying: boolean
) => {
  if (!isPowerOn || countdownSeconds === null) return '';
  if (!isRevealed) return `answer in ${countdownSeconds}s`;
  if (!isPlaying) return `replaying in ${countdownSeconds}s`;
  return '';
};

const useJapaneseDatePracticeState = () => {
  const { minYear, maxYear } = getDateAudioYearRange();
  const [card, setCard] = useState<DatePracticeCard>(createCurrentLocalDateCard);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showYear, setShowYear] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [pauseSeconds, setPauseSeconds] = useState(8);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [isNextLedActive, setIsNextLedActive] = useState(false);
  const [playbackHint, setPlaybackHint] = useState<string | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextLedTimerRef = useRef<number | null>(null);
  const playbackRef = useRef<AudioSequencePlayback | null>(null);
  const isFirstPowerOnRef = useRef(true);
  const previousCardsRef = useRef<DateCardSnapshot[]>([]);
  const dateValue = useMemo(() => toLocalDateInputValue(card.date), [card.date]);
  const reading = useMemo(
    () =>
      generateJapaneseDateTimeReading(parseLocalDateTimeInput(dateValue, '09:00'), {
        hourFormat: '24h',
      }),
    [dateValue]
  );
  const dateDisplay = useMemo(() => formatDateDisplay(card.date, showYear), [card.date, showYear]);
  const statusText = getStatusText(isPowerOn, countdownSeconds, isRevealed, isPlaying);

  return {
    autoAdvanceTimerRef,
    card,
    countdownIntervalRef,
    countdownSeconds,
    dateDisplay,
    isFirstPowerOnRef,
    isNextLedActive,
    isPlaying,
    isPowerOn,
    isRevealed,
    maxYear,
    minYear,
    nextLedTimerRef,
    pauseSeconds,
    playbackHint,
    playbackRef,
    previousCardsRef,
    reading,
    revealTimerRef,
    setCard,
    setCountdownSeconds,
    setIsNextLedActive,
    setIsPlaying,
    setIsPowerOn,
    setIsRevealed,
    setPauseSeconds,
    setPlaybackHint,
    setShowYear,
    setVolumeLevel,
    showYear,
    statusText,
    volumeLevel,
  };
};

export type JapaneseDatePracticeState = ReturnType<typeof useJapaneseDatePracticeState>;

export default useJapaneseDatePracticeState;
