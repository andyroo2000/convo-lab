import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
} from '@languageflow/shared/src/studyConstants';
import type {
  StudyCardCreationKind,
  StudyCardDraftCompleteResponse,
  StudyCardImagePlacement,
  StudyCardSummary,
  StudyMediaRef,
} from '@languageflow/shared/src/types';

import StudyCardImageControls from '../components/study/StudyCardImageControls';
import StudyCardFormFields from '../components/study/StudyCardFormFields';
import StudyCandidateCardPreviewModal from '../components/study/StudyCandidatePreview';
import StudyCandidateDraftList from '../components/study/StudyCandidateDraftList';
import {
  buildStudyCardFormPayload,
  getStudyCardFormValues,
  useStudyCardForm,
} from '../components/study/studyCardFormModel';
import {
  applyStudyCardImageToPayload,
  cardTypeForStudyCardCreationKind,
  DEFAULT_STUDY_CARD_CREATION_KIND,
  defaultVoiceIdForStudyCardCreationKind,
  isStudyCardCreationDefaultVoice,
  mergeBlankStudyCardFormFields,
} from '../components/study/studyCardCreationModel';
import { toAssetUrl } from '../components/study/studyCardUtils';
import useFakeProgress from '../hooks/useFakeProgress';
import useGeneratedStudyCandidates from '../hooks/useGeneratedStudyCandidates';
import {
  useCompleteStudyCardDraft,
  useCreateStudyCard,
  useGenerateStudyCardDraftImage,
} from '../hooks/useStudy';

type CreateMode = 'generate' | 'manual';

function getDraftFormValues(result: StudyCardDraftCompleteResponse) {
  return getStudyCardFormValues({
    card: {
      id: 'manual-draft',
      noteId: 'manual-draft-note',
      cardType: result.cardType,
      prompt: result.prompt,
      answer: result.answer,
      state: {
        dueAt: null,
        introducedAt: null,
        queueState: 'new',
        scheduler: null,
        source: {},
      },
      answerAudioSource: 'missing',
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: '1970-01-01T00:00:00.000Z',
    },
  });
}

const StudyCreatePage = () => {
  const { t } = useTranslation('study');
  const createCard = useCreateStudyCard();
  const completeDraft = useCompleteStudyCardDraft();
  const generateDraftImage = useGenerateStudyCardDraftImage();
  const [mode, setMode] = useState<CreateMode>('generate');
  const [creationKind, setCreationKind] = useState<StudyCardCreationKind>(
    DEFAULT_STUDY_CARD_CREATION_KIND
  );
  const [targetText, setTargetText] = useState('');
  const [context, setContext] = useState('');
  const [includeLearnerContext, setIncludeLearnerContext] = useState(true);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const [manualImagePrompt, setManualImagePrompt] = useState('');
  const [manualImagePlacement, setManualImagePlacement] = useState<StudyCardImagePlacement>('none');
  const [manualPreviewImage, setManualPreviewImage] = useState<StudyMediaRef | null>(null);
  const [isManualPreviewOpen, setIsManualPreviewOpen] = useState(false);
  const generated = useGeneratedStudyCandidates();
  const generationProgress = useFakeProgress(generated.generateCandidates.isPending, {
    // Candidate generation often takes tens of seconds, so pace the visual feedback for that wait.
    expectedMs: 40_000,
  });
  const roundedGenerationProgress = Math.round(generationProgress.progress);
  const { values, setField, setValues, reset } = useStudyCardForm({
    initialCardType: 'recognition',
  });
  const manualCardType = cardTypeForStudyCardCreationKind(creationKind);
  const manualPayload = buildStudyCardFormPayload({
    ...values,
    cardType: manualCardType,
  });
  const manualPreviewImageUrl = toAssetUrl(manualPreviewImage?.url);
  const manualPreviewCard: StudyCardSummary = {
    id: 'manual-preview',
    noteId: 'manual-preview-note',
    ...applyStudyCardImageToPayload(manualPayload, manualPreviewImage, manualImagePlacement),
    state: {
      dueAt: null,
      introducedAt: null,
      queueState: 'new',
      scheduler: null,
      source: {},
    },
    answerAudioSource: 'missing',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };

  const handleCreationKindChange = (nextCreationKind: StudyCardCreationKind) => {
    const wasProductionImage = creationKind === 'production-image';
    setCreationKind(nextCreationKind);
    setValues((current) => ({
      ...current,
      cardType: cardTypeForStudyCardCreationKind(nextCreationKind),
      answerAudioVoiceId: isStudyCardCreationDefaultVoice(current.answerAudioVoiceId)
        ? defaultVoiceIdForStudyCardCreationKind(nextCreationKind)
        : current.answerAudioVoiceId,
    }));
    setManualSuccess(null);
    if (nextCreationKind === 'production-image' && manualImagePlacement === 'none') {
      setManualImagePlacement('prompt');
    } else if (wasProductionImage && nextCreationKind !== 'production-image') {
      setManualImagePlacement('none');
      setManualImagePrompt('');
      setManualPreviewImage(null);
    }
  };

  const handleFillRemainingFields = async () => {
    setManualSuccess(null);
    try {
      const result = await completeDraft.mutateAsync({
        creationKind,
        cardType: manualPayload.cardType,
        prompt: manualPayload.prompt,
        answer: manualPayload.answer,
        imagePlacement: manualImagePlacement,
        imagePrompt: manualImagePrompt.trim() || null,
      });
      const completedValues = getDraftFormValues(result);
      setValues((current) => mergeBlankStudyCardFormFields(current, completedValues));
      if (!manualImagePrompt.trim() && result.imagePrompt) {
        setManualImagePrompt(result.imagePrompt);
      }
      setManualImagePlacement(result.imagePlacement);
      if (result.previewImage) {
        setManualPreviewImage(result.previewImage);
      }
    } catch {
      // React Query exposes the fill error through completeDraft.error.
    }
  };

  const handleGenerateManualImage = async () => {
    setManualSuccess(null);
    try {
      const result = await generateDraftImage.mutateAsync({
        imagePrompt: manualImagePrompt,
        imagePlacement: manualImagePlacement,
      });
      setManualImagePrompt(result.imagePrompt);
      setManualImagePlacement(result.imagePlacement);
      setManualPreviewImage(result.previewImage);
    } catch {
      // React Query exposes the image-generation error through generateDraftImage.error.
    }
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualSuccess(null);
    const withImage = applyStudyCardImageToPayload(
      manualPayload,
      manualPreviewImage,
      manualImagePlacement
    );
    const payload = {
      ...withImage,
      creationKind,
      prompt:
        creationKind === 'production-image' && withImage.prompt.cueImage
          ? { ...withImage.prompt, cueText: null }
          : withImage.prompt,
    };

    try {
      const created = await createCard.mutateAsync(payload);

      setManualSuccess(t('create.success', { cardType: created.cardType }));
      reset();
      setManualImagePrompt('');
      setManualImagePlacement('none');
      setManualPreviewImage(null);
      setIsManualPreviewOpen(false);
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
            {generationProgress.isVisible && !generated.generateCandidates.error ? (
              <div
                role="status"
                aria-label={t('create.generationProgressLabel')}
                className="max-w-xl rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3 text-sm font-medium text-navy">
                  <span>{t('create.generationProgressTitle')}</span>
                  <span data-testid="study-generate-progress-percent">
                    {roundedGenerationProgress}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={roundedGenerationProgress}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white"
                >
                  <div
                    data-testid="study-generate-progress-bar"
                    className="h-full rounded-full bg-navy transition-[width] duration-300 ease-out"
                    style={{ width: `${generationProgress.progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-600">{t('create.generationProgressHint')}</p>
              </div>
            ) : null}
          </form>
        </section>
      ) : (
        <section className="card retro-paper-panel max-w-4xl">
          <form className="space-y-4" onSubmit={handleManualSubmit}>
            <StudyCardFormFields
              values={values}
              idPrefix="study"
              creationKind={creationKind}
              includeCardTypeSelect
              onCreationKindChange={handleCreationKindChange}
              onFieldChange={setField}
            />

            <StudyCardImageControls
              altText={t('create.generatedCardPromptAlt')}
              imagePlacement={manualImagePlacement}
              imagePrompt={manualImagePrompt}
              imagePromptId="study-manual-image-prompt"
              imagePromptLabel={t('create.imagePrompt')}
              isRegenerateDisabled={completeDraft.isPending || createCard.isPending}
              isRegenerating={generateDraftImage.isPending}
              onImagePlacementChange={setManualImagePlacement}
              onImagePromptChange={(value) => {
                setManualImagePrompt(value);
              }}
              onRegenerate={handleGenerateManualImage}
              previewUrl={manualPreviewImageUrl}
              regenerateError={
                generateDraftImage.error instanceof Error ? generateDraftImage.error.message : null
              }
              regenerateLabel={
                generateDraftImage.isPending
                  ? t('create.regeneratingImage')
                  : t('create.generateImage')
              }
              title={t('create.imagePreview')}
            />

            {createCard.error ? (
              <p className="text-sm text-red-600">
                {createCard.error instanceof Error ? createCard.error.message : t('create.failed')}
              </p>
            ) : null}
            {completeDraft.error ? (
              <p className="text-sm text-red-600">
                {completeDraft.error instanceof Error
                  ? completeDraft.error.message
                  : t('create.fillRemainingFailed')}
              </p>
            ) : null}
            {manualSuccess ? <p className="text-sm text-emerald-700">{manualSuccess}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsManualPreviewOpen(true)}
                className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
              >
                {t('create.previewCard')}
              </button>
              <button
                type="button"
                onClick={handleFillRemainingFields}
                disabled={
                  completeDraft.isPending || createCard.isPending || generateDraftImage.isPending
                }
                className="rounded-full border border-navy/30 px-5 py-3 text-sm font-semibold text-navy hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {completeDraft.isPending ? t('create.fillingRemaining') : t('create.fillRemaining')}
              </button>
              <button
                type="submit"
                disabled={
                  createCard.isPending || completeDraft.isPending || generateDraftImage.isPending
                }
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
            {isManualPreviewOpen ? (
              <StudyCandidateCardPreviewModal
                card={manualPreviewCard}
                onClose={() => setIsManualPreviewOpen(false)}
              />
            ) : null}
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
