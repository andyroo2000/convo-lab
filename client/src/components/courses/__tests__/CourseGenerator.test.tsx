import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '../../../test/utils';
import CourseGenerator from '../CourseGenerator';

const mockNavigate = vi.fn();
const mockInvalidateLibrary = vi.fn();
const mockFetch = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-123', role: 'user' } }),
}));

vi.mock('../../../hooks/useDemo', () => ({ useIsDemo: () => false }));
vi.mock('../../../hooks/useLibraryData', () => ({
  useInvalidateLibrary: () => mockInvalidateLibrary,
}));
vi.mock('../../../hooks/useEpisodes', () => ({
  useEpisodes: () => ({ getEpisode: vi.fn() }),
}));
vi.mock('../../common/VoicePreview', () => ({ default: () => null }));
vi.mock('../../common/DemoRestrictionModal', () => ({ default: () => null }));
vi.mock('../AdminScriptWorkbench', () => ({ default: () => null }));
vi.mock('../../../../../shared/src/voiceSelection', () => ({
  getCourseSpeakerVoices: () => ({
    narratorVoice: 'en-narrator',
    speakerVoices: ['ja-one', 'ja-two'],
  }),
  getSelectableTtsVoices: (language: string) =>
    language === 'en'
      ? [{ id: 'en-narrator', gender: 'female', provider: 'fishaudio', description: 'Narrator' }]
      : [
          { id: 'ja-one', gender: 'male', provider: 'fishaudio', description: 'One' },
          { id: 'ja-two', gender: 'female', provider: 'fishaudio', description: 'Two' },
        ],
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderCourseGenerator() {
  return render(
    <MemoryRouter>
      <CourseGenerator />
    </MemoryRouter>
  );
}

describe('CourseGenerator paid submission intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('11111111-1111-4111-8111-111111111111'),
    });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ id: '11111111-1111-4111-8111-111111111111' }))
      .mockResolvedValueOnce(
        jsonResponse({
          clientRequestId: '11111111-1111-4111-8111-111111111111',
          state: 'pending',
          jobId: 'job-123',
          courseId: '11111111-1111-4111-8111-111111111111',
          message: 'Course generation started',
        })
      );
  });

  it('reuses one durable request ID for course creation and generation', async () => {
    renderCourseGenerator();
    fireEvent.change(screen.getByLabelText(/Course Title/i), { target: { value: 'My Course' } });
    fireEvent.change(screen.getByLabelText(/Your Story/i), { target: { value: 'A trip' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Audio Course/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    const createBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const generateBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(createBody.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(generateBody.clientRequestId).toBe(createBody.id);
    expect(window.localStorage.length).toBe(0);
    expect(mockInvalidateLibrary).toHaveBeenCalledOnce();
  });

  it('does not start a paid request when the intent cannot be stored durably', async () => {
    mockFetch.mockReset();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    renderCourseGenerator();
    fireEvent.change(screen.getByLabelText(/Course Title/i), { target: { value: 'My Course' } });
    fireEvent.change(screen.getByLabelText(/Your Story/i), { target: { value: 'A trip' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Audio Course/i }));

    expect(await screen.findByText(/Could not save the generation request/)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('blocks a second submission fired in the same browser frame', async () => {
    mockFetch.mockReset();
    let resolveCreate!: (response: Response) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveCreate = resolve;
        })
    );
    renderCourseGenerator();
    fireEvent.change(screen.getByLabelText(/Course Title/i), { target: { value: 'My Course' } });
    fireEvent.change(screen.getByLabelText(/Your Story/i), { target: { value: 'A trip' } });
    const button = screen.getByRole('button', { name: /Create Audio Course/i });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    resolveCreate(jsonResponse({ id: 'course-123' }));
  });

  it('keeps the saved intent when the generation response is lost and replays it on reload', async () => {
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ id: '11111111-1111-4111-8111-111111111111' }))
      .mockRejectedValueOnce(new TypeError('Network connection lost'));
    const view = renderCourseGenerator();
    fireEvent.change(screen.getByLabelText(/Course Title/i), { target: { value: 'My Course' } });
    fireEvent.change(screen.getByLabelText(/Your Story/i), { target: { value: 'A trip' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Audio Course/i }));
    await waitFor(() => expect(window.localStorage.length).toBe(1));
    view.unmount();

    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ id: '11111111-1111-4111-8111-111111111111', existing: true })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          clientRequestId: '11111111-1111-4111-8111-111111111111',
          state: 'pending',
          jobId: 'job-123',
          message: 'Course generation started',
        })
      );
    renderCourseGenerator();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
    expect(JSON.parse(mockFetch.mock.calls[2][1].body).id).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(JSON.parse(mockFetch.mock.calls[3][1].body).clientRequestId).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  it('retains a typed conflict until the user starts a new request', async () => {
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ id: '11111111-1111-4111-8111-111111111111' }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            code: 'idempotency_conflict',
            message: 'Client request ID was already used for a different generation request.',
          },
          409
        )
      );
    renderCourseGenerator();
    fireEvent.change(screen.getByLabelText(/Course Title/i), { target: { value: 'My Course' } });
    fireEvent.change(screen.getByLabelText(/Your Story/i), { target: { value: 'A trip' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Audio Course/i }));

    expect(await screen.findByText(/Client request ID was already used/)).toBeInTheDocument();
    expect(window.localStorage.length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /Start a new request/i }));
    expect(window.localStorage.length).toBe(0);
  });

  it('clears a definitive validation rejection so corrected form data can create a new intent', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Title is invalid' }, 422));
    renderCourseGenerator();
    fireEvent.change(screen.getByLabelText(/Course Title/i), { target: { value: 'Bad title' } });
    fireEvent.change(screen.getByLabelText(/Your Story/i), { target: { value: 'A trip' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Audio Course/i }));

    expect(await screen.findByText(/Title is invalid/)).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('lets the user abandon a retained ambiguous request', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: '11111111-1111-4111-8111-111111111111' }));
    mockFetch.mockRejectedValueOnce(new TypeError('Network connection lost'));
    renderCourseGenerator();
    fireEvent.change(screen.getByLabelText(/Course Title/i), { target: { value: 'My Course' } });
    fireEvent.change(screen.getByLabelText(/Your Story/i), { target: { value: 'A trip' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Audio Course/i }));

    expect(await screen.findByText(/Network connection lost/)).toBeInTheDocument();
    expect(window.localStorage.length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /Start a new request/i }));
    expect(window.localStorage.length).toBe(0);
  });
});
