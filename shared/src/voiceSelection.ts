import { TTS_VOICES } from './constants';

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

export function getCourseSpeakerVoices(
  targetLanguage: string,
  nativeLanguage: string,
  numSpeakers: number = 2
): CourseSpeakerVoices {
  // Get narrator voice (native language for narration)
  const nativeVoices = TTS_VOICES[nativeLanguage as keyof typeof TTS_VOICES]?.voices || [];
  const narratorVoice = nativeVoices[0]?.id || '';

  // Get speaker voices (target language)
  const targetVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];
  const speakerVoices = targetVoices.slice(0, numSpeakers).map(v => v.id);

  return {
    narratorVoice,
    speakerVoices,
  };
}

export function getDialogueSpeakerVoices(
  targetLanguage: string,
  numSpeakers: number = 2
): DialogueSpeakerVoice[] {
  // Get speaker voices for dialogue (target language only)
  const targetVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];
  return targetVoices.slice(0, numSpeakers).map(v => ({
    id: v.id,
    voiceId: v.id,
    gender: v.gender,
    description: v.description,
  }));
}
