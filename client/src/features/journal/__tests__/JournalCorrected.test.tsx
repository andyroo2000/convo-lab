import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import JournalFeedback from '../JournalFeedback';
import JournalCorrected from '../JournalCorrected';
import type { JournalAnalysis } from '../types';

vi.mock('../JournalAudioPlayer', () => ({ default: () => <div>Audio player</div> }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Copy draft text' }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('映画を見ますた。'));
  fireEvent.click(screen.getByRole('button', { name: 'Final' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy final text' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Copy final text' }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('映画を見ました。'));
  expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
});
it('keeps the final reading and audio without an edit or duplicate copy toolbar', () => {
  render(
    <JournalCorrected
      {...props}
      controls={{ busy: false, error: '', reset: vi.fn(), change: vi.fn() }}
    />
  );
  expect(screen.getByText('Audio player')).toBeInTheDocument();
  expect(screen.getByText('えいが')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
