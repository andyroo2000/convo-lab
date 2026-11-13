import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StudyActivityProvider } from '../../../contexts/StudyActivityContext';
import useJournalActivity from '../useJournalActivity';

const categories = { journal: 'writing' };

vi.mock('../../../hooks/useStudyCapabilities', () => ({
  useStudyCapabilities: () => ({
    data: { studyActivity: { categoriesByActivity: categories } },
  }),
}));
vi.mock('../../../lib/csrf', () => ({
  fetchWithCsrf: vi.fn().mockRejectedValue(new Error('offline')),
}));

const Journal = () => {
  useJournalActivity('42');
  return null;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

it('records writing while visible and excludes hidden time, retaining offline sessions', async () => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));
  const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <StudyActivityProvider userId="42">
        <Journal />
      </StudyActivityProvider>
    </QueryClientProvider>
  );
  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };
  const changeVisibility = async (state: DocumentVisibilityState) => {
    visible.mockReturnValue(state);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  };
  await advance(60_000);
  await changeVisibility('hidden');
  await advance(120_000);
  await changeVisibility('visible');
  await advance(30_000);
  view.unmount();
  const pending = JSON.parse(localStorage.getItem('convolab.studyActivity.pending.v1.42') ?? '[]');
  expect(pending).toHaveLength(2);
  expect(pending.map((session: { durationMs: number }) => session.durationMs)).toEqual([
    60_000, 30_000,
  ]);
  expect(pending[0]).toMatchObject({
    activity: 'journal',
    category: 'writing',
    source: 'automatic',
    name: 'Journal',
  });
  expect(localStorage.getItem('convolab.studyActivity.active.v1.42')).toBeNull();
  client.clear();
});
