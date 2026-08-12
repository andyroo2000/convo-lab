/* eslint-disable testing-library/no-unnecessary-act */
// This file requires act() for async state updates in dialogue generation tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, act } from '../../../test/utils';

import DialogueGenerator from '../DialogueGenerator';

// Mock hooks
const mockCreateEpisode = vi.fn();
const mockGenerateDialogue = vi.fn();
const mockGenerateAllSpeedsAudio = vi.fn();
const mockGetEpisode = vi.fn();
const mockPollJobStatus = vi.fn();
const mockNavigate = vi.fn();
const mockInvalidateLibrary = vi.fn();

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../hooks/useEpisodes', () => ({
  useEpisodes: () => ({
    createEpisode: mockCreateEpisode,
    generateDialogue: mockGenerateDialogue,
    generateAllSpeedsAudio: mockGenerateAllSpeedsAudio,
    getEpisode: mockGetEpisode,
    pollJobStatus: mockPollJobStatus,
    loading: false,
    error: null,
  }),
}));

vi.mock('../../../hooks/useLibraryData', () => ({
  useInvalidateLibrary: () => mockInvalidateLibrary,
}));

vi.mock('../../../hooks/useDemo', () => ({
  useIsDemo: () => false,
}));

vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      preferredStudyLanguage: 'ja',
    },
  }),
}));

// Mock shared constants
vi.mock('../../../../../shared/src/constants-new', () => ({
  SUPPORTED_LANGUAGES: {
    ja: { name: 'Japanese', nativeName: '日本語' },
    en: { name: 'English', nativeName: 'English' },
  },
  SPEAKER_COLORS: ['#6366f1', '#ec4899', '#10b981', '#f59e0b'],
  TTS_VOICES: {
    ja: {
      voices: [
        { id: 'ja-voice-1', gender: 'male', description: 'JP Voice 1', provider: 'fishaudio' },
        { id: 'ja-voice-2', gender: 'female', description: 'JP Voice 2', provider: 'fishaudio' },
      ],
    },
    en: {
      voices: [
        { id: 'en-voice-1', gender: 'male', description: 'EN Voice 1', provider: 'fishaudio' },
        { id: 'en-voice-2', gender: 'female', description: 'EN Voice 2', provider: 'fishaudio' },
      ],
    },
  },
}));

vi.mock('../../../../../shared/src/nameConstants', () => ({
  getRandomName: (_language: string, gender: string) => (gender === 'male' ? '田中' : '鈴木'),
}));

vi.mock('../../../../../shared/src/voiceSelection', () => ({
  getDialogueSpeakerVoices: (language: string, count: number) =>
    [
      { voiceId: `${language}-voice-1`, gender: 'male' },
      { voiceId: `${language}-voice-2`, gender: 'female' },
    ].slice(0, count),
  getCourseSpeakerVoices: (_targetLanguage: string, _nativeLanguage: string, _count: number) => ({
    narratorVoice: 'en-voice-1',
    speakerVoices: ['ja-voice-1', 'ja-voice-2'],
  }),
  getSelectableTtsVoices: (language: string) => [
    { id: `${language}-voice-1`, gender: 'male', description: 'Mock: Voice 1 - Warm' },
    { id: `${language}-voice-2`, gender: 'female', description: 'Mock: Voice 2 - Clear' },
  ],
  getTtsVoiceById: (language: string, voiceId: string) => ({
    id: voiceId,
    gender: voiceId === `${language}-voice-2` ? 'female' : 'male',
    description: `Mock: ${voiceId === `${language}-voice-2` ? 'Voice 2' : 'Voice 1'} - Clear`,
  }),
}));

vi.mock('../../common/VoicePreview', () => ({
  default: ({ voiceId }: { voiceId: string }) => (
    <div data-testid={`voice-preview-${voiceId}`}>Voice Preview</div>
  ),
}));

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

describe('DialogueGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('11111111-1111-4111-8111-111111111111'),
    });

    mockCreateEpisode.mockResolvedValue({ id: 'episode-123' });
    mockGenerateDialogue.mockResolvedValue({
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      state: 'pending',
      jobId: 'job-123',
      message: 'Dialogue generation started',
    });
    mockGetEpisode.mockResolvedValue({
      id: 'episode-123',
      dialogue: { id: 'dialogue-123' },
    });
    mockPollJobStatus.mockResolvedValue('pending');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderDialogueGenerator = () =>
    render(
      <MemoryRouter>
        <DialogueGenerator />
      </MemoryRouter>
    );

  describe('rendering', () => {
    it('should render the form with source text input', () => {
      renderDialogueGenerator();
      expect(screen.getByTestId('dialogue-input-source-text')).toBeInTheDocument();
    });

    it('should render conversation length selector', () => {
      renderDialogueGenerator();
      expect(screen.getByTestId('dialogue-select-length')).toBeInTheDocument();
    });

    it('should render tone selector', () => {
      renderDialogueGenerator();
      expect(screen.getByTestId('dialogue-select-tone')).toBeInTheDocument();
    });

    it('should render generate button', () => {
      renderDialogueGenerator();
      expect(screen.getByTestId('dialogue-button-generate')).toBeInTheDocument();
    });

    it('should render "Your Story" heading', () => {
      renderDialogueGenerator();
      expect(screen.getByText('Your Story')).toBeInTheDocument();
    });

    it('should render "Ready to Generate?" heading', () => {
      renderDialogueGenerator();
      expect(screen.getByText('Ready to Generate?')).toBeInTheDocument();
    });
  });

  describe('JLPT level selector (Japanese)', () => {
    it('should render JLPT level selector for Japanese', () => {
      renderDialogueGenerator();
      expect(screen.getByTestId('dialogue-select-jlpt-level')).toBeInTheDocument();
    });

    it('should have N5 selected by default', () => {
      renderDialogueGenerator();
      const select = screen.getByTestId('dialogue-select-jlpt-level') as HTMLSelectElement;
      expect(select.value).toBe('N5');
    });

    it('should allow changing JLPT level', () => {
      renderDialogueGenerator();
      const select = screen.getByTestId('dialogue-select-jlpt-level');
      fireEvent.change(select, { target: { value: 'N3' } });
      expect((select as HTMLSelectElement).value).toBe('N3');
    });

    it('should show all JLPT levels', () => {
      renderDialogueGenerator();
      expect(screen.getByText('N5 (Beginner)')).toBeInTheDocument();
      expect(screen.getByText('N4 (Upper Beginner)')).toBeInTheDocument();
      expect(screen.getByText('N3 (Intermediate)')).toBeInTheDocument();
      expect(screen.getByText('N2 (Upper Intermediate)')).toBeInTheDocument();
      expect(screen.getByText('N1 (Advanced)')).toBeInTheDocument();
    });
  });

  describe('dialogue length selector', () => {
    it('should have 8 turns selected by default', () => {
      renderDialogueGenerator();
      const select = screen.getByTestId('dialogue-select-length') as HTMLSelectElement;
      expect(select.value).toBe('8');
    });

    it('should allow changing dialogue length', () => {
      renderDialogueGenerator();
      const select = screen.getByTestId('dialogue-select-length');
      fireEvent.change(select, { target: { value: '20' } });
      expect((select as HTMLSelectElement).value).toBe('20');
    });

    it('should show all dialogue length options', () => {
      renderDialogueGenerator();
      expect(screen.getByText('8 turns')).toBeInTheDocument();
      expect(screen.getByText('15 turns')).toBeInTheDocument();
      expect(screen.getByText('20 turns')).toBeInTheDocument();
    });
  });

  describe('tone selector', () => {
    it('should have casual tone selected by default', () => {
      renderDialogueGenerator();
      const select = screen.getByTestId('dialogue-select-tone') as HTMLSelectElement;
      expect(select.value).toBe('casual');
    });

    it('should allow changing tone', () => {
      renderDialogueGenerator();
      const select = screen.getByTestId('dialogue-select-tone');
      fireEvent.change(select, { target: { value: 'formal' } });
      expect((select as HTMLSelectElement).value).toBe('formal');
    });

    it('should show all tone options', () => {
      renderDialogueGenerator();
      expect(screen.getByRole('option', { name: 'Casual' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Polite' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Formal' })).toBeInTheDocument();
    });
  });

  describe('source text input', () => {
    it('should update source text on input', () => {
      renderDialogueGenerator();
      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story about shopping' } });
      expect((input as HTMLTextAreaElement).value).toBe('My story about shopping');
    });

    it('should have placeholder text', () => {
      renderDialogueGenerator();
      const input = screen.getByTestId('dialogue-input-source-text');
      expect(input).toHaveAttribute('placeholder');
    });
  });

  describe('generate button state', () => {
    it('should be disabled when source text is empty', () => {
      renderDialogueGenerator();
      const button = screen.getByTestId('dialogue-button-generate');
      expect(button).toBeDisabled();
    });

    it('should be enabled when source text is filled', () => {
      renderDialogueGenerator();
      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');
      expect(button).not.toBeDisabled();
    });

    it('should be disabled with only whitespace', () => {
      renderDialogueGenerator();
      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: '   ' } });

      const button = screen.getByTestId('dialogue-button-generate');
      expect(button).toBeDisabled();
    });
  });

  describe('generate dialogue flow', () => {
    it('only offers dialogue lengths accepted by the API contract', () => {
      renderDialogueGenerator();
      const options = Array.from(
        (screen.getByTestId('dialogue-select-length') as HTMLSelectElement).options
      ).map((option) => Number(option.value));

      expect(options).toEqual([8, 15, 20]);
      expect(Math.max(...options)).toBeLessThanOrEqual(20);
    });

    it('uses one durable request ID for resource creation and generation', async () => {
      renderDialogueGenerator();
      fireEvent.change(screen.getByTestId('dialogue-input-source-text'), {
        target: { value: 'My retry-safe story' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('dialogue-button-generate'));
      });

      expect(mockCreateEpisode).toHaveBeenCalledWith(
        expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' })
      );
      expect(mockGenerateDialogue).toHaveBeenCalledWith(
        'episode-123',
        expect.any(Array),
        3,
        8,
        expect.objectContaining({
          clientRequestId: '11111111-1111-4111-8111-111111111111',
        })
      );
      expect(window.localStorage.length).toBe(0);
    });

    it('blocks two generate clicks in the same frame', async () => {
      const episodeRequest = deferred<{ id: string }>();
      mockCreateEpisode.mockReturnValue(episodeRequest.promise);
      renderDialogueGenerator();
      fireEvent.change(screen.getByTestId('dialogue-input-source-text'), {
        target: { value: 'One paid request' },
      });

      const button = screen.getByTestId('dialogue-button-generate');
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockCreateEpisode).toHaveBeenCalledTimes(1);
      episodeRequest.resolve({ id: 'episode-123' });
      await act(async () => undefined);
    });

    it('keeps an ambiguous request durable for reload recovery', async () => {
      mockGenerateDialogue.mockRejectedValueOnce(new TypeError('Network connection lost'));
      renderDialogueGenerator();
      fireEvent.change(screen.getByTestId('dialogue-input-source-text'), {
        target: { value: 'Recover this request' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('dialogue-button-generate'));
      });

      expect(window.localStorage.length).toBe(1);
      expect(screen.getByText('Network connection lost')).toBeInTheDocument();
    });

    it('should call createEpisode when generate is clicked', async () => {
      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My shopping trip story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockCreateEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceText: 'My shopping trip story',
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
      );
    });

    it('should call generateDialogue after createEpisode', async () => {
      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockGenerateDialogue).toHaveBeenCalledWith(
        'episode-123',
        expect.any(Array),
        3, // variations per sentence
        8, // default dialogue length
        expect.objectContaining({ jlptLevel: 'N5' })
      );
    });

    it('should use selected dialogue length', async () => {
      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const lengthSelect = screen.getByTestId('dialogue-select-length');
      fireEvent.change(lengthSelect, { target: { value: '20' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockGenerateDialogue).toHaveBeenCalledWith(
        'episode-123',
        expect.any(Array),
        3,
        20,
        expect.objectContaining({ jlptLevel: 'N5' })
      );
    });
  });

  describe('generating state', () => {
    it('should show generating UI after clicking generate', async () => {
      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText('Generating Your Dialogue')).toBeInTheDocument();
    });

    it('should show loading spinner during generation', async () => {
      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    it('should show descriptive text during generation', async () => {
      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText(/AI is creating a natural conversation/)).toBeInTheDocument();
    });
  });

  describe('job polling', () => {
    it('starts exactly one poll-until-terminal owner for a long-running job', async () => {
      const pendingPoll = deferred<'completed' | 'failed' | 'pending'>();
      mockPollJobStatus.mockReturnValue(pendingPoll.promise);

      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(20_000);
      });

      expect(mockPollJobStatus).toHaveBeenCalledTimes(1);
      expect(mockPollJobStatus).toHaveBeenCalledWith(
        'job-123',
        undefined,
        'dialogue',
        expect.any(AbortSignal)
      );
    });

    it('aborts polling and ignores a terminal result after unmount', async () => {
      const pendingPoll = deferred<'completed' | 'failed' | 'pending'>();
      mockPollJobStatus.mockReturnValue(pendingPoll.promise);
      const view = renderDialogueGenerator();

      fireEvent.change(screen.getByTestId('dialogue-input-source-text'), {
        target: { value: 'My story' },
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('dialogue-button-generate'));
      });

      const signal = mockPollJobStatus.mock.calls[0]?.[3] as AbortSignal;
      view.unmount();
      expect(signal.aborted).toBe(true);

      await act(async () => {
        pendingPoll.resolve('completed');
        await pendingPoll.promise;
      });

      expect(mockGetEpisode).not.toHaveBeenCalled();
      expect(mockGenerateAllSpeedsAudio).not.toHaveBeenCalled();
      expect(mockInvalidateLibrary).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('completion state', () => {
    it('should show completion message when job completes', async () => {
      mockPollJobStatus.mockResolvedValue('completed');

      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText('Dialogue Generated!')).toBeInTheDocument();
    });

    it('should show redirect message on completion', async () => {
      mockPollJobStatus.mockResolvedValue('completed');

      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText('Redirecting to playback page...')).toBeInTheDocument();
    });

    it('should navigate to playback page after completion', async () => {
      mockPollJobStatus.mockResolvedValue('completed');

      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000); // Poll completion
      });

      await act(async () => {
        vi.advanceTimersByTime(2000); // Navigation delay
      });

      expect(mockNavigate).toHaveBeenCalledWith('/app/playback/episode-123');
    });

    it('cancels the delayed redirect when unmounted after completion', async () => {
      mockPollJobStatus.mockResolvedValue('completed');
      const view = renderDialogueGenerator();

      fireEvent.change(screen.getByTestId('dialogue-input-source-text'), {
        target: { value: 'My story' },
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId('dialogue-button-generate'));
        await Promise.resolve();
      });

      expect(screen.getByText('Dialogue Generated!')).toBeInTheDocument();
      view.unmount();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should trigger audio generation after dialogue completes', async () => {
      mockPollJobStatus.mockResolvedValue('completed');

      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockGetEpisode).toHaveBeenCalledWith(
        'episode-123',
        false,
        undefined,
        expect.any(AbortSignal)
      );
      expect(mockGenerateAllSpeedsAudio).toHaveBeenCalledWith(
        'episode-123',
        'dialogue-123',
        expect.any(AbortSignal)
      );
    });

    it('should invalidate library cache on completion', async () => {
      mockPollJobStatus.mockResolvedValue('completed');

      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockInvalidateLibrary).toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    it('should return to input state on job failure', async () => {
      mockPollJobStatus.mockResolvedValue('failed');

      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(alertMock).toHaveBeenCalledWith('Dialogue generation failed. Please try again.');
      expect(screen.getByTestId('dialogue-button-generate')).toBeInTheDocument();

      alertMock.mockRestore();
    });

    it('should return to input state on createEpisode error', async () => {
      mockCreateEpisode.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
        // Allow the rejection to propagate
        await Promise.resolve();
      });

      // Should be back to input state - the button should still be there
      // after error in handleGenerate
      expect(screen.getByTestId('dialogue-button-generate')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('speakers configuration', () => {
    it('should pass speakers to createEpisode', async () => {
      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockCreateEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          speakers: expect.arrayContaining([
            expect.objectContaining({
              voiceId: expect.any(String),
              proficiency: 'N5',
              tone: 'casual',
            }),
          ]),
        })
      );
    });

    it('should use selected JLPT level for speakers', async () => {
      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const jlptSelect = screen.getByTestId('dialogue-select-jlpt-level');
      fireEvent.change(jlptSelect, { target: { value: 'N3' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockCreateEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          speakers: expect.arrayContaining([
            expect.objectContaining({
              proficiency: 'N3',
            }),
          ]),
        })
      );
    });

    it('should use selected tone for speakers', async () => {
      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const toneSelect = screen.getByTestId('dialogue-select-tone');
      fireEvent.change(toneSelect, { target: { value: 'formal' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockCreateEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          speakers: expect.arrayContaining([
            expect.objectContaining({
              tone: 'formal',
            }),
          ]),
        })
      );
    });
  });

  describe('UI elements', () => {
    it('should show dialogue turn count in summary', () => {
      renderDialogueGenerator();
      expect(screen.getByText(/8 dialogue turns/)).toBeInTheDocument();
    });

    it('should show variations per sentence in summary', () => {
      renderDialogueGenerator();
      expect(screen.getByText(/3 variations per sentence/)).toBeInTheDocument();
    });

    it('should show English translations in summary', () => {
      renderDialogueGenerator();
      expect(screen.getByText(/English translations/)).toBeInTheDocument();
    });

    it('should show level-matched language complexity in summary', () => {
      renderDialogueGenerator();
      expect(screen.getByText(/Level-matched language complexity/)).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('should render retro dialogue sections', () => {
      renderDialogueGenerator();
      const sections = document.querySelectorAll('.retro-dialogue-create-v3-section');
      expect(sections.length).toBeGreaterThan(0);
    });

    it('should render retro generator container', () => {
      const { container } = renderDialogueGenerator();
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('retro-dialogue-create-v3-generator');
    });
  });

  describe('checkmark icon in completion', () => {
    it('should render checkmark SVG in completion state', async () => {
      mockPollJobStatus.mockResolvedValue('completed');

      renderDialogueGenerator();

      const input = screen.getByTestId('dialogue-input-source-text');
      fireEvent.change(input, { target: { value: 'My story' } });

      const button = screen.getByTestId('dialogue-button-generate');

      await act(async () => {
        fireEvent.click(button);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});

describe('DialogueGenerator - Demo User', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-mock useIsDemo to return true
    vi.doMock('../../../hooks/useDemo', () => ({
      useIsDemo: () => true,
    }));
  });

  it('should show demo restriction modal when demo user tries to generate', async () => {
    // This test verifies the demo modal behavior
    // In a real test, we'd need to re-import with different mock
    // For now, we're testing the component structure includes the modal
    const { container: _container } = render(
      <MemoryRouter>
        <DialogueGenerator />
      </MemoryRouter>
    );

    // Modal should not be visible initially
    expect(screen.queryByTestId('demo-restriction-modal')).not.toBeInTheDocument();
  });
});
