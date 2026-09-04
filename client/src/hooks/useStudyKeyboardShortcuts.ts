import { useEffect, useRef } from 'react';

type RunBackgroundTask = (
  task?: Promise<unknown> | (() => Promise<unknown> | unknown),
  options?: { errorMessage?: string; label?: string; onError?: (message: string) => void }
) => void;

interface UseStudyKeyboardShortcutsOptions {
  cardActionPending: boolean;
  editing: boolean;
  exitFocusMode: () => void;
  focusMode: boolean;
  handleGrade: (grade: 'again' | 'hard' | 'good' | 'easy') => Promise<void>;
  handleUndo: () => Promise<void>;
  interactionBlocked: boolean;
  onError: (message: string) => void;
  revealCurrentCard: () => void;
  revealed: boolean;
  toggleAnswerAudio: () => boolean;
  reviewSubmitPending: boolean;
  reviewPending: boolean;
  runBackgroundTask: RunBackgroundTask;
  setEditing: (editing: boolean) => void;
}

const getKeyboardGrade = (event: KeyboardEvent): 'again' | 'hard' | 'good' | 'easy' | null => {
  const gradeByKey: Record<string, 'again' | 'hard' | 'good' | 'easy'> = {
    '1': 'again',
    '2': 'hard',
    '3': 'good',
    '4': 'easy',
    Digit1: 'again',
    Digit2: 'hard',
    Digit3: 'good',
    Digit4: 'easy',
    Numpad1: 'again',
    Numpad2: 'hard',
    Numpad3: 'good',
    Numpad4: 'easy',
  };

  return gradeByKey[event.key] ?? gradeByKey[event.code] ?? null;
};

function isTypingTarget(target: EventTarget | null) {
  if (target instanceof HTMLInputElement) return true;
  return target instanceof HTMLTextAreaElement;
}

function hasUndoModifier(event: KeyboardEvent) {
  if (event.metaKey) return true;
  return event.ctrlKey;
}

function handleUndoShortcut(
  event: KeyboardEvent,
  handleUndo: () => Promise<void>,
  runBackgroundTask: RunBackgroundTask,
  onError: (message: string) => void
) {
  if (event.key.toLowerCase() !== 'z') return false;
  if (event.shiftKey) return false;
  if (!hasUndoModifier(event)) return false;

  event.preventDefault();
  runBackgroundTask(() => handleUndo(), {
    label: 'Study keyboard undo',
    errorMessage: 'Undo failed.',
    onError,
  });
  return true;
}

function handleEditingShortcut(
  event: KeyboardEvent,
  editing: boolean,
  setEditing: (editing: boolean) => void
) {
  if (!editing) return false;
  if (event.key !== 'Escape') return true;

  event.preventDefault();
  setEditing(false);
  return true;
}

function handleSpaceShortcut(
  event: KeyboardEvent,
  revealed: boolean,
  revealCurrentCard: () => void,
  toggleAnswerAudio: () => boolean
) {
  if (event.code !== 'Space') return false;

  event.preventDefault();
  if (!revealed) {
    revealCurrentCard();
    return true;
  }
  if (!toggleAnswerAudio()) revealCurrentCard();
  return true;
}

function handleReviewShortcut(
  event: KeyboardEvent,
  revealed: boolean,
  reviewSubmitPending: boolean,
  reviewPending: boolean,
  handleGrade: UseStudyKeyboardShortcutsOptions['handleGrade'],
  exitFocusMode: () => void,
  runBackgroundTask: RunBackgroundTask,
  onError: (message: string) => void
) {
  if (!revealed) return;
  if (reviewSubmitPending) return;
  if (reviewPending) return;

  const keyboardGrade = getKeyboardGrade(event);
  if (keyboardGrade) {
    event.preventDefault();
    runBackgroundTask(() => handleGrade(keyboardGrade), {
      label: 'Study keyboard grade',
      errorMessage: 'Review failed.',
      onError,
    });
    return;
  }
  if (event.key !== 'Escape') return;
  event.preventDefault();
  exitFocusMode();
}

export default function useStudyKeyboardShortcuts({
  cardActionPending,
  editing,
  exitFocusMode,
  focusMode,
  handleGrade,
  handleUndo,
  interactionBlocked,
  onError,
  revealCurrentCard,
  revealed,
  toggleAnswerAudio,
  reviewPending,
  reviewSubmitPending,
  runBackgroundTask,
  setEditing,
}: UseStudyKeyboardShortcutsOptions) {
  const revealedRef = useRef(revealed);
  const revealCurrentCardRef = useRef(revealCurrentCard);
  const toggleAnswerAudioRef = useRef(toggleAnswerAudio);

  useEffect(() => {
    revealedRef.current = revealed;
    revealCurrentCardRef.current = revealCurrentCard;
    toggleAnswerAudioRef.current = toggleAnswerAudio;
  }, [revealCurrentCard, revealed, toggleAnswerAudio]);

  useEffect(() => {
    if (!focusMode || interactionBlocked) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (handleUndoShortcut(event, handleUndo, runBackgroundTask, onError)) return;
      if (handleEditingShortcut(event, editing, setEditing)) return;
      if (cardActionPending) return;
      if (
        handleSpaceShortcut(
          event,
          revealedRef.current,
          revealCurrentCardRef.current,
          toggleAnswerAudioRef.current
        )
      )
        return;
      handleReviewShortcut(
        event,
        revealed,
        reviewSubmitPending,
        reviewPending,
        handleGrade,
        exitFocusMode,
        runBackgroundTask,
        onError
      );
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    cardActionPending,
    editing,
    exitFocusMode,
    focusMode,
    handleGrade,
    handleUndo,
    interactionBlocked,
    onError,
    revealCurrentCard,
    revealed,
    reviewPending,
    reviewSubmitPending,
    runBackgroundTask,
    setEditing,
    toggleAnswerAudio,
  ]);
}
