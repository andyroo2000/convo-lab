/* eslint-disable testing-library/no-node-access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import CoursePage from '../CoursePage';
import type { Course } from '../../types';

// Use vi.hoisted for mock functions
const mockUpdateCourse = vi.hoisted(() => vi.fn());
const mockUseCourse = vi.hoisted(() => vi.fn());
const mockUseWarmAudioCache = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useCourse', () => ({
  useCourse: mockUseCourse,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      role: 'admin',
    },
  }),
}));

vi.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    audioRef: { current: null },
  }),
}));

vi.mock('../../hooks/useWarmAudioCache', () => ({
  default: mockUseWarmAudioCache,
}));

vi.mock('../../components/AudioPlayer', () => ({
  default: ({ src }: { src: string }) => (
    <div data-testid="mock-audio-player" data-src={src}>
      Audio Player
    </div>
  ),
}));

const mockCourse: Course = {
  id: 'course-123',
  userId: 'user-123',
  title: 'Daily Conversations',
  description: 'Learn everyday Japanese phrases',
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  jlptLevel: 'N4',
  status: 'ready',
  audioUrl: 'https://example.com/course.mp3',
  approxDurationSeconds: 300,
  maxLessonDurationMinutes: 20,
  l1VoiceId: 'voice-l1',
  speaker1Gender: 'female',
  speaker2Gender: 'male',
  createdAt: new Date(),
  updatedAt: new Date(),
  coreItems: [
    {
      id: 'item-1',
      courseId: 'course-123',
      textL2: 'おはよう',
      readingL2: 'おはよう',
      translationL1: 'Good morning',
      order: 0,
      complexityScore: 1,
    },
    {
      id: 'item-2',
      courseId: 'course-123',
      textL2: 'ありがとう',
      readingL2: 'ありがとう',
      translationL1: 'Thank you',
      order: 1,
      complexityScore: 1,
    },
  ],
  courseEpisodes: [
    {
      courseId: 'course-123',
      episodeId: 'episode-123',
      order: 0,
      episode: {
        id: 'episode-123',
        userId: 'user-123',
        title: 'Daily Conversations',
        targetLanguage: 'ja',
        nativeLanguage: 'en',
        status: 'ready',
        sourceText: 'Teach me basic greetings in Japanese',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ],
};

type MockCourse = Omit<Course, 'audioUrl' | 'description'> & {
  audioUrl?: string | null;
  description?: string | null;
};

function setCourseState({
  course = mockCourse,
  generationProgress = null,
  isLoading = false,
}: {
  course?: MockCourse | null;
  generationProgress?: number | null;
  isLoading?: boolean;
} = {}) {
  mockUseCourse.mockReturnValue({
    course,
    isLoading,
    error: null,
    generationProgress,
    updateCourse: mockUpdateCourse,
    isUpdating: false,
  });
}

function openEditor(currentValue: string) {
  fireEvent.click(screen.getByText(currentValue));
  return screen.getByDisplayValue(currentValue);
}

function changeEditorValue(editor: HTMLElement, value: string) {
  fireEvent.change(editor, { target: { value } });
}

async function expectCourseUpdate(update: Partial<Course>) {
  await waitFor(() => {
    expect(mockUpdateCourse).toHaveBeenCalledWith(update);
  });
}

describe('CoursePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateCourse.mockResolvedValue({});
  });

  const renderPage = (courseId = 'course-123') =>
    render(
      <MemoryRouter initialEntries={[`/app/courses/${courseId}`]}>
        <Routes>
          <Route path="/app/courses/:courseId" element={<CoursePage />} />
        </Routes>
      </MemoryRouter>
    );

  describe('loading state', () => {
    it('should show loading spinner while fetching course', () => {
      setCourseState({ course: null, isLoading: true });

      renderPage();

      expect(screen.getByText('Loading course...')).toBeInTheDocument();
      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('audio cache warming', () => {
    it('warms ready course audio', async () => {
      setCourseState();

      renderPage();

      await waitFor(() => {
        expect(mockUseWarmAudioCache).toHaveBeenCalledWith(
          ['https://example.com/course.mp3'],
          true
        );
      });
    });
  });

  describe('not found state', () => {
    it('should show not found message when course is null', () => {
      setCourseState({ course: null });

      renderPage();

      expect(screen.getByText('Audio course not found')).toBeInTheDocument();
    });
  });

  describe('course display', () => {
    beforeEach(() => {
      setCourseState();
    });

    it('should render course title', () => {
      renderPage();
      expect(screen.getByText('Daily Conversations')).toBeInTheDocument();
    });

    it('should render course description', () => {
      renderPage();
      expect(screen.getByText('Learn everyday Japanese phrases')).toBeInTheDocument();
    });

    it('should show placeholder when description is empty', () => {
      const courseWithoutDescription = { ...mockCourse, description: null };
      setCourseState({ course: courseWithoutDescription });

      renderPage();
      expect(screen.getByText('Click to add description...')).toBeInTheDocument();
    });

    it('should render course duration', () => {
      renderPage();
      expect(screen.getByText('5:00')).toBeInTheDocument(); // 300 seconds = 5:00
    });

    it('should render core items count', () => {
      renderPage();
      expect(screen.getByText('2 Core Items')).toBeInTheDocument();
    });

    it('should render language pair', () => {
      renderPage();
      expect(screen.getByText('JA → EN')).toBeInTheDocument();
    });

    it('should render audio player when course is ready', () => {
      renderPage();
      const audioPlayer = screen.getByTestId('mock-audio-player');
      expect(audioPlayer).toBeInTheDocument();
      expect(audioPlayer).toHaveAttribute('data-src', 'https://example.com/course.mp3');
    });

    it('should render core vocabulary grid', () => {
      renderPage();
      expect(screen.getByText('Core Vocabulary (2 items)')).toBeInTheDocument();
      expect(screen.getAllByText('おはよう')).toHaveLength(2); // textL2 and readingL2
      expect(screen.getByText('Good morning')).toBeInTheDocument();
      expect(screen.getAllByText('ありがとう')).toHaveLength(2); // textL2 and readingL2
      expect(screen.getByText('Thank you')).toBeInTheDocument();
    });

    it('should render original prompt when available', () => {
      renderPage();
      expect(screen.getByText('Original Prompt')).toBeInTheDocument();
      expect(screen.getByText('Teach me basic greetings in Japanese')).toBeInTheDocument();
    });
  });

  describe('title editing', () => {
    beforeEach(() => {
      setCourseState();
    });

    it('should show input field when title is clicked', () => {
      renderPage();
      const input = openEditor('Daily Conversations');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('should save title on blur', async () => {
      renderPage();
      const input = openEditor('Daily Conversations');
      changeEditorValue(input, 'Updated Title');
      fireEvent.blur(input);

      await expectCourseUpdate({ title: 'Updated Title' });
    });

    it('should save title on Enter key', async () => {
      renderPage();
      const input = openEditor('Daily Conversations');
      changeEditorValue(input, 'New Title');
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await expectCourseUpdate({ title: 'New Title' });
    });

    it('should cancel editing on Escape key', () => {
      renderPage();
      const input = openEditor('Daily Conversations');
      changeEditorValue(input, 'New Title');
      fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

      // Title should be back to normal (not in editing mode)
      expect(screen.getByText('Daily Conversations')).toBeInTheDocument();
      expect(mockUpdateCourse).not.toHaveBeenCalled();
    });

    it('should not save if title is unchanged', async () => {
      renderPage();
      const input = openEditor('Daily Conversations');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockUpdateCourse).not.toHaveBeenCalled();
      });
    });

    it('should not save if title is empty', async () => {
      renderPage();
      const input = openEditor('Daily Conversations');
      changeEditorValue(input, '   ');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockUpdateCourse).not.toHaveBeenCalled();
      });
    });
  });

  describe('description editing', () => {
    beforeEach(() => {
      setCourseState();
    });

    it('should show textarea when description is clicked', () => {
      renderPage();
      const textarea = openEditor('Learn everyday Japanese phrases');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should save description on blur', async () => {
      renderPage();
      const textarea = openEditor('Learn everyday Japanese phrases');
      changeEditorValue(textarea, 'Updated description');
      fireEvent.blur(textarea);

      await expectCourseUpdate({ description: 'Updated description' });
    });

    it('should save description on Enter key', async () => {
      renderPage();
      const textarea = openEditor('Learn everyday Japanese phrases');
      changeEditorValue(textarea, 'New description');
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      await expectCourseUpdate({ description: 'New description' });
    });

    it('should cancel editing on Escape key', () => {
      renderPage();
      const textarea = openEditor('Learn everyday Japanese phrases');
      changeEditorValue(textarea, 'New description');
      fireEvent.keyDown(textarea, { key: 'Escape', code: 'Escape' });

      // Description should be back to normal
      expect(screen.getByText('Learn everyday Japanese phrases')).toBeInTheDocument();
      expect(mockUpdateCourse).not.toHaveBeenCalled();
    });

    it('should not save if description is unchanged', async () => {
      renderPage();
      const textarea = openEditor('Learn everyday Japanese phrases');
      fireEvent.blur(textarea);

      await waitFor(() => {
        expect(mockUpdateCourse).not.toHaveBeenCalled();
      });
    });
  });

  describe('generation progress', () => {
    it('should show progress bar when generating', () => {
      const generatingCourse = { ...mockCourse, status: 'generating' as const, audioUrl: null };
      setCourseState({ course: generatingCourse, generationProgress: 50 });

      renderPage();

      expect(screen.getByText('Generating course audio...')).toBeInTheDocument();
      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should show correct status message at different progress levels', () => {
      const generatingCourse = { ...mockCourse, status: 'generating' as const, audioUrl: null };

      // Test at 15% - Extracting dialogue
      setCourseState({ course: generatingCourse, generationProgress: 15 });

      const { rerender } = renderPage();
      expect(screen.getByText('Extracting dialogue...')).toBeInTheDocument();

      // Test at 35% - Planning course structure
      setCourseState({ course: generatingCourse, generationProgress: 35 });

      rerender(
        <MemoryRouter initialEntries={['/app/courses/course-123']}>
          <Routes>
            <Route path="/app/courses/:courseId" element={<CoursePage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText('Planning course structure...')).toBeInTheDocument();

      // Test at 55% - Generating teaching script
      setCourseState({ course: generatingCourse, generationProgress: 55 });

      rerender(
        <MemoryRouter initialEntries={['/app/courses/course-123']}>
          <Routes>
            <Route path="/app/courses/:courseId" element={<CoursePage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText('Generating teaching script...')).toBeInTheDocument();

      // Test at 70% - Synthesizing audio
      setCourseState({ course: generatingCourse, generationProgress: 70 });

      rerender(
        <MemoryRouter initialEntries={['/app/courses/course-123']}>
          <Routes>
            <Route path="/app/courses/:courseId" element={<CoursePage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText('Synthesizing audio (10% complete)...')).toBeInTheDocument();

      // Test at 90% - Finalizing
      setCourseState({ course: generatingCourse, generationProgress: 90 });

      rerender(
        <MemoryRouter initialEntries={['/app/courses/course-123']}>
          <Routes>
            <Route path="/app/courses/:courseId" element={<CoursePage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText('Finalizing audio file...')).toBeInTheDocument();
    });

    it('should show draft message when status is draft', () => {
      const draftCourse = { ...mockCourse, status: 'draft' as const, audioUrl: null };
      setCourseState({ course: draftCourse });

      renderPage();

      expect(screen.getByText('Course not yet generated')).toBeInTheDocument();
    });
  });
});
