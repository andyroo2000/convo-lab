import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
} from '@languageflow/shared/src/studyConstants';

import StudyCardFormFields from '../components/study/StudyCardFormFields';
import StudyCandidateDraftList from '../components/study/StudyCandidateDraftList';
import { useStudyCardForm } from '../components/study/studyCardFormModel';
import useGeneratedStudyCandidates from '../hooks/useGeneratedStudyCandidates';
import { useCreateStudyCard } from '../hooks/useStudy';

type CreateMode = 'generate' | 'manual';

const StudyCreatePage = () => {
  const { t } = useTranslation('study');
  const createCard = useCreateStudyCard();
  const [mode, setMode] = useState<CreateMode>('generate');
  const [targetText, setTargetText] = useState('');
  const [context, setContext] = useState('');
  const [includeLearnerContext, setIncludeLearnerContext] = useState(true);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const generated = useGeneratedStudyCandidates();
  const { values, setField, setCardType, reset, buildPayload } = useStudyCardForm({
    initialCardType: 'recognition',
  });

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualSuccess(null);
    const payload = buildPayload();

    try {
      const created = await createCard.mutateAsync(payload);

      setManualSuccess(t('create.success', { cardType: created.cardType }));
      reset();
    } catch {
      // React Query stores the mutation error for the visible form message.
    }
  };

  const handleGenerateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await generated.generate({
        targetText,
        context,
        includeLearnerContext,
      });
    } catch {
      // React Query stores the mutation error for the visible form message.
    }
  };

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel max-w-4xl">
        <h1 className="mb-3 text-3xl font-bold text-navy">{t('create.title')}</h1>
        <p className="text-gray-600">{t('create.description')}</p>
        <div className="mt-5 inline-flex rounded-full border border-gray-200 bg-white p-1">
          {(['generate', 'manual'] as const).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              onClick={() => {
                setMode(nextMode);
                generated.setSuccess(null);
                setManualSuccess(null);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                mode === nextMode
                  ? 'bg-navy text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-navy'
              }`}
            >
              {t(`create.${nextMode}`)}
            </button>
          ))}
        </div>
      </section>

      {mode === 'generate' ? (
        <section className="card retro-paper-panel max-w-4xl">
          <form
            className="space-y-4"
            data-testid="study-generate-form"
            onSubmit={handleGenerateSubmit}
          >
            <div className="block">
              <label
                htmlFor="study-generate-target"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                {t('create.targetText')}
              </label>
              <textarea
                id="study-generate-target"
                value={targetText}
                onChange={(event) => setTargetText(event.target.value)}
                maxLength={STUDY_CANDIDATE_TARGET_MAX_LENGTH}
                className="block min-h-28 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
                required
              />
            </div>
            <div className="block">
              <label
                htmlFor="study-generate-context"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                {t('create.context')}
              </label>
              <textarea
                id="study-generate-context"
                value={context}
                onChange={(event) => setContext(event.target.value)}
                maxLength={STUDY_CANDIDATE_CONTEXT_MAX_LENGTH}
                className="block min-h-24 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="study-generate-learner-context"
                type="checkbox"
                checked={includeLearnerContext}
                onChange={(event) => setIncludeLearnerContext(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label
                htmlFor="study-generate-learner-context"
                className="text-sm font-medium text-gray-700"
              >
                {t('create.useLearnerContext')}
              </label>
            </div>

            {generated.generateCandidates.error ? (
              <p className="text-sm text-red-600">
                {generated.generateCandidates.error instanceof Error
                  ? generated.generateCandidates.error.message
                  : t('create.generateFailed')}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={
                generated.generateCandidates.isPending ||
                generated.isCandidateAudioRegenerating ||
                generated.isCandidateImageRegenerating
              }
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generated.generateCandidates.isPending
                ? t('create.generating')
                : t('create.generateSubmit')}
            </button>
          </form>
        </section>
      ) : (
        <section className="card retro-paper-panel max-w-3xl">
          <form className="space-y-4" onSubmit={handleManualSubmit}>
            <StudyCardFormFields
              values={values}
              idPrefix="study"
              includeCardTypeSelect
              onCardTypeChange={setCardType}
              onFieldChange={setField}
            />

            {createCard.error ? (
              <p className="text-sm text-red-600">
                {createCard.error instanceof Error ? createCard.error.message : t('create.failed')}
              </p>
            ) : null}
            {manualSuccess ? <p className="text-sm text-emerald-700">{manualSuccess}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={createCard.isPending}
                className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createCard.isPending ? t('create.creating') : t('create.submit')}
              </button>
              <Link
                to="/app/study"
                className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
              >
                {t('create.back')}
              </Link>
            </div>
          </form>
        </section>
      )}

      {generated.candidateDrafts.length > 0 ? (
        <StudyCandidateDraftList
          candidateDrafts={generated.candidateDrafts}
          commitError={generated.commitCandidates.error}
          isCommitPending={generated.commitCandidates.isPending}
          learnerContextSummary={generated.learnerContextSummary}
          onCommitCandidates={generated.commit}
          onRegenerateCandidateAudio={generated.handleRegenerateCandidateAudio}
          onRegenerateCandidateImage={generated.handleRegenerateCandidateImage}
          onToggleCandidate={generated.toggleCandidate}
          onUpdateCandidateImagePrompt={generated.updateCandidateImagePrompt}
          onUpdateCandidateField={generated.updateCandidateField}
          previewDraftIndex={generated.previewDraftIndex}
          regenerateErrorByCandidateId={generated.regenerateErrorByCandidateId}
          regenerateImageErrorByCandidateId={generated.regenerateImageErrorByCandidateId}
          regeneratingCandidateId={generated.regeneratingCandidateId}
          regeneratingImageCandidateId={generated.regeneratingImageCandidateId}
          selectedCount={generated.selectedCount}
          setPreviewDraftIndex={generated.setPreviewDraftIndex}
          success={generated.success}
        />
      ) : null}

      {generated.candidateDrafts.length === 0 && generated.success ? (
        <section className="card retro-paper-panel max-w-4xl">
          <p className="text-sm text-emerald-700">{generated.success}</p>
        </section>
      ) : null}
    </div>
  );
};

export default StudyCreatePage;
