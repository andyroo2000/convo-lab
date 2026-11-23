import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StudyReviewActions from '../StudyReviewActions';
import { baseCard } from './studyCardPreviewFixtures';

const props = () => ({
  card: baseCard,
  onEdit: vi.fn(),
  onBury: vi.fn(),
  onToggleSuspend: vi.fn(),
  onForget: vi.fn(),
  onToggleSetDue: vi.fn(),
  onOpenBrowse: vi.fn(),
});

describe('Study card action menu', () => {
  it('closes on Escape and outside click, restoring focus on Escape', async () => {
    render(<StudyReviewActions {...props()} />);
    const trigger = screen.getByRole('button', { name: 'More card options' });
    await userEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Set due' })).toBeVisible();
    await userEvent.keyboard('[Escape]');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('runs the selected action and closes the menu', async () => {
    const actions = props();
    render(<StudyReviewActions {...actions} />);
    const trigger = screen.getByRole('button', { name: 'More card options' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Set due' }));
    expect(actions.onToggleSetDue).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('disables and closes the menu while a card action is pending', async () => {
    const actions = props();
    const { rerender } = render(<StudyReviewActions {...actions} />);
    const trigger = screen.getByRole('button', { name: 'More card options' });
    await userEvent.click(trigger);
    rerender(<StudyReviewActions {...actions} disabled />);
    expect(trigger).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Set due' })).not.toBeInTheDocument();
  });
});
