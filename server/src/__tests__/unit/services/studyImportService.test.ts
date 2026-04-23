/* eslint-disable import/order */
import { MAX_STUDY_ASYNC_IMPORT_BYTES } from '@languageflow/shared/src/studyConstants';
import { Prisma } from '@prisma/client';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  buildFixtureColpkg,
  cleanupStudyServiceTestMedia,
  deleteFromGCSPathMock,
  getGcsObjectMetadataMock,
  resetStudyServiceMocks,
} from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import {
  completeStudyImportUpload,
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
    expect(
      createdCards.every(
        (card) =>
          typeof card.promptJson === 'object' &&
          card.promptJson !== null &&
          !('cueHtml' in (card.promptJson as Record<string, unknown>))
      )
    ).toBe(true);
  }, 15000);

  it('normalizes imported answer notes to plain text and keeps raw HTML only in source storage', async () => {
    await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: await buildFixtureColpkg({
        vocabNotes: '<strong>Common</strong> workplace noun.<br>Useful in offices.',
      }),
      filename: 'japanese.colpkg',
    });

    const createdCards = mockPrisma.studyCard.createMany.mock.calls[0][0].data as Array<
      Record<string, unknown>
    >;
    const createdAnswers = createdCards.map((card) => card.answerJson as Record<string, unknown>);
    expect(createdAnswers[0]?.notes).toContain('Common workplace noun.');
    expect(createdAnswers[0]?.notes).not.toContain('<strong>');
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

  it('records malformed cloze markup as an import warning instead of failing the import', async () => {
    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: await buildFixtureColpkg({
        clozeText: 'お風呂に虫{{c1::がいる::are (existence verb)!',
      }),
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');
    expect(result.preview.warnings).toContain(
      'note 4 / card 41: Recovered malformed cloze markup as plain text.'
    );
    expect(result.preview.skippedMediaCount).toBe(0);
  });

  it.each(['../../etc/passwd', '/tmp/evil.png', 'C:\\\\evil.png', 'nested/0'])(
    'never persists media for unsafe archive entries like %s',
    async (unsafeArchiveEntryName) => {
      const result = await importJapaneseStudyColpkg({
        userId: 'user-1',
        fileBuffer: await buildFixtureColpkg({
          companyPhotoZipEntryName: unsafeArchiveEntryName,
        }),
        filename: 'japanese.colpkg',
      });

      expect(result.status).toBe('completed');
      expect(result.preview.warnings).toContainEqual(
        expect.stringMatching(
          /^company\.png: (Skipped unsafe archive entry\.|Referenced media was missing\.)$/
        )
      );

      const createdMedia = mockPrisma.studyMedia.createMany.mock.calls.at(-1)?.[0].data as Array<
        Record<string, unknown>
      >;
      const companyPhoto = createdMedia.find((media) => media.sourceFilename === 'company.png');
      expect(companyPhoto?.storagePath).toBeNull();
      expect(companyPhoto?.publicUrl).toBeNull();
    }
  );

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

  it('cleans up partial import rows and persisted media when batched writes fail', async () => {
    mockPrisma.studyCard.createMany.mockRejectedValueOnce(new Error('card batch failed'));

    await expect(
      importJapaneseStudyColpkg({
        userId: 'user-1',
        fileBuffer: await buildFixtureColpkg(),
        filename: 'japanese.colpkg',
      })
    ).rejects.toMatchObject({
      statusCode: 500,
    });

    expect(mockPrisma.studyReviewLog.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', importJobId: 'import-job-1' },
    });
    expect(mockPrisma.studyCard.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', importJobId: 'import-job-1' },
    });
    expect(mockPrisma.studyNote.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', importJobId: 'import-job-1' },
    });
    expect(mockPrisma.studyMedia.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', importJobId: 'import-job-1' },
    });
  });

  it('rejects oversized staged uploads before enqueueing background import work', async () => {
    const pendingImportJob = {
      id: 'import-job-1',
      userId: 'user-1',
      status: 'pending',
      sourceType: 'anki_colpkg',
      sourceFilename: 'japanese.colpkg',
      sourceObjectPath: 'study/imports/user-1/import-job-1/japanese.colpkg',
      sourceContentType: 'application/zip',
      sourceSizeBytes: null,
      deckName: '日本語',
      previewJson: null,
      summaryJson: null,
      errorMessage: null,
      startedAt: null,
      uploadedAt: null,
      completedAt: null,
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:00:00.000Z'),
    };
    mockPrisma.studyImportJob.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingImportJob);
    getGcsObjectMetadataMock.mockResolvedValue({
      contentType: 'application/zip',
      sizeBytes: MAX_STUDY_ASYNC_IMPORT_BYTES + 1,
    });

    await expect(
      completeStudyImportUpload({
        userId: 'user-1',
        importJobId: 'import-job-1',
      })
    ).rejects.toMatchObject({
      statusCode: 413,
      message: expect.stringContaining('MB or smaller'),
    });

    expect(deleteFromGCSPathMock).toHaveBeenCalledWith(
      'study/imports/user-1/import-job-1/japanese.colpkg'
    );
    expect(mockPrisma.studyImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'import-job-1' },
        data: expect.objectContaining({
          status: 'failed',
        }),
      })
    );
  });

  it('wraps the import write phase in a single transaction after parsing completes', async () => {
    await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: await buildFixtureColpkg(),
      filename: 'japanese.colpkg',
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.studyNote.createMany).toHaveBeenCalled();
    expect(mockPrisma.studyMedia.createMany).toHaveBeenCalled();
    expect(mockPrisma.studyCard.createMany).toHaveBeenCalled();
    expect(mockPrisma.studyReviewLog.createMany).toHaveBeenCalled();
  });
});
