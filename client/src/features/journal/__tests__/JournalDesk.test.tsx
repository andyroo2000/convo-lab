import './dialogMock';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import JournalArchiveMore from '../JournalArchiveMore';
import JournalEntriesDrawer from '../JournalEntriesDrawer';
import JournalOverflow from '../JournalOverflow';
import JournalSeekRibbon from '../JournalSeekRibbon';
import type useJournalPlayer from '../useJournalPlayer';

afterEach(() => vi.unstubAllGlobals());

it('loads visible archive pages only when idle and stops automatic retries after an error', () => {
  let notify: IntersectionObserverCallback = () => undefined;
  const disconnect = vi.fn();
  const observe = vi.fn();
  const constructed = vi.fn();
  class Observer {
    constructor(callback: IntersectionObserverCallback) {
      notify = callback;
      constructed();
    }

    observe = observe;

    disconnect = disconnect;
  }
  vi.stubGlobal('IntersectionObserver', Observer);
  const load = vi.fn();
  const { rerender } = render(
    <JournalArchiveMore busy={false} automatic cursor="page2" load={load} />
  );
  act(() =>
    notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  );
  expect(load).toHaveBeenCalledOnce();
  rerender(<JournalArchiveMore busy automatic cursor="page2" load={load} />);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(screen.getByRole('button')).toBeDisabled();
  rerender(<JournalArchiveMore busy={false} automatic={false} cursor="page2" load={load} />);
  expect(constructed).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(load).toHaveBeenCalledTimes(2);
});

it('closes the entries drawer on a selection or entry change but preserves modified clicks', () => {
  const contents = <a href="#entry">Movie night</a>;
  const { rerender } = render(
    <JournalEntriesDrawer entryId="one">{contents}</JournalEntriesDrawer>
  );
  fireEvent.click(screen.getByRole('button', { name: 'My entries' }));
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('link'), { ctrlKey: true });
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('link'));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'My entries' }));
  rerender(<JournalEntriesDrawer entryId="two">{contents}</JournalEntriesDrawer>);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('dismisses overflow on Escape, outside pointer, or keyboard focus leaving', () => {
  render(
    <>
      <JournalOverflow>
        <button type="button">Copy text</button>
      </JournalOverflow>
      <button type="button">Outside</button>
    </>
  );
  const trigger = screen.getByLabelText('More journal options');
  fireEvent.click(trigger);
  expect(screen.getByRole('button', { name: 'Copy text' })).toBeVisible();
  fireEvent.focusOut(trigger, { relatedTarget: null });
  expect(screen.getByText('Copy text')).toBeVisible();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByText('Copy text')).not.toBeVisible();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.getByText('Copy text')).not.toBeVisible();
  fireEvent.click(trigger);
  fireEvent.focusOut(screen.getByRole('button', { name: 'Copy text' }), {
    relatedTarget: screen.getByRole('button', { name: 'Outside' }),
  });
  expect(screen.getByText('Copy text')).not.toBeVisible();
});

it('previews a scrub without seeking until release and supports keyboard changes', () => {
  const seek = vi.fn();
  const player = {
    duration: 100,
    playing: false,
    playback: { position: 20, player: { current: null }, seek },
  } as unknown as ReturnType<typeof useJournalPlayer>;
  render(<JournalSeekRibbon player={player} label="Entry" />);
  const slider = screen.getByRole('slider');
  Object.defineProperty(slider, 'setPointerCapture', { value: vi.fn() });
  fireEvent.pointerDown(slider, { pointerId: 1 });
  fireEvent.change(slider, { target: { value: '60' } });
  expect(slider).toHaveAttribute('aria-valuetext', '60 of 100 seconds');
  expect(seek).not.toHaveBeenCalled();
  fireEvent.pointerUp(slider, { pointerId: 1 });
  expect(seek).toHaveBeenCalledExactlyOnceWith(60);
  fireEvent.change(slider, { target: { value: '30' } });
  expect(seek).toHaveBeenLastCalledWith(30);
});
