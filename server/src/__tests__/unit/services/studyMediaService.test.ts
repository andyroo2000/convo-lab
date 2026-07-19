/* eslint-disable import/order */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupStudyServiceTestMedia,
  downloadFromGCSPathMock,
  getSignedReadUrlMock,
  redisGetMock,
  redisSetMock,
  resetStudyServiceMocks,
  synthesizeBatchedTextsMock,
  uploadBufferToGCSPathMock,
} from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import { getStudyMediaAccess } from '../../../services/studyMediaService.js';
import {
  findAccessibleLocalStudyMediaPath,
  persistStudyMediaBuffer,
  STUDY_AUDIO_REPAIR_FAILURE_COOLDOWN_MS,
  toStudyCardSummary,
} from '../../../services/study/shared.js';

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

  it('returns a signed redirect for user-owned GCS media', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-1',
      userId: 'user-1',
      sourceFilename: 'company.mp3',
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath: 'study-media/user-1/import/company.mp3',
    });

    const result = await getStudyMediaAccess('user-1', 'media-1');

    expect(mockPrisma.studyMedia.findFirst).toHaveBeenCalledWith({
      where: { id: 'media-1', userId: 'user-1' },
    });
    expect(getSignedReadUrlMock).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: 'redirect',
        contentDisposition: 'inline',
      })
    );
  });

  it('returns null when the media is not owned by the user', async () => {
    mockPrisma.studyMedia.findFirst.mockResolvedValue(null);

    await expect(getStudyMediaAccess('user-1', 'media-1')).resolves.toBeNull();
    expect(getSignedReadUrlMock).not.toHaveBeenCalled();
  });

  it('uses regenerated answer audio for existing mismatched recognition cards', async () => {
    const answerAudio = {
      id: 'media-answer',
      filename: 'answer.mp3',
      url: '/api/study/media/media-answer',
      mediaKind: 'audio',
      source: 'generated',
    };
    const cardRecord = {
      id: 'card-mismatch',
      userId: 'user-1',
      noteId: 'note-1',
      cardType: 'recognition',
      queueState: 'review',
      answerAudioSource: 'generated',
      promptJson: {
        cueAudio: {
          id: 'media-prompt',
          filename: 'prompt.mp3',
          url: '/api/study/media/media-prompt',
          mediaKind: 'audio',
          source: 'generated',
        },
        cueImage: {
          id: 'image-1',
          filename: 'front.webp',
          url: '/api/study/media/image-1',
          mediaKind: 'image',
          source: 'generated',
        },
      },
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudio,
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
        rawFieldsJson: {},
        canonicalFieldsJson: {},
      },
    } as unknown as Parameters<typeof toStudyCardSummary>[0];

    const card = await toStudyCardSummary(cardRecord);

    expect(card.prompt.cueAudio?.id).toBe('media-answer');
    expect(card.prompt.cueImage?.id).toBe('image-1');
    expect(card.answer.answerAudio?.id).toBe('media-answer');
  });

  it('keeps a local mirror when persisting GCS-backed media in development', async () => {
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
        const localPath = await findAccessibleLocalStudyMediaPath(persisted.storagePath);
        await expect(fs.readFile(localPath as string, 'utf8')).resolves.toBe('fake-audio');
      }
    );
  });

  it('backfills imported Anki media lazily before serving it', async () => {
    const ankiMediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-media-access-'));

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

      await withStudyMediaEnv(
        { ANKI_MEDIA_DIR: ankiMediaDir, GCS_BUCKET_NAME: 'test-bucket' },
        async () => {
          const result = await getStudyMediaAccess('user-1', 'media-lazy');

          expect(mockPrisma.studyMedia.update).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { id: 'media-lazy' },
              data: expect.objectContaining({
                storagePath: expect.stringContaining('company.mp3'),
              }),
            })
          );
          expect(result?.type).toBe('redirect');
        }
      );
    } finally {
      await fs.rm(ankiMediaDir, { recursive: true, force: true });
    }
  });

  it('forces attachment disposition for unsafe inline media', async () => {
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

  it('returns null when private GCS media cannot be signed', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    getSignedReadUrlMock.mockRejectedValueOnce(new Error('missing signer'));
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-gcs-failure',
      userId: 'user-1',
      sourceFilename: 'missing.mp3',
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath: 'study-media/user-1/import/missing.mp3',
    });

    await expect(getStudyMediaAccess('user-1', 'media-gcs-failure')).resolves.toBeNull();
    expect(downloadFromGCSPathMock).not.toHaveBeenCalled();
  });

  it('caches GCS media locally in development when signing fails', async () => {
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

        expect(result).toEqual(
          expect.objectContaining({
            type: 'local',
            absolutePath: expect.stringContaining(filename),
          })
        );
        await expect(fs.readFile(result?.absolutePath as string, 'utf8')).resolves.toBe(
          'cached-audio'
        );
      }
    );
  });

  it('repairs stale generated audio when its backing media is missing', async () => {
    const cardId = `card-stale-${Date.now()}`;
    getSignedReadUrlMock.mockRejectedValueOnce(new Error('missing signer'));
    downloadFromGCSPathMock.mockRejectedValueOnce(new Error('missing object'));
    mockPrisma.studyMedia.findFirst.mockResolvedValueOnce({
      id: 'old-generated-media',
      userId: 'user-1',
      sourceKind: 'generated',
      sourceFilename: `${cardId}.mp3`,
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath: `study-media/user-1/generated/${cardId}.mp3`,
    });
    mockPrisma.studyCard.findFirst.mockResolvedValueOnce({
      id: cardId,
      answerAudioMediaId: 'old-generated-media',
    });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: cardId,
      userId: 'user-1',
      answerAudioSource: 'generated',
      answerJson: { restoredText: '月曜日に会いましょう。' },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'new-generated-media' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    await withStudyMediaEnv(
      { NODE_ENV: 'development', GCS_BUCKET_NAME: 'test-bucket' },
      async () => {
        await expect(getStudyMediaAccess('user-1', 'old-generated-media')).resolves.toBeNull();
        await vi.waitFor(() => {
          expect(synthesizeBatchedTextsMock).toHaveBeenCalledWith(
            ['月曜日に会いましょう。'],
            expect.objectContaining({ languageCode: 'ja-JP' })
          );
          expect(mockPrisma.studyCard.update).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { id: cardId },
              data: expect.objectContaining({
                answerAudioMediaId: 'new-generated-media',
              }),
            })
          );
        });
      }
    );
  });

  it('skips generated-audio repair during a failure cooldown', async () => {
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

    await expect(getStudyMediaAccess('user-1', 'cooling-generated-media')).resolves.toBeNull();
    expect(mockPrisma.studyCard.findFirst).not.toHaveBeenCalled();
    expect(synthesizeBatchedTextsMock).not.toHaveBeenCalled();
  });

  it('records a cooldown when generated-audio repair fails', async () => {
    synthesizeBatchedTextsMock.mockRejectedValue(new Error('tts down'));
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
      answerJson: { restoredText: '月曜日に会いましょう。' },
    });

    await expect(getStudyMediaAccess('user-1', 'failed-generated-media')).resolves.toBeNull();
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
