import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MasteryPromotionAnimation from '../MasteryPromotionAnimation';

describe('MasteryPromotionAnimation', () => {
  afterEach(() => {
    vi.useRealTimers();
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
});
