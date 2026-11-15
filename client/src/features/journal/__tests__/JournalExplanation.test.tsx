import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import JournalExplanation from '../JournalExplanation';
import JournalCorrection from '../JournalCorrection';
import type { JournalSegment } from '../types';

const segment: JournalSegment = {
  text: '辺りしい',
  reading: '辺りしい',
  kind: 'correction',
  replacement: '新しい',
  replacementReading: '新[あたら]しい',
  suggestion: '新しい映画',
  suggestionReading: '新[あたら]しい映画[えいが]',
  explanation: 'For ***new***, use 新しい. 辺り means ***the surrounding area***.',
  explanationReading:
    'For ***new***, use 新[あたら]しい. 辺[あた]り means ***the surrounding area***.',
};

it('shows the exact edit above the explanation and omits only matching repeated readings', () => {
  render(
    <>
      <JournalCorrection segment={segment} />
      <JournalExplanation segment={segment} />
    </>
  );
  const edit = screen.getByLabelText('Suggested edit');
  expect(edit).toHaveTextContent('辺りしい→新あたらしい');
  expect(within(edit).getByText('あたら').tagName).toBe('RT');
  expect(screen.getAllByText('あたら')).toHaveLength(1);
  expect(screen.getByText('あた').tagName).toBe('RT');
  expect(screen.getByText('new', { selector: 'strong > em' })).toBeInTheDocument();
  expect(within(edit).queryByText('new')).not.toBeInTheDocument();
});

it('renders bold, italic and combined emphasis without interpreting HTML or links', () => {
  const { container } = render(
    <JournalExplanation
      segment={{
        ...segment,
        explanationReading:
          '**Bold** *italic* ***both*** <img src=x onerror=alert(1)> [link](javascript:alert(1))',
      }}
    />
  );
  expect(screen.getByText('Bold').tagName).toBe('STRONG');
  expect(screen.getByText('italic').tagName).toBe('EM');
  expect(screen.getByText('both', { selector: 'strong > em' })).toBeInTheDocument();
  expect(container.innerHTML).not.toMatch(/<(img|a|script)[ >]/);
  expect(container).toHaveTextContent('<img src=x onerror=alert(1)>');
  expect(container).toHaveTextContent('[link](javascript:alert(1))');
});

it('keeps readings for legacy feedback when there is no correction header', () => {
  const legacy = { ...segment, replacement: undefined, replacementReading: undefined };
  render(
    <>
      <JournalCorrection segment={legacy} />
      <JournalExplanation segment={legacy} />
    </>
  );
  expect(screen.queryByLabelText('Suggested edit')).not.toBeInTheDocument();
  expect(screen.getByText('あたら').tagName).toBe('RT');
});

it('retains a different reading for the same kanji', () => {
  render(
    <JournalExplanation segment={{ ...segment, explanationReading: '新[しん] means new.' }} />
  );
  expect(screen.getByText('しん').tagName).toBe('RT');
});

it('labels insertions and deletions without falling back to a full sentence', () => {
  const { rerender } = render(
    <JournalCorrection segment={{ ...segment, replacement: '', replacementReading: '' }} />
  );
  expect(screen.getByLabelText('Suggested edit')).toHaveTextContent('辺りしい→Remove');
  rerender(<JournalCorrection segment={{ ...segment, text: '', reading: '' }} />);
  expect(screen.getByLabelText('Suggested edit')).toHaveTextContent('Insert→新あたらしい');
});

it('leaves malformed emphasis and plain historical explanations readable', () => {
  render(
    <JournalExplanation
      segment={{ ...segment, explanationReading: 'Use *new and **plain text.' }}
    />
  );
  expect(screen.getByText('Use *new and **plain text.')).toBeInTheDocument();
});
