import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, Trash2, BookOpen, MessageSquare, Headphones, Sparkles } from 'lucide-react';
import { Episode, Course } from '../types';
import { useEpisodes } from '../hooks/useEpisodes';
import ConfirmModal from '../components/common/ConfirmModal';

import { API_URL } from '../config';

interface NarrowListeningPack {
  id: string;
  title: string;
  topic: string;
  jlptLevel: string;
  status: string;
  createdAt: string;
  versions: Array<{ id: string; title: string }>;
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [narrowListeningPacks, setNarrowListeningPacks] = useState<NarrowListeningPack[]>([]);
  const [chunkPacks, setChunkPacks] = useState<ChunkPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
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
      const response = await fetch(`${API_URL}/api/episodes`, {
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
      const response = await fetch(`${API_URL}/api/courses`, {
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
      const response = await fetch(`${API_URL}/api/narrow-listening`, {
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
      const response = await fetch(`${API_URL}/api/chunk-packs`, {
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
          >
            <BookOpen className="w-4 h-4" />
            Lexical Chunk Packs
          </button>
        </div>
      </div>

      {allItems.length === 0 ? (
        <div className="card">
          <p className="text-gray-500 text-center py-12">
            {filter === 'dialogues' && 'No dialogues yet. Create your first dialogue to get started!'}
            {filter === 'courses' && 'No audio courses yet. Create your first audio course to get started!'}
            {filter === 'narrowListening' && 'No narrow listening packs yet. Create your first pack to get started!'}
            {filter === 'chunkPacks' && 'No lexical chunk packs yet. Create your first lexical chunk pack to get started!'}
            {filter === 'all' && 'No content yet. Create a dialogue, audio course, narrow listening pack, or lexical chunk pack to get started!'}
          </p>
        </div>
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
                  to={`/playback/${episode.id}`}
                  className="card hover:shadow-lg transition-shadow cursor-pointer group relative border-l-4 border-indigo"
                >
                  {/* Delete Button - appears on hover */}
                  <button
                    onClick={(e) => handleDeleteClick(episode, e)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                    title="Delete episode"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="space-y-3">
                    {/* Title with Icon */}
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo flex-shrink-0 mt-1" />
                      <h3 className="text-xl font-bold text-navy group-hover:text-indigo transition-colors flex-1">
                        {episode.title}
                      </h3>
                    </div>

                    {/* Language Info and Levels */}
                    <div className="flex gap-2 text-sm flex-wrap">
                      <span className="px-2 py-1 bg-pale-sky text-navy rounded font-medium">
                        {episode.targetLanguage.toUpperCase()}
                      </span>
                      {proficiencyLevels.length > 0 && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-medium capitalize">
                          {proficiencyLevels.join(', ')}
                        </span>
                      )}
                      {episode.status === 'generating' && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium animate-pulse">
                          Generating...
                        </span>
                      )}
                    </div>

                    {/* Source Text Preview */}
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {episode.sourceText}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(episode.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            } else if (item.type === 'course') {
              const course = item.data as Course;

              return (
                <Link
                  key={course.id}
                  to={`/courses/${course.id}`}
                  className="card hover:shadow-lg transition-shadow cursor-pointer group relative bg-gradient-to-br from-indigo-50 to-purple-50 border-l-4 border-orange-500"
                >
                  {/* Delete Button - appears on hover */}
                  <button
                    onClick={(e) => handleDeleteCourseClick(course, e)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                    title="Delete course"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="space-y-3">
                    {/* Title with Icon */}
                    <div className="flex items-start gap-2">
                      <Headphones className="w-5 h-5 text-orange-500 flex-shrink-0 mt-1" />
                      <h3 className="text-xl font-bold text-navy group-hover:text-orange-500 transition-colors flex-1">
                        {course.title}
                      </h3>
                    </div>

                    {/* Description */}
                    {course.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {course.description}
                      </p>
                    )}

                    {/* Language Info and JLPT Level */}
                    <div className="flex gap-2 text-sm flex-wrap">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">
                        {course.targetLanguage.toUpperCase()} → {course.nativeLanguage.toUpperCase()}
                      </span>
                      {course.jlptLevel && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-medium">
                          {course.jlptLevel}
                        </span>
                      )}
                      {course.status === 'generating' && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium animate-pulse">
                          Generating...
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(course.createdAt).toLocaleDateString()}
                      </div>
                      {course.lessons && (
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {course.lessons.length} {course.lessons.length === 1 ? 'lesson' : 'lessons'}
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
                  to={`/narrow-listening/${pack.id}`}
                  className="card hover:shadow-lg transition-shadow cursor-pointer group relative bg-gradient-to-br from-purple-50 to-pink-50 border-l-4 border-purple-600"
                >
                  {/* Delete Button - appears on hover */}
                  <button
                    onClick={(e) => handleDeletePackClick(pack, e)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                    title="Delete pack"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="space-y-3">
                    {/* Title with Icon */}
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                      <h3 className="text-xl font-bold text-navy group-hover:text-purple-600 transition-colors flex-1">
                        {pack.title}
                      </h3>
                    </div>

                    {/* Topic Preview */}
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {pack.topic}
                    </p>

                    {/* JLPT Level and Variations */}
                    <div className="flex gap-2 text-sm flex-wrap">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">
                        {pack.jlptLevel}
                      </span>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-medium">
                        {pack.versions?.length || 0} variations
                      </span>
                      {pack.status === 'generating' && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium animate-pulse">
                          Generating...
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(pack.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            } else if (item.type === 'chunkPack') {
              const pack = item.data as ChunkPack;

              return (
                <Link
                  key={pack.id}
                  to={`/chunk-packs/${pack.id}/examples`}
                  className="card hover:shadow-lg transition-shadow cursor-pointer group relative bg-gradient-to-br from-emerald-50 to-teal-50 border-l-4 border-emerald-600"
                >
                  {/* Delete Button - appears on hover */}
                  <button
                    onClick={(e) => handleDeleteChunkPackClick(pack, e)}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                    title="Delete lexical chunk pack"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="space-y-3">
                    {/* Title with Icon */}
                    <div className="flex items-start gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-1" />
                      <h3 className="text-xl font-bold text-navy group-hover:text-emerald-600 transition-colors flex-1">
                        {pack.title}
                      </h3>
                    </div>

                    {/* Theme */}
                    <p className="text-sm text-gray-600 capitalize">
                      {pack.theme.replace(/_/g, ' ')}
                    </p>

                    {/* JLPT Level and Stats */}
                    <div className="flex gap-2 text-sm flex-wrap">
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-medium">
                        {pack.jlptLevel}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                        {pack._count.examples} examples
                      </span>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-medium">
                        {pack._count.stories} {pack._count.stories === 1 ? 'story' : 'stories'}
                      </span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">
                        {pack._count.exercises} exercises
                      </span>
                      {pack.status === 'error' && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
                          error
                        </span>
                      )}
                      {pack.status === 'generating' && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium animate-pulse">
                          Generating...
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(pack.createdAt).toLocaleDateString()}
                      </div>
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
