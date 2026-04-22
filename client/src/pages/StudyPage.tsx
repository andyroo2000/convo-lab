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
        <section className="min-h-screen px-4 py-4 sm:px-6 sm:py-6">
          <div
            data-testid="study-focus-shell"
            className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col rounded-[2rem] bg-[#fdfbf5] p-4 shadow-sm ring-1 ring-gray-200 sm:min-h-[calc(100vh-3rem)] sm:p-6"
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
              <div className="flex min-h-[60vh] flex-1 items-center justify-center rounded-[2rem] border border-dashed border-gray-300 p-8 text-center text-gray-600">
                {t('focus.empty')}
              </div>
            ) : null}

            {reviewSession.currentCard ? (
              <div className="mt-6 flex flex-1 flex-col justify-between space-y-6">
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
                    className="flex min-h-[60vh] w-full flex-1 items-center justify-center rounded-[2rem] bg-white px-6 py-12 text-left shadow-sm ring-1 ring-gray-200 transition hover:shadow-md md:px-12"
                  >
                    <div className="w-full">
                      <StudyCardFace
                        card={reviewSession.currentCard}
                        side="front"
                        promptAudioRef={reviewSession.promptAudioRef}
                      />
                      {reviewSession.currentCard.cardType !== 'cloze' ? (
                        <p className="mt-10 text-center text-sm uppercase tracking-[0.2em] text-gray-400">
                          {t('focus.revealHint')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[60vh] flex-1 rounded-[2rem] bg-white px-6 py-10 shadow-sm ring-1 ring-gray-200 md:px-12">
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
                      <div className="space-y-5">
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
                          onToggleSetDue={() =>
                            reviewSession.setShowSetDueControls((current) => !current)
                          }
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
                        <StudyCardFace
                          card={reviewSession.currentCard}
                          side="back"
                          answerAudioRef={reviewSession.answerAudioRef}
                        />
                      </div>
                    )}
                  </div>
                )}

                {reviewSession.revealed && !reviewSession.editing ? (
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
