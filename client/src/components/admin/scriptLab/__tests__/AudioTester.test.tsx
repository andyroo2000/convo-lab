import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AudioTester from '../AudioTester';

vi.mock('../../../common/VoicePreview', () => ({ default: () => null }));

const errorResponse = (): Response =>
  new Response(
    JSON.stringify({ error: { message: 'Pronunciation test is temporarily unavailable' } }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );

describe('AudioTester', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['Generate Audio', 'Generate All 4 Formats'])(
    'shows the server error contract when %s fails',
    async (buttonName) => {
      const fetchMock = vi.fn().mockImplementation(async () => errorResponse());
      vi.stubGlobal('fetch', fetchMock);
      const onResultsChange = vi.fn();
      render(<AudioTester onResultsChange={onResultsChange} />);

      fireEvent.change(screen.getByLabelText(/Japanese Text/), {
        target: { value: '東京' },
      });
      fireEvent.click(screen.getByRole('button', { name: buttonName }));

      expect(
        await screen.findByText('Pronunciation test is temporarily unavailable')
      ).toBeInTheDocument();
      await waitFor(() => expect(onResultsChange).toHaveBeenCalledWith(null));
      expect(fetchMock).toHaveBeenCalled();
    }
  );
});
