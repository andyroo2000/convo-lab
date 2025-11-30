import { TTS_VOICES, DEFAULT_NARRATOR_VOICES } from './constants-new';

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
}

export function getCourseSpeakerVoices(
  targetLanguage: string,
  nativeLanguage: string,
  numSpeakers: number = 2
): CourseSpeakerVoices {
  // Get narrator voice from defaults (Neural2 voices that support timepointing)
  const narratorVoice = DEFAULT_NARRATOR_VOICES[nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES] || '';

  // Get speaker voices (target language)
  const targetVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];
  const speakerVoices = targetVoices.slice(0, numSpeakers).map(v => v.id);

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
  const targetVoices: VoiceConfig[] = voicesConfig ? [...voicesConfig] : [];

  // For 2 speakers, ensure gender diversity (one male, one female)
  if (numSpeakers === 2) {
    const maleVoices = targetVoices.filter(v => v.gender === 'male');
    const femaleVoices = targetVoices.filter(v => v.gender === 'female');

    if (maleVoices.length > 0 && femaleVoices.length > 0) {
      // Pick one random male and one random female
      const male = maleVoices[Math.floor(Math.random() * maleVoices.length)];
      const female = femaleVoices[Math.floor(Math.random() * femaleVoices.length)];

      // Randomize order (50% chance male first, 50% female first)
      const selected = Math.random() < 0.5 ? [male, female] : [female, male];

      return selected.map(v => ({
        id: v.id,
        voiceId: v.id,
        gender: v.gender,
        description: v.description,
      }));
    }
  }

  // Fallback: just take first N voices
  return targetVoices.slice(0, numSpeakers).map(v => ({
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
export function getProviderFromVoiceId(voiceId: string): 'google' | 'polly' {
  if (voiceId.includes('-')) {
    return 'google';
  }
  return 'polly';
}

/**
 * Extract language code from voice ID
 * For Google: Extract from format "ja-JP-Neural2-B" → "ja-JP"
 * For Polly: Look up in voice configuration
 */
export function getLanguageCodeFromVoiceId(voiceId: string): string {
  const provider = getProviderFromVoiceId(voiceId);

  if (provider === 'google') {
    // Extract from "ja-JP-Neural2-B" → "ja-JP"
    return voiceId.split('-').slice(0, 2).join('-');
  }

  // For Polly, look up in voice config
  for (const [lang, config] of Object.entries(TTS_VOICES)) {
    const voice = config.voices.find((v: any) => v.id === voiceId);
    if (voice) return config.languageCode;
  }

  throw new Error(`Unknown voice ID: ${voiceId}`);
}
