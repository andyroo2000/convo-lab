import { LanguageInfo, LanguageCode } from './types.js';

export const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
  },
};

export const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'native'] as const;

export const TONE_STYLES = ['casual', 'polite', 'formal'] as const;

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
      {
        id: 'en-US-Neural2-J',
        gender: 'male',
        description: 'Guy - Deep and authoritative',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-D',
        gender: 'male',
        description: 'Andrew - Warm and conversational',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-A',
        gender: 'male',
        description: 'James - Clear and professional',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-I',
        gender: 'male',
        description: 'Michael - Friendly and engaging',
        provider: 'google',
      },
      // Female Neural2 voices (Google)
      {
        id: 'en-US-Neural2-F',
        gender: 'female',
        description: 'Jenny - Pleasant and approachable',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-H',
        gender: 'female',
        description: 'Aria - Confident and warm',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-G',
        gender: 'female',
        description: 'Sara - Calm and sincere',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-C',
        gender: 'female',
        description: 'Emma - Bright and cheerful',
        provider: 'google',
      },
    ],
  },
  ja: {
    languageCode: 'ja-JP',
    voices: [
      // Google voices - Verified from Google Cloud TTS API (npx tsx check-google-voices.ts)
      // Wavenet FEMALE voices
      {
        id: 'ja-JP-Wavenet-A',
        gender: 'female',
        description: 'Ichiro - Animated and bright',
        provider: 'google',
      },
      {
        id: 'ja-JP-Wavenet-B',
        gender: 'female',
        description: 'Rina - Natural and clear',
        provider: 'google',
      },
      // Neural2 FEMALE voices
      {
        id: 'ja-JP-Neural2-B',
        gender: 'female',
        description: 'Nanami - Bright and cheerful',
        provider: 'google',
      },
      // Wavenet MALE voices
      {
        id: 'ja-JP-Wavenet-C',
        gender: 'male',
        description: 'Shohei - Calm and clear',
        provider: 'google',
      },
      {
        id: 'ja-JP-Wavenet-D',
        gender: 'male',
        description: 'Naoki - Confident and clear',
        provider: 'google',
      },
      // Neural2 MALE voices
      {
        id: 'ja-JP-Neural2-C',
        gender: 'male',
        description: 'Kento - Professional',
        provider: 'google',
      },
      {
        id: 'ja-JP-Neural2-D',
        gender: 'male',
        description: 'Daichi - Warm and conversational',
        provider: 'google',
      },
      // Polly voices (Neural)
      {
        id: 'Takumi',
        gender: 'male',
        description: 'Takumi - Natural and smooth',
        provider: 'polly',
      },
      {
        id: 'Kazuha',
        gender: 'female',
        description: 'Kazuha - Friendly and clear',
        provider: 'polly',
      },
      {
        id: 'Tomoko',
        gender: 'female',
        description: 'Tomoko - Natural and pleasant',
        provider: 'polly',
      },
    ],
  },
} as const;

// Default narrator voices for Pimsleur-style courses
export const DEFAULT_NARRATOR_VOICES = {
  en: 'en-US-Neural2-J', // Guy - Male
  ja: 'ja-JP-Wavenet-C', // Shohei - Male
} as const;

// Language abbreviations for UI display
export const LANGUAGE_ABBREVIATIONS = {
  ja: 'JA',
  en: 'EN',
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
