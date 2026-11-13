import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { retrySavedQuestion } from './journalConversationApi';
import JournalAvatar from './JournalAvatar';
import JournalQuestion from './JournalQuestion';
import JournalQuestionAudio from './JournalQuestionAudio';
import JournalTutorPicker from './JournalTutorPicker';
import { prepareTutorQuestion, tutorAvatar } from './journalTutor';
import type { JournalAnalysis, JournalFeedback } from './types';
import type { JournalTutor, TutorQuestion } from './journalTutor';

interface Props {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
  savedQuestion?: TutorQuestion;
}
function displayedFeedback(source: JournalFeedback | null, saved?: TutorQuestion) {
  if (!source || !saved) return source;
  return {
    ...source,
    question: saved.text,
    questionReading: saved.reading,
    questionTranslation: saved.translation,
  };
}

function useTeacherQuestion({ ownerId, entryId, analysis, savedQuestion }: Props) {
  const replyId = analysis.currentReply?.id;
  const question = useQuery({
    queryKey: savedQuestion
      ? ['journal-saved-question', ownerId, savedQuestion.id]
      : ['journal-question', ownerId, entryId, analysis.id, replyId],
    queryFn: () =>
      savedQuestion
        ? retrySavedQuestion(entryId, savedQuestion.id)
        : prepareTutorQuestion(entryId, analysis.id, replyId),
    initialData: savedQuestion ? { data: savedQuestion } : undefined,
    enabled: !savedQuestion && !analysis.pendingReplyId,
    retry: false,
    staleTime: Infinity,
  });
  const feedback = displayedFeedback(
    analysis.currentReply?.result ?? analysis.result,
    question.data?.data
  );
  const tutor = question.data?.data.tutor;
  return { question, feedback, tutor, unassigned: tutor === null };
}

const TeacherBubble = ({
  tutor,
  feedback,
  choosing,
  choose,
  audio,
}: {
  tutor: JournalTutor | null | undefined;
  feedback: JournalFeedback;
  choosing: boolean;
  choose: () => void;
  audio: ReactNode;
}) => (
  <div className="flex items-start gap-3 sm:gap-4">
    {tutor && (
      <JournalAvatar
        src={tutorAvatar(tutor)}
        alt={`${tutor.name}, your tutor`}
        className="h-14 w-14 shrink-0 rounded-full object-cover sm:h-16 sm:w-16"
      />
    )}
    <div className="relative min-w-0 flex-1 rounded-2xl bg-[#edf5ff] px-4 py-3 before:absolute before:-left-2 before:top-6 before:h-4 before:w-4 before:rotate-45 before:bg-[#edf5ff] sm:px-5 sm:py-3">
      <JournalQuestion
        feedback={feedback}
        controls={
          <button
            type="button"
            onClick={choose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-indigo hover:bg-white"
            aria-label="Choose tutor"
            aria-expanded={choosing}
          >
            <Settings2 size={18} aria-hidden="true" />
          </button>
        }
      />
      {audio}
    </div>
  </div>
);

const JournalTeacher = ({ ownerId, entryId, analysis, savedQuestion }: Props) => {
  const [choosing, setChoosing] = useState(false);
  const { question, feedback, tutor, unassigned } = useTeacherQuestion({
    ownerId,
    entryId,
    analysis,
    savedQuestion,
  });
  const pickerOpen = choosing || unassigned;
  if (!feedback) return null;
  return (
    <div className="space-y-3">
      {pickerOpen && (
        <JournalTutorPicker
          ownerId={ownerId}
          onClose={unassigned ? undefined : () => setChoosing(false)}
          onSelected={() => {
            setChoosing(false);
            question.refetch().catch(() => undefined);
          }}
        />
      )}
      <TeacherBubble
        tutor={tutor}
        feedback={feedback}
        choosing={pickerOpen}
        choose={() => setChoosing(!choosing)}
        audio={
          <JournalQuestionAudio
            ownerId={ownerId}
            entryId={entryId}
            question={question.data?.data}
            prepare={() => question.refetch({ throwOnError: true })}
          />
        }
      />
      {question.error && (
        <p role="alert" className="text-sm text-rose-700">
          Your tutor could not be loaded.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              question.refetch().catch(() => undefined);
            }}
          >
            Retry
          </button>
        </p>
      )}
    </div>
  );
};
export default JournalTeacher;
