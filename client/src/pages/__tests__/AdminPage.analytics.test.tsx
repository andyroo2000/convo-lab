import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, resetAdminPageMocks } from './AdminPageTestHarness';
import type { JournalAnalytics } from '../../lib/journalAnalyticsApi';

const counts = {
  originals: 3,
  followups: 5,
  activeUsers: 2,
  averageEntryCharacters: 180,
  averageFollowupCharacters: 45,
};
const fixture: JournalAnalytics = {
  activity: {
    period: 'daily',
    start: '2026-10-21',
    end: '2026-11-17',
    buckets: [{ date: '2026-11-17', ...counts }],
    summary: { ...counts, averageFollowupsPerEntry: 1.7 },
  },
  month: {
    start: '2026-11-01',
    asOf: '2026-11-18',
    elapsedDays: 17,
    daysInMonth: 30,
    activeUsers: 2,
    averageCostPerActiveUserUsd: 1.5,
    projectedMonthlyCostPerActiveUserUsd: 2.65,
    inferenceUsd: 1,
    ttsUsd: 2,
    unknownRequests: 1,
    calendar: [{ date: '2026-11-17', ...counts }],
    trackingSince: '2026-11-01',
  },
  writers: {
    data: [
      {
        id: 'writer',
        name: 'Mika',
        avatarUrl: null,
        entries: 3,
        followups: 5,
        inferenceUsd: 1,
        ttsUsd: 2,
        estimatedCostUsd: 3,
        unknownRequests: 0,
        dailyAverageUsd: 0.18,
        projectedMonthlyUsd: 5.29,
        breakdown: [],
      },
    ],
    page: 1,
    perPage: 25,
    total: 1,
  },
};
describe('Journal analytics', () => {
  beforeEach(() => {
    resetAdminPageMocks();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => fixture } as Response);
  });
  it('shows journal metrics and warns about incomplete cost data', async () => {
    renderPage('analytics');
    expect(await screen.findByText('$2.65')).toBeInTheDocument();
    expect(screen.getByText('Writing calendar')).toBeInTheDocument();
    expect(screen.getByText('Average follow-ups per entry')).toBeInTheDocument();
    expect(screen.getByText(/1 requests have no price/)).toBeInTheDocument();
    expect(screen.queryByText('Courses')).not.toBeInTheDocument();
    expect(screen.queryByText('Total submitted text')).not.toBeInTheDocument();
  });
  it('opens writer costs and switches between the approved views', async () => {
    const user = userEvent.setup();
    renderPage('analytics');
    await user.click(await screen.findByRole('button', { name: 'Writers' }));
    expect(screen.getByText('Mika')).toBeInTheDocument();
    expect(screen.getByText('$0.18')).toBeInTheDocument();
    await user.click(screen.getByText('$3.00'));
    expect(screen.getByText('$5.29')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Costs' }));
    expect(screen.getByText('Where this month’s costs go')).toBeInTheDocument();
  });
  it('requests the selected trend interval', async () => {
    const user = userEvent.setup();
    renderPage('analytics');
    await user.click(await screen.findByRole('button', { name: 'weekly' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('period=weekly'),
        expect.anything()
      )
    );
  });
  it('aborts the analytics request on unmount', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_url, init) => {
      signal = init?.signal ?? undefined;
      return new Promise(() => {});
    });
    const view = renderPage('analytics');
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
