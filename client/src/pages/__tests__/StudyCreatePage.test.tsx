import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';
import {
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
} from '@languageflow/shared/src/studyConstants';
import type { StudyCardCandidatePreviewImageResponse } from '@languageflow/shared/src/types';

import StudyCreatePage from '../StudyCreatePage';

async function chooseAnswerAudioVoice(name: RegExp | string) {
  await userEvent.click(screen.getByLabelText('Answer audio voice'));
  await userEvent.click(await screen.findByRole('option', { name }));
}

const {
  commitCandidatesMock,
  commitCandidatesState,
  completeDraftMock,
  completeDraftState,
  createStudyCardMock,
  generateDraftImageMock,
  generateDraftImageState,
  generateCandidatesState,
  generateCandidatesMock,
  regenerateCandidateAudioMock,
  regenerateCandidateImageMock,
  resolveStudyCardPitchAccentMock,
} = vi.hoisted(() => ({
  commitCandidatesMock: vi.fn(),
  commitCandidatesState: { isPending: false },
  completeDraftMock: vi.fn(),
  completeDraftState: { error: null as Error | null, isPending: false },
  createStudyCardMock: vi.fn(),
  generateDraftImageMock: vi.fn(),
  generateDraftImageState: { error: null as Error | null, isPending: false },
  generateCandidatesState: { error: null as Error | null, isPending: false },
  generateCandidatesMock: vi.fn(),
  regenerateCandidateAudioMock: vi.fn(),
  regenerateCandidateImageMock: vi.fn(),
  resolveStudyCardPitchAccentMock: vi.fn(),
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
  useGenerateStudyCardDraftImage: () => ({
    mutateAsync: generateDraftImageMock,
    isPending: generateDraftImageState.isPending,
    error: generateDraftImageState.error,
  }),
  useGenerateStudyCardCandidates: () => ({
    mutateAsync: generateCandidatesMock,
    isPending: generateCandidatesState.isPending,
    error: generateCandidatesState.error,
  }),
  useRegenerateStudyCardCandidatePreviewAudio: () => ({
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

const productionCandidate = (overrides: Record<string, unknown> = {}) => ({
  clientId: 'candidate-1',
  candidateKind: 'production',
  cardType: 'production',
  prompt: { cueMeaning: 'company' },
  answer: {
    expression: '会社',
    expressionReading: '会社[かいしゃ]',
    meaning: 'company',
    answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
  },
  rationale: 'Production checks recall.',
  warnings: [],
  previewAudio: null,
  previewAudioRole: null,
  ...overrides,
});

const recognitionCandidate = (overrides: Record<string, unknown> = {}) => ({
  clientId: 'recognize-1',
  candidateKind: 'text-recognition',
  cardType: 'recognition',
  prompt: { cueText: 'company', cueMeaning: 'company' },
  answer: {
    expression: '会社',
    expressionReading: '会社[かいしゃ]',
    meaning: 'company',
    answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
  },
  rationale: 'Recognition checks understanding.',
  warnings: [],
  previewAudio: null,
  previewAudioRole: null,
  previewImage: null,
  imagePrompt: null,
  ...overrides,
});

describe('StudyCreatePage', () => {
  beforeEach(() => {
    commitCandidatesMock.mockReset();
    commitCandidatesState.isPending = false;
    completeDraftMock.mockReset();
    completeDraftState.error = null;
    completeDraftState.isPending = false;
    createStudyCardMock.mockReset();
    generateDraftImageMock.mockReset();
    generateDraftImageState.error = null;
    generateDraftImageState.isPending = false;
    generateCandidatesState.error = null;
    generateCandidatesState.isPending = false;
    generateCandidatesMock.mockReset();
    regenerateCandidateAudioMock.mockReset();
    regenerateCandidateImageMock.mockReset();
    resolveStudyCardPitchAccentMock.mockReset();
    commitCandidatesMock.mockResolvedValue({ cards: [{ id: 'created-1' }] });
    createStudyCardMock.mockResolvedValue({ cardType: 'recognition' });
    generateCandidatesMock.mockResolvedValue({ candidates: [], learnerContextSummary: null });
    regenerateCandidateAudioMock.mockResolvedValue({
      prompt: { cueMeaning: 'company' },
      answer: {
        expression: '会社',
        meaning: 'company',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
      },
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

  it('creates a recognition card and shows a success message', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.type(screen.getByLabelText('Prompt text'), '会社');
    await userEvent.type(screen.getByLabelText('Answer expression'), '会社');
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'company');
    await chooseAnswerAudioVoice(/Sato/);
    await userEvent.type(screen.getByLabelText('Phonetic audio override'), 'かいしゃ');
    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));

    expect(createStudyCardMock).toHaveBeenCalledWith({
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
    });
    expect(
      await screen.findByText('Created recognition card and seeded it into the study queue.')
    ).toBeInTheDocument();
  });

  it('fills only blank manual fields and keeps user-entered values', async () => {
    completeDraftMock.mockResolvedValue({
      creationKind: 'text-recognition',
      cardType: 'recognition',
      prompt: {
        cueText: '会社 should not replace user text',
        cueReading: '会社[かいしゃ]',
        cueMeaning: 'company prompt hint',
      },
      answer: {
        expression: '会社',
        expressionReading: '会社[かいしゃ]',
        meaning: 'company should not replace user meaning',
        notes: 'Business noun.',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
      },
      imagePlacement: 'answer',
      imagePrompt: 'A realistic photo of a company office. No text.',
      previewImage: null,
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    expect(screen.getByRole('radio', { name: 'Text recognition' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await userEvent.type(screen.getByLabelText('Prompt text'), '会社');
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'company');
    await userEvent.click(screen.getByRole('button', { name: 'Fill remaining fields' }));

    expect(screen.getByLabelText('Prompt text')).toHaveValue('会社');
    expect(screen.getByLabelText('Prompt reading')).toHaveValue('会社[かいしゃ]');
    expect(screen.getByLabelText('Answer expression')).toHaveValue('会社');
    expect(screen.getByLabelText('Answer meaning')).toHaveValue('company');
    expect(screen.getByLabelText('Image prompt')).toHaveValue(
      'A realistic photo of a company office. No text.'
    );
    expect(screen.getByLabelText('Image placement')).toHaveValue('answer');
  });

  it('auto-generates the image preview when filling production-from-image', async () => {
    completeDraftMock.mockResolvedValue({
      creationKind: 'production-image',
      cardType: 'production',
      prompt: { cueMeaning: '名詞' },
      answer: {
        expression: '曇り',
        expressionReading: '曇り[くもり]',
        meaning: 'cloudy weather',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
      },
      imagePlacement: 'prompt',
      imagePrompt: 'A realistic photo of cloudy weather over Tokyo. No text.',
      previewImage: {
        id: 'manual-image',
        filename: 'manual-image.webp',
        url: '/api/study/media/manual-image',
        mediaKind: 'image',
        source: 'generated',
      },
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Production from image' }));
    await userEvent.type(screen.getByLabelText('Prompt text'), 'cloudy weather');
    await userEvent.click(screen.getByRole('button', { name: 'Fill remaining fields' }));

    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      'http://localhost:3001/api/study/media/manual-image'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));
    expect(createStudyCardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        creationKind: 'production-image',
        cardType: 'production',
        prompt: expect.objectContaining({
          cueImage: expect.objectContaining({ id: 'manual-image' }),
          cueText: null,
        }),
      })
    );
  });

  it('clears production-image preview state when switching to another manual kind', async () => {
    completeDraftMock.mockResolvedValue({
      creationKind: 'production-image',
      cardType: 'production',
      prompt: { cueMeaning: '名詞' },
      answer: {
        expression: '曇り',
        expressionReading: '曇り[くもり]',
        meaning: 'cloudy weather',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
      },
      imagePlacement: 'prompt',
      imagePrompt: 'A realistic photo of cloudy weather over Tokyo. No text.',
      previewImage: {
        id: 'manual-image',
        filename: 'manual-image.webp',
        url: '/api/study/media/manual-image',
        mediaKind: 'image',
        source: 'generated',
      },
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Production from image' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fill remaining fields' }));
    expect(screen.getByAltText('Generated card prompt')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Text recognition' }));

    expect(screen.queryByAltText('Generated card prompt')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Image prompt')).toHaveValue('');
    expect(screen.getByLabelText('Image placement')).toHaveValue('none');
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

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.type(
      screen.getByLabelText('Image prompt'),
      'A construction paper illustration of a company office. No text.'
    );
    await userEvent.selectOptions(screen.getByLabelText('Image placement'), 'both');
    await userEvent.click(screen.getByRole('button', { name: 'Generate image' }));

    expect(generateDraftImageMock).toHaveBeenCalledWith({
      imagePrompt: 'A construction paper illustration of a company office. No text.',
      imagePlacement: 'both',
    });
    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      'http://localhost:3001/api/study/media/manual-image'
    );
  });

  it('defaults new cards to the Japanese narrator voice', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    expect(screen.getByLabelText('Answer audio voice')).toHaveTextContent('Shohei');
    expect(screen.getByTestId('voice-preview')).toHaveTextContent(DEFAULT_NARRATOR_VOICES.ja);
  });

  it('shows fake progress while candidate generation is pending', () => {
    vi.useFakeTimers();
    generateCandidatesState.isPending = true;

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Candidate generation progress' })
    ).toBeInTheDocument();
    expect(screen.getByText('Building candidate cards…')).toBeInTheDocument();
    expect(screen.getByText('This can take a little while.')).toBeInTheDocument();
    expect(screen.getByTestId('study-generate-progress-percent')).toHaveTextContent('0%');
  });

  it('advances fake generation progress but keeps it below complete while pending', () => {
    vi.useFakeTimers();
    generateCandidatesState.isPending = true;

    renderPage();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    const warmupPercentText =
      screen.getByTestId('study-generate-progress-percent').textContent ?? '';
    const warmupPercent = Number(warmupPercentText.replace('%', ''));
    expect(warmupPercent).toBeGreaterThanOrEqual(24);
    expect(warmupPercent).toBeLessThanOrEqual(26);

    act(() => {
      vi.advanceTimersByTime(56_000);
    });

    const percentText = screen.getByTestId('study-generate-progress-percent').textContent ?? '';
    const percent = Number(percentText.replace('%', ''));
    expect(percent).toBeGreaterThan(90);
    expect(percent).toBeLessThan(100);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(percent));
  });

  it('briefly completes and hides fake progress when candidate generation resolves', () => {
    vi.useFakeTimers();
    generateCandidatesState.isPending = true;
    const { rerenderPage } = renderPage();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    generateCandidatesState.isPending = false;
    rerenderPage();

    expect(screen.getByTestId('study-generate-progress-percent')).toHaveTextContent('100%');

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(
      screen.queryByRole('status', { name: 'Candidate generation progress' })
    ).not.toBeInTheDocument();
  });

  it('hides fake progress immediately when candidate generation fails', () => {
    vi.useFakeTimers();
    generateCandidatesState.isPending = true;
    const { rerenderPage } = renderPage();

    expect(
      screen.getByRole('status', { name: 'Candidate generation progress' })
    ).toBeInTheDocument();

    generateCandidatesState.isPending = false;
    generateCandidatesState.error = new Error('OpenAI failed to generate content.');
    rerenderPage();

    expect(
      screen.queryByRole('status', { name: 'Candidate generation progress' })
    ).not.toBeInTheDocument();
  });

  it('generates candidate cards and commits selected edited candidates', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: '- recognition/relearning: 会社 - company',
      candidates: [
        {
          clientId: 'candidate-1',
          candidateKind: 'audio-recognition',
          cardType: 'recognition',
          prompt: {
            cueAudio: {
              id: 'media-1',
              filename: 'candidate-1.mp3',
              url: '/api/study/media/media-1',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
          answer: {
            expression: '会社',
            expressionReading: '会社[かいしゃ]',
            meaning: 'company',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
            answerAudio: {
              id: 'media-1',
              filename: 'candidate-1.mp3',
              url: '/api/study/media/media-1',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
          rationale: 'Listening practice is useful.',
          warnings: [],
          previewAudio: {
            id: 'media-1',
            filename: 'candidate-1.mp3',
            url: '/api/study/media/media-1',
            mediaKind: 'audio',
            source: 'generated',
          },
          previewAudioRole: 'prompt',
        },
      ],
    });

    renderPage();

    const targetInput = screen.getByLabelText('Target word or sentence');
    const contextInput = screen.getByLabelText('Extra context or instructions');
    expect(targetInput).toHaveAttribute('maxlength', String(STUDY_CANDIDATE_TARGET_MAX_LENGTH));
    expect(contextInput).toHaveAttribute('maxlength', String(STUDY_CANDIDATE_CONTEXT_MAX_LENGTH));

    await userEvent.type(targetInput, '会社');
    await userEvent.type(contextInput, 'Business word');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    expect(generateCandidatesMock).toHaveBeenCalledWith({
      targetText: '会社',
      context: 'Business word',
      includeLearnerContext: true,
    });
    expect(await screen.findByText('Audio recognition')).toBeInTheDocument();
    expect(screen.getByText('- recognition/relearning: 会社 - company')).toBeInTheDocument();
    expect(screen.queryByLabelText('Prompt text')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-url',
      'http://localhost:3001/api/study/media/media-1'
    );
    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-size',
      'compact'
    );
    const regenerateToVoicePosition = screen
      .getByRole('button', { name: 'Regenerate audio' })
      .compareDocumentPosition(screen.getByLabelText('Answer audio voice'));
    expect(regenerateToVoicePosition).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await userEvent.clear(screen.getByLabelText('Answer meaning'));
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'business');
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));

    expect(commitCandidatesMock).toHaveBeenCalledWith({
      candidates: [
        expect.objectContaining({
          candidateKind: 'audio-recognition',
          cardType: 'recognition',
          prompt: {
            cueAudio: {
              id: 'media-1',
              filename: 'candidate-1.mp3',
              url: '/api/study/media/media-1',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
          answer: expect.objectContaining({
            expression: '会社',
            meaning: 'business',
          }),
          previewAudioRole: 'prompt',
        }),
      ],
    });
    expect(commitCandidatesMock.mock.calls[0]?.[0].candidates[0].answer).not.toHaveProperty(
      'answerAudio'
    );
    expect(
      await screen.findByText('Created 1 generated card and added it to the study queue.')
    ).toBeInTheDocument();
  });

  it('regenerates candidate audio and commits the refreshed preview', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [
        {
          clientId: 'candidate-1',
          candidateKind: 'production',
          cardType: 'production',
          prompt: { cueMeaning: 'company' },
          answer: {
            expression: '会社',
            expressionReading: '会社[かいしゃ]',
            meaning: 'company',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          rationale: 'Production checks recall.',
          warnings: [],
          previewAudio: {
            id: 'media-1',
            filename: 'candidate-1.mp3',
            url: '/api/study/media/media-1',
            mediaKind: 'audio',
            source: 'generated',
          },
          previewAudioRole: 'answer',
        },
      ],
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));
    expect(await screen.findByText('Production')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));

    expect(regenerateCandidateAudioMock).toHaveBeenCalledWith({
      candidate: expect.objectContaining({
        candidateKind: 'production',
        previewAudio: expect.objectContaining({ id: 'media-1' }),
      }),
    });

    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-url',
      'http://localhost:3001/api/study/media/media-regenerated'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));

    expect(commitCandidatesMock).toHaveBeenCalledWith({
      candidates: [
        expect.objectContaining({
          candidateKind: 'production',
          previewAudio: expect.objectContaining({ id: 'media-regenerated' }),
          previewAudioRole: 'answer',
        }),
      ],
    });
  });

  it('renders visual production candidates and commits the regenerated image', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [
        productionCandidate({
          prompt: {
            cueMeaning: '名詞',
            cueImage: {
              id: 'image-1',
              filename: 'cloudy.png',
              url: '/api/study/media/image-1',
              mediaKind: 'image',
              source: 'generated',
            },
          },
          answer: {
            expression: '曇り',
            expressionReading: '曇り[くもり]',
            meaning: 'cloudy weather',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          previewImage: {
            id: 'image-1',
            filename: 'cloudy.png',
            url: '/api/study/media/image-1',
            mediaKind: 'image',
            source: 'generated',
          },
          imagePrompt: 'A simple image of cloudy weather.',
        }),
      ],
    });
    regenerateCandidateImageMock.mockResolvedValueOnce({
      prompt: {
        cueMeaning: '名詞',
        cueImage: {
          id: 'image-2',
          filename: 'cloudy-new.png',
          url: '/api/study/media/image-2',
          mediaKind: 'image',
          source: 'generated',
        },
      },
      answer: {
        expression: '曇り',
        expressionReading: '曇り[くもり]',
        meaning: 'cloudy weather',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
      },
      previewImage: {
        id: 'image-2',
        filename: 'cloudy-new.png',
        url: '/api/study/media/image-2',
        mediaKind: 'image',
        source: 'generated',
      },
      imagePrompt: 'A clearer image of cloudy weather over Tokyo.',
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '曇り');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    expect(await screen.findByText('Prompt image preview')).toBeInTheDocument();
    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      'http://localhost:3001/api/study/media/image-1'
    );

    await userEvent.clear(screen.getByLabelText('Image prompt'));
    await userEvent.type(
      screen.getByLabelText('Image prompt'),
      'A clearer image of cloudy weather over Tokyo.'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate image' }));

    await waitFor(() => {
      expect(regenerateCandidateImageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          imagePrompt: 'A clearer image of cloudy weather over Tokyo.',
          candidate: expect.objectContaining({
            previewImage: expect.objectContaining({ id: 'image-1' }),
          }),
        })
      );
    });

    await userEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));

    expect(commitCandidatesMock.mock.calls[0]?.[0]).toMatchObject({
      candidates: [
        {
          prompt: {
            cueMeaning: '名詞',
            cueImage: {
              id: 'image-2',
              mediaKind: 'image',
            },
          },
          previewImage: {
            id: 'image-2',
            mediaKind: 'image',
          },
          imagePrompt: 'A clearer image of cloudy weather over Tokyo.',
        },
      ],
    });
  });

  it('can add an optional generated answer image to recognition candidates', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [recognitionCandidate()],
    });
    regenerateCandidateImageMock.mockResolvedValueOnce({
      prompt: { cueText: 'company', cueMeaning: 'company' },
      answer: {
        expression: '会社',
        expressionReading: '会社[かいしゃ]',
        meaning: 'company',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        answerImage: {
          id: 'answer-image-1',
          filename: 'company-answer.webp',
          url: '/api/study/media/answer-image-1',
          mediaKind: 'image',
          source: 'generated',
        },
      },
      previewImage: {
        id: 'answer-image-1',
        filename: 'company-answer.webp',
        url: '/api/study/media/answer-image-1',
        mediaKind: 'image',
        source: 'generated',
      },
      imagePrompt: 'A small Japanese company office sign.',
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    expect(await screen.findByText('Answer image preview')).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText('Image prompt'),
      'A small Japanese company office sign.'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate image' }));

    expect(await screen.findByAltText('Generated card answer')).toHaveAttribute(
      'src',
      'http://localhost:3001/api/study/media/answer-image-1'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));

    expect(commitCandidatesMock.mock.calls[0]?.[0]).toMatchObject({
      candidates: [
        {
          candidateKind: 'text-recognition',
          prompt: {
            cueText: 'company',
            cueMeaning: 'company',
          },
          answer: {
            answerImage: {
              id: 'answer-image-1',
              mediaKind: 'image',
            },
          },
          previewImage: {
            id: 'answer-image-1',
            mediaKind: 'image',
          },
          imagePrompt: 'A small Japanese company office sign.',
        },
      ],
    });
  });

  it('shows an empty optional answer image prompt for recognition candidates without images', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [recognitionCandidate()],
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    expect(await screen.findByText('Answer image preview')).toBeInTheDocument();
    expect(screen.getByLabelText('Image prompt')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Regenerate image' })).toBeDisabled();
  });

  it('lazy-loads missing visual production images after candidates render', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [
        productionCandidate({
          prompt: { cueMeaning: '名詞' },
          answer: {
            expression: '曇り',
            expressionReading: '曇り[くもり]',
            meaning: 'cloudy weather',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          previewImage: null,
          imagePrompt: 'A simple image of cloudy weather.',
        }),
      ],
    });
    regenerateCandidateImageMock.mockResolvedValueOnce({
      prompt: {
        cueMeaning: '名詞',
        cueImage: {
          id: 'image-lazy',
          filename: 'cloudy-lazy.webp',
          url: '/api/study/media/image-lazy',
          mediaKind: 'image',
          source: 'generated',
        },
      },
      answer: {
        expression: '曇り',
        expressionReading: '曇り[くもり]',
        meaning: 'cloudy weather',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
      },
      previewImage: {
        id: 'image-lazy',
        filename: 'cloudy-lazy.webp',
        url: '/api/study/media/image-lazy',
        mediaKind: 'image',
        source: 'generated',
      },
      imagePrompt: 'A simple image of cloudy weather.',
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '曇り');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    expect(await screen.findByText('Prompt image preview')).toBeInTheDocument();
    await waitFor(() => {
      expect(regenerateCandidateImageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          imagePrompt: 'A simple image of cloudy weather.',
        })
      );
    });
    expect(await screen.findByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      'http://localhost:3001/api/study/media/image-lazy'
    );
  });

  it('unblocks generation when a new generate starts during lazy image backfill', async () => {
    generateCandidatesMock.mockResolvedValueOnce({
      learnerContextSummary: null,
      candidates: [
        productionCandidate({
          prompt: { cueMeaning: '名詞' },
          answer: {
            expression: '曇り',
            expressionReading: '曇り[くもり]',
            meaning: 'cloudy weather',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          previewImage: null,
          imagePrompt: 'A simple image of cloudy weather.',
        }),
      ],
    });
    let resolveImageBackfill: ((value: StudyCardCandidatePreviewImageResponse) => void) | null =
      null;
    regenerateCandidateImageMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveImageBackfill = resolve;
        })
    );

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '曇り');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    expect(await screen.findByText('Prompt image preview')).toBeInTheDocument();
    await waitFor(() => {
      expect(regenerateCandidateImageMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('button', { name: 'Generate candidates' })).toBeDisabled();

    fireEvent.submit(screen.getByTestId('study-generate-form'));

    await waitFor(() => {
      expect(generateCandidatesMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Generate candidates' })).toBeEnabled();
    });
    expect(screen.queryByText('Prompt image preview')).not.toBeInTheDocument();

    await act(async () => {
      resolveImageBackfill?.({
        prompt: {
          cueMeaning: '名詞',
          cueImage: {
            id: 'stale-image',
            filename: 'stale-image.webp',
            url: '/api/study/media/stale-image',
            mediaKind: 'image',
            source: 'generated',
          },
        },
        answer: {
          expression: '曇り',
          expressionReading: '曇り[くもり]',
          meaning: 'cloudy weather',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
        previewImage: {
          id: 'stale-image',
          filename: 'stale-image.webp',
          url: '/api/study/media/stale-image',
          mediaKind: 'image',
          source: 'generated',
        },
        imagePrompt: 'A simple image of cloudy weather.',
      });
    });

    expect(screen.getByRole('button', { name: 'Generate candidates' })).toBeEnabled();
    expect(screen.queryByAltText('Generated card prompt')).not.toBeInTheDocument();
  });

  it('unblocks generation after committing while lazy image backfill is running', async () => {
    let resolveImageBackfill: ((value: StudyCardCandidatePreviewImageResponse) => void) | undefined;
    generateCandidatesMock.mockResolvedValueOnce({
      learnerContextSummary: null,
      candidates: [
        productionCandidate({
          prompt: { cueMeaning: '名詞' },
          answer: {
            expression: '曇り',
            expressionReading: '曇り[くもり]',
            meaning: 'cloudy weather',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          previewImage: null,
          imagePrompt: 'A simple image of cloudy weather.',
        }),
      ],
    });
    regenerateCandidateImageMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveImageBackfill = resolve;
        })
    );

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '曇り');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    expect(await screen.findByText('Prompt image preview')).toBeInTheDocument();
    await waitFor(() => {
      expect(regenerateCandidateImageMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('button', { name: 'Generate candidates' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));

    await waitFor(() => {
      expect(commitCandidatesMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Generate candidates' })).toBeEnabled();
    });

    await act(async () => {
      resolveImageBackfill?.({
        prompt: {
          cueMeaning: '名詞',
          cueImage: {
            id: 'late-image',
            filename: 'late-image.webp',
            url: '/api/study/media/late-image',
            mediaKind: 'image',
            source: 'generated',
          },
        },
        answer: {
          expression: '曇り',
          expressionReading: '曇り[くもり]',
          meaning: 'cloudy weather',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
        previewImage: {
          id: 'late-image',
          filename: 'late-image.webp',
          url: '/api/study/media/late-image',
          mediaKind: 'image',
          source: 'generated',
        },
        imagePrompt: 'A simple image of cloudy weather.',
      });
    });
  });

  it('keeps an existing image preview when the image prompt changes without regeneration', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [
        productionCandidate({
          prompt: {
            cueMeaning: '名詞',
            cueImage: {
              id: 'image-1',
              filename: 'cloudy.png',
              url: '/api/study/media/image-1',
              mediaKind: 'image',
              source: 'generated',
            },
          },
          previewImage: {
            id: 'image-1',
            filename: 'cloudy.png',
            url: '/api/study/media/image-1',
            mediaKind: 'image',
            source: 'generated',
          },
          imagePrompt: 'A simple image of cloudy weather.',
        }),
      ],
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '曇り');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));
    await userEvent.clear(await screen.findByLabelText('Image prompt'));
    await userEvent.type(screen.getByLabelText('Image prompt'), 'A newly edited image prompt.');
    expect(screen.getByAltText('Generated card prompt')).toHaveAttribute(
      'src',
      'http://localhost:3001/api/study/media/image-1'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));

    expect(commitCandidatesMock.mock.calls[0]?.[0]).toMatchObject({
      candidates: [
        {
          previewImage: {
            id: 'image-1',
            mediaKind: 'image',
          },
          imagePrompt: 'A newly edited image prompt.',
        },
      ],
    });
  });

  it('serializes a blank candidate image prompt as null', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [
        productionCandidate({
          prompt: {
            cueMeaning: '名詞',
            cueImage: {
              id: 'image-1',
              filename: 'cloudy.png',
              url: '/api/study/media/image-1',
              mediaKind: 'image',
              source: 'generated',
            },
          },
          previewImage: {
            id: 'image-1',
            filename: 'cloudy.png',
            url: '/api/study/media/image-1',
            mediaKind: 'image',
            source: 'generated',
          },
          imagePrompt: 'A simple image of cloudy weather.',
        }),
      ],
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '曇り');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));
    await userEvent.clear(await screen.findByLabelText('Image prompt'));
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 selected' }));

    expect(commitCandidatesMock.mock.calls[0]?.[0]).toMatchObject({
      candidates: [
        {
          imagePrompt: null,
        },
      ],
    });
  });

  it('shows an expected wait indicator while selected candidates are being added', async () => {
    commitCandidatesState.isPending = true;
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [productionCandidate()],
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Adding 1 selected card(s). Audio may be regenerated one card at a time'
    );
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
  });

  it('shows candidate audio regeneration loading and errors per candidate', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [
        {
          clientId: 'candidate-1',
          candidateKind: 'production',
          cardType: 'production',
          prompt: { cueMeaning: 'company' },
          answer: {
            expression: '会社',
            expressionReading: '会社[かいしゃ]',
            meaning: 'company',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          rationale: 'Production checks recall.',
          warnings: [],
          previewAudio: null,
          previewAudioRole: null,
        },
        {
          clientId: 'candidate-2',
          candidateKind: 'text-recognition',
          cardType: 'recognition',
          prompt: { cueText: '学校' },
          answer: {
            expression: '学校',
            expressionReading: '学校[がっこう]',
            meaning: 'school',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          rationale: 'Reading checks recognition.',
          warnings: [],
          previewAudio: null,
          previewAudioRole: null,
        },
      ],
    });
    let rejectRegeneration: ((error: Error) => void) | null = null;
    regenerateCandidateAudioMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRegeneration = reject;
        })
    );

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    const regenerateButtons = await screen.findAllByRole('button', { name: 'Regenerate audio' });
    await userEvent.click(regenerateButtons[0]);

    expect(screen.getByRole('button', { name: 'Regenerating…' })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Regenerating…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate candidates' })).toBeDisabled();
    const otherRegenerateButton = screen.getByRole('button', { name: 'Regenerate audio' });
    expect(otherRegenerateButton).toBeDisabled();

    await act(async () => {
      rejectRegeneration?.(new Error('Voice unavailable'));
    });

    expect(await screen.findByText('Voice unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate candidates' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: 'Regenerate audio' })).toHaveLength(2);
  });

  it('blocks concurrent candidate audio regeneration requests from rapid clicks', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [
        productionCandidate({ clientId: 'candidate-1' }),
        productionCandidate({
          clientId: 'candidate-2',
          prompt: { cueMeaning: 'school' },
          answer: {
            expression: '学校',
            expressionReading: '学校[がっこう]',
            meaning: 'school',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
        }),
      ],
    });
    let resolveRegeneration:
      | ((value: Awaited<ReturnType<typeof regenerateCandidateAudioMock>>) => void)
      | null = null;
    regenerateCandidateAudioMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRegeneration = resolve;
        })
    );

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    const regenerateButtons = await screen.findAllByRole('button', { name: 'Regenerate audio' });
    act(() => {
      regenerateButtons[0].click();
      regenerateButtons[1].click();
    });

    expect(regenerateCandidateAudioMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Regenerating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Regenerate audio' })).toBeDisabled();

    await act(async () => {
      resolveRegeneration?.({
        prompt: { cueMeaning: 'company' },
        answer: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
        previewAudio: {
          id: 'media-regenerated',
          filename: 'candidate-regenerated.mp3',
          url: '/api/study/media/media-regenerated',
          mediaKind: 'audio',
          source: 'generated',
        },
        previewAudioRole: 'answer',
      });
    });
  });

  it('ignores stale candidate audio regeneration results after a new generation replaces candidates', async () => {
    generateCandidatesMock
      .mockResolvedValueOnce({
        learnerContextSummary: null,
        candidates: [productionCandidate({ clientId: 'old-candidate' })],
      })
      .mockResolvedValueOnce({
        learnerContextSummary: null,
        candidates: [
          productionCandidate({
            clientId: 'new-candidate',
            prompt: { cueMeaning: 'school' },
            answer: {
              expression: '学校',
              expressionReading: '学校[がっこう]',
              meaning: 'school',
              answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
            },
          }),
        ],
      });
    let resolveRegeneration:
      | ((value: Awaited<ReturnType<typeof regenerateCandidateAudioMock>>) => void)
      | null = null;
    regenerateCandidateAudioMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRegeneration = resolve;
        })
    );

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));
    expect(await screen.findByLabelText('Answer expression')).toHaveValue('会社');

    await userEvent.click(screen.getByRole('button', { name: 'Regenerate audio' }));
    await userEvent.clear(screen.getByLabelText('Target word or sentence'));
    await userEvent.type(screen.getByLabelText('Target word or sentence'), '学校');
    fireEvent.submit(screen.getByTestId('study-generate-form'));
    expect(await screen.findByLabelText('Answer expression')).toHaveValue('学校');

    await act(async () => {
      resolveRegeneration?.({
        prompt: { cueMeaning: 'company' },
        answer: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          answerAudio: {
            id: 'stale-media',
            filename: 'stale.mp3',
            url: '/api/study/media/stale-media',
            mediaKind: 'audio',
            source: 'generated',
          },
        },
        previewAudio: {
          id: 'stale-media',
          filename: 'stale.mp3',
          url: '/api/study/media/stale-media',
          mediaKind: 'audio',
          source: 'generated',
        },
        previewAudioRole: 'answer',
      });
    });

    expect(screen.getByLabelText('Answer expression')).toHaveValue('学校');
    expect(
      screen.queryByRole('button', { name: 'Play generated preview audio' })
    ).not.toBeInTheDocument();
  });

  it('opens a candidate card preview and flips to the answer', async () => {
    generateCandidatesMock.mockResolvedValue({
      learnerContextSummary: null,
      candidates: [
        {
          clientId: 'candidate-1',
          candidateKind: 'production',
          cardType: 'production',
          prompt: { cueMeaning: 'company' },
          answer: {
            expression: '会社',
            expressionReading: '会社[かいしゃ]',
            meaning: 'company',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          rationale: 'Production checks recall.',
          warnings: [],
          previewAudio: {
            id: 'media-1',
            filename: 'candidate-1.mp3',
            url: '/api/study/media/media-1',
            mediaKind: 'audio',
            source: 'generated',
          },
          previewAudioRole: 'answer',
        },
      ],
    });

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Preview card' }));

    expect(screen.getByRole('dialog', { name: 'Card preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(screen.getByText('Prompt side')).toBeInTheDocument();
    expect(screen.getAllByText('company').length).toBeGreaterThan(0);

    screen.getByRole('button', { name: /company/i }).focus();
    await userEvent.keyboard(' ');

    expect(screen.getByText('Answer side')).toBeInTheDocument();
    expect(screen.getByTestId('study-japanese-heading')).toHaveTextContent('会社');
    expect(screen.getByRole('button', { name: 'Play answer audio' })).toHaveAttribute(
      'data-url',
      'http://localhost:3001/api/study/media/media-1'
    );
  });

  it('clears stale generated candidates while a new generation is pending', async () => {
    generateCandidatesMock.mockResolvedValueOnce({
      learnerContextSummary: null,
      candidates: [
        {
          clientId: 'candidate-1',
          candidateKind: 'production',
          cardType: 'production',
          prompt: { cueMeaning: 'company' },
          answer: {
            expression: '会社',
            expressionReading: '会社[かいしゃ]',
            meaning: 'company',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          rationale: 'Production checks recall.',
          warnings: [],
          previewAudio: null,
          previewAudioRole: null,
        },
      ],
    });
    let resolveSecondGeneration:
      | ((value: { candidates: unknown[]; learnerContextSummary: null }) => void)
      | null = null;

    renderPage();

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));
    expect(await screen.findByText('Production')).toBeInTheDocument();

    generateCandidatesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecondGeneration = resolve;
        })
    );

    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    await waitFor(() => {
      expect(screen.queryByText('Production')).not.toBeInTheDocument();
    });

    await act(async () => {
      resolveSecondGeneration?.({ candidates: [], learnerContextSummary: null });
    });
  });
});
