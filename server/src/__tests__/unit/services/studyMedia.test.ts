/* eslint-disable import/order */
import { promises as fs } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupStudyServiceTestMedia,
  downloadFromGCSPathMock,
  getSignedReadUrlMock,
  resetStudyServiceMocks,
  uploadBufferToGCSPathMock,
} from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import { getStudyMediaAccess } from '../../../services/study/media.js';
import {
  findAccessibleLocalStudyMediaPath,
  persistStudyMediaBuffer,
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

describe('study media access', () => {
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

  it('does not recover legacy media rows without durable storage', async () => {
    mockPrisma.studyMedia.findFirst.mockResolvedValue({
      id: 'legacy-media',
      userId: 'user-1',
      sourceKind: 'anki_import',
      sourceFilename: 'missing.mp3',
      contentType: 'audio/mpeg',
      mediaKind: 'audio',
      storagePath: null,
      publicUrl: null,
    });

    await expect(getStudyMediaAccess('user-1', 'legacy-media')).resolves.toBeNull();
    expect(mockPrisma.studyMedia.update).not.toHaveBeenCalled();
    expect(getSignedReadUrlMock).not.toHaveBeenCalled();
    expect(downloadFromGCSPathMock).not.toHaveBeenCalled();
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
});
