import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CourseDetails from '../CourseDetails';

const readyCourse = {
  id: 'course-1',
  title: 'Train Station Japanese',
  status: 'ready',
  createdAt: '2026-09-04T12:00:00.000Z',
  hasExchanges: true,
  hasScript: true,
  hasAudio: false,
  sourceText: 'A short source passage',
  exchanges: [
    {
      speakerName: 'Aki',
      order: 1,
      textL2: '駅はどこですか。',
      readingL2: 'えきはどこですか。',
      translationL1: 'Where is the station?',
      vocabularyItems: [{ textL2: '駅', readingL2: 'えき', translationL1: 'station' }],
    },
  ],
  scriptUnits: [
    { type: 'narration_L1', text: 'Listen carefully.' },
    { type: 'L2', text: '駅はどこですか。', reading: 'えきはどこですか。', speed: 0.8 },
    { type: 'pause', durationSeconds: 2 },
    { type: 'marker', label: 'Repeat' },
  ],
};

function mockJsonResponse(body: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CourseDetails', () => {
  it('renders pipeline data and expands generated content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockJsonResponse(readyCourse)));

    render(<CourseDetails courseId="course-1" />);

    expect(await screen.findByText('Train Station Japanese')).toBeInTheDocument();
    expect(screen.getByText('A short source passage')).toBeInTheDocument();
    expect(screen.getByText('Dialogue Exchanges Generated')).toHaveClass('text-gray-900');
    expect(screen.getByText('Audio Assembled')).toHaveClass('text-gray-400');

    fireEvent.click(screen.getByRole('button', { name: 'Dialogue Exchanges (1)' }));
    expect(screen.getByText('駅はどこですか。')).toBeInTheDocument();
    expect(screen.getByText('= station')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lesson Script Units (4)' }));
    expect(screen.getByText('NARRATOR (English)')).toBeInTheDocument();
    expect(screen.getByText('JAPANESE (0.8x speed)')).toBeInTheDocument();
    expect(screen.getByText('PAUSE: 2s')).toBeInTheDocument();
    expect(screen.getByText('MARKER: Repeat')).toBeInTheDocument();
  });

  it('starts dialogue generation for a draft without exchanges', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({ ...readyCourse, status: 'draft', hasExchanges: false, exchanges: [] })
      )
      .mockResolvedValueOnce(mockJsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    render(<CourseDetails courseId="course-1" />);
    const generateButton = await screen.findByRole('button', {
      name: 'Generate Dialogue Exchanges',
    });
    const realSetTimeout = globalThis.setTimeout.bind(globalThis);
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler, timeout, ...args) => {
      if (timeout === 3000) return undefined as unknown as ReturnType<typeof setTimeout>;
      return realSetTimeout(handler, timeout, ...args);
    });
    fireEvent.click(generateButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(await screen.findByText(/Dialogue generation started/)).toBeInTheDocument();
  });

  it('shows a failed course request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockJsonResponse({}, false)));

    render(<CourseDetails courseId="course-1" />);

    expect(await screen.findByText('Failed to fetch course details')).toBeInTheDocument();
  });
});
