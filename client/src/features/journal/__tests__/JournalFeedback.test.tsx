import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
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

it('shows an editor replacement with separate original and corrected readings', () => {
  render(<JournalHighlight segment={segment} />);
  const edit = screen.getByRole('button', {
    name: 'Correction: Replace 映画を見ますた。 with 映画を見ました。',
  });
  expect(edit).not.toHaveTextContent('昨日');
  expect(within(edit).getByText(/ますた。/, { selector: 'del' })).toHaveTextContent(
    '映画えいがを見みますた。'
  );
  expect(within(edit).getByText(/ました。/, { selector: 'ins' })).toHaveTextContent(
    '映画えいがを見みました。'
  );
});

it('distinguishes deletion from unavailable replacement data', () => {
  const { rerender } = render(
    <JournalHighlight segment={{ ...segment, replacement: '', replacementReading: '' }} />
  );
  expect(screen.getByRole('button', { name: 'Correction: Remove 映画を見ますた。' })).toBeVisible();
  expect(screen.getByText(/ますた。/, { selector: 'del' })).toHaveTextContent(
    '映画えいがを見みますた。'
  );
  expect(screen.queryByText('', { selector: 'ins' })).not.toBeInTheDocument();
  rerender(<JournalHighlight segment={{ ...segment, replacement: null }} />);
  expect(screen.queryByText(/ますた。/, { selector: 'del' })).not.toBeInTheDocument();
  expect(screen.queryByText(/ました。/, { selector: 'ins' })).not.toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveTextContent('映画えいがを見みますた。');
});

it('shows optional replacements and falls back to replacement text without a reading', () => {
  render(<JournalHighlight segment={{ ...segment, kind: 'optional', replacementReading: null }} />);
  expect(screen.getByText(/ました。/, { selector: 'ins' })).toHaveTextContent('映画を見ました。');
  expect(screen.getByText(/ますた。/, { selector: 'del' })).toHaveTextContent(
    '映画えいがを見みますた。'
  );
});

it('renders an insertion without inventing original text', () => {
  render(<JournalHighlight segment={{ ...segment, text: '', reading: '' }} />);
  expect(screen.getByRole('button', { name: 'Correction: Insert 映画を見ました。' })).toBeVisible();
  expect(screen.queryByText('', { selector: 'del' })).not.toBeInTheDocument();
  expect(screen.getByText(/ました。/, { selector: 'ins' })).toHaveTextContent(
    '映画えいがを見みました。'
  );
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
  expect(popup.textContent).toContain('Use 見みました for the past tense.');
  expect(within(popup).getAllByText('み')).toHaveLength(1);
  expect(within(popup).queryByText('えいが')).not.toBeInTheDocument();
  expect(popup.className).toContain('p-3.5');
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

it('applies optional changes only on request and lets corrections be rejected', async () => {
  const toggle = vi.fn().mockResolvedValue(true);
  const { rerender } = render(
    <JournalHighlight
      segment={{ ...segment, kind: 'optional' }}
      action={{ applied: false, disabled: false, toggle }}
    />
  );
  expect(toggle).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('status')).toHaveTextContent('Original kept');
  fireEvent.click(screen.getByRole('button', { name: 'Apply suggestion' }));
  await waitFor(() => expect(toggle).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  rerender(
    <JournalHighlight segment={segment} action={{ applied: true, disabled: false, toggle }} />
  );
  expect(screen.getByRole('status')).toHaveTextContent('Applied');
  fireEvent.click(screen.getByRole('button', { name: 'Reject correction' }));
  await waitFor(() => expect(toggle).toHaveBeenCalledTimes(2));
});

it('moves keyboard focus into the action and restores it on Escape without reopening', async () => {
  render(
    <JournalHighlight
      segment={segment}
      action={{ applied: true, disabled: false, toggle: vi.fn() }}
    />
  );
  const anchor = screen.getByRole('button');
  anchor.focus();
  fireEvent.click(anchor, { detail: 0 });
  const action = screen.getByRole('button', { name: 'Reject correction' });
  await waitFor(() => expect(action).toHaveFocus());
  fireEvent.keyDown(action, { key: 'Escape' });
  expect(anchor).toHaveFocus();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps a failed change open and displays the error next to its action', async () => {
  render(
    <JournalHighlight
      segment={segment}
      action={{
        applied: true,
        disabled: false,
        error: 'Please try again.',
        toggle: vi.fn().mockResolvedValue(false),
      }}
    />
  );
  fireEvent.click(screen.getByRole('button'));
  fireEvent.click(screen.getByRole('button', { name: 'Reject correction' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again.');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

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
  expect(screen.getByText('辺りしい', { selector: 'del' })).toHaveTextContent('辺りしい');
  expect(screen.getByText(/しい/, { selector: 'ins' })).toHaveTextContent('新あたらしい');
  expect(
    screen.getByText(/先々日の夜は/, { selector: 'p' }).textContent?.match(/先々日の夜は/g)
  ).toHaveLength(1);
  expect(
    screen.getByText(/先々日の夜は/, { selector: 'p' }).textContent?.match(/映画を見た。/g)
  ).toHaveLength(1);
});
