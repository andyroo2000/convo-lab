import type { StudyAnswerPayload, StudyCardSummary } from '@languageflow/shared/src/types.js';

import { prisma } from '../../db/client.js';
import { AppError } from '../../middleware/errorHandler.js';
import { downloadFromGCSPath, getSignedReadUrl } from '../storageClient.js';

import type {
  RegenerateStudyCardAnswerAudioInput,
  StudyCardWithRelations,
  StudyMediaAccessResult,
} from './shared.js';
import {
  backfillImportedStudyMedia,
  buildStudyCardSearchText,
  ensureGeneratedAnswerAudio,
  findAccessibleLocalStudyMediaPath,
  getContentType,
  getPrivateStudyMediaRoot,
  getStudyAudioRedisClient,
  hasConfiguredStudyGcsStorage,
  pruneStudyMediaRedirectCache,
  resolveStudyMediaAbsolutePath,
  shouldMirrorStudyMediaLocally,
  STUDY_AUDIO_REPAIR_FAILURE_COOLDOWN_MS,
  STUDY_MEDIA_SIGNED_URL_REFRESH_WINDOW_MS,
  STUDY_MEDIA_SIGNED_URL_TTL_SECONDS,
  studyMediaRedirectCache,
  toPrismaJson,
  toStudyCardSummary,
  normalizeStudyCardPayload,
} from './shared.js';

export { ensureGeneratedAnswerAudio, ensureStudyCardMediaAvailable } from './shared.js';

// Best-effort process-local shortcut; Redis is the authoritative cross-process cooldown.
const generatedAudioRepairFailureCooldowns = new Map<string, number>();

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

function pruneGeneratedAudioRepairCooldowns(nowMs: number = Date.now()) {
  for (const [mediaId, expiresAtMs] of generatedAudioRepairFailureCooldowns.entries()) {
    if (expiresAtMs <= nowMs) {
      generatedAudioRepairFailureCooldowns.delete(mediaId);
    }
  }
}

async function isGeneratedAudioRepairCoolingDown(mediaId: string): Promise<boolean> {
  const nowMs = Date.now();
  pruneGeneratedAudioRepairCooldowns(nowMs);
  const localCooldownExpiresAt = generatedAudioRepairFailureCooldowns.get(mediaId);
  if (localCooldownExpiresAt && localCooldownExpiresAt > nowMs) {
    return true;
  }

  try {
    const redis = getStudyAudioRedisClient();
    return Boolean(await redis.get(`study:answer-audio-repair-failed:${mediaId}`));
  } catch (error) {
    console.warn('[Study] Unable to read generated-audio repair cooldown:', error);
    return false;
  }
}

async function recordGeneratedAudioRepairFailure(mediaId: string): Promise<void> {
  const expiresAtMs = Date.now() + STUDY_AUDIO_REPAIR_FAILURE_COOLDOWN_MS;
  generatedAudioRepairFailureCooldowns.set(mediaId, expiresAtMs);
  pruneGeneratedAudioRepairCooldowns();

  try {
    const redis = getStudyAudioRedisClient();
    await redis.set(
      `study:answer-audio-repair-failed:${mediaId}`,
      '1',
      'PX',
      STUDY_AUDIO_REPAIR_FAILURE_COOLDOWN_MS
    );
  } catch (error) {
    console.warn('[Study] Unable to record generated-audio repair cooldown:', error);
  }
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

async function repairGeneratedAnswerAudioAccess(userId: string, mediaId: string): Promise<void> {
  if (await isGeneratedAudioRepairCoolingDown(mediaId)) {
    return;
  }

  const card = await prisma.studyCard.findFirst({
    where: {
      userId,
      answerAudioMediaId: mediaId,
      answerAudioSource: 'generated',
    },
    select: {
      id: true,
      answerAudioMediaId: true,
    },
  });

  if (!card) {
    return;
  }

  try {
    await ensureGeneratedAnswerAudio(userId, card.id, { force: true });
  } catch (error) {
    console.warn('[Study] Unable to repair generated answer audio:', error);
    await recordGeneratedAudioRepairFailure(mediaId);
  }
}

function scheduleGeneratedAnswerAudioRepair(userId: string, mediaId: string): void {
  void repairGeneratedAnswerAudioAccess(userId, mediaId).catch((error) => {
    console.warn('[Study] Unable to schedule generated answer-audio repair:', error);
  });
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

export async function regenerateStudyCardAnswerAudio(
  input: RegenerateStudyCardAnswerAudioInput
): Promise<StudyCardSummary> {
  const existing: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
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

  const normalized = await normalizeStudyCardPayload(existing);
  const nextAnswer: StudyAnswerPayload = {
    ...normalized.answer,
    ...(typeof input.answerAudioVoiceId !== 'undefined'
      ? { answerAudioVoiceId: input.answerAudioVoiceId }
      : {}),
    ...(typeof input.answerAudioTextOverride !== 'undefined'
      ? { answerAudioTextOverride: input.answerAudioTextOverride }
      : {}),
  };

  const updatedCardResult = await prisma.studyCard.updateMany({
    where: { id: input.cardId, userId: input.userId },
    data: {
      answerJson: toPrismaJson(nextAnswer),
      searchText: buildStudyCardSearchText({
        prompt: normalized.prompt,
        answer: nextAnswer,
      }),
    },
  });

  if (updatedCardResult.count !== 1) {
    throw new AppError('Study card not found.', 404);
  }

  // This synchronous regeneration lets the editor preview fresh audio immediately.
  // If synthesis fails, the saved voice/override remain but the previous audio stays playable.
  await ensureGeneratedAnswerAudio(input.userId, input.cardId, { force: true });

  const refreshed: StudyCardWithRelations | null = await prisma.studyCard.findFirst({
    where: {
      id: input.cardId,
      userId: input.userId,
    },
    include: {
      note: true,
      promptAudioMedia: true,
      answerAudioMedia: true,
      imageMedia: true,
    },
  });

  if (!refreshed) {
    throw new AppError('Study card not found after audio regeneration.', 404);
  }

  return await toStudyCardSummary(refreshed);
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

  if (media.sourceKind === 'generated' && media.mediaKind === 'audio') {
    scheduleGeneratedAnswerAudioRepair(userId, media.id);
  }

  return null;
}
