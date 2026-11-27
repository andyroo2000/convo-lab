import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LearnLesson, LearnSession } from './types';

function nextLabel(session: LearnSession, lesson: LearnLesson) {
  const { phase, index } = session.state;
  if (phase === 'ready') return 'I’m ready for the workbook';
  if (phase === 'check') return 'I understand';
  if (phase === 'exercise' && index + 1 === lesson.exerciseCount)
    return 'I understand · Finish this set';
  return 'I understand · Next question';
}

export const LearnNext = ({
  session,
  lesson,
  busy,
  onNext,
  onReview,
  onPrevious,
}: {
  session: LearnSession;
  lesson: LearnLesson;
  busy: boolean;
  onNext: () => void;
  onReview?: () => void;
  onPrevious?: () => void;
}) => {
  const { phase, answered } = session.state;
  if (phase === 'complete')
    return (
      <div className="learn-inline-actions">
        {onReview && (
          <button type="button" className="learn-button" disabled={busy} onClick={onReview}>
            Review explanations
          </button>
        )}
        <Link className="learn-button secondary" to="/app/learn">
          Return to Chapter 1
        </Link>
      </div>
    );
  if (!answered && phase === 'exercise') return null;
  return (
    <div className="learn-inline-actions">
      {phase === 'check' && session.state.index > 0 && onPrevious && (
        <button
          type="button"
          className="learn-button secondary"
          disabled={busy}
          onClick={onPrevious}
        >
          Previous explanation
        </button>
      )}
      <button type="button" className="learn-button" disabled={busy} onClick={onNext}>
        {nextLabel(session, lesson)}
      </button>
    </div>
  );
};

export const LearnSessionFeedback = ({
  busy,
  error,
  savingProgress = false,
  onReload,
}: {
  busy: boolean;
  error: Error | null;
  savingProgress?: boolean;
  onReload: () => void;
}) => (
  <>
    {error && (
      <div className="learn-error" role="alert">
        <p>{error.message}</p>
        <p>
          Your draft is still here. You can retry, or reload the lesson to check your saved
          progress.
        </p>
        <button type="button" className="learn-button secondary" onClick={onReload}>
          Reload lesson
        </button>
      </div>
    )}
    {busy && (
      <p className="learn-status" role="status">
        {savingProgress
          ? 'Saving progress…'
          : 'Your tutor is reading your message. This may take a moment.'}
      </p>
    )}
  </>
);

export const LearnRestart = ({
  busy,
  onRestart,
}: {
  busy: boolean;
  onRestart: () => Promise<unknown>;
}) => {
  const [confirm, setConfirm] = useState(false);
  const restart = async () => {
    try {
      await onRestart();
      setConfirm(false);
    } catch {
      /* The lesson displays the error. */
    }
  };
  return (
    <div className="learn-session-actions">
      {!confirm ? (
        <button
          type="button"
          className="learn-text-button"
          disabled={busy}
          onClick={() => setConfirm(true)}
        >
          Start this lesson over
        </button>
      ) : (
        <div className="learn-paper">
          <p>Start over? This clears the saved answers and feedback for this lesson.</p>
          <div className="learn-inline-actions">
            <button
              type="button"
              className="learn-button secondary"
              onClick={() => setConfirm(false)}
            >
              Keep my progress
            </button>
            <button type="button" className="learn-button" disabled={busy} onClick={restart}>
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
