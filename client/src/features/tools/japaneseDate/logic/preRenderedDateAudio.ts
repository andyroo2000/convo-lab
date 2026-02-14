import { playAudioClipSequence, type AudioSequencePlayback } from './preRenderedTimeAudio';

type DateAudioSegmentArgs = {
  year: number;
  month: number;
  day: number;
};

const DATE_AUDIO_BASE_URL = '/tools-audio/japanese-date/google-kento-professional';
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function assertRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

export function buildDateAudioClipUrls(args: DateAudioSegmentArgs): string[] {
  const { year, month, day } = args;

  assertRange('year', year, MIN_YEAR, MAX_YEAR);
  assertRange('month', month, 1, 12);
  assertRange('day', day, 1, 31);

  return [
    `${DATE_AUDIO_BASE_URL}/date/year/${year}.mp3`,
    `${DATE_AUDIO_BASE_URL}/date/month/${toTwoDigits(month)}.mp3`,
    `${DATE_AUDIO_BASE_URL}/date/day/${toTwoDigits(day)}.mp3`,
  ];
}

export function playDateAudioClipSequence(urls: string[]): AudioSequencePlayback {
  return playAudioClipSequence(urls);
}

export function getDateAudioYearRange() {
  return { minYear: MIN_YEAR, maxYear: MAX_YEAR };
}
