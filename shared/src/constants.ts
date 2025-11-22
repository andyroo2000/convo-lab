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
      // Male narrator voices
      { id: 'en-US-Journey-D', gender: 'male', description: 'Andrew - Warm and natural', edgeName: 'AndrewNeural' },
      { id: 'en-US-Studio-M', gender: 'male', description: 'Brian - Clear and professional', edgeName: 'BrianNeural' },
      { id: 'en-US-Studio-O', gender: 'male', description: 'Eric - Deep and authoritative', edgeName: 'EricNeural' },
      { id: 'en-US-Wavenet-B', gender: 'male', description: 'Guy - Confident and engaging', edgeName: 'GuyNeural' },
      // Female narrator voices
      { id: 'en-US-Neural2-F', gender: 'female', description: 'Jenny - Pleasant and approachable', edgeName: 'JennyNeural' },
      { id: 'en-US-Neural2-H', gender: 'female', description: 'Aria - Confident and warm', edgeName: 'AriaNeural' },
      { id: 'en-US-Neural2-G', gender: 'female', description: 'Sara - Calm and sincere', edgeName: 'SaraNeural' },
      { id: 'en-US-Wavenet-F', gender: 'female', description: 'Michelle - Authentic and warm', edgeName: 'MichelleNeural' },
    ],
  },
  ja: {
    languageCode: 'ja-JP',
    voices: [
      // Female voices (adult, for dialogue)
      { id: 'ja-JP-Neural2-B', gender: 'female', description: 'Nanami - Bright and cheerful', edgeName: 'NanamiNeural' },
      { id: 'ja-JP-Wavenet-D', gender: 'female', description: 'Shiori - Calm and clear', edgeName: 'ShioriNeural' },
      { id: 'ja-JP-Wavenet-A', gender: 'female', description: 'Mayu - Animated and bright', edgeName: 'MayuNeural' },

      // Male voices (adult, for dialogue)
      { id: 'ja-JP-Neural2-D', gender: 'male', description: 'Masaru - Warm and conversational', edgeName: 'MasaruMultilingualNeural' },
      { id: 'ja-JP-Wavenet-C', gender: 'male', description: 'Naoki - Clear and natural', edgeName: 'NaokiNeural' },
      { id: 'ja-JP-Wavenet-B', gender: 'male', description: 'Daichi - Steady and reliable', edgeName: 'DaichiNeural' },
    ],
  },
  zh: {
    languageCode: 'cmn-CN',
    voices: [
      // Female voices (adult, for dialogue) - Google Cloud TTS
      { id: 'cmn-CN-Wavenet-A', gender: 'female', description: 'Wavenet A - Warm and friendly', edgeName: 'XiaoxiaoNeural' },
      { id: 'cmn-CN-Wavenet-D', gender: 'female', description: 'Wavenet D - Clear and gentle', edgeName: 'XiaoyiNeural' },
      { id: 'cmn-TW-Wavenet-A', gender: 'female', description: 'Taiwan A - Bright and lively', edgeName: 'XiaoxuanNeural' },

      // Male voices (adult, for dialogue) - Google Cloud TTS
      { id: 'cmn-CN-Wavenet-B', gender: 'male', description: 'Wavenet B - Natural and conversational', edgeName: 'YunxiNeural' },
      { id: 'cmn-CN-Wavenet-C', gender: 'male', description: 'Wavenet C - Professional and clear', edgeName: 'YunyangNeural' },
      { id: 'cmn-TW-Wavenet-B', gender: 'male', description: 'Taiwan B - Calm and steady', edgeName: 'YunjianNeural' },
    ],
  },
} as const;

// Default narrator voices for Pimsleur-style courses
export const DEFAULT_NARRATOR_VOICES = {
  en: 'en-US-Journey-D', // Male, highest quality, warm and natural (best for instruction)
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
