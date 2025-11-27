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
// Neural2 voices only (highest quality, support enableTimePointing for batched TTS)
// Journey and Studio voices do NOT support timepointing and have been removed
// Note: Chinese uses Wavenet as Neural2 is not available for Mandarin
export const TTS_VOICES = {
  en: {
    languageCode: 'en-US',
    voices: [
      // Male Neural2 voices
      { id: 'en-US-Neural2-J', gender: 'male', description: 'Guy - Deep and authoritative' },
      { id: 'en-US-Neural2-D', gender: 'male', description: 'Andrew - Warm and conversational' },
      { id: 'en-US-Neural2-A', gender: 'male', description: 'James - Clear and professional' },
      { id: 'en-US-Neural2-I', gender: 'male', description: 'Michael - Friendly and engaging' },
      // Female Neural2 voices
      { id: 'en-US-Neural2-F', gender: 'female', description: 'Jenny - Pleasant and approachable' },
      { id: 'en-US-Neural2-H', gender: 'female', description: 'Aria - Confident and warm' },
      { id: 'en-US-Neural2-G', gender: 'female', description: 'Sara - Calm and sincere' },
      { id: 'en-US-Neural2-C', gender: 'female', description: 'Emma - Bright and cheerful' },
    ],
  },
  ja: {
    languageCode: 'ja-JP',
    voices: [
      // Female voices (Neural2 + Wavenet)
      { id: 'ja-JP-Neural2-B', gender: 'female', description: 'Nanami - Bright and cheerful' },
      { id: 'ja-JP-Wavenet-A', gender: 'female', description: 'Mayu - Animated and bright' },
      { id: 'ja-JP-Wavenet-D', gender: 'female', description: 'Shiori - Calm and clear' },
      // Male voices (Neural2 only - Wavenet B/C excluded as duplicates)
      { id: 'ja-JP-Neural2-C', gender: 'male', description: 'Naoki - Confident and clear' },
      { id: 'ja-JP-Neural2-D', gender: 'male', description: 'Daichi - Warm and conversational' },
    ],
  },
  zh: {
    languageCode: 'cmn-CN',
    voices: [
      // Chinese uses Wavenet (Neural2 not available for Mandarin)
      // Female Wavenet voices
      { id: 'cmn-CN-Wavenet-A', gender: 'female', description: 'Xiaomei - Warm and friendly' },
      { id: 'cmn-CN-Wavenet-D', gender: 'female', description: 'Xiaoli - Clear and gentle' },
      // Male Wavenet voices
      { id: 'cmn-CN-Wavenet-B', gender: 'male', description: 'Wei - Natural and conversational' },
      { id: 'cmn-CN-Wavenet-C', gender: 'male', description: 'Jun - Professional and clear' },
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
