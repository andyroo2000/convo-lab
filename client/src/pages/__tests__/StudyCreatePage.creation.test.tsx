import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';

import {
  MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS,
  createCardFromManualDraftMock,
  manualDraft,
  manualDraftsState,
  renderPage,
  resetStudyCreatePageTest,
  restoreStudyCreatePageTest,
  updateManualDraftMock,
} from './StudyCreatePageTestHarness';

const createDraftAtIndex = async (index: number) => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
  await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[index]);
  await userEvent.click(screen.getByRole('button', { name: 'Create card' }));
};

describe('StudyCreatePage: card creation and generated previews', () => {
  beforeEach(resetStudyCreatePageTest);
  afterEach(restoreStudyCreatePageTest);

  it('creates a selected draft card and removes it from the queue', async () => {
    manualDraftsState.drafts = [manualDraft()];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));

    expect(updateManualDraftMock).toHaveBeenCalledWith({
      draftId: 'draft-1',
      values: expect.objectContaining({
        prompt: expect.objectContaining({ cueText: '会社' }),
        answer: expect.objectContaining({ expression: '会社' }),
      }),
    });
    expect(createCardFromManualDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'draft-1' })
    );
    expect(
      await screen.findByText('Created recognition card and seeded it into the study queue.')
    ).toBeInTheDocument();
  });

  it('reconciles an already committed draft without overwriting its card snapshot', async () => {
    manualDraftsState.drafts = [manualDraft({ committedCardId: 'committed-card-1' })];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    expect(
      screen.getByText(
        'This card was already created. Finish cleanup to remove its retained draft.'
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Prompt text')).toBeDisabled();
    expect(screen.getByLabelText('Answer expression')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Finish cleanup' }));

    expect(updateManualDraftMock).not.toHaveBeenCalled();
    expect(createCardFromManualDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'draft-1',
        committedCardId: 'committed-card-1',
      })
    );
  });

  it('creates audio-recognition draft cards without requiring prompt text', async () => {
    manualDraftsState.drafts = [
      manualDraft({
        creationKind: 'audio-recognition',
        cardType: 'recognition',
        prompt: {},
        answer: {
          expression: '営業の仕事は楽しいです。',
          expressionReading: '営業[えいぎょう]の仕事[しごと]は楽[たの]しいです。',
          meaning: 'Sales work is fun.',
          answerAudioVoiceId: MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS[0],
        },
        previewAudio: {
          id: 'audio-vocab',
          filename: 'audio-vocab.mp3',
          url: '/api/study/media/audio-vocab',
          mediaKind: 'audio',
          source: 'generated',
        },
        previewAudioRole: 'prompt',
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));

    expect(screen.queryByLabelText('Prompt text')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));

    expect(updateManualDraftMock).toHaveBeenCalledWith({
      draftId: 'draft-1',
      values: expect.objectContaining({
        prompt: {
          cueAudio: expect.objectContaining({ id: 'audio-vocab' }),
        },
        answer: expect.objectContaining({
          expression: '営業の仕事は楽しいです。',
          answerAudio: expect.objectContaining({ id: 'audio-vocab' }),
        }),
      }),
    });
    expect(createCardFromManualDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'draft-1' })
    );
  });

  it.each([
    {
      name: 'selects the next draft in queue after creating a card',
      drafts: [
        manualDraft({ id: 'draft-1', prompt: { cueText: '一番目' } }),
        manualDraft({ id: 'draft-2', prompt: { cueText: '二番目' } }),
        manualDraft({ id: 'draft-3', prompt: { cueText: '三番目' } }),
      ],
      expectedPrompt: '三番目',
    },
    {
      name: 'selects the previous draft when creating the last draft in queue',
      drafts: [
        manualDraft({ id: 'draft-1', prompt: { cueText: '一番目' } }),
        manualDraft({ id: 'draft-2', prompt: { cueText: '二番目' } }),
      ],
      expectedPrompt: '一番目',
    },
  ])('$name', async ({ drafts, expectedPrompt }) => {
    manualDraftsState.drafts = drafts;
    await createDraftAtIndex(1);

    await waitFor(() =>
      expect(createCardFromManualDraftMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'draft-2' })
      )
    );
    await waitFor(() => expect(screen.getByLabelText('Prompt text')).toHaveValue(expectedPrompt));
  });

  it('does not replace a newer selection when an earlier card creation finishes', async () => {
    let resolveCreation!: (result: { card: { id: string; cardType: 'recognition' } }) => void;
    createCardFromManualDraftMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreation = resolve;
      })
    );
    manualDraftsState.drafts = [
      manualDraft({ id: 'draft-a', prompt: { cueText: '会社' } }),
      manualDraft({
        id: 'draft-b',
        prompt: { cueText: '天気' },
        answer: {
          expression: '天気',
          meaning: 'weather',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));
    await waitFor(() =>
      expect(createCardFromManualDraftMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'draft-a' })
      )
    );
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[1]);

    await act(async () => {
      resolveCreation({ card: { id: 'created-a', cardType: 'recognition' } });
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Answer expression')).toHaveValue('天気');
    expect(screen.getByRole('heading', { name: 'Review draft' })).toBeInTheDocument();
  });

  it('loads a ready draft with generated image and audio previews', async () => {
    manualDraftsState.drafts = [
      manualDraft({
        creationKind: 'production-image',
        cardType: 'production',
        prompt: { cueText: 'cloudy weather', cueMeaning: '名詞' },
        answer: {
          expression: '曇り',
          expressionReading: '曇り[くもり]',
          meaning: 'cloudy weather',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
        imagePlacement: 'prompt',
        imagePrompt: 'A realistic photo of a company office. No text.',
        previewAudio: {
          id: 'manual-audio',
          filename: 'manual-audio.mp3',
          url: '/api/study/media/manual-audio',
          mediaKind: 'audio',
          source: 'generated',
        },
        previewAudioRole: 'answer',
        previewImage: {
          id: 'manual-image',
          filename: 'manual-image.webp',
          url: '/api/study/media/manual-image',
          mediaKind: 'image',
          source: 'generated',
        },
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));

    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-url',
      '/api/study/media/manual-audio'
    );
    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      '/api/study/media/manual-image'
    );
  });

  it('loads vocab cloze drafts with both-side generated image controls enabled', async () => {
    manualDraftsState.drafts = [
      manualDraft({
        creationKind: 'cloze',
        cardType: 'cloze',
        prompt: {
          clozeText: '営業の仕事は{{c1::楽しい}}です。',
          clozeDisplayText: '営業の仕事は[...]です。',
          clozeAnswerText: '楽しい',
          clozeHint: 'fun',
        },
        answer: {
          restoredText: '営業の仕事は楽しいです。',
          restoredTextReading: '営業[えいぎょう]の仕事[しごと]は楽[たの]しいです。',
          meaning: 'Sales work is fun.',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
        imagePlacement: 'both',
        imagePrompt: 'A natural office scene showing enjoyable sales work. No text.',
        previewImage: {
          id: 'vocab-cloze-image',
          filename: 'vocab-cloze-image.webp',
          url: '/api/study/media/vocab-cloze-image',
          mediaKind: 'image',
          source: 'generated',
        },
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));

    expect(screen.getByLabelText('Image placement')).toHaveValue('both');
    expect(screen.getByLabelText('Image prompt')).toHaveValue(
      'A natural office scene showing enjoyable sales work. No text.'
    );
    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      '/api/study/media/vocab-cloze-image'
    );
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeEnabled();
  });
});
