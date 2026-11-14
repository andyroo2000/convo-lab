import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JournalPlaybackProvider from '../JournalPlaybackContext';
import JournalMinimalPlayer from '../JournalMinimalPlayer';
import JournalSentenceText from '../JournalSentenceText';
import sentenceReadings from '../journalSentenceReadings';
import { adjacentSentence, sentenceAt } from '../journalTimedAudio';
import type { RecordingLoader } from '../useTimedRecording';

vi.mock('../JournalRuby', () => ({ default: ({ text }: { text: string }) => <span>{text}</span> }));
const sentences = [
  { text: '映画を見た。', start: 0, end: 2 },
  { text: '楽しかった。', start: 2, end: 4 },
];
const recording = { data: { audioBase64: 'SUQz', sentences } };
const load = vi.fn<RecordingLoader>();
beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue(recording);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:timed');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());
function mount() {
  return render(
    <JournalPlaybackProvider>
      <JournalMinimalPlayer load={load} label="journal" />
      <p>
        <JournalSentenceText text="映画[えいが]を見[み]た。楽[たの]しかった。" />
      </p>
      <input aria-label="Edit journal" />
    </JournalPlaybackProvider>
  );
}
async function start() {
  fireEvent.click(screen.getByRole('button', { name: 'Play journal' }));
  const audio = await screen.findByLabelText<HTMLAudioElement>('journal audio');
  Object.defineProperty(audio, 'duration', { value: 4, configurable: true });
  fireEvent.loadedMetadata(audio);
  fireEvent.play(audio);
  return audio;
}
it('highlights actual playback boundaries and seeks from ruby sentences without restarting playback', async () => {
  mount();
  const audio = await start();
  const second = screen.getByRole('button', { name: 'Seek to sentence 2' });
  audio.currentTime = 2.1;
  fireEvent.timeUpdate(audio);
  expect(second).toHaveAttribute('aria-current', 'true');
  expect(second).toHaveTextContent('楽[たの]しかった。');
  fireEvent.click(screen.getByRole('button', { name: 'Seek to sentence 1' }));
  expect(audio.currentTime).toBe(0);
  expect(screen.getByRole('button', { name: 'Pause journal' })).toBeEnabled();
  fireEvent.pause(audio);
  const calls = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
  fireEvent.click(second);
  expect(audio.currentTime).toBe(2);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(calls);
  expect(screen.getByRole('button', { name: 'Play journal' })).toBeEnabled();
});
it('moves one sentence per arrow and leaves text editing alone', async () => {
  mount();
  const audio = await start();
  const slider = screen.getByRole('slider');
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  expect(audio.currentTime).toBe(2);
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  expect(audio.currentTime).toBe(2);
  fireEvent.keyDown(screen.getByLabelText('Edit journal'), { key: 'ArrowLeft' });
  expect(audio.currentTime).toBe(2);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Seek to sentence 2' }), {
    key: 'ArrowLeft',
  });
  expect(audio.currentTime).toBe(0);
});
it('discards an older pending recording after another player is requested', async () => {
  let finish: (value: typeof recording) => void = () => undefined;
  const pending = new Promise<typeof recording>((resolve) => {
    finish = resolve;
  });
  render(
    <>
      <JournalPlaybackProvider>
        <JournalMinimalPlayer label="first" load={() => pending} />
      </JournalPlaybackProvider>
      <JournalPlaybackProvider>
        <JournalMinimalPlayer label="second" load={load} />
      </JournalPlaybackProvider>
    </>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play first' }));
  fireEvent.click(screen.getByRole('button', { name: 'Play second' }));
  await screen.findByLabelText('second audio');
  await act(async () => finish(recording));
  expect(screen.queryByLabelText('first audio')).toBeNull();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play first' })).toBeEnabled());
});
it('preserves furigana and refuses a different text snapshot', () => {
  expect(
    sentenceReadings(
      '映画[えいが]を見[み]た。楽[たの]しかった。',
      sentences.map((s) => s.text)
    )
  ).toEqual(['映画[えいが]を見[み]た。', '楽[たの]しかった。']);
  expect(
    sentenceReadings(
      '別の文章。',
      sentences.map((s) => s.text)
    )
  ).toBeNull();
  expect(sentenceAt(sentences, 4)).toBe(-1);
  expect(adjacentSentence([], 0, 1)).toBeUndefined();
});

it('keeps highlights and repeated arrows aligned when the media clock rounds down', () => {
  const fractional = [
    { text: '一。', start: 0, end: 1 },
    { text: '二。', start: 1.6, end: 2.4 },
    { text: '三。', start: 3.2, end: 4 },
  ];
  const rounded = 1.5999999;
  expect(sentenceAt(fractional, rounded)).toBe(1);
  expect(adjacentSentence(fractional, rounded, 1)).toBe(3.2);
  expect(adjacentSentence(fractional, rounded, -1)).toBe(0);
  expect(sentenceAt(fractional, 4)).toBe(-1);
  expect(sentenceAt(sentences, 1.9999999)).toBe(1);
});

it('pauses with space on the page or a sentence without seeking or interrupting typing', async () => {
  mount();
  const audio = await start();
  Object.defineProperty(audio, 'paused', { value: false, configurable: true });
  const pause = vi.mocked(HTMLMediaElement.prototype.pause);
  pause.mockClear();
  fireEvent.keyDown(screen.getByLabelText('Edit journal'), { key: ' ', code: 'Space' });
  expect(pause).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: ' ', code: 'Space', repeat: true });
  expect(pause).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
  expect(pause).toHaveBeenCalledTimes(1);
  audio.currentTime = 1;
  fireEvent.keyDown(screen.getByRole('button', { name: 'Seek to sentence 2' }), {
    key: ' ',
    code: 'Space',
  });
  expect(pause).toHaveBeenCalledTimes(2);
  expect(audio.currentTime).toBe(1);
});
