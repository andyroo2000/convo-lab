import { Link } from 'react-router-dom';
import { Clock3, Square } from 'lucide-react';

import {
  useStudyActivityActions,
  useStudyActivityStatus,
} from '../../contexts/StudyActivityContext';

function formatElapsed(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
    : `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

const ActiveStudyTimer = () => {
  const { active, elapsedMs } = useStudyActivityStatus();
  const { stop } = useStudyActivityActions();
  if (!active) return null;

  return (
    <div className="fixed right-4 top-20 z-50 flex items-center gap-3 border-2 border-navy bg-cream px-4 py-3 shadow-[4px_4px_0_#173b65]">
      <Link to="/app/study/time" className="flex items-center gap-2 text-navy">
        <Clock3 className="h-5 w-5" />
        <span>
          <span className="block text-xs font-bold uppercase tracking-wider">
            {active.name || active.activity.replace(/_/g, ' ')}
          </span>
          <span className="font-mono text-lg font-black tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => stop()}
        className="rounded-full bg-coral p-2 text-white"
        aria-label="Stop study timer"
      >
        <Square className="h-4 w-4 fill-current" />
      </button>
    </div>
  );
};

export default ActiveStudyTimer;
