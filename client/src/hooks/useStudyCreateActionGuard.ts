import { useCallback, useRef } from 'react';

const useStudyCreateActionGuard = () => {
  const activeRef = useRef(false);

  return useCallback(async <Result>(action: () => Promise<Result>) => {
    if (activeRef.current) return undefined;

    activeRef.current = true;
    try {
      return await action();
    } finally {
      activeRef.current = false;
    }
  }, []);
};

export default useStudyCreateActionGuard;
