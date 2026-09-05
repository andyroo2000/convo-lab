import type { VoiceAvatarTone, VoiceConfig, VoiceLanguageCode } from './voiceTypes.js';

const SUPPORTED_VOICE_AVATAR_VARIANTS = new Set(['ja:male', 'ja:female']);

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

// Keep this map current when adding voices; description inference is only a fallback.
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

const VOICE_AVATAR_TONE_KEYWORDS: ReadonlyArray<{
  tone: VoiceAvatarTone;
  keywords: readonly string[];
}> = [
  {
    tone: 'formal',
    keywords: ['professional', 'measured', 'authoritative', 'confident'],
  },
  {
    tone: 'polite',
    keywords: ['warm', 'gentle', 'pleasant', 'sincere', 'empathetic', 'smooth'],
  },
];

const inferVoiceAvatarTone = (voice: VoiceConfig): VoiceAvatarTone => {
  const text = voice.description.toLowerCase();
  const matchingRule = VOICE_AVATAR_TONE_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) => text.includes(keyword))
  );
  return matchingRule?.tone ?? 'casual';
};

export function getTtsVoiceAvatarFilename(
  language: VoiceLanguageCode,
  voice: VoiceConfig
): string | null {
  const voiceAvatarFilename = VOICE_AVATAR_FILENAME_BY_ID[voice.id];
  if (voiceAvatarFilename) {
    return voiceAvatarFilename;
  }

  const normalizedLanguage = language.toLowerCase();
  const normalizedGender = voice.gender.toLowerCase();
  const variant = `${normalizedLanguage}:${normalizedGender}`;
  if (!SUPPORTED_VOICE_AVATAR_VARIANTS.has(variant)) {
    return null;
  }

  const tone = VOICE_AVATAR_TONE_BY_ID[voice.id] ?? inferVoiceAvatarTone(voice);
  return `${normalizedLanguage}-${normalizedGender}-${tone}.jpg`;
}

export function getTtsVoiceAvatarPath(
  language: VoiceLanguageCode,
  voice: VoiceConfig
): string | null {
  const filename = getTtsVoiceAvatarFilename(language, voice);
  return filename ? `/api/avatars/${filename}` : null;
}
