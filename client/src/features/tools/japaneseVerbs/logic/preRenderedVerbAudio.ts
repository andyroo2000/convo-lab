import { playAudioClipSequence, type AudioSequencePlayback } from '../../logic/audioClipPlayback';
import type { VerbPracticeCard } from './verbConjugation';

type VerbPlaybackOptions = {
  volume?: number;
};

export type VerbAudioCard = Pick<VerbPracticeCard, 'verb' | 'conjugation'>;

// Voice: Google Cloud TTS ja-JP-Neural2-C ("Kento" — internal label for this male Neural2 voice).
// Matches the GCS path: gs://convolab-storage/tools-audio/japanese-verbs/google-kento-professional/
const VERB_AUDIO_BASE_URL = '/tools-audio/japanese-verbs/google-kento-professional';

export function buildVerbAudioClipUrl(card: VerbAudioCard): string {
  return `${VERB_AUDIO_BASE_URL}/${card.verb.id}/${card.conjugation.id}.mp3`;
}

export function playVerbAudioClip(
  card: VerbAudioCard,
  options: VerbPlaybackOptions = {}
): AudioSequencePlayback {
  return playAudioClipSequence([buildVerbAudioClipUrl(card)], options);
}
