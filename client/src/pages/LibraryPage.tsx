import { useState, useMemo, useRef, useEffect, CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2, MessageSquare, Headphones, Sparkles, Loader2, Layers } from 'lucide-react';
import { Episode, Course } from '../types';
import { useLibraryData, LibraryCourse } from '../hooks/useLibraryData';
import { useIsDemo } from '../hooks/useDemo';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/common/ConfirmModal';
import SampleContentGuide from '../components/pulsePoints/SampleContentGuide';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ErrorDisplay from '../components/ErrorDisplay';
import ImpersonationBanner from '../components/ImpersonationBanner';
import { API_URL } from '../config';

type FilterType = 'all' | 'dialogues' | 'courses';

const LibraryPage = () => {
  const { t } = useTranslation(['library', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;

  // Admin draft toggle
  const [showDrafts, setShowDrafts] = useState(false);

  const {
    episodes,
    courses,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    deleteEpisode,
    deleteCourse,
    isDeletingEpisode,
    isDeletingCourse,
  } = useLibraryData(viewAsUserId, showDrafts);
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
        console.error('Failed to update seenSampleContentGuide:', err);
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

  // Combined deleting state for modal
  const isDeleting = isDeletingEpisode || isDeletingCourse;

  // Map between URL params (kebab-case) and internal filter types (camelCase)
  const filterParamToType: Record<string, FilterType> = {
    all: 'all',
    dialogues: 'dialogues',
    courses: 'courses',
  };

  const filterTypeToParam: Record<FilterType, string> = {
    all: 'all',
    dialogues: 'dialogues',
    courses: 'courses',
  };

  // Get filter from URL or default to 'all'
  const filterParam = searchParams.get('filter');
  const filter: FilterType = filterParamToType[filterParam || ''] || 'all';

  const handleFilterChange = (newFilter: FilterType) => {
    const params = new URLSearchParams(searchParams);

    if (newFilter === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', filterTypeToParam[newFilter]);
    }

    setSearchParams(params);
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

  const handleCancelDelete = () => {
    if (!isDeleting) {
      setEpisodeToDelete(null);
      setCourseToDelete(null);
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
      // eslint-disable-next-line no-alert -- User feedback for critical operation failure
      alert(t('library:delete.alertError', { type: 'course' }));
    }
  };

  // Memoize filtered and sorted items to avoid expensive recalculations
  const allItems = useMemo(() => {
    // Filter content based on selected filter
    const filteredEpisodes = filter === 'courses' ? [] : episodes;
    const filteredCourses = filter === 'dialogues' ? [] : courses;

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
    ].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filter, episodes, courses]);

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

  const getCreateUrl = (path: '/app/create' | '/app/create/dialogue' = '/app/create/dialogue') =>
    viewAsUserId ? `${path}?viewAs=${viewAsUserId}` : path;

  const formatDuration = (seconds?: number) => {
    if (!seconds || Number.isNaN(seconds) || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatStampDate = (value: Date | string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '----.--.--';
    return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(
      parsed.getDate()
    ).padStart(2, '0')}`;
  };

  const getProgressPercent = (
    status: 'draft' | 'generating' | 'ready' | 'error',
    isSampleContent?: boolean
  ) => {
    if (isSampleContent) return 100;
    if (status === 'ready') return 72;
    if (status === 'generating') return 38;
    if (status === 'draft') return 20;
    return 8;
  };

  return (
    <div className="retro-library-v3-wrap space-y-4">
      {/* Impersonation Banner */}
      {impersonatedUser && (
        <ImpersonationBanner impersonatedUser={impersonatedUser} onExit={handleExitImpersonation} />
      )}

      <div className="retro-library-v3-shell">
        <div className="retro-library-v3-top">
          <div className="retro-library-v3-branding-row">
            <div className="retro-library-v3-branding">
              <h1 className="retro-library-v3-brand-en">CONVOLAB</h1>
              <div className="retro-library-v3-brand-jp">コンボラボ</div>
            </div>
            <div className="retro-library-v3-branding secondary">
              <h2 className="retro-library-v3-brand-en secondary">AUDIO CONTENT</h2>
              <div className="retro-library-v3-brand-jp secondary">オーディオコンテンツ</div>
            </div>
          </div>
        </div>

        <div className="retro-library-v3-body">
          <section className="retro-library-v3-main">
            <div className="retro-library-v3-toolbar">
              <button
                type="button"
                onClick={() => handleFilterChange('all')}
                className={`retro-library-v3-filter ${filter === 'all' ? 'is-active' : ''}`}
                data-testid="library-filter-all"
                aria-pressed={filter === 'all'}
              >
                <Layers className="h-4 w-4" />
                {t('library:filters.all')}
              </button>

              {/* Admin Draft Toggle */}
              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setShowDrafts(!showDrafts)}
                  className={`retro-library-v3-filter retro-library-v3-draft ${
                    showDrafts ? 'is-active' : ''
                  }`}
                >
                  <span className={`retro-library-v3-filter-dot ${showDrafts ? 'is-on' : ''}`} />
                  Drafts
                </button>
              )}

              {/* Filter Tabs */}
              {isFeatureEnabled('dialoguesEnabled') && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('dialogues')}
                  className={`retro-library-v3-filter ${filter === 'dialogues' ? 'is-active' : ''}`}
                  data-testid="library-filter-dialogues"
                  aria-pressed={filter === 'dialogues'}
                >
                  <MessageSquare className="h-4 w-4" />
                  {t('library:filters.dialogues')}
                </button>
              )}
              {isFeatureEnabled('audioCourseEnabled') && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('courses')}
                  className={`retro-library-v3-filter ${filter === 'courses' ? 'is-active' : ''}`}
                  data-testid="library-filter-courses"
                  aria-pressed={filter === 'courses'}
                >
                  <Headphones className="h-4 w-4" />
                  {t('library:filters.courses')}
                </button>
              )}
            </div>

            {allItems.length === 0 ? (
              <div className="retro-library-v3-empty">
                {filter === 'all' ? (
                  <>
                    <p>{t('library:emptyStates.all.description')}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const createUrl = getCreateUrl('/app/create');
                        window.location.href = createUrl;
                      }}
                      className="retro-library-v3-empty-btn"
                      data-testid="library-button-browse-all"
                    >
                      {t('library:emptyStates.all.button')}
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="retro-headline text-3xl">
                      {filter === 'dialogues'
                        ? t('library:emptyStates.dialogue.title')
                        : t('library:emptyStates.course.title')}
                    </h3>
                    <p>
                      {filter === 'dialogues'
                        ? t('library:emptyStates.dialogue.description')
                        : t('library:emptyStates.course.description')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = getCreateUrl('/app/create/dialogue');
                      }}
                      className="retro-library-v3-empty-btn"
                    >
                      {filter === 'dialogues'
                        ? t('library:emptyStates.dialogue.button')
                        : t('library:emptyStates.course.button')}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="retro-library-v3-grid">
                {allItems.map((item, index) => {
                  if (item.type === 'episode') {
                    const episode = item.data as Episode;
                    const proficiencyLevels = episode.dialogue?.speakers
                      ? [
                          ...new Set(
                            episode.dialogue.speakers.map((speaker) => speaker.proficiency)
                          ),
                        ]
                      : [];
                    const sentenceCount = episode.dialogue?.sentences?.length ?? 0;
                    const progressStyle = {
                      '--retro-library-v3-card-pct': `${getProgressPercent(
                        episode.status,
                        episode.isSampleContent
                      )}%`,
                    } as CSSProperties;

                    return (
                      <Link
                        key={episode.id}
                        to={`/app/playback/${episode.id}${viewAsUserId ? `?viewAs=${viewAsUserId}` : ''}`}
                        className="retro-library-v3-card group"
                        data-testid="library-item"
                        data-item-id={episode.id}
                        data-updated-at={item.date.toISOString()}
                        data-content-type="dialogue"
                        data-library-card-id={episode.id}
                      >
                        <div className="retro-library-v3-card-head is-dialogue">
                          <div className="retro-library-v3-card-kicker retro-caps">
                            レッスン {index + 1}
                          </div>
                          <h3 className="retro-library-v3-card-title">{episode.title}</h3>
                          <div className="retro-library-v3-card-subtitle">
                            {episode.sourceText || t('library:filters.dialogues')}
                          </div>
                        </div>

                        <div className="retro-library-v3-card-body">
                          <div className="retro-library-v3-card-mini">
                            <span className="retro-library-v3-cassette" aria-hidden="true" />
                            <span className="retro-caps">Audio / Turns {sentenceCount}</span>
                          </div>
                          <div className="retro-library-v3-card-progress" style={progressStyle} />
                          <div className="retro-library-v3-card-meta retro-caps">
                            <span>{formatStampDate(episode.updatedAt)}</span>
                            <span>{proficiencyLevels.join(', ') || 'Ready'}</span>
                          </div>

                          <div className="retro-library-v3-card-cta-row">
                            <span className="retro-library-v3-open retro-caps">Open</span>
                            <div className="retro-library-v3-tags">
                              {episode.isSampleContent && (
                                <span className="retro-library-v3-tag">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Sample
                                </span>
                              )}
                              {episode.status === 'generating' && (
                                <span className="retro-library-v3-tag is-pulse">
                                  {t('common:loading')}
                                </span>
                              )}
                              {!isDemo && !viewAsUserId && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteClick(episode, e)}
                                  className="retro-library-v3-delete"
                                  title="Delete episode"
                                  data-testid={`library-delete-episode-${episode.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  if (item.type === 'course') {
                    const course = item.data as LibraryCourse;
                    const sourceDialogueTurns =
                      course.courseEpisodes?.[0]?.episode?.dialogue?.sentences?.length ?? 0;
                    const progressStyle = {
                      '--retro-library-v3-card-pct': `${getProgressPercent(
                        course.status,
                        course.isSampleContent
                      )}%`,
                    } as CSSProperties;

                    return (
                      <Link
                        key={course.id}
                        to={`/app/courses/${course.id}${viewAsUserId ? `?viewAs=${viewAsUserId}` : ''}`}
                        className="retro-library-v3-card group"
                        data-testid="library-item"
                        data-item-id={course.id}
                        data-updated-at={item.date.toISOString()}
                        data-content-type="course"
                        data-library-card-id={course.id}
                      >
                        <div className="retro-library-v3-card-head is-course">
                          <div className="retro-library-v3-card-kicker retro-caps">
                            コース {index + 1}
                          </div>
                          <h3 className="retro-library-v3-card-title">{course.title}</h3>
                          <div className="retro-library-v3-card-subtitle">
                            {course.description || t('library:filters.courses')}
                          </div>
                        </div>

                        <div className="retro-library-v3-card-body">
                          <div className="retro-library-v3-card-mini">
                            <span className="retro-library-v3-cassette" aria-hidden="true" />
                            <span className="retro-caps">
                              Audio / {formatDuration(course.approxDurationSeconds)} / Turns{' '}
                              {sourceDialogueTurns}
                            </span>
                          </div>
                          <div className="retro-library-v3-card-progress" style={progressStyle} />
                          <div className="retro-library-v3-card-meta retro-caps">
                            <span>{formatStampDate(course.updatedAt)}</span>
                            <span>
                              {course.targetLanguage.toUpperCase()} {course.jlptLevel || 'N/A'}
                            </span>
                          </div>

                          <div className="retro-library-v3-card-cta-row">
                            <span className="retro-library-v3-open retro-caps">Open</span>
                            <div className="retro-library-v3-tags">
                              {course.isSampleContent && (
                                <span className="retro-library-v3-tag">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Sample
                                </span>
                              )}
                              {course.status === 'draft' && (
                                <span className="retro-library-v3-tag">Draft</span>
                              )}
                              {course.status === 'generating' && (
                                <span className="retro-library-v3-tag is-pulse">
                                  {t('common:status.generating')}
                                </span>
                              )}
                              {!isDemo && !viewAsUserId && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteCourseClick(course, e)}
                                  className="retro-library-v3-delete"
                                  title="Delete course"
                                  data-testid={`library-delete-course-${course.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
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

            {/* Infinite scroll sentinel */}
            {allItems.length > 0 && (
              <div
                ref={loadMoreRef}
                className="h-10 flex items-center justify-center"
                data-testid="scroll-sentinel"
              >
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-[rgba(20,50,86,0.72)] retro-caps">
                    <Loader2 className="w-5 h-5 animate-spin" data-testid="loading-spinner" />
                    <span>{t('common:loadingMore')}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="retro-library-v3-foot retro-caps">
          <span>File: Convo-Lab-V3 | Unit Index: Library</span>
          <span>{formatStampDate(new Date())}</span>
        </div>
      </div>

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

      {/* Sample Content Guide Pulse Point */}
      {showSampleGuide && <SampleContentGuide onClose={handleCloseSampleGuide} />}
    </div>
  );
};

export default LibraryPage;
