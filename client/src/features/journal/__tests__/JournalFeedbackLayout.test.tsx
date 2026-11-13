import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import JournalFeedback from '../JournalFeedback';
import type { JournalAnalysis } from '../types';

vi.mock('../JournalAudioPlayer', () => ({ default: () => <div>Audio player</div> }));
vi.mock('../JournalFollowUp', () => ({ default: () => <section aria-label="Follow-up" /> }));
vi.mock('../useJournalDocument', () => ({
  default: () => ({ busy: false, error: '', reset: vi.fn(), change: vi.fn() }),
}));

const analysis: JournalAnalysis = {
  id: 'analysis',
  sourceVersion: 1,
  status: 'ready',
  error: null,
  updatedAt: '',
  result: {
    title: 'Movie',
    correctedText: 'っていう',
    correctedReading: 'っていう',
    question: '',
    questionReading: '',
    questionTranslation: '',
    segments: [],
  },
};

it('keeps one corrected section across repeated saved Apply/Reject revisions', () => {
  const { rerender } = render(
    <JournalFeedback ownerId="owner" entryId="entry" analysis={analysis} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Final' }));
  for (let revision = 1; revision <= 6; revision += 1) {
    const text = revision % 2 === 0 ? 'っていう' : 'ていう';
    rerender(
      <JournalFeedback
        ownerId="owner"
        entryId="entry"
        analysis={{
          ...analysis,
          replyRevision: revision,
          correctedDocument: { text, reading: text, suggestions: [] },
        }}
      />
    );
    expect(screen.getAllByRole('region', { name: 'Corrected Version' })).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Corrected Version' })).toHaveTextContent(text);
    expect(screen.getAllByRole('region', { name: 'Follow-up' })).toHaveLength(1);
  }
});

it('switches between highlighted draft and final without showing both', () => {
  render(
    <JournalFeedback
      ownerId="owner"
      entryId="entry"
      analysis={{
        ...analysis,
        result: {
          ...analysis.result!,
          segments: [
            {
              text: 'ていう',
              reading: 'ていう',
              kind: 'correction',
              suggestion: 'っていう',
              suggestionReading: 'っていう',
              replacement: 'っていう',
              replacementReading: 'っていう',
              explanation: 'Add っ.',
              explanationReading: null,
            },
          ],
        },
      }}
    />
  );
  const original = screen.getByRole('button', { name: 'Correction: Replace ていう with っていう' });
  expect(screen.queryByRole('region', { name: 'Corrected Version' })).not.toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Highlight meanings' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Final' }));
  const corrected = screen.getByRole('region', { name: 'Corrected Version' });
  expect(original.compareDocumentPosition(corrected)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(corrected).toHaveTextContent('っていう');
  expect(corrected).toContainElement(screen.getByText('Audio player'));
  expect(original).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
  expect(original).toBeVisible();
  expect(corrected).not.toBeVisible();
  expect(screen.getByText('Optional change')).toBeVisible();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
});
