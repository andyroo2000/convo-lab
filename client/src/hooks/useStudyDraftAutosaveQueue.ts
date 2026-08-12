import { useCallback, useEffect, useRef } from 'react';
import type { StudyManualCardDraftUpdateRequest } from '@languageflow/shared/src/types';

export interface StudyDraftSaveRequest {
  draftId: string;
  values: StudyManualCardDraftUpdateRequest;
}

const useStudyDraftAutosaveQueue = (
  saveDraft: (request: StudyDraftSaveRequest) => Promise<unknown>
) => {
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;
  const scheduledSaveRef = useRef<number | null>(null);
  const saveTailRef = useRef<Promise<void>>(Promise.resolve());

  const cancelScheduledSave = useCallback(() => {
    if (scheduledSaveRef.current === null) return;

    window.clearTimeout(scheduledSaveRef.current);
    scheduledSaveRef.current = null;
  }, []);

  const enqueueSave = useCallback((request: StudyDraftSaveRequest) => {
    const savePromise = saveTailRef.current.then(() => saveDraftRef.current(request));
    saveTailRef.current = savePromise.then(
      () => undefined,
      () => undefined
    );
    return savePromise;
  }, []);

  const scheduleSave = useCallback(
    (request: StudyDraftSaveRequest, delayMs = 700) => {
      cancelScheduledSave();
      scheduledSaveRef.current = window.setTimeout(() => {
        scheduledSaveRef.current = null;
        enqueueSave(request).catch(() => undefined);
      }, delayMs);
    },
    [cancelScheduledSave, enqueueSave]
  );

  const flushSave = useCallback(
    async (request: StudyDraftSaveRequest) => {
      cancelScheduledSave();
      await saveTailRef.current;
      return enqueueSave(request);
    },
    [cancelScheduledSave, enqueueSave]
  );

  const waitForIdle = useCallback(async () => {
    await saveTailRef.current;
  }, []);

  useEffect(() => cancelScheduledSave, [cancelScheduledSave]);

  return {
    cancelScheduledSave,
    flushSave,
    scheduleSave,
    waitForIdle,
  };
};

export default useStudyDraftAutosaveQueue;
