import { requestJson } from './apiClient';
import {
  isJsonRecord,
  nestedRecord,
  nullableNumberValue,
  nullableStringValue,
  stringValue,
  unwrapLearningOsData,
} from './learningOsResponseNormalization';

export type StudyLearningPathVariantStatus = 'locked' | 'available' | 'retired';
export type StudyLearningPathUnlockRequirement = 'successful_retrieval' | 'guru' | 'master';

export interface StudyLearningPathCard {
  id: string;
  noteId: string | null;
  cardType: 'recognition' | 'production' | 'cloze';
  displayText: string;
  meaning: string;
  variantStage: number | null;
  variantStatus: StudyLearningPathVariantStatus | null;
  unlockRequirement: StudyLearningPathUnlockRequirement | null;
}

export interface StudyLearningPathStage {
  number: number | null;
  cards: StudyLearningPathCard[];
}

export interface StudyLearningPath {
  groupId: string | null;
  anchorCardId: string;
  stages: StudyLearningPathStage[];
}

interface LinkStudyLearningPathSuccessorPayload {
  cardId: string;
  successorCardId: string;
  unlockRequirement: StudyLearningPathUnlockRequirement;
}

const normalizeCardType = (value: unknown): StudyLearningPathCard['cardType'] => {
  if (value === 'production') return value;
  if (value === 'cloze') return value;
  return 'recognition';
};

const normalizeVariantStatus = (value: unknown): StudyLearningPathVariantStatus | null => {
  if (value === 'locked') return value;
  if (value === 'available') return value;
  if (value === 'retired') return value;
  return null;
};

const normalizeUnlockRequirement = (value: unknown): StudyLearningPathUnlockRequirement | null => {
  if (value === 'successful_retrieval') return value;
  if (value === 'guru') return value;
  if (value === 'master') return value;
  return null;
};

const firstTextValue = (...values: string[]): string => values.find(Boolean) ?? '';

const normalizeLearningPathCard = (value: unknown): StudyLearningPathCard => {
  if (!isJsonRecord(value)) {
    throw new Error('Learning path response contained an invalid card.');
  }

  const id = stringValue(value, 'id', 'id');
  if (!id) {
    throw new Error('Learning path response contained a card without an id.');
  }

  const prompt = nestedRecord(value, 'promptJson', 'prompt_json');
  const answer = nestedRecord(value, 'answerJson', 'answer_json');

  return {
    id,
    noteId: nullableStringValue(value, 'sourceNoteId', 'source_note_id'),
    cardType: normalizeCardType(value.cardType ?? value.card_type),
    displayText: firstTextValue(
      stringValue(value, 'frontText', 'front_text'),
      stringValue(prompt, 'clozeDisplayText', 'cloze_display_text'),
      stringValue(prompt, 'cueText', 'cue_text'),
      stringValue(answer, 'expressionReading', 'expression_reading'),
      stringValue(answer, 'expression', 'expression'),
      stringValue(prompt, 'clozeText', 'cloze_text'),
      id
    ),
    meaning: firstTextValue(
      stringValue(answer, 'meaning', 'meaning'),
      stringValue(prompt, 'cueMeaning', 'cue_meaning'),
      stringValue(answer, 'sentenceEn', 'sentence_en'),
      stringValue(value, 'backText', 'back_text')
    ),
    variantStage: nullableNumberValue(value, 'variantStage', 'variant_stage'),
    variantStatus: normalizeVariantStatus(value.variantStatus ?? value.variant_status),
    unlockRequirement: normalizeUnlockRequirement(
      value.variantUnlockRequirement ?? value.variant_unlock_requirement
    ),
  };
};

const normalizeLearningPathStage = (value: unknown): StudyLearningPathStage => {
  if (!isJsonRecord(value)) {
    throw new Error('Learning path response contained an invalid stage.');
  }
  if (!Array.isArray(value.cards)) {
    throw new Error('Learning path response contained an invalid stage.');
  }

  return {
    number: nullableNumberValue(value, 'number', 'number'),
    cards: value.cards.map(normalizeLearningPathCard),
  };
};

const normalizeStudyLearningPath = (value: unknown): StudyLearningPath => {
  const path = unwrapLearningOsData(value);
  if (!isJsonRecord(path)) {
    throw new Error('Learning path response was malformed.');
  }

  const anchorCardId = stringValue(path, 'anchorCardId', 'anchor_card_id');
  if (!anchorCardId) {
    throw new Error('Learning path response did not include its anchor card.');
  }

  if (!Array.isArray(path.stages)) {
    throw new Error('Learning path response did not include stages.');
  }

  return {
    groupId: nullableStringValue(path, 'groupId', 'group_id'),
    anchorCardId,
    stages: path.stages.map(normalizeLearningPathStage),
  };
};

export const getStudyLearningPath = async (cardId: string): Promise<StudyLearningPath> =>
  normalizeStudyLearningPath(
    await requestJson<unknown>(`/api/cards/${encodeURIComponent(cardId)}/learning-path`)
  );

export const linkStudyLearningPathSuccessor = async (
  payload: LinkStudyLearningPathSuccessorPayload
): Promise<StudyLearningPath> =>
  normalizeStudyLearningPath(
    await requestJson<unknown>(
      `/api/cards/${encodeURIComponent(payload.cardId)}/learning-path/successor`,
      {
        method: 'PUT',
        body: JSON.stringify({
          successor_card_id: payload.successorCardId,
          unlock_requirement: payload.unlockRequirement,
        }),
      }
    )
  );
