import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { StudyImportResult } from '@shared/types';
import { MAX_STUDY_IMPORT_BYTES } from '@languageflow/shared/src/studyConstants';

import StudyFormField from '../components/study/StudyFormField';
import { uploadStudyImport } from '../hooks/useStudy';

const StudyImportPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<StudyImportResult | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a .colpkg file first.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setImportResult(null);
      const result = await uploadStudyImport(file);
      setImportResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="text-3xl font-bold text-navy mb-3">Import Anki deck</h1>
        <p className="text-gray-600">
          V1 imports only the <span className="font-semibold">日本語</span> deck from a full
          <code className="mx-1 rounded bg-gray-100 px-2 py-1">.colpkg</code>
          backup so ConvoLab can preserve scheduler state, review history, and media references.
        </p>
      </section>

      <section className="card retro-paper-panel max-w-3xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <StudyFormField htmlFor="study-colpkg" label="Anki collection backup">
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
                  setError('Please choose a .colpkg Anki collection backup.');
                  setImportResult(null);
                  return;
                }

                if (nextFile.size > MAX_STUDY_IMPORT_BYTES) {
                  setFile(null);
                  setError('Please choose a .colpkg file that is 200 MB or smaller.');
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
            <p className="font-semibold text-navy">Import behavior</p>
            <p className="mt-1">Only cards from the `日本語` deck are ingested in this version.</p>
            <p className="mt-1">
              Imported media is preserved when present, and missing answer-side audio is backfilled
              through ConvoLab TTS when cards are first used.
            </p>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {importResult ? (
            <div className="space-y-2 text-sm text-emerald-700">
              <p>
                Imported {importResult.preview.cardCount} cards and{' '}
                {importResult.preview.reviewLogCount} review logs from {importResult.deckName}.
              </p>
              {importResult.preview.skippedMediaCount > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                  <p className="font-medium">
                    Skipped {importResult.preview.skippedMediaCount} unsafe or missing media
                    reference
                    {importResult.preview.skippedMediaCount === 1 ? '' : 's'}.
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
              {isUploading ? 'Importing…' : 'Import .colpkg'}
            </button>
            <Link
              to="/app/study"
              className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
            >
              Back to study
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
};

export default StudyImportPage;
