/* eslint-disable import/order */
import { MAX_STUDY_ASYNC_IMPORT_BYTES } from '@languageflow/shared/src/studyConstants';
import { Prisma } from '@prisma/client';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  buildFixtureColpkg,
  cleanupStudyServiceTestMedia,
  deleteFromGCSPathMock,
  getGcsBucketCorsConfigurationMock,
  getGcsObjectMetadataMock,
  readGCSObjectPrefixMock,
  resetStudyServiceMocks,
  uploadBufferToGCSPathMock,
} from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import {
  completeStudyImportUpload,
  cancelStudyImportUpload,
  getCurrentStudyImportJob,
  getStudyImportUploadReadiness,
  importJapaneseStudyColpkg,
  getStudyImportJob,
  processStudyImportJob,
} from '../../../services/studyImportService.js';
import {
  evaluateStudyImportUploadCorsReadiness,
  resetStudyImportUploadReadinessCacheForTests,
} from '../../../services/study/import.js';

describe('studyImportService', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
    resetStudyImportUploadReadinessCacheForTests();
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

  it('imports Anki collection databases compressed as zstd collection.anki21b', async () => {
    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: await buildFixtureColpkg({ compressCollectionDatabase: true }),
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');
    expect(result.preview.cardCount).toBe(6);
    expect(result.preview.noteCount).toBe(4);
  }, 15000);

  it('imports zstd-compressed Anki media manifests', async () => {
    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: await buildFixtureColpkg({ compressMediaManifest: true }),
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');
    expect(result.preview.mediaReferenceCount).toBe(8);
    expect(result.preview.skippedMediaCount).toBe(0);
  }, 15000);

  it('imports latest-format protobuf media manifests with zstd-compressed media files', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';

    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: await buildFixtureColpkg({
        compressCollectionDatabase: true,
        compressMediaFiles: true,
        compressMediaManifest: true,
        useLatestMediaManifest: true,
      }),
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');
    expect(result.preview.mediaReferenceCount).toBe(8);
    expect(result.preview.skippedMediaCount).toBe(0);
    expect(uploadBufferToGCSPathMock).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: Buffer.from('fixture:company.png'),
        contentType: 'image/png',
      })
    );
  }, 15000);

  it('imports large latest-format zstd media using manifest sizes', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    const largeMediaSize = 2 * 1024 * 1024;

    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: await buildFixtureColpkg({
        compressCollectionDatabase: true,
        compressMediaFiles: true,
        compressMediaManifest: true,
        largeCompanyPhotoBytes: largeMediaSize,
        useLatestMediaManifest: true,
      }),
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');
    expect(result.preview.mediaReferenceCount).toBe(8);
    expect(result.preview.skippedMediaCount).toBe(0);
    expect(uploadBufferToGCSPathMock).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: expect.objectContaining({
          length: largeMediaSize,
        }),
        contentType: 'image/png',
      })
    );
  }, 15000);

  it('skips latest-format media with invalid checksums without failing the import', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';

    const result = await importJapaneseStudyColpkg({
      userId: 'user-1',
      fileBuffer: await buildFixtureColpkg({
        compressCollectionDatabase: true,
        compressMediaFiles: true,
        compressMediaManifest: true,
        corruptCompanyPhotoSha1: true,
        useLatestMediaManifest: true,
      }),
      filename: 'japanese.colpkg',
    });

    expect(result.status).toBe('completed');
    expect(result.preview.mediaReferenceCount).toBe(8);
    expect(result.preview.skippedMediaCount).toBe(1);
    expect(result.preview.warnings).toEqual(
      expect.arrayContaining(['company.png: Skipped media with an invalid checksum.'])
    );
    expect(uploadBufferToGCSPathMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: Buffer.from('fixture:company.png'),
      })
    );
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
      uploadExpiresAt: new Date('2099-04-23T01:00:00.000Z'),
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

  it('rejects expired staged uploads before enqueueing background import work', async () => {
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
      uploadExpiresAt: new Date('2000-01-01T00:00:00.000Z'),
      completedAt: null,
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:00:00.000Z'),
    };
    mockPrisma.studyImportJob.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingImportJob);

    await expect(
      completeStudyImportUpload({
        userId: 'user-1',
        importJobId: 'import-job-1',
      })
    ).rejects.toMatchObject({
      statusCode: 410,
      message: expect.stringContaining('expired'),
    });

    expect(deleteFromGCSPathMock).toHaveBeenCalledWith(
      'study/imports/user-1/import-job-1/japanese.colpkg'
    );
  });

  it('rejects non-ZIP staged uploads using a prefix read before enqueueing', async () => {
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
      uploadExpiresAt: new Date('2099-04-23T01:00:00.000Z'),
      completedAt: null,
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:00:00.000Z'),
    };
    mockPrisma.studyImportJob.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingImportJob);
    readGCSObjectPrefixMock.mockResolvedValue(Buffer.from('NO'));

    await expect(
      completeStudyImportUpload({
        userId: 'user-1',
        importJobId: 'import-job-1',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('valid ZIP-based'),
    });
  });

  it('cancels pending staged uploads and cleans up the object', async () => {
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
      uploadExpiresAt: new Date('2099-04-23T01:00:00.000Z'),
      completedAt: null,
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:00:00.000Z'),
    };
    mockPrisma.studyImportJob.findFirst.mockResolvedValueOnce(pendingImportJob);
    mockPrisma.studyImportJob.update.mockResolvedValueOnce({
      ...pendingImportJob,
      status: 'failed',
      errorMessage: 'Study import upload was cancelled.',
      completedAt: new Date('2026-04-23T00:05:00.000Z'),
    });

    const result = await cancelStudyImportUpload({
      userId: 'user-1',
      importJobId: 'import-job-1',
    });

    expect(result.status).toBe('failed');
    expect(deleteFromGCSPathMock).toHaveBeenCalledWith(
      'study/imports/user-1/import-job-1/japanese.colpkg'
    );
  });

  it('rejects cancellation once processing has started', async () => {
    mockPrisma.studyImportJob.findFirst.mockResolvedValueOnce({
      id: 'import-job-1',
      userId: 'user-1',
      status: 'processing',
    });

    await expect(
      cancelStudyImportUpload({
        userId: 'user-1',
        importJobId: 'import-job-1',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('returns the latest current import for the user', async () => {
    mockPrisma.studyImportJob.findFirst.mockResolvedValueOnce({
      id: 'import-job-1',
      userId: 'user-1',
      status: 'processing',
      sourceType: 'anki_colpkg',
      sourceFilename: 'japanese.colpkg',
      sourceObjectPath: 'study/imports/user-1/import-job-1/japanese.colpkg',
      sourceContentType: 'application/zip',
      sourceSizeBytes: BigInt(1024),
      deckName: '日本語',
      previewJson: null,
      summaryJson: null,
      errorMessage: null,
      startedAt: null,
      uploadedAt: null,
      uploadExpiresAt: new Date('2099-04-23T01:00:00.000Z'),
      completedAt: null,
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:00:00.000Z'),
    });

    const result = await getCurrentStudyImportJob('user-1');

    expect(result?.id).toBe('import-job-1');
    expect(mockPrisma.studyImportJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['pending', 'processing'] },
        }),
      })
    );
  });

  it('checks GCS CORS readiness for direct browser uploads', async () => {
    expect(
      evaluateStudyImportUploadCorsReadiness({
        clientOrigin: 'https://convo-lab.com',
        corsRules: [
          {
            origin: ['https://convo-lab.com'],
            method: ['PUT', 'OPTIONS'],
            responseHeader: ['Content-Type'],
          },
        ],
      })
    ).toEqual({ ready: true, message: null });

    expect(
      evaluateStudyImportUploadCorsReadiness({
        clientOrigin: 'https://convo-lab.com',
        corsRules: [
          {
            origin: ['https://convo-lab.com'],
            method: ['GET'],
            responseHeader: ['Content-Type'],
          },
        ],
      }).ready
    ).toBe(false);
  });

  it('caches upload readiness checks briefly', async () => {
    getGcsBucketCorsConfigurationMock.mockResolvedValue([
      {
        origin: ['http://localhost:5173'],
        method: ['PUT', 'OPTIONS'],
        responseHeader: ['Content-Type'],
      },
    ]);

    await expect(getStudyImportUploadReadiness()).resolves.toEqual({
      ready: true,
      message: null,
    });
    await getStudyImportUploadReadiness();

    expect(getGcsBucketCorsConfigurationMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows unknown unique-constraint failures while starting a worker import', async () => {
    mockPrisma.studyImportJob.findUnique.mockResolvedValue({
      id: 'import-job-1',
      userId: 'user-1',
      status: 'pending',
      sourceObjectPath: 'study/imports/user-1/import-job-1/japanese.colpkg',
      sourceFilename: 'japanese.colpkg',
    });
    mockPrisma.studyImportJob.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate id', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['id'] },
      })
    );

    await expect(processStudyImportJob('import-job-1')).rejects.toMatchObject({
      code: 'P2002',
    });
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
