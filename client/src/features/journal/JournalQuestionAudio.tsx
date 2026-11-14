import JournalTutorRibbon, { type TutorRibbonSlots } from './JournalTutorRibbon';
import { JournalPlaybackBoundary } from './JournalPlaybackContext';
import { timedQuestionAudio } from './journalTimedAudio';
import useJournalPlayer from './useJournalPlayer';
import type { TutorQuestion } from './journalTutor';

interface Props extends TutorRibbonSlots {
  ownerId: string;
  entryId: string;
  question?: TutorQuestion;
}
const QuestionPlayer = ({
  entryId,
  question,
  ...slots
}: Omit<Props, 'ownerId' | 'question'> & { question: TutorQuestion }) => {
  const player = useJournalPlayer((signal) => timedQuestionAudio(entryId, question.id, signal));
  return (
    <JournalTutorRibbon {...slots} player={player} label={`${question.tutor?.name}'s question`} />
  );
};
const JournalQuestionAudio = ({ ownerId, entryId, question, ...slots }: Props) => {
  if (!question?.tutor) return <JournalTutorRibbon {...slots} />;
  return (
    <JournalPlaybackBoundary>
      <QuestionPlayer
        key={`${ownerId}:${entryId}:${question.id}`}
        entryId={entryId}
        question={question}
        {...slots}
      />
    </JournalPlaybackBoundary>
  );
};
export default JournalQuestionAudio;
