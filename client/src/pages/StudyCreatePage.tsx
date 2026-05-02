import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
} from '@languageflow/shared/src/studyConstants';

import StudyCardFormFields from '../components/study/StudyCardFormFields';
import StudyCandidateDraftList from '../components/study/StudyCandidateDraftList';
import { useStudyCardForm, type StudyCardFormValues } from '../components/study/studyCardFormModel';
import {
  buildStudyCandidateCommitItem,
  createStudyCandidateDraft,
  STUDY_CANDIDATE_AUDIO_AFFECTING_FIELDS,
  type StudyCandidateDraft,
} from '../components/study/studyCandidateModel';
import {
  useCommitStudyCardCandidates,
  useCreateStudyCard,
  useGenerateStudyCardCandidates,
  useRegenerateStudyCardCandidatePreviewAudio,
} from '../hooks/useStudy';

type CreateMode = 'generate' | 'manual';

const StudyCreatePage = () => {
  const { t } = useTranslation('study');
  const createCard = useCreateStudyCard();
  const generateCandidates = useGenerateStudyCardCandidates();
  const commitCandidates = useCommitStudyCardCandidates();
  const regenerateCandidateAudio = useRegenerateStudyCardCandidatePreviewAudio();
  const [mode, setMode] = useState<CreateMode>('generate');
  const [success, setSuccess] = useState<string | null>(null);
  const [targetText, setTargetText] = useState('');
  const [context, setContext] = useState('');
  const [includeLearnerContext, setIncludeLearnerContext] = useState(true);
  const [learnerContextSummary, setLearnerContextSummary] = useState<string | null>(null);
  const [candidateDrafts, setCandidateDrafts] = useState<StudyCandidateDraft[]>([]);
  const [regeneratingCandidateId, setRegeneratingCandidateId] = useState<string | null>(null);
  const [regenerateErrorByCandidateId, setRegenerateErrorByCandidateId] = useState<
    Record<string, string>
  >({});
  const [previewDraftIndex, setPreviewDraftIndex] = useState<number | null>(null);
  const { values, setField, setCardType, reset, buildPayload } = useStudyCardForm({
    initialCardType: 'recognition',
  });
  const isCandidateAudioRegenerating = regeneratingCandidateId !== null;

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);
    const payload = buildPayload();

    try {
      const created = await createCard.mutateAsync(payload);

      setSuccess(t('create.success', { cardType: created.cardType }));
      reset();
    } catch {
      // React Query stores the mutation error for the visible form message.
    }
  };

  const handleGenerateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);
    setLearnerContextSummary(null);
    setCandidateDrafts([]);
    setRegenerateErrorByCandidateId({});
    setPreviewDraftIndex(null);

    try {
      const result = await generateCandidates.mutateAsync({
        targetText,
        context,
        includeLearnerContext,
      });

      setLearnerContextSummary(result.learnerContextSummary ?? null);
      setCandidateDrafts(result.candidates.map(createStudyCandidateDraft));
    } catch {
      // React Query stores the mutation error for the visible form message.
    }
  };

  const updateCandidateField = <K extends keyof StudyCardFormValues>(
    index: number,
    field: K,
    value: StudyCardFormValues[K]
  ) => {
    setCandidateDrafts((current) =>
      current.map((draft, draftIndex) => {
        if (draftIndex !== index) return draft;
        return {
          ...draft,
          values: {
            ...draft.values,
            [field]: value,
          },
          previewAudio: STUDY_CANDIDATE_AUDIO_AFFECTING_FIELDS.has(field)
            ? null
            : draft.previewAudio,
        };
      })
    );
  };

  const toggleCandidate = (index: number) => {
    setCandidateDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, selected: !draft.selected } : draft
      )
    );
  };

  const selectedCount = candidateDrafts.filter((draft) => draft.selected).length;

  const handleRegenerateCandidateAudio = async (index: number) => {
    setSuccess(null);
    const draft = candidateDrafts[index];
    if (!draft) return;

    const candidateId = draft.candidate.clientId;
    setRegeneratingCandidateId(candidateId);
    setRegenerateErrorByCandidateId((current) => {
      const { [candidateId]: _removed, ...remaining } = current;
      return remaining;
    });

    try {
      const result = await regenerateCandidateAudio.mutateAsync({
        candidate: buildStudyCandidateCommitItem(draft),
      });

      setCandidateDrafts((current) =>
        // If a newer generation replaced the draft list while this request was in flight,
        // the old clientId will not match anything and the stale audio result is dropped.
        current.map((currentDraft) =>
          currentDraft.candidate.clientId === candidateId
            ? {
                ...currentDraft,
                candidate: {
                  ...currentDraft.candidate,
                  prompt: result.prompt,
                  answer: result.answer,
                  previewAudio: result.previewAudio,
                  previewAudioRole: result.previewAudioRole,
                },
                previewAudio: result.previewAudio,
                previewAudioRole: result.previewAudioRole,
              }
            : currentDraft
        )
      );
    } catch (error) {
      setRegenerateErrorByCandidateId((current) => ({
        ...current,
        [candidateId]:
          error instanceof Error && error.message
            ? error.message
            : t('create.regeneratePreviewFailed'),
      }));
    } finally {
      setRegeneratingCandidateId((current) => (current === candidateId ? null : current));
    }
  };

  const handleCommitCandidates = async () => {
    setSuccess(null);
    const selectedCandidates = candidateDrafts.filter((draft) => draft.selected);
    try {
      const result = await commitCandidates.mutateAsync({
        candidates: selectedCandidates.map((draft) => buildStudyCandidateCommitItem(draft)),
      });

      setSuccess(t('create.generatedSuccess', { count: result.cards.length }));
      setCandidateDrafts([]);
      setRegenerateErrorByCandidateId({});
      setPreviewDraftIndex(null);
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
                setSuccess(null);
                setRegenerateErrorByCandidateId({});
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

            {generateCandidates.error ? (
              <p className="text-sm text-red-600">
                {generateCandidates.error instanceof Error
                  ? generateCandidates.error.message
                  : t('create.generateFailed')}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={generateCandidates.isPending || isCandidateAudioRegenerating}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generateCandidates.isPending ? t('create.generating') : t('create.generateSubmit')}
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

      {candidateDrafts.length > 0 ? (
        <StudyCandidateDraftList
          candidateDrafts={candidateDrafts}
          commitError={commitCandidates.error}
          isCommitPending={commitCandidates.isPending}
          learnerContextSummary={learnerContextSummary}
          onCommitCandidates={handleCommitCandidates}
          onRegenerateCandidateAudio={handleRegenerateCandidateAudio}
          onToggleCandidate={toggleCandidate}
          onUpdateCandidateField={updateCandidateField}
          previewDraftIndex={previewDraftIndex}
          regenerateErrorByCandidateId={regenerateErrorByCandidateId}
          regeneratingCandidateId={regeneratingCandidateId}
          selectedCount={selectedCount}
          setPreviewDraftIndex={setPreviewDraftIndex}
          success={success}
        />
      ) : null}

      {candidateDrafts.length === 0 && success ? (
        <section className="card retro-paper-panel max-w-4xl">
          <p className="text-sm text-emerald-700">{success}</p>
        </section>
      ) : null}
    </div>
  );
};

export default StudyCreatePage;
