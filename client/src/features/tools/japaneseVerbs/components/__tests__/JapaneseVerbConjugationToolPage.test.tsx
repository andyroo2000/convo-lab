import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import JapaneseVerbConjugationToolPage from '../JapaneseVerbConjugationToolPage';

const verbConjugationMocks = vi.hoisted(() => {
  const makeCard = (overrides: Record<string, unknown> = {}) => ({
    id: 'test-verb-card',
    verb: {
      id: 'miru',
      dictionary: '見る',
      reading: 'みる',
      meaning: 'to see; to watch',
      jlptLevel: 'N5',
      group: '2',
    },
    conjugation: {
      id: 'potential-colloquial',
      label: 'Potential (Colloquial)',
      conjugationBadge: 'potential',
      registers: ['spoken', 'colloquial'],
      promptHint: 'Use the colloquial ら抜き potential form on this card.',
    },
    answer: {
      script: '見れる',
      reading: 'みれる',
    },
    referenceAnswer: {
      script: '見られる',
      reading: 'みられる',
    },
    ...overrides,
  });

  const state: { card: ReturnType<typeof makeCard> | null } = {
    card: makeCard(),
  };

  const createCard = vi.fn(() => state.card);

  return {
    makeCard,
    state,
    createCard,
  };
});

const verbAudioMocks = vi.hoisted(() => {
  const stop = vi.fn();
  const setVolume = vi.fn();
  const playVerbAudioClip = vi.fn(() => ({
    stop,
    finished: Promise.resolve(),
    setVolume,
  }));

  return {
    playVerbAudioClip,
    stop,
    setVolume,
  };
});

vi.mock('../../logic/preRenderedVerbAudio', () => ({
  playVerbAudioClip: verbAudioMocks.playVerbAudioClip,
  buildVerbAudioClipUrl: vi.fn(
    () => '/tools-audio/japanese-verbs/google-kento-professional/miru/potential-colloquial.mp3'
  ),
}));

vi.mock('../../logic/verbConjugation', () => ({
  CONJUGATION_BADGE_LABELS: {
    present: 'Present',
    past: 'Past',
    'te-form': 'Te-form',
    negative: 'Negative',
    potential: 'Potential',
  },
  REGISTER_BADGE_LABELS: {
    formal: 'Formal',
    casual: 'Casual',
    spoken: 'Spoken',
    colloquial: 'Colloquial',
  },
  JLPT_LEVEL_OPTIONS: ['N5', 'N4'],
  VERB_GROUP_OPTIONS: ['1', '2', '3'],
  VERB_CONJUGATION_OPTIONS: [
    {
      id: 'present-polite',
      label: 'Present Polite',
      registers: ['formal'],
      conjugationBadge: 'present',
    },
    {
      id: 'potential-colloquial',
      label: 'Potential (Colloquial)',
      registers: ['spoken', 'colloquial'],
      conjugationBadge: 'potential',
      promptHint: 'Use the colloquial ら抜き potential form on this card.',
    },
  ],
  DEFAULT_JLPT_LEVELS: ['N5'],
  DEFAULT_VERB_GROUPS: ['1', '2', '3'],
  DEFAULT_CONJUGATION_IDS: ['potential-colloquial'],
  toggleSelection: (current: string[], value: string) => {
    if (current.includes(value)) {
      if (current.length === 1) {
        return [...current];
      }
      return current.filter((entry) => entry !== value);
    }

    return [...current, value];
  },
  createVerbPracticeCard: verbConjugationMocks.createCard,
}));

describe('JapaneseVerbConjugationToolPage', () => {
  beforeEach(() => {
    window.localStorage.removeItem('convolab:japanese-verbs:show-furigana');
    verbConjugationMocks.createCard.mockClear();
    verbConjugationMocks.state.card = verbConjugationMocks.makeCard();
    verbAudioMocks.playVerbAudioClip.mockClear();
    verbAudioMocks.stop.mockClear();
    verbAudioMocks.setVolume.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders conjugation badges and colloquial hint but hides group/jlpt until reveal', () => {
    render(<JapaneseVerbConjugationToolPage />);
    const quizCard = screen.getByRole('region', { name: 'Verb conjugation quiz card' });
    const quizCardQueries = within(quizCard);

    expect(quizCardQueries.getByText('Spoken')).toBeInTheDocument();
    expect(quizCardQueries.getByText('Colloquial')).toBeInTheDocument();
    expect(quizCardQueries.getByText('Potential')).toBeInTheDocument();
    expect(screen.getByTestId('verb-colloquial-hint')).toBeInTheDocument();

    expect(quizCardQueries.queryByText('Group 2')).not.toBeInTheDocument();
    expect(quizCardQueries.queryByText('N5')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(quizCardQueries.getByText('Group 2')).toBeInTheDocument();
    expect(quizCardQueries.getByText('N5')).toBeInTheDocument();
  });

  it('reveals answer and textbook reference', () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(screen.getByText('れる')).toBeInTheDocument();
    expect(screen.getByText(/Textbook: 見られる/)).toBeInTheDocument();
  });

  it('shows furigana only for kanji and not okurigana', () => {
    render(<JapaneseVerbConjugationToolPage />);

    expect(screen.getAllByText('み')).toHaveLength(1);
    expect(screen.queryByText('みる')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getAllByText('み').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('れる')).toBeInTheDocument();
    expect(screen.queryByText('みれる')).not.toBeInTheDocument();
  });

  it('supports arrow key next and previous navigation', () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /advance to the next item/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('does not allow deselecting the only active JLPT level', () => {
    render(<JapaneseVerbConjugationToolPage />);

    const n5Button = screen.getByRole('button', { name: 'N5' });
    fireEvent.click(n5Button);

    expect(n5Button).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an empty state when filters produce no cards', () => {
    verbConjugationMocks.state.card = null;
    render(<JapaneseVerbConjugationToolPage />);

    expect(screen.getByText('No matching cards.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show answer/i })).toBeDisabled();
  });

  it('plays audio on manual reveal', async () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(verbAudioMocks.playVerbAudioClip).toHaveBeenCalledTimes(1);
    expect(verbAudioMocks.playVerbAudioClip).toHaveBeenCalledWith(
      expect.objectContaining({
        verb: expect.objectContaining({ id: 'miru' }),
        conjugation: expect.objectContaining({ id: 'potential-colloquial' }),
      }),
      expect.objectContaining({ volume: 1 })
    );
  });

  it('does not abort manual reveal playback while auto-loop is off', async () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(verbAudioMocks.playVerbAudioClip).toHaveBeenCalledTimes(1);
    expect(verbAudioMocks.stop).not.toHaveBeenCalled();
  });

  it('shows countdown led count based on selected pause length', () => {
    render(<JapaneseVerbConjugationToolPage />);

    expect(screen.getAllByTestId('auto-loop-countdown-led')).toHaveLength(8);

    fireEvent.click(screen.getByRole('button', { name: '12' }));
    expect(screen.getAllByTestId('auto-loop-countdown-led')).toHaveLength(12);

    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getAllByTestId('auto-loop-countdown-led')).toHaveLength(5);
  });

  it('defaults to auto-loop off', () => {
    render(<JapaneseVerbConjugationToolPage />);

    expect(screen.getByRole('button', { name: /auto-loop/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('reveals immediately on first power-on and waits timer on later power-ons', async () => {
    vi.useFakeTimers();
    render(<JapaneseVerbConjugationToolPage />);

    expect(screen.queryByText('れる')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /auto-loop/i }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('れる')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /stop loop/i }));
    fireEvent.click(screen.getByRole('button', { name: /advance to the next item/i }));
    expect(screen.queryByText('れる')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /auto-loop/i }));
    expect(screen.queryByText('れる')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7999);
    });
    expect(screen.queryByText('れる')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText('れる')).toBeInTheDocument();
  });

  it('clears active loop timers when powering off and unmounting', async () => {
    vi.useFakeTimers();
    const { unmount } = render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /auto-loop/i }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /stop loop/i }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(vi.getTimerCount()).toBe(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes volume level to audio playback', async () => {
    render(<JapaneseVerbConjugationToolPage />);

    const volumeSlider = screen.getByRole('slider', { name: /volume/i });
    fireEvent.change(volumeSlider, { target: { value: '50' } });

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(verbAudioMocks.playVerbAudioClip).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ volume: 0.5 })
    );
  });

  it('adjusts volume on active playback via setVolume', () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    const volumeSlider = screen.getByRole('slider', { name: /volume/i });
    fireEvent.change(volumeSlider, { target: { value: '30' } });

    expect(verbAudioMocks.setVolume).toHaveBeenCalledWith(0.3);
  });

  it('resets state when filters change', () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getByText('れる')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'N4' }));

    expect(screen.queryByText('れる')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('navigates back to previous card with history', () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getByText('れる')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /advance to the next item/i }));
    expect(screen.queryByText('れる')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('れる')).toBeInTheDocument();
  });

  it('stops playback when navigating to next card', () => {
    // Use a never-resolving promise so playbackRef stays set when we click next
    verbAudioMocks.playVerbAudioClip.mockReturnValueOnce({
      stop: verbAudioMocks.stop,
      finished: new Promise(() => {}),
      setVolume: verbAudioMocks.setVolume,
    });

    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    verbAudioMocks.stop.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /advance to the next item/i }));

    expect(verbAudioMocks.stop).toHaveBeenCalled();
  });

  it('reveals immediately on power-on after a filter change', async () => {
    vi.useFakeTimers();
    render(<JapaneseVerbConjugationToolPage />);

    // First power-on reveals immediately
    fireEvent.click(screen.getByRole('button', { name: /auto-loop/i }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('れる')).toBeInTheDocument();

    // Power off, advance past reveal
    fireEvent.click(screen.getByRole('button', { name: /stop loop/i }));
    fireEvent.click(screen.getByRole('button', { name: /advance to the next item/i }));

    // Change a filter — this should reset isFirstPowerOnRef
    fireEvent.click(screen.getByRole('button', { name: 'N4' }));

    // Power on again — should immediately reveal (not wait for timer)
    fireEvent.click(screen.getByRole('button', { name: /auto-loop/i }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('れる')).toBeInTheDocument();
  });

  it('shows status text during auto-loop countdown', async () => {
    vi.useFakeTimers();
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /auto-loop/i }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/next card in/)).toBeInTheDocument();
  });

  it('shows playback hint when audio fails with a non-abort error', async () => {
    const nonAbortError = new Error('Network failure');
    verbAudioMocks.playVerbAudioClip.mockReturnValueOnce({
      stop: verbAudioMocks.stop,
      finished: Promise.reject(nonAbortError),
      setVolume: verbAudioMocks.setVolume,
    });

    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/audio playback failed/i)).toBeInTheDocument();
  });

  it('shows furigana by default', () => {
    render(<JapaneseVerbConjugationToolPage />);

    const furiganaToggle = screen.getByRole('button', { name: /furigana/i });
    expect(furiganaToggle).toHaveAttribute('aria-pressed', 'true');
    expect(furiganaToggle).toHaveClass('is-on');

    // Dictionary form reading should not have the invisible class
    expect(screen.getByText('み')).not.toHaveClass('invisible');
  });

  it('hides furigana when toggle is clicked', () => {
    render(<JapaneseVerbConjugationToolPage />);

    const furiganaToggle = screen.getByRole('button', { name: /furigana/i });
    fireEvent.click(furiganaToggle);

    expect(furiganaToggle).toHaveAttribute('aria-pressed', 'false');
    expect(furiganaToggle).not.toHaveClass('is-on');

    // Dictionary form reading should be hidden via invisible class
    expect(screen.getByText('み')).toHaveClass('invisible');
  });

  it('hides furigana on revealed answer when toggle is off', () => {
    render(<JapaneseVerbConjugationToolPage />);

    // Turn off furigana first
    fireEvent.click(screen.getByRole('button', { name: /furigana/i }));

    // Reveal the answer
    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    // Both dictionary and answer readings should be invisible
    screen.getAllByText('み').forEach((element) => {
      expect(element).toHaveClass('invisible');
    });
  });

  it('re-shows furigana when toggle is clicked back on', () => {
    render(<JapaneseVerbConjugationToolPage />);

    const furiganaToggle = screen.getByRole('button', { name: /furigana/i });

    // Toggle off then on
    fireEvent.click(furiganaToggle);
    fireEvent.click(furiganaToggle);

    expect(furiganaToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('み')).not.toHaveClass('invisible');
  });

  it('persists furigana preference to localStorage', () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /furigana/i }));

    expect(window.localStorage.getItem('convolab:japanese-verbs:show-furigana')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: /furigana/i }));

    expect(window.localStorage.getItem('convolab:japanese-verbs:show-furigana')).toBe('true');
  });

  it('restores furigana preference from localStorage', () => {
    window.localStorage.setItem('convolab:japanese-verbs:show-furigana', 'false');

    render(<JapaneseVerbConjugationToolPage />);

    const furiganaToggle = screen.getByRole('button', { name: /furigana/i });
    expect(furiganaToggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('み')).toHaveClass('invisible');
  });

  it('does not show playback hint on abort error', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    verbAudioMocks.playVerbAudioClip.mockReturnValueOnce({
      stop: verbAudioMocks.stop,
      finished: Promise.reject(abortError),
      setVolume: verbAudioMocks.setVolume,
    });

    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText(/audio playback failed/i)).not.toBeInTheDocument();
  });
});
