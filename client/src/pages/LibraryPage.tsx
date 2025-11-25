import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trash2, BookOpen, MessageSquare, Headphones, Sparkles } from 'lucide-react';
import { Episode, Course } from '../types';
import { useLibraryData, LibraryCourse, NarrowListeningPack, ChunkPack } from '../hooks/useLibraryData';
import ConfirmModal from '../components/common/ConfirmModal';
import EmptyStateCard from '../components/EmptyStateCard';
import LanguageLevelPill from '../components/common/LanguageLevelPill';
import LanguageLevelSidebar from '../components/common/LanguageLevelSidebar';
import Pill from '../components/common/Pill';

type FilterType = 'all' | 'dialogues' | 'courses' | 'narrowListening' | 'chunkPacks';

export default function LibraryPage() {
  const {
    episodes,
    courses,
    narrowListeningPacks,
    chunkPacks,
    isLoading,
    error,
    deleteEpisode,
    deleteCourse,
    deleteNarrowListeningPack,
    deleteChunkPack,
    isDeletingEpisode,
    isDeletingCourse,
    isDeletingNarrowListening,
    isDeletingChunkPack,
  } = useLibraryData();

  const [searchParams, setSearchParams] = useSearchParams();
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<LibraryCourse | null>(null);
  const [packToDelete, setPackToDelete] = useState<NarrowListeningPack | null>(null);
  const [chunkPackToDelete, setChunkPackToDelete] = useState<ChunkPack | null>(null);

  // Combined deleting state for modal
  const isDeleting = isDeletingEpisode || isDeletingCourse || isDeletingNarrowListening || isDeletingChunkPack;

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

  const handleDeleteClick = (episode: Episode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEpisodeToDelete(episode);
  };

  const handleConfirmDelete = async () => {
    if (!episodeToDelete) return;

    try {
      await deleteEpisode(episodeToDelete.id);
      setEpisodeToDelete(null);
    } catch (err) {
      console.error('Failed to delete episode:', err);
    }
  };

  const handleDeletePackClick = (pack: NarrowListeningPack, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPackToDelete(pack);
  };

  const handleConfirmDeletePack = async () => {
    if (!packToDelete) return;

    try {
      await deleteNarrowListeningPack(packToDelete.id);
      setPackToDelete(null);
    } catch (err) {
      console.error('Failed to delete pack:', err);
      alert('Failed to delete pack. Please try again.');
    }
  };

  const handleDeleteChunkPackClick = (pack: ChunkPack, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChunkPackToDelete(pack);
  };

  const handleConfirmDeleteChunkPack = async () => {
    if (!chunkPackToDelete) return;

    try {
      await deleteChunkPack(chunkPackToDelete.id);
      setChunkPackToDelete(null);
    } catch (err) {
      console.error('Failed to delete chunk pack:', err);
      alert('Failed to delete chunk pack. Please try again.');
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

    try {
      await deleteCourse(courseToDelete.id);
      setCourseToDelete(null);
    } catch (err) {
      console.error('Failed to delete course:', err);
      alert('Failed to delete course. Please try again.');
    }
  };

  // Memoize filtered and sorted items to avoid expensive recalculations
  const allItems = useMemo(() => {
    // Filter content based on selected filter
    const filteredEpisodes = (filter === 'courses' || filter === 'narrowListening' || filter === 'chunkPacks') ? [] : episodes;
    const filteredCourses = (filter === 'dialogues' || filter === 'narrowListening' || filter === 'chunkPacks') ? [] : courses;
    const filteredPacks = (filter === 'dialogues' || filter === 'courses' || filter === 'chunkPacks') ? [] : narrowListeningPacks;
    const filteredChunkPacks = (filter === 'dialogues' || filter === 'courses' || filter === 'narrowListening') ? [] : chunkPacks;

    // Combine and sort by date
    return [
      ...filteredEpisodes.map(ep => ({ type: 'episode' as const, data: ep, date: new Date(ep.createdAt) })),
      ...filteredCourses.map(course => ({ type: 'course' as const, data: course, date: new Date(course.createdAt) })),
      ...filteredPacks.map(pack => ({ type: 'narrowListening' as const, data: pack, date: new Date(pack.createdAt) })),
      ...filteredChunkPacks.map(pack => ({ type: 'chunkPack' as const, data: pack, date: new Date(pack.createdAt) }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filter, episodes, courses, narrowListeningPacks, chunkPacks]);

  if (isLoading) {
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
          <button onClick={() => window.location.reload()} className="btn-outline">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-center sm:justify-end mb-6">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
          <button
            onClick={() => handleFilterChange('dialogues')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              filter === 'dialogues'
                ? 'bg-periwinkle text-white'
                : 'bg-periwinkle-light text-periwinkle-dark hover:bg-periwinkle/20'
            }`}
            data-testid="library-filter-dialogues"
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Dialogues
          </button>
          <button
            onClick={() => handleFilterChange('courses')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              filter === 'courses'
                ? 'bg-coral text-white'
                : 'bg-coral-light text-coral-dark hover:bg-coral/20'
            }`}
            data-testid="library-filter-courses"
          >
            <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Audio Courses
          </button>
          <button
            onClick={() => handleFilterChange('narrowListening')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              filter === 'narrowListening'
                ? 'bg-strawberry text-white'
                : 'bg-strawberry-light text-strawberry-dark hover:bg-strawberry/20'
            }`}
            data-testid="library-filter-narrow-listening"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Narrow Listening
          </button>
          <button
            onClick={() => handleFilterChange('chunkPacks')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              filter === 'chunkPacks'
                ? 'bg-yellow text-dark-brown'
                : 'bg-yellow-light text-dark-brown hover:bg-yellow/20'
            }`}
            data-testid="library-filter-chunk-packs"
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
              route="/app/create/dialogue"
              colorTheme={{
                bg: 'bg-periwinkle-light',
                text: 'text-periwinkle-dark',
                border: 'border-periwinkle',
                button: 'bg-periwinkle hover:bg-periwinkle-dark',
              }}
            />
          )}
          {filter === 'courses' && (
            <EmptyStateCard
              icon={Headphones}
              title="Create Your First Audio Course"
              description="Build guided audio courses with structured lessons and pronunciation practice"
              buttonText="Get Started"
              route="/app/create/audio-course"
              colorTheme={{
                bg: 'bg-coral-light',
                text: 'text-coral-dark',
                border: 'border-coral',
                button: 'bg-coral hover:bg-coral-dark',
              }}
            />
          )}
          {filter === 'narrowListening' && (
            <EmptyStateCard
              icon={Sparkles}
              title="Create Your First Narrow Listening Pack"
              description="Practice with story variations at your level for focused listening comprehension"
              buttonText="Get Started"
              route="/app/create/narrow-listening"
              colorTheme={{
                bg: 'bg-strawberry-light',
                text: 'text-strawberry-dark',
                border: 'border-strawberry',
                button: 'bg-strawberry hover:bg-strawberry-dark',
              }}
            />
          )}
          {filter === 'chunkPacks' && (
            <EmptyStateCard
              icon={BookOpen}
              title="Create Your First Lexical Chunk Pack"
              description="Master high-frequency expressions with examples, stories, and interactive exercises"
              buttonText="Get Started"
              route="/app/create/lexical-chunk-pack"
              colorTheme={{
                bg: 'bg-yellow-light',
                text: 'text-dark-brown',
                border: 'border-yellow',
                button: 'bg-yellow hover:bg-yellow-dark text-dark-brown',
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
                  onClick={() => window.location.href = '/app/create'}
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
        <div className="space-y-1">
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
                  className="group relative flex items-stretch bg-white hover:bg-periwinkle-light transition-all duration-200 hover:shadow-lg"
                  data-testid={`library-episode-card-${episode.id}`}
                >
                  {/* Icon Sidebar */}
                  <div className="w-16 sm:w-24 flex-shrink-0 bg-periwinkle flex flex-col items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 px-2 sm:px-1">
                    <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    <span className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wide text-center leading-tight">Dialogue</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-3 sm:px-6 py-3 sm:py-5 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-4">
                      {/* Left: Title and metadata */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="text-lg sm:text-2xl font-bold text-dark-brown group-hover:text-periwinkle transition-colors truncate mb-1 sm:mb-2">
                          {episode.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">
                          {episode.sourceText}
                        </p>
                      </div>

                      {/* Right: Badges and actions */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto">
                        {proficiencyLevels.length > 0 && (
                          <LanguageLevelPill
                            className="hidden sm:inline-flex"
                            language={episode.targetLanguage}
                            level={proficiencyLevels.join(', ')}
                          />
                        )}
                        {episode.status === 'generating' && (
                          <Pill color="yellow" className="animate-pulse">
                            Generating...
                          </Pill>
                        )}
                        <button
                          onClick={(e) => handleDeleteClick(episode, e)}
                          className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete episode"
                          data-testid={`library-delete-episode-${episode.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Language/Level Sidebar (mobile only) */}
                  {proficiencyLevels.length > 0 && (
                    <LanguageLevelSidebar
                      className="sm:hidden"
                      language={episode.targetLanguage.toUpperCase()}
                      level={proficiencyLevels.join(', ')}
                    />
                  )}
                </Link>
              );
            } else if (item.type === 'course') {
              const course = item.data as LibraryCourse;

              return (
                <Link
                  key={course.id}
                  to={`/app/courses/${course.id}`}
                  className="group relative flex items-stretch bg-white hover:bg-coral-light transition-all duration-200 hover:shadow-lg"
                  data-testid={`library-course-card-${course.id}`}
                >
                  {/* Icon Sidebar */}
                  <div className="w-16 sm:w-24 flex-shrink-0 bg-coral flex flex-col items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 px-2 sm:px-1">
                    <Headphones className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    <span className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wide text-center leading-tight">Audio<br/>Course</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-3 sm:px-6 py-3 sm:py-5 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-4">
                      {/* Left: Title and metadata */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="text-lg sm:text-2xl font-bold text-dark-brown group-hover:text-coral transition-colors truncate mb-1 sm:mb-2">
                          {course.title}
                        </h3>
                        {course.description && (
                          <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">
                            {course.description}
                          </p>
                        )}
                      </div>

                      {/* Right: Badges and actions */}
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto">
                        {course.status === 'generating' && (
                          <Pill color="yellow" className="animate-pulse">
                            Generating...
                          </Pill>
                        )}
                        {course.jlptLevel && (
                          <LanguageLevelPill
                            className="hidden sm:inline-flex"
                            language={course.targetLanguage}
                            level={course.jlptLevel}
                          />
                        )}
                        <button
                          onClick={(e) => handleDeleteCourseClick(course, e)}
                          className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete course"
                          data-testid={`library-delete-course-${course.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Language/Level Sidebar (mobile only) */}
                  {course.jlptLevel && (
                    <LanguageLevelSidebar
                      className="sm:hidden"
                      language={course.targetLanguage.toUpperCase()}
                      level={course.jlptLevel}
                    />
                  )}
                </Link>
              );
            } else if (item.type === 'narrowListening') {
              const pack = item.data as NarrowListeningPack;

              return (
                <Link
                  key={pack.id}
                  to={`/app/narrow-listening/${pack.id}`}
                  className="group relative flex items-stretch bg-white hover:bg-strawberry-light transition-all duration-200 hover:shadow-lg"
                  data-testid={`library-pack-card-${pack.id}`}
                >
                  {/* Icon Sidebar */}
                  <div className="w-16 sm:w-24 flex-shrink-0 bg-strawberry flex flex-col items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 px-2 sm:px-1">
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    <span className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wide text-center leading-tight">Narrow<br/>Listening</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-3 sm:px-6 py-3 sm:py-5 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-4">
                      {/* Left: Title and metadata */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="text-lg sm:text-2xl font-bold text-dark-brown group-hover:text-strawberry transition-colors truncate mb-1 sm:mb-2">
                          {pack.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">
                          {pack.topic}
                        </p>
                      </div>

                      {/* Right: Badges and actions */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto">
                        <LanguageLevelPill
                          className="hidden sm:inline-flex"
                          language={pack.targetLanguage}
                          level={pack.jlptLevel}
                        />
                        {pack.status === 'generating' && (
                          <Pill color="yellow" className="animate-pulse">
                            Generating...
                          </Pill>
                        )}
                        <button
                          onClick={(e) => handleDeletePackClick(pack, e)}
                          className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete pack"
                          data-testid={`library-delete-pack-${pack.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Language/Level Sidebar (mobile only) */}
                  <LanguageLevelSidebar
                    className="sm:hidden"
                    language={pack.targetLanguage.toUpperCase()}
                    level={pack.jlptLevel}
                  />
                </Link>
              );
            } else if (item.type === 'chunkPack') {
              const pack = item.data as ChunkPack;

              return (
                <Link
                  key={pack.id}
                  to={`/app/chunk-packs/${pack.id}/examples`}
                  className="group relative flex items-stretch bg-white hover:bg-yellow-light transition-all duration-200 hover:shadow-lg"
                  data-testid={`library-chunk-pack-card-${pack.id}`}
                >
                  {/* Icon Sidebar */}
                  <div className="w-16 sm:w-24 flex-shrink-0 bg-yellow flex flex-col items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 px-2 sm:px-1">
                    <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-dark-brown" />
                    <span className="text-[10px] sm:text-xs font-bold text-dark-brown uppercase tracking-wide text-center leading-tight">Chunk<br/>Pack</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-3 sm:px-6 py-3 sm:py-5 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-4">
                      {/* Left: Title and metadata */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="text-lg sm:text-2xl font-bold text-dark-brown group-hover:text-yellow-dark transition-colors truncate mb-1 sm:mb-2">
                          {pack.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 capitalize line-clamp-1">
                          {pack.theme.replace(/_/g, ' ')}
                        </p>
                      </div>

                      {/* Right: Badges and actions */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto">
                        <LanguageLevelPill
                          className="hidden sm:inline-flex"
                          language={pack.targetLanguage}
                          level={pack.jlptLevel}
                        />
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
                        <button
                          onClick={(e) => handleDeleteChunkPackClick(pack, e)}
                          className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete lexical chunk pack"
                          data-testid={`library-delete-chunk-pack-${pack.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Language/Level Sidebar (mobile only) */}
                  <LanguageLevelSidebar
                    className="sm:hidden"
                    language={pack.targetLanguage.toUpperCase()}
                    level={pack.jlptLevel}
                  />
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
        isLoading={isDeletingEpisode}
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
        isLoading={isDeletingCourse}
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
        isLoading={isDeletingNarrowListening}
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
        isLoading={isDeletingChunkPack}
      />
    </div>
  );
}
