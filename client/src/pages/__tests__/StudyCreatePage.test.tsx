import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_NARRATOR_VOICES,
  MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS,
} from '@languageflow/shared/src/constants-new';
import type { StudyManualCardDraft } from '@languageflow/shared/src/types';

import StudyCreatePage from '../StudyCreatePage';

async function chooseAnswerAudioVoice(name: RegExp | string) {
  await userEvent.click(screen.getByLabelText('Answer audio voice'));
  await userEvent.click(await screen.findByRole('option', { name }));
}

async function chooseManualCardType(name: RegExp | string) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Card type' }));
  await userEvent.click(await screen.findByRole('option', { name }));
}

const {
  commitCandidatesMock,
  commitCandidatesState,
  completeDraftMock,
  completeDraftState,
  createManualDraftMock,
  createManualDraftState,
  createCardFromManualDraftMock,
  createCardFromManualDraftState,
  createStudyCardMock,
  createVocabBundleDraftsMock,
  createVocabBundleDraftsState,
  deleteManualDraftMock,
  deleteManualDraftState,
  generateDraftImageMock,
  generateDraftImageState,
  generateCandidatesState,
  generateCandidatesMock,
  manualDraftsState,
  regenerateCandidateAudioMock,
  regenerateCandidateImageMock,
  retryManualDraftMock,
  retryManualDraftState,
  resolveStudyCardPitchAccentMock,
  updateManualDraftMock,
  updateManualDraftMutateMock,
  updateManualDraftState,
} = vi.hoisted(() => ({
  commitCandidatesMock: vi.fn(),
  commitCandidatesState: { isPending: false },
  completeDraftMock: vi.fn(),
  completeDraftState: { error: null as Error | null, isPending: false },
  createManualDraftMock: vi.fn(),
  createManualDraftState: { error: null as Error | null, isPending: false },
  createCardFromManualDraftMock: vi.fn(),
  createCardFromManualDraftState: { isPending: false },
  createStudyCardMock: vi.fn(),
  createVocabBundleDraftsMock: vi.fn(),
  createVocabBundleDraftsState: { error: null as Error | null, isPending: false },
  deleteManualDraftMock: vi.fn(),
  deleteManualDraftState: { isPending: false },
  generateDraftImageMock: vi.fn(),
  generateDraftImageState: { error: null as Error | null, isPending: false },
  generateCandidatesState: { error: null as Error | null, isPending: false },
  generateCandidatesMock: vi.fn(),
  manualDraftsState: {
    drafts: [] as StudyManualCardDraft[],
    error: null as Error | null,
    isLoading: false,
  },
  regenerateCandidateAudioMock: vi.fn(),
  regenerateCandidateImageMock: vi.fn(),
  retryManualDraftMock: vi.fn(),
  retryManualDraftState: { isPending: false },
  resolveStudyCardPitchAccentMock: vi.fn(),
  updateManualDraftMock: vi.fn(),
  updateManualDraftMutateMock: vi.fn(),
  updateManualDraftState: { error: null as Error | null, isPending: false },
}));

vi.mock('../../hooks/useStudy', () => ({
  useCommitStudyCardCandidates: () => ({
    mutateAsync: commitCandidatesMock,
    isPending: commitCandidatesState.isPending,
    error: null,
  }),
  useCreateStudyCard: () => ({
    mutateAsync: createStudyCardMock,
    isPending: false,
    error: null,
  }),
  useCompleteStudyCardDraft: () => ({
    mutateAsync: completeDraftMock,
    isPending: completeDraftState.isPending,
    error: completeDraftState.error,
  }),
  useStudyManualCardDrafts: () => ({
    data: { drafts: manualDraftsState.drafts },
    isLoading: manualDraftsState.isLoading,
    error: manualDraftsState.error,
  }),
  useCreateStudyManualCardDraft: () => ({
    mutateAsync: createManualDraftMock,
    isPending: createManualDraftState.isPending,
    error: createManualDraftState.error,
  }),
  useCreateStudyVocabBundleDrafts: () => ({
    mutateAsync: createVocabBundleDraftsMock,
    isPending: createVocabBundleDraftsState.isPending,
    error: createVocabBundleDraftsState.error,
  }),
  useUpdateStudyManualCardDraft: () => ({
    mutateAsync: updateManualDraftMock,
    mutate: updateManualDraftMutateMock,
    isPending: updateManualDraftState.isPending,
    error: updateManualDraftState.error,
  }),
  useRetryStudyManualCardDraft: () => ({
    mutateAsync: retryManualDraftMock,
    isPending: retryManualDraftState.isPending,
    error: null,
  }),
  useCreateCardFromStudyManualCardDraft: () => ({
    mutateAsync: createCardFromManualDraftMock,
    isPending: createCardFromManualDraftState.isPending,
    error: null,
  }),
  useDeleteStudyManualCardDraft: () => ({
    mutateAsync: deleteManualDraftMock,
    isPending: deleteManualDraftState.isPending,
    error: null,
  }),
  useGenerateStudyManualCardDraftPreviewImage: () => ({
    mutateAsync: generateDraftImageMock,
    isPending: generateDraftImageState.isPending,
    error: generateDraftImageState.error,
  }),
  useGenerateStudyCardCandidates: () => ({
    mutateAsync: generateCandidatesMock,
    isPending: generateCandidatesState.isPending,
    error: generateCandidatesState.error,
  }),
  useGenerateStudyManualCardDraftPreviewAudio: () => ({
    mutateAsync: regenerateCandidateAudioMock,
    isPending: false,
    error: null,
  }),
  useRegenerateStudyCardCandidatePreviewImage: () => ({
    mutateAsync: regenerateCandidateImageMock,
    isPending: false,
    error: null,
  }),
  resolveStudyCardPitchAccent: resolveStudyCardPitchAccentMock,
}));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: undefined, isLoading: false }),
}));

vi.mock('../../components/common/VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => <span data-testid="voice-preview">{voiceId}</span>,
}));

vi.mock('../../components/study/StudyAudioPlayer', () => ({
  default: ({ label, size, url }: { label: string; size?: string; url: string }) => (
    <button type="button" data-size={size} data-url={url}>
      {label}
    </button>
  ),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const getUi = () => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StudyCreatePage />
      </BrowserRouter>
    </QueryClientProvider>
  );
  const view = render(getUi());
  return {
    ...view,
    rerenderPage: () => view.rerender(getUi()),
  };
};

const manualDraft = (overrides: Partial<StudyManualCardDraft> = {}): StudyManualCardDraft => ({
  id: 'draft-1',
  status: 'ready',
  creationKind: 'text-recognition',
  cardType: 'recognition',
  prompt: {
    cueText: '会社',
    cueReading: '会社[かいしゃ]',
    cueMeaning: 'company prompt hint',
  },
  answer: {
    expression: '会社',
    expressionReading: '会社[かいしゃ]',
    meaning: 'company',
    notes: 'Business noun.',
    answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
  },
  imagePlacement: 'none',
  imagePrompt: null,
  previewAudio: null,
  previewAudioRole: null,
  previewImage: null,
  errorMessage: null,
  createdAt: '2026-05-08T12:00:00.000Z',
  updatedAt: '2026-05-08T12:00:00.000Z',
  ...overrides,
});

describe('StudyCreatePage', () => {
  beforeEach(() => {
    commitCandidatesMock.mockReset();
    commitCandidatesState.isPending = false;
    completeDraftMock.mockReset();
    completeDraftState.error = null;
    completeDraftState.isPending = false;
    createManualDraftMock.mockReset();
    createManualDraftState.error = null;
    createManualDraftState.isPending = false;
    createCardFromManualDraftMock.mockReset();
    createCardFromManualDraftState.isPending = false;
    createStudyCardMock.mockReset();
    createVocabBundleDraftsMock.mockReset();
    createVocabBundleDraftsState.error = null;
    createVocabBundleDraftsState.isPending = false;
    deleteManualDraftMock.mockReset();
    deleteManualDraftState.isPending = false;
    generateDraftImageMock.mockReset();
    generateDraftImageState.error = null;
    generateDraftImageState.isPending = false;
    generateCandidatesState.error = null;
    generateCandidatesState.isPending = false;
    generateCandidatesMock.mockReset();
    manualDraftsState.drafts = [];
    manualDraftsState.error = null;
    manualDraftsState.isLoading = false;
    regenerateCandidateAudioMock.mockReset();
    regenerateCandidateImageMock.mockReset();
    retryManualDraftMock.mockReset();
    retryManualDraftState.isPending = false;
    resolveStudyCardPitchAccentMock.mockReset();
    updateManualDraftMock.mockReset();
    updateManualDraftMutateMock.mockReset();
    updateManualDraftState.error = null;
    updateManualDraftState.isPending = false;
    commitCandidatesMock.mockResolvedValue({ cards: [{ id: 'created-1' }] });
    createManualDraftMock.mockResolvedValue(manualDraft({ status: 'generating' }));
    createVocabBundleDraftsMock.mockResolvedValue({
      groupId: 'group-1',
      drafts: [
        manualDraft({
          id: 'vocab-draft-1',
          status: 'generating',
          creationKind: 'audio-recognition',
          prompt: {},
          answer: {
            expression: '営業の仕事は楽しいです。',
            meaning: '',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
        }),
      ],
    });
    createCardFromManualDraftMock.mockResolvedValue({
      card: { id: 'created-1', cardType: 'recognition' },
    });
    createStudyCardMock.mockResolvedValue({ cardType: 'recognition' });
    deleteManualDraftMock.mockResolvedValue(undefined);
    retryManualDraftMock.mockResolvedValue(manualDraft({ status: 'generating' }));
    updateManualDraftMock.mockImplementation(async ({ draftId, values }) =>
      manualDraft({ id: draftId, ...values })
    );
    generateCandidatesMock.mockResolvedValue({ candidates: [], learnerContextSummary: null });
    regenerateCandidateAudioMock.mockResolvedValue({
      previewAudio: {
        id: 'media-regenerated',
        filename: 'candidate-regenerated.mp3',
        url: '/api/study/media/media-regenerated',
        mediaKind: 'audio',
        source: 'generated',
      },
      previewAudioRole: 'answer',
    });
    regenerateCandidateImageMock.mockResolvedValue({
      prompt: {
        cueMeaning: '名詞',
        cueImage: {
          id: 'image-regenerated',
          filename: 'candidate-regenerated.png',
          url: '/api/study/media/image-regenerated',
          mediaKind: 'image',
          source: 'generated',
        },
      },
      answer: {
        expression: '会社',
        meaning: 'company',
      },
      previewImage: {
        id: 'image-regenerated',
        filename: 'candidate-regenerated.png',
        url: '/api/study/media/image-regenerated',
        mediaKind: 'image',
        source: 'generated',
      },
      imagePrompt: 'A clear photo of a company office sign in Japan.',
    });
    resolveStudyCardPitchAccentMock.mockImplementation(async (cardId: string) => ({
      id: cardId,
      answer: { pitchAccent: null },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
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
      'http://localhost:3001/api/study/media/manual-audio'
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

  it('selecting and editing a ready draft autosaves changes', async () => {
    manualDraftsState.drafts = [manualDraft()];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));
    await userEvent.clear(screen.getByLabelText('Answer meaning'));
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'business');

    await waitFor(() => {
      expect(updateManualDraftMock).toHaveBeenCalledWith({
        draftId: 'draft-1',
        values: expect.objectContaining({
          answer: expect.objectContaining({ meaning: 'business' }),
        }),
      });
    });
  });

  it('keeps draft actions enabled while an autosave is pending', async () => {
    updateManualDraftState.isPending = true;
    manualDraftsState.drafts = [
      manualDraft({
        imagePlacement: 'both',
        imagePrompt: 'A realistic photo of a company office. No text.',
      }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));

    expect(screen.getByRole('button', { name: 'Create card' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete draft' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeEnabled();
  });

  it('disables draft actions while their own mutations are running', async () => {
    manualDraftsState.drafts = [manualDraft()];
    createCardFromManualDraftState.isPending = true;
    deleteManualDraftState.isPending = true;

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByTestId('study-manual-draft-row'));

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  });

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
    expect(createCardFromManualDraftMock).toHaveBeenCalledWith('draft-1');
    expect(
      await screen.findByText('Created recognition card and seeded it into the study queue.')
    ).toBeInTheDocument();
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
    expect(createCardFromManualDraftMock).toHaveBeenCalledWith('draft-1');
  });

  it('selects the next draft in queue after creating a card', async () => {
    manualDraftsState.drafts = [
      manualDraft({ id: 'draft-1', prompt: { cueText: '一番目' } }),
      manualDraft({ id: 'draft-2', prompt: { cueText: '二番目' } }),
      manualDraft({ id: 'draft-3', prompt: { cueText: '三番目' } }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));

    await waitFor(() => expect(createCardFromManualDraftMock).toHaveBeenCalledWith('draft-2'));
    await waitFor(() => expect(screen.getByLabelText('Prompt text')).toHaveValue('三番目'));
  });

  it('selects the previous draft when creating the last draft in queue', async () => {
    manualDraftsState.drafts = [
      manualDraft({ id: 'draft-1', prompt: { cueText: '一番目' } }),
      manualDraft({ id: 'draft-2', prompt: { cueText: '二番目' } }),
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getAllByTestId('study-manual-draft-row')[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));

    await waitFor(() => expect(createCardFromManualDraftMock).toHaveBeenCalledWith('draft-2'));
    await waitFor(() => expect(screen.getByLabelText('Prompt text')).toHaveValue('一番目'));
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
      'http://localhost:3001/api/study/media/manual-audio'
    );
    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      'http://localhost:3001/api/study/media/manual-image'
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
      'http://localhost:3001/api/study/media/vocab-cloze-image'
    );
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeEnabled();
  });

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

    await waitFor(() => expect(createCardFromManualDraftMock).toHaveBeenCalledWith('draft-1'));
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
    expect(regenerateCandidateAudioMock).toHaveBeenCalledWith({
      draftId: 'draft-1',
      legacyRequest: {
        candidate: expect.objectContaining({
          candidateKind: 'text-recognition',
          cardType: 'recognition',
          answer: expect.objectContaining({ expression: '会社' }),
        }),
      },
    });
    expect(updateManualDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      regenerateCandidateAudioMock.mock.invocationCallOrder[0] as number
    );
    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-url',
      'http://localhost:3001/api/study/media/media-regenerated'
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
    expect(generateDraftImageMock).toHaveBeenCalledWith({
      draftId: 'draft-1',
      legacyRequest: {
        imagePrompt: 'A construction paper illustration of a company office. No text.',
        imagePlacement: 'both',
      },
    });
    expect(updateManualDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      generateDraftImageMock.mock.invocationCallOrder[0] as number
    );
    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      'http://localhost:3001/api/study/media/manual-image'
    );
  });

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
