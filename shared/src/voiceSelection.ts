import { TTS_VOICES, DEFAULT_NARRATOR_VOICES } from './constants.js';
import { LanguageCode } from './types.js';

/**
 * Shared voice selection utilities with duplicate prevention
 * Used across dialogue generation, course creation, etc.
 */

export interface VoiceSelectionOptions {
  /** Language code for voice selection */
  language: LanguageCode;
  /** Preferred gender (optional - if not specified, any gender is allowed) */
  gender?: 'male' | 'female';
  /** Voices to exclude from selection */
  excludeVoices?: string[];
  /** Number of unique voices needed */
  count?: number;
}

/**
 * Get a single random voice with optional constraints
 */
export function getRandomVoice(options: VoiceSelectionOptions): string {
  const { language, gender, excludeVoices = [] } = options;

  const languageVoices = TTS_VOICES[language as keyof typeof TTS_VOICES]?.voices || [];

  // Filter by gender if specified
  let availableVoices = gender
    ? [...languageVoices].filter(v => v.gender === gender)
    : [...languageVoices];

  // Exclude specified voices
  if (excludeVoices.length > 0) {
    availableVoices = availableVoices.filter(v => !excludeVoices.includes(v.id));
  }

  // Fallback to all voices if no matches
  if (availableVoices.length === 0) {
    availableVoices = [...languageVoices];
  }

  // Return random voice
  if (availableVoices.length === 0) {
    throw new Error(`No voices available for language: ${language}`);
  }

  return availableVoices[Math.floor(Math.random() * availableVoices.length)].id;
}

/**
 * Get multiple unique random voices with constraints
 * Ensures no duplicate voices are selected
 */
export function getRandomVoices(options: VoiceSelectionOptions): string[] {
  const { language, gender, excludeVoices = [], count = 1 } = options;

  const languageVoices = [...(TTS_VOICES[language as keyof typeof TTS_VOICES]?.voices || [])];

  // Filter by gender if specified
  let availableVoices = gender
    ? languageVoices.filter(v => v.gender === gender)
    : languageVoices;

  // Exclude specified voices
  if (excludeVoices.length > 0) {
    availableVoices = availableVoices.filter(v => !excludeVoices.includes(v.id));
  }

  // Fallback to all voices if no matches
  if (availableVoices.length === 0) {
    availableVoices = languageVoices;
  }

  if (availableVoices.length === 0) {
    throw new Error(`No voices available for language: ${language}`);
  }

  // If requesting more voices than available, return all available voices
  const numToSelect = Math.min(count, availableVoices.length);

  // Shuffle and take first N voices to ensure uniqueness
  const shuffled = [...availableVoices].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, numToSelect).map(v => v.id);
}

/**
 * Get voices for dialogue speakers with automatic gender distribution
 * Ensures speakers have different voices
 */
export function getDialogueSpeakerVoices(
  language: LanguageCode,
  speakerCount: number = 2
): Array<{ gender: 'male' | 'female'; voiceId: string }> {
  const result: Array<{ gender: 'male' | 'female'; voiceId: string }> = [];

  // Alternate genders for variety
  const genders: Array<'male' | 'female'> = [];
  for (let i = 0; i < speakerCount; i++) {
    genders.push(i % 2 === 0 ? 'female' : 'male');
  }

  // Get unique voices for each speaker
  const usedVoices: string[] = [];

  for (const gender of genders) {
    const voiceId = getRandomVoice({
      language,
      gender,
      excludeVoices: usedVoices,
    });

    result.push({ gender, voiceId });
    usedVoices.push(voiceId);
  }

  return result;
}

/**
 * Get voices for course speakers, excluding the narrator voice
 */
export function getCourseSpeakerVoices(
  targetLanguage: LanguageCode,
  nativeLanguage: LanguageCode,
  speakerCount: number = 2
): { narratorVoice: string; speakerVoices: string[] } {
  // Get narrator voice for native language
  const narratorVoice = DEFAULT_NARRATOR_VOICES[nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES] ||
    TTS_VOICES[nativeLanguage as keyof typeof TTS_VOICES]?.voices[0]?.id || '';

  // Get unique speaker voices, excluding narrator
  const speakerVoices = getRandomVoices({
    language: targetLanguage,
    excludeVoices: [narratorVoice],
    count: speakerCount,
  });

  return {
    narratorVoice,
    speakerVoices,
  };
}

/**
 * Get all available voices for a language, grouped by gender
 */
export function getVoicesByGender(language: LanguageCode): {
  male: string[];
  female: string[];
} {
  const languageVoices = [...(TTS_VOICES[language as keyof typeof TTS_VOICES]?.voices || [])];

  return {
    male: languageVoices.filter(v => v.gender === 'male').map(v => v.id),
    female: languageVoices.filter(v => v.gender === 'female').map(v => v.id),
  };
}
