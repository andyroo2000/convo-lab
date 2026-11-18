import { useState } from 'react';
import type { WritingBucket } from '../../lib/journalAnalyticsApi';

const WIDTH = 900;
const HEIGHT = 210;
const x = (index: number, size: number) => 42 + (index * (WIDTH - 64)) / Math.max(1, size - 1);
const y = (value: number, max: number) => HEIGHT - 30 - (value / max) * (HEIGHT - 50);
const JournalSubmissionChart = ({ buckets }: { buckets: WritingBucket[] }) => {
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...buckets.flatMap((b) => [b.originals, b.followups]));
  const path = (key: 'originals' | 'followups') =>
    buckets.map((b, i) => `${x(i, buckets.length)},${y(b[key], max)}`).join(' ');
  return (
    <>
      <div className="admin-chart-legend">
        <span>● Original submissions</span>
        <span>● Follow-up responses submitted</span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="admin-line-chart"
        role="img"
        aria-label="Submission trend: original submissions and follow-up responses submitted. Exact values are available in the data table."
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1="42" x2="878" y1={y(max * f, max)} y2={y(max * f, max)} stroke="#e1e5dc" />
            <text x="30" y={y(max * f, max) + 4} textAnchor="end">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        <polyline points={path('originals')} fill="none" stroke="#3e7952" strokeWidth="3" />
        <polyline points={path('followups')} fill="none" stroke="#648ed7" strokeWidth="3" />
        {buckets.map((b, i) => (
          <g key={b.date}>
            <circle cx={x(i, buckets.length)} cy={y(b.originals, max)} r="3" fill="#3e7952">
              <title>
                {b.date}: {b.originals} original submissions
              </title>
            </circle>
            <circle cx={x(i, buckets.length)} cy={y(b.followups, max)} r="3" fill="#648ed7">
              <title>
                {b.date}: {b.followups} follow-ups
              </title>
            </circle>
          </g>
        ))}
        <text x="42" y="207">
          {buckets[0]?.date}
        </text>
        <text x="878" y="207" textAnchor="end">
          {buckets.at(-1)?.date}
        </text>
      </svg>
      <button
        type="button"
        className="admin-text-button"
        onClick={() => setShowTable(!showTable)}
        aria-expanded={showTable}
      >
        {showTable ? 'Hide' : 'Show'} chart data
      </button>
      {showTable && (
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Period starting</th>
                <th>Original submissions</th>
                <th>Follow-ups</th>
                <th>Active users</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.date}>
                  <th>{b.date}</th>
                  <td>{b.originals}</td>
                  <td>{b.followups}</td>
                  <td>{b.activeUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default JournalSubmissionChart;
