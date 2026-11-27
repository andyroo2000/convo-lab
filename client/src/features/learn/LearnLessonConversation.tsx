import learnStepKey from './learnStepKey';
import type { JournalTutor } from '../journal/journalTutor';
import { LearnQuestion } from './LearnLessonContent';
import { LearnNext } from './LearnSessionControls';
import LearnTranscript from './LearnTranscript';
import type { LearnLesson, LearnSession } from './types';

interface Props {
  session: LearnSession;
  lesson: LearnLesson;
  tutor?: JournalTutor;
  busy: boolean;
  onNext: () => void;
  onReview?: () => void;
  onPrevious?: () => void;
}

const LearnLessonConversation = ({
  session,
  lesson,
  tutor,
  busy,
  onNext,
  onReview,
  onPrevious,
}: Props) => {
  const { phase, turns, answered } = session.state;
  const stepKey = learnStepKey(session.state);
  const hasCurrentReply = turns.some((turn) => turn.stepKey === stepKey);
  const nextAction =
    phase !== 'exercise' || answered ? (
      <LearnNext
        session={session}
        lesson={lesson}
        busy={busy}
        onNext={onNext}
        onReview={onReview}
        onPrevious={onPrevious}
      />
    ) : undefined;
  return (
    <>
      <div id="learn-current-step">
        <LearnQuestion
          session={session}
          lesson={lesson}
          tutor={tutor}
          action={hasCurrentReply ? undefined : nextAction}
        />
      </div>
      <LearnTranscript turns={turns} stepKey={stepKey} tutor={tutor} action={nextAction} />
    </>
  );
};

export default LearnLessonConversation;
