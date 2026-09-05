/* eslint-disable react-refresh/only-export-components */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';
import type { StudyManualCardDraft } from '@languageflow/shared/src/types';

import StudyCreatePage from '../StudyCreatePage';
import studyCapabilitiesFixture from '../../test/studyCapabilitiesFixture';

// Import this harness before StudyCreatePage so Vitest hoists its shared mocks first.
const MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS = [
  studyCapabilitiesFixture.cardAuthoring.defaultAnswerAudioVoiceId,
  studyCapabilitiesFixture.cardAuthoring.defaultFemaleAnswerAudioVoiceId,
] as const;

async function chooseAnswerAudioVoice(name: RegExp | string) {
  await userEvent.click(screen.getByLabelText('Answer audio voice'));
  await userEvent.click(await screen.findByRole('option', { name }));
}

async function chooseManualCardType(name: RegExp | string) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Card type' }));
  await userEvent.click(await screen.findByRole('option', { name }));
}

const {
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
  effectiveUserState,
  manualDraftsState,
  regenerateCandidateAudioMock,
  retryManualDraftMock,
  retryManualDraftState,
  resolveStudyCardPitchAccentMock,
  useStudyManualCardDraftsMock,
  updateManualDraftMock,
  updateManualDraftMutateMock,
  updateManualDraftState,
} = vi.hoisted(() => ({
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
  effectiveUserState: {
    effectiveUser: { id: 'user-1' } as { id: string } | null,
    isImpersonating: false,
    loading: false,
  },
  manualDraftsState: {
    drafts: [] as StudyManualCardDraft[],
    error: null as Error | null,
    isLoading: false,
  },
  regenerateCandidateAudioMock: vi.fn(),
  retryManualDraftMock: vi.fn(),
  retryManualDraftState: { isPending: false },
  resolveStudyCardPitchAccentMock: vi.fn(),
  useStudyManualCardDraftsMock: vi.fn(),
  updateManualDraftMock: vi.fn(),
  updateManualDraftMutateMock: vi.fn(),
  updateManualDraftState: { error: null as Error | null, isPending: false },
}));

vi.mock('../../hooks/useStudy', () => ({
  useCreateStudyCard: () => ({
    mutateAsync: createStudyCardMock,
    isPending: false,
    error: null,
  }),
  useStudyManualCardDrafts: (options: { effectiveOwnerId: string | null }) => {
    useStudyManualCardDraftsMock(options);
    return {
      data: { drafts: manualDraftsState.drafts },
      isLoading: manualDraftsState.isLoading,
      error: manualDraftsState.error,
    };
  },
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
  useGenerateStudyManualCardDraftPreviewAudio: () => ({
    mutateAsync: regenerateCandidateAudioMock,
    isPending: false,
    error: null,
  }),
  resolveStudyCardPitchAccent: resolveStudyCardPitchAccentMock,
}));

vi.mock('../../hooks/useEffectiveUser', () => ({
  default: () => effectiveUserState,
}));

vi.mock('../../hooks/useStudyCapabilities', () => ({
  useStudyCapabilities: () => ({ data: studyCapabilitiesFixture }),
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
  revision: 1,
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

export const resetStudyCreatePageTest = () => {
  window.localStorage.clear();
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
  effectiveUserState.effectiveUser = { id: 'user-1' };
  effectiveUserState.isImpersonating = false;
  effectiveUserState.loading = false;
  manualDraftsState.drafts = [];
  manualDraftsState.error = null;
  manualDraftsState.isLoading = false;
  regenerateCandidateAudioMock.mockReset();
  retryManualDraftMock.mockReset();
  retryManualDraftState.isPending = false;
  resolveStudyCardPitchAccentMock.mockReset();
  useStudyManualCardDraftsMock.mockReset();
  updateManualDraftMock.mockReset();
  updateManualDraftMutateMock.mockReset();
  updateManualDraftState.error = null;
  updateManualDraftState.isPending = false;
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
  updateManualDraftMock.mockImplementation(async ({ draftId, values }) => {
    const { expectedRevision, ...draftValues } = values;
    return manualDraft({
      id: draftId,
      revision: (expectedRevision ?? 0) + 1,
      ...draftValues,
    });
  });
  regenerateCandidateAudioMock.mockResolvedValue({
    revision: 2,
    previewAudio: {
      id: 'media-regenerated',
      filename: 'candidate-regenerated.mp3',
      url: '/api/study/media/media-regenerated',
      mediaKind: 'audio',
      source: 'generated',
    },
    previewAudioRole: 'answer',
  });
  resolveStudyCardPitchAccentMock.mockImplementation(async (cardId: string) => ({
    id: cardId,
    answer: { pitchAccent: null },
  }));
};

export const restoreStudyCreatePageTest = () => {
  vi.useRealTimers();
};

export {
  MANUAL_STUDY_CARD_DEFAULT_VOICE_IDS,
  chooseAnswerAudioVoice,
  chooseManualCardType,
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
  effectiveUserState,
  manualDraftsState,
  regenerateCandidateAudioMock,
  retryManualDraftMock,
  retryManualDraftState,
  resolveStudyCardPitchAccentMock,
  useStudyManualCardDraftsMock,
  updateManualDraftMock,
  updateManualDraftMutateMock,
  updateManualDraftState,
  renderPage,
  manualDraft,
};
