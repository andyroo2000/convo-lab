import { randomUUID } from 'node:crypto';

import { STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH } from '@languageflow/shared/src/studyConstants.js';
import type { StudyCardSummary, StudyMediaRef } from '@languageflow/shared/src/types.js';
import sharp from 'sharp';

import { prisma } from '../../db/client.js';
import { AppError } from '../../middleware/errorHandler.js';
import { generateOpenAIImageBuffer } from '../openAIClient.js';

import { applyStudyImagePromptGuardrails } from './candidates/imagePromptGuardrails.js';
import type { StudyCardWithRelations, StudyMediaRecord } from './shared.js';
import {
  buildStudyCardSearchText,
  deletePersistedStudyMediaByStoragePath,
  getStudyMediaApiPath,
  normalizeFilename,
  normalizeStudyCardPayload,
  persistStudyMediaBuffer,
  STUDY_GENERATED_IMPORT_JOB_ID,
  toPrismaJson,
  toStudyCardSummary,
} from './shared.js';

const STUDY_CARD_IMAGE_CONTENT_TYPE = 'image/webp';
const STUDY_CARD_IMAGE_EXTENSION = 'webp';
const STUDY_CARD_IMAGE_WEBP_QUALITY = 82;
const STUDY_CARD_SUPPORTED_INPUT_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
type GeneratedStudyImageMediaRef = StudyMediaRef & { id: string };

function shouldDeleteReplacedGeneratedImageMedia(
  media: StudyMediaRecord | null,
  replacementImageId: string
): media is StudyMediaRecord & { storagePath: string } {
  return Boolean(
    media &&
    media.id !== replacementImageId &&
    media.sourceKind === 'generated' &&
    media.mediaKind === 'image' &&
    media.storagePath
  );
}

async function cleanupReplacedGeneratedImageMedia(input: {
  media: StudyMediaRecord | null;
  replacementImageId: string;
}): Promise<void> {
  if (!shouldDeleteReplacedGeneratedImageMedia(input.media, input.replacementImageId)) {
    return;
  }

  try {
    await prisma.studyMedia.deleteMany({ where: { id: input.media.id } });
    await deletePersistedStudyMediaByStoragePath(input.media.storagePath);
  } catch (error) {
    console.warn('[Study] Unable to clean up replaced generated card image media.', error);
  }
}

async function generateStudyCardImageMedia(input: {
  userId: string;
  cardId: string;
  imagePrompt: string;
}): Promise<GeneratedStudyImageMediaRef> {
  const { buffer, contentType: openAIContentType } = await generateOpenAIImageBuffer(
    applyStudyImagePromptGuardrails(input.imagePrompt)
  );
  if (!STUDY_CARD_SUPPORTED_INPUT_IMAGE_CONTENT_TYPES.has(openAIContentType)) {
    throw new AppError('OpenAI returned an unsupported image format.', 502);
  }

  const webpBuffer = await sharp(buffer)
    .webp({ quality: STUDY_CARD_IMAGE_WEBP_QUALITY })
    .toBuffer();
  const filename = `${normalizeFilename(input.cardId) || 'card'}-${randomUUID()}.${STUDY_CARD_IMAGE_EXTENSION}`;
  const persisted = await persistStudyMediaBuffer({
    userId: input.userId,
    importJobId: STUDY_GENERATED_IMPORT_JOB_ID,
    filename,
    buffer: webpBuffer,
  });

  try {
    const media = await prisma.studyMedia.create({
      data: {
        userId: input.userId,
        sourceKind: 'generated',
        sourceFilename: filename,
        normalizedFilename: normalizeFilename(filename),
        mediaKind: 'image',
        contentType: STUDY_CARD_IMAGE_CONTENT_TYPE,
        storagePath: persisted.storagePath,
        publicUrl: persisted.publicUrl,
      },
    });

    return {
      id: media.id,
      filename,
      url: getStudyMediaApiPath(media.id),
      mediaKind: 'image',
      source: 'generated',
    };
  } catch (error) {
    await deletePersistedStudyMediaByStoragePath(persisted.storagePath);
    throw error;
  }
}

export async function regenerateStudyCardImage(input: {
  userId: string;
  cardId: string;
  imagePrompt: string;
  imageRole: 'prompt' | 'answer' | 'both';
}): Promise<StudyCardSummary> {
  const imagePrompt = input.imagePrompt.trim();
  if (!imagePrompt) {
    throw new AppError('imagePrompt is required.', 400);
  }
  if (imagePrompt.length > STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH) {
    throw new AppError(
      `imagePrompt must be ${String(STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

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

  const image = await generateStudyCardImageMedia({
    userId: input.userId,
    cardId: input.cardId,
    imagePrompt,
  });
  const normalized = await normalizeStudyCardPayload(existing);
  const nextPrompt =
    input.imageRole === 'prompt' || input.imageRole === 'both'
      ? { ...normalized.prompt, cueImage: image }
      : normalized.prompt;
  const nextAnswer =
    input.imageRole === 'answer' || input.imageRole === 'both'
      ? { ...normalized.answer, answerImage: image }
      : normalized.answer;

  // Cards keep one denormalized imageMediaId used by the mappers to hydrate whichever side
  // currently owns the card image.
  const updatedCardResult = await prisma.studyCard.updateMany({
    where: { id: input.cardId, userId: input.userId },
    data: {
      promptJson: toPrismaJson(nextPrompt),
      answerJson: toPrismaJson(nextAnswer),
      imageMediaId: image.id,
      searchText: buildStudyCardSearchText({ prompt: nextPrompt, answer: nextAnswer }),
    },
  });
  if (updatedCardResult.count !== 1) {
    throw new AppError('Study card not found.', 404);
  }

  await cleanupReplacedGeneratedImageMedia({
    media: existing.imageMedia,
    replacementImageId: image.id,
  });

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
    throw new AppError('Study card not found after image regeneration.', 404);
  }

  return await toStudyCardSummary(refreshed);
}
