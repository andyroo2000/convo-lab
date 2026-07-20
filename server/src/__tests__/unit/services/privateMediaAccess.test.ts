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
import { getPrivateMediaAccess } from '../../../services/privateMediaAccess.js';
import {
  findAccessibleLocalStudyMediaPath,
  persistStudyMediaBuffer,
  studyMediaRedirectCache,
} from '../../../services/study/shared.js';

async function withPrivateMediaEnv<T>(
  updates: Partial<Record<'GCS_BUCKET_NAME' | 'NODE_ENV', string>>,
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

function mediaRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'media-1',
    sourceFilename: 'segment.webp',
    contentType: 'image/webp',
    storagePath: 'study-media/user-1/generated/segment.webp',
    ...overrides,
  };
}

const imageAccessOptions = {
  cacheNamespace: 'audio-script',
  logContext: 'AudioScript',
  mediaKind: 'image',
};

describe('private media access', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
    studyMediaRedirectCache.clear();
  });

  afterEach(async () => {
    await cleanupStudyServiceTestMedia();
  });

  it('returns a signed redirect for GCS-backed media', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';

    const result = await getPrivateMediaAccess(mediaRecord(), imageAccessOptions);

    expect(getSignedReadUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: 'study-media/user-1/generated/segment.webp',
        responseDisposition: 'inline; filename="segment.webp"',
        responseType: 'image/webp',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        type: 'redirect',
        contentDisposition: 'inline',
      })
    );
  });

  it('keeps a local mirror when persisting GCS-backed media in development', async () => {
    const filename = `audio-script-local-${Date.now()}.webp`;

    await withPrivateMediaEnv(
      { NODE_ENV: 'development', GCS_BUCKET_NAME: 'test-bucket' },
      async () => {
        const persisted = await persistStudyMediaBuffer({
          userId: 'user-1',
          importJobId: 'generated',
          filename,
          buffer: Buffer.from('fake-image'),
        });

        expect(uploadBufferToGCSPathMock).toHaveBeenCalledWith(
          expect.objectContaining({
            destinationPath: `study-media/user-1/generated/${filename}`,
          })
        );
        const localPath = await findAccessibleLocalStudyMediaPath(persisted.storagePath);
        await expect(fs.readFile(localPath as string, 'utf8')).resolves.toBe('fake-image');
      }
    );
  });

  it('forces attachment disposition for unsafe inline media', async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';

    const result = await getPrivateMediaAccess(
      mediaRecord({
        sourceFilename: 'diagram.svg',
        contentType: 'image/svg+xml',
        storagePath: 'study-media/user-1/generated/diagram.svg',
      }),
      imageAccessOptions
    );

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

    await expect(getPrivateMediaAccess(mediaRecord(), imageAccessOptions)).resolves.toBeNull();
    expect(downloadFromGCSPathMock).not.toHaveBeenCalled();
  });

  it('caches GCS media locally in development when signing fails', async () => {
    const filename = `dev-gcs-fallback-${Date.now()}.webp`;
    const storagePath = `study-media/user-1/generated/${filename}`;
    getSignedReadUrlMock.mockRejectedValueOnce(new Error('missing signer'));
    downloadFromGCSPathMock.mockImplementationOnce(async ({ destinationPath }) => {
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.writeFile(destinationPath, 'cached-image');
      return destinationPath;
    });

    await withPrivateMediaEnv(
      { NODE_ENV: 'development', GCS_BUCKET_NAME: 'test-bucket' },
      async () => {
        const result = await getPrivateMediaAccess(
          mediaRecord({ sourceFilename: filename, storagePath }),
          imageAccessOptions
        );

        expect(result).toEqual(
          expect.objectContaining({
            type: 'local',
            absolutePath: expect.stringContaining(filename),
          })
        );
        if (result?.type !== 'local') {
          throw new Error('Expected locally cached private media.');
        }
        await expect(fs.readFile(result.absolutePath, 'utf8')).resolves.toBe('cached-image');
      }
    );
  });
});
