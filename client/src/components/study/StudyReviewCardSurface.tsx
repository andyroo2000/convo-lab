import type { StudyCardSummary, StudyClientCapabilities } from '@languageflow/shared/src/types';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type useStudyReviewSession from '../../hooks/useStudyReviewSession';
import { StudyCardFace } from './StudyCardPreview';
import StudyCardEditor from './StudyCardEditor';
import StudyGradeButtons from './StudyGradeButtons';
import { getStudyCardAudioUrl } from './studyCardUtils';
import type { StudySessionGrade } from './studySessionWrapUpModel';

type StudyReviewSession = ReturnType<typeof useStudyReviewSession>;

interface StudyReviewCardSurfaceProps {
  answerAudioRef: StudyReviewSession['answerAudioRef'];
  card: StudyCardSummary;
  cardAuthoringCapabilities?: StudyClientCapabilities['cardAuthoring'];
  editing: boolean;
  masteryAnimationActive: boolean;
  onDelete: () => void;
  onGrade: (grade: StudySessionGrade) => Promise<void>;
  onRegenerateAudio: (payload: {
    answerAudioVoiceId: string | null;
    answerAudioTextOverride: string | null;
  }) => Promise<StudyCardSummary | void> | StudyCardSummary | void;
  onReveal: () => void;
  onSave: (payload: {
    prompt: StudyCardSummary['prompt'];
    answer: StudyCardSummary['answer'];
  }) => Promise<void> | void;
  onStopEditing: () => void;
  promptAudioRef: StudyReviewSession['promptAudioRef'];
  revealed: boolean;
  runBackgroundTask: (
    task?: Promise<unknown> | (() => Promise<unknown> | unknown),
    options?: { label?: string }
  ) => void;
  sessionLoading: boolean;
  showGradeTray: boolean;
  undoPending: boolean;
  updateError: string | null;
  updatePending: boolean;
  deletePending: boolean;
  regenerateAudioPending: boolean;
  reviewBusy: boolean;
  visible: boolean;
}

const isRevealKey = (key: string) => {
  if (key === 'Enter') return true;
  return key === ' ';
};

const StudyReviewPrompt = ({
  card,
  onReveal,
  promptAudioRef,
}: Pick<StudyReviewCardSurfaceProps, 'card' | 'onReveal' | 'promptAudioRef'>) => {
  const { t } = useTranslation('study');
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isRevealKey(event.key)) return;
    event.preventDefault();
    onReveal();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('focus.reveal')}
      onClick={onReveal}
      onKeyDown={handleKeyDown}
      className="flex min-h-[calc(100dvh-7.5rem)] w-full flex-1 items-center justify-center px-3 py-4 text-left transition md:min-h-[60vh] md:rounded-2xl md:bg-white md:px-12 md:py-12 md:shadow-sm md:ring-1 md:ring-navy/10 md:hover:shadow-md"
    >
      <div className="w-full min-w-0 overflow-x-hidden">
        <StudyCardFace
          card={card}
          layout="mobile-focus"
          side="front"
          promptAudioRef={promptAudioRef}
        />
        {card.cardType !== 'cloze' ? (
          <p className="mt-8 text-center text-xs uppercase tracking-[0.18em] text-gray-400 sm:mt-10 sm:text-sm sm:tracking-[0.2em]">
            <span className="md:hidden">{t('focus.revealHintMobile')}</span>
            <span className="hidden md:inline">{t('focus.revealHintDesktop')}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
};

const StudyReviewAnswer = ({
  answerAudioRef,
  card,
  cardAuthoringCapabilities,
  deletePending,
  editing,
  masteryAnimationActive,
  onDelete,
  onRegenerateAudio,
  onSave,
  onStopEditing,
  regenerateAudioPending,
  updateError,
  updatePending,
}: Pick<
  StudyReviewCardSurfaceProps,
  | 'answerAudioRef'
  | 'card'
  | 'cardAuthoringCapabilities'
  | 'deletePending'
  | 'editing'
  | 'masteryAnimationActive'
  | 'onDelete'
  | 'onRegenerateAudio'
  | 'onSave'
  | 'onStopEditing'
  | 'regenerateAudioPending'
  | 'updateError'
  | 'updatePending'
>) => {
  if (editing && !masteryAnimationActive) {
    return (
      <div className="min-h-[calc(100dvh-7.5rem)] min-w-0 flex-1 overflow-x-hidden px-2 py-2 md:min-h-[60vh] md:rounded-2xl md:bg-white md:px-12 md:py-10 md:shadow-sm md:ring-1 md:ring-navy/10">
        <StudyCardEditor
          card={card}
          defaultAnswerAudioVoiceId={cardAuthoringCapabilities?.defaultAnswerAudioVoiceId}
          imagePromptMaxLength={cardAuthoringCapabilities?.limits.imagePromptCharacters}
          isSaving={updatePending}
          isDeleting={deletePending}
          isRegeneratingAudio={regenerateAudioPending}
          error={updateError}
          onCancel={onStopEditing}
          onSave={onSave}
          onDelete={onDelete}
          onRegenerateAudio={onRegenerateAudio}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-7.5rem)] min-w-0 flex-1 overflow-x-hidden px-2 py-2 md:min-h-[60vh] md:rounded-2xl md:bg-white md:px-12 md:py-10 md:shadow-sm md:ring-1 md:ring-navy/10">
      <div className="flex flex-col gap-4 md:gap-5">
        <div className="flex min-h-[calc(100dvh-9.5rem)] min-w-0 items-start justify-center overflow-x-hidden md:block md:min-h-0">
          <div className="w-full min-w-0 overflow-x-hidden">
            <StudyCardFace
              card={card}
              layout="mobile-focus"
              side="back"
              answerAudioRef={answerAudioRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const isGradeDisabled = ({
  masteryAnimationActive,
  reviewBusy,
  sessionLoading,
  undoPending,
}: Pick<
  StudyReviewCardSurfaceProps,
  'masteryAnimationActive' | 'reviewBusy' | 'sessionLoading' | 'undoPending'
>) => {
  if (reviewBusy) return true;
  if (sessionLoading) return true;
  if (undoPending) return true;
  return masteryAnimationActive;
};

const StudyGradeTray = ({
  answerAudioRef,
  card,
  masteryAnimationActive,
  onGrade,
  reviewBusy,
  runBackgroundTask,
  sessionLoading,
  showGradeTray,
  undoPending,
}: Pick<
  StudyReviewCardSurfaceProps,
  | 'answerAudioRef'
  | 'card'
  | 'masteryAnimationActive'
  | 'onGrade'
  | 'reviewBusy'
  | 'runBackgroundTask'
  | 'sessionLoading'
  | 'showGradeTray'
  | 'undoPending'
>) => {
  if (!showGradeTray) return null;

  const replayAnswerAudio = getStudyCardAudioUrl(card)
    ? () => {
        const playPromise = answerAudioRef.current?.play();
        runBackgroundTask(playPromise, { label: 'Study answer-audio replay' });
      }
    : undefined;

  return (
    <div
      data-testid="study-grade-tray"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-gray-200 bg-[#fdfbf5]/95 px-1.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-8px_24px_rgba(17,51,92,0.12)] backdrop-blur md:bg-cream/95 md:px-6 md:py-2"
    >
      <div data-testid="study-grade-tray-inner" className="mx-auto max-w-7xl">
        <StudyGradeButtons
          disabled={isGradeDisabled({
            masteryAnimationActive,
            reviewBusy,
            sessionLoading,
            undoPending,
          })}
          onGrade={(grade) => {
            runBackgroundTask(() => onGrade(grade), { label: 'Study card grade' });
          }}
          onReplayAudio={replayAnswerAudio}
        />
      </div>
    </div>
  );
};

const StudyReviewCardSurface = (props: StudyReviewCardSurfaceProps) => {
  const { revealed, showGradeTray, visible } = props;
  if (!visible) return null;

  return (
    <div
      data-testid="study-focus-card-scroll"
      className={`study-focus-scroll relative mt-2 flex min-h-0 min-w-0 flex-1 flex-col justify-between space-y-4 overflow-y-auto overflow-x-hidden md:space-y-2 ${
        showGradeTray ? 'pb-24 md:pb-16' : 'pb-0'
      }`}
    >
      {revealed ? <StudyReviewAnswer {...props} /> : <StudyReviewPrompt {...props} />}
      <StudyGradeTray {...props} />
    </div>
  );
};

export default StudyReviewCardSurface;
