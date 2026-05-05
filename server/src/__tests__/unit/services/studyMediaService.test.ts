/* eslint-disable import/order */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupStudyServiceTestMedia,
  downloadFromGCSPathMock,
  getSignedReadUrlMock,
  redisGetMock,
  redisSetMock,
  resetStudyServiceMocks,
  uploadBufferToGCSPathMock,
} from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import {
  getStudyMediaAccess,
  prepareStudyCardAnswerAudio,
  regenerateStudyCardAnswerAudio,
} from '../../../services/studyMediaService.js';
import {
  findAccessibleLocalStudyMediaPath,
  persistStudyMediaBuffer,
  STUDY_AUDIO_REPAIR_FAILURE_COOLDOWN_MS,
  toStudyCardSummary,
} from '../../../services/study/shared.js';
import { synthesizeBatchedTexts } from '../../../services/batchedTTSClient.js';

async function withStudyMediaEnv<T>(
  updates: Partial<Record<'ANKI_MEDIA_DIR' | 'GCS_BUCKET_NAME' | 'NODE_ENV', string>>,
  task: () => Promise<T>
): Promise<T> {
  const previousValues = new Map<keyof typeof updates, string | undefined>();

  for (const [key, value] of Object.entries(updates) as Array<
    [keyof typeof updates, string | undefined]
  >) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await task();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe('studyMediaService', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
  });

  afterEach(async () => {
    await cleanupStudyServiceTestMedia();
  });

  it('prepares answer audio for a single requested study card', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'missing',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'generated',
        promptJson: { cueText: '会社' },
        answerJson: {
          expression: '会社',
          meaning: 'company',
          answerAudio: {
            id: 'media-generated',
            filename: 'card-1.mp3',
            url: '/api/study/media/media-generated',
            mediaKind: 'audio',
            source: 'generated',
          },
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      answerAudioSource: 'missing',
      answerJson: { expression: '会社', meaning: 'company' },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    const card = await prepareStudyCardAnswerAudio('user-1', 'card-1');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(vi.mocked(synthesizeBatchedTexts)).toHaveBeenCalledTimes(1);
    expect(card.answerAudioSource).toBe('missing');
  });

  it('deduplicates concurrent answer-audio generation for the same card', async () => {
    redisSetMock.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    let resolveAudio!: (buffers: Buffer[]) => void;
    vi.mocked(synthesizeBatchedTexts).mockReturnValueOnce(
      new Promise<Buffer[]>((resolve) => {
        resolveAudio = resolve;
      })
    );
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-concurrent',
      userId: 'user-1',
      answerAudioSource: 'missing',
      answerJson: { expression: '会社', meaning: 'company' },
    });
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-concurrent',
      userId: 'user-1',
      noteId: 'note-1',
      cardType: 'recognition',
      queueState: 'review',
      answerAudioSource: 'generated',
      promptJson: { cueText: '会社' },
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudio: {
          id: 'media-generated',
          filename: 'card-concurrent.mp3',
          url: '/api/study/media/media-generated',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      schedulerStateJson: {
        due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        stability: 10,
        difficulty: 4,
        elapsed_days: 4,
        scheduled_days: 10,
        learning_steps: 0,
        reps: 6,
        lapses: 1,
        state: 2,
        last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
      },
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: {},
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    const firstRequest = prepareStudyCardAnswerAudio('user-1', 'card-concurrent');
    const secondRequest = prepareStudyCardAnswerAudio('user-1', 'card-concurrent');

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(vi.mocked(synthesizeBatchedTexts)).toHaveBeenCalledTimes(1);

    resolveAudio([Buffer.from('fake-audio')]);

    const [firstCard, secondCard] = await Promise.all([firstRequest, secondRequest]);

    expect(firstCard.answerAudioSource).toBe('generated');
    expect(secondCard.answerAudioSource).toBe('generated');
  });

  it('regenerates answer audio with override text and selected voice', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-voice',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'generated',
        promptJson: { cueText: '会社' },
        answerJson: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: 'ja-JP-Wavenet-C',
          answerAudioTextOverride: null,
          answerAudio: {
            id: 'media-old',
            filename: 'old.mp3',
            url: '/api/study/media/media-old',
            mediaKind: 'audio',
            source: 'generated',
          },
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-voice',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'generated',
        promptJson: { cueText: '会社' },
        answerJson: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
          answerAudioTextOverride: 'かいしゃ',
          answerAudio: {
            id: 'media-generated',
            filename: 'card-voice.mp3',
            url: '/api/study/media/media-generated',
            mediaKind: 'audio',
            source: 'generated',
          },
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-voice',
      userId: 'user-1',
      answerAudioSource: 'generated',
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudioVoiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
        answerAudioTextOverride: 'かいしゃ',
        answerAudio: {
          id: 'media-old',
          filename: 'card-voice-old.mp3',
          url: '/api/study/media/media-old',
        },
      },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    const card = await regenerateStudyCardAnswerAudio({
      userId: 'user-1',
      cardId: 'card-voice',
      answerAudioVoiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
      answerAudioTextOverride: 'かいしゃ',
    });

    const updateArgs = mockPrisma.studyCard.updateMany.mock.calls[0]?.[0];
    expect(updateArgs).toEqual(
      expect.objectContaining({
        where: { id: 'card-voice', userId: 'user-1' },
      })
    );
    expect(updateArgs.data).not.toHaveProperty('answerAudioSource');
    expect(updateArgs.data).not.toHaveProperty('answerAudioMediaId');
    expect(vi.mocked(synthesizeBatchedTexts)).toHaveBeenCalledWith(['かいしゃ'], {
      voiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
      languageCode: 'ja-JP',
      speed: 1,
    });
    expect(card.answer.answerAudioVoiceId).toBe('fishaudio:694e06f2dcc44e4297961d68d6a98313');
    expect(card.answer.answerAudioTextOverride).toBe('かいしゃ');
    expect(card.answerAudioSource).toBe('generated');
  });

  it('keeps audio-recognition prompt audio synced when regenerating answer audio', async () => {
    const oldPromptAudio = {
      id: 'media-shohei',
      filename: 'shohei.mp3',
      url: '/api/study/media/media-shohei',
      mediaKind: 'audio',
      source: 'generated',
    };
    const oldAnswerAudio = {
      id: 'media-ren-old',
      filename: 'ren-old.mp3',
      url: '/api/study/media/media-ren-old',
      mediaKind: 'audio',
      source: 'generated',
    };
    const newAudio = {
      id: 'media-ren-new',
      filename: 'card-audio-recognition.mp3',
      url: '/api/study/media/media-ren-new',
      mediaKind: 'audio',
      source: 'generated',
    };

    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-audio-recognition',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'generated',
        promptAudioMediaId: 'media-shohei',
        answerAudioMediaId: 'media-ren-old',
        promptJson: { cueAudio: oldPromptAudio },
        answerJson: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
          answerAudio: oldAnswerAudio,
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-audio-recognition',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'generated',
        promptAudioMediaId: 'media-ren-new',
        answerAudioMediaId: 'media-ren-new',
        promptJson: { cueAudio: newAudio },
        answerJson: {
          expression: '会社',
          meaning: 'company',
          answerAudioVoiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
          answerAudio: newAudio,
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-audio-recognition',
      userId: 'user-1',
      cardType: 'recognition',
      answerAudioSource: 'generated',
      promptJson: { cueAudio: oldPromptAudio },
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudioVoiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
        answerAudio: oldAnswerAudio,
      },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-ren-new' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    const card = await regenerateStudyCardAnswerAudio({
      userId: 'user-1',
      cardId: 'card-audio-recognition',
      answerAudioVoiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
    });

    expect(mockPrisma.studyCard.update).toHaveBeenCalledWith({
      where: { id: 'card-audio-recognition' },
      data: expect.objectContaining({
        promptJson: expect.objectContaining({
          cueAudio: newAudio,
        }),
        promptAudioMediaId: 'media-ren-new',
        answerJson: expect.objectContaining({
          answerAudio: newAudio,
        }),
        answerAudioMediaId: 'media-ren-new',
      }),
    });
    expect(card.prompt.cueAudio?.id).toBe('media-ren-new');
    expect(card.answer.answerAudio?.id).toBe('media-ren-new');
  });

  it('renders existing mismatched audio-recognition cards with answer audio on the front', async () => {
    const oldPromptAudio = {
      id: 'media-shohei',
      filename: 'shohei.mp3',
      url: '/api/study/media/media-shohei',
      mediaKind: 'audio',
      source: 'generated',
    };
    const regeneratedAnswerAudio = {
      id: 'media-ren',
      filename: 'ren.mp3',
      url: '/api/study/media/media-ren',
      mediaKind: 'audio',
      source: 'generated',
    };

    const cardRecord = {
      id: 'card-existing-mismatch',
      userId: 'user-1',
      noteId: 'note-1',
      cardType: 'recognition',
      queueState: 'review',
      answerAudioSource: 'generated',
      promptJson: { cueAudio: oldPromptAudio },
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudio: regeneratedAnswerAudio,
      },
      schedulerStateJson: {
        due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        stability: 10,
        difficulty: 4,
        elapsed_days: 4,
        scheduled_days: 10,
        learning_steps: 0,
        reps: 6,
        lapses: 1,
        state: 2,
        last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
      },
      dueAt: new Date('2026-04-12T00:00:00.000Z'),
      introducedAt: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      promptAudioMedia: null,
      answerAudioMedia: null,
      imageMedia: null,
      note: {
        id: 'note-1',
        userId: 'user-1',
        rawFieldsJson: {},
        canonicalFieldsJson: {},
        sourceNoteId: null,
        sourceGuid: null,
        sourceNotetypeId: null,
        sourceNotetypeName: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      },
    } as unknown as Parameters<typeof toStudyCardSummary>[0];
    const card = await toStudyCardSummary(cardRecord);

    expect(card.prompt.cueAudio?.id).toBe('media-ren');
    expect(card.answer.answerAudio?.id).toBe('media-ren');
  });

  it('preserves existing answer audio when regeneration synthesis fails', async () => {
    const previousAnswerAudio = {
      id: 'media-old',
      filename: 'card-voice-old.mp3',
      url: '/api/study/media/media-old',
      mediaKind: 'audio',
      source: 'generated',
    };
    mockPrisma.studyCard.findFirst.mockResolvedValueOnce({
      id: 'card-voice',
      userId: 'user-1',
      noteId: 'note-1',
      cardType: 'recognition',
      queueState: 'review',
      answerAudioSource: 'generated',
      answerAudioMediaId: 'media-old',
      promptJson: { cueText: '会社' },
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudioVoiceId: 'ja-JP-Neural2-C',
        answerAudioTextOverride: null,
        answerAudio: previousAnswerAudio,
      },
      schedulerStateJson: {
        due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        stability: 10,
        difficulty: 4,
        elapsed_days: 4,
        scheduled_days: 10,
        learning_steps: 0,
        reps: 6,
        lapses: 1,
        state: 2,
        last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
      },
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: {},
    });
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-voice',
      userId: 'user-1',
      answerAudioSource: 'generated',
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudioVoiceId: 'ja-JP-Neural2-D',
        answerAudioTextOverride: 'かいしゃ',
        answerAudio: previousAnswerAudio,
      },
    });
    vi.mocked(synthesizeBatchedTexts)
      .mockRejectedValueOnce(new Error('tts down'))
      .mockRejectedValueOnce(new Error('tts down'));

    await expect(
      regenerateStudyCardAnswerAudio({
        userId: 'user-1',
        cardId: 'card-voice',
        answerAudioVoiceId: 'ja-JP-Neural2-D',
        answerAudioTextOverride: 'かいしゃ',
      })
    ).rejects.toThrow('tts down');

    const updateArgs = mockPrisma.studyCard.updateMany.mock.calls[0]?.[0];
    expect(updateArgs.data).not.toHaveProperty('answerAudioSource');
    expect(updateArgs.data).not.toHaveProperty('answerAudioMediaId');
    expect(updateArgs.data.answerJson).toEqual(
      expect.objectContaining({
        answerAudio: previousAnswerAudio,
        answerAudioVoiceId: 'ja-JP-Neural2-D',
        answerAudioTextOverride: 'かいしゃ',
      })
    );
    expect(mockPrisma.studyCard.update).not.toHaveBeenCalled();
  });

  it('enforces ownership before regenerating answer audio', async () => {
    mockPrisma.studyCard.findFirst.mockResolvedValue(null);

    await expect(
      regenerateStudyCardAnswerAudio({
        userId: 'user-1',
        cardId: 'missing-card',
        answerAudioVoiceId: 'fishaudio:694e06f2dcc44e4297961d68d6a98313',
        answerAudioTextOverride: 'かいしゃ',
      })
    ).rejects.toThrow('Study card not found.');

    expect(mockPrisma.studyCard.updateMany).not.toHaveBeenCalled();
    expect(vi.mocked(synthesizeBatchedTexts)).not.toHaveBeenCalled();
  });

  it('returns a signed redirect for GCS-backed study media', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-1',
      userId: 'user-1',
      sourceFilename: 'remote-only-company.mp3',
      contentType: 'audio/mpeg',
      storagePath: 'study-media/user-1/import/remote-only-company.mp3',
    });

    const result = await getStudyMediaAccess('user-1', 'media-1');

    expect(getSignedReadUrlMock).toHaveBeenCalled();
    expect(result?.type).toBe('redirect');
    expect(result?.contentDisposition).toBe('inline');
  });

  it('keeps a local media mirror for GCS-backed study media in development', async () => {
    const filename = `card-local-${Date.now()}.mp3`;
    await withStudyMediaEnv(
      { NODE_ENV: 'development', GCS_BUCKET_NAME: 'test-bucket' },
      async () => {
        const persisted = await persistStudyMediaBuffer({
          userId: 'user-1',
          importJobId: 'generated',
          filename,
          buffer: Buffer.from('fake-audio'),
        });

        expect(uploadBufferToGCSPathMock).toHaveBeenCalledWith(
          expect.objectContaining({
            destinationPath: `study-media/user-1/generated/${filename}`,
          })
        );
        expect(persisted.storagePath).toBe(`study-media/user-1/generated/${filename}`);

        const localPath = await findAccessibleLocalStudyMediaPath(persisted.storagePath);
        expect(localPath).toEqual(expect.stringContaining(filename));
        await expect(fs.readFile(localPath as string, 'utf8')).resolves.toBe('fake-audio');
      }
    );
  });

  it('backfills imported Anki media lazily when requested', async () => {
    const ankiMediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-media-access-'));
    const previousAnkiMediaDir = process.env.ANKI_MEDIA_DIR;
    const previousGcsBucketName = process.env.GCS_BUCKET_NAME;
    process.env.ANKI_MEDIA_DIR = ankiMediaDir;
    process.env.GCS_BUCKET_NAME = 'test-bucket';

    try {
      await fs.writeFile(path.join(ankiMediaDir, 'company.mp3'), 'fake-audio');
      mockPrisma.studyMedia.findFirst.mockResolvedValue({
        id: 'media-lazy',
        userId: 'user-1',
        importJobId: 'import-1',
        sourceKind: 'anki_import',
        sourceFilename: 'company.mp3',
        normalizedFilename: 'company.mp3',
        mediaKind: 'audio',
        contentType: 'audio/mpeg',
        storagePath: null,
        publicUrl: null,
      });
      mockPrisma.studyMedia.update.mockResolvedValue({
        id: 'media-lazy',
        userId: 'user-1',
        importJobId: 'import-1',
        sourceKind: 'anki_import',
        sourceFilename: 'company.mp3',
        normalizedFilename: 'company.mp3',
        mediaKind: 'audio',
        storagePath: 'study-media/user-1/import-1/company.mp3',
        publicUrl: null,
      });

      const result = await getStudyMediaAccess('user-1', 'media-lazy');

      expect(mockPrisma.studyMedia.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'media-lazy' },
          data: expect.objectContaining({
            storagePath: expect.stringContaining('company.mp3'),
          }),
        })
      );
      expect(getSignedReadUrlMock).toHaveBeenCalled();
      expect(result?.type).toBe('redirect');
    } finally {
      if (previousAnkiMediaDir === undefined) {
        delete process.env.ANKI_MEDIA_DIR;
      } else {
        process.env.ANKI_MEDIA_DIR = previousAnkiMediaDir;
      }
      if (previousGcsBucketName === undefined) {
        delete process.env.GCS_BUCKET_NAME;
      } else {
        process.env.GCS_BUCKET_NAME = previousGcsBucketName;
      }
      await fs.rm(ankiMediaDir, { recursive: true, force: true });
    }
  });

  it('forces attachment disposition for unsafe inline media like SVG', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-svg',
      userId: 'user-1',
      sourceFilename: 'diagram.svg',
      contentType: 'image/svg+xml',
      mediaKind: 'other',
      storagePath: 'study-media/user-1/import/diagram.svg',
    });

    const result = await getStudyMediaAccess('user-1', 'media-svg');

    expect(getSignedReadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        responseDisposition: 'attachment; filename="diagram.svg"',
        responseType: 'image/svg+xml',
      })
    );
    expect(result?.contentDisposition).toBe('attachment');
  });

  it('returns null when GCS signing is unavailable for private study media', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    getSignedReadUrlMock.mockRejectedValueOnce(new Error('missing signer'));
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-gcs-failure',
      userId: 'user-1',
      sourceFilename: 'missing-gcs-only-company.mp3',
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath: 'study-media/user-1/import/missing-gcs-only-company.mp3',
    });

    const result = await getStudyMediaAccess('user-1', 'media-gcs-failure');

    expect(result).toBeNull();
  });

  it('caches and serves GCS study media locally in development when signing is unavailable', async () => {
    const filename = `dev-gcs-fallback-${Date.now()}.mp3`;
    const storagePath = `study-media/user-1/import/${filename}`;
    getSignedReadUrlMock.mockRejectedValueOnce(new Error('missing signer'));
    downloadFromGCSPathMock.mockImplementationOnce(async ({ destinationPath }) => {
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.writeFile(destinationPath, 'cached-audio');
      return destinationPath;
    });
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-dev-gcs-fallback',
      userId: 'user-1',
      sourceFilename: filename,
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath,
    });

    await withStudyMediaEnv(
      { NODE_ENV: 'development', GCS_BUCKET_NAME: 'test-bucket' },
      async () => {
        const result = await getStudyMediaAccess('user-1', 'media-dev-gcs-fallback');

        expect(downloadFromGCSPathMock).toHaveBeenCalledWith(
          expect.objectContaining({
            filePath: storagePath,
            destinationPath: expect.stringContaining(filename),
          })
        );
        expect(result).toEqual(
          expect.objectContaining({
            type: 'local',
            absolutePath: expect.stringContaining(filename),
            contentType: 'audio/mpeg',
          })
        );
        await expect(fs.readFile(result?.absolutePath as string, 'utf8')).resolves.toBe(
          'cached-audio'
        );
      }
    );
  });

  it('schedules stale generated answer audio repair when the backing media is missing', async () => {
    const cardId = `card-stale-${Date.now()}`;
    const filename = `${cardId}.mp3`;
    const storagePath = `study-media/user-1/generated/${filename}`;
    getSignedReadUrlMock.mockRejectedValueOnce(new Error('missing signer'));
    downloadFromGCSPathMock.mockRejectedValueOnce(new Error('missing object'));
    mockPrisma.studyMedia.findFirst.mockResolvedValueOnce({
      id: 'old-generated-media',
      userId: 'user-1',
      sourceKind: 'generated',
      sourceFilename: filename,
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath,
    });
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: cardId,
        answerAudioMediaId: 'old-generated-media',
      })
      .mockResolvedValueOnce({
        answerAudioMediaId: 'new-generated-media',
      });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: cardId,
      userId: 'user-1',
      answerAudioSource: 'generated',
      answerJson: {
        restoredText: '月曜日か金曜日か土曜日に会いましょう。',
        answerAudio: {
          id: 'old-generated-media',
          url: '/api/study/media/old-generated-media',
        },
      },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'new-generated-media' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    await withStudyMediaEnv(
      { NODE_ENV: 'development', GCS_BUCKET_NAME: 'test-bucket' },
      async () => {
        const result = await getStudyMediaAccess('user-1', 'old-generated-media');

        expect(result).toBeNull();
        await vi.waitFor(() => {
          expect(vi.mocked(synthesizeBatchedTexts)).toHaveBeenCalledWith(
            ['月曜日か金曜日か土曜日に会いましょう。'],
            expect.objectContaining({ languageCode: 'ja-JP' })
          );
          expect(mockPrisma.studyCard.update).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { id: cardId },
              data: expect.objectContaining({
                answerAudioSource: 'generated',
                answerAudioMediaId: 'new-generated-media',
              }),
            })
          );
        });
      }
    );
  });

  it('skips generated-audio repair while a recent repair failure is cooling down', async () => {
    redisGetMock.mockResolvedValueOnce('1');
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'cooling-generated-media',
      userId: 'user-1',
      sourceKind: 'generated',
      sourceFilename: 'cooling-generated-media.mp3',
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath: null,
    });

    const result = await getStudyMediaAccess('user-1', 'cooling-generated-media');

    expect(result).toBeNull();
    expect(mockPrisma.studyCard.findFirst).not.toHaveBeenCalled();
    expect(vi.mocked(synthesizeBatchedTexts)).not.toHaveBeenCalled();
  });

  it('records a short cooldown when generated-audio repair synthesis fails', async () => {
    redisGetMock.mockResolvedValue(null);
    vi.mocked(synthesizeBatchedTexts).mockRejectedValue(new Error('tts down'));
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'failed-generated-media',
      userId: 'user-1',
      sourceKind: 'generated',
      sourceFilename: 'failed-generated-media.mp3',
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath: null,
    });
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-failed-repair',
      answerAudioMediaId: 'failed-generated-media',
    });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-failed-repair',
      userId: 'user-1',
      answerAudioSource: 'generated',
      answerJson: {
        restoredText: '月曜日か金曜日か土曜日に会いましょう。',
        answerAudio: {
          id: 'failed-generated-media',
          url: '/api/study/media/failed-generated-media',
        },
      },
    });

    const result = await getStudyMediaAccess('user-1', 'failed-generated-media');

    expect(result).toBeNull();
    await vi.waitFor(() => {
      expect(redisSetMock).toHaveBeenCalledWith(
        'study:answer-audio-repair-failed:failed-generated-media',
        '1',
        'PX',
        STUDY_AUDIO_REPAIR_FAILURE_COOLDOWN_MS
      );
    });
  });
});
