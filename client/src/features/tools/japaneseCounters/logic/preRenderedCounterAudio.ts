import {
  playAudioClipSequence,
  type AudioSequencePlayback,
} from '../../japaneseDate/logic/preRenderedTimeAudio';
import type { CounterPracticeCard } from './counterPractice';

type CounterPlaybackOptions = {
  volume?: number;
};

export type CounterAudioCard = Pick<CounterPracticeCard, 'counterId' | 'quantity'> & {
  object: Pick<CounterPracticeCard['object'], 'id'>;
};

const COUNTER_AUDIO_BASE_URL = '/tools-audio/japanese-counters/google-kento-professional';

function assertRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
}

export function buildCounterAudioClipUrl(card: CounterAudioCard): string {
  const { counterId, quantity, object } = card;
  assertRange('quantity', quantity, 1, 10);

  return `${COUNTER_AUDIO_BASE_URL}/phrase/${counterId}/${object.id}/${String(quantity).padStart(2, '0')}.mp3`;
}

export function playCounterAudioClip(
  card: CounterAudioCard,
  options: CounterPlaybackOptions = {}
): AudioSequencePlayback {
  return playAudioClipSequence([buildCounterAudioClipUrl(card)], options);
}
