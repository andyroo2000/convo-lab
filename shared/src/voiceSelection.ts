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

export type VoiceLanguage = keyof typeof TTS_VOICES;

export interface VoiceConfig {
  id: string;
  gender: string;
  description: string;
  provider?: 'google' | 'polly' | 'fishaudio';
  hiddenFromPicker?: boolean;
}

export type VoiceAvatarTone = 'casual' | 'polite' | 'formal';

const SUPPORTED_VOICE_AVATAR_LANGUAGES = new Set(['ja']);

// Voice-specific avatar files take precedence over tone-derived fallback filenames.
const VOICE_AVATAR_FILENAME_BY_ID: Record<string, string> = {
  'fishaudio:0dff3f6860294829b98f8c4501b2cf25': 'voices/ja-nakamura.jpg',
  'fishaudio:875668667eb94c20b09856b971d9ca2f': 'voices/ja-sato.jpg',
  'fishaudio:abb4362e736f40b7b5716f4fafcafa9f': 'voices/ja-ren.jpg',
  'fishaudio:b3e9710c629a472f8224e1c4975a869e': 'voices/ja-otani.jpg',
  'fishaudio:72416f3ff95541d9a2456b945e8a7c32': 'voices/ja-rina.jpg',
  'fishaudio:e6e20195abee4187bddfd1a2609a04f9': 'voices/ja-yu.jpg',
  'fishaudio:351aa1e3ef354082bc1f4294d4eea5d0': 'voices/ja-hana.jpg',
  'fishaudio:694e06f2dcc44e4297961d68d6a98313': 'voices/ja-mika.jpg',
  'fishaudio:9639f090aa6346329d7d3aca7e6b7226': 'voices/ja-yumi.jpg',
  'ja-JP-Neural2-B': 'voices/ja-nanami.jpg',
  'ja-JP-Wavenet-C': 'voices/ja-shohei.jpg',
  'ja-JP-Wavenet-D': 'voices/ja-naoki.jpg',
  Takumi: 'voices/ja-takumi.jpg',
  Kazuha: 'voices/ja-kazuha.jpg',
  Tomoko: 'voices/ja-tomoko.jpg',
};

// Keep this tone override map current when adding voices; description-keyword inference is only
// a fallback for voices without an explicit tone.
const VOICE_AVATAR_TONE_BY_ID: Record<string, VoiceAvatarTone> = {
  'fishaudio:ac934b39586e475b83f3277cd97b5cd4': 'formal',
  'fishaudio:1f638e52c8274648bf8c0427f1688205': 'formal',
  'fishaudio:6810b0ea7c094d6c9d8cd1cb871dc82a': 'casual',
  'en-US-Neural2-J': 'formal',
  'en-US-Neural2-D': 'polite',
  'en-US-Neural2-A': 'formal',
  'en-US-Neural2-I': 'casual',
  'en-US-Neural2-F': 'polite',
  'en-US-Neural2-H': 'formal',
  'en-US-Neural2-G': 'polite',
  'en-US-Neural2-C': 'casual',
  'fishaudio:0dff3f6860294829b98f8c4501b2cf25': 'formal',
  'fishaudio:875668667eb94c20b09856b971d9ca2f': 'casual',
  'fishaudio:abb4362e736f40b7b5716f4fafcafa9f': 'polite',
  'fishaudio:b3e9710c629a472f8224e1c4975a869e': 'formal',
  'fishaudio:72416f3ff95541d9a2456b945e8a7c32': 'polite',
  'fishaudio:e6e20195abee4187bddfd1a2609a04f9': 'polite',
  'fishaudio:351aa1e3ef354082bc1f4294d4eea5d0': 'casual',
  'fishaudio:694e06f2dcc44e4297961d68d6a98313': 'casual',
  'fishaudio:9639f090aa6346329d7d3aca7e6b7226': 'polite',
  'ja-JP-Wavenet-A': 'casual',
  'ja-JP-Wavenet-B': 'polite',
  'ja-JP-Neural2-B': 'casual',
  'ja-JP-Wavenet-C': 'casual',
  'ja-JP-Wavenet-D': 'formal',
  'ja-JP-Neural2-C': 'formal',
  'ja-JP-Neural2-D': 'polite',
  Takumi: 'casual',
  Kazuha: 'polite',
  Tomoko: 'polite',
};

function inferVoiceAvatarTone(voice: VoiceConfig): VoiceAvatarTone {
  const text = voice.description.toLowerCase();

  if (
    text.includes('professional') ||
    text.includes('measured') ||
    text.includes('authoritative') ||
    text.includes('confident')
  ) {
    return 'formal';
  }

  if (
    text.includes('warm') ||
    text.includes('gentle') ||
    text.includes('pleasant') ||
    text.includes('sincere') ||
    text.includes('empathetic') ||
    text.includes('smooth')
  ) {
    return 'polite';
  }

  return 'casual';
}

export function getTtsVoiceAvatarFilename(language: string, voice: VoiceConfig): string | null {
  const voiceAvatarFilename = VOICE_AVATAR_FILENAME_BY_ID[voice.id];
  if (voiceAvatarFilename) {
    return voiceAvatarFilename;
  }

  const normalizedLanguage = language.toLowerCase();
  const normalizedGender = voice.gender.toLowerCase();

  if (
    !SUPPORTED_VOICE_AVATAR_LANGUAGES.has(normalizedLanguage) ||
    (normalizedGender !== 'male' && normalizedGender !== 'female')
  ) {
    return null;
  }

  const tone = VOICE_AVATAR_TONE_BY_ID[voice.id] ?? inferVoiceAvatarTone(voice);
  return `${normalizedLanguage}-${normalizedGender}-${tone}.jpg`;
}

export function getTtsVoiceAvatarPath(language: string, voice: VoiceConfig): string | null {
  const filename = getTtsVoiceAvatarFilename(language, voice);
  return filename ? `/api/avatars/${filename}` : null;
}

export function getTtsVoices(language: string): VoiceConfig[] {
  return [...((TTS_VOICES[language as VoiceLanguage]?.voices || []) as ReadonlyArray<VoiceConfig>)];
}

export function getSelectableTtsVoices(language: string): VoiceConfig[] {
  return getTtsVoices(language).filter((voice) => !voice.hiddenFromPicker);
}

export function getTtsVoiceById(language: string, voiceId: string): VoiceConfig | undefined {
  return getTtsVoices(language).find((voice) => voice.id === voiceId);
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
  const allTargetVoices = getSelectableTtsVoices(targetLanguage);
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
  const targetVoices = getSelectableTtsVoices(targetLanguage);

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
