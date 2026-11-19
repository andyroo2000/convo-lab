import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import JournalFeedback from '../JournalFeedback';
import JournalCorrected from '../JournalCorrected';
import type { JournalAnalysis } from '../types';

vi.mock('../JournalAudioPlayer', () => ({
  default: ({ expectedReplyRevision }: { expectedReplyRevision: number }) => (
    <div data-testid="audio" data-revision={expectedReplyRevision}>
      Audio player
    </div>
  ),
}));
vi.mock('../useJournalDocument', () => ({
  default: () => ({ busy: false, error: '', reset: vi.fn(), change: vi.fn() }),
}));
const analysis: JournalAnalysis = {
  id: 'analysis',
  sourceVersion: 1,
  status: 'ready',
  error: null,
  updatedAt: '',
  replyRevision: 3,
  result: {
    title: 'Movie',
    correctedText: 'Old text',
    correctedReading: 'Old text',
    question: '',
    questionReading: '',
    questionTranslation: '',
    segments: [
      {
        text: '映画を見ますた。',
        reading: '映画[えいが]を見[み]ますた。',
        kind: 'plain',
        suggestion: null,
        suggestionReading: null,
        explanation: null,
        explanationReading: null,
      },
    ],
  },
  correctedDocument: { text: '映画を見た。', reading: '映画[えいが]を見[み]た。', suggestions: [] },
};
const props = { ownerId: 'owner', entryId: 'entry', analysis };

it('copies the selected version and follows saved correction changes without furigana', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { rerender } = render(<JournalFeedback {...props} followUp={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
  fireEvent.click(screen.getByLabelText('More journal options'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy text (Copy draft text)' }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('映画を見ますた。'));
  fireEvent.click(screen.getByRole('button', { name: 'Final' }));
  fireEvent.click(screen.getByLabelText('More journal options'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy text (Copy final text)' }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('映画を見た。'));
  rerender(
    <JournalFeedback
      {...props}
      followUp={false}
      analysis={{
        ...analysis,
        correctedDocument: {
          text: '映画を見ました。',
          reading: '映画[えいが]を見[み]ました。',
          suggestions: [],
        },
      }}
    />
  );
  fireEvent.click(screen.getByLabelText('More journal options'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy text (Copy final text)' }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('映画を見ました。'));
  fireEvent.click(screen.getByLabelText('More journal options'));
  expect(screen.getByRole('button', { name: 'Edit final text' })).toBeVisible();
});
it('keeps final reading, audio, and an edit action without a duplicate copy toolbar', () => {
  render(
    <JournalCorrected
      {...props}
      controls={{ busy: false, error: '', reset: vi.fn(), change: vi.fn() }}
    />
  );
  expect(screen.getByText('Audio player')).toBeInTheDocument();
  expect(screen.getByText('えいが')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit final text' })).toBeVisible();
});

it('opens plain final text, stops playback, and saves against the opened revision', async () => {
  const change = vi.fn().mockResolvedValue(true);
  const controls = { busy: false, error: '', reset: vi.fn(), change };
  const { rerender } = render(<JournalCorrected {...props} controls={controls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit final text' }));
  const field = screen.getByRole('textbox', { name: 'Final text' });
  expect(field).toHaveValue('映画を見た。');
  expect(field).toHaveFocus();
  expect(screen.queryByText('Audio player')).not.toBeInTheDocument();
  fireEvent.change(field, { target: { value: '映画は楽しかった。\nまた見たい。' } });
  rerender(
    <JournalCorrected {...props} analysis={{ ...analysis, replyRevision: 4 }} controls={controls} />
  );
  expect(field).toHaveValue('映画は楽しかった。\nまた見たい。');
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(change).toHaveBeenCalledWith({ text: '映画は楽しかった。\nまた見たい。' }, 3)
  );
  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  expect(screen.getByTestId('audio')).toHaveAttribute('data-revision', '4');
});
it('preserves edits after a failed save and supports cancel without a write', async () => {
  const change = vi.fn().mockResolvedValue(false);
  const controls = { busy: false, error: '', reset: vi.fn(), change };
  const { rerender } = render(<JournalCorrected {...props} controls={controls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit final text' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '書き直しました。' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(change).toHaveBeenCalledOnce());
  rerender(
    <JournalCorrected {...props} controls={{ ...controls, error: 'Your edits are still here.' }} />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Your edits are still here.');
  expect(screen.getByRole('textbox')).toHaveValue('書き直しました。');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(change).toHaveBeenCalledOnce();
  expect(screen.getByTestId('audio')).toHaveAttribute('data-revision', '3');
});
it('rejects blank edits and closes unchanged text without regenerating audio', () => {
  const change = vi.fn();
  render(
    <JournalCorrected {...props} controls={{ busy: false, error: '', reset: vi.fn(), change }} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit final text' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  ' } });
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '映画を見た。' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(change).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
