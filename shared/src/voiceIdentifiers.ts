import { TTS_VOICES } from './constants-new.js';
import type { VoiceConfig, VoiceId, VoiceLanguageCode } from './voiceTypes.js';

const INVALID_VOICE_ID_FRAGMENTS = ['..', '/', '\\'];

/**
 * Convert a voice ID to the sanitized filename used by generated preview audio.
 */
export function voiceIdToFilename(voiceId: VoiceId): string {
  if (!voiceId) {
    throw new Error('Invalid voice ID');
  }

  const containsInvalidFragment = INVALID_VOICE_ID_FRAGMENTS.some((fragment) =>
    voiceId.includes(fragment)
  );
  if (containsInvalidFragment) {
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

const findConfiguredVoice = (
  voiceId: VoiceId
): { voice: VoiceConfig; languageCode: string } | undefined => {
  for (const [, config] of Object.entries(TTS_VOICES)) {
    const voice = config.voices.find((candidate: VoiceConfig) => candidate.id === voiceId);
    if (voice) {
      return { voice, languageCode: config.languageCode };
    }
  }
  return undefined;
};

const findConfiguredProvider = (voiceId: VoiceId): VoiceConfig['provider'] | undefined => {
  for (const [, config] of Object.entries(TTS_VOICES)) {
    const provider = config.voices.find(
      (candidate: VoiceConfig) => candidate.id === voiceId
    )?.provider;
    if (provider) {
      return provider;
    }
  }
  return undefined;
};

/**
 * Detect the provider from configured metadata or the voice ID convention.
 * Google IDs use a language-region prefix; Polly IDs are single words.
 */
export function getProviderFromVoiceId(voiceId: VoiceId): 'google' | 'polly' | 'fishaudio' {
  if (voiceId.startsWith('fishaudio:')) {
    return 'fishaudio';
  }

  const configuredProvider = findConfiguredProvider(voiceId);
  if (configuredProvider) {
    return configuredProvider;
  }

  if (/^[a-z]{2}-[A-Z]{2}-/.test(voiceId)) {
    return 'google';
  }

  return 'polly';
}

/**
 * Extract a Google language-region prefix or use configured provider metadata.
 */
export function getLanguageCodeFromVoiceId(voiceId: VoiceId): VoiceLanguageCode {
  const provider = getProviderFromVoiceId(voiceId);
  if (provider === 'google') {
    return voiceId.split('-').slice(0, 2).join('-');
  }

  const configuredVoice = findConfiguredVoice(voiceId);
  if (configuredVoice) {
    return configuredVoice.languageCode;
  }

  throw new Error(`Unknown voice ID: ${voiceId}`);
}
