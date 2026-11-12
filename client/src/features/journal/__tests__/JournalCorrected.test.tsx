import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import JournalCorrected from '../JournalCorrected';
import type { JournalAnalysis } from '../types';

vi.mock('../JournalAudioPlayer', () => ({ default: () => <div>Audio player</div> }));
vi.mock('../JournalCopyButton', () => ({
  default: ({ text }: { text: string }) => <button type="button">Copy: {text}</button>,
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
    segments: [],
  },
  correctedDocument: { text: '映画を見た。', reading: '映画[えいが]を見[み]た。', suggestions: [] },
};
const props = { ownerId: 'owner', entryId: 'entry', analysis };

it('edits the saved corrected text and submits the revision captured when editing began', async () => {
  const controls = {
    busy: false,
    error: '',
    reset: vi.fn(),
    change: vi.fn().mockResolvedValue(true),
  };
  const { rerender } = render(<JournalCorrected {...props} controls={controls} />);
  expect(screen.getByRole('button', { name: 'Copy: 映画を見た。' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit corrected version' }));
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: '映画は「星のパン屋77」だった。' },
  });
  rerender(
    <JournalCorrected {...props} analysis={{ ...analysis, replyRevision: 4 }} controls={controls} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(controls.change).toHaveBeenCalledWith({ text: '映画は「星のパン屋77」だった。' }, 3)
  );
  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
});

it('preserves the draft on failure and cancel leaves the saved text alone', async () => {
  const controls = {
    busy: false,
    error: 'Could not save',
    reset: vi.fn(),
    change: vi.fn().mockRejectedValue(new Error('Offline')),
  };
  render(<JournalCorrected {...props} controls={controls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit corrected version' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '私の編集。' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(controls.change).toHaveBeenCalled());
  expect(screen.getByRole('textbox')).toHaveValue('私の編集。');
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(controls.change).toHaveBeenCalledTimes(1);
});
