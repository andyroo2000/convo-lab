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
  suggestion: '昨日は映画を見ました。',
  suggestionReading: '昨日[きのう]は映画[えいが]を見[み]ました。',
  replacement: '映画を見ました。',
  replacementReading: '映画[えいが]を見[み]ました。',
  explanation: 'Use 見ました for the past tense.',
  explanationReading: 'Use 見[み]ました for the past tense.',
};

it('highlights only the original words and preserves their readings', () => {
  render(<JournalHighlight segment={segment} />);
  const anchor = screen.getByRole('button', {
    name: 'Correction: Replace 映画を見ますた。 with 映画を見ました。',
  });
  expect(anchor).toHaveTextContent('映画えいがを見みますた。');
  expect(anchor).not.toHaveTextContent('ました。');
  expect(anchor).not.toHaveTextContent('昨日');
  expect(within(anchor).getByText('えいが').tagName).toBe('RT');
});

it.each(['', null])(
  'keeps the original visible for a deleted or unavailable replacement: %s',
  (replacement) => {
    render(<JournalHighlight segment={{ ...segment, replacement }} />);
    expect(screen.getByRole('button')).toHaveTextContent('映画えいがを見みますた。');
  }
);

it('leaves optional wording out of the original passage', () => {
  render(<JournalHighlight segment={{ ...segment, kind: 'optional' }} />);
  expect(screen.getByRole('button')).toHaveTextContent('映画えいがを見みますた。');
  expect(screen.getByRole('button')).not.toHaveTextContent('ました。');
});

it('gives an insertion a visible anchor without inserting the replacement into the original', () => {
  render(<JournalHighlight segment={{ ...segment, text: '', reading: '' }} />);
  const anchor = screen.getByRole('button', { name: 'Correction: Insert 映画を見ました。' });
  expect(anchor).toBeVisible();
  expect(anchor).toHaveTextContent('＋');
  expect(anchor).not.toHaveTextContent('映画');
  fireEvent.click(anchor);
  expect(screen.getByRole('dialog')).toHaveTextContent('past tense');
});

it('renders older praise segments as ordinary text with readings and no popover', () => {
  const { container } = render(<JournalHighlight segment={{ ...segment, kind: 'keep' }} />);
  expect(container.textContent).toContain('映画えいがを見みますた。');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Worth keeping')).not.toBeInTheDocument();
});

it('opens a compact correction on tap or keyboard focus and closes with Escape', () => {
  render(<JournalHighlight segment={segment} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  const popup = screen.getByRole('dialog');
  expect(popup.textContent).toContain('Use 見ました for the past tense.');
  expect(within(popup).getAllByText('み')).toHaveLength(2);
  expect(within(popup).getAllByText('えいが')).toHaveLength(2);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.focus(screen.getByRole('button'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

it('keeps a preview open on the first click and closes it on the second', () => {
  render(<JournalHighlight segment={segment} />);
  const anchor = screen.getByRole('button');
  fireEvent.focus(anchor);
  fireEvent.pointerDown(anchor, { pointerType: 'mouse' });
  fireEvent.click(anchor);
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(anchor);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps a tapped popup open when the anchor blurs and toggles it on another tap', () => {
  render(<JournalHighlight segment={segment} />);
  const anchor = screen.getByRole('button');
  fireEvent.pointerDown(anchor, { pointerType: 'touch' });
  fireEvent.focus(anchor);
  fireEvent.click(anchor);
  const popup = screen.getByRole('dialog');
  fireEvent.blur(anchor);
  fireEvent.pointerDown(popup, { pointerType: 'touch' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.pointerDown(anchor, { pointerType: 'touch' });
  fireEvent.click(anchor);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each(['correction', 'optional'] as const)(
  'shows %s notes without acceptance controls or status',
  (kind) => {
    render(<JournalHighlight segment={{ ...segment, kind }} />);
    const anchor = screen.getByRole('button');
    anchor.focus();
    fireEvent.click(anchor);
    const popup = screen.getByRole('dialog');
    expect(popup).toHaveTextContent('past tense');
    expect(within(popup).queryByRole('button')).not.toBeInTheDocument();
    expect(within(popup).queryByRole('status')).not.toBeInTheDocument();
    expect(popup).not.toHaveTextContent('Applied');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(anchor).toHaveFocus();
  }
);

it('never inserts a full-sentence suggestion for legacy segments without replacement fields', () => {
  const { replacement: _replacement, replacementReading: _reading, ...legacy } = segment;
  const { container } = render(<JournalHighlight segment={legacy} />);
  expect(screen.queryByText(/ますた。/, { selector: 'del' })).not.toBeInTheDocument();
  expect(screen.queryByText(/ました。/, { selector: 'ins' })).not.toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveAccessibleName('Correction: 映画を見ますた。');
  expect(container).not.toHaveTextContent('昨日');
});

it('highlights only the exact phrase inside surrounding unchanged text', () => {
  render(
    <p>
      先々日の夜は
      <JournalHighlight
        segment={{
          ...segment,
          text: '辺りしい',
          reading: '辺りしい',
          suggestion: '先々日の夜は新しい映画を見た。',
          suggestionReading:
            '先々日[さきおととい]の夜[よる]は新[あたら]しい映画[えいが]を見[み]た。',
          replacement: '新しい',
          replacementReading: '新[あたら]しい',
        }}
      />
      映画を見た。
    </p>
  );
  expect(screen.getByRole('button')).toHaveTextContent('辺りしい');
  expect(screen.getByRole('button')).not.toHaveTextContent('新');
  expect(
    screen.getByText(/先々日の夜は/, { selector: 'p' }).textContent?.match(/先々日の夜は/g)
  ).toHaveLength(1);
  expect(
    screen.getByText(/先々日の夜は/, { selector: 'p' }).textContent?.match(/映画を見た。/g)
  ).toHaveLength(1);
});
