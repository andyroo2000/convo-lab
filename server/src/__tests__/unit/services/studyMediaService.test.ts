/* eslint-disable import/order */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupStudyServiceTestMedia,
  getSignedReadUrlMock,
  redisSetMock,
  resetStudyServiceMocks,
} from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import {
  getStudyMediaAccess,
  prepareStudyCardAnswerAudio,
} from '../../../services/studyMediaService.js';
import { synthesizeSpeech } from '../../../services/ttsClient.js';

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

    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalledTimes(1);
    expect(card.answerAudioSource).toBe('missing');
  });

  it('deduplicates concurrent answer-audio generation for the same card', async () => {
    redisSetMock.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    let resolveAudio!: (buffer: Buffer) => void;
    vi.mocked(synthesizeSpeech).mockReturnValueOnce(
      new Promise<Buffer>((resolve) => {
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
    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalledTimes(1);

    resolveAudio(Buffer.from('fake-audio'));

    const [firstCard, secondCard] = await Promise.all([firstRequest, secondRequest]);

    expect(firstCard.answerAudioSource).toBe('generated');
    expect(secondCard.answerAudioSource).toBe('generated');
  });

  it('returns a signed redirect for GCS-backed study media', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'media-1',
      userId: 'user-1',
      sourceFilename: 'company.mp3',
      contentType: 'audio/mpeg',
      storagePath: 'study-media/user-1/import/company.mp3',
    });

    const result = await getStudyMediaAccess('user-1', 'media-1');

    expect(getSignedReadUrlMock).toHaveBeenCalled();
    expect(result?.type).toBe('redirect');
    expect(result?.contentDisposition).toBe('inline');
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
      sourceFilename: 'company.mp3',
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath: 'study-media/user-1/import/company.mp3',
    });

    const result = await getStudyMediaAccess('user-1', 'media-gcs-failure');

    expect(result).toBeNull();
  });
});
