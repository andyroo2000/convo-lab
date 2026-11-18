import { money, type JournalAnalytics } from '../../lib/journalAnalyticsApi';
import JournalWriterTable from './JournalWriterTable';

const JournalCostView = ({
  data,
  onPage,
}: {
  data: JournalAnalytics;
  onPage: (page: number) => void;
}) => {
  const total = data.month.inferenceUsd + data.month.ttsUsd;
  const inferenceShare = total === 0 ? 0 : (data.month.inferenceUsd / total) * 100;
  return (
    <>
      <section className="admin-panel">
        <h3>Where this month’s costs go</h3>
        <div className="admin-metrics">
          <div>
            <span>Estimated total so far</span>
            <strong>{money(total)}</strong>
          </div>
          <div>
            <span>Inference</span>
            <strong>{money(data.month.inferenceUsd)}</strong>
          </div>
          <div>
            <span>TTS</span>
            <strong>{money(data.month.ttsUsd)}</strong>
          </div>
        </div>
        <div className="admin-cost-bar" aria-hidden="true">
          <span style={{ width: `${inferenceShare}%` }} />
        </div>
        <p className="admin-small">
          Recorded costs for all non-admin writers, including audio-only usage. Open each writer’s
          total below to see operations and models.
        </p>
      </section>
      <JournalWriterTable writers={data.writers} onPage={onPage} />
    </>
  );
};

export default JournalCostView;
