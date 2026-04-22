/* eslint-disable import/order */
import { Prisma } from '@prisma/client';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  buildFixtureColpkg,
  cleanupStudyServiceTestMedia,
  resetStudyServiceMocks,
} from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import {
  importJapaneseStudyColpkg,
  getStudyImportJob,
} from '../../../services/studyImportService.js';

describe('studyImportService', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
  });

  afterEach(async () => {
    await cleanupStudyServiceTestMedia();
  });

  it('imports the 日本語 deck into canonical study cards with scheduler and history preserved', async () => {
    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: await buildFixtureColpkg(),
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');
    expect(result.preview.cardCount).toBe(6);
    expect(result.preview.noteCount).toBe(4);
    expect(result.preview.reviewLogCount).toBe(3);

    const createdCards = mockPrisma.studyCard.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    expect(createdCards).toHaveLength(6);
    expect(createdCards.map((card) => card.cardType)).toEqual([
      'production',
      'recognition',
      'recognition',
      'recognition',
      'cloze',
      'cloze',
    ]);
  });

  it('returns a clearer error when the supported 日本語 deck is missing', async () => {
    await expect(
      importJapaneseStudyColpkg({
        userId: 'user-1',
        fileBuffer: await buildFixtureColpkg({ deckName: 'Spanish' }),
        filename: 'spanish.colpkg',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Only the "日本語" deck is supported in this version. Found: "Spanish".',
    });
  });

  it('returns 409 when another import is already processing for the user', async () => {
    mockPrisma.studyImportJob.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate import', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );
    mockPrisma.studyImportJob.findFirst.mockResolvedValue({
      id: 'import-job-active',
      userId: 'user-1',
      status: 'processing',
    });

    await expect(
      importJapaneseStudyColpkg({
        userId: 'user-1',
        fileBuffer: await buildFixtureColpkg(),
        filename: 'japanese.colpkg',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('reads an import job scoped to the current user', async () => {
    mockPrisma.studyImportJob.findFirst.mockResolvedValue({
      id: 'import-job-1',
      userId: 'user-1',
      status: 'completed',
      sourceFilename: 'japanese.colpkg',
      deckName: '日本語',
      previewJson: {
        deckName: '日本語',
        cardCount: 6,
        noteCount: 4,
        reviewLogCount: 3,
        mediaReferenceCount: 8,
        skippedMediaCount: 0,
        warnings: [],
        noteTypeBreakdown: [],
      },
      completedAt: new Date('2026-04-12T00:00:00.000Z'),
      errorMessage: null,
    });

    const result = await getStudyImportJob('user-1', 'import-job-1');
    expect(result?.id).toBe('import-job-1');
    expect(result?.status).toBe('completed');
  });
});
