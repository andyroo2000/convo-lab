import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudyAchievementAwardView } from '../StudyAchievementViews';
import type { PresentedAchievement } from '../achievementModel';

const achievement = (id: string) =>
  ({
    id,
    tier: {
      title: id,
      earnedDescription: 'Listened for an hour',
      assets: { earned: { png: { '256': { path: '/badge.png' }, '512': { path: '/badge.png' } } } },
    },
  }) as PresentedAchievement;

const renderAwards = () => {
  const props = {
    achievements: [achievement('first'), achievement('second')],
    currentIndex: 0,
    onContinue: vi.fn(),
    onSkip: vi.fn(),
    onSkipAll: vi.fn(),
  };
  const view = render(<StudyAchievementAwardView {...props} />);
  return { props, ...view };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('achievement animation escape controls', () => {
  it('allows Skip and Skip all immediately without waiting for the animation', () => {
    const { props } = renderAwards();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(props.onSkip).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Skip all' }));
    expect(props.onSkipAll).toHaveBeenCalledOnce();
  });

  it('skips with right arrow, ignores held keys and modifiers, and removes its listener', () => {
    const { props, unmount } = renderAwards();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(props.onSkip).toHaveBeenCalledOnce();
    unmount();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(props.onSkip).toHaveBeenCalledOnce();
  });

  it('cancels an in-flight transition when skipping so a later timer cannot skip another badge', () => {
    const { props } = renderAwards();
    act(() => vi.advanceTimersByTime(4_800));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    act(() => vi.runAllTimers());
    expect(props.onSkip).toHaveBeenCalledOnce();
    expect(props.onContinue).not.toHaveBeenCalled();
  });

  it('cancels pending transitions on Skip all', () => {
    const { props } = renderAwards();
    act(() => vi.advanceTimersByTime(4_800));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip all' }));
    act(() => vi.runAllTimers());
    expect(props.onSkipAll).toHaveBeenCalledOnce();
    expect(props.onContinue).not.toHaveBeenCalled();
  });

  it('handles an empty queue safely', () => {
    const { props, rerender } = renderAwards();
    rerender(<StudyAchievementAwardView {...props} achievements={[]} />);
    expect(screen.queryByTestId('study-achievement-award')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(props.onSkip).not.toHaveBeenCalled();
  });
});
