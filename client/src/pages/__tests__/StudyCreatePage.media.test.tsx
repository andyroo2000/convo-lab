import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';
import type { StudyManualCardDraft } from '@languageflow/shared/src/types';

import {
  chooseManualCardType,
  createCardFromManualDraftMock,
  createManualDraftMock,
  deleteManualDraftMock,
  generateDraftImageMock,
  manualDraft,
  manualDraftsState,
  regenerateCandidateAudioMock,
  renderPage,
  resetStudyCreatePageTest,
  restoreStudyCreatePageTest,
  updateManualDraftMock,
} from './StudyCreatePageTestHarness';

describe('StudyCreatePage: manual media and card modes', () => {
  beforeEach(resetStudyCreatePageTest);
  afterEach(restoreStudyCreatePageTest);

  it('defaults manual image placement by creation kind', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    expect(screen.getByLabelText('Image placement')).toHaveValue('none');

    await chooseManualCardType(/Audio recognition/);
    expect(screen.getByLabelText('Image placement')).toHaveValue('none');

    await chooseManualCardType(/Production from text/);
    expect(screen.getByLabelText('Image placement')).toHaveValue('none');

    await chooseManualCardType(/Production from image/);
    expect(screen.getByLabelText('Image placement')).toHaveValue('prompt');
    await userEvent.type(
      screen.getByLabelText('Image prompt'),
      'A realistic photo of cloudy weather. No text.'
    );

    await chooseManualCardType(/Cloze/);
    expect(screen.getByLabelText('Image placement')).toHaveValue('both');
    expect(screen.getByLabelText('Image prompt')).toHaveValue('');

    await chooseManualCardType(/Text recognition/);
    expect(screen.getByLabelText('Image placement')).toHaveValue('none');
  });

  it('keeps the selected manual creation kind after creating a card', async () => {
    manualDraftsState.drafts = [
      manualDraft({
        creationKind: 'cloze',
        cardType: 'cloze',
        prompt: {
          clozeText: '試合に{{c1::勝ちました}}。',
          clozeDisplayText: '試合に[...]。',
          clozeAnswerText: '勝ちました',
        },
        answer: {
          restoredText: '試合に勝ちました。',
          meaning: 'I won the match.',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
        imagePlacement: 'both',
      }),
    ];
    createCardFromManualDraftMock.mockResolvedValue({
      card: { id: 'created-card', cardType: 'cloze' },
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));

    await waitFor(() =>
      expect(createCardFromManualDraftMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'draft-1' })
      )
    );
    expect(screen.getByRole('combobox', { name: 'Card type' })).toHaveTextContent('Cloze');
    expect(screen.getByLabelText('Image placement')).toHaveValue('both');
    expect(screen.getByLabelText('Cloze text')).toHaveValue('');
    expect(screen.getByLabelText('Answer')).toHaveValue('');
  });

  it('regenerates manual card audio and submits the refreshed preview audio', async () => {
    manualDraftsState.drafts = [manualDraft()];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));

    expect(updateManualDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({ draftId: 'draft-1' })
    );
    expect(regenerateCandidateAudioMock).toHaveBeenCalledWith('draft-1');
    expect(updateManualDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      regenerateCandidateAudioMock.mock.invocationCallOrder[0] as number
    );
    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-url',
      '/api/study/media/media-regenerated'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));

    expect(updateManualDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-1',
        values: expect.objectContaining({
          previewAudio: expect.objectContaining({ id: 'media-regenerated' }),
          previewAudioRole: 'answer',
        }),
      })
    );
  });

  it('does not apply regenerated audio after another draft is selected', async () => {
    let resolveRegeneration!: (result: {
      previewAudio: StudyManualCardDraft['previewAudio'];
      previewAudioRole: StudyManualCardDraft['previewAudioRole'];
    }) => void;
    regenerateCandidateAudioMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRegeneration = resolve;
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
        previewAudio: {
          id: 'draft-b-audio',
          filename: 'draft-b.mp3',
          url: '/api/study/media/draft-b-audio',
          mediaKind: 'audio',
          source: 'generated',
        },
        previewAudioRole: 'answer',
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));
    await waitFor(() => expect(regenerateCandidateAudioMock).toHaveBeenCalledWith('draft-a'));
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[1]);

    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-url',
      '/api/study/media/draft-b-audio'
    );

    await act(async () => {
      resolveRegeneration({
        previewAudio: {
          id: 'draft-a-regenerated',
          filename: 'draft-a-regenerated.mp3',
          url: '/api/study/media/draft-a-regenerated',
          mediaKind: 'audio',
          source: 'generated',
        },
        previewAudioRole: 'answer',
      });
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-url',
      '/api/study/media/draft-b-audio'
    );
  });

  it('does not delete a draft while audio regeneration is still in flight', async () => {
    let resolveRegeneration!: (result: {
      previewAudio: StudyManualCardDraft['previewAudio'];
      previewAudioRole: StudyManualCardDraft['previewAudioRole'];
    }) => void;
    regenerateCandidateAudioMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRegeneration = resolve;
      })
    );
    manualDraftsState.drafts = [manualDraft()];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));
    await waitFor(() => expect(regenerateCandidateAudioMock).toHaveBeenCalledWith('draft-1'));

    fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    expect(deleteManualDraftMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveRegeneration({
        previewAudio: manualDraft().previewAudio,
        previewAudioRole: 'answer',
      });
      await Promise.resolve();
    });
  });

  it('does not generate preview media when persisting the current draft fails', async () => {
    manualDraftsState.drafts = [manualDraft()];
    updateManualDraftMock.mockRejectedValueOnce(new Error('Draft save failed'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));

    await waitFor(() => expect(updateManualDraftMock).toHaveBeenCalledTimes(1));
    expect(regenerateCandidateAudioMock).not.toHaveBeenCalled();
  });

  it('opens the reusable card preview for manually entered fields', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.type(screen.getByLabelText('Prompt text'), '会社');
    await userEvent.type(screen.getByLabelText('Answer expression'), '会社');
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'company');
    await userEvent.click(screen.getByRole('button', { name: 'Preview card' }));

    expect(screen.getByRole('dialog', { name: 'Card preview' })).toBeInTheDocument();
    expect(screen.getByText('Prompt side')).toBeInTheDocument();
    expect(screen.getAllByText('会社').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByText('Answer side')).toBeInTheDocument();
    expect(screen.getAllByText('company').length).toBeGreaterThan(0);
  });

  it('previews manual cloze bracket shorthand as a hidden blank', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await chooseManualCardType(/Cloze/);
    fireEvent.change(screen.getByLabelText('Cloze text'), {
      target: { value: '試合に[勝ちました]。' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Preview card' }));

    const dialog = screen.getByRole('dialog', { name: 'Card preview' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('試合に[...]。')).toBeInTheDocument();
    expect(within(dialog).queryByText('試合に[勝ちました]。')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/{{c1::/)).not.toBeInTheDocument();
  });

  it('queues production-from-image drafts with prompt image placement', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await chooseManualCardType(/Production from image/);
    await userEvent.type(screen.getByLabelText('Prompt text'), 'cloudy weather');
    await userEvent.click(screen.getByRole('button', { name: 'Fill remaining fields' }));

    expect(createManualDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        creationKind: 'production-image',
        cardType: 'production',
        imagePlacement: 'prompt',
      })
    );
  });

  it('queues cloze drafts with both-side image placement', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await chooseManualCardType(/Cloze/);
    fireEvent.change(screen.getByLabelText('Cloze text'), {
      target: { value: '試合に[勝ちました]。' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Fill remaining fields' }));

    expect(createManualDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        creationKind: 'cloze',
        cardType: 'cloze',
        imagePlacement: 'both',
      })
    );
    expect(screen.getByLabelText('Image placement')).toHaveValue('both');
  });

  it('disables preview media generation until a manual draft is persisted', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await chooseManualCardType(/Production from image/);

    expect(screen.getByRole('button', { name: 'Regenerate audio' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled();
  });

  it('generates a manual image from the edited prompt before create', async () => {
    generateDraftImageMock.mockResolvedValue({
      revision: 2,
      previewImage: {
        id: 'manual-image',
        filename: 'manual-image.webp',
        url: '/api/study/media/manual-image',
        mediaKind: 'image',
        source: 'generated',
      },
      imagePrompt: 'A construction paper illustration of a company office. No text.',
      imagePlacement: 'both',
    });

    manualDraftsState.drafts = [
      manualDraft({
        imagePrompt: 'A realistic photo of a company office. No text.',
        imagePlacement: 'both',
      }),
    ];
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    await userEvent.clear(screen.getByLabelText('Image prompt'));
    await userEvent.type(
      screen.getByLabelText('Image prompt'),
      'A construction paper illustration of a company office. No text.'
    );
    await userEvent.selectOptions(screen.getByLabelText('Image placement'), 'both');
    await userEvent.click(screen.getByRole('button', { name: 'Generate image' }));

    expect(updateManualDraftMock).toHaveBeenCalledWith({
      draftId: 'draft-1',
      values: expect.objectContaining({
        imagePrompt: 'A construction paper illustration of a company office. No text.',
        imagePlacement: 'both',
      }),
    });
    expect(generateDraftImageMock).toHaveBeenCalledWith('draft-1');
    expect(updateManualDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      generateDraftImageMock.mock.invocationCallOrder[0] as number
    );
    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      '/api/study/media/manual-image'
    );
  });

  it('does not apply a generated image after another draft is selected', async () => {
    let resolveImage!: (result: {
      previewImage: StudyManualCardDraft['previewImage'];
      imagePrompt: string;
      imagePlacement: StudyManualCardDraft['imagePlacement'];
    }) => void;
    generateDraftImageMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveImage = resolve;
      })
    );
    manualDraftsState.drafts = [
      manualDraft({
        id: 'draft-a',
        prompt: { cueText: '会社' },
        imagePlacement: 'both',
        imagePrompt: 'Draft A image',
      }),
      manualDraft({
        id: 'draft-b',
        prompt: { cueText: '天気' },
        previewImage: {
          id: 'draft-b-image',
          filename: 'draft-b.webp',
          url: '/api/study/media/draft-b-image',
          mediaKind: 'image',
          source: 'generated',
        },
        imagePlacement: 'both',
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Generate image' }));
    await waitFor(() => expect(generateDraftImageMock).toHaveBeenCalledWith('draft-a'));
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[1]);
    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      '/api/study/media/draft-b-image'
    );

    await act(async () => {
      resolveImage({
        previewImage: {
          id: 'draft-a-image',
          filename: 'draft-a.webp',
          url: '/api/study/media/draft-a-image',
          mediaKind: 'image',
          source: 'generated',
        },
        imagePrompt: 'Draft A image',
        imagePlacement: 'both',
      });
      await Promise.resolve();
    });

    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      '/api/study/media/draft-b-image'
    );
  });
});
