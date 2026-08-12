import { useCallback, useEffect, useRef } from 'react';
import type {
  StudyManualCardDraft,
  StudyManualCardDraftUpdateRequest,
} from '@languageflow/shared/src/types';

import {
  acknowledgeStudyDraftIntent,
  writeStudyDraftIntent,
  type StudyDraftIntent,
} from '../lib/studyDraftIntentStore';
import StudyDraftRevisionConflictError from '../lib/studyDraftRevisionConflict';

export interface StudyDraftSaveRequest {
  draftId: string;
  baseRevision: number;
  values: Omit<StudyManualCardDraftUpdateRequest, 'expectedRevision'>;
}

interface StudyDraftAutosaveQueueOptions {
  onConflict?: (intent: StudyDraftIntent, error: StudyDraftRevisionConflictError) => void;
  onSaved?: (intent: StudyDraftIntent, draft: StudyManualCardDraft) => void;
}

const useStudyDraftAutosaveQueue = (
  saveDraft: (request: {
    draftId: string;
    values: StudyManualCardDraftUpdateRequest;
  }) => Promise<StudyManualCardDraft>,
  options: StudyDraftAutosaveQueueOptions = {}
) => {
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const scheduledSaveRef = useRef<number | null>(null);
  const scheduledIntentRef = useRef<StudyDraftIntent | null>(null);
  const saveTailRef = useRef<Promise<void>>(Promise.resolve());
  const acknowledgedRevisionRef = useRef(new Map<string, number>());
  const sessionIntentIdsRef = useRef(new Set<string>());

  const cancelScheduledSave = useCallback(() => {
    if (scheduledSaveRef.current === null) return;

    window.clearTimeout(scheduledSaveRef.current);
    scheduledSaveRef.current = null;
    scheduledIntentRef.current = null;
  }, []);

  const enqueueIntent = useCallback((intent: StudyDraftIntent) => {
    const savePromise = saveTailRef.current.then(async () => {
      const acknowledgedRevision = acknowledgedRevisionRef.current.get(intent.draftId);
      const expectedRevision = Math.max(intent.baseRevision, acknowledgedRevision ?? 0);
      try {
        const draft = await saveDraftRef.current({
          draftId: intent.draftId,
          values: { ...intent.values, expectedRevision },
        });
        acknowledgedRevisionRef.current.set(intent.draftId, draft.revision);
        acknowledgeStudyDraftIntent(intent, draft.revision);
        optionsRef.current.onSaved?.(intent, draft);
        return draft;
      } catch (error) {
        if (error instanceof StudyDraftRevisionConflictError) {
          optionsRef.current.onConflict?.(intent, error);
        }
        throw error;
      }
    });
    saveTailRef.current = savePromise.then(
      () => undefined,
      () => undefined
    );
    return savePromise;
  }, []);

  const scheduleSave = useCallback(
    (request: StudyDraftSaveRequest, delayMs = 700) => {
      const intent = writeStudyDraftIntent(request);
      sessionIntentIdsRef.current.add(intent.intentId);
      cancelScheduledSave();
      scheduledIntentRef.current = intent;
      scheduledSaveRef.current = window.setTimeout(() => {
        scheduledSaveRef.current = null;
        const scheduledIntent = scheduledIntentRef.current;
        scheduledIntentRef.current = null;
        if (scheduledIntent) enqueueIntent(scheduledIntent).catch(() => undefined);
      }, delayMs);
      return intent;
    },
    [cancelScheduledSave, enqueueIntent]
  );

  const flushScheduledSave = useCallback(() => {
    if (scheduledSaveRef.current === null) return null;

    window.clearTimeout(scheduledSaveRef.current);
    scheduledSaveRef.current = null;
    const scheduledIntent = scheduledIntentRef.current;
    scheduledIntentRef.current = null;
    return scheduledIntent ? enqueueIntent(scheduledIntent) : null;
  }, [enqueueIntent]);

  const flushSave = useCallback(
    (request: StudyDraftSaveRequest) => {
      const intent = writeStudyDraftIntent(request);
      sessionIntentIdsRef.current.add(intent.intentId);
      cancelScheduledSave();
      return enqueueIntent(intent);
    },
    [cancelScheduledSave, enqueueIntent]
  );

  const replayIntent = useCallback(
    (intent: StudyDraftIntent, expectedRevision = intent.baseRevision) => {
      const replay =
        expectedRevision === intent.baseRevision
          ? intent
          : writeStudyDraftIntent({
              draftId: intent.draftId,
              baseRevision: expectedRevision,
              values: intent.values,
            });
      sessionIntentIdsRef.current.add(replay.intentId);
      return enqueueIntent(replay);
    },
    [enqueueIntent]
  );

  const waitForIdle = useCallback(async () => {
    await saveTailRef.current;
  }, []);

  const isSessionIntent = useCallback(
    (intent: StudyDraftIntent) => sessionIntentIdsRef.current.has(intent.intentId),
    []
  );

  useEffect(
    () => () => {
      flushScheduledSave()?.catch(() => undefined);
    },
    [flushScheduledSave]
  );

  return {
    cancelScheduledSave,
    flushSave,
    flushScheduledSave,
    isSessionIntent,
    replayIntent,
    scheduleSave,
    waitForIdle,
  };
};

export default useStudyDraftAutosaveQueue;
