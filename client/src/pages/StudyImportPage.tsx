import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { MAX_STUDY_ASYNC_IMPORT_BYTES } from '@languageflow/shared/src/studyConstants';
import type { StudyImportResult } from '@languageflow/shared/src/types';

import StudyFormField from '../components/study/StudyFormField';
import {
  cancelStudyImportUpload,
  completeStudyImportUpload,
  createStudyImportUploadSession,
  getCurrentStudyImport,
  getStudyImportStatus,
  uploadStudyImportArchive,
} from '../hooks/useStudy';

const STUDY_IMPORT_ACTIVE_JOB_STORAGE_KEY = 'study.import.activeJobId';
const STUDY_IMPORT_POLL_TIMEOUT_MS = 30 * 60 * 1000;
const STUDY_IMPORT_MAX_SIZE_GB = Math.floor(MAX_STUDY_ASYNC_IMPORT_BYTES / (1024 * 1024 * 1024));

type ImportPhase =
  | 'idle'
  | 'resuming'
  | 'uploading'
  | 'cancelling'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

function getStudyImportPollDelayMs(attempt: number): number {
  if (attempt < 5) return 2000;
  if (attempt < 17) return 5000;
  return 15000;
}

function waitForStudyImportPoll(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function isTerminalImportResult(result: StudyImportResult): boolean {
  return result.status === 'completed' || result.status === 'failed';
}

const StudyImportPage = () => {
  const { t } = useTranslation('study');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<StudyImportResult | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const activeImportJobIdRef = useRef<string | null>(null);
  const phaseRef = useRef<ImportPhase>('idle');

  const isBusy =
    phase === 'resuming' ||
    phase === 'uploading' ||
    phase === 'cancelling' ||
    phase === 'queued' ||
    phase === 'processing';

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearActiveImportJob = useCallback(() => {
    activeImportJobIdRef.current = null;
    window.localStorage.removeItem(STUDY_IMPORT_ACTIVE_JOB_STORAGE_KEY);
  }, []);

  const storeActiveImportJob = useCallback((importJobId: string) => {
    activeImportJobIdRef.current = importJobId;
    window.localStorage.setItem(STUDY_IMPORT_ACTIVE_JOB_STORAGE_KEY, importJobId);
  }, []);

  const applyTerminalResult = useCallback(
    (result: StudyImportResult) => {
      setImportResult(result);
      setPhase(result.status === 'completed' ? 'completed' : 'failed');
      if (result.status === 'failed' && result.errorMessage) {
        setError(result.errorMessage);
      }
      clearActiveImportJob();
    },
    [clearActiveImportJob]
  );

  const pollImportResult = useCallback(
    async (importJobId: string): Promise<StudyImportResult> => {
      const startedAt = Date.now();
      let attempts = 0;

      // Poll sequentially so we never overlap status requests for the same import job.
      /* eslint-disable no-await-in-loop */
      while (Date.now() - startedAt < STUDY_IMPORT_POLL_TIMEOUT_MS) {
        const result = await getStudyImportStatus(importJobId);
        setImportResult(result);

        if (isTerminalImportResult(result)) {
          applyTerminalResult(result);
          return result;
        }

        setPhase(result.status === 'pending' ? 'queued' : 'processing');
        await waitForStudyImportPoll(getStudyImportPollDelayMs(attempts));
        attempts += 1;
      }
      /* eslint-enable no-await-in-loop */

      throw new Error(t('import.processingTimedOut'));
    },
    [applyTerminalResult, t]
  );

  useEffect(() => {
    let cancelled = false;

    const resumeImport = async () => {
      try {
        setPhase('resuming');
        const storedImportJobId = window.localStorage.getItem(STUDY_IMPORT_ACTIVE_JOB_STORAGE_KEY);
        const result = storedImportJobId
          ? await getStudyImportStatus(storedImportJobId)
          : await getCurrentStudyImport();

        if (cancelled) return;

        if (!result) {
          setPhase('idle');
          return;
        }

        setImportResult(result);
        if (isTerminalImportResult(result)) {
          applyTerminalResult(result);
          return;
        }

        storeActiveImportJob(result.id);
        setPhase(result.status === 'pending' ? 'queued' : 'processing');
        await pollImportResult(result.id);
      } catch {
        if (!cancelled) {
          setPhase('idle');
        }
      }
    };

    resumeImport().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [applyTerminalResult, pollImportResult, storeActiveImportJob]);

  useEffect(
    () => () => {
      if (phaseRef.current !== 'uploading') return;
      uploadAbortControllerRef.current?.abort();
      const importJobId = activeImportJobIdRef.current;
      if (importJobId) {
        cancelStudyImportUpload(importJobId).catch(() => {});
      }
    },
    []
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
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import.uploadCancelled'));
    } finally {
      clearActiveImportJob();
      uploadAbortControllerRef.current = null;
      setPhase('failed');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError(t('import.chooseFirst'));
      return;
    }

    if (file.size > MAX_STUDY_ASYNC_IMPORT_BYTES) {
      setError(t('import.tooLarge', { maxGb: STUDY_IMPORT_MAX_SIZE_GB }));
      return;
    }

    try {
      setPhase('uploading');
      setUploadProgress(0);
      setError(null);
      setImportResult(null);
      const uploadAbortController = new AbortController();
      uploadAbortControllerRef.current = uploadAbortController;
      const session = await createStudyImportUploadSession(file);
      storeActiveImportJob(session.importJob.id);
      setImportResult(session.importJob);
      await uploadStudyImportArchive(session, file, {
        onProgress: setUploadProgress,
        signal: uploadAbortController.signal,
      });
      uploadAbortControllerRef.current = null;

      setPhase('queued');
      const queuedResult = await completeStudyImportUpload(session.importJob.id);
      setImportResult(queuedResult);

      const finalResult = await pollImportResult(session.importJob.id);
      setPhase(finalResult.status === 'completed' ? 'completed' : 'failed');
      if (finalResult.status === 'failed' && finalResult.errorMessage) {
        setError(finalResult.errorMessage);
      }
    } catch (err) {
      const hadActiveUpload = uploadAbortControllerRef.current !== null;
      uploadAbortControllerRef.current = null;
      setPhase('failed');
      setError(err instanceof Error ? err.message : t('import.failed'));
      const importJobId = activeImportJobIdRef.current;
      if (hadActiveUpload && importJobId) {
        await cancelStudyImportUpload(importJobId).catch(() => {});
        clearActiveImportJob();
      }
    }
  };

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="text-3xl font-bold text-navy mb-3">{t('import.title')}</h1>
        <p className="text-gray-600">
          <Trans
            i18nKey="import.description"
            ns="study"
            components={[
              <span key="strong" className="font-semibold" />,
              <span key="unused-1" />,
              <span key="unused-2" />,
              <code key="code" className="mx-1 rounded bg-gray-100 px-2 py-1" />,
            ]}
          />
        </p>
      </section>

      <section className="card retro-paper-panel max-w-3xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <StudyFormField htmlFor="study-colpkg" label={t('import.fieldLabel')}>
            <input
              id="study-colpkg"
              type="file"
              accept=".colpkg"
              onChange={(event) => {
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

                if (nextFile.size > MAX_STUDY_ASYNC_IMPORT_BYTES) {
                  setFile(null);
                  setError(t('import.tooLarge', { maxGb: STUDY_IMPORT_MAX_SIZE_GB }));
                  setImportResult(null);
                  return;
                }

                setFile(nextFile);
                setError(null);
                setImportResult(null);
                setPhase('idle');
                setUploadProgress(0);
              }}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>

          <div className="rounded-2xl bg-cream/70 p-4 text-sm text-gray-700">
            <p className="font-semibold text-navy">{t('import.behaviorTitle')}</p>
            <p className="mt-1">{t('import.behaviorDeck')}</p>
            <p className="mt-1">{t('import.behaviorMedia')}</p>
            <p className="mt-1">{t('import.largeFileHint', { maxGb: STUDY_IMPORT_MAX_SIZE_GB })}</p>
          </div>

          {file ? (
            <p className="text-sm text-gray-600">
              {t('import.selectedFile', {
                filename: file.name,
                sizeMb: (file.size / (1024 * 1024)).toFixed(1),
              })}
            </p>
          ) : null}

          {phase === 'resuming' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">{t('import.resuming')}</p>
            </div>
          ) : null}

          {phase === 'uploading' ? (
            <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <p className="font-medium">
                {t('import.uploading', {
                  progressPercent: Math.round(uploadProgress * 100),
                })}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-sky-100">
                <div
                  className="h-full rounded-full bg-sky-500 transition-[width]"
                  style={{ width: `${String(Math.round(uploadProgress * 100))}%` }}
                />
              </div>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="rounded-full border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-100"
              >
                {t('import.cancelUpload')}
              </button>
            </div>
          ) : null}

          {phase === 'queued' || phase === 'processing' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">
                {phase === 'queued' ? t('import.queued') : t('import.processing')}
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {importResult && importResult.status === 'completed' ? (
            <div className="space-y-2 text-sm text-emerald-700">
              <p>
                {t('import.success', {
                  cardCount: importResult.preview.cardCount,
                  reviewLogCount: importResult.preview.reviewLogCount,
                  deckName: importResult.deckName,
                })}
              </p>
              {importResult.preview.skippedMediaCount > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                  <p className="font-medium">
                    {t('import.skippedMedia', {
                      count: importResult.preview.skippedMediaCount,
                    })}
                  </p>
                  {importResult.preview.warnings.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {importResult.preview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? t('import.importing') : t('import.submit')}
            </button>
            <Link
              to="/app/study"
              className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
            >
              {t('import.back')}
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
};

export default StudyImportPage;
