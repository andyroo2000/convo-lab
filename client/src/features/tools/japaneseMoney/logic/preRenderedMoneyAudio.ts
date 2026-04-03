import { playAudioClipSequence, type AudioSequencePlayback } from '../../logic/audioClipPlayback';
import { buildMoneyReading } from './moneyFormatting';

type MoneyPlaybackOptions = {
  volume?: number;
};

const MONEY_AUDIO_BASE_URL = '/tools-audio/japanese-money/google-kento-professional';
const MAX_SUPPORTED_AMOUNT = 9_999_999_999_999;
const MONEY_INTER_CLIP_TRIM_MS = 90;
const MAX_OKU_COMPOUND_CHUNK = 99;

const UNIT_AUDIO_FILE_BY_SCRIPT: Record<string, string> = {
  '': '',
  万: 'man',
  億: 'oku',
  兆: 'cho',
};

function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error('amount must be a finite number');
  }

  const normalized = Math.trunc(amount);
  if (normalized < 0) {
    throw new Error('amount must be greater than or equal to 0');
  }

  if (normalized > MAX_SUPPORTED_AMOUNT) {
    throw new Error(`amount must be less than or equal to ${MAX_SUPPORTED_AMOUNT}`);
  }

  return normalized;
}

const toChunkAudioPath = (value: number): string =>
  `${MONEY_AUDIO_BASE_URL}/money/chunk/${String(value).padStart(4, '0')}.mp3`;

const toManChunkAudioPath = (value: number): string =>
  `${MONEY_AUDIO_BASE_URL}/money/man-chunk/${String(value).padStart(4, '0')}.mp3`;

const toOkuChunkAudioPath = (value: number): string =>
  `${MONEY_AUDIO_BASE_URL}/money/oku-chunk/${String(value).padStart(4, '0')}.mp3`;

const toUnitAudioPath = (unitFile: string): string =>
  `${MONEY_AUDIO_BASE_URL}/money/unit/${unitFile}.mp3`;

export function buildMoneyAudioClipUrls(amount: number): string[] {
  const safeAmount = normalizeAmount(amount);
  const reading = buildMoneyReading(safeAmount);
  const urls: string[] = [];

  reading.segments.forEach((segment) => {
    const chunkValue = Number.parseInt(segment.digits, 10);
    if (!Number.isInteger(chunkValue) || chunkValue < 0 || chunkValue > 9999) {
      throw new Error(`money chunk must be between 0 and 9999; received ${segment.digits}`);
    }

    if (segment.unitScript === '万') {
      urls.push(toManChunkAudioPath(chunkValue));
      return;
    }

    if (segment.unitScript === '億' && chunkValue >= 1 && chunkValue <= MAX_OKU_COMPOUND_CHUNK) {
      urls.push(toOkuChunkAudioPath(chunkValue));
      return;
    }

    urls.push(toChunkAudioPath(chunkValue));

    const unitAudioFile = UNIT_AUDIO_FILE_BY_SCRIPT[segment.unitScript];
    if (unitAudioFile === undefined) {
      throw new Error(`unsupported unit script in money reading: ${segment.unitScript}`);
    }

    if (unitAudioFile) {
      urls.push(toUnitAudioPath(unitAudioFile));
    }
  });

  return urls;
}

export function playMoneyAudioClipSequence(
  urls: string[],
  options: MoneyPlaybackOptions = {}
): AudioSequencePlayback {
  return playAudioClipSequence(urls, {
    ...options,
    clipTrimEndMs: MONEY_INTER_CLIP_TRIM_MS,
  });
}
