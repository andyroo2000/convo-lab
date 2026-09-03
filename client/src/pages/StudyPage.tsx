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

type StudyReviewSession = ReturnType<typeof useStudyReviewSession>;
type BackgroundTaskRunner = ReturnType<typeof useStudyBackgroundTask>;
type Navigate = ReturnType<typeof useNavigate>;
type SearchParamsSetter = ReturnType<typeof useSearchParams>[1];

const useLessonPreview = ({
  enabled,
  lessonCohortId,
  reviewSession,
  runBackgroundTask,
  searchParams,
  setSearchParams,
}: {
  enabled: boolean;
  lessonCohortId: string | null;
  reviewSession: StudyReviewSession;
  runBackgroundTask: BackgroundTaskRunner;
  searchParams: URLSearchParams;
  setSearchParams: SearchParamsSetter;
}) => {
  const [index, setIndex] = useState(0);
  const startedLessonCohortRef = useRef<string | null>(null);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(reviewSession.cards.length - 1, 0)));
  }, [reviewSession.cards.length]);

  useEffect(() => {
    if (!shouldStartLessonCohort(enabled, lessonCohortId, startedLessonCohortRef.current)) return;

    startedLessonCohortRef.current = lessonCohortId;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('lessonCohortId');
    setSearchParams(nextSearchParams, { replace: true });
    setIndex(0);
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
        setIndex((current) => Math.max(0, current - 1));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((current) => Math.min(reviewSession.cards.length - 1, current + 1));
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

  return {
    card: reviewSession.cards[index] ?? null,
    index,
    isFirst: index === 0,
    isLast: reviewSession.cards.length > 0 && index === reviewSession.cards.length - 1,
    setIndex,
  };
};

const useReviewViewTransition = () =>
  useCallback((update: () => void) => {
    const startViewTransition = document.startViewTransition?.bind(document);
    if (!startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update();
      return;
    }
    startViewTransition(() => flushSync(update));
  }, []);

const StudyDisabled = () => {
  const { t } = useTranslation('study');
  return (
    <section className="card retro-paper-panel max-w-3xl">
      <h1 className="mb-4 text-3xl font-bold text-navy">{t('title')}</h1>
      <p className="text-gray-600">{t('disabled')}</p>
    </section>
  );
};

const StudyReviewActionButtons = ({
  navigate,
  reviewSession,
  runBackgroundTask,
}: {
  navigate: Navigate;
  reviewSession: StudyReviewSession;
  runBackgroundTask: BackgroundTaskRunner;
}) => {
  if (!reviewSession.currentCard) return null;
  return (
    <StudyReviewActions
      card={reviewSession.currentCard}
      disabled={reviewSession.cardActionMutation.isPending || reviewSession.reviewBusy}
      onEdit={() => reviewSession.setEditing(true)}
      onBury={reviewSession.handleBuryForSession}
      onToggleSuspend={() => {
        runBackgroundTask(
          () =>
            reviewSession.handleCardAction(
              reviewSession.currentCard?.state.queueState === 'suspended' ? 'unsuspend' : 'suspend'
            ),
          { label: 'Study card action' }
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

const hideFocusHeader = (reviewSession: StudyReviewSession, showingAchievementAward: boolean) => {
  if (showingAchievementAward) return true;
  if (reviewSession.reviewSessionComplete) return true;
  return reviewSession.practiceComplete;
};

const showReviewActions = (reviewSession: StudyReviewSession) => {
  if (!reviewSession.revealed) return false;
  if (reviewSession.editing) return false;
  return !reviewSession.practiceMode;
};

const StudyFocusHeader = ({
  navigate,
  reviewSession,
  runBackgroundTask,
  showingAchievementAward,
}: {
  navigate: Navigate;
  reviewSession: StudyReviewSession;
  runBackgroundTask: BackgroundTaskRunner;
  showingAchievementAward: boolean;
}) => {
  const { t } = useTranslation('study');
  if (hideFocusHeader(reviewSession, showingAchievementAward)) return null;
  return (
    <StudyReviewHeader
      progress={reviewSession.sessionProgress}
      counts={reviewSession.sessionCounts}
      actions={
        showReviewActions(reviewSession) ? (
          <StudyReviewActionButtons
            navigate={navigate}
            reviewSession={reviewSession}
            runBackgroundTask={runBackgroundTask}
          />
        ) : null
      }
      onExit={reviewSession.endReviewSession}
      exitLabel={reviewSession.practiceMode ? t('practice.back') : undefined}
    />
  );
};

const StudyAchievementAward = ({
  reviewSession,
  runViewTransition,
}: {
  reviewSession: StudyReviewSession;
  runViewTransition: (update: () => void) => void;
}) => {
  if (!reviewSession.currentAchievement) return null;
  return (
    <StudyAchievementAwardView
      achievements={reviewSession.completionAchievements}
      currentIndex={reviewSession.currentAchievementIndex}
      onContinue={() => {
        const showingLastAchievement =
          reviewSession.currentAchievementIndex + 1 >= reviewSession.completionAchievements.length;
        if (showingLastAchievement) runViewTransition(reviewSession.advanceAchievement);
        else reviewSession.advanceAchievement();
      }}
    />
  );
};

const StudyMasteryFeedback = ({ reviewSession }: { reviewSession: StudyReviewSession }) => {
  const { t } = useTranslation('study');
  const { masteryAnimation } = reviewSession;
  if (!masteryAnimation) return null;
  return (
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
        { item: masteryAnimation.label, level: masteryAnimation.toLevel }
      )}
      onFinished={() => {
        reviewSession.setMasteryAnimation((current) =>
          current?.id === masteryAnimation.id ? null : current
        );
      }}
    />
  );
};

const StudyLessonContent = ({
  lessonPreview,
  reviewSession,
  runBackgroundTask,
  showingAchievementAward,
}: {
  lessonPreview: ReturnType<typeof useLessonPreview>;
  reviewSession: StudyReviewSession;
  runBackgroundTask: BackgroundTaskRunner;
  showingAchievementAward: boolean;
}) => {
  const { t } = useTranslation('study');
  return (
    <StudyLessonPhase
      active={!showingAchievementAward}
      complete={{
        anotherBatchLabel: t('lesson.anotherBatch'),
        description: t('lesson.completeDescription'),
        finishLabel: t('lesson.finish'),
        onAnotherBatch: () => {
          lessonPreview.setIndex(0);
          runBackgroundTask(() => reviewSession.loadNextLessonBatch(), {
            label: 'Next lesson batch',
          });
        },
        onFinish: reviewSession.exitFocusMode,
        title: t('lesson.completeTitle'),
      }}
      lessonPhase={reviewSession.lessonPhase}
      masteryAnimationActive={Boolean(reviewSession.masteryAnimation)}
      preview={{
        card: lessonPreview.card,
        cardPosition: t('lesson.cardPosition', {
          current: lessonPreview.index + 1,
          total: reviewSession.cards.length,
        }),
        description: t('lesson.previewDescription'),
        emptyMessage: t('lesson.noneAvailable'),
        isFirst: lessonPreview.isFirst,
        isLast: lessonPreview.isLast,
        nextLabel: t('lesson.next'),
        onNext: () =>
          lessonPreview.setIndex((current) =>
            Math.min(reviewSession.cards.length - 1, current + 1)
          ),
        onPrevious: () => lessonPreview.setIndex((current) => Math.max(0, current - 1)),
        onStartQuiz: reviewSession.beginLessonQuiz,
        previousLabel: t('lesson.previous'),
        startQuizLabel: t('lesson.startQuiz'),
        title: t('lesson.previewTitle'),
      }}
      sessionKind={reviewSession.sessionKind}
      sessionLoading={reviewSession.sessionLoading}
    />
  );
};

const StudyFocusedCard = ({
  cardAuthoringCapabilities,
  displayedCard,
  displayedCardIsRevealed,
  onDelete,
  reviewSession,
  runBackgroundTask,
  showingAchievementAward,
  showGradeTray,
  showQuizSurface,
}: {
  cardAuthoringCapabilities: React.ComponentProps<
    typeof StudyReviewCardSurface
  >['cardAuthoringCapabilities'];
  displayedCard: StudyReviewSession['currentCard'];
  displayedCardIsRevealed: boolean;
  onDelete: () => void;
  reviewSession: StudyReviewSession;
  runBackgroundTask: BackgroundTaskRunner;
  showingAchievementAward: boolean;
  showGradeTray: boolean;
  showQuizSurface: boolean;
}) => {
  if (!displayedCard) return null;
  return (
    <StudyReviewCardSurface
      answerAudioRef={reviewSession.answerAudioRef}
      card={displayedCard}
      cardAuthoringCapabilities={cardAuthoringCapabilities}
      deletePending={reviewSession.deleteCardMutation.isPending}
      editing={reviewSession.editing}
      masteryAnimationActive={Boolean(reviewSession.masteryAnimation)}
      onDelete={onDelete}
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
      visible={!showingAchievementAward && showQuizSurface && !reviewSession.reviewSessionComplete}
    />
  );
};

const StudyDeleteConfirm = ({
  isOpen,
  onClose,
  reviewSession,
  runBackgroundTask,
}: {
  isOpen: boolean;
  onClose: () => void;
  reviewSession: StudyReviewSession;
  runBackgroundTask: BackgroundTaskRunner;
}) => {
  const { t } = useTranslation('study');
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={t('editor.delete')}
      message={t('editor.confirmDelete')}
      confirmLabel={t('editor.delete')}
      onCancel={onClose}
      onConfirm={() => {
        runBackgroundTask(
          async () => {
            try {
              await reviewSession.deleteCurrentCard();
            } finally {
              onClose();
            }
          },
          { label: 'Study card delete' }
        );
      }}
      isLoading={reviewSession.deleteCardMutation.isPending}
    />
  );
};

const isGradeTrayVisible = (
  reviewSession: StudyReviewSession,
  showingAchievementAward: boolean
) => {
  if (!reviewSession.revealed) return false;
  if (reviewSession.editing) return false;
  return !showingAchievementAward;
};

const isDisplayedCardRevealed = (reviewSession: StudyReviewSession) => {
  if (reviewSession.masteryAnimation !== null) return true;
  return reviewSession.revealed;
};

const isQuizSurfaceVisible = (reviewSession: StudyReviewSession) => {
  if (reviewSession.lessonPhase === 'quiz') return true;
  return reviewSession.masteryAnimation !== null;
};

const showMasteryFeedback = (showingAchievementAward: boolean, showQuizSurface: boolean) => {
  if (showingAchievementAward) return false;
  return showQuizSurface;
};

const StudyFocusExperience = ({
  capabilitiesQuery,
  isDeleteConfirmOpen,
  lessonPreview,
  navigate,
  onCloseDeleteConfirm,
  onOpenDeleteConfirm,
  reviewSession,
  runBackgroundTask,
  runViewTransition,
  setLandingAchievementId,
  setSessionNewAchievementIds,
}: {
  capabilitiesQuery: ReturnType<typeof useStudyCapabilities>;
  isDeleteConfirmOpen: boolean;
  lessonPreview: ReturnType<typeof useLessonPreview>;
  navigate: Navigate;
  onCloseDeleteConfirm: () => void;
  onOpenDeleteConfirm: () => void;
  reviewSession: StudyReviewSession;
  runBackgroundTask: BackgroundTaskRunner;
  runViewTransition: (update: () => void) => void;
  setLandingAchievementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSessionNewAchievementIds: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
  const showingAchievementAward = reviewSession.currentAchievement !== null;
  const showGradeTray = isGradeTrayVisible(reviewSession, showingAchievementAward);
  const displayedCard = reviewSession.masteryAnimation?.card ?? reviewSession.currentCard;
  const displayedCardIsRevealed = isDisplayedCardRevealed(reviewSession);
  const showQuizSurface = isQuizSurfaceVisible(reviewSession);
  return (
    <>
      {/* Keep horizontal overflow hidden: clip breaks Chromium hit-testing on tall cards. */}
      <div className="fixed inset-0 z-[60] overflow-hidden bg-[#fdfbf5] md:bg-cream">
        <section className="h-[100dvh] md:px-3 md:py-2">
          <div
            data-testid="study-focus-shell"
            className="study-focus-shell mx-auto flex h-[100dvh] min-h-0 max-w-7xl flex-col overflow-x-hidden bg-[#fdfbf5] px-2 pt-2 md:h-[calc(100dvh-1rem)] md:rounded-2xl md:px-4 md:py-2 md:shadow-sm md:ring-1 md:ring-navy/10"
          >
            <StudyCapabilitiesError
              isError={capabilitiesQuery.isError}
              isRetrying={capabilitiesQuery.isFetching}
              onRetry={() => capabilitiesQuery.refetch().catch(() => undefined)}
            />
            <StudyFocusHeader
              navigate={navigate}
              reviewSession={reviewSession}
              runBackgroundTask={runBackgroundTask}
              showingAchievementAward={showingAchievementAward}
            />
            <StudyAchievementAward
              reviewSession={reviewSession}
              runViewTransition={runViewTransition}
            />
            <StudyPracticeBanner
              reviewSession={reviewSession}
              showingAchievementAward={showingAchievementAward}
            />
            {showMasteryFeedback(showingAchievementAward, showQuizSurface) ? (
              <div className="mastery-feedback-lane" data-testid="mastery-feedback-lane">
                <StudyMasteryFeedback reviewSession={reviewSession} />
              </div>
            ) : null}
            <StudyLessonContent
              lessonPreview={lessonPreview}
              reviewSession={reviewSession}
              runBackgroundTask={runBackgroundTask}
              showingAchievementAward={showingAchievementAward}
            />
            <StudyFocusSessionStatus
              displayedCard={displayedCard}
              masteryAnimationActive={Boolean(reviewSession.masteryAnimation)}
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
            <StudyFocusedCard
              cardAuthoringCapabilities={capabilitiesQuery.data?.cardAuthoring}
              displayedCard={displayedCard}
              displayedCardIsRevealed={displayedCardIsRevealed}
              onDelete={onOpenDeleteConfirm}
              reviewSession={reviewSession}
              runBackgroundTask={runBackgroundTask}
              showingAchievementAward={showingAchievementAward}
              showGradeTray={showGradeTray}
              showQuizSurface={showQuizSurface}
            />
          </div>
        </section>
      </div>
      <StudyDeleteConfirm
        isOpen={isDeleteConfirmOpen}
        onClose={onCloseDeleteConfirm}
        reviewSession={reviewSession}
        runBackgroundTask={runBackgroundTask}
      />
    </>
  );
};

const StudyDashboard = ({
  capabilitiesQuery,
  landingAchievementId,
  lessonPreview,
  overviewQuery,
  reviewSession,
  runBackgroundTask,
  sessionNewAchievementIds,
}: {
  capabilitiesQuery: ReturnType<typeof useStudyCapabilities>;
  landingAchievementId: string | null;
  lessonPreview: ReturnType<typeof useLessonPreview>;
  overviewQuery: ReturnType<typeof useStudyOverview>;
  reviewSession: StudyReviewSession;
  runBackgroundTask: BackgroundTaskRunner;
  sessionNewAchievementIds: string[];
}) => {
  const availableCount =
    (overviewQuery.data?.failedDueCount ?? 0) + (overviewQuery.data?.dueCount ?? 0);
  return (
    <>
      <StudyCapabilitiesError
        isError={capabilitiesQuery.isError}
        isRetrying={capabilitiesQuery.isFetching}
        onRetry={() => capabilitiesQuery.refetch().catch(() => undefined)}
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
          lessonPreview.setIndex(0);
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

const StudyPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const overviewQuery = useStudyOverview({ enabled });
  const capabilitiesQuery = useStudyCapabilities(enabled);
  const reviewSession = useStudyReviewSession();
  const { start: startActivity, stop: stopActivity } = useStudyActivityActions();
  const runBackgroundTask = useStudyBackgroundTask();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [landingAchievementId, setLandingAchievementId] = useState<string | null>(null);
  const [sessionNewAchievementIds, setSessionNewAchievementIds] = useState<string[]>([]);
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
  const runViewTransition = useReviewViewTransition();
  const lessonPreview = useLessonPreview({
    enabled,
    lessonCohortId: searchParams.get('lessonCohortId'),
    reviewSession,
    runBackgroundTask,
    searchParams,
    setSearchParams,
  });

  if (!enabled) return <StudyDisabled />;
  if (reviewSession.focusMode) {
    return (
      <StudyFocusExperience
        capabilitiesQuery={capabilitiesQuery}
        isDeleteConfirmOpen={isDeleteConfirmOpen}
        lessonPreview={lessonPreview}
        navigate={navigate}
        onCloseDeleteConfirm={() => setIsDeleteConfirmOpen(false)}
        onOpenDeleteConfirm={() => setIsDeleteConfirmOpen(true)}
        reviewSession={reviewSession}
        runBackgroundTask={runBackgroundTask}
        runViewTransition={runViewTransition}
        setLandingAchievementId={setLandingAchievementId}
        setSessionNewAchievementIds={setSessionNewAchievementIds}
      />
    );
  }
  return (
    <StudyDashboard
      capabilitiesQuery={capabilitiesQuery}
      landingAchievementId={landingAchievementId}
      lessonPreview={lessonPreview}
      overviewQuery={overviewQuery}
      reviewSession={reviewSession}
      runBackgroundTask={runBackgroundTask}
      sessionNewAchievementIds={sessionNewAchievementIds}
    />
  );
};

export default StudyPage;
