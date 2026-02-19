import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import JapaneseCounterPracticeToolPage from '../JapaneseCounterPracticeToolPage';

const counterPracticeMocks = vi.hoisted(() => {
  const makeCard = (overrides: Record<string, unknown> = {}) => ({
    id: 'test-card',
    counterId: 'hon',
    counterSymbol: '本',
    counterKana: 'ほん',
    counterHint: 'long objects',
    quantity: 5,
    countScript: '五本',
    countKana: 'ごほん',
    particle: 'を',
    object: {
      id: 'pencil',
      counterId: 'hon',
      script: '鉛筆',
      kana: 'えんぴつ',
      englishLabel: 'pencil',
      illustrationId: 'pencil',
    },
    ...overrides,
  });

  const state = {
    card: makeCard(),
  };

  const createCard = vi.fn(() => state.card);

  return {
    makeCard,
    state,
    createCard,
  };
});

const counterAudioMocks = vi.hoisted(() => {
  const playCounterAudioClip = vi.fn(() => ({
    stop: vi.fn(),
    finished: Promise.resolve(),
    setVolume: vi.fn(),
  }));

  return {
    playCounterAudioClip,
  };
});

vi.mock('../../logic/counterPractice', () => ({
  COUNTER_POOL: [
    { id: 'mai', symbol: '枚', hint: 'flat things' },
    { id: 'hon', symbol: '本', hint: 'long objects' },
    { id: 'hiki', symbol: '匹', hint: 'small animals' },
    { id: 'kai', symbol: '階', hint: 'floors of buildings' },
  ],
  DEFAULT_COUNTER_IDS: ['hon'],
  toggleCounterSelection: (current: string[], counterId: string) => {
    if (current.includes(counterId)) {
      if (current.length > 1) {
        return current.filter((id) => id !== counterId);
      }
      return current;
    }
    return [...current, counterId];
  },
  createCounterPracticeCard: counterPracticeMocks.createCard,
}));

vi.mock('../../logic/preRenderedCounterAudio', () => ({
  playCounterAudioClip: counterAudioMocks.playCounterAudioClip,
}));

describe('JapaneseCounterPracticeToolPage', () => {
  beforeEach(() => {
    counterPracticeMocks.state.card = counterPracticeMocks.makeCard();
    counterPracticeMocks.createCard.mockClear();
    counterAudioMocks.playCounterAudioClip.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows stairs cue when floor counter card is active', () => {
    counterPracticeMocks.state.card = counterPracticeMocks.makeCard({
      counterId: 'kai',
      counterSymbol: '階',
      counterKana: 'かい',
      counterHint: 'floors of buildings',
      countScript: '五階',
      countKana: 'ごかい',
      object: {
        id: 'apartment-floor',
        counterId: 'kai',
        script: 'アパート',
        kana: 'あぱーと',
        englishLabel: 'apartment floor',
        illustrationId: 'apartment-building',
        particle: 'の',
      },
      particle: 'の',
    });

    render(<JapaneseCounterPracticeToolPage />);
    expect(screen.getByTestId('floor-stairs-cue')).toBeInTheDocument();
  });

  it('reveals answer with ruby furigana', () => {
    render(<JapaneseCounterPracticeToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(screen.getByText('えんぴつ')).toBeInTheDocument();
    expect(screen.getByText('ごほん')).toBeInTheDocument();
    expect(screen.getByText('五本')).toBeInTheDocument();
    expect(screen.getByText('を')).toBeInTheDocument();
    expect(counterAudioMocks.playCounterAudioClip).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard next and previous navigation', () => {
    render(<JapaneseCounterPracticeToolPage />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /advance to the next item/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('shows countdown led count based on selected pause length', () => {
    render(<JapaneseCounterPracticeToolPage />);

    expect(screen.getAllByTestId('auto-loop-countdown-led')).toHaveLength(8);

    fireEvent.click(screen.getByRole('button', { name: '12' }));
    expect(screen.getAllByTestId('auto-loop-countdown-led')).toHaveLength(12);

    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getAllByTestId('auto-loop-countdown-led')).toHaveLength(5);
  });

  it('does not render furigana for katakana object words', () => {
    counterPracticeMocks.state.card = counterPracticeMocks.makeCard({
      object: {
        id: 'banana',
        counterId: 'hon',
        script: 'バナナ',
        kana: 'ばなな',
        englishLabel: 'banana',
        illustrationId: 'banana',
      },
    });

    render(<JapaneseCounterPracticeToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(screen.getByText('バナナ')).toBeInTheDocument();
    expect(screen.queryByText('ばなな')).not.toBeInTheDocument();
    expect(screen.getByText('ごほん')).toBeInTheDocument();
  });

  it('defaults to long objects and starts with auto-loop off', () => {
    render(<JapaneseCounterPracticeToolPage />);

    expect(screen.getByRole('button', { name: /本/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /枚/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /匹/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /階/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /auto-loop/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('does not allow deselecting all counters', () => {
    render(<JapaneseCounterPracticeToolPage />);

    const longObjects = screen.getByRole('button', { name: /本/i });
    fireEvent.click(longObjects);
    expect(longObjects).toHaveAttribute('aria-pressed', 'true');
  });

  it('reveals immediately on first power-on and waits timer on later power-ons', async () => {
    vi.useFakeTimers();
    render(<JapaneseCounterPracticeToolPage />);

    expect(screen.queryByText('五本')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /auto-loop/i }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('五本')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /stop loop/i }));
    fireEvent.click(screen.getByRole('button', { name: /advance to the next item/i }));
    expect(screen.queryByText('五本')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /auto-loop/i }));
    expect(screen.queryByText('五本')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7999);
    });
    expect(screen.queryByText('五本')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText('五本')).toBeInTheDocument();
  });
});
