import { useState, useMemo, useRef, useEffect, CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Trash2,
  FileText,
  MessageSquare,
  Headphones,
  Sparkles,
  Loader2,
  Layers,
  MessagesSquare,
  CassetteTape,
} from 'lucide-react';
import { Episode, Course } from '../types';
import {
  useLibraryData,
  LibraryCourse,
  episodeMatchesLibraryScope,
  parseLibraryContentScope,
  type LibraryContentScope,
} from '../hooks/useLibraryData';
import { useIsDemo } from '../hooks/useDemo';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/common/ConfirmModal';
import SampleContentGuide from '../components/pulsePoints/SampleContentGuide';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ErrorDisplay from '../components/ErrorDisplay';
import ImpersonationBanner from '../components/ImpersonationBanner';
import { SHOW_ONBOARDING_WELCOME } from '../config';
import { adminApi } from '../lib/adminApi';

type FilterType = LibraryContentScope;

const LEGACY_DIALOGUE_TURN_FALLBACKS: Record<string, number> = {
  'hokkaido food trip': 15,
  'hokkaido cycling trip': 15,
  'favorite places': 15,
};

const getDialogueTurnCount = (episode: Episode): number => {
  const directCount = episode.dialogue?.sentences?.length ?? 0;
  if (directCount > 0) return directCount;

  const normalizedTitle = episode.title?.trim().toLowerCase();
  if (!normalizedTitle) return 0;

  return LEGACY_DIALOGUE_TURN_FALLBACKS[normalizedTitle] ?? 0;
};

const LibraryPage = () => {
  const { t } = useTranslation(['library', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const filter = parseLibraryContentScope(searchParams.get('filter'));

  // Admin draft toggle
  const [showDrafts, setShowDrafts] = useState(false);

  const {
    episodes,
    courses,
    isLoading,
    error,
    retry,
    hasNextPage,
    shouldAutoLoadMore,
    fetchNextPage,
    isFetchingNextPage,
    deleteEpisode,
    deleteCourse,
    isDeletingEpisode,
    isDeletingCourse,
  } = useLibraryData(viewAsUserId, showDrafts, filter);
  const isDemo = useIsDemo();
  const { isFeatureEnabled } = useFeatureFlags();
  const { user, updateUser } = useAuth();

  // Show sample content guide for users who completed onboarding but haven't seen it
  const [showSampleGuide, setShowSampleGuide] = useState(false);

  useEffect(() => {
    if (!SHOW_ONBOARDING_WELCOME) return;

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
  const impersonatedUserRequestRef = useRef(0);

  useEffect(() => {
    impersonatedUserRequestRef.current += 1;
    const requestGeneration = impersonatedUserRequestRef.current;
    const controller = new AbortController();

    // Never carry the previous user's identity through a scope transition.
    setImpersonatedUser(null);

    if (viewAsUserId) {
      fetch(adminApi.userInfo(viewAsUserId), {
        credentials: 'include',
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Failed to fetch impersonated user');
          return response.json();
        })
        .then((impUser: { displayName?: string; name: string; email: string }) => {
          if (
            controller.signal.aborted ||
            impersonatedUserRequestRef.current !== requestGeneration
          ) {
            return;
          }
          setImpersonatedUser({
            name: impUser.displayName || impUser.name,
            email: impUser.email,
          });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || impersonatedUserRequestRef.current !== requestGeneration)
            return;
          console.error('Failed to fetch impersonated user:', err);
        });
    }

    return () => controller.abort();
  }, [viewAsUserId]);
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<LibraryCourse | null>(null);

  // Combined deleting state for modal
  const isDeleting = isDeletingEpisode || isDeletingCourse;

  const handleFilterChange = (newFilter: FilterType) => {
    const params = new URLSearchParams(searchParams);

    if (newFilter === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', newFilter);
    }

    setSearchParams(params);
  };

  // Infinite scroll setup
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && shouldAutoLoadMore && !isFetchingNextPage) {
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
  }, [shouldAutoLoadMore, isFetchingNextPage, fetchNextPage]);

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
    const filteredEpisodes =
      filter === 'courses'
        ? []
        : episodes.filter((episode) => episodeMatchesLibraryScope(episode, filter));
    const filteredCourses = filter === 'dialogues' ? [] : courses;
    const visibleCourses = filter === 'scripts' ? [] : filteredCourses;

    // Combine and sort by date
    return [
      ...filteredEpisodes.map((ep) => ({
        type: 'episode' as const,
        data: ep,
        date: new Date(ep.createdAt),
      })),
      ...visibleCourses.map((course) => ({
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
    return (
      <div className="space-y-4">
        <ErrorDisplay error={error} onRetry={retry} />
        {filter !== 'all' ? (
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className="retro-library-v3-empty-btn"
          >
            {t('library:error.showAll')}
          </button>
        ) : null}
      </div>
    );
  }

  // Handler to exit impersonation
  const handleExitImpersonation = () => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('viewAs');
      return params;
    });
  };

  const getCreateUrl = (
    path: '/app/create' | '/app/create/dialogue' | '/app/create/script' = '/app/create/dialogue'
  ) => (viewAsUserId ? `${path}?viewAs=${viewAsUserId}` : path);

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

  const getEmptyTitle = () => {
    if (filter === 'all') return t('library:emptyStates.all.title');
    if (filter === 'dialogues') return t('library:emptyStates.dialogue.title');
    if (filter === 'scripts') return t('library:emptyStates.script.title');
    return t('library:emptyStates.course.title');
  };

  const getEmptyDescription = () => {
    if (filter === 'all') return t('library:emptyStates.all.description');
    if (filter === 'dialogues') return t('library:emptyStates.dialogue.description');
    if (filter === 'scripts') return t('library:emptyStates.script.description');
    return t('library:emptyStates.course.description');
  };

  const getEmptyButtonLabel = () => {
    if (filter === 'all') return t('library:emptyStates.all.button');
    if (filter === 'dialogues') return t('library:emptyStates.dialogue.button');
    if (filter === 'scripts') return t('library:emptyStates.script.button');
    return t('library:emptyStates.course.button');
  };

  const getEmptyCreateUrl = () => {
    if (filter === 'scripts') return getCreateUrl('/app/create/script');
    return getCreateUrl('/app/create/dialogue');
  };

  const renderEmptyState = () => {
    if (hasNextPage) {
      return (
        <div className="retro-library-v3-empty">
          <h3 className="retro-headline text-3xl">{t('library:filteredPagination.title')}</h3>
          <p>{t('library:filteredPagination.description')}</p>
        </div>
      );
    }

    return (
      <div className="retro-library-v3-empty">
        <h3 className="retro-headline text-3xl">{getEmptyTitle()}</h3>
        <p>{getEmptyDescription()}</p>
        <button
          type="button"
          onClick={() => {
            const createUrl = filter === 'all' ? getCreateUrl('/app/create') : getEmptyCreateUrl();
            window.location.href = createUrl;
          }}
          className="retro-library-v3-empty-btn"
          data-testid={filter === 'all' ? 'library-button-browse-all' : undefined}
        >
          {getEmptyButtonLabel()}
        </button>
      </div>
    );
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
              {isFeatureEnabled('scriptsEnabled') && (
                <button
                  type="button"
                  onClick={() => handleFilterChange('scripts')}
                  className={`retro-library-v3-filter ${filter === 'scripts' ? 'is-active' : ''}`}
                  data-testid="library-filter-scripts"
                  aria-pressed={filter === 'scripts'}
                >
                  <FileText className="h-4 w-4" />
                  {t('library:filters.scripts')}
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
              renderEmptyState()
            ) : (
              <div className="retro-library-v3-grid">
                {allItems.map((item, index) => {
                  if (item.type === 'episode') {
                    const episode = item.data as Episode;
                    const contentType = episode.contentType ?? 'dialogue';
                    const isScript = contentType === 'script';
                    const scriptSegmentCount =
                      episode.audioScript?.segments?.length ??
                      episode.audioScript?._count?.segments ??
                      0;
                    const proficiencyLevels = episode.dialogue?.speakers
                      ? [
                          ...new Set(
                            episode.dialogue.speakers.map((speaker) => speaker.proficiency)
                          ),
                        ]
                      : [];
                    const sentenceCount = isScript
                      ? scriptSegmentCount
                      : getDialogueTurnCount(episode);
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
                        data-content-type={contentType}
                        data-library-card-id={episode.id}
                      >
                        <div className="retro-library-v3-card-head is-dialogue">
                          <div className="retro-library-v3-card-kicker retro-caps">
                            {isScript
                              ? t('library:card.scriptKicker', { number: index + 1 })
                              : t('library:card.lessonKicker', { number: index + 1 })}
                          </div>
                          <h3 className="retro-library-v3-card-title">{episode.title}</h3>
                          <div className="retro-library-v3-card-subtitle">
                            {episode.sourceText ||
                              (isScript
                                ? t('library:card.scriptFallback')
                                : t('library:filters.dialogues'))}
                          </div>
                        </div>

                        <div className="retro-library-v3-card-body">
                          <div className="retro-library-v3-card-mini">
                            <span className="retro-library-v3-mini-icon" aria-hidden="true">
                              {isScript ? (
                                <FileText className="retro-library-v3-mini-icon-svg" />
                              ) : (
                                <MessagesSquare className="retro-library-v3-mini-icon-svg" />
                              )}
                            </span>
                            <span className="retro-caps">
                              {isScript
                                ? t('library:card.scriptSegments')
                                : t('library:card.dialogueTurns')}
                              : {sentenceCount}
                            </span>
                          </div>
                          <div className="retro-library-v3-card-progress" style={progressStyle} />
                          <div className="retro-library-v3-card-meta retro-caps">
                            <span>{formatStampDate(episode.updatedAt)}</span>
                            <span>
                              {isScript
                                ? t('library:card.japanese')
                                : proficiencyLevels.join(', ') || t('library:card.ready')}
                            </span>
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
                            <span
                              className="retro-library-v3-mini-icon retro-library-v3-mini-icon--course"
                              aria-hidden="true"
                            >
                              <CassetteTape className="retro-library-v3-mini-icon-svg" />
                            </span>
                            <span className="retro-caps">
                              Audio Course / {formatDuration(course.approxDurationSeconds)}
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
            {hasNextPage && !shouldAutoLoadMore ? (
              <div className="flex h-16 items-center justify-center">
                <button
                  type="button"
                  onClick={fetchNextPage}
                  disabled={isFetchingNextPage}
                  className="retro-library-v3-empty-btn"
                >
                  {isFetchingNextPage ? t('common:loadingMore') : t('library:loadMore')}
                </button>
              </div>
            ) : null}

            {shouldAutoLoadMore && (
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
      {SHOW_ONBOARDING_WELCOME && showSampleGuide && (
        <SampleContentGuide onClose={handleCloseSampleGuide} />
      )}
    </div>
  );
};

export default LibraryPage;
