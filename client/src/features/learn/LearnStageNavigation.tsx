import type { LearnAction, LearnSession } from './types';

const stages = [
  { phase: 'check', action: 'understand', label: 'Understand' },
  { phase: 'ready', action: 'ready', label: 'Ready?' },
  { phase: 'exercise', action: 'workbook', label: 'Workbook' },
  { phase: 'complete', action: 'reflect', label: 'Reflect' },
] as const;

function stageRestriction(phase: string, hasWorkbook: boolean, completed: boolean) {
  if (!hasWorkbook && ['ready', 'exercise'].includes(phase)) {
    return 'This point has no dedicated workbook set.';
  }
  if (phase === 'complete' && !completed) return 'Finish the lesson to reflect on this set.';
  return undefined;
}

const LearnStageNavigation = ({
  session,
  busy,
  onNavigate,
  hasWorkbook = true,
}: {
  session: LearnSession;
  busy: boolean;
  onNavigate: (action: LearnAction) => void;
  hasWorkbook?: boolean;
}) => {
  const completed =
    session.state.completed || session.state.phase === 'complete' || session.state.reviewing;
  return (
    <nav aria-label="Lesson stages">
      <ol className="learn-progress">
        {stages.map(({ phase, action, label }) => {
          const restriction = stageRestriction(phase, hasWorkbook, Boolean(completed));
          return (
            <li key={phase}>
              <button
                type="button"
                aria-current={session.state.phase === phase ? 'step' : undefined}
                disabled={busy || Boolean(restriction)}
                title={restriction}
                onClick={() => onNavigate(action)}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default LearnStageNavigation;
