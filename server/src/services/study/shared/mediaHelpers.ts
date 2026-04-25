import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new.js';
import type { StudyAnswerPayload } from '@languageflow/shared/src/types.js';

import { createRedisConnection } from '../../../config/redis.js';
import { prisma } from '../../../db/client.js';
import { uploadBufferToGCSPath } from '../../storageClient.js';
import { synthesizeSpeech } from '../../ttsClient.js';

import { mergeStudyMediaRecord } from './cardMappers.js';
import { STUDY_AUDIO_LOCK_POLL_INTERVAL_MS, STUDY_AUDIO_LOCK_TTL_MS } from './constants.js';
import { isRecord, toPrismaJson } from './guards.js';
import { parsePersistedStudyMediaRecord } from './parsers.js';
import {
  findAccessibleLocalStudyMediaPath,
  findLocalAnkiMediaFile,
  getContentType,
  getPrivateStudyMediaRoot,
  getStudyMediaApiPath,
  hasConfiguredStudyGcsStorage,
  normalizeFilename,
  pruneStudyMediaRedirectCache,
  sanitizePathSegment,
  studyMediaRedirectCache,
} from './paths.js';
import { getBestAnswerAudioText } from './time.js';
import type { PersistedStudyMediaRecord, StudyCardWithRelations } from './types.js';

const generatedAnswerAudioInFlight = new Map<
  string,
  {
    token: symbol;
    promise: Promise<void>;
  }
>();
// This only deduplicates answer-audio generation within the current server process.

let studyAudioRedisClient: ReturnType<typeof createRedisConnection> | null = null;

export function getStudyAudioRedisClient() {
  if (!studyAudioRedisClient) {
    studyAudioRedisClient = createRedisConnection();
  }

  return studyAudioRedisClient;
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

  if (process.env.GCS_BUCKET_NAME) {
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

  const absolutePath = path.join(getPrivateStudyMediaRoot(), storagePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    publicUrl: null,
    storagePath,
  };
}

export async function ensureGeneratedAnswerAudio(userId: string, cardId: string): Promise<void> {
  const lockKey = `study:answer-audio:${cardId}`;
  const lockToken = `${process.pid}:${randomUUID()}`;
  const waitDeadline = Date.now() + STUDY_AUDIO_LOCK_TTL_MS;

  const waitForGeneratedAudio = async () => {
    while (Date.now() < waitDeadline) {
      if (await hasPreparedAnswerAudio(userId, cardId)) {
        return true;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, STUDY_AUDIO_LOCK_POLL_INTERVAL_MS);
      });
    }

    return hasPreparedAnswerAudio(userId, cardId);
  };

  try {
    const redis = getStudyAudioRedisClient();
    const acquired = await redis.set(lockKey, lockToken, 'PX', STUDY_AUDIO_LOCK_TTL_MS, 'NX');

    if (acquired === 'OK') {
      let generatedLocally = false;
      try {
        await ensureGeneratedAnswerAudioLocally(userId, cardId);
        generatedLocally = true;
      } finally {
        try {
          const currentToken = await redis.get(lockKey);
          if (currentToken === lockToken) {
            await redis.del(lockKey);
          }
        } catch (releaseError) {
          console.warn('[Study] Failed to release answer-audio Redis lock.', releaseError);
        }
      }

      if (generatedLocally) {
        return;
      }
    }

    if (await waitForGeneratedAudio()) {
      return;
    }
  } catch (error) {
    console.warn(
      '[Study] Redis answer-audio dedupe unavailable; falling back to process-local lock.',
      error
    );

    if (await waitForGeneratedAudio()) {
      return;
    }
  }

  await ensureGeneratedAnswerAudioLocally(userId, cardId);
}

async function hasPreparedAnswerAudio(userId: string, cardId: string): Promise<boolean> {
  const card = await prisma.studyCard.findFirst({
    where: {
      id: cardId,
      userId,
    },
    select: {
      answerAudioSource: true,
      answerAudioMediaId: true,
      answerJson: true,
    },
  });

  if (!card) {
    return true;
  }

  const answer = isRecord(card.answerJson) ? { ...card.answerJson } : {};
  const existingAnswerAudio = isRecord(answer.answerAudio) ? answer.answerAudio : null;
  const hasPlayableAudio =
    existingAnswerAudio !== null &&
    typeof existingAnswerAudio === 'object' &&
    typeof existingAnswerAudio.url === 'string' &&
    existingAnswerAudio.url.length > 0;

  return (
    (String(card.answerAudioSource) !== 'missing' && hasPlayableAudio) ||
    Boolean(card.answerAudioMediaId)
  );
}

async function ensureGeneratedAnswerAudioLocally(userId: string, cardId: string): Promise<void> {
  const existingRequest = generatedAnswerAudioInFlight.get(cardId);
  if (existingRequest) {
    await existingRequest.promise;
    return;
  }

  const requestToken = Symbol(cardId);
  const generationRequest = (async () => {
    const card = await prisma.studyCard.findUnique({
      where: { id: cardId },
    });

    if (!card || card.userId !== userId) {
      return;
    }

    const answer: StudyAnswerPayload = isRecord(card.answerJson) ? { ...card.answerJson } : {};
    const existingAnswerAudio = answer.answerAudio;
    const hasPlayableImportedAudio =
      existingAnswerAudio !== null &&
      typeof existingAnswerAudio === 'object' &&
      typeof existingAnswerAudio.url === 'string' &&
      existingAnswerAudio.url.length > 0;

    if (String(card.answerAudioSource) !== 'missing' && hasPlayableImportedAudio) {
      return;
    }

    const text = getBestAnswerAudioText(answer);
    if (!text) {
      return;
    }

    const audioBuffer = await synthesizeSpeech({
      text,
      voiceId: DEFAULT_NARRATOR_VOICES.ja,
      languageCode: 'ja-JP',
      speed: 1.0,
    });

    const filename = `${normalizeFilename(cardId)}.mp3`;
    const persisted = await persistStudyMediaBuffer({
      userId,
      importJobId: 'generated',
      filename,
      buffer: audioBuffer,
    });

    const mediaRecord = await prisma.studyMedia.create({
      data: {
        userId,
        sourceKind: 'generated',
        sourceFilename: filename,
        normalizedFilename: normalizeFilename(filename),
        mediaKind: 'audio',
        contentType: 'audio/mpeg',
        storagePath: persisted.storagePath,
        publicUrl: persisted.publicUrl,
      },
    });

    const nextAnswer: StudyAnswerPayload = {
      ...answer,
      answerAudio: {
        id: mediaRecord.id,
        filename,
        url: getStudyMediaApiPath(mediaRecord.id),
        mediaKind: 'audio',
        source: 'generated',
      },
    };

    await prisma.studyCard.update({
      where: { id: cardId },
      data: {
        answerJson: toPrismaJson(nextAnswer),
        answerAudioSource: 'generated',
        answerAudioMediaId: mediaRecord.id,
      },
    });
  })();

  const trackedRequest = generationRequest.finally(() => {
    const inFlight = generatedAnswerAudioInFlight.get(cardId);
    if (inFlight?.token === requestToken) {
      generatedAnswerAudioInFlight.delete(cardId);
    }
  });

  generatedAnswerAudioInFlight.set(cardId, {
    token: requestToken,
    promise: trackedRequest,
  });
  await trackedRequest;
}

export async function backfillImportedStudyMedia(
  media: PersistedStudyMediaRecord
): Promise<PersistedStudyMediaRecord | null> {
  if (
    media.sourceKind !== 'anki_import' ||
    !media.id ||
    !media.userId ||
    !media.sourceFilename ||
    (typeof media.publicUrl === 'string' && media.publicUrl.length > 0) ||
    (typeof media.storagePath === 'string' && media.storagePath.length > 0)
  ) {
    return media;
  }

  const localMediaFile = await findLocalAnkiMediaFile(media.sourceFilename);
  if (!localMediaFile) {
    return media;
  }

  const persisted = await persistStudyMediaBuffer({
    userId: media.userId,
    importJobId: media.importJobId ?? 'anki-local-media',
    filename: media.sourceFilename,
    buffer: await fs.readFile(localMediaFile),
  });

  return parsePersistedStudyMediaRecord(
    await prisma.studyMedia.update({
      where: { id: media.id },
      data: {
        storagePath: persisted.storagePath,
        publicUrl: persisted.publicUrl,
      },
    })
  );
}

export async function ensureStudyCardMediaAvailable(
  cards: StudyCardWithRelations[]
): Promise<void> {
  const mediaRecords = cards.flatMap((card) => {
    const collected: PersistedStudyMediaRecord[] = [];
    const promptAudioMedia = parsePersistedStudyMediaRecord(card.promptAudioMedia);
    if (promptAudioMedia) {
      collected.push(promptAudioMedia);
    }
    const answerAudioMedia = parsePersistedStudyMediaRecord(card.answerAudioMedia);
    if (answerAudioMedia) {
      collected.push(answerAudioMedia);
    }
    const imageMedia = parsePersistedStudyMediaRecord(card.imageMedia);
    if (imageMedia) {
      collected.push(imageMedia);
    }
    return collected;
  });

  const uniqueMedia = new Map<string, PersistedStudyMediaRecord>();
  for (const media of mediaRecords) {
    if (media.id && !uniqueMedia.has(media.id)) {
      uniqueMedia.set(media.id, media);
    }
  }

  await Promise.all(
    Array.from(uniqueMedia.values()).map(async (media) => {
      const updated = await backfillImportedStudyMedia(media);
      if (!updated) return;

      for (const card of cards) {
        if (isRecord(card.promptAudioMedia) && card.promptAudioMedia.id === media.id) {
          card.promptAudioMedia = mergeStudyMediaRecord(card.promptAudioMedia, updated);
        }
        if (isRecord(card.answerAudioMedia) && card.answerAudioMedia.id === media.id) {
          card.answerAudioMedia = mergeStudyMediaRecord(card.answerAudioMedia, updated);
        }
        if (isRecord(card.imageMedia) && card.imageMedia.id === media.id) {
          card.imageMedia = mergeStudyMediaRecord(card.imageMedia, updated);
        }
      }
    })
  );
}

export {
  findAccessibleLocalStudyMediaPath,
  getContentType,
  hasConfiguredStudyGcsStorage,
  pruneStudyMediaRedirectCache,
  studyMediaRedirectCache,
};
