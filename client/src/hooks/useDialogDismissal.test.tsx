import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import useDialogDismissal from './useDialogDismissal';
import DismissibleBackdrop from '../components/common/DismissibleBackdrop';

const Dialog = ({ onCancel }: { onCancel?: React.ReactEventHandler<HTMLDialogElement> }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useDialogDismissal(ref);
  return (
    <dialog ref={ref} open onCancel={onCancel} aria-label="Example">
      <button type="button">Inside</button>
    </dialog>
  );
};
function setup(onCancel?: React.ReactEventHandler<HTMLDialogElement>) {
  render(<Dialog onCancel={onCancel} />);
  const dialog = screen.getByRole('dialog') as HTMLDialogElement;
  const close = vi.fn();
  dialog.close = close;
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
    left: 20,
    right: 200,
    top: 20,
    bottom: 200,
  } as DOMRect);
  return { dialog, close };
}
function clickAt(element: Element, x: number) {
  fireEvent(element, new MouseEvent('pointerdown', { clientX: x, clientY: x, bubbles: true }));
  fireEvent.click(element, { clientX: x, clientY: x });
}
it('dismisses a native dialog on its backdrop, not its content or padding', () => {
  const { dialog, close } = setup();
  clickAt(screen.getByRole('button'), 50);
  clickAt(dialog, 50);
  expect(close).not.toHaveBeenCalled();
  clickAt(dialog, 5);
  expect(close).toHaveBeenCalledOnce();
});
it('preserves cancel guards and ignores drags from inside to outside', () => {
  const onCancel = vi.fn((event: React.SyntheticEvent) => event.preventDefault());
  const { dialog, close } = setup(onCancel);
  fireEvent.pointerDown(screen.getByRole('button'), { clientX: 50, clientY: 50 });
  fireEvent.click(dialog, { clientX: 5, clientY: 5 });
  expect(onCancel).not.toHaveBeenCalled();
  clickAt(dialog, 5);
  expect(onCancel).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
});
it('dismisses overlay modals only when the click starts and ends on the backdrop', () => {
  const dismiss = vi.fn();
  render(
    <DismissibleBackdrop className="" onDismiss={dismiss}>
      <button type="button">Inside</button>
    </DismissibleBackdrop>
  );
  const inside = screen.getByRole('button');
  const backdrop = screen.getByRole('presentation');
  clickAt(inside, 50);
  fireEvent.pointerDown(inside);
  fireEvent.click(backdrop);
  expect(dismiss).not.toHaveBeenCalled();
  clickAt(backdrop, 5);
  expect(dismiss).toHaveBeenCalledOnce();
});
