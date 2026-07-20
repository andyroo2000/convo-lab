import { prisma } from '../../db/client.js';
import { downloadFromGCSPath, getSignedReadUrl } from '../storageClient.js';

import type { StudyMediaAccessResult } from './shared.js';
import {
  findAccessibleLocalStudyMediaPath,
  getContentType,
  getPrivateStudyMediaRoot,
  hasConfiguredStudyGcsStorage,
  pruneStudyMediaRedirectCache,
  resolveStudyMediaAbsolutePath,
  shouldMirrorStudyMediaLocally,
  STUDY_MEDIA_SIGNED_URL_REFRESH_WINDOW_MS,
  STUDY_MEDIA_SIGNED_URL_TTL_SECONDS,
  studyMediaRedirectCache,
} from './shared.js';

function shouldServeInline(
  contentType: string,
  filename: string,
  mediaKind: string | null
): boolean {
  const lowerContentType = contentType.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  if (mediaKind === 'audio' || lowerContentType.startsWith('audio/')) {
    return true;
  }

  if (mediaKind === 'image' || lowerContentType.startsWith('image/')) {
    if (lowerFilename.endsWith('.svg') || lowerContentType.includes('svg')) {
      return false;
    }

    return lowerContentType.startsWith('image/');
  }

  return false;
}

function toStudyMediaDisposition(
  contentType: string,
  filename: string,
  mediaKind: string | null
): 'inline' | 'attachment' {
  return shouldServeInline(contentType, filename, mediaKind) ? 'inline' : 'attachment';
}

async function downloadStudyMediaToLocalCache(storagePath: string): Promise<string | null> {
  const absolutePath = resolveStudyMediaAbsolutePath(getPrivateStudyMediaRoot(), storagePath);
  if (!absolutePath) {
    return null;
  }

  try {
    await downloadFromGCSPath({
      filePath: storagePath,
      destinationPath: absolutePath,
    });
    return absolutePath;
  } catch (error) {
    console.warn('[Study] Unable to cache GCS study media locally:', error);
    return null;
  }
}

export async function getStudyMediaAccess(
  userId: string,
  mediaId: string
): Promise<StudyMediaAccessResult | null> {
  const media = await prisma.studyMedia.findFirst({
    where: {
      id: mediaId,
      userId,
    },
  });

  if (!media) {
    return null;
  }

  const filename = media.sourceFilename;
  const contentType = media.contentType ?? getContentType(filename);
  const contentDisposition = toStudyMediaDisposition(contentType, filename, media.mediaKind);

  if (typeof media.storagePath === 'string' && media.storagePath.length > 0) {
    const absolutePath = await findAccessibleLocalStudyMediaPath(media.storagePath);
    if (absolutePath) {
      return {
        type: 'local',
        absolutePath,
        contentType,
        contentDisposition,
        filename,
      };
    }

    if (hasConfiguredStudyGcsStorage()) {
      const cacheKey = `${media.id}:${media.storagePath}`;
      const nowMs = Date.now();
      pruneStudyMediaRedirectCache(nowMs);
      const cached = studyMediaRedirectCache.get(cacheKey);
      if (cached && cached.expiresAtMs - nowMs > STUDY_MEDIA_SIGNED_URL_REFRESH_WINDOW_MS) {
        return {
          type: 'redirect',
          redirectUrl: cached.url,
          contentType,
          contentDisposition,
          filename,
        };
      }

      try {
        const signed = await getSignedReadUrl({
          filePath: media.storagePath,
          expiresInSeconds: STUDY_MEDIA_SIGNED_URL_TTL_SECONDS,
          responseDisposition: `${contentDisposition}; filename="${filename.replaceAll('"', '_')}"`,
          responseType: contentType,
        });
        studyMediaRedirectCache.set(cacheKey, {
          url: signed.url,
          expiresAtMs: Number.isNaN(Date.parse(signed.expiresAt))
            ? nowMs + STUDY_MEDIA_SIGNED_URL_TTL_SECONDS * 1000
            : Date.parse(signed.expiresAt),
        });
        pruneStudyMediaRedirectCache(nowMs);

        return {
          type: 'redirect',
          redirectUrl: signed.url,
          contentType,
          contentDisposition,
          filename,
        };
      } catch (error) {
        console.warn('[Study] Unable to sign study media URL:', error);

        if (shouldMirrorStudyMediaLocally()) {
          const absolutePath = await downloadStudyMediaToLocalCache(media.storagePath);
          if (absolutePath) {
            return {
              type: 'local',
              absolutePath,
              contentType,
              contentDisposition,
              filename,
            };
          }
        }
      }
    }
  }

  return null;
}
