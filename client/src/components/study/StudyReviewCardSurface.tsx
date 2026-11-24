import type { StudyCardSummary, StudyClientCapabilities } from '@languageflow/shared/src/types';
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
  masteryFeedback: React.ReactNode;
  onDelete: () => void;
  onRegenerateImage: StudyReviewSession['regenerateCurrentCardImage'];
  selectedGrade: StudySessionGrade | null;
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

const StudyReviewPrompt = ({
  card,
  promptAudioRef,
}: Pick<StudyReviewCardSurfaceProps, 'card' | 'promptAudioRef'>) => {
  const { t } = useTranslation('study');

  return (
    <div className="study-washi-sheet study-washi-prompt">
      <div className="w-full min-w-0 overflow-x-hidden">
        <StudyCardFace
          card={card}
          layout="mobile-focus"
          side="front"
          promptAudioRef={promptAudioRef}
        />
        {card.cardType !== 'cloze' ? (
          <p className="sr-only">
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
  masteryFeedback,
  masteryAnimationActive,
  onGrade,
  selectedGrade,
  reviewBusy,
  runBackgroundTask,
  sessionLoading,
  showGradeTray,
  undoPending,
}: Pick<
  StudyReviewCardSurfaceProps,
  | 'masteryAnimationActive'
  | 'masteryFeedback'
  | 'onGrade'
  | 'selectedGrade'
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
      {masteryAnimationActive && (
        <div className="study-mastery-label-position" data-testid="mastery-feedback-lane">
          {masteryFeedback}
        </div>
      )}
      <div data-testid="study-grade-tray-inner" className="mx-auto max-w-3xl">
        <StudyGradeButtons
          selectedGrade={selectedGrade}
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
  const { onReveal, revealed, visible } = props;
  const { t } = useTranslation('study');
  if (!visible) return null;

  return (
    <div
      data-testid="study-focus-card-scroll"
      className="study-washi-scroll study-focus-scroll relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
    >
      {revealed ? <StudyReviewAnswer {...props} /> : <StudyReviewPrompt {...props} />}
      <StudyGradeTray {...props} />
      {!revealed ? (
        <div className="study-washi-grade-tray fixed inset-x-0 bottom-0 z-[70]">
          <button type="button" className="study-session-reveal" onClick={onReveal}>
            {t('focus.reveal')}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default StudyReviewCardSurface;
