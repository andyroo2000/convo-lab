import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MasteryPromotionAnimation from '../MasteryPromotionAnimation';

describe('MasteryPromotionAnimation', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('announces the full promotion while keeping the compact visual', () => {
    render(
      <MasteryPromotionAnimation
        label="朝ごはんを食べませんでした。"
        level="guru"
        announcement="朝ごはんを食べませんでした。 reached guru"
        onFinished={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      '朝ごはんを食べませんでした。 reached guru'
    );
    expect(screen.getByRole('status')).toHaveClass('mastery-promotion-animation');
    expect(screen.getByText('GURU')).toBeInTheDocument();
    expect(screen.queryByText(/FSRS stability/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('finishes automatically after the animation', () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();

    render(
      <MasteryPromotionAnimation
        label="研究"
        level="master"
        announcement="研究 reached master"
        onFinished={onFinished}
      />
    );

    act(() => {
      vi.advanceTimersByTime(2_650);
    });

    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('shows the item without flight motion and uses the shorter reduced-motion lifecycle', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const onFinished = vi.fn();

    render(
      <MasteryPromotionAnimation
        label="研究"
        level="guru"
        announcement="研究 reached guru"
        onFinished={onFinished}
      />
    );

    expect(screen.getByRole('status')).toHaveClass('mastery-promotion-animation--reduced');
    expect(screen.getByText('研究')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_149);
    });
    expect(onFinished).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onFinished).toHaveBeenCalledOnce();
  });
});
