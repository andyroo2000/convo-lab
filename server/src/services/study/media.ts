import type { StudyCardSummary } from '@languageflow/shared/src/types.js';

import { prisma } from '../../db/client.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getSignedReadUrl } from '../storageClient.js';

import type { StudyCardWithRelations, StudyMediaAccessResult } from './shared.js';
import {
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

  await ensureGeneratedAnswerAudio(userId, cardId);

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
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

  if (!refreshed) {
    throw new AppError('Study card not found.', 404);
  }

  return await toStudyCardSummary(refreshed);
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

  if (typeof media.storagePath === 'string' && media.storagePath.length > 0) {
    const absolutePath = await findAccessibleLocalStudyMediaPath(media.storagePath);
    if (absolutePath) {
      return {
        type: 'local',
        absolutePath,
        contentType,
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
          filename,
        };
      }

      const signed = await getSignedReadUrl({
        filePath: media.storagePath,
        expiresInSeconds: STUDY_MEDIA_SIGNED_URL_TTL_SECONDS,
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
        filename,
      };
    }
  }

  return null;
}
