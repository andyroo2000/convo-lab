import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import createLandingPlayback from '../landingPlayback';

function setup() {
  render(
    <>
      <video data-testid="first" />
      <video data-testid="second" />
    </>
  );
  const videos = ['first', 'second'].map((name) => screen.getByTestId(name) as HTMLVideoElement);
  const controls = videos.map((video) => {
    let paused = true;
    vi.spyOn(video, 'paused', 'get').mockImplementation(() => paused);
    const play = vi.spyOn(video, 'play').mockImplementation(async () => {
      paused = false;
    });
    const pause = vi.spyOn(video, 'pause').mockImplementation(() => {
      paused = true;
    });
    return { play, pause };
  });
  const reduced = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
  const playback = createLandingPlayback(videos, reduced);
  return { videos, controls, reduced, playback };
}

afterEach(() => vi.restoreAllMocks());

describe('landing film playback', () => {
  it('plays only the active film and stops when leaving the story', () => {
    const { videos, playback } = setup();
    playback.select(0);
    expect(videos.map((video) => video.paused)).toEqual([false, true]);
    playback.select(1);
    expect(videos.map((video) => video.paused)).toEqual([true, false]);
    playback.select(-1);
    expect(videos.every((video) => video.paused)).toBe(true);
    playback.destroy();
  });

  it('preserves a manual pause while changing chapters and supports keyboard resume', () => {
    const { videos, playback } = setup();
    playback.select(0);
    fireEvent.click(videos[0]);
    playback.select(1);
    playback.select(0);
    expect(videos[0].paused).toBe(true);
    fireEvent.keyDown(videos[0], { key: 'Enter' });
    expect(videos[0].paused).toBe(false);
    playback.destroy();
  });

  it('pauses hidden tabs and honors changes in reduced motion', () => {
    const { videos, reduced, playback } = setup();
    playback.select(0);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(videos[0].paused).toBe(true);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(videos[0].paused).toBe(false);
    Object.assign(reduced, { matches: true });
    reduced.dispatchEvent(new Event('change'));
    expect(videos[0].paused).toBe(true);
    playback.destroy();
  });

  it('removes listeners and pauses all films on unmount', () => {
    const { videos, controls, playback } = setup();
    playback.select(0);
    playback.destroy();
    controls[0].play.mockClear();
    fireEvent.click(videos[0]);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controls[0].play).not.toHaveBeenCalled();
    expect(videos.every((video) => video.paused)).toBe(true);
  });
});
