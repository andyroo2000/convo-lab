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
  provider?: 'google' | 'polly' | 'fishaudio';
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
  const hasFishAudio = allTargetVoices.some((voice) => voice.provider === 'fishaudio');
  const preferredVoices = hasFishAudio
    ? allTargetVoices.filter((voice) => voice.provider === 'fishaudio')
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
    ? [...(voicesConfig as ReadonlyArray<VoiceConfig>)]
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
 * Convert a voice ID to a sanitized filename for voice preview audio files.
 * Used by both the generation script and the client VoicePreview component.
 */
export function voiceIdToFilename(voiceId: string): string {
  if (!voiceId || voiceId.includes('..') || voiceId.includes('/') || voiceId.includes('\\')) {
    throw new Error('Invalid voice ID');
  }

  const sanitized = voiceId
    .toLowerCase()
    .replace(/:/g, '_')
    .replace(/[,]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  if (!sanitized) {
    throw new Error('Voice ID sanitization resulted in empty string');
  }

  return sanitized;
}

/**
 * Detect TTS provider from voice ID format
 * Google voice IDs contain hyphens (e.g., "ja-JP-Neural2-B")
 * Polly voice IDs are single words (e.g., "Mizuki", "Takumi", "Zhiyu")
 */
export function getProviderFromVoiceId(voiceId: string): 'google' | 'polly' | 'fishaudio' {
  // Fish Audio voice IDs are prefixed with "fishaudio:"
  if (voiceId.startsWith('fishaudio:')) {
    return 'fishaudio';
  }

  // Try to resolve via known voice config
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
  return 'polly';
}

/**
 * Extract language code from voice ID
 * For Google: Extract from format "ja-JP-Neural2-B" → "ja-JP"
 * For Polly/Fish Audio: Look up in voice configuration
 */
export function getLanguageCodeFromVoiceId(voiceId: string): string {
  const provider = getProviderFromVoiceId(voiceId);

  if (provider === 'google') {
    // Extract from "ja-JP-Neural2-B" → "ja-JP"
    return voiceId.split('-').slice(0, 2).join('-');
  }

  // For Polly/Fish Audio, look up in voice config
  for (const [, config] of Object.entries(TTS_VOICES)) {
    const voice = config.voices.find((v: { id: string }) => v.id === voiceId);
    if (voice) return config.languageCode;
  }

  throw new Error(`Unknown voice ID: ${voiceId}`);
}
