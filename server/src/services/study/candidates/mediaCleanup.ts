import { prisma } from '../../../db/client.js';
import { getStudyAudioRedisClient } from '../shared/mediaHelpers.js';
import { deletePersistedStudyMediaByStoragePath } from '../shared/paths.js';

import {
  STUDY_CANDIDATE_PREVIEW_CLEANUP_INTERVAL_MS,
  STUDY_CANDIDATE_PREVIEW_RETENTION_MS,
  STUDY_CANDIDATE_PREVIEW_SOURCE_KIND,
} from './constants.js';

const lastPreviewCleanupByUser = new Map<string, number>();

async function acquirePreviewCleanupLease(userId: string, nowMs: number): Promise<boolean> {
  const leaseKey = `study:candidate-preview-cleanup:${userId}`;
  try {
    const redis = getStudyAudioRedisClient();
    const acquired = await redis.set(
      leaseKey,
      String(nowMs),
      'PX',
      STUDY_CANDIDATE_PREVIEW_CLEANUP_INTERVAL_MS,
      'NX'
    );
    return acquired === 'OK';
  } catch (error) {
    console.warn(
      '[Study candidates] Redis preview cleanup lease unavailable; falling back to process-local throttle.',
      error
    );
  }

  const lastCleanupAt = lastPreviewCleanupByUser.get(userId) ?? 0;
  if (nowMs - lastCleanupAt < STUDY_CANDIDATE_PREVIEW_CLEANUP_INTERVAL_MS) {
    return false;
  }

  lastPreviewCleanupByUser.set(userId, nowMs);
  return true;
}

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

  const staleMediaIds = stalePreviewMedia.map((media) => media.id);
  // Delete DB rows first; orphaned storage is preferable to card audio rows pointing at missing files.
  await prisma.studyMedia.deleteMany({
    where: {
      id: {
        in: staleMediaIds,
      },
    },
  });
  await Promise.allSettled(
    stalePreviewMedia
      .map((media) => media.storagePath)
      .filter((storagePath): storagePath is string => typeof storagePath === 'string')
      .map((storagePath) => deletePersistedStudyMediaByStoragePath(storagePath))
  );
}

export async function scheduleStudyCandidatePreviewMediaCleanup(
  userId: string,
  nowMs = Date.now()
): Promise<boolean> {
  const shouldRun = await acquirePreviewCleanupLease(userId, nowMs);
  if (!shouldRun) {
    return false;
  }

  void cleanupStudyCandidatePreviewMedia(userId, nowMs).catch((error) => {
    console.warn('[Study candidates] Failed to prune stale preview media.', error);
  });
  return true;
}

export function resetStudyCandidatePreviewMediaCleanupSchedule(): void {
  lastPreviewCleanupByUser.clear();
}
