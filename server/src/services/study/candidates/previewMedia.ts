import { randomUUID } from 'node:crypto';

import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new.js';
import type {
  StudyCardCandidate,
  StudyCardCandidateCommitItem,
  StudyMediaRef,
} from '@languageflow/shared/src/types.js';
import { getLanguageCodeFromVoiceId } from '@languageflow/shared/src/voiceSelection.js';
import sharp from 'sharp';

import { prisma } from '../../../db/client.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { synthesizeBatchedTexts } from '../../batchedTTSClient.js';
import { generateOpenAIImageBuffer } from '../../openAIClient.js';
import { persistStudyMediaBuffer } from '../shared/mediaHelpers.js';
import {
  deletePersistedStudyMediaByStoragePath,
  getStudyMediaApiPath,
  normalizeFilename,
} from '../shared/paths.js';
import { getBestAnswerAudioText } from '../shared/time.js';

import {
  STUDY_CANDIDATE_PREVIEW_IMPORT_JOB_ID,
  STUDY_CANDIDATE_PREVIEW_SOURCE_KIND,
} from './constants.js';

const STUDY_CANDIDATE_IMAGE_CONTENT_TYPE = 'image/webp';
const STUDY_CANDIDATE_IMAGE_EXTENSION = 'webp';
const STUDY_CANDIDATE_IMAGE_WEBP_QUALITY = 82;

function toCandidateFilename(clientId: string, extension: string): string {
  const normalizedClientId = normalizeFilename(clientId) || 'candidate';
  return `${normalizedClientId}-${randomUUID()}.${extension}`;
}

async function createPreviewMedia(input: {
  userId: string;
  clientId: string;
  mediaKind: 'audio' | 'image';
  contentType: string;
  extension: string;
  buffer: Buffer;
}): Promise<StudyMediaRef> {
  const filename = toCandidateFilename(input.clientId, input.extension);
  const persisted = await persistStudyMediaBuffer({
    userId: input.userId,
    importJobId: STUDY_CANDIDATE_PREVIEW_IMPORT_JOB_ID,
    filename,
    buffer: input.buffer,
  });

  let media: Awaited<ReturnType<typeof prisma.studyMedia.create>>;
  try {
    media = await prisma.studyMedia.create({
      data: {
        userId: input.userId,
        sourceKind: STUDY_CANDIDATE_PREVIEW_SOURCE_KIND,
        sourceFilename: filename,
        normalizedFilename: normalizeFilename(filename),
        mediaKind: input.mediaKind,
        contentType: input.contentType,
        storagePath: persisted.storagePath,
        publicUrl: persisted.publicUrl,
      },
    });
  } catch (error) {
    await deletePersistedStudyMediaByStoragePath(persisted.storagePath);
    throw error;
  }

  return {
    id: media.id,
    filename,
    url: getStudyMediaApiPath(media.id),
    mediaKind: input.mediaKind,
    source: 'generated',
  };
}

export function getCandidatePreviewAudioText(
  candidate: StudyCardCandidate | StudyCardCandidateCommitItem
): string | null {
  if (candidate.candidateKind === 'audio-recognition') {
    return (
      candidate.answer.answerAudioTextOverride ??
      candidate.answer.expressionReading ??
      candidate.answer.expression ??
      null
    );
  }

  return getBestAnswerAudioText(candidate.answer);
}

export async function synthesizeCandidatePreviewAudio(
  userId: string,
  candidate: Pick<
    StudyCardCandidate,
    'clientId' | 'candidateKind' | 'cardType' | 'prompt' | 'answer' | 'rationale'
  >
): Promise<StudyMediaRef | null> {
  const text = getCandidatePreviewAudioText(candidate);
  if (!text) return null;

  const voiceId = candidate.answer.answerAudioVoiceId ?? DEFAULT_NARRATOR_VOICES.ja;
  const [audioBuffer] = await synthesizeBatchedTexts([text], {
    voiceId,
    languageCode: getLanguageCodeFromVoiceId(voiceId),
    speed: 1.0,
  });

  if (!audioBuffer) {
    throw new Error('TTS preview returned no audio.');
  }

  return createPreviewMedia({
    userId,
    clientId: candidate.clientId,
    mediaKind: 'audio',
    contentType: 'audio/mpeg',
    extension: 'mp3',
    buffer: audioBuffer,
  });
}

export async function generateCandidatePreviewImage(input: {
  userId: string;
  clientId: string;
  imagePrompt: string;
}): Promise<StudyMediaRef> {
  const { buffer } = await generateOpenAIImageBuffer(input.imagePrompt);
  const webpBuffer = await sharp(buffer)
    .webp({ quality: STUDY_CANDIDATE_IMAGE_WEBP_QUALITY })
    .toBuffer();

  return createPreviewMedia({
    userId: input.userId,
    clientId: input.clientId,
    mediaKind: 'image',
    contentType: STUDY_CANDIDATE_IMAGE_CONTENT_TYPE,
    extension: STUDY_CANDIDATE_IMAGE_EXTENSION,
    buffer: webpBuffer,
  });
}

export async function addPreviewAudio(
  userId: string,
  candidate: StudyCardCandidate
): Promise<StudyCardCandidate> {
  try {
    const previewAudio = await synthesizeCandidatePreviewAudio(userId, candidate);
    if (!previewAudio) {
      return {
        ...candidate,
        warnings: [...(candidate.warnings ?? []), 'No audio text was available for preview.'],
      };
    }

    if (candidate.candidateKind === 'audio-recognition') {
      return {
        ...candidate,
        prompt: {
          ...candidate.prompt,
          cueAudio: previewAudio,
        },
        previewAudio,
        previewAudioRole: 'prompt',
      };
    }

    return {
      ...candidate,
      answer: {
        ...candidate.answer,
        answerAudio: previewAudio,
      },
      previewAudio,
      previewAudioRole: 'answer',
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[Study candidates] Failed to generate preview audio.', error);
    return {
      ...candidate,
      warnings: [...(candidate.warnings ?? []), 'Audio preview could not be generated.'],
    };
  }
}

export async function getOwnedPreviewMediaIds(input: {
  userId: string;
  mediaIds: string[];
  mediaKind: 'audio' | 'image';
  errorMessage: string;
}): Promise<Set<string>> {
  const uniqueMediaIds = [...new Set(input.mediaIds)];
  if (uniqueMediaIds.length === 0) return new Set();

  const media = await prisma.studyMedia.findMany({
    where: {
      id: { in: uniqueMediaIds },
      userId: input.userId,
      sourceKind: STUDY_CANDIDATE_PREVIEW_SOURCE_KIND,
      mediaKind: input.mediaKind,
    },
    select: {
      id: true,
    },
  });
  const ownedMediaIds = new Set(media.map((item) => item.id));

  if (uniqueMediaIds.some((mediaId) => !ownedMediaIds.has(mediaId))) {
    throw new AppError(input.errorMessage, 400);
  }

  return ownedMediaIds;
}
