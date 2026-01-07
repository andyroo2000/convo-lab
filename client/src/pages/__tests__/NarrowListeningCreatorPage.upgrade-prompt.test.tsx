import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NarrowListeningCreatorPage from '../NarrowListeningCreatorPage';

// Mock hooks and context
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      preferredStudyLanguage: 'ja',
      preferredNativeLanguage: 'en',
    },
  }),
}));

vi.mock('../../hooks/useLibraryData', () => ({
  useInvalidateLibrary: () => vi.fn(),
}));

vi.mock('../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

// Mock DemoRestrictionModal
vi.mock('../../components/common/DemoRestrictionModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="demo-restriction-modal">
        <button type="button" onClick={onClose} data-testid="close-demo-modal">
          Close
        </button>
      </div>
    ) : null,
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NarrowListeningCreatorPage - Upgrade Prompt', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <NarrowListeningCreatorPage />
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          jobId: 'job-123',
          packId: 'pack-123',
        }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not show upgrade prompt initially', () => {
    renderPage();
    expect(screen.queryByText(/Quota Limit Reached/i)).not.toBeInTheDocument();
  });

  it('should show upgrade prompt when API returns 429 with quota metadata', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          message: 'Quota exceeded',
          metadata: {
            quota: {
              used: 5,
              limit: 5,
              remaining: 0,
              resetsAt: '2026-02-01T00:00:00.000Z',
            },
          },
        }),
    });

    renderPage();

    // Fill in required field
    const topicInput = screen.getByLabelText(/what's your story about/i);
    fireEvent.change(topicInput, { target: { value: 'Japanese daily life' } });

    // Click generate button
    const generateButton = screen.getByText(/generate pack/i);
    fireEvent.click(generateButton);

    // Modal should appear
    expect(screen.getByText(/Quota Limit Reached/i)).toBeInTheDocument();
    expect(screen.getByText(/You've used 5 of 5 generations/)).toBeInTheDocument();
  });

  it('should not show upgrade prompt for non-429 errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({
          message: 'Server error',
        }),
    });

    renderPage();

    const topicInput = screen.getByLabelText(/what's your story about/i);
    fireEvent.change(topicInput, { target: { value: 'Japanese daily life' } });

    const generateButton = screen.getByText(/generate pack/i);
    fireEvent.click(generateButton);

    expect(screen.queryByText(/Quota Limit Reached/i)).not.toBeInTheDocument();
  });

  it('should not show upgrade prompt when metadata has no quota field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          message: 'Quota exceeded',
          metadata: {
            // No quota field
          },
        }),
    });

    renderPage();

    const topicInput = screen.getByLabelText(/what's your story about/i);
    fireEvent.change(topicInput, { target: { value: 'Japanese daily life' } });

    const generateButton = screen.getByText(/generate pack/i);
    fireEvent.click(generateButton);

    expect(screen.queryByText(/Quota Limit Reached/i)).not.toBeInTheDocument();
  });

  it('should close upgrade prompt when close button clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          message: 'Quota exceeded',
          metadata: {
            quota: {
              used: 5,
              limit: 5,
              remaining: 0,
              resetsAt: '2026-02-01T00:00:00.000Z',
            },
          },
        }),
    });

    renderPage();

    const topicInput = screen.getByLabelText(/what's your story about/i);
    fireEvent.change(topicInput, { target: { value: 'Japanese daily life' } });

    const generateButton = screen.getByText(/generate pack/i);
    fireEvent.click(generateButton);

    expect(screen.getByText(/Quota Limit Reached/i)).toBeInTheDocument();

    // Click close button
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    // Modal should be hidden
    expect(screen.queryByText(/Quota Limit Reached/i)).not.toBeInTheDocument();
  });

  it('should pass correct quota values to UpgradePrompt', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          message: 'Quota exceeded',
          metadata: {
            quota: {
              used: 3,
              limit: 5,
              remaining: 2,
              resetsAt: '2026-02-01T00:00:00.000Z',
            },
          },
        }),
    });

    renderPage();

    const topicInput = screen.getByLabelText(/what's your story about/i);
    fireEvent.change(topicInput, { target: { value: 'Japanese daily life' } });

    const generateButton = screen.getByText(/generate pack/i);
    fireEvent.click(generateButton);

    // Check that correct quota values are displayed
    expect(screen.getByText(/You've used 3 of 5 generations/)).toBeInTheDocument();
  });
});
