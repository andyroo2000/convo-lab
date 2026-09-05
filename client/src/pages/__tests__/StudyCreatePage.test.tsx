import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';
import type { StudyManualCardDraft } from '@languageflow/shared/src/types';

import {
  chooseAnswerAudioVoice,
  createManualDraftMock,
  createStudyCardMock,
  deleteManualDraftMock,
  effectiveUserState,
  manualDraft,
  manualDraftsState,
  renderPage,
  resetStudyCreatePageTest,
  restoreStudyCreatePageTest,
  retryManualDraftMock,
  updateManualDraftMock,
  useStudyManualCardDraftsMock,
} from './StudyCreatePageTestHarness';

describe('StudyCreatePage: queue and draft selection', () => {
  beforeEach(resetStudyCreatePageTest);
  afterEach(restoreStudyCreatePageTest);

  it('does not expose authenticated-user study drafts while viewing as another user', () => {
    effectiveUserState.effectiveUser = { id: 'view-as-user' };
    effectiveUserState.isImpersonating = true;
    manualDraftsState.drafts = [manualDraft({ id: 'authenticated-user-draft' })];

    renderPage();

    expect(
      screen.getByText(
        'Study card creation is unavailable while viewing as another user. Exit View As to manage your own drafts.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId('study-manual-draft-list')).not.toBeInTheDocument();
    expect(screen.queryByText('会社')).not.toBeInTheDocument();
    expect(useStudyManualCardDraftsMock).toHaveBeenLastCalledWith({ effectiveOwnerId: null });
  });

  it('keeps the active creation form before the draft queue in document order', async () => {
    renderPage();

    const draftList = screen.getByTestId('study-manual-draft-list');
    expect(
      screen.getByRole('heading', { name: 'Vocab bundle' }).compareDocumentPosition(draftList)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));

    expect(
      screen
        .getByRole('heading', { name: 'New manual draft' })
        .compareDocumentPosition(screen.getByTestId('study-manual-draft-list'))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('queues a manual draft and clears the composer immediately', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.type(screen.getByLabelText('Prompt text'), '会社');
    await userEvent.type(screen.getByLabelText('Answer expression'), '会社');
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'company');
    await chooseAnswerAudioVoice(/Sato/);
    await userEvent.type(screen.getByLabelText('Phonetic audio override'), 'かいしゃ');
    expect(screen.queryByRole('button', { name: 'Create card' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fill remaining fields' }));

    expect(createManualDraftMock).toHaveBeenCalledWith({
      creationKind: 'text-recognition',
      cardType: 'recognition',
      prompt: {
        cueText: '会社',
        cueReading: null,
        cueMeaning: null,
      },
      answer: {
        expression: '会社',
        expressionReading: null,
        meaning: 'company',
        answerAudioVoiceId: 'fishaudio:875668667eb94c20b09856b971d9ca2f',
        answerAudioTextOverride: 'かいしゃ',
        sentenceJp: null,
        sentenceEn: null,
        notes: null,
      },
      imagePlacement: 'none',
      imagePrompt: null,
    });
    expect(createStudyCardMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Prompt text')).toHaveValue('');
    expect(screen.getByLabelText('Answer expression')).toHaveValue('');
    expect(
      await screen.findByText('Draft queued. You can keep entering cards while it fills in.')
    ).toBeInTheDocument();
  });

  it('queues only one manual draft while the first request is still in flight', async () => {
    let resolveQueue!: (draft: StudyManualCardDraft) => void;
    createManualDraftMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveQueue = resolve;
      })
    );
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    const fillButton = screen.getByRole('button', { name: 'Fill remaining fields' });

    fireEvent.click(fillButton);
    fireEvent.click(fillButton);

    expect(createManualDraftMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveQueue(manualDraft({ status: 'generating' }));
      await Promise.resolve();
    });
  });

  it('does not clear a draft selected while a new draft is being queued', async () => {
    let resolveQueue!: (draft: StudyManualCardDraft) => void;
    createManualDraftMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveQueue = resolve;
      })
    );
    manualDraftsState.drafts = [
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
    await userEvent.click(screen.getByRole('button', { name: 'Fill remaining fields' }));
    await waitFor(() => expect(createManualDraftMock).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    expect(screen.getByLabelText('Answer expression')).toHaveValue('天気');

    await act(async () => {
      resolveQueue(manualDraft({ id: 'new-draft', status: 'generating' }));
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Answer expression')).toHaveValue('天気');
    expect(screen.getByRole('heading', { name: 'Review draft' })).toBeInTheDocument();
  });

  it('renders the draft queue and loads selected ready draft fields', async () => {
    manualDraftsState.drafts = [
      manualDraft({
        imagePrompt: 'A realistic photo of a company office. No text.',
        previewAudio: {
          id: 'manual-audio',
          filename: 'manual-audio.mp3',
          url: '/api/study/media/manual-audio',
          mediaKind: 'audio',
          source: 'generated',
        },
        previewAudioRole: 'answer',
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));

    expect(screen.getByTestId('study-manual-draft-list')).toHaveClass('xl:flex');
    expect(screen.getByTestId('study-manual-draft-scroll-region')).toHaveClass(
      'xl:overflow-y-auto'
    );
    expect(screen.getByRole('columnheader', { name: 'Draft' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Created' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Cards' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Reviews' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('study-manual-draft-row'));

    expect(screen.getByLabelText('Prompt text')).toHaveValue('会社');
    expect(screen.getByLabelText('Prompt reading')).toHaveValue('会社[かいしゃ]');
    expect(screen.getByLabelText('Answer expression')).toHaveValue('会社');
    expect(screen.getByLabelText('Answer meaning')).toHaveValue('company');
    expect(screen.getByLabelText('Image prompt')).toHaveValue(
      'A realistic photo of a company office. No text.'
    );
    expect(screen.getByLabelText('Image placement')).toHaveValue('none');
    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-url',
      '/api/study/media/manual-audio'
    );
    const audioToRegeneratePosition = screen
      .getByRole('button', { name: 'Play generated preview audio' })
      .compareDocumentPosition(screen.getByRole('button', { name: 'Regenerate audio' }));
    expect(audioToRegeneratePosition).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const audioToNotesPosition = screen
      .getByRole('button', { name: 'Play generated preview audio' })
      .compareDocumentPosition(screen.getByLabelText('Notes'));
    expect(audioToNotesPosition).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('shows generating, ready, and error draft statuses and actions', async () => {
    manualDraftsState.drafts = [
      manualDraft({ id: 'draft-generating', status: 'generating', prompt: { cueText: '準備中' } }),
      manualDraft({ id: 'draft-ready', status: 'ready', prompt: { cueText: '会社' } }),
      manualDraft({
        id: 'draft-error',
        status: 'error',
        prompt: { cueText: '失敗' },
        errorMessage: 'Audio failed.',
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));

    expect(screen.getByText('Generating')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();

    await userEvent.click(screen.getAllByText('失敗')[0]);
    expect(screen.getByText(/Audio failed/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry fill' }));
    expect(retryManualDraftMock).toHaveBeenCalledWith('draft-error');
    await userEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    expect(deleteManualDraftMock).toHaveBeenCalledWith('draft-error');
  });

  it('lets a stale generating draft be retried', async () => {
    manualDraftsState.drafts = [
      manualDraft({
        id: 'draft-stale',
        status: 'generating',
        prompt: { cueText: '止まりました' },
        updatedAt: '2000-01-01T00:00:00.000Z',
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    await userEvent.click(screen.getByRole('button', { name: 'Retry fill' }));

    expect(retryManualDraftMock).toHaveBeenCalledWith('draft-stale');
  });

  it('persists recent edits before retrying an errored draft', async () => {
    manualDraftsState.drafts = [manualDraft({ id: 'draft-error', status: 'error' })];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    await userEvent.clear(screen.getByLabelText('Answer meaning'));
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'enterprise');
    await userEvent.click(screen.getByRole('button', { name: 'Retry fill' }));

    expect(updateManualDraftMock).toHaveBeenCalledWith({
      draftId: 'draft-error',
      values: expect.objectContaining({
        answer: expect.objectContaining({ meaning: 'enterprise' }),
      }),
    });
    expect(retryManualDraftMock).toHaveBeenCalledWith('draft-error');
    expect(updateManualDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      retryManualDraftMock.mock.invocationCallOrder[0] as number
    );
  });

  it('does not clear a newer selection when an earlier draft deletion finishes', async () => {
    let resolveDeletion!: () => void;
    deleteManualDraftMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDeletion = resolve;
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
    await userEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    await waitFor(() => expect(deleteManualDraftMock).toHaveBeenCalledWith('draft-a'));
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[1]);
    expect(screen.getByLabelText('Answer expression')).toHaveValue('天気');

    await act(async () => {
      resolveDeletion();
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Answer expression')).toHaveValue('天気');
    expect(screen.getByRole('heading', { name: 'Review draft' })).toBeInTheDocument();
  });
});
