import type {
  StudyCardSetDueMode,
  StudyCardSummary,
  StudyOverview,
} from '@languageflow/shared/src/types';
import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import type { StudyReviewRequestGuard } from './studyReviewRequestGuard';
import {
  getNextCardIndex,
  isCardEligibleForSession,
  type StudyUndoSnapshot,
} from './studyReviewSessionUtils';
import type { StudySessionKind } from './useStudySessionLoader';

type CardAction = 'suspend' | 'unsuspend' | 'forget' | 'set_due';
type CardActionOptions = { mode?: StudyCardSetDueMode; dueAt?: string };

interface CardActionResult {
  card: StudyCardSummary;
  overview: StudyOverview;
}

interface CardActionPayload {
  cardId: string;
  action: CardAction;
  mode?: StudyCardSetDueMode;
  dueAt?: string;
  timeZone?: string;
}

interface StudyReviewCardActionsOptions {
  autoRefreshEmptySessionRef: MutableRefObject<boolean>;
  cardActionMutation: {
    isPending: boolean;
    mutateAsync: (payload: CardActionPayload) => Promise<CardActionResult>;
  };
  cardsLength: number;
  captureUndoSnapshot: () => StudyUndoSnapshot;
  currentCard: StudyCardSummary | null;
  editing: boolean;
  mergeCardIntoSession: (card: StudyCardSummary) => void;
  pendingReviewOperationRef: MutableRefObject<unknown>;
  pushUndo: (action: { kind: 'bury'; snapshot: StudyUndoSnapshot }) => void;
  removeCardFromSession: (cardId: string) => void;
  requestGuardRef: MutableRefObject<StudyReviewRequestGuard>;
  revealed: boolean;
  sessionEpochRef: MutableRefObject<number>;
  sessionKind: StudySessionKind;
  setAnsweredCardIds: Dispatch<SetStateAction<string[]>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setLessonPhase: Dispatch<SetStateAction<'preview' | 'quiz' | 'complete'>>;
  setRevealed: Dispatch<SetStateAction<boolean>>;
  setSessionError: Dispatch<SetStateAction<string | null>>;
  setShowSetDueControls: Dispatch<SetStateAction<boolean>>;
  stopAllAudio: () => void;
  syncOverview: (overview: StudyOverview) => void;
}

const finishLessonWhenEmpty = (options: StudyReviewCardActionsOptions, nextLength: number) => {
  if (options.sessionKind === 'lessons' && nextLength === 0) {
    options.setLessonPhase('complete');
  }
};

const removeCurrentCard = (options: StudyReviewCardActionsOptions) => {
  const { currentCard } = options;
  if (!currentCard) return;
  options.removeCardFromSession(currentCard.id);
  const nextLength = Math.max(options.cardsLength - 1, 0);
  options.setCurrentIndex((current) => getNextCardIndex(current, nextLength));
  finishLessonWhenEmpty(options, nextLength);
};

const applyCardActionResult = (
  options: StudyReviewCardActionsOptions,
  result: CardActionResult
) => {
  const { autoRefreshEmptySessionRef, currentCard } = options;
  if (!currentCard) return;
  options.syncOverview(result.overview);
  options.setAnsweredCardIds((current) => current.filter((cardId) => cardId !== currentCard.id));
  options.setShowSetDueControls(false);
  autoRefreshEmptySessionRef.current = false;
  if (isCardEligibleForSession(result.card)) options.mergeCardIntoSession(result.card);
  else removeCurrentCard(options);
  options.setRevealed(false);
  options.setSessionError(null);
};

const isActionBlocked = (options: StudyReviewCardActionsOptions) =>
  [
    !options.currentCard,
    options.editing,
    Boolean(options.pendingReviewOperationRef.current),
    options.requestGuardRef.current.isBusy(),
    options.cardActionMutation.isPending,
  ].some(Boolean);

const getActionableCard = (options: StudyReviewCardActionsOptions) =>
  isActionBlocked(options) ? null : options.currentCard;

const createCardActionPayload = (
  card: StudyCardSummary,
  action: CardAction,
  options?: CardActionOptions
) => ({
  cardId: card.id,
  action,
  mode: options?.mode,
  dueAt: options?.dueAt,
  timeZone: options?.mode === 'tomorrow' ? getDeviceStudyTimeZone() : undefined,
});

const applyCardActionFailure = (
  options: StudyReviewCardActionsOptions,
  expectedEpoch: number,
  error: unknown
) => {
  if (options.sessionEpochRef.current !== expectedEpoch) return;
  options.setSessionError(error instanceof Error ? error.message : 'Card action failed.');
};

const buryCurrentCard = (options: StudyReviewCardActionsOptions) => {
  if (
    [
      !options.currentCard,
      !options.revealed,
      options.editing,
      Boolean(options.pendingReviewOperationRef.current),
    ].some(Boolean)
  )
    return;

  const { autoRefreshEmptySessionRef } = options;
  options.pushUndo({ kind: 'bury', snapshot: options.captureUndoSnapshot() });
  options.stopAllAudio();
  autoRefreshEmptySessionRef.current = false;
  options.setAnsweredCardIds((current) =>
    current.filter((cardId) => cardId !== options.currentCard?.id)
  );
  removeCurrentCard(options);
  options.setRevealed(false);
  options.setShowSetDueControls(false);
};

const runCardAction = async (
  options: StudyReviewCardActionsOptions,
  action: CardAction,
  actionOptions?: CardActionOptions
) => {
  const currentCard = getActionableCard(options);
  if (!currentCard) return;
  const expectedEpoch = options.sessionEpochRef.current;
  const requestToken = options.requestGuardRef.current.acquire('card-action', currentCard.id);
  if (!requestToken) return;
  try {
    options.stopAllAudio();
    const result = await options.cardActionMutation.mutateAsync(
      createCardActionPayload(currentCard, action, actionOptions)
    );
    if (options.sessionEpochRef.current !== expectedEpoch) return;
    applyCardActionResult(options, result);
  } catch (error) {
    applyCardActionFailure(options, expectedEpoch, error);
  } finally {
    options.requestGuardRef.current.release(requestToken);
  }
};

const useStudyReviewCardActions = (options: StudyReviewCardActionsOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const handleBuryForSession = useCallback(() => buryCurrentCard(optionsRef.current), []);

  const handleCardAction = useCallback(
    (action: CardAction, actionOptions?: CardActionOptions) =>
      runCardAction(optionsRef.current, action, actionOptions),
    []
  );

  return { handleBuryForSession, handleCardAction };
};

export default useStudyReviewCardActions;
