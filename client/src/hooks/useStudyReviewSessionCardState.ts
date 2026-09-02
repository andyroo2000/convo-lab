import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { StudyCardSummary, StudyOverview } from '@languageflow/shared/src/types';

import type { StudySessionGrade } from '../components/study/studySessionWrapUpModel';
import type { StudySessionResponse } from './useStudy';
import {
  cloneStudySnapshot,
  getCardsAfterReview,
  type StudyUndoSnapshot,
} from './studyReviewSessionUtils';

interface StudyReviewSessionCardStateOptions {
  answeredCardIds: string[];
  answeredCardIdsRef: MutableRefObject<Set<string>>;
  currentIndex: number;
  getCachedOverview: () => StudyOverview | null;
  revealed: boolean;
  session: StudySessionResponse | null;
  setSession: Dispatch<SetStateAction<StudySessionResponse | null>>;
}

const mergeCard = (options: StudyReviewSessionCardStateOptions, updatedCard: StudyCardSummary) => {
  options.setSession((currentSession) => {
    if (!currentSession) return currentSession;
    if (options.answeredCardIdsRef.current.has(updatedCard.id)) return currentSession;

    return {
      ...currentSession,
      cards: currentSession.cards.map((card) => (card.id === updatedCard.id ? updatedCard : card)),
    };
  });
};

const removeCard = (options: StudyReviewSessionCardStateOptions, cardId: string) => {
  options.setSession((currentSession) => {
    if (!currentSession) return currentSession;

    return {
      ...currentSession,
      cards: currentSession.cards.filter((card) => card.id !== cardId),
    };
  });
};

const applyReviewResult = (
  options: StudyReviewSessionCardStateOptions,
  result: {
    updatedCard: StudyCardSummary;
    grade: StudySessionGrade;
    resolvedCards?: StudyCardSummary[];
    resolvedOverview?: StudyOverview;
  }
) => {
  const { updatedCard, grade, resolvedCards, resolvedOverview } = result;

  options.setSession((currentSession) => {
    if (!currentSession) return currentSession;

    return {
      ...currentSession,
      overview: resolvedOverview ?? currentSession.overview,
      cards: resolvedCards ?? getCardsAfterReview(currentSession.cards, updatedCard, grade),
    };
  });
};

const createUndoSnapshot = (options: StudyReviewSessionCardStateOptions): StudyUndoSnapshot => ({
  session: options.session
    ? cloneStudySnapshot({
        session: options.session,
        overview: options.getCachedOverview(),
        currentIndex: options.currentIndex,
        revealed: options.revealed,
        answeredCardIds: options.answeredCardIds,
      }).session
    : null,
  overview: options.getCachedOverview(),
  currentIndex: options.currentIndex,
  revealed: options.revealed,
  answeredCardIds: [...options.answeredCardIds],
});

const useStudyReviewSessionCardState = (options: StudyReviewSessionCardStateOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mergeCardIntoSession = useCallback(
    (updatedCard: StudyCardSummary) => mergeCard(optionsRef.current, updatedCard),
    []
  );

  const removeCardFromSession = useCallback((cardId: string) => {
    removeCard(optionsRef.current, cardId);
  }, []);

  const applyReviewResultToSession = useCallback(
    (
      updatedCard: StudyCardSummary,
      grade: StudySessionGrade,
      resolvedCards?: StudyCardSummary[],
      resolvedOverview?: StudyOverview
    ) =>
      applyReviewResult(optionsRef.current, {
        updatedCard,
        grade,
        resolvedCards,
        resolvedOverview,
      }),
    []
  );

  const captureUndoSnapshot = useCallback(() => createUndoSnapshot(optionsRef.current), []);

  return {
    applyReviewResultToSession,
    captureUndoSnapshot,
    mergeCardIntoSession,
    removeCardFromSession,
  };
};

export default useStudyReviewSessionCardState;
