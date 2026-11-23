import { useTranslation } from 'react-i18next';

function generationLabel(percent?: number | null) {
  if (percent === 0) return 'queued';
  if (percent == null || percent < 10) return 'preparing';
  return percent < 95 ? 'recording' : 'finishing';
}
const DrillGenerationProgress = ({ percent }: { percent?: number | null }) => {
  const { t } = useTranslation('study', { keyPrefix: 'drillPlayer' });
  const label = t(generationLabel(percent));
  return (
    <div className="drill-generation">
      <div>
        <span role="status">{label}</span>
        <span aria-hidden="true">{percent != null && `${percent}%`}</span>
      </div>
      <progress aria-label={label} max={100} value={percent ?? undefined} />
    </div>
  );
};
export default DrillGenerationProgress;
