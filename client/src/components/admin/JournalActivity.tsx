import { count, type AnalyticsPeriod, type JournalAnalytics } from '../../lib/journalAnalyticsApi';
import JournalSubmissionChart from './JournalSubmissionChart';

const JournalActivity = ({
  data,
  onPeriod,
}: {
  data: JournalAnalytics;
  onPeriod: (period: AnalyticsPeriod) => void;
}) => {
  const { activity, month } = data;
  const periods: AnalyticsPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];
  return (
    <>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h3>Submission trend</h3>
            <p>
              {activity.start} – {activity.end} · UTC
            </p>
          </div>
          <div className="admin-periods" aria-label="Trend interval">
            {periods.map((p) => (
              <button
                type="button"
                key={p}
                aria-pressed={p === activity.period}
                onClick={() => onPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-trend-totals">
          <span>
            <b>{count(activity.summary.originals)}</b> original submissions
          </span>
          <span>
            <b>{count(activity.summary.followups)}</b> follow-up responses
          </span>
          <span>
            <b>{count(activity.summary.activeUsers)}</b> active users
          </span>
        </div>
        <JournalSubmissionChart buckets={activity.buckets} />
      </section>
      <div className="admin-two-columns">
        <section className="admin-panel">
          <h3>Writing calendar</h3>
          <p>This month · submissions each day</p>
          <div className="admin-calendar">
            {month.calendar.map((day) => (
              <div
                key={day.date}
                className={day.originals + day.followups > 0 ? 'has-writing' : ''}
                title={`${day.date}: ${day.originals} entries, ${day.followups} follow-ups, ${day.activeUsers} users`}
              >
                <small>{Number(day.date.slice(-2))}</small>
                <b>{day.originals + day.followups}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-panel">
          <h3>How much people write</h3>
          <p>For the selected trend range</p>
          <dl className="admin-writing-stats">
            <div>
              <dt>Average original entry</dt>
              <dd>
                {count(activity.summary.averageEntryCharacters)} <small>characters</small>
              </dd>
            </div>
            <div>
              <dt>Average follow-up response</dt>
              <dd>
                {count(activity.summary.averageFollowupCharacters)} <small>characters</small>
              </dd>
            </div>
            <div>
              <dt>Average follow-ups per entry</dt>
              <dd>{count(activity.summary.averageFollowupsPerEntry)}</dd>
            </div>
          </dl>
          <p className="admin-small">
            Follow-ups per entry uses originals first submitted in this range and their follow-ups
            through today. Autosaves and clarification answers are excluded.
          </p>
        </section>
      </div>
    </>
  );
};

export default JournalActivity;
