import type { StudyCardSummary } from '@languageflow/shared/src/types';

import PitchAccentDiagram from '../japanese/PitchAccentDiagram';
import useStudyPitchAccent from '../../hooks/useStudyPitchAccent';

interface StudyPitchAccentPanelProps {
  card: StudyCardSummary;
  enabled: boolean;
}

const StudyPitchAccentPanel = ({ card, enabled }: StudyPitchAccentPanelProps) => {
  const { pitchAccent, isLoading } = useStudyPitchAccent(card, enabled);

  if (isLoading) {
    return (
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400"
        data-testid="study-pitch-accent-panel"
      >
        Loading pitch accent...
      </p>
    );
  }

  if (!pitchAccent || pitchAccent.status !== 'resolved') {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-sm text-navy" data-testid="study-pitch-accent-panel">
      <PitchAccentDiagram pitchAccent={pitchAccent} className="mx-auto h-24 w-full" />
    </div>
  );
};

export default StudyPitchAccentPanel;
