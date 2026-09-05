import type { TTS_VOICES } from './constants-new.js';

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

export type VoiceLanguage = keyof typeof TTS_VOICES;
export type VoiceLanguageCode = string;
export type VoiceId = string;

export interface VoiceConfig {
  id: string;
  gender: string;
  description: string;
  provider?: 'google' | 'polly' | 'fishaudio';
  hiddenFromPicker?: boolean;
}

export type VoiceAvatarTone = 'casual' | 'polite' | 'formal';
