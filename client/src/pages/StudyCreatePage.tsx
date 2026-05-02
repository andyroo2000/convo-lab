import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  StudyCardCandidate,
  StudyCardCandidateCommitItem,
  StudyCardSummary,
  StudyMediaRef,
} from '@languageflow/shared/src/types';

import StudyCardAudioSettingsFields from '../components/study/StudyCardAudioSettingsFields';
import StudyAudioPlayer from '../components/study/StudyAudioPlayer';
import StudyCardFormFields from '../components/study/StudyCardFormFields';
import { StudyCardFace } from '../components/study/StudyCardPreview';
import {
  buildStudyCardFormPayload,
  useStudyCardForm,
  type StudyCardFormValues,
} from '../components/study/studyCardFormModel';
import { toAssetUrl } from '../components/study/studyCardUtils';
import {
  useCommitStudyCardCandidates,
  useCreateStudyCard,
  useGenerateStudyCardCandidates,
  useRegenerateStudyCardCandidatePreviewAudio,
} from '../hooks/useStudy';

type CreateMode = 'generate' | 'manual';

interface CandidateDraft {
  candidate: StudyCardCandidate;
  selected: boolean;
  values: StudyCardFormValues;
  previewAudio: StudyMediaRef | null;
  previewAudioRole: 'prompt' | 'answer' | null;
}

const candidateToFormValues = (candidate: StudyCardCandidate): StudyCardFormValues => {
  if (candidate.cardType === 'cloze') {
    return {
      cardType: 'cloze',
      cueText: candidate.prompt.clozeText ?? '',
      cueReading: '',
      cueMeaning: candidate.prompt.clozeHint ?? candidate.prompt.clozeResolvedHint ?? '',
      answerExpression: candidate.answer.restoredText ?? '',
      answerReading: candidate.answer.restoredTextReading ?? '',
      answerMeaning: candidate.answer.meaning ?? '',
      answerAudioVoiceId: candidate.answer.answerAudioVoiceId ?? '',
      answerAudioTextOverride: candidate.answer.answerAudioTextOverride ?? '',
      notes: candidate.answer.notes ?? '',
      sentenceJp: '',
      sentenceEn: '',
    };
  }

  return {
    cardType: candidate.cardType,
    cueText: candidate.prompt.cueText ?? '',
    cueReading: candidate.prompt.cueReading ?? '',
    cueMeaning: candidate.prompt.cueMeaning ?? '',
    answerExpression: candidate.answer.expression ?? '',
    answerReading: candidate.answer.expressionReading ?? '',
    answerMeaning: candidate.answer.meaning ?? '',
    answerAudioVoiceId: candidate.answer.answerAudioVoiceId ?? '',
    answerAudioTextOverride: candidate.answer.answerAudioTextOverride ?? '',
    notes: candidate.answer.notes ?? '',
    sentenceJp: candidate.answer.sentenceJp ?? '',
    sentenceEn: candidate.answer.sentenceEn ?? '',
  };
};

const audioAffectingFields = new Set<keyof StudyCardFormValues>([
  'answerExpression',
  'answerReading',
  'answerAudioVoiceId',
  'answerAudioTextOverride',
]);

const CandidatePreviewAudio = ({
  isRegenerating,
  label,
  onRegenerate,
  previewUrl,
  regenerateLabel,
  staleLabel,
  title,
}: {
  isRegenerating: boolean;
  label: string;
  onRegenerate: () => void;
  previewUrl: string | null;
  regenerateLabel: string;
  staleLabel: string;
  title: string;
}) => (
  <div className="mb-3 rounded-lg border border-gray-200 bg-white/70 p-3">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{title}</p>
    {previewUrl ? (
      <div className="mt-2">
        <StudyAudioPlayer url={previewUrl} label={label} size="compact" />
      </div>
    ) : (
      <p className="mt-2 text-sm text-amber-700">{staleLabel}</p>
    )}
    <button
      type="button"
      onClick={onRegenerate}
      disabled={isRegenerating}
      className="mt-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {regenerateLabel}
    </button>
  </div>
);

const buildPreviewCard = (
  draft: CandidateDraft,
  candidate: StudyCardCandidateCommitItem
): StudyCardSummary => {
  const previewPrompt =
    candidate.previewAudioRole === 'prompt' && candidate.previewAudio
      ? { ...candidate.prompt, cueAudio: candidate.previewAudio }
      : candidate.prompt;
  const previewAnswer =
    candidate.previewAudioRole === 'answer' && candidate.previewAudio
      ? { ...candidate.answer, answerAudio: candidate.previewAudio }
      : candidate.answer;

  return {
    id: `candidate-preview-${draft.candidate.clientId}`,
    noteId: `candidate-preview-note-${draft.candidate.clientId}`,
    cardType: candidate.cardType,
    prompt: previewPrompt,
    answer: previewAnswer,
    answerAudioSource: 'generated',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    state: {
      dueAt: null,
      introducedAt: null,
      queueState: 'new',
      scheduler: null,
      source: {},
    },
  };
};

const CandidateCardPreviewModal = ({
  card,
  onClose,
}: {
  card: StudyCardSummary;
  onClose: () => void;
}) => {
  const { t } = useTranslation('study');
  const [side, setSide] = useState<'front' | 'back'>('front');
  const toggleSide = useCallback(
    () => setSide((current) => (current === 'front' ? 'back' : 'front')),
    []
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === ' ') {
        event.preventDefault();
        toggleSide();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, toggleSide]);

  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, audio, input, select, textarea, a')) {
      return;
    }

    toggleSide();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-card-preview-title"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="candidate-card-preview-title" className="text-lg font-bold text-navy">
              {t('create.previewCardTitle')}
            </h2>
            <p className="text-sm text-gray-500">{t(`create.previewSides.${side}`)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            {t('create.closePreview')}
          </button>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={handlePreviewClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              toggleSide();
            }
          }}
          className="min-h-[52vh] flex-1 overflow-y-auto px-5 py-8 text-left"
        >
          <StudyCardFace card={card} side={side} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={() => setSide('front')}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            {t('create.previewPrompt')}
          </button>
          <p className="hidden text-sm text-gray-500 sm:block">{t('create.previewHint')}</p>
          <button
            type="button"
            onClick={() => setSide('back')}
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {t('create.previewAnswer')}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [candidateDrafts, setCandidateDrafts] = useState<CandidateDraft[]>([]);
  const [previewDraftIndex, setPreviewDraftIndex] = useState<number | null>(null);
  const { values, setField, setCardType, reset, buildPayload } = useStudyCardForm({
    initialCardType: 'recognition',
  });

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);
    const payload = buildPayload();

    const created = await createCard.mutateAsync(payload);

    setSuccess(t('create.success', { cardType: created.cardType }));
    reset();
  };

  const handleGenerateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(null);
    setLearnerContextSummary(null);
    setCandidateDrafts([]);

    const result = await generateCandidates.mutateAsync({
      targetText,
      context,
      includeLearnerContext,
    });

    setLearnerContextSummary(result.learnerContextSummary ?? null);
    setCandidateDrafts(
      result.candidates.map((candidate) => ({
        candidate,
        selected: true,
        values: candidateToFormValues(candidate),
        previewAudio: candidate.previewAudio ?? null,
        previewAudioRole: candidate.previewAudioRole ?? null,
      }))
    );
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
          previewAudio: audioAffectingFields.has(field) ? null : draft.previewAudio,
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

  const buildCandidateCommitItem = (draft: CandidateDraft) => {
    const payload = buildStudyCardFormPayload(draft.values);
    const prompt =
      draft.candidate.candidateKind === 'audio-recognition'
        ? {
            cueAudio: draft.previewAudio ?? draft.candidate.prompt.cueAudio ?? null,
          }
        : payload.prompt;
    const answer =
      draft.candidate.candidateKind === 'audio-recognition'
        ? {
            ...payload.answer,
            answerAudio: draft.previewAudio ?? draft.candidate.answer.answerAudio ?? null,
          }
        : payload.answer;

    return {
      clientId: draft.candidate.clientId,
      candidateKind: draft.candidate.candidateKind,
      cardType: draft.candidate.cardType,
      prompt,
      answer,
      previewAudio: draft.previewAudio,
      previewAudioRole: draft.previewAudioRole,
    };
  };

  const handleRegenerateCandidateAudio = async (index: number) => {
    setSuccess(null);
    const draft = candidateDrafts[index];
    if (!draft) return;

    const result = await regenerateCandidateAudio.mutateAsync({
      candidate: buildCandidateCommitItem(draft),
    });

    setCandidateDrafts((current) =>
      current.map((currentDraft, draftIndex) =>
        draftIndex === index
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
  };

  const handleCommitCandidates = async () => {
    setSuccess(null);
    const selectedCandidates = candidateDrafts.filter((draft) => draft.selected);
    const result = await commitCandidates.mutateAsync({
      candidates: selectedCandidates.map((draft) => buildCandidateCommitItem(draft)),
    });

    setSuccess(t('create.generatedSuccess', { count: result.cards.length }));
    setCandidateDrafts([]);
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
          <form className="space-y-4" onSubmit={handleGenerateSubmit}>
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
            {regenerateCandidateAudio.error ? (
              <p className="text-sm text-red-600">
                {regenerateCandidateAudio.error instanceof Error
                  ? regenerateCandidateAudio.error.message
                  : t('create.regeneratePreviewFailed')}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={generateCandidates.isPending}
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
        <section className="space-y-4">
          <div className="card retro-paper-panel max-w-4xl">
            <h2 className="text-2xl font-bold text-navy">{t('create.candidates')}</h2>
            {learnerContextSummary ? (
              <p className="mt-2 text-sm text-gray-600">{t('create.learnerContextUsed')}</p>
            ) : null}
          </div>

          {candidateDrafts.map((draft, index) => {
            const previewUrl = toAssetUrl(draft.previewAudio?.url);
            const candidateSelectId = `candidate-${index}-selected`;
            const previewCard = buildPreviewCard(draft, buildCandidateCommitItem(draft));
            const previewTitle =
              draft.candidate.candidateKind === 'audio-recognition'
                ? t('create.audioRecognitionPrompt')
                : t('create.answerPreview');
            return (
              <article key={draft.candidate.clientId} className="card retro-paper-panel max-w-4xl">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {t(`create.kinds.${draft.candidate.candidateKind}`)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{draft.candidate.rationale}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewDraftIndex(index)}
                      className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-gray-50"
                    >
                      {t('create.previewCard')}
                    </button>
                    <div className="flex items-center gap-2">
                      <input
                        id={candidateSelectId}
                        type="checkbox"
                        checked={draft.selected}
                        onChange={() => toggleCandidate(index)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label
                        htmlFor={candidateSelectId}
                        className="text-sm font-semibold text-navy"
                      >
                        {t('create.addCandidate')}
                      </label>
                    </div>
                  </div>
                </div>

                {draft.candidate.warnings?.length ? (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {draft.candidate.warnings.join(' ')}
                  </div>
                ) : null}

                <CandidatePreviewAudio
                  isRegenerating={regenerateCandidateAudio.isPending}
                  label={t('create.playPreview')}
                  onRegenerate={() => handleRegenerateCandidateAudio(index)}
                  previewUrl={previewUrl}
                  regenerateLabel={
                    regenerateCandidateAudio.isPending
                      ? t('create.regeneratingPreview')
                      : t('create.regeneratePreview')
                  }
                  staleLabel={t('create.previewStale')}
                  title={previewTitle}
                />

                <StudyCardAudioSettingsFields
                  values={draft.values}
                  idPrefix={`candidate-${index}`}
                  onFieldChange={(field, value) => updateCandidateField(index, field, value)}
                />

                <StudyCardFormFields
                  values={draft.values}
                  idPrefix={`candidate-${index}`}
                  hidePromptFields={draft.candidate.candidateKind === 'audio-recognition'}
                  includeAudioSettings={false}
                  includeSentenceFields
                  onFieldChange={(field, value) => updateCandidateField(index, field, value)}
                />

                {previewDraftIndex === index ? (
                  <CandidateCardPreviewModal
                    card={previewCard}
                    onClose={() => setPreviewDraftIndex(null)}
                  />
                ) : null}
              </article>
            );
          })}

          <section className="card retro-paper-panel max-w-4xl">
            {commitCandidates.error ? (
              <p className="mb-3 text-sm text-red-600">
                {commitCandidates.error instanceof Error
                  ? commitCandidates.error.message
                  : t('create.commitFailed')}
              </p>
            ) : null}
            {success ? <p className="mb-3 text-sm text-emerald-700">{success}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCommitCandidates}
                disabled={selectedCount === 0 || commitCandidates.isPending}
                className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {commitCandidates.isPending
                  ? t('create.addingSelected')
                  : t('create.addSelected', { count: selectedCount })}
              </button>
              <Link
                to="/app/study"
                className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
              >
                {t('create.back')}
              </Link>
            </div>
          </section>
        </section>
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
