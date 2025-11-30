import { LanguageInfo, LanguageCode } from './types.js';

export const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    rtl: true,
  },
  he: {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    rtl: true,
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
  },
};

export const PROFICIENCY_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'native',
] as const;

export const TONE_STYLES = [
  'casual',
  'polite',
  'formal',
] as const;

// TTS Voice Configuration
// Supports both Google Cloud TTS and Amazon Polly providers
// Google: Neural2 and Wavenet voices (support enableTimePointing for batched TTS)
// Polly: Neural voices (support Speech Marks for batched TTS)
// Journey and Studio voices do NOT support timepointing and have been removed
export const TTS_VOICES = {
  en: {
    languageCode: 'en-US',
    voices: [
      // Male Neural2 voices (Google)
      { id: 'en-US-Neural2-J', gender: 'male', description: 'Guy - Deep and authoritative', provider: 'google' },
      { id: 'en-US-Neural2-D', gender: 'male', description: 'Andrew - Warm and conversational', provider: 'google' },
      { id: 'en-US-Neural2-A', gender: 'male', description: 'James - Clear and professional', provider: 'google' },
      { id: 'en-US-Neural2-I', gender: 'male', description: 'Michael - Friendly and engaging', provider: 'google' },
      // Female Neural2 voices (Google)
      { id: 'en-US-Neural2-F', gender: 'female', description: 'Jenny - Pleasant and approachable', provider: 'google' },
      { id: 'en-US-Neural2-H', gender: 'female', description: 'Aria - Confident and warm', provider: 'google' },
      { id: 'en-US-Neural2-G', gender: 'female', description: 'Sara - Calm and sincere', provider: 'google' },
      { id: 'en-US-Neural2-C', gender: 'female', description: 'Emma - Bright and cheerful', provider: 'google' },
    ],
  },
  ja: {
    languageCode: 'ja-JP',
    voices: [
      // Google voices (Neural2 + Wavenet)
      { id: 'ja-JP-Neural2-B', gender: 'female', description: 'Nanami - Bright and cheerful', provider: 'google' },
      { id: 'ja-JP-Wavenet-A', gender: 'female', description: 'Mayu - Animated and bright', provider: 'google' },
      { id: 'ja-JP-Wavenet-D', gender: 'female', description: 'Shiori - Calm and clear', provider: 'google' },
      { id: 'ja-JP-Neural2-C', gender: 'male', description: 'Naoki - Confident and clear', provider: 'google' },
      { id: 'ja-JP-Neural2-D', gender: 'male', description: 'Daichi - Warm and conversational', provider: 'google' },
      // Polly voices (Neural)
      { id: 'Takumi', gender: 'male', description: 'Takumi - Natural and smooth', provider: 'polly' },
      { id: 'Kazuha', gender: 'female', description: 'Kazuha - Friendly and clear', provider: 'polly' },
      { id: 'Tomoko', gender: 'female', description: 'Tomoko - Natural and pleasant', provider: 'polly' },
    ],
  },
  zh: {
    languageCode: 'cmn-CN',
    voices: [
      // Google voices (Wavenet - Neural2 not available for Mandarin)
      { id: 'cmn-CN-Wavenet-A', gender: 'female', description: 'Xiaomei - Warm and friendly', provider: 'google' },
      { id: 'cmn-CN-Wavenet-D', gender: 'female', description: 'Xiaoli - Clear and gentle', provider: 'google' },
      { id: 'cmn-CN-Wavenet-B', gender: 'male', description: 'Wei - Natural and conversational', provider: 'google' },
      { id: 'cmn-CN-Wavenet-C', gender: 'male', description: 'Jun - Professional and clear', provider: 'google' },
      // Polly voices (Neural)
      { id: 'Zhiyu', gender: 'female', description: 'Zhiyu - Professional and natural', provider: 'polly' },
    ],
  },
  es: {
    languageCode: 'es-ES',
    voices: [
      // Polly voices (Neural) - Spain Spanish
      { id: 'Lucia', gender: 'female', description: 'Lucia - Clear and natural', provider: 'polly' },
      { id: 'Sergio', gender: 'male', description: 'Sergio - Professional and warm', provider: 'polly' },
      // Polly voices (Neural) - Mexican Spanish
      { id: 'Mia', gender: 'female', description: 'Mia - Friendly and engaging', provider: 'polly' },
      { id: 'Andrés', gender: 'male', description: 'Andrés - Natural and conversational', provider: 'polly' },
      // Polly voices (Neural) - US Spanish
      { id: 'Lupe', gender: 'female', description: 'Lupe - Clear and professional', provider: 'polly' },
      { id: 'Pedro', gender: 'male', description: 'Pedro - Warm and friendly', provider: 'polly' },
    ],
  },
  fr: {
    languageCode: 'fr-FR',
    voices: [
      // Polly voices (Neural) - France French
      { id: 'Léa', gender: 'female', description: 'Léa - Natural and pleasant', provider: 'polly' },
      { id: 'Rémi', gender: 'male', description: 'Rémi - Clear and professional', provider: 'polly' },
      // Polly voices (Neural) - Canadian French
      { id: 'Gabrielle', gender: 'female', description: 'Gabrielle - Warm and friendly', provider: 'polly' },
      { id: 'Liam', gender: 'male', description: 'Liam - Natural and engaging', provider: 'polly' },
    ],
  },
  ar: {
    languageCode: 'arb',
    voices: [
      // Polly voices (Neural) - Gulf Arabic
      { id: 'Hala', gender: 'female', description: 'Hala - Clear and natural', provider: 'polly' },
      { id: 'Zayd', gender: 'male', description: 'Zayd - Professional and warm', provider: 'polly' },
    ],
  },
  he: {
    languageCode: 'he-IL',
    voices: [
      // No Polly neural voices available for Hebrew yet
      // Google Cloud TTS voices would go here when available
    ],
  },
} as const;

// Default narrator voices for Pimsleur-style courses
export const DEFAULT_NARRATOR_VOICES = {
  en: 'en-US-Neural2-J', // Guy - Deep and authoritative (best for instruction)
  ja: 'ja-JP-Neural2-B', // Female (often used for learning materials)
  zh: 'cmn-CN-Wavenet-A', // Female, natural and friendly (Google Cloud TTS)
} as const;

// Audio speed configurations for dialogue playback
export const AUDIO_SPEEDS = {
  slow: { value: 0.7, label: 'Slow', key: '0_7' as const },
  medium: { value: 0.85, label: 'Medium', key: '0_85' as const },
  normal: { value: 1.0, label: 'Normal', key: '1_0' as const },
} as const;

export type AudioSpeedKey = 'slow' | 'medium' | 'normal';

// Speaker colors for dialogue visualization
// Assigned at runtime based on speaker index to ensure consistent color scheme
// Bold, saturated colors inspired by editorial design
export const SPEAKER_COLORS = ['#FC66A7', '#FFCC3F', '#6796EC', '#FC8155', '#748C00']; // strawberry, yellow, periwinkle, coral, keylime

/**
 * Get a color for a speaker based on their index
 * @param index - The speaker's index (0-based)
 * @returns A hex color code
 */
export function getSpeakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}
