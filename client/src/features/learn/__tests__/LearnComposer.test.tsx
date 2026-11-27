import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LearnComposer from '../LearnComposer';

describe('Learn message composer', () => {
  beforeEach(() => sessionStorage.clear());

  it('sends any reply for the tutor to interpret without a mode switch', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<LearnComposer storageKey="clarify" busy={false} onSend={onSend} />);
    expect(screen.queryByRole('button', { name: 'Ask my tutor' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'What does this word mean?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith('message', 'What does this word mean?')
    );
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
  });

  it('preserves exact wording on failure and restores the unsent draft after remount', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('Tutor unavailable'));
    const props = { storageKey: 'retry', busy: false, onSend };
    const { unmount } = render(<LearnComposer {...props} />);
    const answer = '  来るんだらしい。\n';
    fireEvent.change(screen.getByRole('textbox'), { target: { value: answer } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('message', answer));
    expect(screen.getByRole('textbox')).toHaveValue(answer);
    unmount();
    render(<LearnComposer {...props} />);
    expect(screen.getByRole('textbox')).toHaveValue(answer);
  });

  it('restores drafts saved by the old answer/question composer', () => {
    sessionStorage.setItem(
      'question-draft',
      JSON.stringify({ text: 'Why this form?', mode: 'clarify' })
    );
    render(<LearnComposer storageKey="question-draft" busy={false} onSend={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('Why this form?');
    expect(screen.queryByRole('button', { name: 'My answer' })).not.toBeInTheDocument();
  });

  it('prevents empty or duplicate submissions while the tutor is busy', () => {
    const onSend = vi.fn();
    const { rerender } = render(<LearnComposer storageKey="busy" busy={false} onSend={onSend} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My answer' } });
    rerender(<LearnComposer storageKey="busy" busy onSend={onSend} />);
    expect(screen.getByRole('button', { name: 'Your tutor is thinking…' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });
});
