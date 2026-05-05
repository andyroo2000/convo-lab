import { randomUUID } from 'node:crypto';

import { selectManualStudyCardDefaultVoiceId } from '@languageflow/shared/src/constants-new.js';
import {
  normalizeClozePayloadFields,
  normalizeLooseClozeText,
} from '@languageflow/shared/src/studyCloze.js';
import { STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH } from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyAnswerPayload,
  StudyCardCandidateKind,
  StudyCardCreationKind,
  StudyCardDraftCompleteRequest,
  StudyCardDraftCompleteResponse,
  StudyCardDraftImageResponse,
  StudyCardImagePlacement,
  StudyCardType,
  StudyMediaRef,
  StudyPromptPayload,
} from '@languageflow/shared/src/types.js';

import { AppError } from '../../middleware/errorHandler.js';
import { IMAGE_PROMPT_IMMERSION_GUIDANCE, IMAGE_PROMPT_STYLE } from '../imagePromptGuidance.js';
import { generateStudyCardCandidateJson } from '../llmClient.js';
import { createStudyCard } from '../studySchedulerService.js';

import {
  generateCandidatePreviewImage,
  getOwnedPreviewMediaIds,
  synthesizeCandidatePreviewAudio,
} from './candidates/previewMedia.js';
import {
  cardTypeForStudyCardCreationKind,
  STUDY_CARD_CREATION_KINDS,
  STUDY_CARD_IMAGE_PLACEMENTS,
} from './shared.js';

type JsonRecord = Record<string, unknown>;
type StudyPromptTextKey =
  | 'cueText'
  | 'cueReading'
  | 'cueMeaning'
  | 'clozeText'
  | 'clozeHint'
  | 'clozeDisplayText'
  | 'clozeAnswerText'
  | 'clozeResolvedHint';
type StudyAnswerTextKey =
  | 'expression'
  | 'expressionReading'
  | 'meaning'
  | 'notes'
  | 'sentenceJp'
  | 'sentenceJpKana'
  | 'sentenceEn'
  | 'restoredText'
  | 'restoredTextReading'
  | 'answerAudioVoiceId'
  | 'answerAudioTextOverride';

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stripJsonFromResponse(response: string): string {
  const trimmed = response.trim();
  if (!trimmed.includes('```')) return trimmed;
  return trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)?.[1]?.trim() ?? trimmed;
}

export function getBestManualCardAudioText(answer: StudyAnswerPayload): string | null {
  return (
    parseNullableString(answer.answerAudioTextOverride) ??
    parseNullableString(answer.expression) ??
    parseNullableString(answer.expressionReading) ??
    parseNullableString(answer.restoredText) ??
    parseNullableString(answer.restoredTextReading)
  );
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mergeBlankPromptPayload(
  current: StudyPromptPayload,
  completion: StudyPromptPayload
): StudyPromptPayload {
  const next = { ...current };
  const keys: StudyPromptTextKey[] = [
    'cueText',
    'cueReading',
    'cueMeaning',
    'clozeText',
    'clozeHint',
    'clozeDisplayText',
    'clozeAnswerText',
    'clozeResolvedHint',
  ];

  for (const key of keys) {
    if (!hasText(next[key]) && hasText(completion[key])) {
      next[key] = completion[key];
    }
  }

  next.clozeText = normalizeLooseClozeText(next.clozeText);

  return next;
}

function mergeBlankAnswerPayload(
  current: StudyAnswerPayload,
  completion: StudyAnswerPayload
): StudyAnswerPayload {
  const next = { ...current };
  const keys: StudyAnswerTextKey[] = [
    'expression',
    'expressionReading',
    'meaning',
    'notes',
    'sentenceJp',
    'sentenceJpKana',
    'sentenceEn',
    'restoredText',
    'restoredTextReading',
    'answerAudioVoiceId',
    'answerAudioTextOverride',
  ];

  for (const key of keys) {
    if (!hasText(next[key]) && hasText(completion[key])) {
      next[key] = completion[key];
    }
  }

  return next;
}

function sanitizePromptPayload(value: unknown): StudyPromptPayload {
  if (!isRecord(value)) return {};
  return {
    cueText: parseNullableString(value.cueText),
    cueReading: parseNullableString(value.cueReading),
    cueMeaning: parseNullableString(value.cueMeaning),
    clozeText: normalizeLooseClozeText(parseNullableString(value.clozeText)),
    clozeHint: parseNullableString(value.clozeHint),
    clozeDisplayText: parseNullableString(value.clozeDisplayText),
    clozeAnswerText: parseNullableString(value.clozeAnswerText),
    clozeResolvedHint: parseNullableString(value.clozeResolvedHint),
  };
}

function sanitizeAnswerPayload(value: unknown): StudyAnswerPayload {
  if (!isRecord(value)) return {};
  return {
    expression: parseNullableString(value.expression),
    expressionReading: parseNullableString(value.expressionReading),
    meaning: parseNullableString(value.meaning),
    notes: parseNullableString(value.notes),
    sentenceJp: parseNullableString(value.sentenceJp),
    sentenceJpKana: parseNullableString(value.sentenceJpKana),
    sentenceEn: parseNullableString(value.sentenceEn),
    restoredText: parseNullableString(value.restoredText),
    restoredTextReading: parseNullableString(value.restoredTextReading),
    answerAudioVoiceId: parseNullableString(value.answerAudioVoiceId),
    answerAudioTextOverride: parseNullableString(value.answerAudioTextOverride),
  };
}

function buildManualDraftSystemInstruction(input: {
  creationKind: StudyCardCreationKind;
  imageTreatment: string;
}): string {
  return `Complete one Japanese study card draft for ConvoLab.

Return strict JSON only:
{
  "prompt": {},
  "answer": {},
  "imagePrompt": "editable image prompt or null"
}

Rules:
- Preserve user-provided meaning and intent from the JSON payload.
- Fill missing fields for creationKind "${input.creationKind}".
- Text recognition asks natural Japanese text on the front and English meaning on the back.
- Audio recognition stores the Japanese in answer.expression; the server will make front audio.
- Production from text asks English/context on the front and Japanese on the back.
- Production from image should create an image prompt for the front visual cue.
- Cloze uses prompt.clozeText with {{c1::...}} markup and answer.restoredText as the full sentence.
- If cloze text uses bracket notation like My [example] sentence, convert the bracketed span to {{c1::example}}.
- Use bracket ruby readings like 会社[かいしゃ] in reading fields.
- Include concise notes when useful.
- Always return imagePrompt when the card has enough concrete visual context. Use this style treatment when writing it: ${input.imageTreatment}.
- ${IMAGE_PROMPT_IMMERSION_GUIDANCE}
- Image prompts must describe a scene only and include "No text". Never ask for visible labels, captions, signs, words, or flashcard UI.`;
}

function buildManualDraftUserPrompt(input: StudyCardDraftCompleteRequest): string {
  return JSON.stringify(
    {
      creationKind: input.creationKind,
      cardType: input.cardType,
      imagePlacement: input.imagePlacement ?? 'none',
      imagePrompt: input.imagePrompt?.trim() || null,
      prompt: input.prompt,
      answer: input.answer,
    },
    null,
    2
  );
}

function parseManualDraftResponse(response: string): {
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  imagePrompt: string | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFromResponse(response));
  } catch (error) {
    console.warn('[Study manual draft] Failed to parse LLM JSON response.', error);
    throw new AppError('Could not fill the card from that input. Please try again.', 502);
  }

  if (!isRecord(parsed)) {
    throw new AppError('Could not fill the card from that input. Please try again.', 502);
  }

  return {
    prompt: sanitizePromptPayload(parsed.prompt),
    answer: sanitizeAnswerPayload(parsed.answer),
    imagePrompt:
      parseNullableString(parsed.imagePrompt)?.slice(0, STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH) ??
      null,
  };
}

function getImagePromptFallback(input: {
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  imageTreatment: string;
}): string | null {
  const subject =
    input.answer.expression ??
    input.answer.restoredText ??
    input.answer.meaning ??
    input.prompt.cueText ??
    input.prompt.cueMeaning ??
    input.prompt.clozeText ??
    null;
  if (!subject) return null;
  return `A ${input.imageTreatment} representing ${subject}. ${IMAGE_PROMPT_IMMERSION_GUIDANCE} No text.`;
}

function assertCreationKindMatchesCardType(
  creationKind: StudyCardCreationKind,
  cardType: StudyCardType
): void {
  const expected = cardTypeForStudyCardCreationKind(creationKind);
  if (cardType !== expected) {
    throw new AppError('cardType must match creationKind.', 400);
  }
}

function candidateKindForManualCreationKind(
  creationKind: StudyCardCreationKind
): StudyCardCandidateKind {
  if (creationKind === 'production-text' || creationKind === 'production-image') {
    return 'production';
  }
  return creationKind;
}

async function synthesizeManualDraftPreviewAudio(input: {
  userId: string;
  creationKind: StudyCardCreationKind;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}): Promise<{
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  previewAudio: StudyMediaRef | null;
  previewAudioRole: 'prompt' | 'answer' | null;
}> {
  const candidateKind = candidateKindForManualCreationKind(input.creationKind);
  try {
    const previewAudio = await synthesizeCandidatePreviewAudio(input.userId, {
      clientId: `manual-draft-audio-${randomUUID()}`,
      candidateKind,
      cardType: input.cardType,
      prompt: input.prompt,
      answer: input.answer,
      rationale: 'Generated manual draft preview audio.',
    });

    if (!previewAudio) {
      return {
        prompt: input.prompt,
        answer: input.answer,
        previewAudio: null,
        previewAudioRole: null,
      };
    }

    if (candidateKind === 'audio-recognition') {
      return {
        prompt: { ...input.prompt, cueAudio: previewAudio },
        answer: { ...input.answer, answerAudio: previewAudio },
        previewAudio,
        previewAudioRole: 'prompt',
      };
    }

    return {
      prompt: input.prompt,
      answer: { ...input.answer, answerAudio: previewAudio },
      previewAudio,
      previewAudioRole: 'answer',
    };
  } catch (error) {
    console.warn('[Study manual draft] Failed to generate preview audio.', error);
    return {
      prompt: input.prompt,
      answer: input.answer,
      previewAudio: null,
      previewAudioRole: null,
    };
  }
}

export async function generateManualStudyCardDraftImage(input: {
  userId: string;
  imagePrompt: string;
  imagePlacement: StudyCardImagePlacement;
}): Promise<StudyCardDraftImageResponse> {
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
  if (input.imagePlacement === 'none') {
    throw new AppError('imagePlacement must be prompt, answer, or both.', 400);
  }

  return {
    previewImage: await generateCandidatePreviewImage({
      userId: input.userId,
      clientId: `manual-draft-${randomUUID()}`,
      imagePrompt,
    }),
    imagePrompt,
    imagePlacement: input.imagePlacement,
  };
}

export async function completeManualStudyCardDraft(input: {
  userId: string;
  request: StudyCardDraftCompleteRequest;
}): Promise<StudyCardDraftCompleteResponse> {
  const { request } = input;
  if (!STUDY_CARD_CREATION_KINDS.has(request.creationKind)) {
    throw new AppError('creationKind is not supported.', 400);
  }
  assertCreationKindMatchesCardType(request.creationKind, request.cardType);

  const requestedPlacement = request.imagePlacement ?? 'none';
  if (!STUDY_CARD_IMAGE_PLACEMENTS.has(requestedPlacement)) {
    throw new AppError('imagePlacement is not supported.', 400);
  }
  const imagePlacement =
    request.creationKind === 'production-image' && requestedPlacement === 'none'
      ? 'prompt'
      : requestedPlacement;
  const imageTreatment = IMAGE_PROMPT_STYLE;
  const rawResponse = await generateStudyCardCandidateJson(
    buildManualDraftUserPrompt(request),
    buildManualDraftSystemInstruction({
      creationKind: request.creationKind,
      imageTreatment,
    })
  );
  const parsed = parseManualDraftResponse(rawResponse);
  let prompt: StudyPromptPayload = mergeBlankPromptPayload(request.prompt, parsed.prompt);
  const mergedAnswer = mergeBlankAnswerPayload(request.answer, parsed.answer);
  let answer: StudyAnswerPayload = {
    ...mergedAnswer,
    answerAudioVoiceId: mergedAnswer.answerAudioVoiceId ?? selectManualStudyCardDefaultVoiceId(),
  };
  if (request.cardType === 'cloze') {
    const normalized = normalizeClozePayloadFields(prompt, answer);
    prompt = normalized.prompt;
    answer = normalized.answer;
  }
  let imagePrompt =
    request.imagePrompt?.trim() ||
    parsed.imagePrompt ||
    getImagePromptFallback({ prompt, answer, imageTreatment });

  if (imagePrompt && imagePrompt.length > STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH) {
    imagePrompt = imagePrompt.slice(0, STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH);
  }

  const preview =
    request.creationKind === 'production-image' && imagePrompt
      ? await generateManualStudyCardDraftImage({
          userId: input.userId,
          imagePrompt,
          imagePlacement,
        })
      : null;
  const audioPreview = await synthesizeManualDraftPreviewAudio({
    userId: input.userId,
    creationKind: request.creationKind,
    cardType: request.cardType,
    prompt,
    answer,
  });

  return {
    creationKind: request.creationKind,
    cardType: request.cardType,
    prompt: audioPreview.prompt,
    answer: audioPreview.answer,
    imagePlacement,
    imagePrompt,
    previewAudio: audioPreview.previewAudio,
    previewAudioRole: audioPreview.previewAudioRole,
    previewImage: preview?.previewImage ?? null,
  };
}

async function resolveManualAudioMedia(input: {
  userId: string;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}): Promise<{ mediaId: string; mediaRef: StudyMediaRef } | null> {
  const mediaRefs = [input.prompt.cueAudio ?? null, input.answer.answerAudio ?? null].filter(
    (value): value is StudyMediaRef => Boolean(value?.id)
  );
  const uniqueMediaIds = [
    ...new Set(mediaRefs.map((media) => media.id).filter((id): id is string => Boolean(id))),
  ];
  if (uniqueMediaIds.length === 0) return null;
  if (uniqueMediaIds.length > 1) {
    throw new AppError('Only one generated audio preview can be attached to a study card.', 400);
  }

  const owned = await getOwnedPreviewMediaIds({
    userId: input.userId,
    mediaIds: uniqueMediaIds,
    mediaKind: 'audio',
    errorMessage: 'Preview audio was not found for this user.',
  });

  const mediaId = uniqueMediaIds[0];
  if (!mediaId) return null;
  if (!owned.has(mediaId)) {
    throw new AppError('Preview audio was not found for this user.', 400);
  }
  const mediaRef = mediaRefs.find((media) => media.id === mediaId);
  if (!mediaRef) {
    throw new AppError('Preview audio was not found for this user.', 400);
  }

  return {
    mediaId,
    mediaRef,
  };
}

async function resolveManualImageMediaId(input: {
  userId: string;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}): Promise<string | null> {
  const mediaIds = [input.prompt.cueImage?.id ?? null, input.answer.answerImage?.id ?? null].filter(
    (value): value is string => Boolean(value)
  );
  const uniqueMediaIds = [...new Set(mediaIds)];
  if (uniqueMediaIds.length === 0) return null;
  if (uniqueMediaIds.length > 1) {
    throw new AppError('Only one generated image can be attached to a study card.', 400);
  }

  const owned = await getOwnedPreviewMediaIds({
    userId: input.userId,
    mediaIds: uniqueMediaIds,
    mediaKind: 'image',
    errorMessage: 'Preview image was not found for this user.',
  });

  if (!owned.has(uniqueMediaIds[0])) {
    throw new AppError('Preview image was not found for this user.', 400);
  }

  return uniqueMediaIds[0];
}

export async function createManualStudyCard(input: {
  userId: string;
  creationKind: StudyCardCreationKind;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}) {
  if (!STUDY_CARD_CREATION_KINDS.has(input.creationKind)) {
    throw new AppError('creationKind is not supported.', 400);
  }
  assertCreationKindMatchesCardType(input.creationKind, input.cardType);

  let prompt = input.prompt;
  let answer: StudyAnswerPayload = {
    ...input.answer,
    answerAudioVoiceId: input.answer.answerAudioVoiceId ?? selectManualStudyCardDefaultVoiceId(),
  };
  let promptAudioMediaId: string | null = null;
  let answerAudioMediaId: string | null = null;
  const previewAudio = await resolveManualAudioMedia({
    userId: input.userId,
    prompt,
    answer,
  });

  if (input.creationKind === 'audio-recognition') {
    if (previewAudio) {
      prompt = { cueAudio: previewAudio.mediaRef };
      answer = { ...answer, answerAudio: previewAudio.mediaRef };
      promptAudioMediaId = previewAudio.mediaId;
      answerAudioMediaId = previewAudio.mediaId;
    } else {
      const generated = await synthesizeCandidatePreviewAudio(input.userId, {
        clientId: `manual-audio-${randomUUID()}`,
        candidateKind: 'audio-recognition',
        cardType: 'recognition',
        prompt,
        answer,
        rationale: 'Generated manual listening prompt audio.',
      });
      if (!generated?.id) {
        throw new AppError('Could not generate audio for this card.', 502);
      }
      prompt = { cueAudio: generated };
      answer = { ...answer, answerAudio: generated };
      promptAudioMediaId = generated.id;
      answerAudioMediaId = generated.id;
    }
  } else if (previewAudio) {
    answer = { ...answer, answerAudio: previewAudio.mediaRef };
    answerAudioMediaId = previewAudio.mediaId;
  }

  const imageMediaId = await resolveManualImageMediaId({
    userId: input.userId,
    prompt,
    answer,
  });

  return createStudyCard({
    userId: input.userId,
    cardType: input.cardType,
    prompt,
    answer,
    promptAudioMediaId,
    answerAudioMediaId,
    imageMediaId,
  });
}
