import { prisma } from '../../../db/client.js';
import { deletePersistedStudyMediaByStoragePath } from '../shared/paths.js';

import {
  STUDY_CANDIDATE_PREVIEW_CLEANUP_INTERVAL_MS,
  STUDY_CANDIDATE_PREVIEW_RETENTION_MS,
  STUDY_CANDIDATE_PREVIEW_SOURCE_KIND,
} from './constants.js';

const lastPreviewCleanupByUser = new Map<string, number>();

export async function cleanupStudyCandidatePreviewMedia(
  userId: string,
  nowMs = Date.now()
): Promise<void> {
  const stalePreviewMedia = await prisma.studyMedia.findMany({
    where: {
      userId,
      sourceKind: STUDY_CANDIDATE_PREVIEW_SOURCE_KIND,
      createdAt: {
        lt: new Date(nowMs - STUDY_CANDIDATE_PREVIEW_RETENTION_MS),
      },
      promptAudioCards: {
        none: {},
      },
      answerAudioCards: {
        none: {},
      },
    },
    select: {
      id: true,
      storagePath: true,
    },
  });

  if (stalePreviewMedia.length === 0) return;

  await Promise.allSettled(
    stalePreviewMedia
      .map((media) => media.storagePath)
      .filter((storagePath): storagePath is string => typeof storagePath === 'string')
      .map((storagePath) => deletePersistedStudyMediaByStoragePath(storagePath))
  );
  await prisma.studyMedia.deleteMany({
    where: {
      id: {
        in: stalePreviewMedia.map((media) => media.id),
      },
    },
  });
}

export function scheduleStudyCandidatePreviewMediaCleanup(
  userId: string,
  nowMs = Date.now()
): boolean {
  const lastCleanupAt = lastPreviewCleanupByUser.get(userId) ?? 0;
  if (nowMs - lastCleanupAt < STUDY_CANDIDATE_PREVIEW_CLEANUP_INTERVAL_MS) {
    return false;
  }

  lastPreviewCleanupByUser.set(userId, nowMs);
  void cleanupStudyCandidatePreviewMedia(userId, nowMs).catch((error) => {
    console.warn('[Study candidates] Failed to prune stale preview media.', error);
  });
  return true;
}

export function resetStudyCandidatePreviewMediaCleanupSchedule(): void {
  lastPreviewCleanupByUser.clear();
}
