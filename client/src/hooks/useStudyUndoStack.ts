import { useCallback, useRef } from 'react';

export default function useStudyUndoStack<TAction>() {
  const stackRef = useRef<TAction[]>([]);

  const pushUndo = useCallback((action: TAction) => {
    stackRef.current.push(action);
  }, []);

  const popUndo = useCallback(() => stackRef.current.pop(), []);

  const resetUndo = useCallback(() => {
    stackRef.current = [];
  }, []);

  return {
    pushUndo,
    popUndo,
    resetUndo,
    stackRef,
  };
}
