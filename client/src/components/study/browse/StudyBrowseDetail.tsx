import { useTranslation } from 'react-i18next';
import type { StudyClientCapabilities } from '@languageflow/shared/src/types';

import type { StudyBrowseController } from '../../../hooks/useStudyBrowseController';
import ConfirmModal from '../../common/ConfirmModal';
import StudyCardEditor from '../StudyCardEditor';
import StudyCandidateCardPreviewModal from '../StudyCandidatePreview';
import StudyLearningPathEditor from '../StudyLearningPathEditor';
import StudySetDueControls from '../StudySetDueControls';
import StudyBrowseFieldSections from './StudyBrowseFieldSections';

interface StudyBrowseDetailProps {
  controller: StudyBrowseController;
  cardAuthoringCapabilities?: StudyClientCapabilities['cardAuthoring'];
}

const StudyBrowseDetail = ({ controller, cardAuthoringCapabilities }: StudyBrowseDetailProps) => {
  const { t } = useTranslation('study');
  const {
    actionErrorMessage,
    closeDeleteConfirm,
    closePreview,
    closePreviewAndFocusEditor,
    closeSetDueControls,
    confirmDelete,
    detailError,
    editorResetToken,
    editorSectionRef,
    forgetSelectedCard,
    isCardActionPending,
    isCardMutationPending,
    isDeleteConfirmOpen,
    isDeletePending,
    isDetailLoading,
    isPreviewOpen,
    isPromotePending,
    isRegeneratingAudio,
    isRegeneratingImage,
    isUpdatePending,
    openDeleteConfirm,
    openPreview,
    promoteSelectedCard,
    promotedCardId,
    regenerateSelectedAudio,
    regenerateSelectedImage,
    resetEditor,
    saveSelectedCard,
    selectedCard,
    selectedCardId,
    selectedCardStats,
    selectedDetail,
    selectCard,
    setSelectedCardDue,
    showSetDueControls,
    suspendOrUnsuspendSelectedCard,
    toggleSetDueControls,
    updateCardErrorMessage,
  } = controller;

  return (
    <>
      <div className="min-w-0 space-y-6">
        <section data-testid="study-browser-detail" className="card app-surface min-w-0 p-4 sm:p-6">
          {isDetailLoading ? <p className="text-gray-500">{t('browse.loadingDetail')}</p> : null}
          {detailError ? (
            <p className="text-red-600">
              {detailError instanceof Error ? detailError.message : t('browse.failedDetail')}
            </p>
          ) : null}

          {selectedDetail ? (
            <div className="min-w-0 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="break-words text-2xl font-semibold text-navy">
                    {selectedDetail.displayText}
                  </h2>
                  <p className="break-words text-sm text-gray-500">
                    {selectedDetail.noteTypeName ?? t('browse.unknownNoteType')} ·{' '}
                    {t('browse.updated', {
                      value: new Date(selectedDetail.updatedAt).toLocaleString(),
                    })}
                  </p>
                </div>
              </div>

              {selectedDetail.cards.length > 1 ? (
                <div className="app-segmented-control flex flex-wrap gap-1 rounded-xl p-1">
                  {selectedDetail.cards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      aria-pressed={selectedCardId === card.id}
                      onClick={() => selectCard(card.id)}
                      className={`px-3 py-2 text-sm font-medium ${
                        selectedCardId === card.id
                          ? 'bg-white text-navy shadow-sm'
                          : 'text-navy/60 hover:text-navy'
                      }`}
                    >
                      {card.state.source.templateName ?? card.cardType}
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedCard ? (
                <div
                  data-testid="study-browser-preview"
                  className="min-w-0 max-w-full space-y-5 overflow-hidden border-t border-navy/10 pt-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="break-words text-sm text-gray-500">
                      {t('browse.queue')}:{' '}
                      <span className="font-medium text-gray-700">
                        {selectedCard.state.queueState}
                      </span>
                      {selectedCard.state.dueAt
                        ? ` · ${t('browse.due', {
                            value: new Date(selectedCard.state.dueAt).toLocaleString(),
                          })}`
                        : ''}
                    </p>
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                      <button type="button" onClick={openPreview} className="app-button-secondary">
                        {t('create.previewCard')}
                      </button>
                      <button
                        type="button"
                        onClick={suspendOrUnsuspendSelectedCard}
                        disabled={isCardMutationPending}
                        className="app-button-secondary"
                      >
                        {selectedCard.state.queueState === 'suspended'
                          ? t('reviewActions.unsuspend')
                          : t('reviewActions.suspend')}
                      </button>
                      <button
                        type="button"
                        onClick={forgetSelectedCard}
                        disabled={isCardMutationPending}
                        className="app-button-secondary"
                      >
                        {t('browse.forget')}
                      </button>
                      <button
                        type="button"
                        onClick={toggleSetDueControls}
                        disabled={isCardMutationPending}
                        className="app-button-secondary"
                      >
                        {t('browse.setDue')}
                      </button>
                      {selectedCard.state.queueState === 'new' ? (
                        <button
                          type="button"
                          onClick={promoteSelectedCard}
                          disabled={isCardMutationPending || isPromotePending}
                          className="app-button-secondary"
                        >
                          {t('browse.moveToFront')}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {promotedCardId === selectedCard.id ? (
                    <p role="status" className="text-sm font-medium text-green-700">
                      {t('browse.movedToFront')}
                    </p>
                  ) : null}

                  {showSetDueControls ? (
                    <StudySetDueControls
                      disabled={isCardMutationPending}
                      isSubmitting={isCardActionPending}
                      onCancel={closeSetDueControls}
                      onSubmit={setSelectedCardDue}
                    />
                  ) : null}

                  {actionErrorMessage ? (
                    <p className="text-sm text-red-600">{actionErrorMessage}</p>
                  ) : null}

                  <div
                    ref={editorSectionRef}
                    tabIndex={-1}
                    data-testid="study-browser-editor-section"
                    className="scroll-mt-6 outline-none"
                  >
                    <StudyCardEditor
                      key={`${selectedCard.id}:${editorResetToken}`}
                      card={selectedCard}
                      defaultAnswerAudioVoiceId={
                        cardAuthoringCapabilities?.defaultAnswerAudioVoiceId
                      }
                      imagePromptMaxLength={cardAuthoringCapabilities?.limits.imagePromptCharacters}
                      isSaving={isUpdatePending}
                      isDeleting={isDeletePending}
                      isRegeneratingAudio={isRegeneratingAudio}
                      isRegeneratingImage={isRegeneratingImage}
                      error={updateCardErrorMessage}
                      onCancel={resetEditor}
                      onSave={saveSelectedCard}
                      onDelete={openDeleteConfirm}
                      onRegenerateAudio={regenerateSelectedAudio}
                      onRegenerateImage={regenerateSelectedImage}
                    />
                    <div className="mt-5">
                      <StudyLearningPathEditor card={selectedCard} />
                    </div>
                  </div>
                  {isPreviewOpen ? (
                    <StudyCandidateCardPreviewModal
                      card={selectedCard}
                      onClose={closePreview}
                      onEdit={closePreviewAndFocusEditor}
                      resolvePitchAccent
                    />
                  ) : null}
                </div>
              ) : null}

              {selectedCardStats ? (
                <p className="text-sm text-gray-500">
                  {selectedCardStats.reviewCount} reviews
                  {selectedCardStats.lastReviewedAt
                    ? ` · Last reviewed ${new Date(
                        selectedCardStats.lastReviewedAt
                      ).toLocaleString()}`
                    : ''}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-gray-500">{t('browse.selectNote')}</p>
          )}
        </section>

        {selectedDetail ? <StudyBrowseFieldSections detail={selectedDetail} /> : null}
      </div>

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title={t('editor.delete')}
        message={t('editor.confirmDelete')}
        confirmLabel={t('editor.delete')}
        onCancel={closeDeleteConfirm}
        onConfirm={confirmDelete}
        isLoading={isDeletePending}
      />
    </>
  );
};

export default StudyBrowseDetail;
