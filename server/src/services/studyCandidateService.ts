import { randomUUID } from 'crypto';

import { DEFAULT_NARRATOR_VOICES, TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import type {
  StudyAnswerPayload,
  StudyCardCandidate,
  StudyCardCandidateCommitItem,
  StudyCardCandidateCommitResponse,
  StudyCardCandidateGenerateRequest,
  StudyCardCandidateGenerateResponse,
  StudyCardCandidateKind,
  StudyCardCandidatePreviewAudioResponse,
  StudyCardType,
  StudyMediaRef,
  StudyPromptPayload,
} from '@languageflow/shared/src/types.js';
import { getLanguageCodeFromVoiceId } from '@languageflow/shared/src/voiceSelection.js';

import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

import { synthesizeBatchedTexts } from './batchedTTSClient.js';
import { addFuriganaBrackets } from './furiganaService.js';
import { generateStudyCardCandidateJson } from './llmClient.js';
import {
  getBestAnswerAudioText,
  getStudyMediaApiPath,
  normalizeFilename,
  persistStudyMediaBuffer,
} from './study/shared.js';
import { createStudyCard } from './studySchedulerService.js';

const STUDY_CANDIDATE_TARGET_MAX_LENGTH = 500;
const STUDY_CANDIDATE_CONTEXT_MAX_LENGTH = 2000;
const STUDY_CANDIDATE_MAX_COUNT = 6;
const STUDY_CANDIDATE_LEARNER_CONTEXT_LIMIT = 12;
const STUDY_CANDIDATE_PREVIEW_IMPORT_JOB_ID = 'candidate-preview';
const STUDY_CANDIDATE_PREVIEW_SOURCE_KIND = 'generated_preview';
const STUDY_CANDIDATE_PREVIEW_RETENTION_MS = 24 * 60 * 60 * 1000;
const STUDY_JA_TTS_VOICE_IDS = new Set<string>(TTS_VOICES.ja.voices.map((voice) => voice.id));

const STUDY_CANDIDATE_KINDS = new Set<StudyCardCandidateKind>([
  'text-recognition',
  'audio-recognition',
  'production',
  'cloze',
]);

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

function sanitizeAnswerPayload(value: unknown): StudyAnswerPayload {
  if (!isRecord(value)) {
    throw new AppError('Generated candidate answer must be an object.', 502);
  }

  const rawVoiceId = parseNullableString(value.answerAudioVoiceId);
  const answerAudioVoiceId =
    rawVoiceId && STUDY_JA_TTS_VOICE_IDS.has(rawVoiceId) ? rawVoiceId : DEFAULT_NARRATOR_VOICES.ja;

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
    answerAudioVoiceId,
    answerAudioTextOverride: parseNullableString(value.answerAudioTextOverride),
  };
}

function cardTypeForCandidateKind(candidateKind: StudyCardCandidateKind): StudyCardType {
  if (candidateKind === 'production') return 'production';
  if (candidateKind === 'cloze') return 'cloze';
  return 'recognition';
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
    !STUDY_CANDIDATE_KINDS.has(candidateKind as StudyCardCandidateKind)
  ) {
    throw new AppError('Generated candidate used an unsupported candidate kind.', 502);
  }

  const kind = candidateKind as StudyCardCandidateKind;
  const cardType = cardTypeForCandidateKind(kind);
  const rawCardType = raw.cardType;
  if (typeof rawCardType === 'string' && rawCardType !== cardType) {
    throw new AppError('Generated candidate card type did not match its candidate kind.', 502);
  }

  let candidate: StudyCardCandidate = {
    clientId:
      typeof raw.clientId === 'string' && raw.clientId.trim()
        ? raw.clientId.trim()
        : `candidate-${index + 1}-${randomUUID()}`,
    candidateKind: kind,
    cardType,
    prompt: sanitizePromptPayload(raw.prompt),
    answer: sanitizeAnswerPayload(raw.answer),
    rationale: parseNullableString(raw.rationale) ?? 'Generated from your prompt.',
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
    previewAudio: null,
    previewAudioRole: null,
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
    .slice(0, STUDY_CANDIDATE_MAX_COUNT)
    .map((candidate, index) => normalizeGeneratedCandidate(candidate, index));
}

function getPreviewAudioText(
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

async function synthesizeCandidatePreviewAudio(
  userId: string,
  candidate: StudyCardCandidate
): Promise<StudyMediaRef | null> {
  const text = getPreviewAudioText(candidate);
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

  const filename = `${normalizeFilename(candidate.clientId)}.mp3`;
  const persisted = await persistStudyMediaBuffer({
    userId,
    importJobId: STUDY_CANDIDATE_PREVIEW_IMPORT_JOB_ID,
    filename,
    buffer: audioBuffer,
  });

  const media = await prisma.studyMedia.create({
    data: {
      userId,
      sourceKind: STUDY_CANDIDATE_PREVIEW_SOURCE_KIND,
      sourceFilename: filename,
      normalizedFilename: normalizeFilename(filename),
      mediaKind: 'audio',
      contentType: 'audio/mpeg',
      storagePath: persisted.storagePath,
      publicUrl: persisted.publicUrl,
    },
  });

  return {
    id: media.id,
    filename,
    url: getStudyMediaApiPath(media.id),
    mediaKind: 'audio',
    source: 'generated',
  };
}

async function addPreviewAudio(
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
        answer: {
          ...candidate.answer,
          answerAudio: previewAudio,
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
    console.warn('[Study candidates] Failed to generate preview audio.', error);
    return {
      ...candidate,
      warnings: [...(candidate.warnings ?? []), 'Audio preview could not be generated.'],
    };
  }
}

function validateGenerateRequest(input: StudyCardCandidateGenerateRequest): {
  targetText: string;
  context: string;
  includeLearnerContext: boolean;
} {
  const targetText = input.targetText?.trim() ?? '';
  if (!targetText) {
    throw new AppError('targetText is required.', 400);
  }
  if (targetText.length > STUDY_CANDIDATE_TARGET_MAX_LENGTH) {
    throw new AppError(
      `targetText must be ${String(STUDY_CANDIDATE_TARGET_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

  const context = input.context?.trim() ?? '';
  if (context.length > STUDY_CANDIDATE_CONTEXT_MAX_LENGTH) {
    throw new AppError(
      `context must be ${String(STUDY_CANDIDATE_CONTEXT_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

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

function buildCandidatePrompt(input: {
  targetText: string;
  context: string;
  learnerContextSummary: string | null;
}): string {
  return `Generate Japanese flashcard candidates for ConvoLab.

Return strict JSON only with this shape:
{
  "candidates": [
    {
      "clientId": "short-stable-id",
      "candidateKind": "text-recognition" | "audio-recognition" | "production" | "cloze",
      "cardType": "recognition" | "production" | "cloze",
      "prompt": {},
      "answer": {},
      "rationale": "why this card helps",
      "warnings": []
    }
  ]
}

Rules:
- Generate 2 to ${STUDY_CANDIDATE_MAX_COUNT} useful candidates.
- Include audio-recognition when listening to the Japanese phrase would be useful.
- audio-recognition persists as cardType "recognition"; leave prompt text blank and put the Japanese in answer.expression.
- text-recognition asks Japanese -> English; set prompt.cueText to the Japanese phrase, prompt.cueReading when useful, answer.expression to the same Japanese phrase, and answer.meaning to English.
- production asks English/context -> Japanese; set prompt.cueMeaning or prompt.cueText to the English cue, answer.expression to the Japanese answer, and answer.meaning to English.
- cloze uses prompt.clozeText with {{c1::...}} markup, prompt.clozeHint with a short non-answer clue, and answer.restoredText. Do not wrap text fields in extra quotation marks.
- Use bracket ruby readings like 稚内[わっかない] in reading fields, including answer.expressionReading and answer.restoredTextReading.
- Include answer.notes on every candidate with concise grammar/usage nuance. Include example sentence fields only when they add value beyond the target sentence.
- Set answer.answerAudioVoiceId to "${DEFAULT_NARRATOR_VOICES.ja}" unless a better Japanese voice is clearly warranted.
- Set answer.answerAudioTextOverride to kana/hiragana only when TTS may misread the kanji.
- Do not include media refs; the server will add audio previews.

Target:
${input.targetText}

Extra user context:
${input.context || '(none)'}

Recent learner context:
${input.learnerContextSummary || '(none)'}`;
}

export async function generateStudyCardCandidates(input: {
  userId: string;
  request: StudyCardCandidateGenerateRequest;
}): Promise<StudyCardCandidateGenerateResponse> {
  const request = validateGenerateRequest(input.request);
  try {
    await prisma.studyMedia.deleteMany({
      where: {
        userId: input.userId,
        sourceKind: STUDY_CANDIDATE_PREVIEW_SOURCE_KIND,
        updatedAt: {
          lt: new Date(Date.now() - STUDY_CANDIDATE_PREVIEW_RETENTION_MS),
        },
      },
    });
  } catch (error) {
    console.warn('[Study candidates] Failed to prune stale preview media.', error);
  }
  const learnerContextSummary = request.includeLearnerContext
    ? await buildLearnerContextSummary(input.userId)
    : null;

  const rawResponse = await generateStudyCardCandidateJson(
    buildCandidatePrompt({
      targetText: request.targetText,
      context: request.context,
      learnerContextSummary,
    }),
    'You are a careful Japanese flashcard author. Output valid JSON only.'
  );

  const candidates = await Promise.all(
    parseCandidateResponse(rawResponse).map((candidate) => enrichCandidateReadings(candidate))
  );
  const withPreviewAudio = await Promise.all(
    candidates.map((candidate) => addPreviewAudio(input.userId, candidate))
  );

  return {
    candidates: withPreviewAudio,
    learnerContextSummary,
  };
}

async function resolvePreviewMediaId(input: {
  userId: string;
  previewAudio: StudyMediaRef | null | undefined;
}): Promise<string | null> {
  const mediaId = input.previewAudio?.id;
  if (!mediaId) return null;

  const media = await prisma.studyMedia.findFirst({
    where: {
      id: mediaId,
      userId: input.userId,
      sourceKind: STUDY_CANDIDATE_PREVIEW_SOURCE_KIND,
      mediaKind: 'audio',
    },
    select: {
      id: true,
    },
  });

  if (!media) {
    throw new AppError('Preview audio was not found for this user.', 400);
  }

  return media.id;
}

export async function commitStudyCardCandidates(input: {
  userId: string;
  candidates: StudyCardCandidateCommitItem[];
}): Promise<StudyCardCandidateCommitResponse> {
  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    throw new AppError('At least one candidate is required.', 400);
  }
  if (input.candidates.length > STUDY_CANDIDATE_MAX_COUNT) {
    throw new AppError(
      `A maximum of ${String(STUDY_CANDIDATE_MAX_COUNT)} candidates can be added at once.`,
      400
    );
  }

  const cards = [];
  for (const item of input.candidates) {
    if (!STUDY_CANDIDATE_KINDS.has(item.candidateKind)) {
      throw new AppError('candidateKind must be a supported generated card kind.', 400);
    }

    const expectedCardType = cardTypeForCandidateKind(item.candidateKind);
    if (item.cardType !== expectedCardType) {
      throw new AppError('cardType does not match candidateKind.', 400);
    }

    let previewAudio = item.previewAudio ?? null;
    if (!previewAudio && item.candidateKind === 'audio-recognition') {
      const regeneratedPreview = await synthesizeCandidatePreviewAudio(input.userId, {
        clientId: item.clientId,
        candidateKind: item.candidateKind,
        cardType: item.cardType,
        prompt: item.prompt,
        answer: item.answer,
        rationale: 'Regenerated listening prompt audio.',
      });
      previewAudio = regeneratedPreview;
      if (regeneratedPreview) {
        item.prompt.cueAudio = regeneratedPreview;
        item.answer.answerAudio = regeneratedPreview;
      }
    }

    const previewMediaId = await resolvePreviewMediaId({
      userId: input.userId,
      previewAudio,
    });

    const promptAudioMediaId =
      item.previewAudioRole === 'prompt' || item.candidateKind === 'audio-recognition'
        ? previewMediaId
        : null;
    const answerAudioMediaId =
      item.previewAudioRole === 'answer' || item.candidateKind === 'audio-recognition'
        ? previewMediaId
        : null;

    const card = await createStudyCard({
      userId: input.userId,
      cardType: item.cardType,
      prompt: item.prompt,
      answer: item.answer,
      promptAudioMediaId,
      answerAudioMediaId,
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
  if (!STUDY_CANDIDATE_KINDS.has(item.candidateKind)) {
    throw new AppError('candidateKind must be a supported generated card kind.', 400);
  }

  const expectedCardType = cardTypeForCandidateKind(item.candidateKind);
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
    answerAudio: generated,
  };

  return {
    prompt,
    answer,
    previewAudio: generated,
    previewAudioRole,
  };
}
