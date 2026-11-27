import { useEffect, useRef, type ReactNode } from 'react';
import JournalHighlight from '../journal/JournalHighlight';
import JournalRuby from '../journal/JournalRuby';
import type { LearnTurn } from './types';
import LearnTeaching from './LearnTeaching';
import LearnTutorCard from './LearnTutorCard';
import type { JournalTutor } from '../journal/journalTutor';

const replyLabels = { answer: 'Your answer', clarify: 'Your question', acknowledge: 'Your reply' };

function anchoredSegments(turn: LearnTurn) {
  let offset = 0;
  return turn.segments.map((segment) => {
    const key = `${turn.id}:${offset}`;
    offset += segment.text.length;
    return { key, segment };
  });
}

const EarlierPrompt = ({ turn }: { turn: LearnTurn }) => {
  if (!turn.prompt) return null;
  return (
    <div className="learn-history-prompt">
      {turn.stepKey.startsWith('exercise:') && <p className="learn-source">{turn.prompt.source}</p>}
      <LearnTeaching teaching={turn.prompt.teaching} />
      <p>
        <JournalRuby text={turn.prompt.prompt} />
      </p>
    </div>
  );
};

export const LearnExchange = ({
  turn,
  showPrompt = false,
  tutor,
  action,
}: {
  turn: LearnTurn;
  showPrompt?: boolean;
  tutor?: JournalTutor;
  action?: ReactNode;
}) => (
  <article className="learn-exchange" tabIndex={-1}>
    {showPrompt && <EarlierPrompt turn={turn} />}
    <p className="learn-eyebrow">{replyLabels[turn.kind]}</p>
    <div
      className="learn-answer"
      aria-label={turn.kind === 'answer' ? 'Your annotated answer' : replyLabels[turn.kind]}
    >
      {turn.kind === 'answer' && turn.segments.length
        ? anchoredSegments(turn).map(({ key, segment }) => (
            <JournalHighlight key={key} segment={segment} />
          ))
        : turn.text}
    </div>
    {turn.segments.some((segment) => segment.kind !== 'plain' && segment.kind !== 'keep') && (
      <p className="learn-source">Tap a highlight to explore the edit.</p>
    )}
    <LearnTutorCard tutor={tutor} action={action}>
      <div className="learn-tutor-message">
        <JournalRuby text={turn.message} />
      </div>
    </LearnTutorCard>
  </article>
);

const LearnTranscript = ({
  turns,
  stepKey,
  tutor,
  action,
}: {
  turns: LearnTurn[];
  stepKey: string;
  tutor?: JournalTutor;
  action?: ReactNode;
}) => {
  const current = turns.filter((turn) => turn.stepKey === stepKey);
  const previous = turns.filter((turn) => turn.stepKey !== stepKey);
  const transcript = useRef<HTMLDivElement>(null);
  const latest = current.at(-1)?.id;
  useEffect(() => {
    if (!latest) return;
    const reply = transcript.current?.lastElementChild as HTMLElement | null;
    reply?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    reply?.focus({ preventScroll: true });
  }, [latest]);
  return (
    <>
      {previous.length > 0 && (
        <details className="learn-history">
          <summary>Earlier questions and feedback</summary>
          {previous.map((turn) => (
            <LearnExchange key={turn.id} turn={turn} showPrompt tutor={tutor} />
          ))}
        </details>
      )}
      <div className="learn-transcript" ref={transcript}>
        {current.map((turn) => (
          <LearnExchange
            key={turn.id}
            turn={turn}
            tutor={tutor}
            action={turn.id === latest ? action : undefined}
          />
        ))}
      </div>
    </>
  );
};

export default LearnTranscript;
