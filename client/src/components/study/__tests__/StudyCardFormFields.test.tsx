import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';

import StudyCardFormFields from '../StudyCardFormFields';
import type { StudyCardFormValues } from '../studyCardFormModel';

vi.mock('../../common/VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => <span data-testid="voice-preview">{voiceId}</span>,
}));

const baseValues: StudyCardFormValues = {
  cardType: 'cloze',
  cueText: '明日から{{c1::早く起きる}}ことにします。',
  cueReading: '',
  cueMeaning: 'get up early',
  answerExpression: '明日から早く起きることにします。',
  answerReading: '明日[あす]から早[はや]く起[お]きることにします。',
  answerMeaning: 'I will start getting up early from tomorrow.',
  answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
  answerAudioTextOverride: '',
  notes: '',
  sentenceJp: '',
  sentenceEn: '',
};

describe('StudyCardFormFields', () => {
  it('keeps cloze restored-answer reading editable', () => {
    render(
      <StudyCardFormFields values={baseValues} idPrefix="test-study-card" onFieldChange={vi.fn()} />
    );

    const readingInput = screen.getByLabelText('Restored answer reading');
    expect(readingInput).toHaveValue('明日[あす]から早[はや]く起[お]きることにします。');
    expect(readingInput).toBeEnabled();
  });
});
