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
  const scheduledRequestRef = useRef<StudyDraftSaveRequest | null>(null);
  const saveTailRef = useRef<Promise<void>>(Promise.resolve());

  const cancelScheduledSave = useCallback(() => {
    if (scheduledSaveRef.current === null) return;

    window.clearTimeout(scheduledSaveRef.current);
    scheduledSaveRef.current = null;
    scheduledRequestRef.current = null;
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
      scheduledRequestRef.current = request;
      scheduledSaveRef.current = window.setTimeout(() => {
        scheduledSaveRef.current = null;
        const scheduledRequest = scheduledRequestRef.current;
        scheduledRequestRef.current = null;
        if (scheduledRequest) enqueueSave(scheduledRequest).catch(() => undefined);
      }, delayMs);
    },
    [cancelScheduledSave, enqueueSave]
  );

  const flushScheduledSave = useCallback(() => {
    if (scheduledSaveRef.current === null) return null;

    window.clearTimeout(scheduledSaveRef.current);
    scheduledSaveRef.current = null;
    const scheduledRequest = scheduledRequestRef.current;
    scheduledRequestRef.current = null;
    return scheduledRequest ? enqueueSave(scheduledRequest) : null;
  }, [enqueueSave]);

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
    flushScheduledSave,
    scheduleSave,
    waitForIdle,
  };
};

export default useStudyDraftAutosaveQueue;
