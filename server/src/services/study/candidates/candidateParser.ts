import { randomUUID } from 'crypto';

import { DEFAULT_NARRATOR_VOICES, TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import {
  STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH,
  STUDY_CANDIDATE_VISUAL_POS_LABELS_JA,
} from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyAnswerPayload,
  StudyCardCandidate,
  StudyCardCandidateGenerateRequest,
  StudyCardCandidateKind,
  StudyPromptPayload,
} from '@languageflow/shared/src/types.js';

import { AppError } from '../../../middleware/errorHandler.js';
import { addFuriganaBrackets } from '../../furiganaService.js';
import { cardTypeForStudyCardCandidateKind, STUDY_CARD_CANDIDATE_KINDS } from '../shared.js';

import { STUDY_CANDIDATE_GENERATE_MAX_COUNT } from './constants.js';
import { parseNullableString } from './textUtils.js';

type JsonRecord = Record<string, unknown>;

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

function getFallbackClozeHint(clozeText: string | null | undefined): string {
  const hiddenText = clozeText?.match(/\{\{c1::([^}:]+)(?:::[^}]*)?}}/)?.[1]?.trim() ?? '';
  if (hiddenText && hiddenText.length <= 4 && !/[\u4e00-\u9faf]/.test(hiddenText)) {
    return 'Grammar or particle chunk';
  }

  return 'Missing Japanese expression';
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

export async function enrichCandidateReadings(
  candidate: StudyCardCandidate
): Promise<StudyCardCandidate> {
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

export function parseCandidateResponse(response: string): StudyCardCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFromResponse(response));
  } catch (error) {
    // eslint-disable-next-line no-console
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

export function normalizeGenerateRequest(input: StudyCardCandidateGenerateRequest): {
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
