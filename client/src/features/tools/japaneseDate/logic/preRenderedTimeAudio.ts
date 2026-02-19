export { playAudioClipSequence, type AudioSequencePlayback } from '../../logic/audioClipPlayback';

export type TimeHourFormat = '12h' | '24h';

type TimeAudioSegmentArgs = {
  hour24: number;
  minute: number;
  hourFormat: TimeHourFormat;
};

const TIME_AUDIO_BASE_URL = '/tools-audio/japanese-time/google-kento-professional';

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

function assertRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

export function buildTimeAudioClipUrls(args: TimeAudioSegmentArgs): string[] {
  const { hour24, minute, hourFormat } = args;
  assertRange('hour24', hour24, 0, 23);
  assertRange('minute', minute, 0, 59);

  const minutePath = `${TIME_AUDIO_BASE_URL}/time/minute/${toTwoDigits(minute)}.mp3`;
  const hourPath =
    hourFormat === '12h'
      ? `${TIME_AUDIO_BASE_URL}/time/12h/part1/${hour24 < 12 ? 'gozen' : 'gogo'}-${toTwoDigits(hour24 % 12 || 12)}.mp3`
      : `${TIME_AUDIO_BASE_URL}/time/24h/part1/${toTwoDigits(hour24)}.mp3`;

  return [hourPath, minutePath];
}
