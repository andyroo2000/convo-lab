import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import JournalArchive from '../JournalArchive';
import { listJournalEntries } from '../journalApi';
import useJournalArchive from '../useJournalArchive';

vi.mock('../journalApi', () => ({ listJournalEntries: vi.fn() }));

const Contents = () => {
  const archive = useJournalArchive('offline-reader');
  return (
    <JournalArchive archive={archive} onCreate={vi.fn()} onDeleted={vi.fn()} onRenamed={vi.fn()} />
  );
};

it('tries the archive while offline and only claims it is empty after a successful retry', async () => {
  vi.mocked(listJournalEntries)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({ data: [], nextCursor: null });
  const client = new QueryClient();
  onlineManager.setOnline(false);
  try {
    render(
      <QueryClientProvider client={client}>
        <Contents />
      </QueryClientProvider>
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Saved entries are unavailable');
    expect(screen.queryByText('No journal entries yet.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No journal entries yet.')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  } finally {
    onlineManager.setOnline(true);
    client.clear();
  }
});
