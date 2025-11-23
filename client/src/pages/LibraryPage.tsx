import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Trash2, BookOpen, MessageSquare, Headphones, Sparkles } from 'lucide-react';
import { Episode, Course } from '../types';
import { useEpisodes } from '../hooks/useEpisodes';
import ConfirmModal from '../components/common/ConfirmModal';
import EmptyStateCard from '../components/EmptyStateCard';
import Pill from '../components/common/Pill';
import SegmentedPill from '../components/common/SegmentedPill';

import { API_URL } from '../config';

// Library-specific Course type with _count instead of full relations
type LibraryCourse = Omit<Course, 'lessons' | 'courseEpisodes'> & {
  _count?: {
    lessons: number;
  };
};

interface NarrowListeningPack {
  id: string;
  title: string;
  topic: string;
  jlptLevel: string;
  status: string;
  createdAt: string;
  _count: {
    versions: number;
  };
}

interface ChunkPack {
  id: string;
  title: string;
  theme: string;
  jlptLevel: string;
  status: string;
  createdAt: string;
  _count: {
    examples: number;
    stories: number;
    exercises: number;
  };
}

type FilterType = 'all' | 'dialogues' | 'courses' | 'narrowListening' | 'chunkPacks';

export default function LibraryPage() {
  const { deleteEpisode } = useEpisodes();
  const [searchParams, setSearchParams] = useSearchParams();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [narrowListeningPacks, setNarrowListeningPacks] = useState<NarrowListeningPack[]>([]);
  const [chunkPacks, setChunkPacks] = useState<ChunkPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<LibraryCourse | null>(null);
  const [packToDelete, setPackToDelete] = useState<NarrowListeningPack | null>(null);
  const [chunkPackToDelete, setChunkPackToDelete] = useState<ChunkPack | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Map between URL params (kebab-case) and internal filter types (camelCase)
  const filterParamToType: Record<string, FilterType> = {
    'all': 'all',
    'dialogues': 'dialogues',
    'courses': 'courses',
    'narrow-listening': 'narrowListening',
    'lexical-chunk-packs': 'chunkPacks',
  };

  const filterTypeToParam: Record<FilterType, string> = {
    'all': 'all',
    'dialogues': 'dialogues',
    'courses': 'courses',
    'narrowListening': 'narrow-listening',
    'chunkPacks': 'lexical-chunk-packs',
  };

  // Get filter from URL or default to 'all'
  const filterParam = searchParams.get('filter');
  const filter: FilterType = filterParamToType[filterParam || ''] || 'all';

  const handleFilterChange = (newFilter: FilterType) => {
    // If clicking the same filter, deselect it (go back to 'all')
    if (filter === newFilter) {
      setSearchParams({});
    } else {
      setSearchParams({ filter: filterTypeToParam[newFilter] });
    }
  };

  useEffect(() => {
    loadEpisodes();
    loadCourses();
    loadNarrowListeningPacks();
    loadChunkPacks();
  }, []);

  const loadEpisodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/episodes?library=true`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch episodes');
      }

      const data = await response.json();
      setEpisodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await fetch(`${API_URL}/api/courses?library=true`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const data = await response.json();
      setCourses(data);
    } catch (err) {
      console.error('Error loading courses:', err);
      // Don't set error for courses - they're optional
    }
  };

  const loadNarrowListeningPacks = async () => {
    try {
      const response = await fetch(`${API_URL}/api/narrow-listening?library=true`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch narrow listening packs');
      }

      const data = await response.json();
      setNarrowListeningPacks(data);
    } catch (err) {
      console.error('Error loading narrow listening packs:', err);
      // Don't set error - they're optional
    }
  };

  const loadChunkPacks = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chunk-packs?library=true`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chunk packs');
      }

      const data = await response.json();
      setChunkPacks(data);
    } catch (err) {
      console.error('Error loading chunk packs:', err);
      // Don't set error - they're optional
    }
  };

  const handleDeleteClick = (episode: Episode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEpisodeToDelete(episode);
  };

  const handleConfirmDelete = async () => {
    if (!episodeToDelete) return;

    setIsDeleting(true);
    try {
      await deleteEpisode(episodeToDelete.id);
      // Refresh episodes list
      await loadEpisodes();
      setEpisodeToDelete(null);
    } catch (err) {
      console.error('Failed to delete episode:', err);
      // Error is already handled in the hook
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePackClick = (pack: NarrowListeningPack, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPackToDelete(pack);
  };

  const handleConfirmDeletePack = async () => {
    if (!packToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/narrow-listening/${packToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete pack');
      }

      // Refresh packs list
      await loadNarrowListeningPacks();
      setPackToDelete(null);
    } catch (err) {
      console.error('Failed to delete pack:', err);
      alert('Failed to delete pack. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteChunkPackClick = (pack: ChunkPack, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChunkPackToDelete(pack);
  };

  const handleConfirmDeleteChunkPack = async () => {
    if (!chunkPackToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/chunk-packs/${chunkPackToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete chunk pack');
      }

      // Refresh chunk packs list
      await loadChunkPacks();
      setChunkPackToDelete(null);
    } catch (err) {
      console.error('Failed to delete chunk pack:', err);
      alert('Failed to delete chunk pack. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (!isDeleting) {
      setEpisodeToDelete(null);
      setCourseToDelete(null);
      setPackToDelete(null);
      setChunkPackToDelete(null);
    }
  };

  const handleDeleteCourseClick = (course: Course, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCourseToDelete(course);
  };

  const handleConfirmDeleteCourse = async () => {
    if (!courseToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/courses/${courseToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete course');
      }

      // Refresh courses list
      await loadCourses();
      setCourseToDelete(null);
    } catch (err) {
      console.error('Failed to delete course:', err);
      alert('Failed to delete course. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter content based on selected filter
  const filteredEpisodes = (filter === 'courses' || filter === 'narrowListening' || filter === 'chunkPacks') ? [] : episodes;
  const filteredCourses = (filter === 'dialogues' || filter === 'narrowListening' || filter === 'chunkPacks') ? [] : courses;
  const filteredPacks = (filter === 'dialogues' || filter === 'courses' || filter === 'chunkPacks') ? [] : narrowListeningPacks;
  const filteredChunkPacks = (filter === 'dialogues' || filter === 'courses' || filter === 'narrowListening') ? [] : chunkPacks;

  // Combine and sort by date
  const allItems = [
    ...filteredEpisodes.map(ep => ({ type: 'episode' as const, data: ep, date: new Date(ep.createdAt) })),
    ...filteredCourses.map(course => ({ type: 'course' as const, data: course, date: new Date(course.createdAt) })),
    ...filteredPacks.map(pack => ({ type: 'narrowListening' as const, data: pack, date: new Date(pack.createdAt) })),
    ...filteredChunkPacks.map(pack => ({ type: 'chunkPack' as const, data: pack, date: new Date(pack.createdAt) }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  if (loading) {
    return (
      <div>
        <div className="card text-center py-12">
          <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="card text-center py-12">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button onClick={loadEpisodes} className="btn-outline">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-8">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => handleFilterChange('dialogues')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              filter === 'dialogues'
                ? 'bg-indigo text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
            data-testid="library-filter-dialogues"
          >
            <MessageSquare className="w-4 h-4" />
            Dialogues
          </button>
          <button
            onClick={() => handleFilterChange('courses')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              filter === 'courses'
                ? 'bg-orange-500 text-white'
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
            }`}
            data-testid="library-filter-courses"
          >
            <Headphones className="w-4 h-4" />
            Audio Courses
          </button>
          <button
            onClick={() => handleFilterChange('narrowListening')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              filter === 'narrowListening'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
            }`}
            data-testid="library-filter-narrow-listening"
          >
            <Sparkles className="w-4 h-4" />
            Narrow Listening
          </button>
          <button
            onClick={() => handleFilterChange('chunkPacks')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              filter === 'chunkPacks'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
            data-testid="library-filter-chunk-packs"
          >
            <BookOpen className="w-4 h-4" />
            Lexical Chunk Packs
          </button>
        </div>
      </div>

      {allItems.length === 0 ? (
        <>
          {filter === 'dialogues' && (
            <EmptyStateCard
              icon={MessageSquare}
              title="Create Your First Dialogue"
              description="Generate comprehensible input dialogues at your level with natural conversations and audio"
              buttonText="Get Started"
              route="/app/studio/create/dialogue"
              colorTheme={{
                bg: 'bg-indigo-50',
                text: 'text-indigo-600',
                border: 'border-indigo-200',
                button: 'bg-indigo-600 hover:bg-indigo-700',
              }}
            />
          )}
          {filter === 'courses' && (
            <EmptyStateCard
              icon={Headphones}
              title="Create Your First Audio Course"
              description="Build guided audio courses with structured lessons and pronunciation practice"
              buttonText="Get Started"
              route="/app/studio/create/audio-course"
              colorTheme={{
                bg: 'bg-orange-50',
                text: 'text-orange-600',
                border: 'border-orange-200',
                button: 'bg-orange-600 hover:bg-orange-700',
              }}
            />
          )}
          {filter === 'narrowListening' && (
            <EmptyStateCard
              icon={Sparkles}
              title="Create Your First Narrow Listening Pack"
              description="Practice with story variations at your level for focused listening comprehension"
              buttonText="Get Started"
              route="/app/studio/create/narrow-listening"
              colorTheme={{
                bg: 'bg-purple-50',
                text: 'text-purple-600',
                border: 'border-purple-200',
                button: 'bg-purple-600 hover:bg-purple-700',
              }}
            />
          )}
          {filter === 'chunkPacks' && (
            <EmptyStateCard
              icon={BookOpen}
              title="Create Your First Lexical Chunk Pack"
              description="Master high-frequency expressions with examples, stories, and interactive exercises"
              buttonText="Get Started"
              route="/app/studio/create/lexical-chunk-pack"
              colorTheme={{
                bg: 'bg-emerald-50',
                text: 'text-emerald-600',
                border: 'border-emerald-200',
                button: 'bg-emerald-600 hover:bg-emerald-700',
              }}
            />
          )}
          {filter === 'all' && (
            <div className="card">
              <div className="text-center py-12 space-y-4">
                <p className="text-gray-500">
                  No content yet. Get started by creating your first learning material!
                </p>
                <button
                  onClick={() => window.location.href = '/app/studio'}
                  className="btn-primary inline-flex items-center gap-2"
                  data-testid="library-button-browse-all"
                >
                  Browse All Options
                  <span>→</span>
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allItems.map((item) => {
            if (item.type === 'episode') {
              const episode = item.data as Episode;
              // Get unique proficiency levels from speakers
              const proficiencyLevels = episode.dialogue?.speakers
                ? [...new Set(episode.dialogue.speakers.map(s => s.proficiency))]
                : [];

              return (
                <Link
                  key={episode.id}
                  to={`/app/playback/${episode.id}`}
                  className="card hover:shadow-lg transition-shadow cursor-pointer group relative border-l-4 border-indigo"
                  data-testid={`library-episode-card-${episode.id}`}
                >
                  {/* Delete Button - appears on hover */}
                  <button
                    onClick={(e) => handleDeleteClick(episode, e)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                    title="Delete episode"
                    data-testid={`library-delete-episode-${episode.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex flex-col h-full">
                    <div className="space-y-3 flex-1">
                      {/* Title */}
                      <h3 className="text-xl font-bold text-navy group-hover:text-indigo transition-colors">
                        {episode.title}
                      </h3>

                      {/* Card Type with Icon */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Dialogue</span>
                      </div>

                      {/* Source Text Preview */}
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {episode.sourceText}
                      </p>
                    </div>

                    {/* Language Info and Levels - Always at bottom */}
                    <div className="flex gap-2 text-sm flex-wrap pt-3 mt-auto border-t">
                      {proficiencyLevels.length > 0 ? (
                        <SegmentedPill
                          leftText={episode.targetLanguage.toUpperCase()}
                          rightText={proficiencyLevels.join(', ')}
                          leftColor="pale-sky"
                          rightColor="indigo"
                        />
                      ) : (
                        <Pill color="pale-sky">
                          {episode.targetLanguage.toUpperCase()}
                        </Pill>
                      )}
                      {episode.status === 'generating' && (
                        <Pill color="yellow" className="animate-pulse">
                          Generating...
                        </Pill>
                      )}
                    </div>
                  </div>
                </Link>
              );
            } else if (item.type === 'course') {
              const course = item.data as LibraryCourse;

              return (
                <Link
                  key={course.id}
                  to={`/app/courses/${course.id}`}
                  className="card hover:shadow-lg transition-shadow cursor-pointer group relative bg-gradient-to-br from-indigo-50 to-purple-50 border-l-4 border-orange-500"
                  data-testid={`library-course-card-${course.id}`}
                >
                  {/* Delete Button - appears on hover */}
                  <button
                    onClick={(e) => handleDeleteCourseClick(course, e)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                    title="Delete course"
                    data-testid={`library-delete-course-${course.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex flex-col h-full">
                    <div className="space-y-3 flex-1">
                      {/* Title */}
                      <h3 className="text-xl font-bold text-navy group-hover:text-orange-500 transition-colors">
                        {course.title}
                      </h3>

                      {/* Card Type with Icon */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Headphones className="w-3.5 h-3.5" />
                        <span>Audio Course</span>
                      </div>

                      {/* Description */}
                      {course.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {course.description}
                        </p>
                      )}
                    </div>

                    {/* Language Info and JLPT Level - Always at bottom */}
                    <div className="flex items-center gap-2 text-sm flex-wrap pt-3 mt-auto border-t">
                      {course.jlptLevel ? (
                        <SegmentedPill
                          leftText={`${course.targetLanguage.toUpperCase()} → ${course.nativeLanguage.toUpperCase()}`}
                          rightText={course.jlptLevel}
                          leftColor="purple"
                          rightColor="indigo"
                        />
                      ) : (
                        <Pill color="purple">
                          {course.targetLanguage.toUpperCase()} → {course.nativeLanguage.toUpperCase()}
                        </Pill>
                      )}
                      {course.status === 'generating' && (
                        <Pill color="yellow" className="animate-pulse">
                          Generating...
                        </Pill>
                      )}
                      {course._count?.lessons != null && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <BookOpen className="w-3 h-3" />
                          {course._count.lessons} {course._count.lessons === 1 ? 'lesson' : 'lessons'}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            } else if (item.type === 'narrowListening') {
              const pack = item.data as NarrowListeningPack;

              return (
                <Link
                  key={pack.id}
                  to={`/app/narrow-listening/${pack.id}`}
                  className="card hover:shadow-lg transition-shadow cursor-pointer group relative bg-gradient-to-br from-purple-50 to-pink-50 border-l-4 border-purple-600"
                  data-testid={`library-pack-card-${pack.id}`}
                >
                  {/* Delete Button - appears on hover */}
                  <button
                    onClick={(e) => handleDeletePackClick(pack, e)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                    title="Delete pack"
                    data-testid={`library-delete-pack-${pack.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex flex-col h-full">
                    <div className="space-y-3 flex-1">
                      {/* Title */}
                      <h3 className="text-xl font-bold text-navy group-hover:text-purple-600 transition-colors">
                        {pack.title}
                      </h3>

                      {/* Card Type with Icon */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Narrow Listening</span>
                      </div>

                      {/* Topic Preview */}
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {pack.topic}
                      </p>
                    </div>

                    {/* JLPT Level and Variations */}
                    <div className="flex gap-2 text-sm flex-wrap pt-3 mt-auto border-t">
                      <SegmentedPill
                        leftText={pack.jlptLevel}
                        rightText={`${pack._count.versions} variations`}
                        leftColor="purple"
                        rightColor="indigo"
                      />
                      {pack.status === 'generating' && (
                        <Pill color="yellow" className="animate-pulse">
                          Generating...
                        </Pill>
                      )}
                    </div>
                  </div>
                </Link>
              );
            } else if (item.type === 'chunkPack') {
              const pack = item.data as ChunkPack;

              return (
                <Link
                  key={pack.id}
                  to={`/app/chunk-packs/${pack.id}/examples`}
                  className="card hover:shadow-lg transition-shadow cursor-pointer group relative bg-gradient-to-br from-emerald-50 to-teal-50 border-l-4 border-emerald-600"
                  data-testid={`library-chunk-pack-card-${pack.id}`}
                >
                  {/* Delete Button - appears on hover */}
                  <button
                    onClick={(e) => handleDeleteChunkPackClick(pack, e)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                    title="Delete lexical chunk pack"
                    data-testid={`library-delete-chunk-pack-${pack.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex flex-col h-full">
                    <div className="space-y-3 flex-1">
                      {/* Title */}
                      <h3 className="text-xl font-bold text-navy group-hover:text-emerald-600 transition-colors">
                        {pack.title}
                      </h3>

                      {/* Card Type with Icon */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Lexical Chunk Pack</span>
                      </div>

                      {/* Theme */}
                      <p className="text-sm text-gray-600 capitalize">
                        {pack.theme.replace(/_/g, ' ')}
                      </p>
                    </div>

                    {/* JLPT Level and Stats */}
                    <div className="flex gap-2 text-sm flex-wrap pt-3 mt-auto border-t">
                      <SegmentedPill
                        leftText={pack.jlptLevel}
                        rightText={`${pack._count.examples} examples`}
                        leftColor="emerald"
                        rightColor="blue"
                      />
                      <Pill color="indigo">
                        {pack._count.stories} {pack._count.stories === 1 ? 'story' : 'stories'}
                      </Pill>
                      <Pill color="purple">
                        {pack._count.exercises} exercises
                      </Pill>
                      {pack.status === 'error' && (
                        <Pill color="red">
                          error
                        </Pill>
                      )}
                      {pack.status === 'generating' && (
                        <Pill color="yellow" className="animate-pulse">
                          Generating...
                        </Pill>
                      )}
                    </div>
                  </div>
                </Link>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Delete Episode Confirmation Modal */}
      <ConfirmModal
        isOpen={episodeToDelete !== null}
        title="Delete Episode"
        message={`Are you sure you want to delete "${episodeToDelete?.title}"? This action cannot be undone and will delete all associated dialogue, audio, and images.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={isDeleting}
      />

      {/* Delete Course Confirmation Modal */}
      <ConfirmModal
        isOpen={courseToDelete !== null}
        title="Delete Audio Course"
        message={`Are you sure you want to delete "${courseToDelete?.title}"? This action cannot be undone and will delete all associated lessons and audio files.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDeleteCourse}
        onCancel={handleCancelDelete}
        isLoading={isDeleting}
      />

      {/* Delete Narrow Listening Pack Confirmation Modal */}
      <ConfirmModal
        isOpen={packToDelete !== null}
        title="Delete Narrow Listening Pack"
        message={`Are you sure you want to delete "${packToDelete?.title}"? This action cannot be undone and will delete all story versions and audio files.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDeletePack}
        onCancel={handleCancelDelete}
        isLoading={isDeleting}
      />

      {/* Delete Chunk Pack Confirmation Modal */}
      <ConfirmModal
        isOpen={chunkPackToDelete !== null}
        title="Delete Lexical Chunk Pack"
        message={`Are you sure you want to delete "${chunkPackToDelete?.title}"? This action cannot be undone and will delete all chunks, examples, stories, exercises, and audio files.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDeleteChunkPack}
        onCancel={handleCancelDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
