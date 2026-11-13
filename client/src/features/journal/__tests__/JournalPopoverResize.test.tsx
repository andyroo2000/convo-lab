import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import JournalHighlight from '../JournalHighlight';
import type { JournalSegment } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps the note inside a phone viewport when its footer or error changes size', () => {
  let resized: (() => void) | undefined;
  const disconnect = vi.fn();
  class Observer {
    constructor(callback: () => void) {
      resized = callback;
    }

    observe = vi.fn();

    disconnect = disconnect;
  }
  vi.stubGlobal('ResizeObserver', Observer);
  vi.stubGlobal('innerWidth', 320);
  let popupWidth = 200;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function bounds(
    this: HTMLElement
  ) {
    if (this.getAttribute('role') === 'dialog') return new DOMRect(0, 0, popupWidth, 100);
    return new DOMRect(100, 20, 40, 30);
  });
  const segment: JournalSegment = {
    text: 'ていう',
    reading: 'ていう',
    kind: 'correction',
    suggestion: null,
    suggestionReading: null,
    replacement: 'っていう',
    explanation: 'Add っ.',
    explanationReading: null,
  };
  const { unmount } = render(<JournalHighlight segment={segment} />);
  fireEvent.click(screen.getByRole('button'));
  const note = screen.getByRole('dialog');
  expect(note).toHaveStyle({ left: '100px' });
  popupWidth = 280;
  act(() => resized?.());
  expect(note).toHaveStyle({ left: '28px' });
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
