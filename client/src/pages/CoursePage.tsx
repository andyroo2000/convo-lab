import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Course, CourseStatusResponse } from '../types';
import AudioPlayer from '../components/AudioPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [generationProgress, setGenerationProgress] = useState<number | null>(null);
  const { audioRef } = useAudioPlayer();

  useEffect(() => {
    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  const loadCourse = async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load course');
      }

      const data = await response.json();
      setCourse(data);
    } catch (err) {
      console.error('Error loading course:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll for course status while generating
  useEffect(() => {
    if (!course || course.status !== 'generating') {
      setGenerationProgress(null);
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/courses/${courseId}/status`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to check course status');
        }

        const statusData: CourseStatusResponse = await response.json();

        // Update progress
        if (statusData.progress !== undefined) {
          setGenerationProgress(statusData.progress);
        }

        // If done, reload course
        if (statusData.status === 'ready' || statusData.status === 'error') {
          clearInterval(pollInterval);
          setGenerationProgress(null);
          await loadCourse();
        }
      } catch (err) {
        console.error('Error polling course status:', err);
      }
    }, 1000); // Poll every second for smooth progress updates

    return () => clearInterval(pollInterval);
  }, [course, courseId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card text-center py-12">
          <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card text-center py-12">
          <p className="text-gray-600">Course not found</p>
        </div>
      </div>
    );
  }

  const lessons = course.lessons || [];
  const selectedLesson = lessons[selectedLessonIndex];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/library')}
          className="btn-outline p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-navy">{course.title}</h1>
          {course.description && (
            <p className="text-gray-600 mt-2">{course.description}</p>
          )}
        </div>
      </div>

      {/* Course Info */}
      <div className="card">
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>{lessons.length} {lessons.length === 1 ? 'Lesson' : 'Lessons'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>
              {formatDuration(
                lessons.reduce((sum, l) => sum + l.approxDurationSeconds, 0)
              )} total
            </span>
          </div>
          <div className="ml-auto">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
              {course.targetLanguage.toUpperCase()} → {course.nativeLanguage.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Lesson List & Player */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lesson List */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-lg font-bold text-navy mb-4">Lessons</h2>
            <div className="space-y-2">
              {lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  onClick={() => setSelectedLessonIndex(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedLessonIndex === index
                      ? 'bg-indigo-100 border-2 border-indigo-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-navy text-sm truncate">
                        Lesson {lesson.order}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDuration(lesson.approxDurationSeconds)}
                      </div>
                    </div>
                    {lesson.status === 'ready' && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      </div>
                    )}
                    {lesson.status === 'generating' && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current Lesson Player */}
        <div className="lg:col-span-2">
          {selectedLesson ? (
            <div className="card">
              <h2 className="text-2xl font-bold text-navy mb-4">
                {selectedLesson.title}
              </h2>

              {selectedLesson.status === 'ready' && selectedLesson.audioUrl ? (
                <>
                  <AudioPlayer
                    src={selectedLesson.audioUrl}
                    audioRef={audioRef}
                    key={selectedLesson.audioUrl}
                  />

                  {/* Core Items */}
                  {selectedLesson.coreItems && selectedLesson.coreItems.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-navy mb-3">
                        Core Vocabulary ({selectedLesson.coreItems.length} items)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedLesson.coreItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="text-lg font-medium text-navy">
                              {item.textL2}
                            </div>
                            {item.readingL2 && (
                              <div className="text-sm text-gray-500 mt-1">
                                {item.readingL2}
                              </div>
                            )}
                            <div className="text-sm text-gray-600 mt-2">
                              {item.translationL1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : selectedLesson.status === 'generating' ? (
                <div className="text-center py-12">
                  <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Generating lesson audio...</p>

                  {/* Progress Bar */}
                  {generationProgress !== null && (
                    <div className="max-w-md mx-auto">
                      <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-4 rounded-full transition-all duration-300 ease-out flex items-center justify-center text-xs font-semibold text-white"
                          style={{ width: `${Math.max(generationProgress, 3)}%` }}
                        >
                          {generationProgress > 10 && `${generationProgress}%`}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        {generationProgress < 20
                          ? 'Extracting dialogue...'
                          : generationProgress < 40
                          ? 'Planning lesson structure...'
                          : generationProgress < 60
                          ? 'Generating teaching script...'
                          : generationProgress < 85
                          ? `Synthesizing audio (${generationProgress - 60}% complete)...`
                          : 'Finalizing audio file...'}
                      </p>
                    </div>
                  )}

                  <p className="text-sm text-gray-500 mt-4">
                    This may take several minutes due to AI generation
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">Lesson not yet generated</p>
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-12">
              <p className="text-gray-600">No lessons available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
