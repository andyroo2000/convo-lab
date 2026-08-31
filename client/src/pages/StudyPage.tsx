import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ConfirmModal from '../components/common/ConfirmModal';
import { StudyCardFace } from '../components/study/StudyCardPreview';
import StudyCardEditor from '../components/study/StudyCardEditor';
import StudyCapabilitiesError from '../components/study/StudyCapabilitiesError';
import StudyGradeButtons from '../components/study/StudyGradeButtons';
import MasteryReviewAnimation from '../components/study/MasteryReviewAnimation';
import { masteryReviewAnnouncementKind } from '../components/study/studyMastery';
import StudyOverviewDashboard from '../components/study/StudyOverviewDashboard';
import StudyReviewActions from '../components/study/StudyReviewActions';
import StudyReviewHeader from '../components/study/StudyReviewHeader';
import StudySessionWrapUp from '../components/study/StudySessionWrapUp';
import {
  StudyAchievementAwardView,
  StudyAchievementSpotlight,
} from '../components/study/StudyAchievementViews';
import StudySetDueControls from '../components/study/StudySetDueControls';
import { getStudyCardAudioUrl } from '../components/study/studyCardUtils';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useStudyOverview } from '../hooks/useStudy';
import useStudyBackgroundTask from '../hooks/useStudyBackgroundTask';
import useStudyReviewSession from '../hooks/useStudyReviewSession';
import { useStudyActivityActions } from '../contexts/StudyActivityContext';
import { useAutomaticStudyActivity } from '../hooks/useStudyActivity';
import { useStudyCapabilities } from '../hooks/useStudyCapabilities';

const StudyPage = () => {
  const { t } = useTranslation('study');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const overviewQuery = useStudyOverview(enabled);
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
        category: 'review',
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
    if (!enabled || !lessonCohortId || startedLessonCohortRef.current === lessonCohortId) return;

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
      !reviewSession.focusMode ||
      reviewSession.sessionKind !== 'lessons' ||
      reviewSession.lessonPhase !== 'preview'
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
              {!showingAchievementAward &&
              reviewSession.sessionKind === 'lessons' &&
              reviewSession.lessonPhase === 'preview' &&
              !reviewSession.sessionLoading ? (
                <div className="min-h-0 flex-1 overflow-y-auto py-4">
                  <div className="mx-auto max-w-5xl space-y-4">
                    <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
                      <h2 className="text-2xl font-bold text-navy">{t('lesson.previewTitle')}</h2>
                      <p className="mt-1 text-gray-600">{t('lesson.previewDescription')}</p>
                    </div>
                    {lessonPreviewCard ? (
                      <div
                        key={lessonPreviewCard.id}
                        className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
                      >
                        <p className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
                          {t('lesson.cardPosition', {
                            current: lessonPreviewIndex + 1,
                            total: reviewSession.cards.length,
                          })}
                        </p>
                        <StudyCardFace card={lessonPreviewCard} layout="mobile-focus" side="back" />
                      </div>
                    ) : null}
                    {lessonPreviewCard ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setLessonPreviewIndex((current) => Math.max(0, current - 1))
                          }
                          disabled={lessonPreviewIsFirst}
                          className="rounded-2xl border border-gray-300 px-6 py-4 text-lg font-bold text-navy disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t('lesson.previous')}
                        </button>
                        {lessonPreviewIsLast ? (
                          <button
                            type="button"
                            onClick={reviewSession.beginLessonQuiz}
                            className="rounded-2xl bg-emerald-700 px-6 py-4 text-lg font-bold text-white"
                          >
                            {t('lesson.startQuiz')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setLessonPreviewIndex((current) =>
                                Math.min(reviewSession.cards.length - 1, current + 1)
                              )
                            }
                            className="rounded-2xl bg-emerald-700 px-6 py-4 text-lg font-bold text-white"
                          >
                            {t('lesson.next')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">
                        {t('lesson.noneAvailable')}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
              {!showingAchievementAward &&
              reviewSession.sessionKind === 'lessons' &&
              reviewSession.lessonPhase === 'complete' &&
              !masteryAnimation ? (
                <div className="flex min-h-[60vh] flex-1 items-center justify-center">
                  <div className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
                    <h2 className="text-3xl font-bold text-navy">{t('lesson.completeTitle')}</h2>
                    <p className="mt-3 text-gray-600">{t('lesson.completeDescription')}</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setLessonPreviewIndex(0);
                          runBackgroundTask(() => reviewSession.loadNextLessonBatch(), {
                            label: 'Next lesson batch',
                          });
                        }}
                        className="rounded-full bg-emerald-700 px-6 py-3 font-bold text-white"
                      >
                        {t('lesson.anotherBatch')}
                      </button>
                      <button
                        type="button"
                        onClick={reviewSession.exitFocusMode}
                        className="rounded-full border border-gray-300 px-6 py-3 font-bold text-navy"
                      >
                        {t('lesson.finish')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
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

              {!showingAchievementAward &&
              showQuizSurface &&
              displayedCard &&
              !reviewSession.reviewSessionComplete ? (
                <div
                  data-testid="study-focus-card-scroll"
                  className={`study-focus-scroll relative mt-2 flex min-h-0 min-w-0 flex-1 flex-col justify-between space-y-4 overflow-y-auto overflow-x-hidden md:space-y-2 ${
                    showGradeTray ? 'pb-24 md:pb-16' : 'pb-0'
                  }`}
                >
                  {!displayedCardIsRevealed ? (
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
                      className="flex min-h-[calc(100dvh-7.5rem)] w-full flex-1 items-center justify-center px-3 py-4 text-left transition md:min-h-[60vh] md:rounded-2xl md:bg-white md:px-12 md:py-12 md:shadow-sm md:ring-1 md:ring-navy/10 md:hover:shadow-md"
                    >
                      <div className="w-full min-w-0 overflow-x-hidden">
                        <StudyCardFace
                          card={displayedCard}
                          layout="mobile-focus"
                          side="front"
                          promptAudioRef={reviewSession.promptAudioRef}
                        />
                        {displayedCard.cardType !== 'cloze' ? (
                          <p className="mt-8 text-center text-xs uppercase tracking-[0.18em] text-gray-400 sm:mt-10 sm:text-sm sm:tracking-[0.2em]">
                            <span className="md:hidden">{t('focus.revealHintMobile')}</span>
                            <span className="hidden md:inline">{t('focus.revealHintDesktop')}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="min-h-[calc(100dvh-7.5rem)] min-w-0 flex-1 overflow-x-hidden px-2 py-2 md:min-h-[60vh] md:rounded-2xl md:bg-white md:px-12 md:py-10 md:shadow-sm md:ring-1 md:ring-navy/10">
                      {reviewSession.editing && !masteryAnimation ? (
                        <StudyCardEditor
                          card={displayedCard}
                          defaultAnswerAudioVoiceId={
                            cardAuthoringCapabilities?.defaultAnswerAudioVoiceId
                          }
                          imagePromptMaxLength={
                            cardAuthoringCapabilities?.limits.imagePromptCharacters
                          }
                          isSaving={reviewSession.updateCardMutation.isPending}
                          isDeleting={reviewSession.deleteCardMutation.isPending}
                          isRegeneratingAudio={reviewSession.regenerateAudioMutation.isPending}
                          error={reviewSession.updateCardErrorMessage}
                          onCancel={() => {
                            reviewSession.setEditing(false);
                          }}
                          onSave={reviewSession.saveCurrentCard}
                          onDelete={() => setIsDeleteConfirmOpen(true)}
                          onRegenerateAudio={reviewSession.regenerateCurrentCardAudio}
                        />
                      ) : (
                        <div className="flex flex-col gap-4 md:gap-5">
                          <div className="flex min-h-[calc(100dvh-9.5rem)] min-w-0 items-start justify-center overflow-x-hidden md:block md:min-h-0">
                            <div className="w-full min-w-0 overflow-x-hidden">
                              <StudyCardFace
                                card={displayedCard}
                                layout="mobile-focus"
                                side="back"
                                answerAudioRef={reviewSession.answerAudioRef}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {showGradeTray ? (
                    <div
                      data-testid="study-grade-tray"
                      className="fixed inset-x-0 bottom-0 z-[70] border-t border-gray-200 bg-[#fdfbf5]/95 px-1.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-8px_24px_rgba(17,51,92,0.12)] backdrop-blur md:bg-cream/95 md:px-6 md:py-2"
                    >
                      <div data-testid="study-grade-tray-inner" className="mx-auto max-w-7xl">
                        <StudyGradeButtons
                          disabled={
                            reviewSession.reviewBusy ||
                            reviewSession.sessionLoading ||
                            reviewSession.undoPending ||
                            reviewSession.masteryAnimation !== null
                          }
                          onGrade={(grade) => {
                            runBackgroundTask(() => reviewSession.handleGrade(grade), {
                              label: 'Study card grade',
                            });
                          }}
                          onReplayAudio={
                            getStudyCardAudioUrl(reviewSession.currentCard)
                              ? () => {
                                  const playPromise = reviewSession.answerAudioRef.current?.play();
                                  runBackgroundTask(playPromise, {
                                    label: 'Study answer-audio replay',
                                  });
                                }
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
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
