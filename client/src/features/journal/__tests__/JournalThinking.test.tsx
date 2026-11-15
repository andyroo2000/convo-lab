import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useReducedMotion } from 'framer-motion';
import JournalThinking from '../JournalThinking';
import { nextWaitingPhrase, shuffled, waitingPhrases } from '../journalThinkingContent';
import { thinkingIllustrations } from '../journalThinkingIllustrations';

vi.mock('framer-motion', async (original) => ({
  ...(await original<typeof import('framer-motion')>()),
  useReducedMotion: vi.fn(() => true),
}));

it('keeps English toggle and stable accessible status with reduced motion', () => {
  render(<JournalThinking />);
  expect(useReducedMotion).toHaveBeenCalled();
  const { english } = waitingPhrases.find((phrase) => screen.queryByText(phrase.english))!;
  expect(english).toBeTruthy();
  expect(screen.getByRole('status')).toHaveTextContent('Your writing is saved.');
  fireEvent.click(screen.getByRole('button', { name: 'Hide English' }));
  expect(screen.queryByText(english)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show English' }));
  expect(screen.getByText(english)).toBeInTheDocument();
});

it('rotates all forty items in disjoint decks and avoids consecutive phrase repeats', () => {
  const deck = shuffled(thinkingIllustrations.map((_, index) => index));
  expect(deck).toHaveLength(40);
  expect(new Set(deck).size).toBe(40);
  expect(waitingPhrases).toHaveLength(8);
  let previous = nextWaitingPhrase();
  for (let index = 0; index < 50; index += 1) {
    const next = nextWaitingPhrase();
    expect(next).not.toBe(previous);
    previous = next;
  }
});
