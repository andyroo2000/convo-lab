import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';

import StudyCreatePage from '../StudyCreatePage';

const { commitCandidatesMock, createStudyCardMock, generateCandidatesMock } = vi.hoisted(() => ({
  commitCandidatesMock: vi.fn(),
  createStudyCardMock: vi.fn(),
  generateCandidatesMock: vi.fn(),
}));

vi.mock('../../hooks/useStudy', () => ({
  useCommitStudyCardCandidates: () => ({
    mutateAsync: commitCandidatesMock,
    isPending: false,
    error: null,
  }),
  useCreateStudyCard: () => ({
    mutateAsync: createStudyCardMock,
    isPending: false,
    error: null,
  }),
  useGenerateStudyCardCandidates: () => ({
    mutateAsync: generateCandidatesMock,
    isPending: false,
    error: null,
  }),
}));

vi.mock('../../components/common/VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => <span data-testid="voice-preview">{voiceId}</span>,
}));

vi.mock('../../components/study/StudyAudioPlayer', () => ({
  default: ({ label, url }: { label: string; url: string }) => (
    <button type="button" data-url={url}>
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

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StudyCreatePage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('StudyCreatePage', () => {
  beforeEach(() => {
    commitCandidatesMock.mockReset();
    createStudyCardMock.mockReset();
    generateCandidatesMock.mockReset();
    commitCandidatesMock.mockResolvedValue({ cards: [{ id: 'created-1' }] });
    createStudyCardMock.mockResolvedValue({ cardType: 'recognition' });
    generateCandidatesMock.mockResolvedValue({ candidates: [], learnerContextSummary: null });
  });

  it('creates a recognition card and shows a success message', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    await userEvent.type(screen.getByLabelText('Prompt text'), '会社');
    await userEvent.type(screen.getByLabelText('Answer expression'), '会社');
    await userEvent.type(screen.getByLabelText('Answer meaning'), 'company');
    await userEvent.selectOptions(screen.getByLabelText('Answer audio voice'), 'ja-JP-Neural2-C');
    await userEvent.type(screen.getByLabelText('Phonetic audio override'), 'かいしゃ');
    await userEvent.click(screen.getByRole('button', { name: 'Create card' }));

    expect(createStudyCardMock).toHaveBeenCalledWith({
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
        answerAudioVoiceId: 'ja-JP-Neural2-C',
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

  it('defaults new cards to the Japanese narrator voice', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Create manually' }));
    expect(screen.getByLabelText('Answer audio voice')).toHaveValue(DEFAULT_NARRATOR_VOICES.ja);
    expect(screen.getByTestId('voice-preview')).toHaveTextContent(DEFAULT_NARRATOR_VOICES.ja);
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

    await userEvent.type(screen.getByLabelText('Target word or sentence'), '会社');
    await userEvent.type(screen.getByLabelText('Extra context or instructions'), 'Business word');
    await userEvent.click(screen.getByRole('button', { name: 'Generate candidates' }));

    expect(generateCandidatesMock).toHaveBeenCalledWith({
      targetText: '会社',
      context: 'Business word',
      includeLearnerContext: true,
    });
    expect(await screen.findByText('Audio recognition')).toBeInTheDocument();
    expect(screen.queryByLabelText('Prompt text')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play generated preview audio' })).toHaveAttribute(
      'data-url',
      'http://localhost:3001/api/study/media/media-1'
    );

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
    expect(
      await screen.findByText('Created 1 generated cards and added them to the study queue.')
    ).toBeInTheDocument();
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
