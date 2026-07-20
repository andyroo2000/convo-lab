import { downloadFromGCSPath, getSignedReadUrl } from './storageClient.js';
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
} from './study/shared.js';

export type PrivateMediaAccessResult =
  | {
      type: 'local';
      absolutePath: string;
      contentType: string;
      contentDisposition: 'inline' | 'attachment';
      filename: string;
    }
  | {
      type: 'redirect';
      redirectUrl: string;
      contentType: string;
      contentDisposition: 'inline' | 'attachment';
      filename: string;
    };

interface PrivateMediaRecord {
  id: string;
  sourceFilename: string;
  contentType: string | null;
  storagePath: string | null;
}

interface PrivateMediaAccessOptions {
  cacheNamespace: string;
  logContext: string;
  mediaKind: string;
}

function shouldServeInline(contentType: string, filename: string, mediaKind: string): boolean {
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

function toPrivateMediaDisposition(
  contentType: string,
  filename: string,
  mediaKind: string
): 'inline' | 'attachment' {
  return shouldServeInline(contentType, filename, mediaKind) ? 'inline' : 'attachment';
}

async function downloadPrivateMediaToLocalCache(
  storagePath: string,
  logContext: string
): Promise<string | null> {
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
    console.warn(`[${logContext}] Unable to cache private media locally:`, error);
    return null;
  }
}

export async function getPrivateMediaAccess(
  media: PrivateMediaRecord | null,
  options: PrivateMediaAccessOptions
): Promise<PrivateMediaAccessResult | null> {
  if (!media) {
    return null;
  }

  const filename = media.sourceFilename;
  const contentType = media.contentType ?? getContentType(filename);
  const contentDisposition = toPrivateMediaDisposition(contentType, filename, options.mediaKind);

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
      const cacheKey = `${options.cacheNamespace}:${media.id}:${media.storagePath}`;
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
        console.warn(`[${options.logContext}] Unable to sign private media URL:`, error);

        if (shouldMirrorStudyMediaLocally()) {
          const absolutePath = await downloadPrivateMediaToLocalCache(
            media.storagePath,
            options.logContext
          );
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
