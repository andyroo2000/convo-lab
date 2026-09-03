import type { CreateEpisodeRequest, LanguageCode, ProficiencyLevel, Speaker } from '../../types';
import type { SpeakerFormData } from './DialogueGeneratorForm';

export type DialogueGenerationValidationError =
  | 'dialogue:alerts.fillRequired'
  | 'dialogue:alerts.twoSpeakers'
  | 'dialogue:alerts.courseFields';

export interface DialogueGenerationIntentPayload {
  episode: CreateEpisodeRequest;
  dialogue: {
    speakers: Speaker[];
    variationCount: number;
    dialogueLength: number;
    options: {
      jlptLevel: string;
      vocabSeedOverride: string;
      grammarSeedOverride: string;
    };
  };
  viewAsUserId?: string;
}

interface DialogueGenerationValidationInput {
  sourceText: string;
  speakers: SpeakerFormData[];
  createAudioCourse: boolean;
  audioCourseEnabled: boolean;
  courseTitle: string;
  courseNarratorVoice: string;
}

interface DialogueGenerationPayloadInput {
  title: string;
  sourceText: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  speakers: SpeakerFormData[];
  jlptLevel: string;
  autoGenerateAudio: boolean;
  dialogueLength: number;
  vocabSeedOverride: string;
  grammarSeedOverride: string;
  viewAsUserId?: string;
}

export const getDialogueGenerationValidationError = ({
  sourceText,
  speakers,
  createAudioCourse,
  audioCourseEnabled,
  courseTitle,
  courseNarratorVoice,
}: DialogueGenerationValidationInput): DialogueGenerationValidationError | null => {
  if (!sourceText.trim()) return 'dialogue:alerts.fillRequired';
  if (speakers.length < 2) return 'dialogue:alerts.twoSpeakers';
  if (createAudioCourse && audioCourseEnabled) {
    const isCourseConfigurationIncomplete = !courseTitle.trim() || !courseNarratorVoice;
    if (isCourseConfigurationIncomplete) return 'dialogue:alerts.courseFields';
  }
  return null;
};

export const buildDialogueGenerationIntentPayload = ({
  title,
  sourceText,
  targetLanguage,
  nativeLanguage,
  speakers,
  jlptLevel,
  autoGenerateAudio,
  dialogueLength,
  vocabSeedOverride,
  grammarSeedOverride,
  viewAsUserId,
}: DialogueGenerationPayloadInput): DialogueGenerationIntentPayload => {
  const episodeSpeakers = speakers.map((speaker) => ({
    name: speaker.name,
    voiceId: speaker.voiceId,
    proficiency: jlptLevel as ProficiencyLevel,
    tone: speaker.tone,
    color: speaker.color,
  }));
  const dialogueSpeakers = episodeSpeakers.map((speaker) => ({ id: '', ...speaker }));

  return {
    episode: {
      title,
      sourceText: sourceText.trim(),
      targetLanguage,
      nativeLanguage,
      speakers: episodeSpeakers,
      audioSpeed: 'medium',
      jlptLevel,
      autoGenerateAudio,
    },
    dialogue: {
      speakers: dialogueSpeakers,
      variationCount: 3,
      dialogueLength,
      options: { jlptLevel, vocabSeedOverride, grammarSeedOverride },
    },
    ...(viewAsUserId ? { viewAsUserId } : {}),
  };
};
