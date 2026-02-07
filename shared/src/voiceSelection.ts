import { TTS_VOICES, DEFAULT_NARRATOR_VOICES } from './constants-new.js';

export interface CourseSpeakerVoices {
  narratorVoice: string;
  speakerVoices: string[];
}

export interface DialogueSpeakerVoice {
  id: string;
  voiceId: string;
  gender: string;
  description: string;
}

interface VoiceConfig {
  id: string;
  gender: string;
  description: string;
  provider?: 'google' | 'polly' | 'elevenlabs';
}

export function getCourseSpeakerVoices(
  targetLanguage: string,
  nativeLanguage: string,
  numSpeakers: number = 2
): CourseSpeakerVoices {
  // Get narrator voice from defaults
  const narratorVoice =
    DEFAULT_NARRATOR_VOICES[nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES] || '';

  // Get speaker voices (target language)
  const allTargetVoices = (TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices ||
    []) as ReadonlyArray<VoiceConfig>;
  const preferredVoices = allTargetVoices.some((voice) => voice.provider === 'elevenlabs')
    ? allTargetVoices.filter((voice) => voice.provider === 'elevenlabs')
    : allTargetVoices;

  let speakerVoices: string[] = [];

  if (numSpeakers === 2) {
    const maleVoices = preferredVoices.filter((voice) => voice.gender === 'male');
    const femaleVoices = preferredVoices.filter((voice) => voice.gender === 'female');

    if (maleVoices.length > 0 && femaleVoices.length > 0) {
      const male = maleVoices[Math.floor(Math.random() * maleVoices.length)];
      const female = femaleVoices[Math.floor(Math.random() * femaleVoices.length)];
      speakerVoices = [male.id, female.id];
    }
  }

  if (speakerVoices.length === 0) {
    speakerVoices = preferredVoices.slice(0, numSpeakers).map((v) => v.id);
  }

  return {
    narratorVoice,
    speakerVoices,
  };
}

export function getDialogueSpeakerVoices(
  targetLanguage: string,
  numSpeakers: number = 2
): DialogueSpeakerVoice[] {
  // Get speaker voices for dialogue (target language only)
  const voicesConfig = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices;
  const targetVoices: VoiceConfig[] = voicesConfig
    ? (voicesConfig as ReadonlyArray<VoiceConfig>).filter(
        (voice) => voice.provider !== 'elevenlabs'
      )
    : [];

  // For 2 speakers, ensure gender diversity (one male, one female)
  if (numSpeakers === 2) {
    const maleVoices = targetVoices.filter((v) => v.gender === 'male');
    const femaleVoices = targetVoices.filter((v) => v.gender === 'female');

    if (maleVoices.length > 0 && femaleVoices.length > 0) {
      // Pick one random male and one random female
      const male = maleVoices[Math.floor(Math.random() * maleVoices.length)];
      const female = femaleVoices[Math.floor(Math.random() * femaleVoices.length)];

      // Randomize order (50% chance male first, 50% female first)
      const selected = Math.random() < 0.5 ? [male, female] : [female, male];

      return selected.map((v) => ({
        id: v.id,
        voiceId: v.id,
        gender: v.gender,
        description: v.description,
      }));
    }
  }

  // Fallback: just take first N voices
  return targetVoices.slice(0, numSpeakers).map((v) => ({
    id: v.id,
    voiceId: v.id,
    gender: v.gender,
    description: v.description,
  }));
}

/**
 * Detect TTS provider from voice ID format
 * Google voice IDs contain hyphens (e.g., "ja-JP-Neural2-B")
 * Polly voice IDs are single words (e.g., "Mizuki", "Takumi", "Zhiyu")
 */
export function getProviderFromVoiceId(voiceId: string): 'google' | 'polly' | 'elevenlabs' {
  // First try to resolve via known voice config (preferred for ElevenLabs)
  for (const [, config] of Object.entries(TTS_VOICES)) {
    const voice = config.voices.find((v: VoiceConfig) => v.id === voiceId);
    if (voice?.provider) {
      return voice.provider;
    }
  }

  // Google voice IDs follow language-region prefix (e.g., "ja-JP-Neural2-B")
  if (/^[a-z]{2}-[A-Z]{2}-/.test(voiceId)) {
    return 'google';
  }

  // Polly voices are single-word IDs (no hyphens)
  if (!voiceId.includes('-')) {
    return 'polly';
  }

  // Fallback for unknown IDs (UUID-like) - assume ElevenLabs
  return 'elevenlabs';
}

/**
 * Extract language code from voice ID
 * For Google: Extract from format "ja-JP-Neural2-B" → "ja-JP"
 * For Polly/ElevenLabs: Look up in voice configuration
 */
export function getLanguageCodeFromVoiceId(voiceId: string): string {
  const provider = getProviderFromVoiceId(voiceId);

  if (provider === 'google') {
    // Extract from "ja-JP-Neural2-B" → "ja-JP"
    return voiceId.split('-').slice(0, 2).join('-');
  }

  // For Polly, look up in voice config
  for (const [, config] of Object.entries(TTS_VOICES)) {
    const voice = config.voices.find((v: { id: string }) => v.id === voiceId);
    if (voice) return config.languageCode;
  }

  throw new Error(`Unknown voice ID: ${voiceId}`);
}
