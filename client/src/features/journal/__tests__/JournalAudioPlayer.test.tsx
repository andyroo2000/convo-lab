import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JournalAudioPlayer from '../JournalAudioPlayer';
import { getJournalAudio, getJournalVoices } from '../journalAudio';

vi.mock('../journalAudio', () => ({ getJournalAudio: vi.fn(), getJournalVoices: vi.fn() }));
const ren = 'fishaudio:abb4362e736f40b7b5716f4fafcafa9f';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getJournalVoices).mockResolvedValue({
    data: [
      { id: ren, name: 'Ren' },
      { id: 'yumi', name: 'Yumi' },
    ],
  });
  vi.mocked(getJournalAudio).mockResolvedValue(new Blob(['audio']));
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:journal'), revokeObjectURL: vi.fn() })
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <JournalAudioPlayer ownerId="a" entryId="entry" analysisId="analysis" />
    </QueryClientProvider>
  );
}

it('downloads corrected audio on demand and releases it when the voice changes', async () => {
  setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Play corrected version' })).toBeEnabled()
  );
  expect(getJournalAudio).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Play corrected version' }));
  await waitFor(() =>
    expect(screen.queryByLabelText('Corrected version audio')).toHaveAttribute(
      'src',
      'blob:journal'
    )
  );
  expect(getJournalAudio).toHaveBeenCalledWith(
    expect.objectContaining({ entryId: 'entry', analysisId: 'analysis', voiceId: ren })
  );
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'yumi' } });
  expect(screen.queryByLabelText('Corrected version audio')).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:journal');
});

it('keeps a failed download retryable and aborts when leaving the entry', async () => {
  vi.mocked(getJournalAudio).mockRejectedValue(new Error('Unavailable'));
  const { unmount } = setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Play corrected version' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play corrected version' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  const [{ signal }] = vi.mocked(getJournalAudio).mock.calls[0];
  unmount();
  expect(signal.aborted).toBe(true);
});
