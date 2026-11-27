import type { ReactNode } from 'react';
import JournalRuby from '../journal/JournalRuby';
import type { LearnLesson, LearnSession } from './types';
import LearnSourceAudio from './LearnSourceAudio';
import LearnTeaching from './LearnTeaching';
import LearnTutorCard from './LearnTutorCard';
import type { JournalTutor } from '../journal/journalTutor';

interface QuestionProps {
  session: LearnSession;
  lesson: LearnLesson;
  tutor?: JournalTutor;
  action?: ReactNode;
}

export const LearnReference = ({ lesson }: { lesson: LearnLesson }) => (
  <details className="learn-reference">
    <summary>Quick reference</summary>
    <p>
      <JournalRuby text={lesson.reference} />
    </p>
    <p className="learn-source">{lesson.source}</p>
  </details>
);

const ActiveQuestion = ({ session, lesson, tutor, action }: QuestionProps) => {
  const { phase, index } = session.state;
  const { prompt } = session;
  if (!prompt) return null;
  if (phase === 'check')
    return (
      <>
        <section className="learn-tutor learn-tutor-step" aria-label="Explanation">
          <LearnTeaching teaching={prompt.teaching} />
        </section>
        <LearnTutorCard tutor={tutor} action={action}>
          <p className="learn-check-question">
            <JournalRuby text={prompt.prompt} />
          </p>
        </LearnTutorCard>
      </>
    );
  return (
    <section className="learn-question" aria-labelledby="learn-question-title">
      <p className="learn-eyebrow">
        Workbook question {index + 1} of {lesson.exerciseCount}
      </p>
      <h2 id="learn-question-title">Your turn.</h2>
      {prompt.instruction && (
        <p>
          <JournalRuby text={prompt.instruction} />
        </p>
      )}
      <div className="learn-paper learn-japanese">
        <JournalRuby text={prompt.prompt} />
      </div>
      <LearnSourceAudio key={prompt.id} source={prompt.sourceAudio} />
      <p className="learn-source">{prompt.source}</p>
    </section>
  );
};

export const LearnQuestion = ({ session, lesson, tutor, action }: QuestionProps) => {
  const { phase } = session.state;
  if (phase === 'ready')
    return (
      <LearnTutorCard tutor={tutor} action={action}>
        <h2>Ready for the workbook?</h2>
        <p>
          We’ll try one question at a time when you’re ready. You can still ask me anything before
          we begin.
        </p>
      </LearnTutorCard>
    );
  if (phase === 'complete')
    return (
      <LearnTutorCard tutor={tutor} action={action}>
        <span className="learn-badge">Worked through</span>
        <h2>You’ve finished this {lesson.exerciseCount ? 'set' : 'explanation'}.</h2>
        {!lesson.exerciseCount && (
          <p>
            The workbook has no separate exercise set for this point. You’ll meet it again in the
            chapter’s mixed review.
          </p>
        )}
        <p>You can revisit your feedback, ask a final question, or return to Chapter 1.</p>
      </LearnTutorCard>
    );
  return <ActiveQuestion session={session} lesson={lesson} tutor={tutor} action={action} />;
};
