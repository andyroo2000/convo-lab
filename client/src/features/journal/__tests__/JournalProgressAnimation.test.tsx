import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import JournalInlinePlayer from '../JournalInlinePlayer';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('follows the media clock between timeupdate events and cancels frames on pause and unmount', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:progress');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  const view = render(
    <JournalInlinePlayer
      label="journal"
      load={async () => ({ data: { audioBase64: 'SUQz', sentences: [] } })}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Listen journal' }));
  const audio = await screen.findByLabelText<HTMLAudioElement>('journal audio');
  Object.defineProperty(audio, 'duration', { value: 10, configurable: true });
  fireEvent.loadedMetadata(audio);
  fireEvent.play(audio);
  // The decorative fill has no accessible role; inspect its painted transform.
  // eslint-disable-next-line testing-library/no-node-access
  const bar = screen.getByRole('progressbar').firstElementChild;
  function frameAt(time: number) {
    audio.currentTime = time;
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    });
  }
  frameAt(2.5);
  expect(bar).toHaveStyle({ transform: 'scaleX(0.25)' });
  frameAt(2.6);
  expect(bar).toHaveStyle({ transform: 'scaleX(0.26)' });
  // Buffering holds the real clock still; the ribbon must not drift ahead.
  frameAt(2.6);
  expect(bar).toHaveStyle({ transform: 'scaleX(0.26)' });
  fireEvent.pause(audio);
  expect(frames.size).toBe(0);
  expect(bar).toHaveStyle({ transform: 'scaleX(0.26)' });
  audio.currentTime = 7;
  fireEvent.timeUpdate(audio);
  expect(bar).toHaveStyle({ transform: 'scaleX(0.7)' });
  fireEvent.ended(audio);
  expect(bar).toHaveStyle({ transform: 'scaleX(1)' });
  fireEvent.click(screen.getByRole('button', { name: 'Replay journal' }));
  expect(bar).toHaveStyle({ transform: 'scaleX(0)' });
  fireEvent.play(audio);
  expect(frames.size).toBe(1);
  view.unmount();
  expect(frames.size).toBe(0);
});
