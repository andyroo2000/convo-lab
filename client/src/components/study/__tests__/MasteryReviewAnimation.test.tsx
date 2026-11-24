import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MasteryReviewAnimation from '../MasteryReviewAnimation';

describe('MasteryReviewAnimation', () => {
  afterEach(() => vi.useRealTimers());
  it.each([
    ['apprentice', 'guru', 'promotion'],
    ['burned', 'guru', 'demotion'],
  ] as const)('shows the destination from %s to %s', (fromLevel, toLevel, direction) => {
    vi.useFakeTimers();
    const finish = vi.fn();
    render(
      <MasteryReviewAnimation
        fromLevel={fromLevel}
        toLevel={toLevel}
        announcement="Stage changed"
        onFinished={finish}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Stage changed');
    expect(screen.getByText('guru')).toHaveClass(`study-mastery-${direction}`);
    act(() => vi.advanceTimersByTime(1159));
    expect(finish).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(finish).toHaveBeenCalledOnce();
  });
  it('silently completes a held stage without a mastery delay', () => {
    vi.useFakeTimers();
    const finish = vi.fn();
    const { container } = render(
      <MasteryReviewAnimation fromLevel="guru" toLevel="guru" announcement="" onFinished={finish} />
    );
    expect(container).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(0));
    expect(finish).toHaveBeenCalledOnce();
  });
  it('cancels a stale completion when removed', () => {
    vi.useFakeTimers();
    const finish = vi.fn();
    const { unmount } = render(
      <MasteryReviewAnimation
        fromLevel="guru"
        toLevel="master"
        announcement=""
        onFinished={finish}
      />
    );
    unmount();
    act(() => vi.runAllTimers());
    expect(finish).not.toHaveBeenCalled();
  });
});
