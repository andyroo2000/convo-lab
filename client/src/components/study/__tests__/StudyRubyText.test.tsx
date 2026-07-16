import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KnownKanjiContextProvider } from '../../../contexts/KnownKanjiContext';
import StudyRubyText from '../StudyRubyText';

const renderWithKnownKanji = (text: string, knownKanji: string[], active = true) =>
  render(
    <KnownKanjiContextProvider active={active} knownKanji={new Set(knownKanji)}>
      <StudyRubyText text={text} />
    </KnownKanjiContextProvider>
  );

describe('StudyRubyText adaptive furigana', () => {
  it('hides a reading when every kanji in its base is known', () => {
    renderWithKnownKanji('会社[かいしゃ]へ', ['会', '社']);

    expect(screen.getByRole('button', { name: '会社' })).toHaveAttribute(
      'data-known-furigana-hidden',
      'true'
    );
    expect(screen.getByText('かいしゃ')).toHaveClass('opacity-0');
  });

  it('keeps the whole reading visible when any kanji in a compound is unknown', () => {
    renderWithKnownKanji('会社[かいしゃ]', ['会']);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('かいしゃ')).not.toHaveClass('opacity-0');
  });

  it('does not require the iteration mark to be in the known set', () => {
    renderWithKnownKanji('時々[ときどき]', ['時']);

    expect(screen.getByRole('button', { name: '時々' })).toHaveAttribute(
      'data-known-furigana-hidden',
      'true'
    );
  });

  it('reveals a hidden reading for the current rendered card when activated', () => {
    const parentClick = vi.fn();
    render(
      <div
        role="button"
        tabIndex={0}
        aria-label="Parent card"
        onClick={parentClick}
        onKeyDown={() => undefined}
      >
        <KnownKanjiContextProvider active knownKanji={new Set(['私'])}>
          <StudyRubyText text="私[わたし]" />
        </KnownKanjiContextProvider>
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: '私' }));

    expect(parentClick).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '私' })).not.toBeInTheDocument();
    expect(screen.getByText('わたし')).not.toHaveClass('opacity-0');
  });

  it('preserves full furigana when known-kanji data is not active', () => {
    renderWithKnownKanji('私[わたし]', ['私'], false);

    expect(screen.getByText('わたし')).not.toHaveClass('opacity-0');
  });

  it('does not hide readings on segments without kanji', () => {
    renderWithKnownKanji('今日[きょう]は パーティー[ぱーてぃー]', ['今', '日']);

    expect(screen.getByText('きょう')).toHaveClass('opacity-0');
    expect(screen.getByText('ぱーてぃー')).not.toHaveClass('opacity-0');
  });
});
