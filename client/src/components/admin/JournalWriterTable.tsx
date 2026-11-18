import { money, type JournalAnalytics, type WriterCost } from '../../lib/journalAnalyticsApi';
import JournalAvatar from '../../features/journal/JournalAvatar';

const WriterDetails = ({ writer }: { writer: WriterCost }) => (
  <details className="admin-writer-detail">
    <summary>
      {money(writer.estimatedCostUsd)} {writer.unknownRequests > 0 && <small>+ unpriced</small>}
    </summary>
    <div>
      <p>
        Month projection: <b>{money(writer.projectedMonthlyUsd)}</b>
      </p>
      <p>
        Inference {money(writer.inferenceUsd)} · TTS {money(writer.ttsUsd)}
      </p>
      {writer.breakdown.map((row) => (
        <p key={`${row.provider}:${row.model}:${row.operation}`}>
          <b>{row.operation.replace('journal.', '')}</b> · {row.model}
          <br />
          {row.requests} requests · {money(row.estimatedUsd)}
          {row.unknownRequests > 0 && ` · ${row.unknownRequests} unpriced`}
        </p>
      ))}
    </div>
  </details>
);
const JournalWriterTable = ({
  writers,
  onPage,
}: {
  writers: JournalAnalytics['writers'];
  onPage: (page: number) => void;
}) => (
  <section className="admin-panel">
    <h3>Writer breakdown</h3>
    <p>This month · highest estimated cost first · open a cost for its breakdown</p>
    <div className="admin-table-scroll">
      <table>
        <thead>
          <tr>
            <th>Writer</th>
            <th>Entries</th>
            <th>Follow-ups</th>
            <th>Est. total so far</th>
            <th>Daily average</th>
          </tr>
        </thead>
        <tbody>
          {writers.data.map((writer) => (
            <tr key={writer.id}>
              <th>
                <div className="admin-writer-name">
                  <JournalAvatar
                    src={writer.avatarUrl ?? undefined}
                    className="admin-user-avatar"
                  />
                  {writer.name}
                </div>
              </th>
              <td>{writer.entries}</td>
              <td>{writer.followups}</td>
              <td>
                <WriterDetails writer={writer} />
              </td>
              <td>{money(writer.dailyAverageUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {writers.total === 0 && (
      <p className="admin-empty">No submissions or recorded costs this month.</p>
    )}
    <div className="admin-pagination">
      <span>{writers.total} writers</span>
      <button type="button" disabled={writers.page <= 1} onClick={() => onPage(writers.page - 1)}>
        Previous
      </button>
      <span>Page {writers.page}</span>
      <button
        type="button"
        disabled={writers.page * writers.perPage >= writers.total}
        onClick={() => onPage(writers.page + 1)}
      >
        Next
      </button>
    </div>
  </section>
);

export default JournalWriterTable;
