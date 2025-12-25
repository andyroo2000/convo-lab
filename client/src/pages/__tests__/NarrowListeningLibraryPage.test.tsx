import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NarrowListeningLibraryPage from '../NarrowListeningLibraryPage';

// Mock fetch
global.fetch = vi.fn();

describe('NarrowListeningLibraryPage', () => {
  const mockPacks = [
    {
      id: 'pack-1',
      title: 'A Day at the Office',
      topic: 'Tanaka working in an office',
      targetLanguage: 'ja',
      jlptLevel: 'N4',
      hskLevel: null,
      status: 'ready',
      createdAt: '2024-01-15T10:00:00Z',
      versions: [
        { id: 'v1', title: 'Version 1', variationType: 'casual' },
        { id: 'v2', title: 'Version 2', variationType: 'polite' },
      ],
    },
    {
      id: 'pack-2',
      title: 'Weekend Shopping',
      topic: 'Shopping at a mall',
      targetLanguage: 'zh',
      jlptLevel: null,
      hskLevel: 'HSK3',
      status: 'generating',
      createdAt: '2024-01-16T10:00:00Z',
      versions: [],
    },
  ];

  const renderPage = () => render(
      <BrowserRouter>
        <NarrowListeningLibraryPage />
      </BrowserRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPacks),
    });
  });

  describe('loading state', () => {
    it('should show loading spinner initially', () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const { container } = renderPage();
      const loader = container.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('should render the page title', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Narrow Listening')).toBeInTheDocument();
      });
    });

    it('should render the subtitle', async () => {
      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText('Practice with story variations at your level')
        ).toBeInTheDocument();
      });
    });

    it('should render Create Pack button', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Create Pack')).toBeInTheDocument();
      });
    });
  });

  describe('pack list', () => {
    it('should render pack titles', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('A Day at the Office')).toBeInTheDocument();
        expect(screen.getByText('Weekend Shopping')).toBeInTheDocument();
      });
    });

    it('should render pack topics', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Tanaka working in an office')).toBeInTheDocument();
        expect(screen.getByText('Shopping at a mall')).toBeInTheDocument();
      });
    });

    it('should render language badges', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Japanese')).toBeInTheDocument();
        expect(screen.getByText('Chinese')).toBeInTheDocument();
      });
    });

    it('should render level badges', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('N4')).toBeInTheDocument();
        expect(screen.getByText('HSK3')).toBeInTheDocument();
      });
    });

    it('should render variation counts', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('2 variations')).toBeInTheDocument();
        expect(screen.getByText('0 variations')).toBeInTheDocument();
      });
    });
  });

  describe('status badges', () => {
    it('should render Ready status for completed packs', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument();
      });
    });

    it('should render Generating status for in-progress packs', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Generating')).toBeInTheDocument();
      });
    });

    it('should render Error status for failed packs', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { ...mockPacks[0], status: 'error' },
          ]),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show empty state when no packs exist', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('No packs yet')).toBeInTheDocument();
      });
    });

    it('should show helpful message in empty state', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText(
            'Create your first narrow listening pack to start practicing with story variations'
          )
        ).toBeInTheDocument();
      });
    });

    it('should show Create Your First Pack button in empty state', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Create Your First Pack')).toBeInTheDocument();
      });
    });
  });

  describe('error state', () => {
    it('should show error message when fetch fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch packs')).toBeInTheDocument();
      });
    });

    it('should show Try Again button on error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('should fetch packs on mount', async () => {
      renderPage();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/narrow-listening'),
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });
  });

  describe('date formatting', () => {
    it('should display formatted creation dates', async () => {
      renderPage();

      await waitFor(() => {
        // The date format depends on locale, so just check the element exists
        const dateElements = screen.getAllByText(/\d+\/\d+\/\d+/);
        expect(dateElements.length).toBeGreaterThan(0);
      });
    });
  });
});
