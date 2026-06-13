import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from '../../config';
import ScriptCreatorPage from '../ScriptCreatorPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

vi.mock('../../components/common/VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => (
    <div data-testid="voice-preview">Preview {voiceId}</div>
  ),
}));

global.fetch = vi.fn();

function mockJsonResponse(payload: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(payload),
  } as Response);
}

describe('ScriptCreatorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates, annotates, queues images before audio, and navigates when ready', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockJsonResponse({ id: 'episode-1' }))
      .mockResolvedValueOnce(mockJsonResponse({ id: 'script-1' }))
      .mockResolvedValueOnce(mockJsonResponse({ jobId: 'image-job-1' }))
      .mockResolvedValueOnce(mockJsonResponse({ jobId: 'render-job-1' }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 'ready',
          imageStatus: 'ready',
          segments: [{ id: 'segment-1', imageStatus: 'ready', imageMediaId: 'media-1' }],
          renders: [{ status: 'ready' }, { status: 'ready' }, { status: 'ready' }],
        })
      );

    render(
      <MemoryRouter>
        <ScriptCreatorPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId('script-input-source-text'), {
      target: { value: '日本に住んでいます。' },
    });
    fireEvent.click(screen.getByTestId('script-button-generate'));

    expect(await screen.findByText('Generating script')).toBeTruthy();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/app/playback/episode-1');
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `${API_URL}/api/scripts`,
      expect.objectContaining({ method: 'POST' })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `${API_URL}/api/scripts/episode-1/annotate`,
      expect.objectContaining({ method: 'POST' })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      `${API_URL}/api/scripts/episode-1/images`,
      expect.objectContaining({ method: 'POST' })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      4,
      `${API_URL}/api/scripts/episode-1/render`,
      expect.objectContaining({ method: 'POST' })
    );
  });
});
