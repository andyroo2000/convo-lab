import { DEFAULT_NARRATOR_VOICES, TTS_VOICES } from './constants-new.js';
import type {
  CourseSpeakerVoices,
  DialogueSpeakerVoice,
  VoiceConfig,
  VoiceId,
  VoiceLanguage,
  VoiceLanguageCode,
} from './voiceTypes.js';

export function getTtsVoices(language: VoiceLanguageCode): VoiceConfig[] {
  return [...((TTS_VOICES[language as VoiceLanguage]?.voices || []) as ReadonlyArray<VoiceConfig>)];
}

export function getSelectableTtsVoices(language: VoiceLanguageCode): VoiceConfig[] {
  return getTtsVoices(language).filter((voice) => !voice.hiddenFromPicker);
}

const isGoogleNeuralVoice = (voice: VoiceConfig): boolean => {
  if (voice.provider !== 'google') {
    return false;
  }
  return voice.id.includes('-Neural2-');
};

export function getAudioScriptTtsVoices(language: VoiceLanguageCode): VoiceConfig[] {
  return getTtsVoices(language).filter(isGoogleNeuralVoice);
}

export function getTtsVoiceById(
  language: VoiceLanguageCode,
  voiceId: VoiceId
): VoiceConfig | undefined {
  return getTtsVoices(language).find((voice) => voice.id === voiceId);
}

const secureRandomIndex = (upperBound: number): number => {
  const runtimeCrypto = (
    globalThis as unknown as {
      crypto: { getRandomValues: (values: Uint32Array) => Uint32Array };
    }
  ).crypto;
  const values = new Uint32Array(1);
  const unbiasedLimit = 2 ** 32 - (2 ** 32 % upperBound);

  do {
    runtimeCrypto.getRandomValues(values);
  } while (values[0] >= unbiasedLimit);

  return values[0] % upperBound;
};

const randomVoice = (voices: VoiceConfig[]): VoiceConfig =>
  voices[secureRandomIndex(voices.length)];

const preferredSpeakerVoices = (voices: VoiceConfig[]): VoiceConfig[] => {
  const fishAudioVoices = voices.filter((voice) => voice.provider === 'fishaudio');
  return fishAudioVoices.length > 0 ? fishAudioVoices : voices;
};

const genderBalancedVoices = (voices: VoiceConfig[]): VoiceConfig[] => {
  const candidates = [
    voices.find((voice) => voice.gender === 'male'),
    voices.find((voice) => voice.gender === 'female'),
  ].filter((voice): voice is VoiceConfig => Boolean(voice));

  return candidates.length === 2
    ? candidates.map((voice) =>
        randomVoice(voices.filter((candidate) => candidate.gender === voice.gender))
      )
    : [];
};

const selectSpeakerVoices = (voices: VoiceConfig[], count: number): VoiceConfig[] => {
  const diverseVoices = count === 2 ? genderBalancedVoices(voices) : [];
  return diverseVoices.length > 0 ? diverseVoices : voices.slice(0, count);
};

const randomizeDialogueOrder = (voices: VoiceConfig[]): VoiceConfig[] => {
  if (voices.length !== 2) {
    return voices;
  }
  return secureRandomIndex(2) === 1 ? [...voices].reverse() : voices;
};

const selectDialogueVoices = (voices: VoiceConfig[], count: number): VoiceConfig[] => {
  const diverseVoices = count === 2 ? genderBalancedVoices(voices) : [];
  return diverseVoices.length > 0 ? randomizeDialogueOrder(diverseVoices) : voices.slice(0, count);
};

export function getCourseSpeakerVoices(
  targetLanguage: VoiceLanguageCode,
  nativeLanguage: VoiceLanguageCode,
  numSpeakers: number = 2
): CourseSpeakerVoices {
  const narratorVoice =
    DEFAULT_NARRATOR_VOICES[nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES] || '';
  const preferredVoices = preferredSpeakerVoices(getSelectableTtsVoices(targetLanguage));
  const speakerVoices = selectSpeakerVoices(preferredVoices, numSpeakers).map((voice) => voice.id);

  return { narratorVoice, speakerVoices };
}

export function getDialogueSpeakerVoices(
  targetLanguage: VoiceLanguageCode,
  numSpeakers: number = 2
): DialogueSpeakerVoice[] {
  const targetVoices = getSelectableTtsVoices(targetLanguage);
  const selected = selectDialogueVoices(targetVoices, numSpeakers);

  return selected.map((voice) => ({
    id: voice.id,
    voiceId: voice.id,
    gender: voice.gender,
    description: voice.description,
  }));
}
