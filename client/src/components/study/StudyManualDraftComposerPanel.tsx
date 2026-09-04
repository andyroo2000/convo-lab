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
  imagePromptMaxLength?: number;
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

type AudioPreviewProps = Pick<
  StudyManualDraftComposerPanelProps,
  | 'audioError'
  | 'draft'
  | 'isActionBusy'
  | 'isRegeneratingAudio'
  | 'onRegenerateAudio'
  | 'previewAudioRole'
  | 'previewAudioUrl'
>;

type ImageControlsProps = Pick<
  StudyManualDraftComposerPanelProps,
  | 'draft'
  | 'imageError'
  | 'imagePlacement'
  | 'imagePrompt'
  | 'imagePromptMaxLength'
  | 'isActionBusy'
  | 'isGeneratingImage'
  | 'onGenerateImage'
  | 'onImagePlacementChange'
  | 'onImagePromptChange'
  | 'previewImageUrl'
>;

type DraftFieldsProps = Pick<
  StudyManualDraftComposerPanelProps,
  'creationKind' | 'draftRecovery' | 'draft' | 'onCreationKindChange' | 'onFieldChange' | 'values'
> &
  AudioPreviewProps &
  ImageControlsProps;

type RetryDraftButtonProps = Pick<
  StudyManualDraftComposerPanelProps,
  'canRetryDraft' | 'draftRecovery' | 'isActionBusy' | 'isRetryingDraft' | 'onRetryDraft'
>;

type ExistingDraftActionsProps = Pick<
  StudyManualDraftComposerPanelProps,
  | 'draft'
  | 'draftRecovery'
  | 'isActionBusy'
  | 'isCreatingCard'
  | 'isDeletingDraft'
  | 'onDeleteDraft'
> &
  RetryDraftButtonProps;

type DraftActionsProps = Pick<
  StudyManualDraftComposerPanelProps,
  | 'draft'
  | 'draftRecovery'
  | 'isActionBusy'
  | 'isCreatingDraft'
  | 'onFillRemainingFields'
  | 'onPreviewOpen'
> &
  ExistingDraftActionsProps;

const draftTitleKey = ({ draft }: Pick<StudyManualDraftComposerPanelProps, 'draft'>) =>
  draft ? 'create.reviewDraft' : 'create.newDraftTitle';

const audioPreviewTitleKey = ({
  previewAudioRole,
}: Pick<StudyManualDraftComposerPanelProps, 'previewAudioRole'>) =>
  previewAudioRole === 'prompt' ? 'create.audioRecognitionPrompt' : 'create.answerPreview';

const audioRegenerateLabelKey = ({
  isRegeneratingAudio,
}: Pick<StudyManualDraftComposerPanelProps, 'isRegeneratingAudio'>) =>
  isRegeneratingAudio ? 'create.regeneratingPreview' : 'create.regeneratePreview';

const imageRegenerateLabelKey = ({
  isGeneratingImage,
}: Pick<StudyManualDraftComposerPanelProps, 'isGeneratingImage'>) =>
  isGeneratingImage ? 'create.regeneratingImage' : 'create.generateImage';

const retryDraftLabelKey = ({
  isRetryingDraft,
}: Pick<StudyManualDraftComposerPanelProps, 'isRetryingDraft'>) =>
  isRetryingDraft ? 'create.retryingDraft' : 'create.retryDraft';

const submitDraftLabelKey = ({
  draft,
  isCreatingCard,
}: Pick<StudyManualDraftComposerPanelProps, 'draft' | 'isCreatingCard'>) => {
  if (isCreatingCard) return 'create.creating';
  if (draft?.committedCardId) return 'create.finishDraftCleanup';
  return 'create.submit';
};

const createDraftLabelKey = ({
  isCreatingDraft,
}: Pick<StudyManualDraftComposerPanelProps, 'isCreatingDraft'>) =>
  isCreatingDraft ? 'create.queueingDraft' : 'create.fillRemaining';

const StudyManualDraftHeader = ({ draft }: Pick<StudyManualDraftComposerPanelProps, 'draft'>) => {
  const { t } = useTranslation('study');
  const isCommittedDraft = Boolean(draft?.committedCardId);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold text-navy">{t(draftTitleKey({ draft }))}</h2>
        {draft ? (
          <>
            <p className="text-sm text-gray-600">
              {t(`create.draftStatuses.${draft.status}`)}
              {draft.errorMessage ? ` · ${draft.errorMessage}` : ''}
            </p>
            {isCommittedDraft ? (
              <p className="mt-1 text-sm text-amber-700">{t('create.committedDraftDescription')}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-gray-600">{t('create.newDraftDescription')}</p>
        )}
      </div>
    </div>
  );
};

const StudyManualDraftRecoveryAlert = ({
  draftRecovery,
  onDiscardRecoveredDraft,
  onRestoreRecoveredDraft,
}: Pick<
  StudyManualDraftComposerPanelProps,
  'draftRecovery' | 'onDiscardRecoveredDraft' | 'onRestoreRecoveredDraft'
>) => {
  const { t } = useTranslation('study');

  if (!draftRecovery) return null;

  return (
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
  );
};

const StudyManualDraftAudioPreview = ({
  audioError,
  draft,
  isActionBusy,
  isRegeneratingAudio,
  onRegenerateAudio,
  previewAudioRole,
  previewAudioUrl,
}: AudioPreviewProps) => {
  const { t } = useTranslation('study');

  return (
    <StudyCandidatePreviewAudio
      isRegenerateDisabled={!draft || draft.status === 'generating' || isActionBusy}
      isRegenerating={isRegeneratingAudio}
      label={t('create.playPreview')}
      onRegenerate={onRegenerateAudio}
      previewUrl={previewAudioUrl}
      regenerateError={audioError}
      regenerateLabel={t(audioRegenerateLabelKey({ isRegeneratingAudio }))}
      staleLabel={t('create.previewStale')}
      title={t(audioPreviewTitleKey({ previewAudioRole }))}
    />
  );
};

const StudyManualDraftImageControls = ({
  draft,
  imageError,
  imagePlacement,
  imagePrompt,
  imagePromptMaxLength,
  isActionBusy,
  isGeneratingImage,
  onGenerateImage,
  onImagePlacementChange,
  onImagePromptChange,
  previewImageUrl,
}: ImageControlsProps) => {
  const { t } = useTranslation('study');

  return (
    <StudyCardImageControls
      altText={t('create.generatedCardPromptAlt')}
      imagePlacement={imagePlacement}
      imagePrompt={imagePrompt}
      imagePromptId="study-manual-image-prompt"
      imagePromptLabel={t('create.imagePrompt')}
      imagePromptMaxLength={imagePromptMaxLength}
      isRegenerateDisabled={!draft || draft.status === 'generating' || isActionBusy}
      isRegenerating={isGeneratingImage}
      onImagePlacementChange={onImagePlacementChange}
      onImagePromptChange={onImagePromptChange}
      onRegenerate={onGenerateImage}
      previewUrl={previewImageUrl}
      regenerateError={imageError}
      regenerateLabel={t(imageRegenerateLabelKey({ isGeneratingImage }))}
      title={t('create.imagePreview')}
    />
  );
};

const StudyManualDraftFields = ({
  audioError,
  creationKind,
  draftRecovery,
  draft,
  imageError,
  imagePlacement,
  imagePrompt,
  imagePromptMaxLength,
  isActionBusy,
  isGeneratingImage,
  isRegeneratingAudio,
  onCreationKindChange,
  onFieldChange,
  onGenerateImage,
  onImagePlacementChange,
  onImagePromptChange,
  onRegenerateAudio,
  previewAudioRole,
  previewAudioUrl,
  previewImageUrl,
  values,
}: DraftFieldsProps) => {
  const isGeneratingDraft = draft?.status === 'generating';
  const isCommittedDraft = Boolean(draft?.committedCardId);

  return (
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

      <StudyManualDraftAudioPreview
        audioError={audioError}
        draft={draft}
        isActionBusy={isActionBusy}
        isRegeneratingAudio={isRegeneratingAudio}
        onRegenerateAudio={onRegenerateAudio}
        previewAudioRole={previewAudioRole}
        previewAudioUrl={previewAudioUrl}
      />

      <StudyCardNotesField values={values} idPrefix="study" onFieldChange={onFieldChange} />

      <StudyManualDraftImageControls
        draft={draft}
        imageError={imageError}
        imagePlacement={imagePlacement}
        imagePrompt={imagePrompt}
        imagePromptMaxLength={imagePromptMaxLength}
        isActionBusy={isActionBusy}
        isGeneratingImage={isGeneratingImage}
        onGenerateImage={onGenerateImage}
        onImagePlacementChange={onImagePlacementChange}
        onImagePromptChange={onImagePromptChange}
        previewImageUrl={previewImageUrl}
      />
    </fieldset>
  );
};

const StudyManualRetryDraftButton = ({
  canRetryDraft,
  draftRecovery,
  isActionBusy,
  isRetryingDraft,
  onRetryDraft,
}: RetryDraftButtonProps) => {
  const { t } = useTranslation('study');

  if (!canRetryDraft) return null;

  return (
    <button
      type="button"
      onClick={onRetryDraft}
      disabled={isActionBusy || Boolean(draftRecovery)}
      className="app-button-secondary"
    >
      {t(retryDraftLabelKey({ isRetryingDraft }))}
    </button>
  );
};

const StudyManualExistingDraftActions = ({
  canRetryDraft,
  draft,
  draftRecovery,
  isActionBusy,
  isCreatingCard,
  isDeletingDraft,
  isRetryingDraft,
  onDeleteDraft,
  onRetryDraft,
}: ExistingDraftActionsProps) => {
  const { t } = useTranslation('study');

  if (!draft) return null;
  const actionsDisabled = isActionBusy || Boolean(draftRecovery);
  const submitLabel = t(submitDraftLabelKey({ draft, isCreatingCard }));

  return (
    <>
      <StudyManualRetryDraftButton
        canRetryDraft={canRetryDraft}
        draftRecovery={draftRecovery}
        isActionBusy={isActionBusy}
        isRetryingDraft={isRetryingDraft}
        onRetryDraft={onRetryDraft}
      />
      <button
        type="submit"
        disabled={draft.status === 'generating' || actionsDisabled}
        className="app-button-primary"
      >
        {submitLabel}
      </button>
      <button
        type="button"
        onClick={onDeleteDraft}
        disabled={actionsDisabled}
        className="app-button-danger"
      >
        {isDeletingDraft ? t('create.deletingDraft') : t('create.deleteDraft')}
      </button>
    </>
  );
};

const StudyManualDraftActions = ({
  canRetryDraft,
  draft,
  draftRecovery,
  isActionBusy,
  isCreatingCard,
  isCreatingDraft,
  isDeletingDraft,
  isRetryingDraft,
  onDeleteDraft,
  onFillRemainingFields,
  onPreviewOpen,
  onRetryDraft,
}: DraftActionsProps) => {
  const { t } = useTranslation('study');
  const isGeneratingDraft = draft?.status === 'generating';

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onPreviewOpen}
        disabled={isGeneratingDraft || Boolean(draftRecovery)}
        className="app-button-secondary"
      >
        {t('create.previewCard')}
      </button>
      {draft ? (
        <StudyManualExistingDraftActions
          canRetryDraft={canRetryDraft}
          draft={draft}
          draftRecovery={draftRecovery}
          isActionBusy={isActionBusy}
          isCreatingCard={isCreatingCard}
          isDeletingDraft={isDeletingDraft}
          isRetryingDraft={isRetryingDraft}
          onDeleteDraft={onDeleteDraft}
          onRetryDraft={onRetryDraft}
        />
      ) : (
        <button
          type="button"
          onClick={onFillRemainingFields}
          disabled={isActionBusy}
          className="app-button-primary"
        >
          {t(createDraftLabelKey({ isCreatingDraft }))}
        </button>
      )}
      <Link to="/app/study" className="app-button-secondary">
        {t('create.back')}
      </Link>
    </div>
  );
};

const StudyManualDraftComposerPanel = (props: StudyManualDraftComposerPanelProps) => {
  const {
    audioError,
    canRetryDraft,
    creationKind,
    draftRecovery,
    draft,
    errorMessage,
    imageError,
    imagePlacement,
    imagePrompt,
    imagePromptMaxLength,
    isActionBusy,
    isCreatingCard,
    isCreatingDraft,
    isDeletingDraft,
    isGeneratingImage,
    isPreviewOpen,
    isRegeneratingAudio,
    isRetryingDraft,
    onCreationKindChange,
    onDeleteDraft,
    onDiscardRecoveredDraft,
    onFieldChange,
    onFillRemainingFields,
    onGenerateImage,
    onImagePlacementChange,
    onImagePromptChange,
    onPreviewClose,
    onPreviewOpen,
    onRegenerateAudio,
    onRestoreRecoveredDraft,
    onRetryDraft,
    onSubmit,
    previewAudioRole,
    previewAudioUrl,
    previewCard,
    previewImageUrl,
    successMessage,
    values,
  } = props;

  return (
    <section className="card app-surface min-w-0">
      <form className="space-y-4" onSubmit={onSubmit}>
        <StudyManualDraftHeader draft={draft} />

        <StudyManualDraftRecoveryAlert
          draftRecovery={draftRecovery}
          onDiscardRecoveredDraft={onDiscardRecoveredDraft}
          onRestoreRecoveredDraft={onRestoreRecoveredDraft}
        />

        <StudyManualDraftFields
          audioError={audioError}
          creationKind={creationKind}
          draft={draft}
          draftRecovery={draftRecovery}
          imageError={imageError}
          imagePlacement={imagePlacement}
          imagePrompt={imagePrompt}
          imagePromptMaxLength={imagePromptMaxLength}
          isActionBusy={isActionBusy}
          isGeneratingImage={isGeneratingImage}
          isRegeneratingAudio={isRegeneratingAudio}
          onCreationKindChange={onCreationKindChange}
          onFieldChange={onFieldChange}
          onGenerateImage={onGenerateImage}
          onImagePlacementChange={onImagePlacementChange}
          onImagePromptChange={onImagePromptChange}
          onRegenerateAudio={onRegenerateAudio}
          previewAudioRole={previewAudioRole}
          previewAudioUrl={previewAudioUrl}
          previewImageUrl={previewImageUrl}
          values={values}
        />

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

        <StudyManualDraftActions
          canRetryDraft={canRetryDraft}
          draft={draft}
          draftRecovery={draftRecovery}
          isActionBusy={isActionBusy}
          isCreatingCard={isCreatingCard}
          isCreatingDraft={isCreatingDraft}
          isDeletingDraft={isDeletingDraft}
          isRetryingDraft={isRetryingDraft}
          onDeleteDraft={onDeleteDraft}
          onFillRemainingFields={onFillRemainingFields}
          onPreviewOpen={onPreviewOpen}
          onRetryDraft={onRetryDraft}
        />
        {isPreviewOpen ? (
          <StudyCandidateCardPreviewModal card={previewCard} onClose={onPreviewClose} />
        ) : null}
      </form>
    </section>
  );
};

export default StudyManualDraftComposerPanel;
