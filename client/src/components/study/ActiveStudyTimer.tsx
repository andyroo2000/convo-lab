import { Link } from 'react-router-dom';
import { Clock3, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

function activityTranslationKey(activity: string) {
  if (activity === 'card_review') return 'cardReview';
  if (activity === 'daily_audio') return 'dailyAudio';
  if (activity === 'card_creation') return 'cardCreation';
  return activity;
}

const ActiveStudyTimer = () => {
  const { t } = useTranslation(['study']);
  const { active, elapsedMs } = useStudyActivityStatus();
  const { stop } = useStudyActivityActions();
  // Card creation is timed automatically, but the editor should remain focused
  // and free of session controls while the user is composing a card.
  if (!active || active.activity === 'card_creation') return null;

  return (
    <div className="active-study-timer fixed z-50 flex items-center gap-3 px-3 py-2">
      <Link to="/app/study/time" className="flex items-center gap-2 text-navy">
        <Clock3 className="h-5 w-5" />
        <span>
          <span className="block text-xs font-bold uppercase tracking-wider">
            {active.name || t(`time.activities.${activityTranslationKey(active.activity)}`)}
          </span>
          <span className="font-mono text-base font-bold tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => stop()}
        className="grid size-9 place-items-center rounded-full bg-coral text-white"
        aria-label={t('time.timer.stopAria')}
      >
        <Square className="h-4 w-4 fill-current" />
      </button>
    </div>
  );
};

export default ActiveStudyTimer;
