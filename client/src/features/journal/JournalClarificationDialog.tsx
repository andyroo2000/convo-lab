import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import JournalAvatar from './JournalAvatar';
import JournalThinking from './JournalThinking';
import { getTutorPreferences, tutorAvatar } from './journalTutor';
import type useJournalClarification from './useJournalClarification';
import type { ClarificationQuestion } from './journalClarification';

type Workflow = ReturnType<typeof useJournalClarification>;
const Question = ({
  question,
  workflow,
}: {
  question: ClarificationQuestion;
  workflow: Workflow;
}) => {
  const group = useId();
  const [choice, setChoice] = useState<number | 'other' | null>(null);
  const [custom, setCustom] = useState('');
  const heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const answer = choice === 'other' ? custom : (question.choices[choice ?? -1] ?? '');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        workflow.answer(answer).catch(() => undefined);
      }}
      className="space-y-4"
    >
      <fieldset disabled={workflow.busy} className="space-y-2">
        <legend className="mb-4 w-full">
          <p ref={heading} tabIndex={-1} className="text-lg font-medium text-navy outline-none">
            {question.prompt}
          </p>
        </legend>
        {question.choices.map((label, index) => (
          <label
            key={label}
            htmlFor={`${group}-${index}`}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#cddcec] bg-white p-3 text-navy"
          >
            <input
              type="radio"
              id={`${group}-${index}`}
              name={group}
              checked={choice === index}
              onChange={() => setChoice(index)}
            />
            {label}
          </label>
        ))}
        <label
          htmlFor={`${group}-other`}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#cddcec] bg-white p-3 text-navy"
        >
          <input
            type="radio"
            id={`${group}-other`}
            name={group}
            checked={choice === 'other'}
            onChange={() => setChoice('other')}
          />
          Something else
        </label>
        {choice === 'other' && (
          <textarea
            aria-label="Your answer"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full rounded-xl border border-[#cddcec] bg-white p-3 text-navy"
          />
        )}
      </fieldset>
      <button
        type="submit"
        disabled={workflow.busy || !answer.trim()}
        className="rounded-xl bg-indigo px-5 py-3 text-white disabled:opacity-40"
      >
        Answer
      </button>
    </form>
  );
};
function useClarificationTutor(ownerId: string) {
  const preferences = useQuery({
    queryKey: ['journal-tutor', ownerId],
    queryFn: getTutorPreferences,
    staleTime: Infinity,
  });
  const tutors = preferences.data?.data;
  const tutor = tutors?.tutors.find((item) => item.id === tutors.selectedId) ?? tutors?.tutors[0];
  return tutor;
}
function isThinking(workflow: Workflow, waitingForFeedback: boolean) {
  if (workflow.busy) return true;
  return !workflow.active && waitingForFeedback;
}

const ClarificationError = ({ workflow }: { workflow: Workflow }) => {
  if (!workflow.error) return null;
  return (
    <div className="space-y-3">
      <p role="alert" className="text-sm text-rose-700">
        {workflow.error}
      </p>
      <button
        type="button"
        disabled={workflow.busy}
        onClick={() => {
          workflow.retry().catch(() => undefined);
        }}
        className="rounded-xl bg-indigo px-5 py-3 text-white disabled:opacity-40"
      >
        Retry
      </button>
    </div>
  );
};

const JournalClarificationDialog = ({
  ownerId,
  workflow,
  waitingForFeedback = false,
}: {
  waitingForFeedback?: boolean;
  ownerId: string;
  workflow: Workflow;
}) => {
  const tutor = useClarificationTutor(ownerId);
  const question = workflow.state?.question;
  if (isThinking(workflow, waitingForFeedback))
    return (
      <JournalThinking
        avatar={tutor ? tutorAvatar(tutor) : undefined}
        lastAnswer={workflow.lastAnswer}
      >
        {workflow.active && (
          <button
            type="button"
            onClick={workflow.cancel}
            className="mt-6 min-h-11 text-sm text-slate-600 underline"
          >
            Back to draft
          </button>
        )}
      </JournalThinking>
    );
  return (
    <section aria-label="Clarify your meaning" lang="en" className="flex items-start gap-3">
      <JournalAvatar
        src={tutor ? tutorAvatar(tutor) : undefined}
        alt="Your tutor"
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1 space-y-4 rounded-2xl bg-[#edf5ff] p-5">
        {question && <Question key={question.id} question={question} workflow={workflow} />}
        <ClarificationError workflow={workflow} />
        <button
          type="button"
          onClick={workflow.cancel}
          className="min-h-11 text-sm text-slate-600 underline"
        >
          Back to draft
        </button>
      </div>
    </section>
  );
};
export default JournalClarificationDialog;
