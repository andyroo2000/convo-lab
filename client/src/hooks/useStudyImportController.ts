import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyImportResult } from '@languageflow/shared/src/types';

import {
  cancelStudyImportUpload,
  completeStudyImportUpload,
  createStudyImportUploadSession,
  getCurrentStudyImport,
  getStudyImportStatus,
  uploadStudyImportArchive,
} from './useStudy';

const STUDY_IMPORT_ACTIVE_JOB_STORAGE_KEY = 'study.import.activeJobId';
const STUDY_IMPORT_POLL_TIMEOUT_MS = 30 * 60 * 1000;

export type ImportPhase =
  | 'idle'
  | 'resuming'
  | 'uploading'
  | 'cancelling'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

interface StudyImportControllerOptions {
  maxArchiveBytes?: number;
  maxArchiveGb: number | null;
}

interface ImportPollingCallbacks {
  onResult: (result: StudyImportResult) => void;
  onTerminal: (result: StudyImportResult) => void;
  onProgress: (result: StudyImportResult) => void;
  timeoutMessage: string;
}

interface ImportSubmissionCallbacks {
  onProgress: (progress: number) => void;
  onResult: (result: StudyImportResult) => void;
  onPhase: (phase: ImportPhase) => void;
  pollResult: (importJobId: string, signal: AbortSignal) => Promise<StudyImportResult>;
  storeJob: (importJobId: string) => void;
  uploadAbortRef: MutableRefObject<AbortController | null>;
  pollAbortRef: MutableRefObject<AbortController | null>;
}

interface TerminalResultCallbacks {
  clearJob: () => void;
  onError: (error: string) => void;
  onPhase: (phase: ImportPhase) => void;
  onResult: (result: StudyImportResult) => void;
}

interface SubmitFailureCallbacks {
  activeImportJobId: string | null;
  clearJob: () => void;
  fallbackMessage: string;
  hadActiveUpload: boolean;
  onError: (message: string) => void;
  onPhase: (phase: ImportPhase) => void;
}

function getStudyImportPollDelayMs(attempt: number): number {
  if (attempt < 5) return 2000;
  if (attempt < 17) return 5000;
  return 15000;
}

function createImportPollingAbortError(): Error {
  const error = new Error('Import polling cancelled');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function waitForStudyImportPoll(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createImportPollingAbortError());
  }

  return new Promise((resolve, reject) => {
    let timeoutId = 0;
    const abortHandler = () => {
      window.clearTimeout(timeoutId);
      reject(createImportPollingAbortError());
    };
    timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', abortHandler);
      resolve();
    }, delayMs);

    signal?.addEventListener('abort', abortHandler, { once: true });
  });
}

function isTerminalImportResult(result: StudyImportResult): boolean {
  return result.status === 'completed' || result.status === 'failed';
}

function activePhaseFor(result: StudyImportResult): ImportPhase {
  return result.status === 'pending' ? 'queued' : 'processing';
}

function clearMatchingAbortController(
  ref: MutableRefObject<AbortController | null>,
  controller: AbortController
): void {
  const targetRef = ref;
  if (targetRef.current === controller) targetRef.current = null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function pollStudyImportResult(
  importJobId: string,
  signal: AbortSignal | undefined,
  callbacks: ImportPollingCallbacks
): Promise<StudyImportResult> {
  const startedAt = Date.now();
  let attempts = 0;

  /* eslint-disable no-await-in-loop */
  while (Date.now() - startedAt < STUDY_IMPORT_POLL_TIMEOUT_MS) {
    if (signal?.aborted) throw createImportPollingAbortError();
    const result = await getStudyImportStatus(importJobId, { signal });
    callbacks.onResult(result);
    if (isTerminalImportResult(result)) {
      callbacks.onTerminal(result);
      return result;
    }
    callbacks.onProgress(result);
    await waitForStudyImportPoll(getStudyImportPollDelayMs(attempts), signal);
    attempts += 1;
  }
  /* eslint-enable no-await-in-loop */

  throw new Error(callbacks.timeoutMessage);
}

function applyTerminalImportResult(
  result: StudyImportResult,
  callbacks: TerminalResultCallbacks
): void {
  callbacks.onResult(result);
  callbacks.onPhase(result.status === 'completed' ? 'completed' : 'failed');
  if (result.status === 'failed' && result.errorMessage) {
    callbacks.onError(result.errorMessage);
  }
  callbacks.clearJob();
}

async function findResumableImport(signal: AbortSignal): Promise<StudyImportResult | null> {
  const storedImportJobId = window.localStorage.getItem(STUDY_IMPORT_ACTIVE_JOB_STORAGE_KEY);
  return storedImportJobId
    ? getStudyImportStatus(storedImportJobId, { signal })
    : getCurrentStudyImport({ signal });
}

async function resumeStudyImport(
  signal: AbortSignal,
  isCancelled: () => boolean,
  callbacks: {
    onPhase: (phase: ImportPhase) => void;
    onResult: (result: StudyImportResult) => void;
    onTerminal: (result: StudyImportResult) => void;
    pollResult: (importJobId: string, signal: AbortSignal) => Promise<StudyImportResult>;
    storeJob: (importJobId: string) => void;
  }
): Promise<void> {
  callbacks.onPhase('resuming');
  const result = await findResumableImport(signal);
  if (isCancelled()) return;
  if (!result) {
    callbacks.onPhase('idle');
    return;
  }
  callbacks.onResult(result);
  if (isTerminalImportResult(result)) {
    callbacks.onTerminal(result);
    return;
  }
  callbacks.storeJob(result.id);
  callbacks.onPhase(activePhaseFor(result));
  await callbacks.pollResult(result.id, signal);
}

function handleResumeError(
  error: unknown,
  isCancelled: () => boolean,
  onPhase: (phase: ImportPhase) => void
): void {
  if (!isCancelled() && !isAbortError(error)) onPhase('idle');
}

async function submitStudyImport(file: File, callbacks: ImportSubmissionCallbacks): Promise<void> {
  const { pollAbortRef, uploadAbortRef } = callbacks;
  callbacks.onPhase('uploading');
  callbacks.onProgress(0);
  const uploadController = new AbortController();
  uploadAbortRef.current = uploadController;
  const session = await createStudyImportUploadSession(file);
  callbacks.storeJob(session.importJob.id);
  callbacks.onResult(session.importJob);
  await uploadStudyImportArchive(session, file, {
    onProgress: callbacks.onProgress,
    signal: uploadController.signal,
  });
  uploadAbortRef.current = null;
  callbacks.onPhase('queued');
  callbacks.onResult(await completeStudyImportUpload(session.importJob.id));

  const pollController = new AbortController();
  pollAbortRef.current?.abort();
  pollAbortRef.current = pollController;
  try {
    await callbacks.pollResult(session.importJob.id, pollController.signal);
  } finally {
    clearMatchingAbortController(pollAbortRef, pollController);
  }
}

async function handleSubmitFailure(
  error: unknown,
  callbacks: SubmitFailureCallbacks
): Promise<void> {
  callbacks.onPhase('failed');
  callbacks.onError(errorMessage(error, callbacks.fallbackMessage));
  if (callbacks.hadActiveUpload && callbacks.activeImportJobId) {
    await cancelStudyImportUpload(callbacks.activeImportJobId).catch(() => {});
    callbacks.clearJob();
  }
}

function useImportJobStorage() {
  const activeImportJobIdRef = useRef<string | null>(null);

  const clearActiveImportJob = useCallback(() => {
    activeImportJobIdRef.current = null;
    window.localStorage.removeItem(STUDY_IMPORT_ACTIVE_JOB_STORAGE_KEY);
  }, []);

  const storeActiveImportJob = useCallback((importJobId: string) => {
    activeImportJobIdRef.current = importJobId;
    window.localStorage.setItem(STUDY_IMPORT_ACTIVE_JOB_STORAGE_KEY, importJobId);
  }, []);

  return { activeImportJobIdRef, clearActiveImportJob, storeActiveImportJob };
}

function useLatestImportPhase(phase: ImportPhase): MutableRefObject<ImportPhase> {
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  return phaseRef;
}

export function useStudyImportController({
  maxArchiveBytes,
  maxArchiveGb,
}: StudyImportControllerOptions) {
  const { t } = useTranslation('study');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<StudyImportResult | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const pollAbortControllerRef = useRef<AbortController | null>(null);
  const phaseRef = useLatestImportPhase(phase);
  const { activeImportJobIdRef, clearActiveImportJob, storeActiveImportJob } =
    useImportJobStorage();

  const applyTerminalResult = useCallback(
    (result: StudyImportResult) =>
      applyTerminalImportResult(result, {
        onResult: setImportResult,
        onPhase: setPhase,
        onError: setError,
        clearJob: clearActiveImportJob,
      }),
    [clearActiveImportJob]
  );

  const pollImportResult = useCallback(
    (importJobId: string, signal?: AbortSignal) =>
      pollStudyImportResult(importJobId, signal, {
        onResult: setImportResult,
        onTerminal: applyTerminalResult,
        onProgress: (result) => setPhase(activePhaseFor(result)),
        timeoutMessage: t('import.processingTimedOut'),
      }),
    [applyTerminalResult, t]
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    pollAbortControllerRef.current?.abort();
    pollAbortControllerRef.current = controller;

    const isCancelled = () => cancelled;
    resumeStudyImport(controller.signal, isCancelled, {
      onPhase: setPhase,
      onResult: setImportResult,
      onTerminal: applyTerminalResult,
      pollResult: pollImportResult,
      storeJob: storeActiveImportJob,
    })
      .catch((resumeError: unknown) => handleResumeError(resumeError, isCancelled, setPhase))
      .finally(() => clearMatchingAbortController(pollAbortControllerRef, controller));
    return () => {
      cancelled = true;
      controller.abort();
      clearMatchingAbortController(pollAbortControllerRef, controller);
    };
  }, [applyTerminalResult, pollImportResult, storeActiveImportJob]);

  useEffect(
    () => () => {
      pollAbortControllerRef.current?.abort();
      pollAbortControllerRef.current = null;
      if (phaseRef.current !== 'uploading') return;
      uploadAbortControllerRef.current?.abort();
      const importJobId = activeImportJobIdRef.current;
      if (importJobId) cancelStudyImportUpload(importJobId).catch(() => {});
    },
    [activeImportJobIdRef, phaseRef]
  );

  const handleCancelUpload = async () => {
    uploadAbortControllerRef.current?.abort();
    uploadAbortControllerRef.current = null;
    const importJobId = activeImportJobIdRef.current;
    if (!importJobId) {
      setPhase('failed');
      setError(t('import.uploadCancelled'));
      return;
    }

    try {
      setPhase('cancelling');
      const result = await cancelStudyImportUpload(importJobId);
      setImportResult(result);
      setError(result.errorMessage ?? t('import.uploadCancelled'));
    } catch (cancelError) {
      setError(errorMessage(cancelError, t('import.uploadCancelled')));
    } finally {
      clearActiveImportJob();
      uploadAbortControllerRef.current = null;
      setPhase('failed');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError(t('import.chooseFirst'));
      return;
    }
    if (!maxArchiveBytes || maxArchiveGb === null) return;
    if (file.size > maxArchiveBytes) {
      setError(t('import.tooLarge', { maxGb: maxArchiveGb }));
      return;
    }

    setError(null);
    setImportResult(null);
    try {
      await submitStudyImport(file, {
        onProgress: setUploadProgress,
        onResult: setImportResult,
        onPhase: setPhase,
        pollResult: pollImportResult,
        storeJob: storeActiveImportJob,
        uploadAbortRef: uploadAbortControllerRef,
        pollAbortRef: pollAbortControllerRef,
      });
    } catch (submitError) {
      const hadActiveUpload = uploadAbortControllerRef.current !== null;
      uploadAbortControllerRef.current = null;
      await handleSubmitFailure(submitError, {
        fallbackMessage: t('import.failed'),
        activeImportJobId: activeImportJobIdRef.current,
        hadActiveUpload,
        clearJob: clearActiveImportJob,
        onError: setError,
        onPhase: setPhase,
      });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      setFile(null);
      setError(null);
      setImportResult(null);
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith('.colpkg')) {
      setFile(null);
      setError(t('import.wrongExtension'));
      setImportResult(null);
      return;
    }
    if (maxArchiveBytes && nextFile.size > maxArchiveBytes) {
      setFile(null);
      setError(t('import.tooLarge', { maxGb: maxArchiveGb }));
      setImportResult(null);
      return;
    }
    setFile(nextFile);
    setError(null);
    setImportResult(null);
    setPhase('idle');
    setUploadProgress(0);
  };

  const isBusy = ['resuming', 'uploading', 'cancelling', 'queued', 'processing'].includes(phase);
  return {
    error,
    file,
    handleCancelUpload,
    handleFileChange,
    handleSubmit,
    importResult,
    isBusy,
    phase,
    uploadProgress,
  };
}
