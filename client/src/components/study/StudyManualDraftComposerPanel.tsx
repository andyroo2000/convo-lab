import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyCardSummary,
  StudyManualCardDraft,
} from '@languageflow/shared/src/types';

import StudyCardImageControls from './StudyCardImageControls';
import StudyCardFormFields, { StudyCardNotesField } from './StudyCardFormFields';
import StudyCandidatePreviewAudio from './StudyCandidatePreviewAudio';
import StudyCandidateCardPreviewModal from './StudyCandidatePreview';
import type { StudyCardFormValues } from './studyCardFormModel';
import type { StudyDraftIntent } from '../../lib/studyDraftIntentStore';

interface StudyManualDraftComposerPanelProps {
  audioError: string | null;
  canRetryDraft: boolean;
  creationKind: StudyCardCreationKind;
  draftRecovery: { intent: StudyDraftIntent; serverDraft: StudyManualCardDraft } | null;
  draft: StudyManualCardDraft | null;
  errorMessage: string | null;
  imageError: string | null;
  imagePlacement: StudyCardImagePlacement;
  imagePrompt: string;
  isActionBusy: boolean;
  isCreatingCard: boolean;
  isCreatingDraft: boolean;
  isDeletingDraft: boolean;
  isGeneratingImage: boolean;
  isPreviewOpen: boolean;
  isRegeneratingAudio: boolean;
  isRetryingDraft: boolean;
  onCreationKindChange: (creationKind: StudyCardCreationKind) => void;
  onDiscardRecoveredDraft: () => void;
  onDeleteDraft: () => void;
  onFieldChange: <Key extends keyof StudyCardFormValues>(
    field: Key,
    value: StudyCardFormValues[Key]
  ) => void;
  onFillRemainingFields: () => void;
  onGenerateImage: () => void;
  onImagePlacementChange: (placement: StudyCardImagePlacement) => void;
  onImagePromptChange: (prompt: string) => void;
  onPreviewClose: () => void;
  onPreviewOpen: () => void;
  onRegenerateAudio: () => void;
  onRetryDraft: () => void;
  onRestoreRecoveredDraft: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  previewAudioRole: 'prompt' | 'answer' | null;
  previewAudioUrl: string | null;
  previewCard: StudyCardSummary;
  previewImageUrl: string | null;
  successMessage: string | null;
  values: StudyCardFormValues;
}

const StudyManualDraftComposerPanel = ({
  audioError,
  canRetryDraft,
  creationKind,
  draftRecovery,
  draft,
  errorMessage,
  imageError,
  imagePlacement,
  imagePrompt,
  isActionBusy,
  isCreatingCard,
  isCreatingDraft,
  isDeletingDraft,
  isGeneratingImage,
  isPreviewOpen,
  isRegeneratingAudio,
  isRetryingDraft,
  onCreationKindChange,
  onDiscardRecoveredDraft,
  onDeleteDraft,
  onFieldChange,
  onFillRemainingFields,
  onGenerateImage,
  onImagePlacementChange,
  onImagePromptChange,
  onPreviewClose,
  onPreviewOpen,
  onRegenerateAudio,
  onRetryDraft,
  onRestoreRecoveredDraft,
  onSubmit,
  previewAudioRole,
  previewAudioUrl,
  previewCard,
  previewImageUrl,
  successMessage,
  values,
}: StudyManualDraftComposerPanelProps) => {
  const { t } = useTranslation('study');
  const isGeneratingDraft = draft?.status === 'generating';
  const isCommittedDraft = Boolean(draft?.committedCardId);
  let submitLabel = t('create.submit');
  if (isCommittedDraft) submitLabel = t('create.finishDraftCleanup');
  if (isCreatingCard) submitLabel = t('create.creating');

  return (
    <section className="card retro-paper-panel min-w-0">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-navy">
              {draft ? t('create.reviewDraft') : t('create.newDraftTitle')}
            </h2>
            {draft ? (
              <>
                <p className="text-sm text-gray-600">
                  {t(`create.draftStatuses.${draft.status}`)}
                  {draft.errorMessage ? ` · ${draft.errorMessage}` : ''}
                </p>
                {isCommittedDraft ? (
                  <p className="mt-1 text-sm text-amber-700">
                    {t('create.committedDraftDescription')}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-gray-600">{t('create.newDraftDescription')}</p>
            )}
          </div>
        </div>

        {draftRecovery ? (
          <div
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
            role="alert"
          >
            <p className="font-semibold">{t('create.draftConflictTitle')}</p>
            <p className="mt-1">{t('create.draftConflictDescription')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-amber-700 px-3 py-1.5 font-semibold text-white hover:bg-amber-800"
                onClick={onRestoreRecoveredDraft}
              >
                {t('create.restoreDraftEdits')}
              </button>
              <button
                type="button"
                className="rounded-full border border-amber-400 px-3 py-1.5 font-semibold hover:bg-amber-100"
                onClick={onDiscardRecoveredDraft}
              >
                {t('create.useServerDraft')}
              </button>
            </div>
          </div>
        ) : null}

        <fieldset
          disabled={isGeneratingDraft || isCommittedDraft || Boolean(draftRecovery)}
          className="space-y-4"
        >
          <StudyCardFormFields
            values={values}
            idPrefix="study"
            creationKind={creationKind}
            includeCardTypeSelect={!draft}
            includeNotesField={false}
            hidePromptFields={creationKind === 'audio-recognition'}
            onCreationKindChange={onCreationKindChange}
            onFieldChange={onFieldChange}
          />

          <StudyCandidatePreviewAudio
            isRegenerateDisabled={!draft || isGeneratingDraft || isActionBusy}
            isRegenerating={isRegeneratingAudio}
            label={t('create.playPreview')}
            onRegenerate={onRegenerateAudio}
            previewUrl={previewAudioUrl}
            regenerateError={audioError}
            regenerateLabel={
              isRegeneratingAudio ? t('create.regeneratingPreview') : t('create.regeneratePreview')
            }
            staleLabel={t('create.previewStale')}
            title={
              previewAudioRole === 'prompt'
                ? t('create.audioRecognitionPrompt')
                : t('create.answerPreview')
            }
          />

          <StudyCardNotesField values={values} idPrefix="study" onFieldChange={onFieldChange} />

          <StudyCardImageControls
            altText={t('create.generatedCardPromptAlt')}
            imagePlacement={imagePlacement}
            imagePrompt={imagePrompt}
            imagePromptId="study-manual-image-prompt"
            imagePromptLabel={t('create.imagePrompt')}
            isRegenerateDisabled={!draft || isGeneratingDraft || isActionBusy}
            isRegenerating={isGeneratingImage}
            onImagePlacementChange={onImagePlacementChange}
            onImagePromptChange={onImagePromptChange}
            onRegenerate={onGenerateImage}
            previewUrl={previewImageUrl}
            regenerateError={imageError}
            regenerateLabel={
              isGeneratingImage ? t('create.regeneratingImage') : t('create.generateImage')
            }
            title={t('create.imagePreview')}
          />
        </fieldset>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onPreviewOpen}
            disabled={isGeneratingDraft || Boolean(draftRecovery)}
            className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('create.previewCard')}
          </button>
          {draft ? (
            <>
              {canRetryDraft ? (
                <button
                  type="button"
                  onClick={onRetryDraft}
                  disabled={isActionBusy || Boolean(draftRecovery)}
                  className="rounded-full border border-navy/30 px-5 py-3 text-sm font-semibold text-navy hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRetryingDraft ? t('create.retryingDraft') : t('create.retryDraft')}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isGeneratingDraft || isActionBusy || Boolean(draftRecovery)}
                className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLabel}
              </button>
              <button
                type="button"
                onClick={onDeleteDraft}
                disabled={isActionBusy || Boolean(draftRecovery)}
                className="rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingDraft ? t('create.deletingDraft') : t('create.deleteDraft')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onFillRemainingFields}
              disabled={isActionBusy}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingDraft ? t('create.queueingDraft') : t('create.fillRemaining')}
            </button>
          )}
          <Link
            to="/app/study"
            className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            {t('create.back')}
          </Link>
        </div>
        {isPreviewOpen ? (
          <StudyCandidateCardPreviewModal card={previewCard} onClose={onPreviewClose} />
        ) : null}
      </form>
    </section>
  );
};

export default StudyManualDraftComposerPanel;
