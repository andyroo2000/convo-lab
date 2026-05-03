/* eslint-disable import/order */
import { DEFAULT_NARRATOR_VOICES, TTS_VOICES } from '@languageflow/shared/src/constants-new';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateOpenAIImageBufferMock, sharpMock, webpMock } = vi.hoisted(() => ({
  generateOpenAIImageBufferMock: vi.fn(),
  sharpMock: vi.fn(),
  webpMock: vi.fn(),
}));

import { mockPrisma } from '../../setup.js';
import { generateStudyCardCandidateJson } from '../../../services/llmClient.js';
import {
  cleanupStudyServiceTestMedia,
  deleteFromGCSPathMock,
  redisSetMock,
  resetStudyServiceMocks,
  synthesizeBatchedTextsMock,
} from './studyTestHelpers.js';
import {
  commitStudyCardCandidates,
  generateStudyCardCandidates,
  regenerateStudyCardCandidatePreviewAudio,
  regenerateStudyCardCandidatePreviewImage,
} from '../../../services/studyCandidateService.js';
import {
  cleanupStudyCandidatePreviewMedia,
  resetStudyCandidatePreviewMediaCleanupSchedule,
  scheduleStudyCandidatePreviewMediaCleanup,
} from '../../../services/study/candidates/mediaCleanup.js';

vi.mock('../../../services/llmClient.js', () => ({
  generateStudyCardCandidateJson: vi.fn(),
}));

vi.mock('../../../services/openAIClient.js', () => ({
  generateOpenAIImageBuffer: generateOpenAIImageBufferMock,
  generateOpenAIResponseText: vi.fn(),
}));

vi.mock('sharp', () => ({
  default: sharpMock,
}));

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
const expectedCandidateVoiceIds = [
  'fishaudio:875668667eb94c20b09856b971d9ca2f',
  'fishaudio:abb4362e736f40b7b5716f4fafcafa9f',
  'fishaudio:351aa1e3ef354082bc1f4294d4eea5d0',
];
const japaneseCandidateVoiceIds = TTS_VOICES.ja.voices
  .filter((voice) => expectedCandidateVoiceIds.includes(voice.id))
  .map((voice) => voice.id);

describe('studyCandidateService', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
    vi.mocked(generateStudyCardCandidateJson).mockReset();
    generateOpenAIImageBufferMock.mockReset();
    generateOpenAIImageBufferMock.mockResolvedValue({
      buffer: Buffer.from('fake-png'),
      contentType: 'image/png',
    });
    sharpMock.mockReset();
    webpMock.mockReset();
    webpMock.mockReturnValue({
      toBuffer: async () => Buffer.from('fake-webp'),
    });
    sharpMock.mockReturnValue({
      webp: webpMock,
    });
    synthesizeBatchedTextsMock.mockClear();
    resetStudyCandidatePreviewMediaCleanupSchedule();
    mockPrisma.studyMedia.findMany.mockResolvedValue([]);
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
    vi.restoreAllMocks();
  });

  it('generates candidates with learner context and audio-recognition preview media', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
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

    expect(generateStudyCardCandidateJson).toHaveBeenCalledWith(
      expect.stringContaining('"learnerContextSummary"'),
      expect.stringContaining('Return strict JSON only')
    );
    expect(generateStudyCardCandidateJson).toHaveBeenCalledWith(
      expect.not.stringContaining('Rules:'),
      expect.stringContaining('Rules:')
    );
    expect(generateStudyCardCandidateJson).toHaveBeenCalledWith(
      expect.not.stringContaining('<target_text>'),
      expect.any(String)
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
    expect(japaneseCandidateVoiceIds).toEqual(expectedCandidateVoiceIds);
    expect(result.candidates[0].answer.answerAudioVoiceId).toBe(japaneseCandidateVoiceIds[0]);
    expect(result.candidates[1].answer.answerAudioVoiceId).toBe(
      japaneseCandidateVoiceIds[japaneseCandidateVoiceIds.length - 1]
    );
    expect(mockPrisma.studyMedia.create).toHaveBeenCalledTimes(2);
  });

  it('removes only uncommitted stale generated-preview media and storage', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    mockPrisma.studyMedia.findMany.mockResolvedValueOnce([
      {
        id: 'stale-media-1',
        storagePath: 'study-media/user-1/candidate-preview/stale.mp3',
      },
    ]);
    await cleanupStudyCandidatePreviewMedia('user-1');

    expect(mockPrisma.studyMedia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          sourceKind: 'generated_preview',
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
          promptAudioCards: { none: {} },
          answerAudioCards: { none: {} },
          imageCards: { none: {} },
        }),
      })
    );
    expect(deleteFromGCSPathMock).toHaveBeenCalledWith(
      'study-media/user-1/candidate-preview/stale.mp3'
    );
    expect(mockPrisma.studyMedia.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['stale-media-1'],
        },
      },
    });
    expect(mockPrisma.studyMedia.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      deleteFromGCSPathMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it('uses Redis as the cross-process generated-preview cleanup throttle', async () => {
    redisSetMock.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    await expect(scheduleStudyCandidatePreviewMediaCleanup('user-1', 1_000)).resolves.toBe(true);
    await expect(scheduleStudyCandidatePreviewMediaCleanup('user-1', 1_001)).resolves.toBe(false);

    expect(redisSetMock).toHaveBeenCalledWith(
      'study:candidate-preview-cleanup:user-1',
      '1000',
      'PX',
      expect.any(Number),
      'NX'
    );
    expect(redisSetMock).toHaveBeenCalledWith(
      'study:candidate-preview-cleanup:user-1',
      '1001',
      'PX',
      expect.any(Number),
      'NX'
    );
  });

  it('uses one of the preferred Fish Audio voices for generated candidates even when the model returns the Google default', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.45);
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        candidates: [
          {
            clientId: 'read-company',
            candidateKind: 'text-recognition',
            cardType: 'recognition',
            prompt: { cueText: '会社' },
            answer: {
              expression: '会社',
              expressionReading: '会社[かいしゃ]',
              meaning: 'company',
              answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
            },
            rationale: 'Reading recognition is useful.',
          },
        ],
      })
    );

    const result = await generateStudyCardCandidates({
      userId: 'user-1',
      request: {
        targetText: '会社',
        includeLearnerContext: false,
      },
    });

    expect(result.candidates[0].answer.answerAudioVoiceId).toMatch(/^fishaudio:/);
    expect(result.candidates[0].answer.answerAudioVoiceId).not.toBe(DEFAULT_NARRATOR_VOICES.ja);
    expect(japaneseCandidateVoiceIds).toContain(result.candidates[0].answer.answerAudioVoiceId);
  });

  it('returns visual production candidates without eagerly generating prompt image media', async () => {
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        candidates: [
          {
            clientId: 'produce-cloudy',
            candidateKind: 'production',
            cardType: 'production',
            prompt: { cueMeaning: '名詞' },
            imagePrompt: 'A simple flashcard image of cloudy weather over a Japanese street.',
            answer: {
              expression: '曇り',
              expressionReading: '曇り[くもり]',
              meaning: 'cloudy weather',
            },
            rationale: 'A visual prompt is useful for a concrete weather noun.',
          },
        ],
      })
    );

    const result = await generateStudyCardCandidates({
      userId: 'user-1',
      request: {
        targetText: '曇り',
        includeLearnerContext: false,
      },
    });

    expect(generateOpenAIImageBufferMock).not.toHaveBeenCalled();
    expect(result.candidates[0]).toMatchObject({
      candidateKind: 'production',
      imagePrompt: 'A simple flashcard image of cloudy weather over a Japanese street.',
      previewImage: null,
      prompt: {
        cueMeaning: '名詞',
      },
    });
  });

  it('rejects malformed LLM output with a safe error', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue('not json');

    await expect(
      generateStudyCardCandidates({
        userId: 'user-1',
        request: { targetText: '会社' },
      })
    ).rejects.toThrow('Could not generate cards from that input');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Study candidates] Failed to parse LLM JSON response.',
      expect.any(SyntaxError)
    );
  });

  it('hydrates missing generated text-recognition prompt text from the answer expression', async () => {
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        candidates: [
          {
            clientId: 'read-company',
            candidateKind: 'text-recognition',
            cardType: 'recognition',
            prompt: {},
            answer: {
              expression: '会社',
              expressionReading: '会社[かいしゃ]',
              meaning: 'company',
              answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
            },
            rationale: 'Reading recognition is useful.',
          },
        ],
      })
    );

    const result = await generateStudyCardCandidates({
      userId: 'user-1',
      request: {
        targetText: '会社',
        includeLearnerContext: false,
      },
    });

    expect(result.candidates[0]).toMatchObject({
      candidateKind: 'text-recognition',
      prompt: {
        cueText: '会社',
        cueReading: '会社[かいしゃ]',
      },
      answer: {
        meaning: 'company',
      },
    });
    expect(result.candidates[0].prompt.cueMeaning).toBeUndefined();
  });

  it('hydrates missing generated production prompt meaning from the answer meaning', async () => {
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        candidates: [
          {
            clientId: 'produce-company',
            candidateKind: 'production',
            cardType: 'production',
            prompt: {},
            answer: {
              expression: '会社',
              expressionReading: '会社[かいしゃ]',
              meaning: 'company',
              answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
            },
            rationale: 'Production recall is useful.',
          },
        ],
      })
    );

    const result = await generateStudyCardCandidates({
      userId: 'user-1',
      request: {
        targetText: '会社',
        includeLearnerContext: false,
      },
    });

    expect(result.candidates[0]).toMatchObject({
      candidateKind: 'production',
      prompt: {
        cueMeaning: 'company',
      },
      answer: {
        expression: '会社',
      },
    });
  });

  it('fills missing generated answer readings before previewing candidates', async () => {
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        candidates: [
          {
            clientId: 'produce-company',
            candidateKind: 'production',
            cardType: 'production',
            prompt: {},
            answer: {
              expression: '会社',
              meaning: 'company',
              answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
            },
            rationale: 'Production recall is useful.',
          },
          {
            clientId: 'read-company',
            candidateKind: 'text-recognition',
            cardType: 'recognition',
            prompt: {
              cueText: '会社',
              cueReading: '会社[かいしゃ]',
            },
            answer: {
              expression: '会社',
              meaning: 'company',
              answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
            },
            rationale: 'Reading recognition is useful.',
          },
        ],
      })
    );

    const result = await generateStudyCardCandidates({
      userId: 'user-1',
      request: {
        targetText: '会社',
        includeLearnerContext: false,
      },
    });

    expect(result.candidates[0].answer.expressionReading).toBe('会社[furigana]');
    expect(result.candidates[1].answer.expressionReading).toBe('会社[かいしゃ]');
  });

  it('cleans quoted cloze text and fills missing restored readings', async () => {
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        candidates: [
          {
            clientId: 'cloze-company',
            candidateKind: 'cloze',
            cardType: 'cloze',
            prompt: {
              clozeText: '"会社{{c1::にも}}行ったよ"',
            },
            answer: {
              restoredText: '会社にも行ったよ',
              meaning: 'I went to the company too.',
              answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
            },
            rationale: '"Practice にも."',
          },
        ],
      })
    );

    const result = await generateStudyCardCandidates({
      userId: 'user-1',
      request: {
        targetText: '会社にも行ったよ',
        includeLearnerContext: false,
      },
    });

    expect(result.candidates[0]).toMatchObject({
      candidateKind: 'cloze',
      prompt: {
        clozeText: '会社{{c1::にも}}行ったよ',
        clozeHint: 'Grammar or particle chunk',
      },
      answer: {
        notes: 'Practice にも.',
        restoredTextReading: '会社にも行ったよ[furigana]',
      },
      rationale: 'Practice にも.',
    });
  });

  it('uses the restored cloze sentence for generated answer audio', async () => {
    await regenerateStudyCardCandidatePreviewAudio({
      userId: 'user-1',
      candidate: {
        clientId: 'cloze-tomorrow',
        candidateKind: 'cloze',
        cardType: 'cloze',
        prompt: {
          clozeText: '明日から{{c1::早く起きる}}ことにします。',
          clozeAnswerText: '早く起きる',
        },
        answer: {
          expression: '早く起きる',
          restoredText: '明日から早く起きることにします。',
          meaning: 'I will start getting up early from tomorrow.',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
        previewAudio: null,
        previewAudioRole: null,
      },
    });

    expect(synthesizeBatchedTextsMock).toHaveBeenLastCalledWith(
      ['明日から早く起きることにします。'],
      expect.any(Object)
    );
  });

  it('regenerates candidate preview audio that can be committed as the selected card audio', async () => {
    const result = await regenerateStudyCardCandidatePreviewAudio({
      userId: 'user-1',
      candidate: {
        clientId: 'produce-company',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: 'company' },
        answer: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
        previewAudio: null,
        previewAudioRole: null,
      },
    });

    expect(result).toMatchObject({
      prompt: { cueMeaning: 'company' },
      answer: {
        answerAudio: {
          id: expect.stringMatching(/^media-/),
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      previewAudio: {
        id: expect.stringMatching(/^media-/),
        mediaKind: 'audio',
        source: 'generated',
      },
      previewAudioRole: 'answer',
    });
  });

  it('regenerates production prompt images from the edited image prompt', async () => {
    const result = await regenerateStudyCardCandidatePreviewImage({
      userId: 'user-1',
      imagePrompt: 'A minimal illustration of cloudy weather.',
      candidate: {
        clientId: 'produce-cloudy',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: '名詞' },
        answer: {
          expression: '曇り',
          meaning: 'cloudy weather',
        },
        previewAudio: null,
        previewAudioRole: null,
      },
    });

    expect(generateOpenAIImageBufferMock).toHaveBeenCalledWith(
      expect.stringContaining('A minimal illustration of cloudy weather.')
    );
    expect(generateOpenAIImageBufferMock).toHaveBeenCalledWith(expect.stringContaining('No text'));
    expect(generateOpenAIImageBufferMock).toHaveBeenCalledWith(
      expect.stringContaining('flashcard layout')
    );
    expect(sharpMock).toHaveBeenCalledWith(Buffer.from('fake-png'));
    expect(webpMock).toHaveBeenCalledWith({ quality: 82 });
    expect(mockPrisma.studyMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contentType: 'image/webp',
          sourceFilename: expect.stringMatching(/^produce-cloudy-[0-9a-f-]+\.webp$/),
        }),
      })
    );
    const firstFilename = mockPrisma.studyMedia.create.mock.calls[0]?.[0].data.sourceFilename;
    await regenerateStudyCardCandidatePreviewImage({
      userId: 'user-1',
      imagePrompt: 'A minimal illustration of cloudy weather.',
      candidate: {
        clientId: 'produce-cloudy',
        candidateKind: 'production',
        cardType: 'production',
        prompt: { cueMeaning: '名詞' },
        answer: {
          expression: '曇り',
          meaning: 'cloudy weather',
        },
        previewAudio: null,
        previewAudioRole: null,
      },
    });
    const secondFilename = mockPrisma.studyMedia.create.mock.calls[1]?.[0].data.sourceFilename;
    expect(secondFilename).toEqual(expect.stringMatching(/^produce-cloudy-[0-9a-f-]+\.webp$/));
    expect(secondFilename).not.toBe(firstFilename);
    expect(result).toMatchObject({
      imagePrompt: 'A minimal illustration of cloudy weather.',
      prompt: {
        cueText: null,
        cueMeaning: '名詞',
        cueImage: {
          id: expect.stringMatching(/^media-/),
          mediaKind: 'image',
          source: 'generated',
        },
      },
      previewImage: {
        id: expect.stringMatching(/^media-/),
        mediaKind: 'image',
        source: 'generated',
      },
    });
  });

  it('deletes persisted preview audio when creating the media row fails', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    mockPrisma.studyMedia.create.mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(
      regenerateStudyCardCandidatePreviewAudio({
        userId: 'user-1',
        candidate: {
          clientId: 'produce-company',
          candidateKind: 'production',
          cardType: 'production',
          prompt: { cueMeaning: 'company' },
          answer: {
            expression: '会社',
            meaning: 'company',
            answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
          },
          previewAudio: null,
          previewAudioRole: null,
        },
      })
    ).rejects.toThrow('DB unavailable');

    expect(deleteFromGCSPathMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^study-media\/user-1\/candidate-preview\/produce-company-[0-9a-f-]+\.mp3$/
      )
    );
  });

  it('deletes persisted preview image storage when creating the media row fails', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    mockPrisma.studyMedia.create.mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(
      regenerateStudyCardCandidatePreviewImage({
        userId: 'user-1',
        imagePrompt: 'A minimal illustration of cloudy weather.',
        candidate: {
          clientId: 'produce-cloudy',
          candidateKind: 'production',
          cardType: 'production',
          prompt: { cueMeaning: '名詞' },
          answer: {
            expression: '曇り',
            meaning: 'cloudy weather',
          },
          previewAudio: null,
          previewAudioRole: null,
        },
      })
    ).rejects.toThrow('DB unavailable');

    expect(deleteFromGCSPathMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^study-media\/user-1\/candidate-preview\/produce-cloudy-[0-9a-f-]+\.webp$/
      )
    );
  });

  it('regenerates audio-recognition preview audio as prompt audio only', async () => {
    const result = await regenerateStudyCardCandidatePreviewAudio({
      userId: 'user-1',
      candidate: {
        clientId: 'listen-company',
        candidateKind: 'audio-recognition',
        cardType: 'recognition',
        prompt: {},
        answer: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        },
        previewAudio: null,
        previewAudioRole: null,
      },
    });

    expect(result).toMatchObject({
      prompt: {
        cueAudio: {
          id: expect.stringMatching(/^media-/),
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      answer: {
        expression: '会社',
        meaning: 'company',
      },
      previewAudio: {
        id: expect.stringMatching(/^media-/),
        mediaKind: 'audio',
        source: 'generated',
      },
      previewAudioRole: 'prompt',
    });
    expect(result.answer.answerAudio).toBeUndefined();
  });

  it('commits selected audio-recognition candidates with owned preview media', async () => {
    mockPrisma.studyMedia.findMany.mockResolvedValue([{ id: 'media-1' }]);
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
    expect(mockPrisma.studyMedia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['media-1'] },
          userId: 'user-1',
          sourceKind: 'generated_preview',
          mediaKind: 'audio',
        }),
      })
    );
    expect(result.cards[0].prompt.cueAudio?.url).toBe('/api/study/media/media-1');
  });

  it('regenerates missing audio-recognition preview audio without mutating the commit input', async () => {
    mockPrisma.studyMedia.findMany.mockResolvedValue([{ id: 'media-1' }]);
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
      promptJson: {},
      answerJson: { expression: '会社', meaning: 'company' },
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
    const input = {
      userId: 'user-1',
      candidates: [
        {
          clientId: 'listen-company',
          candidateKind: 'audio-recognition' as const,
          cardType: 'recognition' as const,
          prompt: {},
          answer: {
            expression: '会社',
            meaning: 'company',
          },
          previewAudio: null,
          previewAudioRole: null,
        },
      ],
    };
    const originalInput = structuredClone(input);

    await commitStudyCardCandidates(input);

    expect(input).toEqual(originalInput);
    expect(mockPrisma.studyCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptAudioMediaId: 'media-1',
          answerAudioMediaId: 'media-1',
        }),
      })
    );
  });

  it('rejects preview media owned by another user', async () => {
    mockPrisma.studyMedia.findMany.mockResolvedValue([]);

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

  it('rejects preview image media owned by another user', async () => {
    mockPrisma.studyMedia.findMany
      .mockResolvedValueOnce([{ id: 'audio-1' }])
      .mockResolvedValueOnce([]);

    await expect(
      commitStudyCardCandidates({
        userId: 'user-1',
        candidates: [
          {
            clientId: 'bad-image',
            candidateKind: 'production',
            cardType: 'production',
            prompt: {
              cueMeaning: '名詞',
              cueImage: {
                id: 'image-other',
                filename: 'other.png',
                url: '/api/study/media/image-other',
                mediaKind: 'image',
                source: 'generated',
              },
            },
            answer: { expression: '曇り', meaning: 'cloudy weather' },
            previewImage: {
              id: 'image-other',
              filename: 'other.png',
              url: '/api/study/media/image-other',
              mediaKind: 'image',
              source: 'generated',
            },
            previewAudio: {
              id: 'audio-1',
              filename: 'audio.mp3',
              url: '/api/study/media/audio-1',
              mediaKind: 'audio',
              source: 'generated',
            },
            previewAudioRole: 'answer',
            imagePrompt: 'Cloudy weather.',
          },
        ],
      })
    ).rejects.toThrow('Preview image was not found for this user');
  });

  it('attaches owned preview image media when committing visual production candidates', async () => {
    mockPrisma.studyMedia.findMany
      .mockResolvedValueOnce([{ id: 'audio-1' }])
      .mockResolvedValueOnce([{ id: 'image-1' }]);
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
      cardType: 'production',
      queueState: 'new',
      dueAt: null,
      introducedAt: null,
      answerAudioSource: 'generated',
      promptJson: { cueMeaning: '名詞' },
      answerJson: { expression: '曇り', meaning: 'cloudy weather' },
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
      cardType: 'production',
      queueState: 'new',
      dueAt: null,
      introducedAt: null,
      answerAudioSource: 'generated',
      promptJson: { cueMeaning: '名詞' },
      answerJson: { expression: '曇り', meaning: 'cloudy weather' },
      schedulerStateJson: schedulerState,
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: { rawFieldsJson: {} },
      promptAudioMedia: null,
      answerAudioMedia: {
        id: 'audio-1',
        sourceFilename: 'cloudy.mp3',
        mediaKind: 'audio',
      },
      imageMedia: {
        id: 'image-1',
        sourceFilename: 'cloudy.png',
        mediaKind: 'image',
      },
    });

    await commitStudyCardCandidates({
      userId: 'user-1',
      candidates: [
        {
          clientId: 'cloudy',
          candidateKind: 'production',
          cardType: 'production',
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
          answer: { expression: '曇り', meaning: 'cloudy weather' },
          previewAudio: {
            id: 'audio-1',
            filename: 'cloudy.mp3',
            url: '/api/study/media/audio-1',
            mediaKind: 'audio',
            source: 'generated',
          },
          previewAudioRole: 'answer',
          previewImage: {
            id: 'image-1',
            filename: 'cloudy.png',
            url: '/api/study/media/image-1',
            mediaKind: 'image',
            source: 'generated',
          },
          imagePrompt: 'Cloudy weather.',
        },
      ],
    });

    expect(mockPrisma.studyCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answerAudioMediaId: 'audio-1',
          imageMediaId: 'image-1',
        }),
      })
    );
  });

  it('resolves all selected preview media before creating committed cards', async () => {
    mockPrisma.studyMedia.findMany.mockResolvedValue([{ id: 'media-good' }]);

    await expect(
      commitStudyCardCandidates({
        userId: 'user-1',
        candidates: [
          {
            clientId: 'good-card',
            candidateKind: 'text-recognition',
            cardType: 'recognition',
            prompt: { cueText: '会社' },
            answer: { expression: '会社', meaning: 'company' },
            previewAudio: {
              id: 'media-good',
              filename: 'good.mp3',
              url: '/api/study/media/media-good',
              mediaKind: 'audio',
              source: 'generated',
            },
            previewAudioRole: 'answer',
          },
          {
            clientId: 'bad-card',
            candidateKind: 'production',
            cardType: 'production',
            prompt: { cueMeaning: 'company' },
            answer: { expression: '会社', meaning: 'company' },
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

    expect(mockPrisma.studyCard.create).not.toHaveBeenCalled();
    expect(mockPrisma.studyMedia.findMany).toHaveBeenCalledTimes(1);
  });
});
