import { expect, it } from 'vitest';
import journalPopoverPosition from '../journalPopoverPosition';

const viewport = { width: 320, height: 640 };
const popup = { width: 280, height: 200 };

it('opens below the passage with room for the speech pointer', () => {
  const position = journalPopoverPosition(new DOMRect(24, 50, 80, 30), popup, viewport, 16);
  expect(position).toEqual({
    left: 24,
    top: 96,
    pointerLeft: 40,
    placement: 'below',
    pointerVisible: true,
  });
});

it('opens above a low passage and keeps the pointer aimed at it after horizontal clamping', () => {
  const position = journalPopoverPosition(new DOMRect(260, 560, 40, 30), popup, viewport, 16);
  expect(position).toEqual({
    left: 28,
    top: 344,
    pointerLeft: 252,
    placement: 'above',
    pointerVisible: true,
  });
});

it('keeps the pointer away from rounded corners for narrow and long passages', () => {
  const narrow = journalPopoverPosition(new DOMRect(0, 50, 10, 30), popup, viewport, 16);
  const long = journalPopoverPosition(new DOMRect(20, 50, 500, 30), popup, viewport, 16);
  expect(narrow.pointerLeft).toBe(24);
  expect(long.pointerLeft).toBe(60);
});

it('omits the pointer when a tall note must overlap the passage', () => {
  const position = journalPopoverPosition(
    new DOMRect(24, 250, 80, 30),
    { width: 280, height: 592 },
    viewport,
    16
  );
  expect(position.top).toBe(12);
  expect(position.pointerVisible).toBe(false);
});
