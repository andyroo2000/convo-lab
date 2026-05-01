/* eslint-disable import/order */
import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockPrisma } from '../../setup.js';
import { generateWithGemini } from '../../../services/geminiClient.js';
import { cleanupStudyServiceTestMedia, resetStudyServiceMocks } from './studyTestHelpers.js';
import {
  commitStudyCardCandidates,
  generateStudyCardCandidates,
} from '../../../services/studyCandidateService.js';

const schedulerState = {
  due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
  stability: 0.1,
  difficulty: 5,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
  last_review: null,
};

describe('studyCandidateService', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
    vi.mocked(generateWithGemini).mockReset();
    mockPrisma.studyCard.findMany.mockResolvedValue([
      {
        cardType: 'recognition',
        queueState: 'relearning',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        sourceLapses: 2,
      },
    ]);
    mockPrisma.studyMedia.create.mockImplementation(async ({ data }) => ({
      id: `media-${String(mockPrisma.studyMedia.create.mock.calls.length)}`,
      userId: data.userId,
      importJobId: null,
      sourceKind: data.sourceKind,
      sourceFilename: data.sourceFilename,
      normalizedFilename: data.normalizedFilename,
      mediaKind: data.mediaKind,
      contentType: data.contentType,
      storagePath: data.storagePath,
      publicUrl: data.publicUrl,
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
    }));
  });

  afterEach(async () => {
    await cleanupStudyServiceTestMedia();
  });

  it('generates candidates with learner context and audio-recognition preview media', async () => {
    vi.mocked(generateWithGemini).mockResolvedValue(
      JSON.stringify({
        candidates: [
          {
            clientId: 'listen-company',
            candidateKind: 'audio-recognition',
            cardType: 'recognition',
            prompt: {},
            answer: {
              expression: '会社',
              expressionReading: '会社[かいしゃ]',
              meaning: 'company',
              answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
            },
            rationale: 'Listening practice is useful.',
          },
          {
            clientId: 'produce-company',
            candidateKind: 'production',
            cardType: 'production',
            prompt: { cueMeaning: 'company' },
            answer: {
              expression: '会社',
              expressionReading: '会社[かいしゃ]',
              meaning: 'company',
              answerAudioTextOverride: 'かいしゃ',
            },
            rationale: 'Production checks recall.',
          },
        ],
      })
    );

    const result = await generateStudyCardCandidates({
      userId: 'user-1',
      request: {
        targetText: '会社',
        context: 'Business vocabulary',
        includeLearnerContext: true,
      },
    });

    expect(generateWithGemini).toHaveBeenCalledWith(
      expect.stringContaining('Recent learner context:'),
      expect.stringContaining('valid JSON')
    );
    expect(result.learnerContextSummary).toContain('会社 - company');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      candidateKind: 'audio-recognition',
      cardType: 'recognition',
      prompt: {
        cueAudio: {
          id: expect.stringMatching(/^media-/),
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      previewAudioRole: 'prompt',
    });
    expect(result.candidates[1]).toMatchObject({
      candidateKind: 'production',
      previewAudioRole: 'answer',
    });
    expect(mockPrisma.studyMedia.create).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed LLM output with a safe error', async () => {
    vi.mocked(generateWithGemini).mockResolvedValue('not json');

    await expect(
      generateStudyCardCandidates({
        userId: 'user-1',
        request: { targetText: '会社' },
      })
    ).rejects.toThrow('Could not generate cards from that input');
  });

  it('commits selected audio-recognition candidates with owned preview media', async () => {
    mockPrisma.studyMedia.findFirst.mockResolvedValue({ id: 'media-1' });
    mockPrisma.studyNote.create.mockResolvedValue({
      id: 'note-1',
      userId: 'user-1',
      sourceKind: 'convolab',
      rawFieldsJson: {},
      canonicalJson: {},
      searchText: '',
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    mockPrisma.studyCard.create.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      noteId: 'note-1',
      cardType: 'recognition',
      queueState: 'new',
      dueAt: null,
      introducedAt: null,
      answerAudioSource: 'generated',
      promptJson: {
        cueAudio: {
          id: 'media-1',
          filename: 'listen-company.mp3',
          url: '/api/study/media/media-1',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudio: {
          id: 'media-1',
          filename: 'listen-company.mp3',
          url: '/api/study/media/media-1',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      schedulerStateJson: schedulerState,
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: { rawFieldsJson: {} },
      promptAudioMedia: null,
      answerAudioMedia: null,
      imageMedia: null,
    });
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      noteId: 'note-1',
      cardType: 'recognition',
      queueState: 'new',
      dueAt: null,
      introducedAt: null,
      answerAudioSource: 'generated',
      promptJson: {},
      answerJson: { expression: '会社', meaning: 'company' },
      schedulerStateJson: schedulerState,
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: { rawFieldsJson: {} },
      promptAudioMedia: {
        id: 'media-1',
        sourceFilename: 'listen-company.mp3',
        mediaKind: 'audio',
      },
      answerAudioMedia: {
        id: 'media-1',
        sourceFilename: 'listen-company.mp3',
        mediaKind: 'audio',
      },
      imageMedia: null,
    });

    const result = await commitStudyCardCandidates({
      userId: 'user-1',
      candidates: [
        {
          clientId: 'listen-company',
          candidateKind: 'audio-recognition',
          cardType: 'recognition',
          prompt: {
            cueAudio: {
              id: 'media-1',
              filename: 'listen-company.mp3',
              url: '/api/study/media/media-1',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
          answer: {
            expression: '会社',
            meaning: 'company',
            answerAudio: {
              id: 'media-1',
              filename: 'listen-company.mp3',
              url: '/api/study/media/media-1',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
          previewAudio: {
            id: 'media-1',
            filename: 'listen-company.mp3',
            url: '/api/study/media/media-1',
            mediaKind: 'audio',
            source: 'generated',
          },
          previewAudioRole: 'prompt',
        },
      ],
    });

    expect(mockPrisma.studyCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptAudioMediaId: 'media-1',
          answerAudioMediaId: 'media-1',
          answerAudioSource: 'generated',
        }),
      })
    );
    expect(result.cards[0].prompt.cueAudio?.url).toBe('/api/study/media/media-1');
  });

  it('rejects preview media owned by another user', async () => {
    mockPrisma.studyMedia.findFirst.mockResolvedValue(null);

    await expect(
      commitStudyCardCandidates({
        userId: 'user-1',
        candidates: [
          {
            clientId: 'bad-media',
            candidateKind: 'production',
            cardType: 'production',
            prompt: { cueMeaning: 'company' },
            answer: { expression: '会社' },
            previewAudio: {
              id: 'media-other',
              filename: 'other.mp3',
              url: '/api/study/media/media-other',
              mediaKind: 'audio',
              source: 'generated',
            },
            previewAudioRole: 'answer',
          },
        ],
      })
    ).rejects.toThrow('Preview audio was not found for this user');
  });
});
