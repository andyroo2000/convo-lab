import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JournalAudioPlayer from '../JournalAudioPlayer';
import { getJournalVoices, getJournalAudioState } from '../journalAudio';
import { timedEntryAudio } from '../journalTimedAudio';

vi.mock('../journalAudio', () => ({
  getJournalVoices: vi.fn(),
  getJournalAudioState: vi.fn(),
}));
vi.mock('../journalTimedAudio', () => ({
  timedEntryAudio: vi.fn(),
  recordingBlob: () => new Blob(['audio']),
}));
const haru = 'fishaudio:21c74cb823fa45ef996ccc91cd6038b6';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getJournalVoices).mockResolvedValue({
    data: [
      { id: haru, name: 'Haru (M)' },
      { id: 'yua', name: 'Yua (F)' },
    ],
  });
  vi.mocked(getJournalAudioState).mockResolvedValue({ data: { voiceId: haru, hasAudio: true } });
  vi.mocked(timedEntryAudio).mockResolvedValue({ data: { audioBase64: 'SUQz', sentences: [] } });
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:journal'), revokeObjectURL: vi.fn() })
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => {
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
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
  expect(timedEntryAudio).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Play corrected version' }));
  await waitFor(() =>
    expect(screen.queryByLabelText('corrected version audio')).toHaveAttribute(
      'src',
      'blob:journal'
    )
  );
  expect(timedEntryAudio).toHaveBeenCalledWith(
    'entry',
    expect.objectContaining({ analysisId: 'analysis', voiceId: haru }),
    expect.any(AbortSignal)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Narration voice' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yua (F)' }));
  expect(screen.queryByLabelText('corrected version audio')).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:journal');
});

it('keeps a failed download retryable and aborts when leaving the entry', async () => {
  vi.mocked(timedEntryAudio).mockRejectedValue(new Error('Unavailable'));
  const { unmount } = setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Play corrected version' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play corrected version' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  const [, , signal] = vi.mocked(timedEntryAudio).mock.calls[0];
  unmount();
  expect(signal).toBeInstanceOf(AbortSignal);
});

it('requires an explicit choice when the saved voice is unavailable', async () => {
  vi.mocked(getJournalVoices).mockResolvedValue({ data: [{ id: 'yua', name: 'Yua (F)' }] });
  setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Narration voice' })).toBeEnabled()
  );
  expect(screen.getByRole('button', { name: 'Play corrected version' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Narration voice' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yua (F)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Play corrected version' }));
  await waitFor(() =>
    expect(timedEntryAudio).toHaveBeenCalledWith(
      'entry',
      expect.objectContaining({ voiceId: 'yua' }),
      expect.any(AbortSignal)
    )
  );
});

it('waits for the entry voice before enabling playback, even when the catalog is loaded', async () => {
  let finish: (value: { data: { voiceId: string; hasAudio: boolean } }) => void = () => undefined;
  vi.mocked(getJournalAudioState).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  setup();
  expect(screen.getByRole('button', { name: 'Narration voice' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Play corrected version' })).toBeDisabled();
  finish({ data: { voiceId: 'yua', hasAudio: true } });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Narration voice' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Narration voice' }));
  expect(screen.getByRole('button', { name: 'Yua (F)' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Play corrected version' }));
  await waitFor(() =>
    expect(timedEntryAudio).toHaveBeenCalledWith(
      'entry',
      expect.objectContaining({ voiceId: 'yua' }),
      expect.any(AbortSignal)
    )
  );
});

it('does not guess a voice when preferences fail and supports retry', async () => {
  vi.mocked(getJournalAudioState).mockRejectedValueOnce(new Error('Offline'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your saved voice');
  expect(screen.getByRole('button', { name: 'Play corrected version' })).toBeDisabled();
  expect(timedEntryAudio).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Play corrected version' })).toBeEnabled()
  );
});

it('uses the server default for an entry without generated audio', async () => {
  vi.mocked(getJournalAudioState).mockResolvedValue({ data: { voiceId: 'yua', hasAudio: false } });
  setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Narration voice' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Narration voice' }));
  expect(screen.getByRole('button', { name: 'Yua (F)' })).toHaveAttribute('aria-pressed', 'true');
  expect(timedEntryAudio).not.toHaveBeenCalled();
});

it('keeps loaded audio usable after playback, tab focus, and reconnect', async () => {
  vi.mocked(getJournalAudioState)
    .mockResolvedValueOnce({ data: { voiceId: haru, hasAudio: false } })
    .mockRejectedValue(new Error('Offline'));
  setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Play corrected version' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play corrected version' }));
  await screen.findByLabelText('corrected version audio');
  await act(async () => {
    focusManager.setFocused(false);
    onlineManager.setOnline(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
  });
  expect(screen.getByRole('button', { name: 'Narration voice' })).toBeEnabled();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText('Loading saved voice…')).toBeNull();
  expect(getJournalAudioState).toHaveBeenCalledTimes(1);
  expect(getJournalVoices).toHaveBeenCalledTimes(1);
});

it('shows the avatar picker and cancels without changing the saved voice', async () => {
  setup();
  const trigger = screen.getByRole('button', { name: 'Narration voice' });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Haru (M)' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('region', { name: 'Choose your narration voice' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Play corrected version' }));
  await waitFor(() =>
    expect(timedEntryAudio).toHaveBeenCalledWith(
      'entry',
      expect.objectContaining({ voiceId: haru }),
      expect.any(AbortSignal)
    )
  );
});
