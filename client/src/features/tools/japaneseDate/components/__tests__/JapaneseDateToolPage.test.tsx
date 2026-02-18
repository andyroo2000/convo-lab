import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import JapaneseDateToolPage from '../JapaneseDateToolPage';

const mockBuildDateAudioClipUrls = vi.hoisted(() => vi.fn());
const mockPlayDateAudioClipSequence = vi.hoisted(() => vi.fn());

vi.mock('../../logic/readingEngine', () => ({
  toLocalDateInputValue: () => '2026-02-10',
  parseLocalDateTimeInput: () => new Date('2026-02-10T09:00:00.000Z'),
  generateJapaneseDateTimeReading: () => ({
    parts: {
      yearScript: '二千二十六年',
      yearKana: 'にせんにじゅうろくねん',
      monthScript: '二月',
      monthKana: 'にがつ',
      dayScript: '十日',
      dayKana: 'とおか',
      periodKana: '',
    },
  }),
}));

vi.mock('../../logic/preRenderedDateAudio', () => ({
  buildDateAudioClipUrls: mockBuildDateAudioClipUrls,
  getDateAudioYearRange: () => ({ minYear: 2010, maxYear: 2026 }),
  playDateAudioClipSequence: mockPlayDateAudioClipSequence,
}));

describe('JapaneseDateToolPage', () => {
  beforeEach(() => {
    mockBuildDateAudioClipUrls.mockReturnValue(['/audio/year.mp3', '/audio/day.mp3']);
    mockPlayDateAudioClipSequence.mockReturnValue({
      stop: vi.fn(),
      finished: Promise.resolve(),
      setVolume: vi.fn(),
    });
  });

  it('supports keyboard next and previous navigation', () => {
    render(<JapaneseDateToolPage />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(mockPlayDateAudioClipSequence).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /advance to the next item/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });
});
