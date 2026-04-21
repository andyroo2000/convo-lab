import { useCallback } from 'react';

interface BackgroundTaskOptions {
  errorMessage?: string;
  label?: string;
  onError?: (message: string) => void;
}

function toTaskErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function useStudyBackgroundTask() {
  return useCallback(
    (
      task?: Promise<unknown> | (() => Promise<unknown> | unknown),
      options?: BackgroundTaskOptions
    ) => {
      if (!task) {
        return;
      }

      const promise =
        typeof task === 'function' ? Promise.resolve().then(() => task()) : Promise.resolve(task);

      promise.catch((error) => {
        const label = options?.label ?? 'Study background task';
        const message = toTaskErrorMessage(error, options?.errorMessage ?? 'Request failed.');
        console.error(`${label} failed:`, error);
        options?.onError?.(message);
      });
    },
    []
  );
}
