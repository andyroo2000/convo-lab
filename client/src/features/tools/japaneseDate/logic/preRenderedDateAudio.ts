import { playAudioClipSequence, type AudioSequencePlayback } from '../../logic/audioClipPlayback';

type DateAudioSegmentArgs = {
  year: number;
  month: number;
  day: number;
  includeYear?: boolean;
};

type DatePlaybackOptions = {
  volume?: number;
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
  const { year, month, day, includeYear = true } = args;

  assertRange('year', year, MIN_YEAR, MAX_YEAR);
  assertRange('month', month, 1, 12);
  assertRange('day', day, 1, 31);

  const urls = [
    `${DATE_AUDIO_BASE_URL}/date/month/${toTwoDigits(month)}.mp3`,
    `${DATE_AUDIO_BASE_URL}/date/day/${toTwoDigits(day)}.mp3`,
  ];

  if (includeYear) {
    urls.unshift(`${DATE_AUDIO_BASE_URL}/date/year/${year}.mp3`);
  }

  return urls;
}

export function playDateAudioClipSequence(
  urls: string[],
  options: DatePlaybackOptions = {}
): AudioSequencePlayback {
  return playAudioClipSequence(urls, options);
}

export function getDateAudioYearRange() {
  return { minYear: MIN_YEAR, maxYear: MAX_YEAR };
}
