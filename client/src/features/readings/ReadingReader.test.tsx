import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReadingReader from './ReadingReader';
import { getReadingAudio } from './readingsApi';
import type { ReadingDetail } from './types';

vi.mock('./readingsApi', () => ({ getReadingAudio: vi.fn() }));

class FakeAudio {
  static instances: FakeAudio[] = [];

  paused = true;

  ended = false;

  currentTime = 0;

  src = '';

  onended: (() => void) | null = null;

  onerror: (() => void) | null = null;

  play = vi.fn(async () => {
    this.paused = false;
  });

  pause = vi.fn(() => {
    this.paused = true;
  });

  removeAttribute = vi.fn();

  constructor() {
    FakeAudio.instances.push(this);
  }
}

const reading: ReadingDetail = {
  id: 'book',
  title: 'Story',
  author: 'Author',
  pageCount: 2,
  voiceName: 'Sato',
  illustrationUrl: null,
  document: {
    title: 'Story',
    author: 'Author',
    pages: [
      {
        number: 5,
        kind: 'text',
        columns: [
          [
            [0, '犬[いぬ]です。'],
            [1, 'ねこです。'],
          ],
        ],
      },
      { number: 6, kind: 'text', columns: [[[2, 'おしまい。']]] },
    ],
    sentences: [
      { text: '犬です。', translation: 'It is a dog.' },
      { text: 'ねこです。', translation: 'It is a cat.' },
      { text: 'おしまい。', translation: 'The end.' },
    ],
  },
};

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal('Audio', FakeAudio);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sentence');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.mocked(getReadingAudio).mockResolvedValue(new Blob(['audio']));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function selectDog() {
  fireEvent.click(screen.getByRole('button', { name: '犬です。' }));
}

function space() {
  fireEvent.keyDown(window, { key: ' ' });
}

describe('private reading interactions', () => {
  it('preserves keyboard behavior for controls outside the reader and text inputs', () => {
    render(
      <>
        <button type="button">Account menu</button>
        <input aria-label="Search" />
        <ReadingReader reading={reading} />
      </>
    );
    selectDog();
    const menu = screen.getByRole('button', { name: 'Account menu' });
    expect(fireEvent.keyDown(menu, { key: ' ' })).toBe(true);
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowLeft' })).toBe(true);
    expect(getReadingAudio).not.toHaveBeenCalled();
    expect(screen.getByText('Page 5 · 1 of 2')).toBeInTheDocument();
  });

  it('keeps printed furigana and highlights on hover without showing playback or translation', () => {
    render(<ReadingReader reading={reading} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: '犬です。' }));
    expect(screen.getByText('いぬ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '犬です。' })).toHaveClass('is-highlighted');
    expect(screen.queryByRole('button', { name: 'Play sentence' })).not.toBeInTheDocument();
    expect(screen.queryByText('It is a dog.')).not.toBeInTheDocument();
    selectDog();
    const sidebar = screen.getByRole('complementary');
    expect(within(sidebar).getByText('It is a dog.')).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Play sentence' })).toBeInTheDocument();
  });

  it('uses Space for the selected sentence and resumes the same audio after pause', async () => {
    render(<ReadingReader reading={reading} />);
    selectDog();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'ねこです。' }));
    space();
    await screen.findByRole('button', { name: 'Pause sentence' });
    expect(getReadingAudio).toHaveBeenCalledWith('book', 0, expect.any(AbortSignal));
    const player = FakeAudio.instances.at(-1)!;
    player.currentTime = 2;
    space();
    expect(screen.getByRole('button', { name: 'Play sentence' })).toBeInTheDocument();
    expect(player.paused).toBe(true);
    space();
    await screen.findByRole('button', { name: 'Pause sentence' });
    expect(player.currentTime).toBe(2);
    expect(getReadingAudio).toHaveBeenCalledTimes(1);
  });

  it('turns pages with arrows, clears the selection and stops playback', async () => {
    render(<ReadingReader reading={reading} />);
    selectDog();
    space();
    await screen.findByRole('button', { name: 'Pause sentence' });
    const player = FakeAudio.instances.at(-1)!;
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Page 6 · 2 of 2')).toBeInTheDocument();
    expect(player.paused).toBe(true);
    expect(screen.queryByText('It is a dog.')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Page 6 · 2 of 2')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Page 5 · 1 of 2')).toBeInTheDocument();
  });

  it('turns through an illustration page and selects printed notes on the final page', () => {
    const extended: ReadingDetail = {
      ...reading,
      pageCount: 3,
      document: {
        ...reading.document,
        pages: [
          reading.document.pages[0],
          {
            number: 8,
            kind: 'illustration',
            columns: [],
            imageUrl: '/private-illustration.jpg',
            imageAspectRatio: 0.75,
          },
          { ...reading.document.pages[1], number: 20, notes: [[2, 'おしまい。']] },
        ],
      },
    };
    render(<ReadingReader reading={extended} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('img', { name: 'Book illustration — page 8' })).toHaveAttribute(
      'src',
      '/private-illustration.jpg'
    );
    expect(screen.queryByRole('button', { name: 'Play sentence' })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    const notes = screen.getByRole('complementary', { name: 'Printed vocabulary notes' });
    fireEvent.click(within(notes).getByRole('button', { name: 'おしまい。' }));
    expect(screen.getByText('The end.')).toBeInTheDocument();
    expect(screen.getByText('Page 20 · 3 of 3')).toBeInTheDocument();
  });

  it('discards pending audio when the selected sentence changes', async () => {
    let resolveAudio!: (blob: Blob) => void;
    vi.mocked(getReadingAudio).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAudio = resolve;
        })
    );
    render(<ReadingReader reading={reading} />);
    selectDog();
    space();
    await waitFor(() => expect(getReadingAudio).toHaveBeenCalledTimes(1));
    const player = FakeAudio.instances.at(-1)!;
    fireEvent.click(screen.getByRole('button', { name: 'ねこです。' }));
    expect(vi.mocked(getReadingAudio).mock.calls[0][2].aborted).toBe(true);
    await act(async () => resolveAudio(new Blob(['old audio'])));
    expect(player.play).not.toHaveBeenCalled();
    expect(screen.getByText('It is a cat.')).toBeInTheDocument();
  });
});
