import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('keeps cloze answer reading editable', () => {
    render(
      <StudyCardFormFields values={baseValues} idPrefix="test-study-card" onFieldChange={vi.fn()} />
    );

    const readingInput = screen.getByRole('textbox', { name: /^answer reading$/i });
    expect(readingInput).toHaveValue('明日[あす]から早[はや]く起[お]きることにします。');
    expect(readingInput).toHaveAttribute('placeholder', 'Example: 明日[あした]から');
    expect(readingInput).toBeEnabled();
  });

  it('can omit answer audio settings for editor-specific placement', () => {
    render(
      <StudyCardFormFields
        values={baseValues}
        idPrefix="test-study-card"
        includeAudioSettings={false}
        onFieldChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Answer audio voice')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Phonetic audio override')).not.toBeInTheDocument();
  });

  it('uses custom card type options instead of a native select', async () => {
    const user = userEvent.setup();
    const onCardTypeChange = vi.fn();

    render(
      <StudyCardFormFields
        values={{ ...baseValues, cardType: 'recognition' }}
        idPrefix="test-study-card"
        includeCardTypeSelect
        onCardTypeChange={onCardTypeChange}
        onFieldChange={vi.fn()}
      />
    );

    expect(screen.getByRole('radiogroup', { name: 'Card type' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Card type' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Recognition' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await user.click(screen.getByRole('radio', { name: 'Production' }));

    expect(onCardTypeChange).toHaveBeenCalledWith('production');
  });

  it('uses a rich dropdown for manual creation kinds', async () => {
    const user = userEvent.setup();
    const onCreationKindChange = vi.fn();

    render(
      <StudyCardFormFields
        values={{ ...baseValues, cardType: 'recognition' }}
        idPrefix="test-study-card"
        includeCardTypeSelect
        creationKind="text-recognition"
        onCreationKindChange={onCreationKindChange}
        onFieldChange={vi.fn()}
      />
    );

    const cardTypeSelect = screen.getByRole('combobox', { name: 'Card type' });
    expect(cardTypeSelect).toHaveTextContent('Text recognition');
    expect(cardTypeSelect).toHaveTextContent('Read Japanese, recall meaning');
    expect(screen.queryByRole('radiogroup', { name: 'Card type' })).not.toBeInTheDocument();

    await user.click(cardTypeSelect);
    await user.click(screen.getByRole('option', { name: /Production from image/ }));

    expect(onCreationKindChange).toHaveBeenCalledWith('production-image');
  });

  it('supports keyboard selection in the manual creation kind dropdown', async () => {
    const user = userEvent.setup();
    const onCreationKindChange = vi.fn();

    render(
      <StudyCardFormFields
        values={{ ...baseValues, cardType: 'recognition' }}
        idPrefix="test-study-card"
        includeCardTypeSelect
        creationKind="text-recognition"
        onCreationKindChange={onCreationKindChange}
        onFieldChange={vi.fn()}
      />
    );

    screen.getByRole('combobox', { name: 'Card type' }).focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');

    expect(onCreationKindChange).toHaveBeenCalledWith('audio-recognition');
  });
});
