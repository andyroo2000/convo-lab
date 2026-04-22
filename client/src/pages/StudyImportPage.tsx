import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import type { StudyImportResult } from '@languageflow/shared/src/types';
import { MAX_STUDY_IMPORT_BYTES } from '@languageflow/shared/src/studyConstants';

import StudyFormField from '../components/study/StudyFormField';
import { uploadStudyImport } from '../hooks/useStudy';

const StudyImportPage = () => {
  const { t } = useTranslation('study');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<StudyImportResult | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError(t('import.chooseFirst'));
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setImportResult(null);
      const result = await uploadStudyImport(file);
      setImportResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import.failed'));
    } finally {
      setIsUploading(false);
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

                if (nextFile.size > MAX_STUDY_IMPORT_BYTES) {
                  setFile(null);
                  setError(t('import.tooLarge'));
                  setImportResult(null);
                  return;
                }

                setFile(nextFile);
                setError(null);
                setImportResult(null);
              }}
              className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
            />
          </StudyFormField>

          <div className="rounded-2xl bg-cream/70 p-4 text-sm text-gray-700">
            <p className="font-semibold text-navy">{t('import.behaviorTitle')}</p>
            <p className="mt-1">{t('import.behaviorDeck')}</p>
            <p className="mt-1">{t('import.behaviorMedia')}</p>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {importResult ? (
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
              disabled={isUploading}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? t('import.importing') : t('import.submit')}
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
