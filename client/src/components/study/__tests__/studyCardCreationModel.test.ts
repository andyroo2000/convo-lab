import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NARRATOR_VOICES,
  MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS,
} from '@languageflow/shared/src/constants-new';
import type { StudyMediaRef } from '@languageflow/shared/src/types';

import {
  applyStudyCardImageToPayload,
  cardTypeForStudyCardCreationKind,
  defaultImagePlacementForStudyCardCreationKind,
  defaultVoiceIdForStudyCardCreationKind,
  isStudyCardCreationDefaultVoice,
} from '../studyCardCreationModel';
import type { StudyCardFormPayload } from '../studyCardFormModel';

const imageRef: StudyMediaRef = {
  id: 'image-1',
  filename: 'image.webp',
  url: '/api/learning-os/study/media/image-1',
  mediaKind: 'image',
  source: 'generated',
};

describe('studyCardCreationModel', () => {
  it('maps creation kinds to persisted card types', () => {
    expect(cardTypeForStudyCardCreationKind('text-recognition')).toBe('recognition');
    expect(cardTypeForStudyCardCreationKind('audio-recognition')).toBe('recognition');
    expect(cardTypeForStudyCardCreationKind('production-text')).toBe('production');
    expect(cardTypeForStudyCardCreationKind('production-image')).toBe('production');
    expect(cardTypeForStudyCardCreationKind('cloze')).toBe('cloze');
  });

  it('defaults manual image placement only for image-led creation kinds', () => {
    expect(defaultImagePlacementForStudyCardCreationKind('text-recognition')).toBe('none');
    expect(defaultImagePlacementForStudyCardCreationKind('audio-recognition')).toBe('none');
    expect(defaultImagePlacementForStudyCardCreationKind('production-text')).toBe('none');
    expect(defaultImagePlacementForStudyCardCreationKind('production-image')).toBe('prompt');
    expect(defaultImagePlacementForStudyCardCreationKind('cloze')).toBe('both');
  });

  it('randomly chooses Ren or Yumi as the manual default voice', () => {
    expect(defaultVoiceIdForStudyCardCreationKind('audio-recognition')).toMatch(/^fishaudio:/);
    expect(MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS).toContain(
      defaultVoiceIdForStudyCardCreationKind('text-recognition')
    );
    expect(isStudyCardCreationDefaultVoice(MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS[0])).toBe(true);
    expect(isStudyCardCreationDefaultVoice(MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS[1])).toBe(true);
    expect(isStudyCardCreationDefaultVoice(DEFAULT_NARRATOR_VOICES.ja)).toBe(true);
    expect(isStudyCardCreationDefaultVoice('custom-voice')).toBe(false);
  });

  it('applies a generated image to front, back, or both sides', () => {
    const payload: StudyCardFormPayload = {
      cardType: 'production',
      prompt: { cueText: 'cloudy weather' },
      answer: { expression: '曇り', meaning: 'cloudy weather' },
    };

    const front = applyStudyCardImageToPayload(payload, imageRef, 'prompt');
    expect(front.prompt.cueImage).toBe(imageRef);
    expect(front.answer.answerImage).toBeUndefined();

    const back = applyStudyCardImageToPayload(payload, imageRef, 'answer');
    expect(back.prompt.cueImage).toBeUndefined();
    expect(back.answer.answerImage).toBe(imageRef);

    expect(applyStudyCardImageToPayload(payload, imageRef, 'both')).toMatchObject({
      prompt: { cueImage: imageRef },
      answer: { answerImage: imageRef },
    });
  });
});
