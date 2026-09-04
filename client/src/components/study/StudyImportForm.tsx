import type { ChangeEventHandler, FormEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { StudyImportResult } from '@languageflow/shared/src/types';

import type { ImportPhase } from '../../hooks/useStudyImportController';
import StudyFormField from './StudyFormField';

interface StudyImportFormProps {
  error: string | null;
  file: File | null;
  importResult: StudyImportResult | null;
  isBusy: boolean;
  maxArchiveBytes?: number;
  maxArchiveGb: number | null;
  onCancelUpload: () => void;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  phase: ImportPhase;
  uploadProgress: number;
}

const ImportProgress = ({
  onCancelUpload,
  phase,
  uploadProgress,
}: Pick<StudyImportFormProps, 'onCancelUpload' | 'phase' | 'uploadProgress'>) => {
  const { t } = useTranslation('study');
  if (phase === 'resuming') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">{t('import.resuming')}</p>
      </div>
    );
  }
  if (phase === 'uploading') {
    const progressPercent = Math.round(uploadProgress * 100);
    return (
      <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <p className="font-medium">{t('import.uploading', { progressPercent })}</p>
        <div className="h-2 overflow-hidden rounded-full bg-sky-100">
          <div
            className="h-full rounded-full bg-sky-500 transition-[width]"
            style={{ width: `${String(progressPercent)}%` }}
          />
        </div>
        <button
          type="button"
          onClick={onCancelUpload}
          className="rounded-full border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-100"
        >
          {t('import.cancelUpload')}
        </button>
      </div>
    );
  }
  if (phase !== 'queued' && phase !== 'processing') return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">
        {phase === 'queued' ? t('import.queued') : t('import.processing')}
      </p>
    </div>
  );
};

const ImportSuccess = ({ result }: { result: StudyImportResult | null }) => {
  const { t } = useTranslation('study');
  if (result?.status !== 'completed') return null;
  return (
    <div className="space-y-2 text-sm text-emerald-700">
      <p>
        {t('import.success', {
          cardCount: result.preview.cardCount,
          reviewLogCount: result.preview.reviewLogCount,
          deckName: result.deckName,
        })}
      </p>
      {result.preview.skippedMediaCount > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            {t('import.skippedMedia', { count: result.preview.skippedMediaCount })}
          </p>
          {result.preview.warnings.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const StudyImportForm = ({
  error,
  file,
  importResult,
  isBusy,
  maxArchiveBytes,
  maxArchiveGb,
  onCancelUpload,
  onFileChange,
  onSubmit,
  phase,
  uploadProgress,
}: StudyImportFormProps) => {
  const { t } = useTranslation('study');
  return (
    <section className="card retro-paper-panel max-w-3xl">
      <form className="space-y-4" onSubmit={onSubmit}>
        <StudyFormField htmlFor="study-colpkg" label={t('import.fieldLabel')}>
          <input
            id="study-colpkg"
            type="file"
            accept=".colpkg"
            onChange={onFileChange}
            className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
          />
        </StudyFormField>

        <div className="rounded-2xl bg-cream/70 p-4 text-sm text-gray-700">
          <p className="font-semibold text-navy">{t('import.behaviorTitle')}</p>
          <p className="mt-1">{t('import.behaviorDeck')}</p>
          <p className="mt-1">{t('import.behaviorMedia')}</p>
          {maxArchiveGb === null ? null : (
            <p className="mt-1">{t('import.largeFileHint', { maxGb: maxArchiveGb })}</p>
          )}
        </div>

        {file ? (
          <p className="text-sm text-gray-600">
            {t('import.selectedFile', {
              filename: file.name,
              sizeMb: (file.size / (1024 * 1024)).toFixed(1),
            })}
          </p>
        ) : null}
        <ImportProgress
          onCancelUpload={onCancelUpload}
          phase={phase}
          uploadProgress={uploadProgress}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <ImportSuccess result={importResult} />

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isBusy || !file || !maxArchiveBytes}
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
  );
};

export default StudyImportForm;
