import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

import type useStudyBackgroundTask from '../../hooks/useStudyBackgroundTask';
import type useStudyReviewSession from '../../hooks/useStudyReviewSession';
import StudySessionWrapUp from './StudySessionWrapUp';
import StudySetDueControls from './StudySetDueControls';

type StudyReviewSession = ReturnType<typeof useStudyReviewSession>;
type RunBackgroundTask = ReturnType<typeof useStudyBackgroundTask>;

interface StudyFocusSessionStatusProps {
  displayedCard: StudyCardSummary | null;
  masteryAnimationActive: boolean;
  onFinishReview: () => void;
  reviewSession: StudyReviewSession;
  runBackgroundTask: RunBackgroundTask;
  showingAchievementAward: boolean;
  showQuizSurface: boolean;
}

type SharedStatusProps = Pick<
  StudyFocusSessionStatusProps,
  'reviewSession' | 'runBackgroundTask' | 'showingAchievementAward'
>;
type ActiveStatusProps = Pick<SharedStatusProps, 'reviewSession' | 'runBackgroundTask'>;

const reviewCardCanSetDue = (reviewSession: StudyReviewSession) => {
  if (!reviewSession.currentCard) return false;
  if (!reviewSession.revealed) return false;
  return !reviewSession.editing;
};

export const StudyPracticeBanner = ({
  reviewSession,
  showingAchievementAward,
}: Pick<SharedStatusProps, 'reviewSession' | 'showingAchievementAward'>) => {
  const { t } = useTranslation('study');
  if (showingAchievementAward) return null;
  if (!reviewSession.practiceMode) return null;

  return (
    <div className="mt-2 rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-gray-700">
      <p className="font-bold text-cyan-700">{t('practice.title')}</p>
      <p>{t('practice.description')}</p>
    </div>
  );
};

const StudySetDuePanel = ({ reviewSession }: Pick<ActiveStatusProps, 'reviewSession'>) => {
  if (!reviewCardCanSetDue(reviewSession)) return null;
  if (!reviewSession.showSetDueControls) return null;

  return (
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
  );
};

const getMotionBannerMessage = (
  permissionState: StudyReviewSession['motionPermissionState'],
  translate: ReturnType<typeof useTranslation<'study'>>['t']
) => {
  if (permissionState === 'unsupported') return translate('motion.unsupported');
  if (permissionState === 'denied') return translate('motion.denied');
  return translate('motion.prompt');
};

const shouldShowMotionBanner = (permissionState: StudyReviewSession['motionPermissionState']) => {
  if (permissionState === 'prompt') return true;
  return permissionState === 'denied';
};

const StudyMotionBanner = ({ reviewSession, runBackgroundTask }: ActiveStatusProps) => {
  const { t } = useTranslation('study');
  if (!shouldShowMotionBanner(reviewSession.motionPermissionState)) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 md:mt-4 md:gap-3 md:rounded-2xl md:px-4 md:py-3 md:text-sm">
      <p>{getMotionBannerMessage(reviewSession.motionPermissionState, t)}</p>
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
  );
};

const StudySessionLoading = ({ reviewSession }: Pick<ActiveStatusProps, 'reviewSession'>) => {
  const { t } = useTranslation('study');
  if (!reviewSession.sessionLoading) return null;

  return <p className="py-16 text-center text-gray-500">{t('focus.loading')}</p>;
};

const StudySessionError = ({ reviewSession, runBackgroundTask }: ActiveStatusProps) => {
  const { t } = useTranslation('study');
  if (!reviewSession.sessionError) return null;

  return (
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
  );
};

const StudyConflictNotice = ({ reviewSession }: Pick<ActiveStatusProps, 'reviewSession'>) => {
  const { t } = useTranslation('study');
  if (!reviewSession.reviewConflictRecovered) return null;

  return (
    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
      {t('focus.reviewConflictRecovered')}
    </p>
  );
};

const StudyReviewWrapUp = ({
  masteryAnimationActive,
  onFinishReview,
  reviewSession,
}: Pick<
  StudyFocusSessionStatusProps,
  'masteryAnimationActive' | 'onFinishReview' | 'reviewSession'
>) => {
  if (!reviewSession.reviewSessionComplete) return null;
  if (masteryAnimationActive) return null;

  return (
    <StudySessionWrapUp
      summary={reviewSession.sessionWrapUp}
      caughtUp={reviewSession.reviewQueueExhausted}
      achievements={[...reviewSession.completionAchievements].reverse()}
      isFinalizing={reviewSession.achievementCompletionRefreshPending}
      onPractice={reviewSession.startToughestPractice}
      onDone={onFinishReview}
    />
  );
};

const StudyPracticeComplete = ({ reviewSession }: Pick<ActiveStatusProps, 'reviewSession'>) => {
  const { t } = useTranslation('study');
  if (!reviewSession.practiceComplete) return null;

  return (
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
  );
};

const reviewHasResult = (reviewSession: StudyReviewSession) =>
  reviewSession.reviewSessionComplete || reviewSession.practiceComplete;

const reviewIsUnavailable = (reviewSession: StudyReviewSession) =>
  reviewSession.sessionLoading || Boolean(reviewSession.sessionError);

const StudyEmptySession = ({
  displayedCard,
  reviewSession,
  showQuizSurface,
}: Pick<StudyFocusSessionStatusProps, 'displayedCard' | 'reviewSession' | 'showQuizSurface'>) => {
  const { t } = useTranslation('study');
  if (!showQuizSurface) return null;
  if (displayedCard) return null;
  if (reviewIsUnavailable(reviewSession)) return null;
  if (reviewHasResult(reviewSession)) return null;

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600 sm:rounded-[2rem]">
      {t('focus.empty')}
    </div>
  );
};

const StudyFocusSessionStatus = (props: StudyFocusSessionStatusProps) => {
  const { showingAchievementAward } = props;
  if (showingAchievementAward) return null;

  return (
    <>
      <StudySetDuePanel {...props} />
      <StudyMotionBanner {...props} />
      <StudySessionLoading {...props} />
      <StudySessionError {...props} />
      <StudyConflictNotice {...props} />
      <StudyReviewWrapUp {...props} />
      <StudyPracticeComplete {...props} />
      <StudyEmptySession {...props} />
    </>
  );
};

export default StudyFocusSessionStatus;
