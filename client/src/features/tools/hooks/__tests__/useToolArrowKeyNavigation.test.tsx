import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useToolArrowKeyNavigation from '../useToolArrowKeyNavigation';

interface TestHarnessProps {
  onNext: () => void;
  onPrevious: () => void;
}

const TestHarness = ({ onNext, onPrevious }: TestHarnessProps) => {
  useToolArrowKeyNavigation({
    onNext,
    onPrevious,
  });

  return <input aria-label="test-input" />;
};

describe('useToolArrowKeyNavigation', () => {
  it('calls next and previous handlers on arrow keys', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();

    render(<TestHarness onNext={onNext} onPrevious={onPrevious} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('does not handle arrow keys while typing in inputs', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();

    render(<TestHarness onNext={onNext} onPrevious={onPrevious} />);

    const input = screen.getByRole('textbox', { name: /test-input/i });
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.keyDown(input, { key: 'ArrowLeft' });

    expect(onNext).not.toHaveBeenCalled();
    expect(onPrevious).not.toHaveBeenCalled();
  });
});
