import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2, BookOpen, MessageSquare, Headphones, Sparkles, Loader2 } from 'lucide-react';
import { Episode, Course } from '../types';
import {
  useLibraryData,
  LibraryCourse,
  NarrowListeningPack,
  ChunkPack,
} from '../hooks/useLibraryData';
import { useIsDemo } from '../hooks/useDemo';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/common/ConfirmModal';
import SampleContentGuide from '../components/pulsePoints/SampleContentGuide';
import EmptyStateCard from '../components/EmptyStateCard';
import LanguageLevelPill from '../components/common/LanguageLevelPill';
import LanguageLevelSidebar from '../components/common/LanguageLevelSidebar';
import Pill from '../components/common/Pill';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ErrorDisplay from '../components/ErrorDisplay';
import ImpersonationBanner from '../components/ImpersonationBanner';
import { API_URL } from '../config';

type FilterType = 'all' | 'dialogues' | 'courses' | 'narrowListening' | 'chunkPacks';

const LibraryPage = () => {
  const { t } = useTranslation(['library', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;

  const {
    episodes,
    courses,
    narrowListeningPacks,
    chunkPacks,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    deleteEpisode,
    deleteCourse,
    deleteNarrowListeningPack,
    deleteChunkPack,
    isDeletingEpisode,
    isDeletingCourse,
    isDeletingNarrowListening,
    isDeletingChunkPack,
  } = useLibraryData(viewAsUserId);
  const isDemo = useIsDemo();
  const { isFeatureEnabled } = useFeatureFlags();
  const { user, updateUser } = useAuth();

  // Show sample content guide for users who completed onboarding but haven't seen it
  const [showSampleGuide, setShowSampleGuide] = useState(false);

  useEffect(() => {
    // Show guide if user completed onboarding, hasn't seen the guide, and isn't viewing as another user
    if (user?.onboardingCompleted && !user?.seenSampleContentGuide && !viewAsUserId && !isDemo) {
      setShowSampleGuide(true);
    }
  }, [user, viewAsUserId, isDemo]);

  const handleCloseSampleGuide = async () => {
    setShowSampleGuide(false);
    // Mark as seen so it doesn't show again
    if (user && !user.seenSampleContentGuide) {
      try {
        await updateUser({ seenSampleContentGuide: true });
      } catch (err) {
        console.err('Failed to update seenSampleContentGuide:', error);
      }
    }
  };

  // Fetch impersonated user info if viewing as another user
  const [impersonatedUser, setImpersonatedUser] = useState<{ name: string; email: string } | null>(
    null
  );

  useEffect(() => {
    if (viewAsUserId) {
      fetch(`${API_URL}/api/admin/users/${viewAsUserId}/info`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((impUser) => {
          setImpersonatedUser({
            name: impUser.displayName || impUser.name,
            email: impUser.email,
          });
        })
        .catch((err) => {
          console.error('Failed to fetch impersonated user:', err);
        });
    } else {
      setImpersonatedUser(null);
    }
  }, [viewAsUserId]);
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<LibraryCourse | null>(null);
  const [packToDelete, setPackToDelete] = useState<NarrowListeningPack | null>(null);
  const [chunkPackToDelete, setChunkPackToDelete] = useState<ChunkPack | null>(null);

  // Combined deleting state for modal
  const isDeleting =
    isDeletingEpisode || isDeletingCourse || isDeletingNarrowListening || isDeletingChunkPack;

  // Map between URL params (kebab-case) and internal filter types (camelCase)
  const filterParamToType: Record<string, FilterType> = {
    all: 'all',
    dialogues: 'dialogues',
    courses: 'courses',
    'narrow-listening': 'narrowListening',
    'lexical-chunk-packs': 'chunkPacks',
  };

  const filterTypeToParam: Record<FilterType, string> = {
    all: 'all',
    dialogues: 'dialogues',
    courses: 'courses',
    narrowListening: 'narrow-listening',
    chunkPacks: 'lexical-chunk-packs',
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

  // Infinite scroll setup
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
      // eslint-disable-next-line no-alert
      alert(t('library:delete.alertError', { type: 'pack' }));
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
      // eslint-disable-next-line no-alert
      alert(t('library:delete.alertError', { type: 'chunk pack' }));
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
      alert(t('library:delete.alertError', { type: 'course' }));
    }
  };

  // Memoize filtered and sorted items to avoid expensive recalculations
  const allItems = useMemo(() => {
    // Filter content based on selected filter
    const filteredEpisodes =
      filter === 'courses' || filter === 'narrowListening' || filter === 'chunkPacks'
        ? []
        : episodes;
    const filteredCourses =
      filter === 'dialogues' || filter === 'narrowListening' || filter === 'chunkPacks'
        ? []
        : courses;
    const filteredPacks =
      filter === 'dialogues' || filter === 'courses' || filter === 'chunkPacks'
        ? []
        : narrowListeningPacks;
    const filteredChunkPacks =
      filter === 'dialogues' || filter === 'courses' || filter === 'narrowListening'
        ? []
        : chunkPacks;

    // Combine and sort by date
    return [
      ...filteredEpisodes.map((ep) => ({
        type: 'episode' as const,
        data: ep,
        date: new Date(ep.createdAt),
      })),
      ...filteredCourses.map((course) => ({
        type: 'course' as const,
        data: course,
        date: new Date(course.createdAt),
      })),
      ...filteredPacks.map((pack) => ({
        type: 'narrowListening' as const,
        data: pack,
        date: new Date(pack.createdAt),
      })),
      ...filteredChunkPacks.map((pack) => ({
        type: 'chunkPack' as const,
        data: pack,
        date: new Date(pack.createdAt),
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filter, episodes, courses, narrowListeningPacks, chunkPacks]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={() => window.location.reload()} />;
  }

  // Handler to exit impersonation
  const handleExitImpersonation = () => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('viewAs');
      return params;
    });
  };

  return (
    <div>
      {/* Impersonation Banner */}
      {impersonatedUser && (
        <ImpersonationBanner impersonatedUser={impersonatedUser} onExit={handleExitImpersonation} />
      )}

      <div className="flex items-center justify-center sm:justify-end mb-6 px-4 sm:px-0">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
          {isFeatureEnabled('dialoguesEnabled') && (
            <button type="button"
              onClick={() => handleFilterChange('dialogues')}
              className={`px-3 sm:px-4 py-3.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                filter === 'dialogues'
                  ? 'bg-periwinkle text-white'
                  : 'bg-periwinkle-light text-periwinkle-dark hover:bg-periwinkle/20'
              }`}
              data-testid="library-filter-dialogues"
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {t('library:filters.dialogues')}
            </button>
          )}
          {isFeatureEnabled('audioCourseEnabled') && (
            <button type="button"
              onClick={() => handleFilterChange('courses')}
              className={`px-3 sm:px-4 py-3.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                filter === 'courses'
                  ? 'bg-coral text-white'
                  : 'bg-coral-light text-coral-dark hover:bg-coral/20'
              }`}
              data-testid="library-filter-courses"
            >
              <Headphones className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {t('library:filters.courses')}
            </button>
          )}
          {isFeatureEnabled('narrowListeningEnabled') && (
            <button type="button"
              onClick={() => handleFilterChange('narrowListening')}
              className={`px-3 sm:px-4 py-3.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                filter === 'narrowListening'
                  ? 'bg-strawberry text-white'
                  : 'bg-strawberry-light text-strawberry-dark hover:bg-strawberry/20'
              }`}
              data-testid="library-filter-narrow-listening"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {t('library:filters.narrowListening')}
            </button>
          )}
          {isFeatureEnabled('lexicalChunksEnabled') && (
            <button type="button"
              onClick={() => handleFilterChange('chunkPacks')}
              className={`px-3 sm:px-4 py-3.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                filter === 'chunkPacks'
                  ? 'bg-yellow text-dark-brown'
                  : 'bg-yellow-light text-dark-brown hover:bg-yellow/20'
              }`}
              data-testid="library-filter-chunk-packs"
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {t('library:filters.chunkPacks')}
            </button>
          )}
        </div>
      </div>

      {allItems.length === 0 ? (
        <div className="px-4 sm:px-0">
          {filter === 'dialogues' && (
            <EmptyStateCard
              icon={MessageSquare}
              title={t('library:emptyStates.dialogue.title')}
              description={t('library:emptyStates.dialogue.description')}
              buttonText={t('library:emptyStates.dialogue.button')}
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
              title={t('library:emptyStates.course.title')}
              description={t('library:emptyStates.course.description')}
              buttonText={t('library:emptyStates.course.button')}
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
              title={t('library:emptyStates.narrowListening.title')}
              description={t('library:emptyStates.narrowListening.description')}
              buttonText={t('library:emptyStates.narrowListening.button')}
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
              title={t('library:emptyStates.chunkPack.title')}
              description={t('library:emptyStates.chunkPack.description')}
              buttonText={t('library:emptyStates.chunkPack.button')}
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
                <p className="text-gray-500">{t('library:emptyStates.all.description')}</p>
                <button type="button"
                  onClick={() => { window.location.href = '/app/create'; }}
                  className="btn-primary inline-flex items-center gap-2"
                  data-testid="library-button-browse-all"
                >
                  {t('library:emptyStates.all.button')}
                  <span>→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {allItems.map((item) => {
            if (item.type === 'episode') {
              const episode = item.data as Episode;
              // Get unique proficiency levels from speakers
              const proficiencyLevels = episode.dialogue?.speakers
                ? [...new Set(episode.dialogue.speakers.map((s) => s.proficiency))]
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
                    <span className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wide text-center leading-tight">
                      {t('library:filters.dialogues').split(' ')[0]}
                    </span>
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
                        {episode.isSampleContent && (
                          <Pill color="blue" className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Sample
                          </Pill>
                        )}
                        {episode.status === 'generating' && (
                          <Pill color="yellow" className="animate-pulse">
                            {t('common:loading')}
                          </Pill>
                        )}
                        {!isDemo && !viewAsUserId && (
                          <button type="button"
                            onClick={(e) => handleDeleteClick(episode, e)}
                            className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete episode"
                            data-testid={`library-delete-episode-${episode.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
            }
            if (item.type === 'course') {
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
                    <span
                      className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wide text-center leading-tight"
                      dangerouslySetInnerHTML={{ __html: t('library:sidebar.course') }}
                    />
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
                        {course.isSampleContent && (
                          <Pill color="blue" className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Sample
                          </Pill>
                        )}
                        {course.status === 'generating' && (
                          <Pill color="yellow" className="animate-pulse">
                            {t('common:status.generating')}
                          </Pill>
                        )}
                        {(course.jlptLevel || course.hskLevel || course.cefrLevel) && (
                          <LanguageLevelPill
                            className="hidden sm:inline-flex"
                            language={course.targetLanguage}
                            level={course.jlptLevel || course.hskLevel || course.cefrLevel}
                          />
                        )}
                        {!isDemo && !viewAsUserId && (
                          <button type="button"
                            onClick={(e) => handleDeleteCourseClick(course, e)}
                            className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete course"
                            data-testid={`library-delete-course-${course.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Language/Level Sidebar (mobile only) */}
                  {(course.jlptLevel || course.hskLevel || course.cefrLevel) && (
                    <LanguageLevelSidebar
                      className="sm:hidden"
                      language={course.targetLanguage.toUpperCase()}
                      level={course.jlptLevel || course.hskLevel || course.cefrLevel}
                    />
                  )}
                </Link>
              );
            }
            if (item.type === 'narrowListening') {
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
                    <span
                      className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wide text-center leading-tight"
                      dangerouslySetInnerHTML={{ __html: t('library:sidebar.narrowListening') }}
                    />
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
                          level={pack.jlptLevel || pack.hskLevel || pack.cefrLevel}
                        />
                        {pack.status === 'generating' && (
                          <Pill color="yellow" className="animate-pulse">
                            {t('common:status.generating')}
                          </Pill>
                        )}
                        {!isDemo && !viewAsUserId && (
                          <button type="button"
                            onClick={(e) => handleDeletePackClick(pack, e)}
                            className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete pack"
                            data-testid={`library-delete-pack-${pack.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Language/Level Sidebar (mobile only) */}
                  <LanguageLevelSidebar
                    className="sm:hidden"
                    language={pack.targetLanguage.toUpperCase()}
                    level={pack.jlptLevel || pack.hskLevel || pack.cefrLevel}
                  />
                </Link>
              );
            }
            if (item.type === 'chunkPack') {
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
                    <span
                      className="text-[10px] sm:text-xs font-bold text-dark-brown uppercase tracking-wide text-center leading-tight"
                      dangerouslySetInnerHTML={{ __html: t('library:sidebar.chunkPack') }}
                    />
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
                        {pack.status === 'error' && <Pill color="red">error</Pill>}
                        {pack.status === 'generating' && (
                          <Pill color="yellow" className="animate-pulse">
                            {t('common:status.generating')}
                          </Pill>
                        )}
                        <LanguageLevelPill
                          className="hidden sm:inline-flex"
                          language={pack.targetLanguage}
                          level={pack.jlptLevel || pack.hskLevel || pack.cefrLevel}
                        />
                        {!isDemo && !viewAsUserId && (
                          <button type="button"
                            onClick={(e) => handleDeleteChunkPackClick(pack, e)}
                            className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete lexical chunk pack"
                            data-testid={`library-delete-chunk-pack-${pack.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Language/Level Sidebar (mobile only) */}
                  <LanguageLevelSidebar
                    className="sm:hidden"
                    language={pack.targetLanguage.toUpperCase()}
                    level={pack.jlptLevel || pack.hskLevel || pack.cefrLevel}
                  />
                </Link>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {allItems.length > 0 && (
        <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t('common:loadingMore')}</span>
            </div>
          )}
        </div>
      )}

      {/* Delete Episode Confirmation Modal */}
      <ConfirmModal
        isOpen={episodeToDelete !== null}
        title={t('library:delete.confirmTitle')}
        message={t('library:delete.confirmEpisode', { title: episodeToDelete?.title })}
        confirmLabel={t('library:delete.confirmButton')}
        cancelLabel={t('library:delete.cancelButton')}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={isDeletingEpisode}
      />

      {/* Delete Course Confirmation Modal */}
      <ConfirmModal
        isOpen={courseToDelete !== null}
        title={t('library:delete.confirmTitle')}
        message={t('library:delete.confirmCourse', { title: courseToDelete?.title })}
        confirmLabel={t('library:delete.confirmButton')}
        cancelLabel={t('library:delete.cancelButton')}
        onConfirm={handleConfirmDeleteCourse}
        onCancel={handleCancelDelete}
        isLoading={isDeletingCourse}
      />

      {/* Delete Narrow Listening Pack Confirmation Modal */}
      <ConfirmModal
        isOpen={packToDelete !== null}
        title={t('library:delete.confirmTitle')}
        message={t('library:delete.confirmNarrowListening', { title: packToDelete?.title })}
        confirmLabel={t('library:delete.confirmButton')}
        cancelLabel={t('library:delete.cancelButton')}
        onConfirm={handleConfirmDeletePack}
        onCancel={handleCancelDelete}
        isLoading={isDeletingNarrowListening}
      />

      {/* Delete Chunk Pack Confirmation Modal */}
      <ConfirmModal
        isOpen={chunkPackToDelete !== null}
        title={t('library:delete.confirmTitle')}
        message={t('library:delete.confirmChunkPack', { title: chunkPackToDelete?.title })}
        confirmLabel={t('library:delete.confirmButton')}
        cancelLabel={t('library:delete.cancelButton')}
        onConfirm={handleConfirmDeleteChunkPack}
        onCancel={handleCancelDelete}
        isLoading={isDeletingChunkPack}
      />

      {/* Sample Content Guide Pulse Point */}
      {showSampleGuide && <SampleContentGuide onClose={handleCloseSampleGuide} />}
    </div>
  );
};

export default LibraryPage;
