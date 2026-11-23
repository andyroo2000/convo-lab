import type { StudyCardSummary, StudyClientCapabilities } from '@languageflow/shared/src/types';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type useStudyReviewSession from '../../hooks/useStudyReviewSession';
import { StudyCardFace } from './StudyCardPreview';
import StudyCardEditor from './StudyCardEditor';
import StudyGradeButtons from './StudyGradeButtons';
import './studyWashi.css';
import type { StudySessionGrade } from './studySessionWrapUpModel';

type StudyReviewSession = ReturnType<typeof useStudyReviewSession>;

interface StudyReviewCardSurfaceProps {
  answerAudioRef: StudyReviewSession['answerAudioRef'];
  card: StudyCardSummary;
  cardAuthoringCapabilities?: StudyClientCapabilities['cardAuthoring'];
  editing: boolean;
  masteryAnimationActive: boolean;
  onDelete: () => void;
  onRegenerateImage: StudyReviewSession['regenerateCurrentCardImage'];
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
  regenerateImagePending: boolean;
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
      className="study-washi-sheet study-washi-prompt"
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
  onRegenerateImage,
  onSave,
  onStopEditing,
  regenerateAudioPending,
  regenerateImagePending,
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
  | 'onRegenerateImage'
  | 'onSave'
  | 'onStopEditing'
  | 'regenerateAudioPending'
  | 'regenerateImagePending'
  | 'updateError'
  | 'updatePending'
>) => {
  if (editing && !masteryAnimationActive) {
    return (
      <div className="study-washi-sheet min-w-0">
        <StudyCardEditor
          card={card}
          defaultAnswerAudioVoiceId={cardAuthoringCapabilities?.defaultAnswerAudioVoiceId}
          imagePromptMaxLength={cardAuthoringCapabilities?.limits.imagePromptCharacters}
          isSaving={updatePending}
          isDeleting={deletePending}
          isRegeneratingAudio={regenerateAudioPending}
          isRegeneratingImage={regenerateImagePending}
          error={updateError}
          onCancel={onStopEditing}
          onSave={onSave}
          onDelete={onDelete}
          onRegenerateAudio={onRegenerateAudio}
          onRegenerateImage={onRegenerateImage}
        />
      </div>
    );
  }

  return (
    <div className="study-washi-sheet min-w-0">
      <div className="flex flex-col gap-4 md:gap-5">
        <div className="min-w-0">
          <div className="w-full min-w-0 overflow-x-hidden">
            <StudyCardFace
              card={card}
              layout="mobile-focus"
              side="back"
              inlineAnswerAudio
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
  masteryAnimationActive,
  onGrade,
  reviewBusy,
  runBackgroundTask,
  sessionLoading,
  showGradeTray,
  undoPending,
}: Pick<
  StudyReviewCardSurfaceProps,
  | 'masteryAnimationActive'
  | 'onGrade'
  | 'reviewBusy'
  | 'runBackgroundTask'
  | 'sessionLoading'
  | 'showGradeTray'
  | 'undoPending'
>) => {
  if (!showGradeTray) return null;

  return (
    <div
      data-testid="study-grade-tray"
      className="study-washi-grade-tray fixed inset-x-0 bottom-0 z-[70]"
    >
      <div data-testid="study-grade-tray-inner" className="mx-auto max-w-3xl">
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
      className={`study-washi-scroll study-focus-scroll relative mt-2 flex min-h-0 min-w-0 flex-1 flex-col space-y-4 overflow-y-auto overflow-x-hidden md:space-y-2 ${
        showGradeTray ? 'pb-24 md:pb-16' : 'pb-0'
      }`}
    >
      {revealed ? <StudyReviewAnswer {...props} /> : <StudyReviewPrompt {...props} />}
      <StudyGradeTray {...props} />
    </div>
  );
};

export default StudyReviewCardSurface;
