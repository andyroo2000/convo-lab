import { promises as fs } from 'fs';
import path from 'path';

import { Prisma } from '@prisma/client';
import { vi } from 'vitest';

import { mockPrisma } from '../../setup.js';

const storageMocks = vi.hoisted(() => ({
  downloadFromGCSPathMock: vi.fn(),
  getSignedReadUrlMock: vi.fn(),
  uploadBufferToGCSPathMock: vi.fn(),
}));

export const { downloadFromGCSPathMock, getSignedReadUrlMock, uploadBufferToGCSPathMock } =
  storageMocks;

const redisMocks = vi.hoisted(() => ({
  createRedisConnectionMock: vi.fn(),
  redisDelMock: vi.fn(),
  redisGetMock: vi.fn(),
  redisSetMock: vi.fn(),
}));

export const { createRedisConnectionMock, redisDelMock, redisGetMock, redisSetMock } = redisMocks;

const ttsMocks = vi.hoisted(() => ({
  synthesizeBatchedTextsMock: vi.fn(async () => [Buffer.from('fake-audio')]),
}));

export const { synthesizeBatchedTextsMock } = ttsMocks;

const pitchAccentMocks = vi.hoisted(() => ({
  resolvePitchAccentMock: vi.fn(),
}));

export const { resolvePitchAccentMock } = pitchAccentMocks;

vi.mock('../../../services/batchedTTSClient.js', () => ({
  synthesizeBatchedTexts: synthesizeBatchedTextsMock,
}));

vi.mock('../../../services/japaneseReadingGenerator.js', () => ({
  generateJapaneseReading: vi.fn(async (text: string) => `${text}[furigana]`),
  generateJapaneseReadings: vi.fn(async (texts: string[]) =>
    texts.map((text) => `${text}[furigana]`)
  ),
  fillMissingJapaneseReadingsForScriptUnits: vi.fn(async (units) => units),
}));

vi.mock('../../../services/pitchAccent/pitchAccentResolver.js', () => ({
  resolvePitchAccent: resolvePitchAccentMock,
}));

vi.mock('../../../services/storageClient.js', () => ({
  downloadFromGCSPath: downloadFromGCSPathMock,
  getSignedReadUrl: getSignedReadUrlMock,
  uploadBufferToGCSPath: uploadBufferToGCSPathMock,
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: createRedisConnectionMock,
}));

export const generatedStudyMediaPath = path.join(process.cwd(), 'storage/study-media');

export function resetStudyServiceMocks() {
  vi.clearAllMocks();
  const defaultImportJob = {
    id: 'import-job-1',
    userId: 'user-1',
    status: 'processing',
    sourceType: 'anki_colpkg',
    sourceFilename: 'japanese.colpkg',
    sourceObjectPath: 'study/imports/user-1/import-job-1/japanese.colpkg',
    sourceContentType: 'application/zip',
    sourceSizeBytes: BigInt(1024),
    deckName: '日本語',
    previewJson: {
      deckName: '日本語',
      cardCount: 0,
      noteCount: 0,
      reviewLogCount: 0,
      mediaReferenceCount: 0,
      skippedMediaCount: 0,
      warnings: [],
      noteTypeBreakdown: [],
    },
    summaryJson: null,
    errorMessage: null,
    startedAt: null,
    uploadedAt: null,
    uploadExpiresAt: new Date('2099-04-23T01:00:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-04-23T00:00:00.000Z'),
    updatedAt: new Date('2026-04-23T00:00:00.000Z'),
  };
  createRedisConnectionMock.mockReturnValue({
    set: redisSetMock,
    get: redisGetMock,
    del: redisDelMock,
  });
  redisSetMock.mockResolvedValue('OK');
  redisGetMock.mockResolvedValue(null);
  redisDelMock.mockResolvedValue(1);
  process.env.GCS_BUCKET_NAME = '';
  downloadFromGCSPathMock.mockImplementation(async ({ destinationPath }) => destinationPath);
  uploadBufferToGCSPathMock.mockResolvedValue('https://storage.googleapis.com/test/study-media');
  getSignedReadUrlMock.mockResolvedValue({
    url: 'https://signed.example.com/study-media',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
  mockPrisma.studyImportJob.create.mockResolvedValue(defaultImportJob);
  mockPrisma.studyImportJob.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);
  mockPrisma.studyImportJob.findUnique?.mockResolvedValue(defaultImportJob);
  mockPrisma.studyImportJob.findMany?.mockResolvedValue([]);
  mockPrisma.studyImportJob.update.mockResolvedValue(defaultImportJob);
  mockPrisma.studyReviewLog.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyCard.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyNote.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyMedia.findMany.mockResolvedValue([]);
  mockPrisma.studyMedia.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.studyNote.createMany.mockResolvedValue({ count: 4 });
  mockPrisma.studyMedia.createMany.mockResolvedValue({ count: 8 });
  mockPrisma.studyCard.createMany.mockResolvedValue({ count: 6 });
  mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.studyCard.groupBy.mockResolvedValue([]);
  mockPrisma.studyCard.aggregate.mockResolvedValue({
    _max: {
      newQueuePosition: 0,
    },
  });
  mockPrisma.$executeRaw.mockResolvedValue(0);
  mockPrisma.$queryRaw.mockResolvedValue([
    {
      due_count: 0,
      new_count: 0,
      learning_count: 0,
      review_count: 0,
      suspended_count: 0,
      total_cards: 0,
      next_due_at: null,
    },
  ]);
  mockPrisma.studyReviewLog.createMany.mockResolvedValue({ count: 3 });
  mockPrisma.$transaction.mockImplementation(async (callbackOrOperations: unknown) =>
    Array.isArray(callbackOrOperations)
      ? Promise.all(callbackOrOperations)
      : (callbackOrOperations as (client: typeof mockPrisma) => unknown)(mockPrisma)
  );
}

export async function cleanupStudyServiceTestMedia() {
  await fs.rm(generatedStudyMediaPath, { recursive: true, force: true });
}

export { mockPrisma, Prisma };
