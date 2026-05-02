import { randomUUID } from 'crypto';

import { DEFAULT_NARRATOR_VOICES, TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import {
  STUDY_CANDIDATE_COMMIT_MAX_COUNT,
  STUDY_CANDIDATE_IMAGE_GENERATE_MAX_COUNT,
  STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH,
  STUDY_CANDIDATE_VISUAL_POS_LABELS_JA,
} from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyAnswerPayload,
  StudyCardCandidate,
  StudyCardCandidateCommitItem,
  StudyCardCandidateCommitResponse,
  StudyCardCandidateGenerateRequest,
  StudyCardCandidateGenerateResponse,
  StudyCardCandidateKind,
  StudyCardCandidatePreviewAudioResponse,
  StudyCardCandidatePreviewImageResponse,
  StudyPromptPayload,
} from '@languageflow/shared/src/types.js';

import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

import { addFuriganaBrackets } from './furiganaService.js';
import { generateStudyCardCandidateJson } from './llmClient.js';
import {
  STUDY_CANDIDATE_GENERATE_MAX_COUNT,
  STUDY_CANDIDATE_LEARNER_CONTEXT_LIMIT,
} from './study/candidates/constants.js';
import { scheduleStudyCandidatePreviewMediaCleanup } from './study/candidates/mediaCleanup.js';
import {
  addPreviewAudio,
  addPreviewImage,
  generateCandidatePreviewImage,
  getCandidatePreviewAudioText,
  getOwnedPreviewMediaIds,
  synthesizeCandidatePreviewAudio,
} from './study/candidates/previewMedia.js';
import {
  buildCandidateSystemInstruction,
  buildCandidateUserPrompt,
} from './study/candidates/promptBuilder.js';
import { cardTypeForStudyCardCandidateKind, STUDY_CARD_CANDIDATE_KINDS } from './study/shared.js';
import { createStudyCard } from './studySchedulerService.js';

const STUDY_JA_TTS_VOICE_IDS = new Set<string>(TTS_VOICES.ja.voices.map((voice) => voice.id));
const STUDY_CANDIDATE_RANDOM_FISH_AUDIO_VOICE_IDS = new Set([
  'fishaudio:875668667eb94c20b09856b971d9ca2f', // Sample - Calm narrator
  'fishaudio:abb4362e736f40b7b5716f4fafcafa9f', // Watashi no Boisu - Warm and gentle
  'fishaudio:351aa1e3ef354082bc1f4294d4eea5d0', // Ken Mama - Soft and intimate
]);
const STUDY_JA_CANDIDATE_RANDOM_VOICE_IDS = TTS_VOICES.ja.voices
  .filter(
    (voice) =>
      voice.provider === 'fishaudio' && STUDY_CANDIDATE_RANDOM_FISH_AUDIO_VOICE_IDS.has(voice.id)
  )
  .map((voice) => voice.id);
const STUDY_CANDIDATE_VISUAL_POS_JA = new Set<string>(STUDY_CANDIDATE_VISUAL_POS_LABELS_JA);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripJsonFromResponse(response: string): string {
  const trimmed = response.trim();
  if (!trimmed.includes('```')) {
    return trimmed;
  }

  const match = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  return match?.[1]?.trim() ?? trimmed;
}

function parseNullableString(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['「', '」'],
  ];
  const unquoted = quotePairs.reduce((current, [open, close]) => {
    if (current.length >= 2 && current.startsWith(open) && current.endsWith(close)) {
      return current.slice(1, -1).trim();
    }
    return current;
  }, trimmed);

  return unquoted || null;
}

function parseImagePrompt(raw: JsonRecord): string | null {
  const promptFromTopLevel = parseNullableString(raw.imagePrompt);
  const promptFromNested = isRecord(raw.prompt)
    ? parseNullableString(raw.prompt.imagePrompt)
    : undefined;
  const prompt = promptFromTopLevel ?? promptFromNested ?? null;
  if (!prompt) return null;

  return prompt.slice(0, STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH);
}

function parseVisualPartOfSpeech(rawPrompt: StudyPromptPayload, raw: JsonRecord): string | null {
  const explicitPartOfSpeech =
    parseNullableString(raw.partOfSpeechJa) ??
    (isRecord(raw.prompt) ? parseNullableString(raw.prompt.partOfSpeechJa) : undefined);
  const candidate = explicitPartOfSpeech ?? rawPrompt.cueMeaning ?? null;
  if (!candidate || !STUDY_CANDIDATE_VISUAL_POS_JA.has(candidate)) {
    return null;
  }

  return candidate;
}

function sanitizePromptPayload(value: unknown): StudyPromptPayload {
  if (!isRecord(value)) {
    throw new AppError('Generated candidate prompt must be an object.', 502);
  }

  return {
    cueText: parseNullableString(value.cueText),
    cueReading: parseNullableString(value.cueReading),
    cueMeaning: parseNullableString(value.cueMeaning),
    clozeText: parseNullableString(value.clozeText),
    clozeDisplayText: parseNullableString(value.clozeDisplayText),
    clozeAnswerText: parseNullableString(value.clozeAnswerText),
    clozeHint: parseNullableString(value.clozeHint),
    clozeResolvedHint: parseNullableString(value.clozeResolvedHint),
  };
}

function getRandomStudyCandidateVoiceId(): string {
  const voices =
    STUDY_JA_CANDIDATE_RANDOM_VOICE_IDS.length > 0
      ? STUDY_JA_CANDIDATE_RANDOM_VOICE_IDS
      : [DEFAULT_NARRATOR_VOICES.ja];
  const voice = voices[Math.floor(Math.random() * voices.length)];
  return voice ?? DEFAULT_NARRATOR_VOICES.ja;
}

function sanitizeAnswerPayload(value: unknown, generatedVoiceId: string): StudyAnswerPayload {
  if (!isRecord(value)) {
    throw new AppError('Generated candidate answer must be an object.', 502);
  }

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
    answerAudioVoiceId: STUDY_JA_TTS_VOICE_IDS.has(generatedVoiceId)
      ? generatedVoiceId
      : DEFAULT_NARRATOR_VOICES.ja,
    answerAudioTextOverride: parseNullableString(value.answerAudioTextOverride),
  };
}

function hydrateMissingPromptFields(candidate: StudyCardCandidate): StudyCardCandidate {
  if (candidate.candidateKind === 'cloze') {
    return {
      ...candidate,
      prompt: {
        ...candidate.prompt,
        clozeHint: candidate.prompt.clozeHint ?? getFallbackClozeHint(candidate.prompt.clozeText),
      },
    };
  }

  if (candidate.candidateKind === 'text-recognition') {
    return {
      ...candidate,
      prompt: {
        ...candidate.prompt,
        cueText: candidate.prompt.cueText ?? candidate.answer.expression ?? null,
        cueReading: candidate.prompt.cueReading ?? candidate.answer.expressionReading ?? null,
      },
    };
  }

  if (candidate.candidateKind === 'production') {
    return {
      ...candidate,
      prompt: {
        ...candidate.prompt,
        cueMeaning: candidate.prompt.cueMeaning ?? candidate.answer.meaning ?? null,
      },
    };
  }

  return candidate;
}

function getFallbackClozeHint(clozeText: string | null | undefined): string {
  const hiddenText = clozeText?.match(/\{\{c1::([^}:]+)(?:::[^}]*)?}}/)?.[1]?.trim() ?? '';
  if (hiddenText && hiddenText.length <= 4 && !/[\u4e00-\u9faf]/.test(hiddenText)) {
    return 'Grammar or particle chunk';
  }

  return 'Missing Japanese expression';
}

function hydrateMissingNotes(candidate: StudyCardCandidate): StudyCardCandidate {
  if (candidate.answer.notes) {
    return candidate;
  }

  return {
    ...candidate,
    answer: {
      ...candidate.answer,
      notes: candidate.rationale,
    },
  };
}

async function getGeneratedReading(text: string | null | undefined): Promise<string | null> {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return addFuriganaBrackets(trimmed);
}

async function enrichCandidateReadings(candidate: StudyCardCandidate): Promise<StudyCardCandidate> {
  if (candidate.candidateKind === 'cloze') {
    if (candidate.answer.restoredTextReading || !candidate.answer.restoredText) {
      return candidate;
    }

    return {
      ...candidate,
      answer: {
        ...candidate.answer,
        restoredTextReading: await getGeneratedReading(candidate.answer.restoredText),
      },
    };
  }

  let promptReading = candidate.prompt.cueReading ?? null;
  if (!promptReading && candidate.prompt.cueText) {
    promptReading = await getGeneratedReading(candidate.prompt.cueText);
  }

  const answerReading =
    candidate.answer.expressionReading ??
    (candidate.prompt.cueText === candidate.answer.expression ? promptReading : null) ??
    (await getGeneratedReading(candidate.answer.expression));

  return {
    ...candidate,
    prompt: {
      ...candidate.prompt,
      cueReading: promptReading,
    },
    answer: {
      ...candidate.answer,
      expressionReading: answerReading,
    },
  };
}

function assertCandidateShape(candidate: StudyCardCandidate): void {
  if (candidate.candidateKind === 'cloze') {
    if (!candidate.prompt.clozeText?.includes('{{c1::')) {
      throw new AppError('Generated cloze candidates must include {{c1::...}} markup.', 502);
    }
    if (!candidate.answer.restoredText) {
      throw new AppError('Generated cloze candidates must include restored answer text.', 502);
    }
    return;
  }

  if (!candidate.answer.expression) {
    throw new AppError('Generated non-cloze candidates must include an answer expression.', 502);
  }

  if (candidate.candidateKind === 'audio-recognition') {
    return;
  }

  if (!candidate.prompt.cueText && !candidate.prompt.cueMeaning) {
    throw new AppError('Generated text candidates must include prompt text or meaning.', 502);
  }
}

function normalizeGeneratedCandidate(raw: unknown, index: number): StudyCardCandidate {
  if (!isRecord(raw)) {
    throw new AppError('Generated candidate must be an object.', 502);
  }

  const candidateKind = raw.candidateKind;
  if (
    typeof candidateKind !== 'string' ||
    !STUDY_CARD_CANDIDATE_KINDS.has(candidateKind as StudyCardCandidateKind)
  ) {
    throw new AppError('Generated candidate used an unsupported candidate kind.', 502);
  }

  const kind = candidateKind as StudyCardCandidateKind;
  const cardType = cardTypeForStudyCardCandidateKind(kind);
  const rawCardType = raw.cardType;
  if (typeof rawCardType === 'string' && rawCardType !== cardType) {
    throw new AppError('Generated candidate card type did not match its candidate kind.', 502);
  }

  const sanitizedPrompt = sanitizePromptPayload(raw.prompt);
  const imagePrompt = kind === 'production' ? parseImagePrompt(raw) : null;
  const visualPartOfSpeech = imagePrompt ? parseVisualPartOfSpeech(sanitizedPrompt, raw) : null;
  const candidateImagePrompt = visualPartOfSpeech ? imagePrompt : null;
  let candidate: StudyCardCandidate = {
    clientId:
      typeof raw.clientId === 'string' && raw.clientId.trim()
        ? raw.clientId.trim()
        : `candidate-${index + 1}-${randomUUID()}`,
    candidateKind: kind,
    cardType,
    prompt: {
      ...sanitizedPrompt,
      ...(visualPartOfSpeech ? { cueMeaning: visualPartOfSpeech } : {}),
    },
    answer: sanitizeAnswerPayload(raw.answer, getRandomStudyCandidateVoiceId()),
    rationale: parseNullableString(raw.rationale) ?? 'Generated from your prompt.',
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
    previewAudio: null,
    previewAudioRole: null,
    previewImage: null,
    imagePrompt: candidateImagePrompt,
  };

  if (candidate.candidateKind === 'audio-recognition') {
    candidate.prompt = {
      cueAudio: candidate.prompt.cueAudio ?? null,
      cueImage: candidate.prompt.cueImage ?? null,
    };
  } else {
    candidate = hydrateMissingPromptFields(candidate);
  }

  candidate = hydrateMissingNotes(candidate);

  assertCandidateShape(candidate);
  return candidate;
}

function parseCandidateResponse(response: string): StudyCardCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFromResponse(response));
  } catch (error) {
    console.warn('[Study candidates] Failed to parse LLM JSON response.', error);
    throw new AppError('Could not generate cards from that input. Please try again.', 502);
  }

  const rawCandidates = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.candidates)
      ? parsed.candidates
      : null;

  if (!rawCandidates || rawCandidates.length === 0) {
    throw new AppError('Could not generate cards from that input. Please try again.', 502);
  }

  return rawCandidates
    .slice(0, STUDY_CANDIDATE_GENERATE_MAX_COUNT)
    .map((candidate, index) => normalizeGeneratedCandidate(candidate, index));
}

function normalizeGenerateRequest(input: StudyCardCandidateGenerateRequest): {
  targetText: string;
  context: string;
  includeLearnerContext: boolean;
} {
  const targetText = input.targetText?.trim() ?? '';
  const context = input.context?.trim() ?? '';

  return {
    targetText,
    context,
    includeLearnerContext: input.includeLearnerContext !== false,
  };
}

function getRecordText(record: unknown): string | null {
  if (!isRecord(record)) return null;
  const text =
    parseNullableString(record.expression) ??
    parseNullableString(record.restoredText) ??
    parseNullableString(record.cueText) ??
    parseNullableString(record.clozeText);
  const meaning = parseNullableString(record.meaning) ?? parseNullableString(record.cueMeaning);
  return [text, meaning].filter(Boolean).join(' - ') || null;
}

async function buildLearnerContextSummary(userId: string): Promise<string | null> {
  try {
    const cards = await prisma.studyCard.findMany({
      where: {
        userId,
        queueState: {
          in: ['learning', 'relearning', 'review'],
        },
      },
      orderBy: [{ lastReviewedAt: 'desc' }, { updatedAt: 'desc' }],
      take: STUDY_CANDIDATE_LEARNER_CONTEXT_LIMIT,
      select: {
        cardType: true,
        queueState: true,
        promptJson: true,
        answerJson: true,
        sourceLapses: true,
      },
    });

    const lines = cards
      .map((card) => {
        const answerText = getRecordText(card.answerJson);
        const promptText = getRecordText(card.promptJson);
        const label = answerText ?? promptText;
        if (!label) return null;
        return `- ${card.cardType}/${card.queueState}${card.sourceLapses ? ` (${card.sourceLapses} lapses)` : ''}: ${label}`;
      })
      .filter((line): line is string => Boolean(line));

    return lines.length > 0 ? lines.join('\n') : null;
  } catch (error) {
    console.warn('[Study candidates] Learner context unavailable.', error);
    return null;
  }
}

export async function generateStudyCardCandidates(input: {
  userId: string;
  request: StudyCardCandidateGenerateRequest;
}): Promise<StudyCardCandidateGenerateResponse> {
  const request = normalizeGenerateRequest(input.request);
  void scheduleStudyCandidatePreviewMediaCleanup(input.userId);
  const learnerContextSummary = request.includeLearnerContext
    ? await buildLearnerContextSummary(input.userId)
    : null;

  const rawResponse = await generateStudyCardCandidateJson(
    buildCandidateUserPrompt({
      targetText: request.targetText,
      context: request.context,
      learnerContextSummary,
    }),
    buildCandidateSystemInstruction()
  );

  const candidates = await Promise.all(
    parseCandidateResponse(rawResponse).map((candidate) => enrichCandidateReadings(candidate))
  );
  let remainingImagePreviews = STUDY_CANDIDATE_IMAGE_GENERATE_MAX_COUNT;
  const withPreviewImages = await Promise.all(
    candidates.map((candidate) => {
      if (
        candidate.candidateKind !== 'production' ||
        !candidate.imagePrompt ||
        remainingImagePreviews <= 0
      ) {
        return candidate;
      }

      remainingImagePreviews -= 1;
      return addPreviewImage(input.userId, candidate);
    })
  );
  const withPreviewAudio = await Promise.all(
    withPreviewImages.map((candidate) => addPreviewAudio(input.userId, candidate))
  );

  return {
    candidates: withPreviewAudio,
    learnerContextSummary,
  };
}

type ResolvedStudyCardCandidateCommitItem = {
  item: StudyCardCandidateCommitItem;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  previewAudioId: string | null;
  previewAudioRole: 'prompt' | 'answer' | null;
  previewImageId: string | null;
};

async function resolveStudyCardCandidateCommitItem(input: {
  userId: string;
  item: StudyCardCandidateCommitItem;
}): Promise<ResolvedStudyCardCandidateCommitItem> {
  const { item } = input;
  if (!STUDY_CARD_CANDIDATE_KINDS.has(item.candidateKind)) {
    throw new AppError('candidateKind must be a supported generated card kind.', 400);
  }

  const expectedCardType = cardTypeForStudyCardCandidateKind(item.candidateKind);
  if (item.cardType !== expectedCardType) {
    throw new AppError('cardType does not match candidateKind.', 400);
  }

  let resolvedPrompt = item.prompt;
  let resolvedAnswer = item.answer;
  let resolvedPreviewAudio = item.previewAudio ?? null;
  let resolvedPreviewAudioRole = item.previewAudioRole;
  if (!resolvedPreviewAudio && getCandidatePreviewAudioText(item)) {
    const regeneratedPreview = await synthesizeCandidatePreviewAudio(input.userId, {
      clientId: item.clientId,
      candidateKind: item.candidateKind,
      cardType: item.cardType,
      prompt: resolvedPrompt,
      answer: resolvedAnswer,
      rationale:
        item.candidateKind === 'audio-recognition'
          ? 'Regenerated listening prompt audio.'
          : 'Regenerated answer audio.',
    });
    resolvedPreviewAudio = regeneratedPreview;
    resolvedPreviewAudioRole = item.candidateKind === 'audio-recognition' ? 'prompt' : 'answer';
    if (regeneratedPreview) {
      if (item.candidateKind === 'audio-recognition') {
        resolvedPrompt = { ...resolvedPrompt, cueAudio: regeneratedPreview };
      } else {
        resolvedAnswer = { ...resolvedAnswer, answerAudio: regeneratedPreview };
      }
    }
  }

  return {
    item,
    prompt: resolvedPrompt,
    answer: resolvedAnswer,
    previewAudioId: resolvedPreviewAudio?.id ?? null,
    previewAudioRole: resolvedPreviewAudioRole ?? null,
    previewImageId: item.previewImage?.id ?? item.prompt.cueImage?.id ?? null,
  };
}

export async function commitStudyCardCandidates(input: {
  userId: string;
  candidates: StudyCardCandidateCommitItem[];
}): Promise<StudyCardCandidateCommitResponse> {
  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    throw new AppError('At least one candidate is required.', 400);
  }
  if (input.candidates.length > STUDY_CANDIDATE_COMMIT_MAX_COUNT) {
    throw new AppError(
      `A maximum of ${String(STUDY_CANDIDATE_COMMIT_MAX_COUNT)} candidates can be added at once.`,
      400
    );
  }

  const resolvedItems = [];
  for (const item of input.candidates) {
    // Keep this sequential so a commit cannot fan out several missing-preview TTS calls at once.
    resolvedItems.push(await resolveStudyCardCandidateCommitItem({ userId: input.userId, item }));
  }
  const ownedPreviewAudioIds = await getOwnedPreviewMediaIds({
    userId: input.userId,
    mediaIds: resolvedItems.flatMap((item) => (item.previewAudioId ? [item.previewAudioId] : [])),
    mediaKind: 'audio',
    errorMessage: 'Preview audio was not found for this user.',
  });
  const ownedPreviewImageIds = await getOwnedPreviewMediaIds({
    userId: input.userId,
    mediaIds: resolvedItems.flatMap((item) => (item.previewImageId ? [item.previewImageId] : [])),
    mediaKind: 'image',
    errorMessage: 'Preview image was not found for this user.',
  });

  const cards = [];
  for (const resolved of resolvedItems) {
    const previewMediaId =
      resolved.previewAudioId && ownedPreviewAudioIds.has(resolved.previewAudioId)
        ? resolved.previewAudioId
        : null;
    const imageMediaId =
      resolved.previewImageId && ownedPreviewImageIds.has(resolved.previewImageId)
        ? resolved.previewImageId
        : null;
    const promptAudioMediaId =
      resolved.previewAudioRole === 'prompt' || resolved.item.candidateKind === 'audio-recognition'
        ? previewMediaId
        : null;
    // Listening cards intentionally reuse the same synthesized Japanese audio for the
    // front cue and answer replay, while keeping the JSON payload answer free of cue-audio refs.
    const answerAudioMediaId =
      resolved.previewAudioRole === 'answer' || resolved.item.candidateKind === 'audio-recognition'
        ? previewMediaId
        : null;
    const card = await createStudyCard({
      userId: input.userId,
      cardType: resolved.item.cardType,
      prompt: resolved.prompt,
      answer: resolved.answer,
      promptAudioMediaId,
      answerAudioMediaId,
      imageMediaId,
    });
    cards.push(card);
  }

  return { cards };
}

export async function regenerateStudyCardCandidatePreviewAudio(input: {
  userId: string;
  candidate: StudyCardCandidateCommitItem;
}): Promise<StudyCardCandidatePreviewAudioResponse> {
  const item = input.candidate;
  if (!STUDY_CARD_CANDIDATE_KINDS.has(item.candidateKind)) {
    throw new AppError('candidateKind must be a supported generated card kind.', 400);
  }

  const expectedCardType = cardTypeForStudyCardCandidateKind(item.candidateKind);
  if (item.cardType !== expectedCardType) {
    throw new AppError('cardType does not match candidateKind.', 400);
  }

  const generated = await synthesizeCandidatePreviewAudio(input.userId, {
    clientId: item.clientId,
    candidateKind: item.candidateKind,
    cardType: item.cardType,
    prompt: item.prompt,
    answer: item.answer,
    rationale: 'Regenerated candidate preview audio.',
  });

  const previewAudioRole = item.candidateKind === 'audio-recognition' ? 'prompt' : 'answer';
  const prompt =
    item.candidateKind === 'audio-recognition'
      ? {
          ...item.prompt,
          cueAudio: generated,
        }
      : item.prompt;
  const answer = {
    ...item.answer,
    ...(previewAudioRole === 'answer' ? { answerAudio: generated } : {}),
  };

  return {
    prompt,
    answer,
    previewAudio: generated,
    previewAudioRole,
  };
}

export async function regenerateStudyCardCandidatePreviewImage(input: {
  userId: string;
  candidate: StudyCardCandidateCommitItem;
  imagePrompt: string;
}): Promise<StudyCardCandidatePreviewImageResponse> {
  const item = input.candidate;
  if (item.candidateKind !== 'production' || item.cardType !== 'production') {
    throw new AppError('Only production candidates can regenerate prompt images.', 400);
  }

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

  const previewImage = await generateCandidatePreviewImage({
    userId: input.userId,
    clientId: item.clientId,
    imagePrompt,
  });

  return {
    prompt: {
      ...item.prompt,
      cueText: null,
      cueImage: previewImage,
    },
    previewImage,
    imagePrompt,
  };
}
