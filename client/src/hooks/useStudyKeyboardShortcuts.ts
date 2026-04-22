import { useEffect } from 'react';

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
  reviewSubmitPending: boolean;
  reviewPending: boolean;
  runBackgroundTask: (
    task?: Promise<unknown> | (() => Promise<unknown> | unknown),
    options?: { errorMessage?: string; label?: string; onError?: (message: string) => void }
  ) => void;
  setEditing: (editing: boolean) => void;
}

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
  reviewPending,
  reviewSubmitPending,
  runBackgroundTask,
  setEditing,
}: UseStudyKeyboardShortcutsOptions) {
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
        revealCurrentCard();
        return;
      }

      if (!revealed || reviewSubmitPending || reviewPending) return;

      if (event.key === '1') {
        event.preventDefault();
        runBackgroundTask(() => handleGrade('again'), {
          label: 'Study keyboard grade',
          errorMessage: 'Review failed.',
          onError,
        });
      } else if (event.key === '2') {
        event.preventDefault();
        runBackgroundTask(() => handleGrade('hard'), {
          label: 'Study keyboard grade',
          errorMessage: 'Review failed.',
          onError,
        });
      } else if (event.key === '3') {
        event.preventDefault();
        runBackgroundTask(() => handleGrade('good'), {
          label: 'Study keyboard grade',
          errorMessage: 'Review failed.',
          onError,
        });
      } else if (event.key === '4') {
        event.preventDefault();
        runBackgroundTask(() => handleGrade('easy'), {
          label: 'Study keyboard grade',
          errorMessage: 'Review failed.',
          onError,
        });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        exitFocusMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
  ]);
}
