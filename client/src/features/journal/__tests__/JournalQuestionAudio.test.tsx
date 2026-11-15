import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JournalQuestionAudio from '../JournalQuestionAudio';
import { timedQuestionAudio } from '../journalTimedAudio';
import type { TutorQuestion } from '../journalTutor';

vi.mock('../journalTimedAudio', async (original) => ({
  ...(await original<typeof import('../journalTimedAudio')>()),
  timedQuestionAudio: vi.fn(),
}));
const question: TutorQuestion = {
  id: 'q',
  text: 'どうでしたか。',
  reading: 'どうでしたか。',
  translation: 'How was it?',
  tutor: { id: 'hana', name: 'Hana', gender: 'F', avatar: 'hana-v1' },
  audio: { status: 'ready', error: null },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:question');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.mocked(timedQuestionAudio).mockResolvedValue({ data: { audioBase64: 'SUQz', sentences: [] } });
});
afterEach(() => vi.restoreAllMocks());
function mount(value = question) {
  return render(<JournalQuestionAudio ownerId="a" entryId="e" question={value} />);
}
async function start() {
  fireEvent.click(screen.getByRole('button', { name: "Listen Hana's question" }));
  return screen.findByLabelText("Hana's question audio");
}
it('requests timed audio only on demand and releases the recording on exit', async () => {
  const view = mount();
  expect(timedQuestionAudio).not.toHaveBeenCalled();
  const audio = await start();
  expect(audio).toHaveAttribute('src', 'blob:question');
  expect(timedQuestionAudio).toHaveBeenCalledWith('e', 'q', expect.any(AbortSignal));
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:question');
});
it('retries a failed timed recording without depending on legacy audio status', async () => {
  vi.mocked(timedQuestionAudio).mockRejectedValueOnce(new Error('Offline'));
  mount({ ...question, audio: { status: 'failed', error: 'Old audio failed' } });
  fireEvent.click(screen.getByRole('button', { name: "Listen Hana's question" }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  await start();
  expect(timedQuestionAudio).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});
it('pauses other journal audio when the question starts', async () => {
  const other = document.createElement('audio');
  other.dataset.journalAudio = '';
  other.pause = vi.fn();
  document.body.append(other);
  const view = mount();
  fireEvent.play(await start());
  expect(other.pause).toHaveBeenCalled();
  view.unmount();
  other.remove();
});
it('aborts pending audio when the question unmounts', async () => {
  vi.mocked(timedQuestionAudio).mockReturnValue(new Promise(() => {}));
  const view = mount();
  fireEvent.click(screen.getByRole('button', { name: "Listen Hana's question" }));
  await waitFor(() => expect(timedQuestionAudio).toHaveBeenCalledOnce());
  const [, , signal] = vi.mocked(timedQuestionAudio).mock.calls[0];
  view.unmount();
  expect(signal.aborted).toBe(true);
});
it('does not show a player before a tutor is assigned', () => {
  mount({ ...question, tutor: null });
  expect(screen.queryByRole('button')).toBeNull();
});
it('starts after the first Listen click and supports pause, resume, and replay', async () => {
  mount();
  const audio = (await start()) as HTMLAudioElement;
  Object.defineProperty(audio, 'duration', { value: 10 });
  fireEvent.loadedMetadata(audio);
  await waitFor(() => expect(audio.play).toHaveBeenCalledOnce());
  fireEvent.play(audio);
  audio.currentTime = 4;
  fireEvent.timeUpdate(audio);
  fireEvent.click(screen.getByRole('button', { name: "Pause Hana's question" }));
  expect(audio.pause).toHaveBeenCalled();
  fireEvent.pause(audio);
  fireEvent.click(screen.getByRole('button', { name: "Resume Hana's question" }));
  expect(audio.play).toHaveBeenCalledTimes(2);
  expect(audio.currentTime).toBe(4);
  fireEvent.play(audio);
  audio.currentTime = 10;
  fireEvent.timeUpdate(audio);
  fireEvent.ended(audio);
  fireEvent.click(screen.getByRole('button', { name: "Replay Hana's question" }));
  expect(audio.play).toHaveBeenCalledTimes(3);
});
it('tracks real playback in the ribbon without a separate seek bar or clock', async () => {
  mount();
  expect(screen.queryByRole('progressbar')).toBeNull();
  const audio = (await start()) as HTMLAudioElement;
  Object.defineProperty(audio, 'duration', { value: 10 });
  fireEvent.loadedMetadata(audio);
  audio.currentTime = 5;
  fireEvent.timeUpdate(audio);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  expect(screen.queryByRole('slider')).toBeNull();
  expect(screen.queryByText('0:05')).toBeNull();
});
