import { useTranslation } from 'react-i18next';

import type { StudyBrowseController } from '../../../hooks/useStudyBrowseController';
import ConfirmModal from '../../common/ConfirmModal';
import StudyCardEditor from '../StudyCardEditor';
import StudyCandidateCardPreviewModal from '../StudyCandidatePreview';
import StudySetDueControls from '../StudySetDueControls';
import StudyBrowseFieldSections from './StudyBrowseFieldSections';

interface StudyBrowseDetailProps {
  controller: StudyBrowseController;
}

const StudyBrowseDetail = ({ controller }: StudyBrowseDetailProps) => {
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
        <section data-testid="study-browser-detail" className="card retro-paper-panel min-w-0">
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
                <div className="flex flex-wrap gap-2">
                  {selectedDetail.cards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => selectCard(card.id)}
                      className={`rounded-full border px-3 py-2 text-sm font-medium ${
                        selectedCardId === card.id
                          ? 'border-navy bg-navy text-white'
                          : 'border-gray-300 bg-white text-navy'
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
                  className="min-w-0 max-w-full space-y-4 overflow-hidden rounded-[2rem] bg-white px-4 py-6 shadow-sm ring-1 ring-gray-200 sm:px-6 sm:py-10 md:px-12"
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
                      <button
                        type="button"
                        onClick={openPreview}
                        className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50"
                      >
                        {t('create.previewCard')}
                      </button>
                      <button
                        type="button"
                        onClick={suspendOrUnsuspendSelectedCard}
                        disabled={isCardMutationPending}
                        className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {selectedCard.state.queueState === 'suspended'
                          ? t('reviewActions.unsuspend')
                          : t('reviewActions.suspend')}
                      </button>
                      <button
                        type="button"
                        onClick={forgetSelectedCard}
                        disabled={isCardMutationPending}
                        className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t('browse.forget')}
                      </button>
                      <button
                        type="button"
                        onClick={toggleSetDueControls}
                        disabled={isCardMutationPending}
                        className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t('browse.setDue')}
                      </button>
                      {selectedCard.state.queueState === 'new' ? (
                        <button
                          type="button"
                          onClick={promoteSelectedCard}
                          disabled={isCardMutationPending || isPromotePending}
                          className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
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
