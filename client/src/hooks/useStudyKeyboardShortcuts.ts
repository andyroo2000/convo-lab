import { useEffect, useRef } from 'react';

interface UseStudyKeyboardShortcutsOptions {
  cardActionPending: boolean;
  editing: boolean;
  exitFocusMode: () => void;
  focusMode: boolean;
  handleGrade: (grade: 'again' | 'hard' | 'good' | 'easy') => Promise<void>;
  handleUndo: () => Promise<void>;
  onError: (message: string) => void;
  revealCurrentCard: () => void;
  revealed: boolean;
  togglePromptAudio: () => boolean;
  toggleAnswerAudio: () => boolean;
  reviewSubmitPending: boolean;
  reviewPending: boolean;
  runBackgroundTask: (
    task?: Promise<unknown> | (() => Promise<unknown> | unknown),
    options?: { errorMessage?: string; label?: string; onError?: (message: string) => void }
  ) => void;
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

export default function useStudyKeyboardShortcuts({
  cardActionPending,
  editing,
  exitFocusMode,
  focusMode,
  handleGrade,
  handleUndo,
  onError,
  revealCurrentCard,
  revealed,
  togglePromptAudio,
  toggleAnswerAudio,
  reviewPending,
  reviewSubmitPending,
  runBackgroundTask,
  setEditing,
}: UseStudyKeyboardShortcutsOptions) {
  const revealedRef = useRef(revealed);
  const revealCurrentCardRef = useRef(revealCurrentCard);
  const togglePromptAudioRef = useRef(togglePromptAudio);
  const toggleAnswerAudioRef = useRef(toggleAnswerAudio);

  useEffect(() => {
    revealedRef.current = revealed;
    revealCurrentCardRef.current = revealCurrentCard;
    togglePromptAudioRef.current = togglePromptAudio;
    toggleAnswerAudioRef.current = toggleAnswerAudio;
  }, [revealCurrentCard, revealed, toggleAnswerAudio, togglePromptAudio]);

  useEffect(() => {
    if (!focusMode) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        runBackgroundTask(() => handleUndo(), {
          label: 'Study keyboard undo',
          errorMessage: 'Undo failed.',
          onError,
        });
        return;
      }

      if (editing && event.key === 'Escape') {
        event.preventDefault();
        setEditing(false);
        return;
      }

      if (editing || cardActionPending) return;

      if (event.code === 'Space') {
        event.preventDefault();
        if (revealedRef.current) {
          if (!toggleAnswerAudioRef.current()) {
            revealCurrentCardRef.current();
          }
          return;
        }
        if (togglePromptAudioRef.current()) {
          return;
        }
        revealCurrentCardRef.current();
        return;
      }

      if (!revealed || reviewSubmitPending || reviewPending) return;

      const keyboardGrade = getKeyboardGrade(event);
      if (keyboardGrade) {
        event.preventDefault();
        runBackgroundTask(() => handleGrade(keyboardGrade), {
          label: 'Study keyboard grade',
          errorMessage: 'Review failed.',
          onError,
        });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        exitFocusMode();
      }
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
    onError,
    revealCurrentCard,
    revealed,
    reviewPending,
    reviewSubmitPending,
    runBackgroundTask,
    setEditing,
    toggleAnswerAudio,
    togglePromptAudio,
  ]);
}
