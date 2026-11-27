import { useState } from 'react';
import { Link } from 'react-router-dom';
import learnStepKey from './learnStepKey';
import LearnStageNavigation from './LearnStageNavigation';
import { clearLessonDrafts } from './useLearnDraft';
import useLearnSession from './useLearnSession';
import useLearnStepFocus from './useLearnStepFocus';
import useLearnTutor from './useLearnTutor';
import LearnComposer from './LearnComposer';
import LearnLessonConversation from './LearnLessonConversation';
import { LearnSessionFeedback, LearnRestart } from './LearnSessionControls';
import { LearnReference } from './LearnLessonContent';
import type { LearnAction, LearnLesson } from './types';

const LearnLessonWorkspace = ({ ownerId, lesson }: { ownerId: string; lesson: LearnLesson }) => {
  const [draftGeneration, setDraftGeneration] = useState(0);
  const query = useLearnSession(ownerId, lesson.id);
  const tutor = useLearnTutor(ownerId);
  const session = query.data;
  useLearnStepFocus(session);
  if (!session)
    return (
      <div className="learn-paper" role="status">
        {query.isError ? (
          <>
            <p>The lesson could not load.</p>
            <button type="button" className="learn-button" onClick={() => query.refetch()}>
              Try again
            </button>
          </>
        ) : (
          'Opening your lesson…'
        )}
      </div>
    );
  const stepKey = learnStepKey(session.state);
  const send = async (action: LearnAction, text?: string) => {
    await query.send({ action, text });
    if (action === 'restart') {
      clearLessonDrafts(`learn-draft:${ownerId}:${session.id}:`);
      setDraftGeneration((generation) => generation + 1);
    }
  };
  const advance = (action: LearnAction) => {
    send(action).catch(() => {});
  };
  return (
    <section aria-labelledby="learn-lesson-title">
      <div className="learn-breadcrumb">
        <Link to="/app/learn">Chapter 1</Link>
        <span>{lesson.title}</span>
        <span className="learn-source">
          {query.savingProgress ? 'Saving progress…' : 'Progress saved'}
        </span>
      </div>
      <div className="learn-workspace">
        <aside className="learn-sidebar">
          <p className="learn-eyebrow">Your lesson</p>
          <LearnStageNavigation
            session={session}
            busy={query.busy}
            onNavigate={advance}
            hasWorkbook={lesson.exerciseCount > 0}
          />
          <LearnReference lesson={lesson} />
          <Link to="/app/learn">Back to chapter</Link>
        </aside>
        <div className="learn-lesson-main">
          <details className="learn-mobile-contents">
            <summary>Lesson contents · {lesson.title}</summary>
            <LearnStageNavigation
              session={session}
              busy={query.busy}
              onNavigate={advance}
              hasWorkbook={lesson.exerciseCount > 0}
            />
            <LearnReference lesson={lesson} />
            <Link to="/app/learn">Back to chapter</Link>
          </details>
          <h1 id="learn-lesson-title" lang="ja">
            {lesson.title}
          </h1>
          <p className="learn-lead">{lesson.subtitle}</p>
          <LearnLessonConversation
            session={session}
            lesson={lesson}
            tutor={tutor}
            busy={query.busy}
            onNext={() => advance('next')}
            onReview={() => advance('review')}
            onPrevious={() => advance('previous')}
          />
          <LearnSessionFeedback
            busy={query.busy}
            error={query.sendError}
            savingProgress={query.savingProgress}
            onReload={() => query.refetch()}
          />
          <LearnComposer
            key={`${stepKey}:${draftGeneration}`}
            storageKey={`learn-draft:${ownerId}:${session.id}:${stepKey}`}
            busy={query.busy}
            busyLabel={query.savingProgress ? 'Saving progress…' : undefined}
            onSend={send}
          />
          <LearnRestart busy={query.busy} onRestart={() => send('restart')} />
        </div>
      </div>
    </section>
  );
};

export default LearnLessonWorkspace;
