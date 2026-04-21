import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  StudyAnswerPayload,
  StudyCardSummary,
  StudyCardType,
  StudyPromptPayload,
} from '@shared/types';

export interface StudyCardFormValues {
  cardType: StudyCardType;
  cueText: string;
  cueReading: string;
  cueMeaning: string;
  answerExpression: string;
  answerReading: string;
  answerMeaning: string;
  notes: string;
  sentenceJp: string;
  sentenceEn: string;
}

export interface StudyCardFormPayload {
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}

export interface StudyCardFormConfig {
  card?: StudyCardSummary;
  initialCardType?: StudyCardType;
}

const emptyToNull = (value: string) => (value === '' ? null : value);

export const getStudyCardFormValues = ({
  card,
  initialCardType = 'recognition',
}: StudyCardFormConfig = {}): StudyCardFormValues => {
  if (card) {
    if (card.cardType === 'cloze') {
      return {
        cardType: 'cloze',
        cueText: card.prompt.clozeText ?? '',
        cueReading: '',
        cueMeaning: card.prompt.clozeHint ?? card.prompt.clozeResolvedHint ?? '',
        answerExpression: card.answer.restoredText ?? '',
        answerReading: '',
        answerMeaning: card.answer.meaning ?? '',
        notes: card.answer.notes ?? '',
        sentenceJp: '',
        sentenceEn: '',
      };
    }

    return {
      cardType: card.cardType,
      cueText: card.prompt.cueText ?? '',
      cueReading: card.prompt.cueReading ?? '',
      cueMeaning: card.prompt.cueMeaning ?? '',
      answerExpression: card.answer.expression ?? '',
      answerReading: card.answer.expressionReading ?? '',
      answerMeaning: card.answer.meaning ?? '',
      notes: card.answer.notes ?? '',
      sentenceJp: card.answer.sentenceJp ?? '',
      sentenceEn: card.answer.sentenceEn ?? '',
    };
  }

  return {
    cardType: initialCardType,
    cueText: '',
    cueReading: '',
    cueMeaning: '',
    answerExpression: '',
    answerReading: '',
    answerMeaning: '',
    notes: '',
    sentenceJp: '',
    sentenceEn: '',
  };
};

export const buildStudyCardFormPayload = (
  values: StudyCardFormValues,
  card?: StudyCardSummary
): StudyCardFormPayload => {
  if (values.cardType === 'cloze') {
    return {
      cardType: 'cloze',
      prompt: {
        ...(card?.prompt ?? {}),
        clozeText: values.cueText,
        clozeHint: emptyToNull(values.cueMeaning),
      },
      answer: {
        ...(card?.answer ?? {}),
        restoredText: values.answerExpression,
        meaning: emptyToNull(values.answerMeaning),
        notes: emptyToNull(values.notes),
      },
    };
  }

  return {
    cardType: values.cardType,
    prompt: {
      ...(card?.prompt ?? {}),
      cueText: values.cueText,
      cueReading: emptyToNull(values.cueReading),
      cueMeaning: emptyToNull(values.cueMeaning),
    },
    answer: {
      ...(card?.answer ?? {}),
      expression: values.answerExpression,
      expressionReading: emptyToNull(values.answerReading),
      meaning: emptyToNull(values.answerMeaning),
      sentenceJp: emptyToNull(values.sentenceJp),
      sentenceEn: emptyToNull(values.sentenceEn),
      notes: emptyToNull(values.notes),
    },
  };
};

export const useStudyCardForm = ({ card, initialCardType }: StudyCardFormConfig) => {
  const baseValues = useMemo(
    () => getStudyCardFormValues({ card, initialCardType }),
    [card, initialCardType]
  );
  const [values, setValues] = useState<StudyCardFormValues>(baseValues);

  useEffect(() => {
    setValues(baseValues);
  }, [baseValues]);

  const setField = useCallback(
    <K extends keyof StudyCardFormValues>(field: K, value: StudyCardFormValues[K]) => {
      setValues((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const setCardType = useCallback((cardType: StudyCardType) => {
    setValues((current) => ({
      ...current,
      cardType,
    }));
  }, []);

  const reset = useCallback(() => {
    setValues(getStudyCardFormValues({ card, initialCardType }));
  }, [card, initialCardType]);

  const buildPayload = useCallback(() => buildStudyCardFormPayload(values, card), [card, values]);

  return {
    values,
    isCloze: values.cardType === 'cloze',
    setField,
    setCardType,
    reset,
    buildPayload,
  };
};
