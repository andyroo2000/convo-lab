import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { StudyCardFace } from '../components/study/StudyCardPreview';
import StudyCardEditor from '../components/study/StudyCardEditor';
import StudyGradeButtons from '../components/study/StudyGradeButtons';
import StudyOverviewDashboard from '../components/study/StudyOverviewDashboard';
import StudyReviewActions from '../components/study/StudyReviewActions';
import StudyReviewHeader from '../components/study/StudyReviewHeader';
import StudySetDueControls from '../components/study/StudySetDueControls';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useStudyOverview } from '../hooks/useStudy';
import useStudyBackgroundTask from '../hooks/useStudyBackgroundTask';
import useStudyReviewSession from '../hooks/useStudyReviewSession';

const StudyPage = () => {
  const { t } = useTranslation('study');
  const navigate = useNavigate();
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const overviewQuery = useStudyOverview(enabled);
  const availableCount = (overviewQuery.data?.dueCount ?? 0) + (overviewQuery.data?.newCount ?? 0);
  const reviewSession = useStudyReviewSession({ availableCount });
  const runBackgroundTask = useStudyBackgroundTask();
  const motionBannerMessage = useMemo(() => {
    if (reviewSession.motionPermissionState === 'unsupported') {
      return t('motion.unsupported');
    }
    if (reviewSession.motionPermissionState === 'denied') {
      return t('motion.denied');
    }
    return t('motion.prompt');
  }, [reviewSession.motionPermissionState, t]);

  const headline = useMemo(() => {
    if (!overviewQuery.data) return t('title');
    return t('headline', {
      dueCount: overviewQuery.data.dueCount,
      newCount: overviewQuery.data.newCount,
    });
  }, [overviewQuery.data, t]);

  const renderReviewActions = () => {
    if (!reviewSession.currentCard) return null;

    return (
      <div className="space-y-3">
        <StudyReviewActions
          card={reviewSession.currentCard}
          disabled={reviewSession.cardActionMutation.isPending}
          onEdit={() => {
            reviewSession.setEditing(true);
          }}
          onBury={reviewSession.handleBuryForSession}
          onToggleSuspend={() => {
            runBackgroundTask(
              () =>
                reviewSession.handleCardAction(
                  reviewSession.currentCard?.state.queueState === 'suspended'
                    ? 'unsuspend'
                    : 'suspend'
                ),
              {
                label: 'Study card action',
              }
            );
          }}
          onForget={() => {
            runBackgroundTask(() => reviewSession.handleCardAction('forget'), {
              label: 'Study card action',
            });
          }}
          onToggleSetDue={() => reviewSession.setShowSetDueControls((current) => !current)}
          onOpenBrowse={() => {
            const params = new URLSearchParams({
              noteId: reviewSession.currentCard?.noteId ?? '',
              cardId: reviewSession.currentCard?.id ?? '',
            });
            reviewSession.exitFocusMode();
            navigate(`/app/study/browse?${params.toString()}`);
          }}
        />
        {reviewSession.showSetDueControls ? (
          <StudySetDueControls
            disabled={reviewSession.cardActionMutation.isPending}
            isSubmitting={reviewSession.cardActionMutation.isPending}
            onCancel={() => reviewSession.setShowSetDueControls(false)}
            onSubmit={async ({ mode, dueAt }) => {
              await reviewSession.handleCardAction('set_due', { mode, dueAt });
            }}
          />
        ) : null}
      </div>
    );
  };

  if (!enabled) {
    return (
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold text-navy">{t('title')}</h1>
        <p className="text-gray-600">{t('disabled')}</p>
      </section>
    );
  }

  if (reviewSession.focusMode) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-cream">
        <section className="min-h-[100dvh] px-2 py-2 sm:px-6 sm:py-6">
          <div
            data-testid="study-focus-shell"
            className="mx-auto flex min-h-[calc(100dvh-1rem)] max-w-7xl flex-col bg-[#fdfbf5] p-3 shadow-sm ring-1 ring-gray-200 sm:min-h-[calc(100vh-3rem)] sm:rounded-[2rem] sm:p-6"
          >
            <StudyReviewHeader
              newRemaining={reviewSession.sessionCounts.newRemaining}
              failedDue={reviewSession.sessionCounts.failedDue}
              reviewRemaining={reviewSession.sessionCounts.reviewRemaining}
              onExit={reviewSession.exitFocusMode}
            />
            {reviewSession.motionPermissionState !== 'granted' ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p>{motionBannerMessage}</p>
                {reviewSession.motionPermissionState !== 'unsupported' ? (
                  <button
                    type="button"
                    onClick={() => {
                      runBackgroundTask(() => reviewSession.requestMotionPermission(), {
                        label: 'Study motion-permission retry',
                      });
                    }}
                    className="rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900 hover:bg-amber-100"
                  >
                    {reviewSession.motionPermissionState === 'denied'
                      ? t('motion.retryDenied')
                      : t('motion.retryPrompt')}
                  </button>
                ) : null}
              </div>
            ) : null}

            {reviewSession.sessionLoading ? (
              <p className="py-16 text-center text-gray-500">{t('focus.loading')}</p>
            ) : null}
            {reviewSession.sessionError ? (
              <p className="py-16 text-center text-red-600">{reviewSession.sessionError}</p>
            ) : null}

            {!reviewSession.sessionLoading &&
            !reviewSession.sessionError &&
            !reviewSession.currentCard ? (
              <div className="flex min-h-[60vh] flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600 sm:rounded-[2rem]">
                {t('focus.empty')}
              </div>
            ) : null}

            {reviewSession.currentCard ? (
              <div className="mt-4 flex flex-1 flex-col justify-between space-y-5 pb-28 sm:mt-6 sm:space-y-6 md:pb-0">
                {!reviewSession.revealed ? (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={t('focus.reveal')}
                    onClick={reviewSession.revealCurrentCard}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        reviewSession.revealCurrentCard();
                      }
                    }}
                    className="flex min-h-[calc(100dvh-10rem)] w-full flex-1 items-center justify-center rounded-2xl bg-white px-4 py-8 text-left shadow-sm ring-1 ring-gray-200 transition hover:shadow-md sm:min-h-[60vh] sm:rounded-[2rem] sm:px-6 sm:py-12 md:px-12"
                  >
                    <div className="w-full">
                      <StudyCardFace
                        card={reviewSession.currentCard}
                        side="front"
                        promptAudioRef={reviewSession.promptAudioRef}
                      />
                      {reviewSession.currentCard.cardType !== 'cloze' ? (
                        <p className="mt-8 text-center text-xs uppercase tracking-[0.18em] text-gray-400 sm:mt-10 sm:text-sm sm:tracking-[0.2em]">
                          {t('focus.revealHint')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[calc(100dvh-10rem)] flex-1 rounded-2xl bg-white px-4 py-6 shadow-sm ring-1 ring-gray-200 sm:min-h-[60vh] sm:rounded-[2rem] sm:px-6 sm:py-10 md:px-12">
                    {reviewSession.editing ? (
                      <StudyCardEditor
                        card={reviewSession.currentCard}
                        isSaving={reviewSession.updateCardMutation.isPending}
                        error={reviewSession.updateCardErrorMessage}
                        onCancel={() => {
                          reviewSession.setEditing(false);
                        }}
                        onSave={reviewSession.saveCurrentCard}
                      />
                    ) : (
                      <div className="flex flex-col gap-5">
                        <div className="order-2 border-t border-gray-200 pt-5 md:order-1 md:border-t-0 md:pt-0">
                          {renderReviewActions()}
                        </div>
                        <div className="order-1 flex min-h-[calc(100dvh-9rem)] items-center justify-center md:order-2 md:block md:min-h-0">
                          <StudyCardFace
                            card={reviewSession.currentCard}
                            side="back"
                            answerAudioRef={reviewSession.answerAudioRef}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {reviewSession.revealed && !reviewSession.editing ? (
                  <div
                    data-testid="study-grade-tray"
                    className="fixed inset-x-0 bottom-0 z-[70] border-t border-gray-200 bg-[#fdfbf5]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(17,51,92,0.12)] backdrop-blur md:static md:border-t-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0"
                  >
                    <StudyGradeButtons
                      gradeIntervals={reviewSession.gradeIntervals}
                      disabled={
                        reviewSession.reviewBusy ||
                        reviewSession.sessionLoading ||
                        reviewSession.undoPending
                      }
                      onGrade={(grade) => {
                        runBackgroundTask(() => reviewSession.handleGrade(grade), {
                          label: 'Study card grade',
                        });
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <StudyOverviewDashboard
      headline={headline}
      overview={overviewQuery.data}
      availableCount={availableCount}
      loading={overviewQuery.isLoading}
      error={overviewQuery.error instanceof Error ? overviewQuery.error : null}
      onRefresh={() => {
        runBackgroundTask(() => overviewQuery.refetch(), {
          label: 'Study overview refresh',
        });
      }}
      onBeginStudy={() => {
        runBackgroundTask(() => reviewSession.enterFocusMode(), {
          label: 'Study session start',
        });
      }}
      isStartingSession={reviewSession.sessionLoading}
    />
  );
};

export default StudyPage;
