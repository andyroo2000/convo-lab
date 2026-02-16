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

  it('runs autoplay loop timers in random mode', async () => {
    vi.useFakeTimers();
    render(<JapaneseTimePracticeToolPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Auto-Play' }));
    expect(mockPlayAudioClipSequence).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(mockPlayAudioClipSequence.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('shows FSRS grading controls after reveal', () => {
    render(<JapaneseTimePracticeToolPage />);

    fireEvent.click(screen.getByRole('button', { name: 'FSRS' }));
    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }));

    expect(screen.getByRole('button', { name: 'Again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Good' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto-Play (Random)' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Good' }));
    expect(screen.queryByRole('button', { name: 'Again' })).not.toBeInTheDocument();
  });
});
