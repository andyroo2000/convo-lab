import type { StudyCardSummary } from '@languageflow/shared/src/types.js';

import { prisma } from '../../db/client.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getSignedReadUrl } from '../storageClient.js';

import type { StudyCardWithRelations, StudyMediaAccessResult } from './shared.js';
import {
  backfillImportedStudyMedia,
  ensureGeneratedAnswerAudio,
  findAccessibleLocalStudyMediaPath,
  getContentType,
  hasConfiguredStudyGcsStorage,
  pruneStudyMediaRedirectCache,
  STUDY_MEDIA_SIGNED_URL_REFRESH_WINDOW_MS,
  STUDY_MEDIA_SIGNED_URL_TTL_SECONDS,
  studyMediaRedirectCache,
  toStudyCardSummary,
} from './shared.js';

export { ensureGeneratedAnswerAudio, ensureStudyCardMediaAvailable } from './shared.js';

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

export async function prepareStudyCardAnswerAudio(
  userId: string,
  cardId: string
): Promise<StudyCardSummary> {
  const existing: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: cardId,
      userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!existing) {
    throw new AppError('Study card not found.', 404);
  }

  void ensureGeneratedAnswerAudio(userId, cardId).catch((error) => {
    console.warn('[Study] Unable to prepare answer audio in background:', error);
  });

  return await toStudyCardSummary(existing);
}

export async function getStudyMediaAccess(
  userId: string,
  mediaId: string
): Promise<StudyMediaAccessResult | null> {
  let media = await prisma.studyMedia.findFirst({
    where: {
      id: mediaId,
      userId,
    },
  });

  if (!media) {
    return null;
  }

  const backfilledMedia = await backfillImportedStudyMedia(media);
  if (backfilledMedia) {
    media = {
      ...media,
      storagePath: backfilledMedia.storagePath ?? media.storagePath,
      publicUrl: backfilledMedia.publicUrl ?? media.publicUrl,
    };
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
      }
    }
  }

  return null;
}
