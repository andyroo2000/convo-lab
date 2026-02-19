import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import JapaneseTimePracticeToolPage from '../JapaneseTimePracticeToolPage';

const mockBuildTimeAudioClipUrls = vi.hoisted(() => vi.fn());
const mockPlayAudioClipSequence = vi.hoisted(() => vi.fn());

vi.mock('../../../japaneseDate/logic/readingEngine', () => ({
  toLocalDateInputValue: () => '2026-02-10',
  parseLocalDateTimeInput: () => new Date('2026-02-10T09:30:00.000Z'),
  generateJapaneseDateTimeReading: () => ({
    parts: {
      hourScript: '九時',
      hourKana: 'くじ',
      minuteScript: '三十分',
      minuteKana: 'さんじゅっぷん',
      periodKana: '',
    },
  }),
}));

vi.mock('../../../japaneseDate/logic/preRenderedTimeAudio', () => ({
  buildTimeAudioClipUrls: mockBuildTimeAudioClipUrls,
  playAudioClipSequence: mockPlayAudioClipSequence,
}));

describe('JapaneseTimePracticeToolPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockBuildTimeAudioClipUrls.mockReturnValue(['/audio/hour.mp3', '/audio/minute.mp3']);
    mockPlayAudioClipSequence.mockReturnValue({
      stop: vi.fn(),
      finished: Promise.resolve(),
      setVolume: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('reveals answer and advances manually in random mode', async () => {
    render(<JapaneseTimePracticeToolPage />);

    const showAnswerButton = screen.getByRole('button', { name: /show answer/i });
    fireEvent.click(showAnswerButton);

    expect(mockBuildTimeAudioClipUrls).toHaveBeenCalledTimes(1);
    expect(mockPlayAudioClipSequence).toHaveBeenCalledTimes(1);

    const nextButton = screen.getByRole('button', { name: /advance to the next item/i });
    fireEvent.click(nextButton);

    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('supports keyboard next and previous navigation', () => {
    render(<JapaneseTimePracticeToolPage />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /advance to the next item/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('runs autoplay loop timers in random mode', async () => {
    vi.useFakeTimers();
    render(<JapaneseTimePracticeToolPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Auto-Play' }));
    expect(mockPlayAudioClipSequence).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(mockPlayAudioClipSequence.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not render mode or display controls', () => {
    render(<JapaneseTimePracticeToolPage />);

    expect(screen.queryByText('Mode')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'FSRS' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Script' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Digital' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Furigana' })).not.toBeInTheDocument();
  });
});
