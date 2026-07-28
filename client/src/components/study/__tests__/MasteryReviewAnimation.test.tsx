import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MasteryReviewAnimation from '../MasteryReviewAnimation';

describe('MasteryReviewAnimation', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('announces the resulting level and renders the full segmented scale', () => {
    render(
      <MasteryReviewAnimation
        label="朝ごはんを食べませんでした。"
        fromLevel="apprentice"
        toLevel="guru"
        passed
        announcement="朝ごはんを食べませんでした。 is now guru"
        onFinished={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      '朝ごはんを食べませんでした。 is now guru'
    );
    expect(screen.getByRole('status')).toHaveClass(
      'mastery-promotion-animation',
      'mastery-promotion-animation--moved'
    );
    expect(screen.getByText('apprentice')).toBeInTheDocument();
    expect(screen.getByText('guru')).toBeInTheDocument();
    expect(screen.getByText('master')).toBeInTheDocument();
    expect(screen.getByText('enlightened')).toBeInTheDocument();
    expect(screen.getByText('burned')).toBeInTheDocument();
    expect(screen.queryByText(/FSRS stability/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('finishes automatically after the animation', () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();

    render(
      <MasteryReviewAnimation
        label="研究"
        fromLevel="guru"
        toLevel="master"
        passed
        announcement="研究 is now master"
        onFinished={onFinished}
      />
    );

    act(() => {
      vi.advanceTimersByTime(1_450);
    });

    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('marks a failed review even when the level does not move', () => {
    render(
      <MasteryReviewAnimation
        label="研究"
        fromLevel="guru"
        toLevel="guru"
        passed={false}
        announcement="研究 is now guru"
        onFinished={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveClass('mastery-promotion-animation--failed');
    expect(screen.getByRole('status')).not.toHaveClass('mastery-promotion-animation--moved');
  });

  it('centers the resulting level without track motion for reduced motion', () => {
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
      <MasteryReviewAnimation
        label="研究"
        fromLevel="apprentice"
        toLevel="guru"
        passed
        announcement="研究 is now guru"
        onFinished={onFinished}
      />
    );

    expect(screen.getByRole('status')).toHaveClass('mastery-promotion-animation--reduced');
    expect(screen.getByText('研究')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(649);
    });
    expect(onFinished).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onFinished).toHaveBeenCalledOnce();
  });
});
