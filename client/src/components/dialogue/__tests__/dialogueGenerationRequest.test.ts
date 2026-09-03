import { describe, expect, it } from 'vitest';
import type { SpeakerFormData } from '../DialogueGeneratorForm';
import {
  buildDialogueGenerationIntentPayload,
  getDialogueGenerationValidationError,
} from '../dialogueGenerationRequest';

const speakers: SpeakerFormData[] = [
  {
    name: 'Aki',
    voiceId: 'voice-1',
    proficiency: 'intermediate',
    tone: 'casual',
    color: '#123456',
  },
  {
    name: 'Ren',
    voiceId: 'voice-2',
    proficiency: 'beginner',
    tone: 'formal',
    color: '#654321',
  },
];

const validInput = {
  sourceText: 'Plan a weekend trip',
  speakers,
  createAudioCourse: false,
  audioCourseEnabled: true,
  courseTitle: '',
  courseNarratorVoice: '',
};

const expectedScopedPayload = {
  episode: {
    title: 'New Dialogue',
    sourceText: 'Plan a weekend trip',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    speakers: [
      {
        name: 'Aki',
        voiceId: 'voice-1',
        proficiency: 'N4',
        tone: 'casual',
        color: '#123456',
      },
      {
        name: 'Ren',
        voiceId: 'voice-2',
        proficiency: 'N4',
        tone: 'formal',
        color: '#654321',
      },
    ],
    audioSpeed: 'medium',
    jlptLevel: 'N4',
    autoGenerateAudio: true,
  },
  dialogue: {
    speakers: [
      {
        id: '',
        name: 'Aki',
        voiceId: 'voice-1',
        proficiency: 'N4',
        tone: 'casual',
        color: '#123456',
      },
      {
        id: '',
        name: 'Ren',
        voiceId: 'voice-2',
        proficiency: 'N4',
        tone: 'formal',
        color: '#654321',
      },
    ],
    variationCount: 3,
    dialogueLength: 12,
    options: {
      jlptLevel: 'N4',
      vocabSeedOverride: '電車',
      grammarSeedOverride: '〜たい',
    },
  },
  viewAsUserId: 'user-2',
};

describe('dialogue generation request helpers', () => {
  it.each([
    {
      override: { sourceText: '  ', speakers: [] },
      error: 'dialogue:alerts.fillRequired',
    },
    {
      override: { speakers: speakers.slice(0, 1) },
      error: 'dialogue:alerts.twoSpeakers',
    },
    {
      override: { createAudioCourse: true },
      error: 'dialogue:alerts.courseFields',
    },
  ])('returns $error for invalid generation input', ({ override, error }) => {
    expect(getDialogueGenerationValidationError({ ...validInput, ...override })).toBe(error);
  });

  it('allows a valid dialogue and ignores disabled course fields', () => {
    expect(getDialogueGenerationValidationError(validInput)).toBeNull();
    expect(
      getDialogueGenerationValidationError({
        ...validInput,
        createAudioCourse: true,
        audioCourseEnabled: false,
      })
    ).toBeNull();
    expect(
      getDialogueGenerationValidationError({
        ...validInput,
        createAudioCourse: true,
        courseTitle: 'Weekend Course',
        courseNarratorVoice: 'voice-3',
      })
    ).toBeNull();
  });

  it('builds the persisted dialogue intent without changing form data', () => {
    const payload = buildDialogueGenerationIntentPayload({
      title: 'New Dialogue',
      sourceText: '  Plan a weekend trip  ',
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      speakers,
      jlptLevel: 'N4',
      autoGenerateAudio: true,
      dialogueLength: 12,
      vocabSeedOverride: '電車',
      grammarSeedOverride: '〜たい',
      viewAsUserId: 'user-2',
    });

    expect(payload).toEqual(expectedScopedPayload);
    expect(speakers[0].proficiency).toBe('intermediate');
  });

  it('omits an empty impersonation scope from the persisted intent', () => {
    const payload = buildDialogueGenerationIntentPayload({
      title: 'New Dialogue',
      sourceText: 'Topic',
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      speakers,
      jlptLevel: 'N5',
      autoGenerateAudio: false,
      dialogueLength: 8,
      vocabSeedOverride: '',
      grammarSeedOverride: '',
    });

    expect(payload).not.toHaveProperty('viewAsUserId');
  });
});
