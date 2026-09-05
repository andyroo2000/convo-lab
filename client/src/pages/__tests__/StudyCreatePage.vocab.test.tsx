import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';

import {
  MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS,
  chooseManualCardType,
  createVocabBundleDraftsMock,
  createVocabBundleDraftsState,
  manualDraft,
  renderPage,
  resetStudyCreatePageTest,
  restoreStudyCreatePageTest,
} from './StudyCreatePageTestHarness';

describe('StudyCreatePage: voice defaults and vocab bundles', () => {
  beforeEach(resetStudyCreatePageTest);
  afterEach(restoreStudyCreatePageTest);

  it('defaults new manual cards to either Ren or Yumi', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    expect(screen.getByLabelText('Answer audio voice')).toHaveTextContent('Yumi');
    expect(screen.getByTestId('voice-preview')).toHaveTextContent(
      MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS[1]
    );
    randomSpy.mockRestore();
  });

  it('keeps the randomized manual voice when switching to audio recognition', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await chooseManualCardType(/Audio recognition/);

    expect(screen.getByLabelText('Answer audio voice')).toHaveTextContent('Ren');
    expect(screen.getByTestId('voice-preview')).toHaveTextContent(
      MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS[0]
    );
    randomSpy.mockRestore();
  });

  it('shows fake progress while vocab bundle generation is pending', () => {
    vi.useFakeTimers();
    createVocabBundleDraftsState.isPending = true;

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Candidate generation progress' })
    ).toBeInTheDocument();
    expect(screen.getByText('Building candidate cards…')).toBeInTheDocument();
    expect(screen.getByTestId('study-generate-progress-percent')).toHaveTextContent('0%');
  });

  it('hides vocab bundle progress after drafts are queued successfully', async () => {
    let resolveVocabBundle!: (value: unknown) => void;
    createVocabBundleDraftsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVocabBundle = resolve;
        })
    );
    const { rerenderPage } = renderPage();

    await userEvent.type(screen.getByLabelText('Target word'), '営業する');
    await userEvent.click(screen.getByRole('button', { name: 'Generate vocab bundle' }));
    createVocabBundleDraftsState.isPending = true;
    rerenderPage();

    expect(
      screen.getByRole('status', { name: 'Candidate generation progress' })
    ).toBeInTheDocument();

    resolveVocabBundle({
      groupId: 'group-1',
      drafts: [manualDraft({ id: 'vocab-draft-1', status: 'generating' })],
    });

    expect(
      await screen.findByText(/Added 1 generated card to the draft queue/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Candidate generation progress' })
    ).not.toBeInTheDocument();
  });

  it('queues only one vocab bundle while generation is still in flight', async () => {
    let resolveVocabBundle!: (value: unknown) => void;
    createVocabBundleDraftsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveVocabBundle = resolve;
      })
    );
    renderPage();

    await userEvent.type(screen.getByLabelText('Target word'), '営業する');
    const form = screen.getByRole('form', { name: 'Vocab bundle generator' });

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(createVocabBundleDraftsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVocabBundle({ groupId: 'group-1', drafts: [] });
      await Promise.resolve();
    });
  });

  it('queues vocab bundle drafts from target word and optional sentence without waiting for generation', async () => {
    createVocabBundleDraftsMock.mockResolvedValue({
      groupId: 'group-1',
      drafts: Array.from({ length: 11 }, (_, index) =>
        manualDraft({
          id: `vocab-draft-${String(index + 1)}`,
          status: 'generating',
          creationKind: index < 3 ? 'audio-recognition' : 'text-recognition',
          prompt: index < 3 ? {} : { cueText: '営業する' },
          answer: {
            expression: index < 3 ? '営業の仕事は楽しいです。' : '営業する',
            meaning: '',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
        })
      ),
    });

    renderPage();

    expect(screen.getByTestId('study-manual-draft-list')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Target word'), '営業する');
    await userEvent.type(screen.getByLabelText('Source sentence'), '営業の仕事は楽しいです。');
    await userEvent.type(screen.getByLabelText('Extra context'), 'Business chapter');
    await userEvent.click(screen.getByRole('button', { name: 'Generate vocab bundle' }));

    expect(createVocabBundleDraftsMock).toHaveBeenCalledWith({
      targetWord: '営業する',
      sourceSentence: '営業の仕事は楽しいです。',
      context: 'Business chapter',
      includeLearnerContext: true,
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Target word')).toHaveValue('');
      expect(screen.getByLabelText('Source sentence')).toHaveValue('');
      expect(screen.getByLabelText('Extra context')).toHaveValue('');
    });
    expect(
      await screen.findByText('Added 11 generated cards to the draft queue.')
    ).toBeInTheDocument();
  });
});
