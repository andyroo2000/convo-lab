import { promises as fs } from 'fs';
import path from 'path';

import { uploadBufferToGCSPath } from '../../storageClient.js';

import {
  findAccessibleLocalStudyMediaPath,
  getContentType,
  getPrivateStudyMediaRoot,
  hasConfiguredStudyGcsStorage,
  normalizeFilename,
  pruneStudyMediaRedirectCache,
  sanitizePathSegment,
  shouldMirrorStudyMediaLocally,
  studyMediaRedirectCache,
} from './paths.js';

async function writeStudyMediaBufferLocally(storagePath: string, buffer: Buffer): Promise<void> {
  const absolutePath = path.join(getPrivateStudyMediaRoot(), storagePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
}

export async function persistStudyMediaBuffer(params: {
  userId: string;
  importJobId: string;
  filename: string;
  buffer: Buffer;
}): Promise<{ publicUrl: string | null; storagePath: string }> {
  const { userId, importJobId, filename, buffer } = params;
  const normalizedFilename = normalizeFilename(filename);
  const storagePath = [
    'study-media',
    sanitizePathSegment(userId),
    sanitizePathSegment(importJobId),
    normalizedFilename,
  ].join('/');
  let hasLocalMirror = false;

  if (process.env.GCS_BUCKET_NAME) {
    if (shouldMirrorStudyMediaLocally()) {
      try {
        await writeStudyMediaBufferLocally(storagePath, buffer);
        hasLocalMirror = true;
      } catch (error) {
        console.warn('[Study] Unable to mirror study media locally:', error);
      }
    }

    try {
      await uploadBufferToGCSPath({
        buffer,
        destinationPath: storagePath,
        contentType: getContentType(filename),
        makePublic: false,
      });

      return {
        publicUrl: null,
        storagePath,
      };
    } catch (error) {
      console.warn('[Study] Falling back to local media storage:', error);
    }
  }

  if (!hasLocalMirror) {
    await writeStudyMediaBufferLocally(storagePath, buffer);
  }

  return {
    publicUrl: null,
    storagePath,
  };
}

export {
  findAccessibleLocalStudyMediaPath,
  getContentType,
  hasConfiguredStudyGcsStorage,
  pruneStudyMediaRedirectCache,
  studyMediaRedirectCache,
};
