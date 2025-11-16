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
export const TTS_VOICES = {
  en: {
    languageCode: 'en-US',
    voices: [
      // Journey voices (highest quality, most natural)
      { id: 'en-US-Journey-D', gender: 'male', description: 'Male voice (highest quality, warm)' },
      { id: 'en-US-Journey-F', gender: 'female', description: 'Female voice (highest quality, friendly)' },
      // Studio voices (very high quality)
      { id: 'en-US-Studio-M', gender: 'male', description: 'Male voice (studio quality, clear)' },
      { id: 'en-US-Studio-O', gender: 'male', description: 'Male voice (studio quality, deep)' },
      // WaveNet voices (high quality)
      { id: 'en-US-Wavenet-A', gender: 'male', description: 'Male voice (high quality, professional)' },
      { id: 'en-US-Wavenet-B', gender: 'male', description: 'Male voice (high quality, authoritative)' },
      { id: 'en-US-Wavenet-D', gender: 'male', description: 'Male voice (high quality, casual)' },
      { id: 'en-US-Wavenet-I', gender: 'male', description: 'Male voice (high quality, formal)' },
      // Neural2 voices (standard quality)
      { id: 'en-US-Neural2-A', gender: 'male', description: 'Male voice (clear, professional)' },
      { id: 'en-US-Neural2-D', gender: 'male', description: 'Male voice (authoritative)' },
      { id: 'en-US-Neural2-I', gender: 'male', description: 'Male voice (casual)' },
      { id: 'en-US-Neural2-J', gender: 'male', description: 'Male voice (formal)' },
    ],
  },
  ja: {
    languageCode: 'ja-JP',
    voices: [
      { id: 'ja-JP-Neural2-B', gender: 'female', description: 'Female voice' },
      { id: 'ja-JP-Neural2-C', gender: 'male', description: 'Male voice' },
      { id: 'ja-JP-Neural2-D', gender: 'male', description: 'Male voice (deeper)' },
    ],
  },
} as const;

// Default narrator voices for Pimsleur-style courses
export const DEFAULT_NARRATOR_VOICES = {
  en: 'en-US-Journey-D', // Male, highest quality, warm and natural (best for instruction)
  ja: 'ja-JP-Neural2-B', // Female (often used for learning materials)
} as const;
