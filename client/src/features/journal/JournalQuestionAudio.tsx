import JournalMinimalPlayer from './JournalMinimalPlayer';
import { JournalPlaybackBoundary } from './JournalPlaybackContext';
import { timedQuestionAudio } from './journalTimedAudio';
import type { TutorQuestion } from './journalTutor';

interface Props {
  ownerId: string;
  entryId: string;
  question?: TutorQuestion;
}
const JournalQuestionAudio = ({ ownerId, entryId, question }: Props) => {
  if (!question?.tutor) return null;
  return (
    <JournalPlaybackBoundary>
      <div className="mt-3">
        <JournalMinimalPlayer
          key={`${ownerId}:${entryId}:${question.id}`}
          label={`${question.tutor.name}'s question`}
          load={(signal) => timedQuestionAudio(entryId, question.id, signal)}
        />
      </div>
    </JournalPlaybackBoundary>
  );
};
export default JournalQuestionAudio;
