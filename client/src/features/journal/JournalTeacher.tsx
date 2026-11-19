import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { retrySavedQuestion } from './journalConversationApi';
import JournalAvatar from './JournalAvatar';
import JournalQuestion from './JournalQuestion';
import JournalEnglish from './JournalEnglish';
import JournalPlaybackProvider from './JournalPlaybackContext';
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

function questionPlaybackKey(question?: TutorQuestion) {
  return question?.id ?? 'pending';
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
  const prepared = question.data?.data;
  const feedback = displayedFeedback(analysis.currentReply?.result ?? analysis.result, prepared);
  const tutor = prepared?.tutor;
  return {
    question,
    feedback,
    tutor,
    unassigned: tutor === null,
    playbackKey: questionPlaybackKey(prepared),
  };
}

const TeacherRibbon = ({
  ownerId,
  entryId,
  question,
  tutor,
  feedback,
}: {
  ownerId: string;
  entryId: string;
  question?: TutorQuestion;
  tutor: JournalTutor | null | undefined;
  feedback: JournalFeedback;
}) => {
  const [englishVisible, setEnglishVisible] = useState(false);
  const translationId = useId();
  return (
    <JournalQuestionAudio
      ownerId={ownerId}
      entryId={entryId}
      question={question}
      portrait={
        tutor && (
          <JournalAvatar
            src={tutorAvatar(tutor)}
            alt={`${tutor.name}, your tutor`}
            className="journal-tutor-avatar"
          />
        )
      }
      controls={
        <JournalEnglish
          visible={englishVisible}
          translationId={translationId}
          onToggle={() => setEnglishVisible(!englishVisible)}
        />
      }
    >
      <JournalQuestion feedback={feedback} />
      <p
        id={translationId}
        hidden={!englishVisible}
        lang="en"
        className="journal-tutor-translation"
      >
        {feedback.questionTranslation}
      </p>
    </JournalQuestionAudio>
  );
};

const JournalTeacher = ({ ownerId, entryId, analysis, savedQuestion }: Props) => {
  const { question, feedback, tutor, unassigned, playbackKey } = useTeacherQuestion({
    ownerId,
    entryId,
    analysis,
    savedQuestion,
  });
  const pickerOpen = unassigned;
  if (!feedback) return null;
  return (
    <div className="space-y-3">
      {pickerOpen && (
        <JournalTutorPicker
          ownerId={ownerId}
          onSelected={() => {
            question.refetch().catch(() => undefined);
          }}
        />
      )}
      <JournalPlaybackProvider key={playbackKey}>
        <TeacherRibbon
          ownerId={ownerId}
          entryId={entryId}
          question={question.data?.data}
          tutor={tutor}
          feedback={feedback}
        />
      </JournalPlaybackProvider>
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
