import { selectManualStudyCardDefaultVoiceId } from '@languageflow/shared/src/constants.js';
import {
  STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH,
  STUDY_VOCAB_BUNDLE_SENTENCE_COUNT,
} from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyCardCandidate,
  StudyVocabBundle,
  StudyVocabBundleGenerateRequest,
  StudyVocabBundleSentence,
} from '@languageflow/shared/src/types.js';

import { AppError } from '../../../../middleware/errorHandler.js';
import { generateJapaneseReading } from '../../../japaneseReadingGenerator.js';
import { STUDY_VOCAB_VARIANT_STAGES } from '../../variants/constants.js';

type JsonRecord = Record<string, unknown>;

const MIN_WORD_BOUNDARY_RATIO = 0.75;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripJsonFromResponse(response: string): string {
  const trimmed = response.trim();
  if (!trimmed.includes('```')) return trimmed;
  const match = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  return match?.[1]?.trim() ?? trimmed;
}

function parseNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function requireString(raw: JsonRecord, key: string): string {
  const value = parseNullableString(raw[key]);
  if (!value) {
    throw new AppError(`Generated vocab bundle is missing ${key}.`, 502);
  }
  return value;
}

export function normalizeVocabBundleGenerateRequest(input: StudyVocabBundleGenerateRequest): {
  targetWord: string;
  sourceSentence: string | null;
  context: string;
  includeLearnerContext: boolean;
} {
  return {
    targetWord: input.targetWord?.trim() ?? '',
    sourceSentence: input.sourceSentence?.trim() || null,
    context: input.context?.trim() ?? '',
    includeLearnerContext: input.includeLearnerContext !== false,
  };
}

async function withFallbackReading(text: string, reading: string | null): Promise<string | null> {
  return reading ?? (await generateJapaneseReading(text));
}

function buildSentence(
  raw: unknown,
  ordinal: number
): StudyVocabBundleSentence & { clozeText: string; clozeHint: string } {
  if (!isRecord(raw)) {
    throw new AppError('Generated vocab sentence must be an object.', 502);
  }

  return {
    ordinal,
    sentenceJp: requireString(raw, 'sentenceJp'),
    sentenceReading: parseNullableString(raw.sentenceReading),
    sentenceEn: requireString(raw, 'sentenceEn'),
    notes: parseNullableString(raw.notes),
    clozeText: requireString(raw, 'clozeText'),
    clozeHint: requireString(raw, 'clozeHint'),
  };
}

function audioCandidate(input: {
  clientId: string;
  expression: string;
  reading: string | null;
  meaning: string;
  notes: string | null;
  sentenceJp?: string;
  sentenceEn?: string;
}): StudyCardCandidate {
  return {
    clientId: input.clientId,
    candidateKind: 'audio-recognition',
    cardType: 'recognition',
    prompt: {},
    answer: {
      expression: input.expression,
      expressionReading: input.reading,
      meaning: input.meaning,
      notes: input.notes,
      sentenceJp: input.sentenceJp,
      sentenceEn: input.sentenceEn,
      answerAudioVoiceId: selectManualStudyCardDefaultVoiceId(),
    },
    rationale: 'Introduces the item by sound before text.',
    warnings: [],
    previewAudio: null,
    previewAudioRole: null,
    previewImage: null,
    imagePrompt: null,
  };
}

function textCandidate(input: {
  clientId: string;
  expression: string;
  reading: string | null;
  meaning: string;
  notes: string | null;
  sentenceJp?: string;
  sentenceEn?: string;
}): StudyCardCandidate {
  return {
    clientId: input.clientId,
    candidateKind: 'text-recognition',
    cardType: 'recognition',
    prompt: {
      cueText: input.expression,
      cueReading: input.reading,
    },
    answer: {
      expression: input.expression,
      expressionReading: input.reading,
      meaning: input.meaning,
      notes: input.notes,
      sentenceJp: input.sentenceJp,
      sentenceEn: input.sentenceEn,
      answerAudioVoiceId: selectManualStudyCardDefaultVoiceId(),
    },
    rationale: 'Checks visual recognition after listening practice.',
    warnings: [],
    previewAudio: null,
    previewAudioRole: null,
    previewImage: null,
    imagePrompt: null,
  };
}

export function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const truncated = value.slice(0, maxLength).trimEnd();
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  if (lastSpaceIndex > Math.floor(maxLength * MIN_WORD_BOUNDARY_RATIO)) {
    return truncated.slice(0, lastSpaceIndex).trimEnd();
  }
  return truncated;
}

export function buildClozeImagePrompt(input: { meaning: string; notes: string | null }): string {
  const noTextSuffix = ' No text.';
  const sentenceEndingPunctuation = /[.!?。！？]+$/u;
  const meaning =
    input.meaning.trim().replace(sentenceEndingPunctuation, '') || 'the Japanese sentence';
  const notes = input.notes?.trim();
  const noteContext = notes ? ` Context: ${notes.replace(sentenceEndingPunctuation, '')}.` : '';
  const basePrompt = `A natural immersive scene representing this sentence meaning: ${meaning}.${noteContext}`;
  const maxBaseLength = STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH - noTextSuffix.length;
  return `${truncateAtWordBoundary(basePrompt, maxBaseLength)}${noTextSuffix}`;
}

function clozeCandidate(input: {
  clientId: string;
  clozeText: string;
  clozeHint: string;
  restoredText: string;
  restoredReading: string | null;
  meaning: string;
  notes: string | null;
}): StudyCardCandidate {
  return {
    clientId: input.clientId,
    candidateKind: 'cloze',
    cardType: 'cloze',
    prompt: {
      clozeText: input.clozeText,
      clozeHint: input.clozeHint,
    },
    answer: {
      restoredText: input.restoredText,
      restoredTextReading: input.restoredReading,
      meaning: input.meaning,
      notes: input.notes,
      answerAudioVoiceId: selectManualStudyCardDefaultVoiceId(),
    },
    rationale: 'Tests recall in sentence context after recognition stages.',
    warnings: [],
    previewAudio: null,
    previewAudioRole: null,
    previewImage: null,
    imagePrompt: buildClozeImagePrompt({
      meaning: input.meaning,
      notes: input.notes,
    }),
  };
}

export async function parseVocabBundleResponse(input: {
  response: string;
  targetWord: string;
  sourceSentence: string | null;
  context: string;
}): Promise<StudyVocabBundle> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFromResponse(input.response));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[Study vocab bundle] Failed to parse LLM JSON response.', error);
    throw new AppError('Could not generate a vocab bundle from that input.', 502);
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.sentences)) {
    throw new AppError('Generated vocab bundle had an invalid shape.', 502);
  }

  const targetWord = parseNullableString(parsed.targetWord) ?? input.targetWord;
  const targetMeaning = requireString(parsed, 'targetMeaning');
  const targetReading = await withFallbackReading(
    targetWord,
    parseNullableString(parsed.targetReading)
  );
  const rawSentences = parsed.sentences.slice(0, STUDY_VOCAB_BUNDLE_SENTENCE_COUNT);
  if (rawSentences.length !== STUDY_VOCAB_BUNDLE_SENTENCE_COUNT) {
    throw new AppError('Generated vocab bundle must include exactly three sentences.', 502);
  }

  const sentences = await Promise.all(
    rawSentences.map(async (raw, index) => {
      const sentence = buildSentence(raw, index);
      return {
        ...sentence,
        sentenceReading: await withFallbackReading(
          sentence.sentenceJp,
          sentence.sentenceReading ?? null
        ),
      };
    })
  );

  const variants = [
    ...sentences.map((sentence) => ({
      clientId: `sentence-audio-${sentence.ordinal}`,
      stage: STUDY_VOCAB_VARIANT_STAGES.sentenceAudio,
      variantKind: 'sentence_audio_recognition' as const,
      variantSentenceOrdinal: sentence.ordinal,
      candidate: audioCandidate({
        clientId: `sentence-audio-${sentence.ordinal}`,
        expression: sentence.sentenceJp,
        reading: sentence.sentenceReading ?? null,
        meaning: sentence.sentenceEn,
        notes: sentence.notes ?? null,
      }),
    })),
    ...sentences.map((sentence) => ({
      clientId: `sentence-text-${sentence.ordinal}`,
      stage: STUDY_VOCAB_VARIANT_STAGES.sentenceText,
      variantKind: 'sentence_text_recognition' as const,
      variantSentenceOrdinal: sentence.ordinal,
      candidate: textCandidate({
        clientId: `sentence-text-${sentence.ordinal}`,
        expression: sentence.sentenceJp,
        reading: sentence.sentenceReading ?? null,
        meaning: sentence.sentenceEn,
        notes: sentence.notes ?? null,
      }),
    })),
    {
      clientId: 'word-audio',
      stage: STUDY_VOCAB_VARIANT_STAGES.wordAudio,
      variantKind: 'word_audio_recognition' as const,
      variantSentenceOrdinal: null,
      candidate: audioCandidate({
        clientId: 'word-audio',
        expression: targetWord,
        reading: targetReading,
        meaning: targetMeaning,
        notes: `Target word: ${targetWord}`,
        sentenceJp: sentences[0]?.sentenceJp,
        sentenceEn: sentences[0]?.sentenceEn,
      }),
    },
    {
      clientId: 'word-text',
      stage: STUDY_VOCAB_VARIANT_STAGES.wordText,
      variantKind: 'word_text_recognition' as const,
      variantSentenceOrdinal: null,
      candidate: textCandidate({
        clientId: 'word-text',
        expression: targetWord,
        reading: targetReading,
        meaning: targetMeaning,
        notes: `Target word: ${targetWord}`,
        sentenceJp: sentences[0]?.sentenceJp,
        sentenceEn: sentences[0]?.sentenceEn,
      }),
    },
    ...sentences.map((sentence) => ({
      clientId: `sentence-cloze-${sentence.ordinal}`,
      stage: STUDY_VOCAB_VARIANT_STAGES.sentenceCloze,
      variantKind: 'sentence_cloze' as const,
      variantSentenceOrdinal: sentence.ordinal,
      candidate: clozeCandidate({
        clientId: `sentence-cloze-${sentence.ordinal}`,
        clozeText: sentence.clozeText,
        clozeHint: sentence.clozeHint,
        restoredText: sentence.sentenceJp,
        restoredReading: sentence.sentenceReading ?? null,
        meaning: sentence.sentenceEn,
        notes: sentence.notes ?? null,
      }),
    })),
  ];

  return {
    targetWord,
    targetReading,
    targetMeaning,
    sourceSentence: input.sourceSentence,
    sourceContext: input.context || null,
    sentences: sentences.map(
      ({ clozeText: _clozeText, clozeHint: _clozeHint, ...sentence }) => sentence
    ),
    variants,
  };
}
