import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import JournalHighlight from '../JournalHighlight';
import JournalDeskContext from '../JournalDeskContext';
import type { JournalSegment } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps the note inside a phone viewport when its footer or error changes size', () => {
  const observers = new Set<() => void>();
  const disconnect = vi.fn();
  class Observer {
    constructor(callback: () => void) {
      observers.add(callback);
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
  act(() => observers.forEach((resized) => resized()));
  expect(note).toHaveStyle({ left: '28px' });
  unmount();
  expect(disconnect).toHaveBeenCalledTimes(observers.size);
});

it('updates an open body-portaled note when the Journal font size changes', () => {
  const note = (size: number) => (
    <JournalDeskContext.Provider value={{ target: null, textSize: size }}>
      <JournalHighlight
        segment={{
          text: 'ていう',
          reading: 'ていう',
          kind: 'correction',
          suggestion: null,
          suggestionReading: null,
          replacement: 'っていう',
          explanation: 'Add っ.',
          explanationReading: null,
        }}
      />
    </JournalDeskContext.Provider>
  );
  const { rerender } = render(note(20));
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('dialog')).toHaveStyle({ '--journal-size': '20px' });
  rerender(note(30));
  expect(screen.getByRole('dialog')).toHaveStyle({ '--journal-size': '30px' });
  rerender(note(16));
  expect(screen.getByRole('dialog')).toHaveStyle({ '--journal-size': '16px' });
});
