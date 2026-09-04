import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { resetAdminPageMocks, renderPage, mockStats } from './AdminPageTestHarness';

describe('AdminPage analytics', () => {
  beforeEach(resetAdminPageMocks);

  describe('analytics tab', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('/api/convolab/admin/stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStats),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should fetch and display analytics stats', async () => {
      renderPage('analytics');

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument(); // users
        expect(screen.getByText('523')).toBeInTheDocument(); // episodes
        expect(screen.getByText('234')).toBeInTheDocument(); // courses
      });
    });

    it('should display invite codes stats', async () => {
      renderPage('analytics');

      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument(); // total
        expect(screen.getByText('30')).toBeInTheDocument(); // used
        expect(screen.getByText('20')).toBeInTheDocument(); // available
      });
    });

    it('should show loading state while fetching analytics', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

      renderPage('analytics');

      expect(screen.getByText('Loading stats...')).toBeInTheDocument();
    });

    it('aborts the analytics read when the page unmounts', async () => {
      let requestSignal: AbortSignal | undefined;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            requestSignal = init?.signal ?? undefined;
            requestSignal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted.', 'AbortError')),
              { once: true }
            );
          })
      );

      const view = renderPage('analytics');
      await waitFor(() => expect(requestSignal).toBeDefined());
      expect(requestSignal?.aborted).toBe(false);

      view.unmount();

      expect(requestSignal?.aborted).toBe(true);
    });
  });
});
