import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ConfirmModal from '../components/common/ConfirmModal';
import StudyCapabilitiesError from '../components/study/StudyCapabilitiesError';
import StudyFocusSessionStatus, {
  StudyPracticeBanner,
} from '../components/study/StudyFocusSessionStatus';
import MasteryReviewAnimation from '../components/study/MasteryReviewAnimation';
import { masteryReviewAnnouncementKind } from '../components/study/studyMastery';
import StudyOverviewDashboard from '../components/study/StudyOverviewDashboard';
import StudyReviewActions from '../components/study/StudyReviewActions';
import StudyReviewCardSurface from '../components/study/StudyReviewCardSurface';
import StudyReviewHeader from '../components/study/StudyReviewHeader';
import {
  StudyAchievementAwardView,
  StudyAchievementSpotlight,
} from '../components/study/StudyAchievementViews';
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
              <StudyPracticeBanner
                reviewSession={reviewSession}
                showingAchievementAward={showingAchievementAward}
              />
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
              <StudyFocusSessionStatus
                displayedCard={displayedCard}
                masteryAnimationActive={Boolean(masteryAnimation)}
                onFinishReview={() => {
                  const newest = [...reviewSession.completionAchievements].reverse()[0] ?? null;
                  setLandingAchievementId(newest?.id ?? null);
                  setSessionNewAchievementIds(
                    reviewSession.completionAchievements.map(({ id }) => id)
                  );
                  runViewTransition(reviewSession.finishReviewSession);
                }}
                reviewSession={reviewSession}
                runBackgroundTask={runBackgroundTask}
                showingAchievementAward={showingAchievementAward}
                showQuizSurface={showQuizSurface}
              />

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
