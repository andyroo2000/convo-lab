import { TTS_VOICES, DEFAULT_NARRATOR_VOICES } from './constants';

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

interface VoiceConfig {
  id: string;
  gender: string;
  description: string;
}

export function getCourseSpeakerVoices(
  targetLanguage: string,
  nativeLanguage: string,
  numSpeakers: number = 2
): CourseSpeakerVoices {
  // Get narrator voice from defaults (Neural2 voices that support timepointing)
  const narratorVoice = DEFAULT_NARRATOR_VOICES[nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES] || '';

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
  const voicesConfig = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices;
  const targetVoices: VoiceConfig[] = voicesConfig ? [...voicesConfig] : [];

  // For 2 speakers, ensure gender diversity (one male, one female)
  if (numSpeakers === 2) {
    const maleVoices = targetVoices.filter(v => v.gender === 'male');
    const femaleVoices = targetVoices.filter(v => v.gender === 'female');

    if (maleVoices.length > 0 && femaleVoices.length > 0) {
      // Pick one random male and one random female
      const male = maleVoices[Math.floor(Math.random() * maleVoices.length)];
      const female = femaleVoices[Math.floor(Math.random() * femaleVoices.length)];

      // Randomize order (50% chance male first, 50% female first)
      const selected = Math.random() < 0.5 ? [male, female] : [female, male];

      return selected.map(v => ({
        id: v.id,
        voiceId: v.id,
        gender: v.gender,
        description: v.description,
      }));
    }
  }

  // Fallback: just take first N voices
  return targetVoices.slice(0, numSpeakers).map(v => ({
    id: v.id,
    voiceId: v.id,
    gender: v.gender,
    description: v.description,
  }));
}
