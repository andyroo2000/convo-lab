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
// Supports Google Cloud TTS, Amazon Polly, and Fish Audio providers
// Google: Neural2 and Wavenet voices (support enableTimePointing for batched TTS)
// Polly: Neural voices (support Speech Marks for batched TTS)
// Fish Audio: High-quality cloned voices via Fish Audio API
export const TTS_VOICES = {
  en: {
    languageCode: 'en-US',
    voices: [
      // Fish Audio narrator voices (preferred)
      {
        id: 'fishaudio:ac934b39586e475b83f3277cd97b5cd4',
        gender: 'male',
        description: 'Fish Audio: Visual Trails - Deep and authoritative',
        provider: 'fishaudio',
      },
      {
        id: 'fishaudio:1f638e52c8274648bf8c0427f1688205',
        gender: 'male',
        description: 'Fish Audio: Calm Pro - Smooth and professional',
        provider: 'fishaudio',
      },
      {
        id: 'fishaudio:6810b0ea7c094d6c9d8cd1cb871dc82a',
        gender: 'male',
        description: 'Fish Audio: Prvi - Calm and introspective',
        provider: 'fishaudio',
      },
      // Male Neural2 voices (Google)
      {
        id: 'en-US-Neural2-J',
        gender: 'male',
        description: 'Google: Guy - Deep and authoritative',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-D',
        gender: 'male',
        description: 'Google: Andrew - Warm and conversational',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-A',
        gender: 'male',
        description: 'Google: James - Clear and professional',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-I',
        gender: 'male',
        description: 'Google: Michael - Friendly and engaging',
        provider: 'google',
      },
      // Female Neural2 voices (Google)
      {
        id: 'en-US-Neural2-F',
        gender: 'female',
        description: 'Google: Jenny - Pleasant and approachable',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-H',
        gender: 'female',
        description: 'Google: Aria - Confident and warm',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-G',
        gender: 'female',
        description: 'Google: Sara - Calm and sincere',
        provider: 'google',
      },
      {
        id: 'en-US-Neural2-C',
        gender: 'female',
        description: 'Google: Emma - Bright and cheerful',
        provider: 'google',
      },
    ],
  },
  ja: {
    languageCode: 'ja-JP',
    voices: [
      // Fish Audio voices (preferred for Japanese)
      // Male voices
      {
        id: 'fishaudio:0dff3f6860294829b98f8c4501b2cf25',
        gender: 'male',
        description: 'Fish Audio: Nakamura - Professional and measured',
        provider: 'fishaudio',
      },
      {
        id: 'fishaudio:875668667eb94c20b09856b971d9ca2f',
        gender: 'male',
        description: 'Fish Audio: Sample - Calm narrator',
        provider: 'fishaudio',
      },
      {
        id: 'fishaudio:abb4362e736f40b7b5716f4fafcafa9f',
        gender: 'male',
        description: 'Fish Audio: Watashi no Boisu - Warm and gentle',
        provider: 'fishaudio',
      },
      {
        id: 'fishaudio:b3e9710c629a472f8224e1c4975a869e',
        gender: 'male',
        description: 'Fish Audio: Otani-san - Confident and professional',
        provider: 'fishaudio',
      },
      // Female voices
      {
        id: 'fishaudio:72416f3ff95541d9a2456b945e8a7c32',
        gender: 'female',
        description: 'Fish Audio: Rina Mama - Gentle and warm',
        provider: 'fishaudio',
      },
      {
        id: 'fishaudio:e6e20195abee4187bddfd1a2609a04f9',
        gender: 'female',
        description: 'Fish Audio: Yu-san - Warm and empathetic',
        provider: 'fishaudio',
      },
      {
        id: 'fishaudio:351aa1e3ef354082bc1f4294d4eea5d0',
        gender: 'female',
        description: 'Fish Audio: Ken Mama - Soft and intimate',
        provider: 'fishaudio',
      },
      {
        id: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
        gender: 'female',
        description: 'Fish Audio: Voice Clone Demo - Soothing and friendly',
        provider: 'fishaudio',
      },
      {
        id: 'fishaudio:9639f090aa6346329d7d3aca7e6b7226',
        gender: 'female',
        description: 'Fish Audio: Ken Mama 2 - Gentle and conversational',
        provider: 'fishaudio',
      },
      // Google voices - Verified from Google Cloud TTS API (npx tsx check-google-voices.ts)
      // Wavenet FEMALE voices
      {
        id: 'ja-JP-Wavenet-A',
        gender: 'female',
        description: 'Google: Ichiro - Animated and bright',
        provider: 'google',
      },
      {
        id: 'ja-JP-Wavenet-B',
        gender: 'female',
        description: 'Google: Rina - Natural and clear',
        provider: 'google',
      },
      // Neural2 FEMALE voices
      {
        id: 'ja-JP-Neural2-B',
        gender: 'female',
        description: 'Google: Nanami - Bright and cheerful',
        provider: 'google',
      },
      // Wavenet MALE voices
      {
        id: 'ja-JP-Wavenet-C',
        gender: 'male',
        description: 'Google: Shohei - Calm and clear',
        provider: 'google',
      },
      {
        id: 'ja-JP-Wavenet-D',
        gender: 'male',
        description: 'Google: Naoki - Confident and clear',
        provider: 'google',
      },
      // Neural2 MALE voices
      {
        id: 'ja-JP-Neural2-C',
        gender: 'male',
        description: 'Google: Kento - Professional',
        provider: 'google',
      },
      {
        id: 'ja-JP-Neural2-D',
        gender: 'male',
        description: 'Google: Daichi - Warm and conversational',
        provider: 'google',
      },
      // Polly voices (Neural)
      {
        id: 'Takumi',
        gender: 'male',
        description: 'Polly: Takumi - Natural and smooth',
        provider: 'polly',
      },
      {
        id: 'Kazuha',
        gender: 'female',
        description: 'Polly: Kazuha - Friendly and clear',
        provider: 'polly',
      },
      {
        id: 'Tomoko',
        gender: 'female',
        description: 'Polly: Tomoko - Natural and pleasant',
        provider: 'polly',
      },
    ],
  },
} as const;

// Default narrator voices for Pimsleur-style courses
export const DEFAULT_NARRATOR_VOICES = {
  en: 'fishaudio:ac934b39586e475b83f3277cd97b5cd4', // Visual Trails - Deep and authoritative
  ja: 'ja-JP-Wavenet-C', // Shohei - Male (Google)
} as const;

// Default L2 speaker voices for courses (used when no voice is specified at course creation)
export const DEFAULT_SPEAKER_VOICES: Record<string, { speaker1: string; speaker2: string }> = {
  ja: { speaker1: 'fishaudio:0dff3f6860294829b98f8c4501b2cf25', speaker2: 'fishaudio:72416f3ff95541d9a2456b945e8a7c32' },
};

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
