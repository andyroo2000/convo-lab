import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ConfirmModal from '../components/common/ConfirmModal';
import StudyCapabilitiesError from '../components/study/StudyCapabilitiesError';
import MasteryReviewAnimation from '../components/study/MasteryReviewAnimation';
import { masteryReviewAnnouncementKind } from '../components/study/studyMastery';
import StudyOverviewDashboard from '../components/study/StudyOverviewDashboard';
import StudyReviewActions from '../components/study/StudyReviewActions';
import StudyReviewCardSurface from '../components/study/StudyReviewCardSurface';
import StudyReviewHeader from '../components/study/StudyReviewHeader';
import StudySessionWrapUp from '../components/study/StudySessionWrapUp';
import {
  StudyAchievementAwardView,
  StudyAchievementSpotlight,
} from '../components/study/StudyAchievementViews';
import StudySetDueControls from '../components/study/StudySetDueControls';
import { StudyLessonPhase } from '../components/study/StudyLessonViews';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useStudyOverview } from '../hooks/useStudy';
import useStudyBackgroundTask from '../hooks/useStudyBackgroundTask';
import useStudyReviewSession from '../hooks/useStudyReviewSession';
import { useStudyActivityActions } from '../contexts/StudyActivityContext';
import { useAutomaticStudyActivity } from '../hooks/useStudyActivity';
import { useStudyCapabilities } from '../hooks/useStudyCapabilities';

const shouldStartLessonCohort = (
  enabled: boolean,
  lessonCohortId: string | null,
  startedLessonCohortId: string | null
): lessonCohortId is string => {
  if (!enabled) return false;
  if (!lessonCohortId) return false;
  return startedLessonCohortId !== lessonCohortId;
};

const isLessonPreviewActive = (focusMode: boolean, sessionKind: string, lessonPhase: string) => {
  if (!focusMode) return false;
  if (sessionKind !== 'lessons') return false;
  return lessonPhase === 'preview';
};

const StudyPage = () => {
  const { t } = useTranslation('study');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const overviewQuery = useStudyOverview({ enabled });
  const capabilitiesQuery = useStudyCapabilities(enabled);
  const cardAuthoringCapabilities = capabilitiesQuery.data?.cardAuthoring;
  const availableCount =
    (overviewQuery.data?.failedDueCount ?? 0) + (overviewQuery.data?.dueCount ?? 0);
  const reviewSession = useStudyReviewSession();
  const { start: startActivity, stop: stopActivity } = useStudyActivityActions();
  const runBackgroundTask = useStudyBackgroundTask();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [lessonPreviewIndex, setLessonPreviewIndex] = useState(0);
  const [landingAchievementId, setLandingAchievementId] = useState<string | null>(null);
  const [sessionNewAchievementIds, setSessionNewAchievementIds] = useState<string[]>([]);
  const startedLessonCohortRef = useRef<string | null>(null);
  const lessonCohortId = searchParams.get('lessonCohortId');
  const startReviewTimer = useCallback(
    () =>
      startActivity({
        activity: 'card_review',
        source: 'automatic',
        name: reviewSession.sessionKind === 'lessons' ? 'Lessons' : 'Card reviews',
      }),
    [reviewSession.sessionKind, startActivity]
  );
  const stopReviewTimer = useCallback(() => stopActivity('card_review'), [stopActivity]);
  useAutomaticStudyActivity(reviewSession.focusMode, startReviewTimer, stopReviewTimer);
  const shouldShowMotionBanner =
    reviewSession.motionPermissionState === 'prompt' ||
    reviewSession.motionPermissionState === 'denied';
  const showingAchievementAward = reviewSession.currentAchievement !== null;
  const showGradeTray =
    reviewSession.revealed && !reviewSession.editing && !showingAchievementAward;
  const runViewTransition = useCallback((update: () => void) => {
    const startViewTransition = document.startViewTransition?.bind(document);
    if (!startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update();
      return;
    }
    startViewTransition(() => flushSync(update));
  }, []);
  const motionBannerMessage = useMemo(() => {
    if (reviewSession.motionPermissionState === 'unsupported') {
      return t('motion.unsupported');
    }
    if (reviewSession.motionPermissionState === 'denied') {
      return t('motion.denied');
    }
    return t('motion.prompt');
  }, [reviewSession.motionPermissionState, t]);

  const lessonPreviewCard = reviewSession.cards[lessonPreviewIndex] ?? null;
  const lessonPreviewIsFirst = lessonPreviewIndex === 0;
  const lessonPreviewIsLast =
    reviewSession.cards.length > 0 && lessonPreviewIndex === reviewSession.cards.length - 1;

  useEffect(() => {
    setLessonPreviewIndex((current) =>
      Math.min(current, Math.max(reviewSession.cards.length - 1, 0))
    );
  }, [reviewSession.cards.length]);

  useEffect(() => {
    if (!shouldStartLessonCohort(enabled, lessonCohortId, startedLessonCohortRef.current)) return;

    startedLessonCohortRef.current = lessonCohortId;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('lessonCohortId');
    setSearchParams(nextSearchParams, { replace: true });
    setLessonPreviewIndex(0);
    runBackgroundTask(() => reviewSession.enterFocusMode('lessons', { lessonCohortId }), {
      label: 'Study lesson follow-up start',
    });
  }, [enabled, lessonCohortId, reviewSession, runBackgroundTask, searchParams, setSearchParams]);

  useEffect(() => {
    if (
      !isLessonPreviewActive(
        reviewSession.focusMode,
        reviewSession.sessionKind,
        reviewSession.lessonPhase
      )
    ) {
      return undefined;
    }

    const handlePreviewKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setLessonPreviewIndex((current) => Math.max(0, current - 1));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setLessonPreviewIndex((current) => Math.min(reviewSession.cards.length - 1, current + 1));
      }
    };

    window.addEventListener('keydown', handlePreviewKeyDown);
    return () => window.removeEventListener('keydown', handlePreviewKeyDown);
  }, [
    reviewSession.cards.length,
    reviewSession.focusMode,
    reviewSession.lessonPhase,
    reviewSession.sessionKind,
  ]);

  const renderReviewActionButtons = () => {
    if (!reviewSession.currentCard) return null;

    return (
      <StudyReviewActions
        card={reviewSession.currentCard}
        disabled={reviewSession.cardActionMutation.isPending || reviewSession.reviewBusy}
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
          reviewSession.endReviewSession();
          navigate(`/app/study/browse?${params.toString()}`);
        }}
      />
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
    const { masteryAnimation } = reviewSession;
    const displayedCard = masteryAnimation?.card ?? reviewSession.currentCard;
    const displayedCardIsRevealed = masteryAnimation !== null || reviewSession.revealed;
    const showQuizSurface = reviewSession.lessonPhase === 'quiz' || masteryAnimation !== null;

    // These containers must use overflow-x-hidden, not overflow-x-clip: clip makes
    // Chromium drop hit-testing (hover/clicks) on content that overflows the box
    // vertically past min-h at desktop widths, leaving the editor buttons painted
    // but unclickable on tall cards. The glyph-descender fix that motivated clip
    // lives in StudyCardPreview.tsx instead (pb-[0.08em] on the text elements).
    return (
      <>
        <div className="fixed inset-0 z-[60] overflow-hidden bg-[#fdfbf5] md:bg-cream">
          <section className="h-[100dvh] md:px-3 md:py-2">
            <div
              data-testid="study-focus-shell"
              className="study-focus-shell mx-auto flex h-[100dvh] min-h-0 max-w-7xl flex-col overflow-x-hidden bg-[#fdfbf5] px-2 pt-2 md:h-[calc(100dvh-1rem)] md:rounded-2xl md:px-4 md:py-2 md:shadow-sm md:ring-1 md:ring-navy/10"
            >
              <StudyCapabilitiesError
                isError={capabilitiesQuery.isError}
                isRetrying={capabilitiesQuery.isFetching}
                onRetry={() => {
                  capabilitiesQuery.refetch().catch(() => undefined);
                }}
              />
              {!showingAchievementAward &&
              !reviewSession.reviewSessionComplete &&
              !reviewSession.practiceComplete ? (
                <StudyReviewHeader
                  progress={reviewSession.sessionProgress}
                  counts={reviewSession.sessionCounts}
                  actions={
                    reviewSession.revealed && !reviewSession.editing && !reviewSession.practiceMode
                      ? renderReviewActionButtons()
                      : null
                  }
                  onExit={reviewSession.endReviewSession}
                  exitLabel={reviewSession.practiceMode ? t('practice.back') : undefined}
                />
              ) : null}
              {reviewSession.currentAchievement ? (
                <StudyAchievementAwardView
                  achievements={reviewSession.completionAchievements}
                  currentIndex={reviewSession.currentAchievementIndex}
                  onContinue={() => {
                    if (
                      reviewSession.currentAchievementIndex + 1 >=
                      reviewSession.completionAchievements.length
                    ) {
                      runViewTransition(reviewSession.advanceAchievement);
                    } else {
                      reviewSession.advanceAchievement();
                    }
                  }}
                />
              ) : null}
              {!showingAchievementAward && reviewSession.practiceMode ? (
                <div className="mt-2 rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-gray-700">
                  <p className="font-bold text-cyan-700">{t('practice.title')}</p>
                  <p>{t('practice.description')}</p>
                </div>
              ) : null}
              {!showingAchievementAward && showQuizSurface ? (
                <div className="mastery-feedback-lane" data-testid="mastery-feedback-lane">
                  {masteryAnimation ? (
                    <MasteryReviewAnimation
                      key={masteryAnimation.id}
                      fromLevel={masteryAnimation.fromLevel}
                      toLevel={masteryAnimation.toLevel}
                      passed={masteryAnimation.passed}
                      announcement={t(
                        `masteryAnimation.${masteryReviewAnnouncementKind(
                          masteryAnimation.fromLevel,
                          masteryAnimation.toLevel,
                          masteryAnimation.passed
                        )}`,
                        {
                          item: masteryAnimation.label,
                          level: masteryAnimation.toLevel,
                        }
                      )}
                      onFinished={() => {
                        reviewSession.setMasteryAnimation((current) =>
                          current?.id === masteryAnimation.id ? null : current
                        );
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
              <StudyLessonPhase
                active={!showingAchievementAward}
                complete={{
                  anotherBatchLabel: t('lesson.anotherBatch'),
                  description: t('lesson.completeDescription'),
                  finishLabel: t('lesson.finish'),
                  onAnotherBatch: () => {
                    setLessonPreviewIndex(0);
                    runBackgroundTask(() => reviewSession.loadNextLessonBatch(), {
                      label: 'Next lesson batch',
                    });
                  },
                  onFinish: reviewSession.exitFocusMode,
                  title: t('lesson.completeTitle'),
                }}
                lessonPhase={reviewSession.lessonPhase}
                masteryAnimationActive={Boolean(masteryAnimation)}
                preview={{
                  card: lessonPreviewCard,
                  cardPosition: t('lesson.cardPosition', {
                    current: lessonPreviewIndex + 1,
                    total: reviewSession.cards.length,
                  }),
                  description: t('lesson.previewDescription'),
                  emptyMessage: t('lesson.noneAvailable'),
                  isFirst: lessonPreviewIsFirst,
                  isLast: lessonPreviewIsLast,
                  nextLabel: t('lesson.next'),
                  onNext: () =>
                    setLessonPreviewIndex((current) =>
                      Math.min(reviewSession.cards.length - 1, current + 1)
                    ),
                  onPrevious: () => setLessonPreviewIndex((current) => Math.max(0, current - 1)),
                  onStartQuiz: reviewSession.beginLessonQuiz,
                  previousLabel: t('lesson.previous'),
                  startQuizLabel: t('lesson.startQuiz'),
                  title: t('lesson.previewTitle'),
                }}
                sessionKind={reviewSession.sessionKind}
                sessionLoading={reviewSession.sessionLoading}
              />
              {!showingAchievementAward &&
              reviewSession.currentCard &&
              reviewSession.revealed &&
              !reviewSession.editing &&
              reviewSession.showSetDueControls ? (
                <div className="mt-2">
                  <StudySetDueControls
                    disabled={reviewSession.cardActionMutation.isPending}
                    isSubmitting={reviewSession.cardActionMutation.isPending}
                    onCancel={() => reviewSession.setShowSetDueControls(false)}
                    onSubmit={async ({ mode, dueAt }) => {
                      await reviewSession.handleCardAction('set_due', { mode, dueAt });
                    }}
                  />
                </div>
              ) : null}
              {!showingAchievementAward && shouldShowMotionBanner ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 md:mt-4 md:gap-3 md:rounded-2xl md:px-4 md:py-3 md:text-sm">
                  <p>{motionBannerMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      runBackgroundTask(() => reviewSession.requestMotionPermission(), {
                        label: 'Study motion-permission retry',
                      });
                    }}
                    className="rounded-full border border-amber-300 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-amber-900 hover:bg-amber-100 md:px-4 md:py-2 md:text-xs"
                  >
                    {reviewSession.motionPermissionState === 'denied'
                      ? t('motion.retryDenied')
                      : t('motion.retryPrompt')}
                  </button>
                </div>
              ) : null}

              {!showingAchievementAward && reviewSession.sessionLoading ? (
                <p className="py-16 text-center text-gray-500">{t('focus.loading')}</p>
              ) : null}
              {!showingAchievementAward && reviewSession.sessionError ? (
                <div className="space-y-4 py-16 text-center text-red-600">
                  <p>{reviewSession.sessionError}</p>
                  {reviewSession.reviewRetryAvailable ? (
                    <button
                      type="button"
                      onClick={() => {
                        runBackgroundTask(() => reviewSession.retryPendingReview(), {
                          label: 'Study review retry',
                        });
                      }}
                      className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy/90"
                    >
                      {t('focus.retryReview')}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!showingAchievementAward && reviewSession.reviewConflictRecovered ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
                  {t('focus.reviewConflictRecovered')}
                </p>
              ) : null}

              {!showingAchievementAward &&
              reviewSession.reviewSessionComplete &&
              !masteryAnimation ? (
                <StudySessionWrapUp
                  summary={reviewSession.sessionWrapUp}
                  caughtUp={reviewSession.reviewQueueExhausted}
                  achievements={[...reviewSession.completionAchievements].reverse()}
                  isFinalizing={reviewSession.achievementCompletionRefreshPending}
                  onPractice={reviewSession.startToughestPractice}
                  onDone={() => {
                    const newest = [...reviewSession.completionAchievements].reverse()[0] ?? null;
                    setLandingAchievementId(newest?.id ?? null);
                    setSessionNewAchievementIds(
                      reviewSession.completionAchievements.map(({ id }) => id)
                    );
                    runViewTransition(reviewSession.finishReviewSession);
                  }}
                />
              ) : null}

              {!showingAchievementAward && reviewSession.practiceComplete ? (
                <div className="flex min-h-[60vh] flex-1 items-center justify-center">
                  <div className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
                    <h2 className="text-3xl font-bold text-navy">{t('practice.completeTitle')}</h2>
                    <p className="mt-3 text-gray-600">{t('practice.completeDescription')}</p>
                    <button
                      type="button"
                      onClick={reviewSession.exitPracticeMode}
                      className="mt-6 rounded-xl bg-navy px-6 py-3 font-bold text-white hover:bg-navy/90"
                    >
                      {t('practice.back')}
                    </button>
                  </div>
                </div>
              ) : null}

              {!showingAchievementAward &&
              showQuizSurface &&
              !reviewSession.sessionLoading &&
              !reviewSession.sessionError &&
              !displayedCard &&
              !reviewSession.reviewSessionComplete &&
              !reviewSession.practiceComplete ? (
                <div className="flex min-h-[60vh] flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600 sm:rounded-[2rem]">
                  {t('focus.empty')}
                </div>
              ) : null}

              {displayedCard ? (
                <StudyReviewCardSurface
                  answerAudioRef={reviewSession.answerAudioRef}
                  card={displayedCard}
                  cardAuthoringCapabilities={cardAuthoringCapabilities}
                  deletePending={reviewSession.deleteCardMutation.isPending}
                  editing={reviewSession.editing}
                  masteryAnimationActive={Boolean(masteryAnimation)}
                  onDelete={() => setIsDeleteConfirmOpen(true)}
                  onGrade={reviewSession.handleGrade}
                  onRegenerateAudio={reviewSession.regenerateCurrentCardAudio}
                  onReveal={reviewSession.revealCurrentCard}
                  onSave={reviewSession.saveCurrentCard}
                  onStopEditing={() => reviewSession.setEditing(false)}
                  promptAudioRef={reviewSession.promptAudioRef}
                  regenerateAudioPending={reviewSession.regenerateAudioMutation.isPending}
                  revealed={displayedCardIsRevealed}
                  reviewBusy={reviewSession.reviewBusy}
                  runBackgroundTask={runBackgroundTask}
                  sessionLoading={reviewSession.sessionLoading}
                  showGradeTray={showGradeTray}
                  undoPending={reviewSession.undoPending}
                  updateError={reviewSession.updateCardErrorMessage}
                  updatePending={reviewSession.updateCardMutation.isPending}
                  visible={
                    !showingAchievementAward &&
                    showQuizSurface &&
                    !reviewSession.reviewSessionComplete
                  }
                />
              ) : null}
            </div>
          </section>
        </div>
        <ConfirmModal
          isOpen={isDeleteConfirmOpen}
          title={t('editor.delete')}
          message={t('editor.confirmDelete')}
          confirmLabel={t('editor.delete')}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={() => {
            runBackgroundTask(
              async () => {
                try {
                  await reviewSession.deleteCurrentCard();
                } finally {
                  setIsDeleteConfirmOpen(false);
                }
              },
              {
                label: 'Study card delete',
              }
            );
          }}
          isLoading={reviewSession.deleteCardMutation.isPending}
        />
      </>
    );
  }

  return (
    <>
      <StudyCapabilitiesError
        isError={capabilitiesQuery.isError}
        isRetrying={capabilitiesQuery.isFetching}
        onRetry={() => {
          capabilitiesQuery.refetch().catch(() => undefined);
        }}
      />
      <StudyOverviewDashboard
        overview={overviewQuery.data}
        reviewAvailableCount={availableCount}
        loading={overviewQuery.isLoading}
        error={overviewQuery.error instanceof Error ? overviewQuery.error : null}
        onBeginReview={() => {
          runBackgroundTask(() => reviewSession.enterFocusMode('reviews'), {
            label: 'Study session start',
          });
        }}
        onBeginLesson={() => {
          setLessonPreviewIndex(0);
          runBackgroundTask(() => reviewSession.enterFocusMode('lessons'), {
            label: 'Study lesson start',
          });
        }}
        isStartingSession={reviewSession.sessionLoading}
        recentMilestones={
          <StudyAchievementSpotlight
            initialCatalog={reviewSession.achievementCatalog}
            initialProgress={reviewSession.achievementProgress}
            landingAchievementId={landingAchievementId}
            newAchievementIds={sessionNewAchievementIds}
          />
        }
      />
    </>
  );
};

export default StudyPage;
