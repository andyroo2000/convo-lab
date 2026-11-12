import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { KnownKanjiContextProvider } from '../../../contexts/KnownKanjiContext';
import JournalHighlight from '../JournalHighlight';
import JournalRuby from '../JournalRuby';
import type { JournalSegment } from '../types';

const segment: JournalSegment = {
  text: '映画を見ますた。',
  reading: '映画[えいが]を見[み]ますた。',
  kind: 'correction',
  suggestion: '映画を見ました。',
  suggestionReading: '映画[えいが]を見[み]ました。',
  explanation: 'Use 見ました for the past tense.',
  explanationReading: 'Use 見[み]ました for the past tense.',
};

it('opens a compact correction on tap or keyboard focus and closes with Escape', () => {
  render(<JournalHighlight segment={segment} />);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  const popup = screen.getByRole('tooltip');
  expect(popup.textContent).toContain('Use 見みました for the past tense.');
  expect(within(popup).getAllByText('み')).toHaveLength(2);
  expect(within(popup).getByText('えいが')).toBeInTheDocument();
  expect(popup.className).toContain('p-3');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.focus(screen.getByRole('button'));
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('hides only readings whose entire kanji word is known', () => {
  render(
    <KnownKanjiContextProvider active knownKanji={new Set(['映', '画'])}>
      <JournalRuby text="映画[えいが]を見[み]ました。" />
    </KnownKanjiContextProvider>
  );
  expect(screen.getByText('えいが')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByText('み')).toHaveAttribute('aria-hidden', 'false');
});

it('preserves Japanese and English as text rather than interpreting markup', () => {
  const { container } = render(<JournalRuby text="<script>日本[にほん]</script>" />);
  expect(container.textContent).toBe('<script>日本にほん</script>');
  expect(container.innerHTML).not.toContain('<script>');
  expect(screen.getByText('にほん').tagName).toBe('RT');
});
