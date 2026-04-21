import { useCallback, useRef } from 'react';

const DEFAULT_UNDO_STACK_LIMIT = 50;

export default function useStudyUndoStack<TAction>(maxSize: number = DEFAULT_UNDO_STACK_LIMIT) {
  const stackRef = useRef<TAction[]>([]);

  const pushUndo = useCallback(
    (action: TAction) => {
      stackRef.current.push(action);
      if (stackRef.current.length > maxSize) {
        stackRef.current.splice(0, stackRef.current.length - maxSize);
      }
    },
    [maxSize]
  );

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
