import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CourseGenerator from '../CourseGenerator';

// Mock hooks and context
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      preferredStudyLanguage: 'ja',
      preferredNativeLanguage: 'en',
    },
  }),
}));

vi.mock('../../../hooks/useLibraryData', () => ({
  useInvalidateLibrary: () => vi.fn(),
}));

vi.mock('../../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

// Mock shared voice selection
vi.mock('../../../../../shared/src/voiceSelection', () => ({
  getCourseSpeakerVoices: () => ({
    narratorVoice: 'ja-voice-narrator',
    speakerVoices: ['ja-voice-1', 'ja-voice-2'],
  }),
}));

// Mock TTS voices constants
vi.mock('../../../../../shared/src/constants-new', () => ({
  TTS_VOICES: {
    ja: [
      { id: 'ja-voice-1', name: 'Voice 1', gender: 'male' },
      { id: 'ja-voice-2', name: 'Voice 2', gender: 'female' },
    ],
    en: [
      { id: 'en-voice-1', name: 'Voice 1', gender: 'male' },
      { id: 'en-voice-2', name: 'Voice 2', gender: 'female' },
    ],
  },
}));

// Mock DemoRestrictionModal
vi.mock('../../common/DemoRestrictionModal', () => ({
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

describe('CourseGenerator - Upgrade Prompt', () => {
  const renderCourseGenerator = () =>
    render(
      <MemoryRouter>
        <CourseGenerator />
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'course-123',
          title: 'Test Course',
        }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not show upgrade prompt initially', () => {
    renderCourseGenerator();
    expect(screen.queryByText(/Quota Limit Reached/i)).not.toBeInTheDocument();
  });

  it('should show upgrade prompt when API returns 429 with quota metadata', async () => {
    // First call: create course (succeeds)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'course-123',
          title: 'My Course',
        }),
    });

    // Second call: generate course (fails with quota error)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          error: 'Quota exceeded',
          quota: {
            used: 5,
            limit: 5,
            resetsAt: '2026-02-01T00:00:00.000Z',
          },
        }),
    });

    renderCourseGenerator();

    // Fill in required fields
    const titleInput = screen.getByLabelText(/audio course title/i);
    const contentInput = screen.getByLabelText(/your story or experience/i);

    fireEvent.change(titleInput, { target: { value: 'My Course' } });
    fireEvent.change(contentInput, { target: { value: 'Course description' } });

    // Click create button
    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    // Modal should appear
    expect(screen.getByText(/Quota Limit Reached/i)).toBeInTheDocument();
    expect(screen.getByText(/You've used 5 of 5 generations/)).toBeInTheDocument();
  });

  it('should not show upgrade prompt for non-429 errors', async () => {
    // First call: create course (succeeds)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'course-123',
          title: 'My Course',
        }),
    });

    // Second call: generate course (fails with server error)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({
          error: 'Server error',
        }),
    });

    renderCourseGenerator();

    const titleInput = screen.getByLabelText(/audio course title/i);
    const contentInput = screen.getByLabelText(/your story or experience/i);

    fireEvent.change(titleInput, { target: { value: 'My Course' } });
    fireEvent.change(contentInput, { target: { value: 'Course description' } });

    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    expect(screen.queryByText(/Quota Limit Reached/i)).not.toBeInTheDocument();
  });

  it('should not show upgrade prompt when errorMetadata has no quota field', async () => {
    // First call: create course (succeeds)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'course-123',
          title: 'My Course',
        }),
    });

    // Second call: generate course (429 but no quota field)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          error: 'Quota exceeded',
          // No quota field
        }),
    });

    renderCourseGenerator();

    const titleInput = screen.getByLabelText(/audio course title/i);
    const contentInput = screen.getByLabelText(/your story or experience/i);

    fireEvent.change(titleInput, { target: { value: 'My Course' } });
    fireEvent.change(contentInput, { target: { value: 'Course description' } });

    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    expect(screen.queryByText(/Quota Limit Reached/i)).not.toBeInTheDocument();
  });

  it('should close upgrade prompt when close button clicked', async () => {
    // First call: create course (succeeds)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'course-123',
          title: 'My Course',
        }),
    });

    // Second call: generate course (fails with quota error)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          error: 'Quota exceeded',
          quota: {
            used: 5,
            limit: 5,
            resetsAt: '2026-02-01T00:00:00.000Z',
          },
        }),
    });

    renderCourseGenerator();

    const titleInput = screen.getByLabelText(/audio course title/i);
    const contentInput = screen.getByLabelText(/your story or experience/i);

    fireEvent.change(titleInput, { target: { value: 'My Course' } });
    fireEvent.change(contentInput, { target: { value: 'Course description' } });

    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    expect(screen.getByText(/Quota Limit Reached/i)).toBeInTheDocument();

    // Click close button
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    // Modal should be hidden
    expect(screen.queryByText(/Quota Limit Reached/i)).not.toBeInTheDocument();
  });

  it('should pass correct quota values to UpgradePrompt', async () => {
    // First call: create course (succeeds)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'course-123',
          title: 'My Course',
        }),
    });

    // Second call: generate course (fails with quota error)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({
          error: 'Quota exceeded',
          quota: {
            used: 3,
            limit: 5,
            resetsAt: '2026-02-01T00:00:00.000Z',
          },
        }),
    });

    renderCourseGenerator();

    const titleInput = screen.getByLabelText(/audio course title/i);
    const contentInput = screen.getByLabelText(/your story or experience/i);

    fireEvent.change(titleInput, { target: { value: 'My Course' } });
    fireEvent.change(contentInput, { target: { value: 'Course description' } });

    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    // Check that correct quota values are displayed
    expect(screen.getByText(/You've used 3 of 5 generations/)).toBeInTheDocument();
  });
});
