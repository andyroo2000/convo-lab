import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import JournalQuestion from './JournalQuestion';
import JournalTutorPicker from './JournalTutorPicker';
import { prepareTutorQuestion, tutorAvatar } from './journalTutor';
import type { JournalAnalysis, JournalFeedback } from './types';
import type { JournalTutor, TutorQuestion } from './journalTutor';

interface Props {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
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

function useTeacherQuestion({ ownerId, entryId, analysis }: Props) {
  const replyId = analysis.currentReply?.id;
  const question = useQuery({
    queryKey: ['journal-question', ownerId, entryId, analysis.id, replyId],
    queryFn: () => prepareTutorQuestion(entryId, analysis.id, replyId),
    enabled: !analysis.pendingReplyId,
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
}: {
  tutor: JournalTutor | null | undefined;
  feedback: JournalFeedback;
  choosing: boolean;
  choose: () => void;
}) => (
  <div className="flex items-start gap-3 sm:gap-4">
    {tutor && (
      <img
        src={tutorAvatar(tutor)}
        alt={`${tutor.name}, your tutor`}
        className="h-14 w-14 shrink-0 rounded-full object-cover sm:h-16 sm:w-16"
      />
    )}
    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-sky-100 bg-sky-50/60 p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-navy">{tutor?.name ?? 'Tutor'}</span>
        <button
          type="button"
          onClick={choose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-indigo hover:bg-white"
          aria-label="Choose tutor"
          aria-expanded={choosing}
        >
          <Settings2 size={18} aria-hidden="true" />
        </button>
      </div>
      <JournalQuestion feedback={feedback} />
    </div>
  </div>
);

const JournalTeacher = ({ ownerId, entryId, analysis }: Props) => {
  const [choosing, setChoosing] = useState(false);
  const { question, feedback, tutor, unassigned } = useTeacherQuestion({
    ownerId,
    entryId,
    analysis,
  });
  if (!feedback) return null;
  return (
    <div className="space-y-3">
      {(choosing || unassigned) && (
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
        choosing={choosing}
        choose={() => setChoosing(!choosing)}
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
