import { money, type JournalAnalytics } from '../../lib/journalAnalyticsApi';

const JournalCostSummary = ({ month }: { month: JournalAnalytics['month'] }) => (
    <section className="admin-cost-summary" aria-labelledby="month-cost-heading">
      <h3 id="month-cost-heading">This month’s cost outlook</h3>
      <div className="admin-metrics">
        <div>
          <span>Projected monthly cost / active user</span>
          <strong>{money(month.projectedMonthlyCostPerActiveUserUsd)}</strong>
        </div>
        <div>
          <span>Average cost / active user so far</span>
          <strong>{money(month.averageCostPerActiveUserUsd)}</strong>
        </div>
        <div>
          <span>Active users this month</span>
          <strong>{month.activeUsers}</strong>
        </div>
      </div>
      <details>
        <summary>How these estimates work</summary>
        <p>
          Active users submitted an original entry or follow-up this month. Their recorded costs are
          divided by active users, then projected from elapsed calendar time to the full month.
          Daily averages include days without writing. All dates use UTC; admin accounts are
          excluded.
        </p>
        <p>
          Inference and TTS estimates use recorded provider usage, including retries. Earlier
          untracked requests are not included.{' '}
          {month.trackingSince
            ? `The first tracked Journal request was ${month.trackingSince.slice(0, 10)}.`
            : 'No Journal costs have been tracked yet.'}
        </p>
      </details>
      {month.unknownRequests > 0 && (
        <p className="admin-cost-warning">
          {month.unknownRequests} requests have no price recorded. Totals and projections are
          incomplete.
        </p>
      )}
    </section>
  );

export default JournalCostSummary;
