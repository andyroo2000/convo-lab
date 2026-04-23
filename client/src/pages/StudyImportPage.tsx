import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import type { StudyImportResult } from '@languageflow/shared/src/types';

import StudyFormField from '../components/study/StudyFormField';
import {
  completeStudyImportUpload,
  createStudyImportUploadSession,
  getStudyImportStatus,
  uploadStudyImportArchive,
} from '../hooks/useStudy';

const STUDY_IMPORT_POLL_INTERVAL_MS = 2000;
const STUDY_IMPORT_POLL_ATTEMPTS_MAX = 600;

type ImportPhase = 'idle' | 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';

const StudyImportPage = () => {
  const { t } = useTranslation('study');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<StudyImportResult | null>(null);

  const isBusy = phase === 'uploading' || phase === 'queued' || phase === 'processing';

  const pollImportResult = async (importJobId: string): Promise<StudyImportResult> => {
    // Poll sequentially so we never overlap status requests for the same import job.
    /* eslint-disable no-await-in-loop */
    for (let attempts = 0; attempts < STUDY_IMPORT_POLL_ATTEMPTS_MAX; attempts += 1) {
      const result = await getStudyImportStatus(importJobId);
      setImportResult(result);

      if (result.status === 'completed' || result.status === 'failed') {
        return result;
      }

      setPhase(result.status === 'pending' ? 'queued' : 'processing');
      await new Promise((resolve) => {
        window.setTimeout(resolve, STUDY_IMPORT_POLL_INTERVAL_MS);
      });
    }
    /* eslint-enable no-await-in-loop */

    throw new Error(t('import.processingTimedOut'));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError(t('import.chooseFirst'));
      return;
    }

    try {
      setPhase('uploading');
      setUploadProgress(0);
      setError(null);
      setImportResult(null);
      const session = await createStudyImportUploadSession(file);
      setImportResult(session.importJob);
      await uploadStudyImportArchive(session, file, setUploadProgress);

      setPhase('queued');
      const queuedResult = await completeStudyImportUpload(session.importJob.id);
      setImportResult(queuedResult);

      const finalResult = await pollImportResult(session.importJob.id);
      setPhase(finalResult.status === 'completed' ? 'completed' : 'failed');
      if (finalResult.status === 'failed' && finalResult.errorMessage) {
        setError(finalResult.errorMessage);
      }
    } catch (err) {
      setPhase('failed');
      setError(err instanceof Error ? err.message : t('import.failed'));
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
          </div>

          {file ? (
            <p className="text-sm text-gray-600">
              {t('import.selectedFile', {
                filename: file.name,
                sizeMb: (file.size / (1024 * 1024)).toFixed(1),
              })}
            </p>
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
