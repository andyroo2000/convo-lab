import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useReducedMotion } from 'framer-motion';
import JournalThinking from '../JournalThinking';
import { nextWaitingPhrase, shuffled, waitingPhrases } from '../journalThinkingContent';
import { thinkingIllustrations } from '../journalThinkingIllustrations';

vi.mock('framer-motion', async (original) => ({
  ...(await original<typeof import('framer-motion')>()),
  useReducedMotion: vi.fn(() => true),
}));

it('always shows both languages without an English toggle and keeps accessible status', () => {
  const { rerender } = render(<JournalThinking />);
  expect(useReducedMotion).toHaveBeenCalled();
  const phrase = waitingPhrases.find((item) => screen.queryByText(item.english))!;
  expect(screen.getByText(phrase.japanese)).toBeVisible();
  expect(screen.getByText(phrase.english)).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Your writing is saved.');
  expect(screen.queryByRole('button', { name: /English/ })).not.toBeInTheDocument();
  rerender(<JournalThinking lastAnswer="My saved answer" />);
  expect(screen.getByText(phrase.english)).toBeVisible();
  expect(screen.getByText('My saved answer')).toBeVisible();
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
