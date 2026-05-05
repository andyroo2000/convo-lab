import { describe, expect, it } from 'vitest';

import type { StudyMediaRef } from '@languageflow/shared/src/types';

import {
  applyStudyCardImageToPayload,
  cardTypeForStudyCardCreationKind,
  mergeBlankStudyCardFormFields,
} from '../studyCardCreationModel';
import type { StudyCardFormPayload, StudyCardFormValues } from '../studyCardFormModel';

const baseValues: StudyCardFormValues = {
  cardType: 'recognition',
  cueText: '会社',
  cueReading: '',
  cueMeaning: '',
  answerExpression: '',
  answerReading: '',
  answerMeaning: 'company',
  answerAudioVoiceId: 'ja-JP-Neural2-C',
  answerAudioTextOverride: '',
  notes: '',
  sentenceJp: '',
  sentenceEn: '',
};

const imageRef: StudyMediaRef = {
  id: 'image-1',
  filename: 'image.webp',
  url: '/api/study/media/image-1',
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

  it('merges only blank form fields from an LLM-completed draft', () => {
    expect(
      mergeBlankStudyCardFormFields(baseValues, {
        ...baseValues,
        cueText: '会社 should stay',
        cueReading: '会社[かいしゃ]',
        answerExpression: '会社',
        answerMeaning: 'company should stay',
        notes: 'Business noun.',
      })
    ).toMatchObject({
      cueText: '会社',
      cueReading: '会社[かいしゃ]',
      answerExpression: '会社',
      answerMeaning: 'company',
      notes: 'Business noun.',
    });
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
