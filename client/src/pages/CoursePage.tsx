import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { useCourse } from '../hooks/useCourse';
import { useAuth } from '../contexts/AuthContext';
import AudioPlayer from '../components/AudioPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import CurrentTextDisplay from '../components/CurrentTextDisplay';
import ViewToggleButtons from '../components/common/ViewToggleButtons';
import { LessonScriptUnit } from '../types';

const AdminScriptWorkbench = lazy(() => import('../components/courses/AdminScriptWorkbench'));

const CoursePage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const { course, isLoading, generationProgress, updateCourse } = useCourse(courseId, viewAsUserId);
  const { audioRef, currentTime } = useAudioPlayer();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Inline editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  // Current text display state
  const [showReadings, setShowReadings] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [currentUnit, setCurrentUnit] = useState<LessonScriptUnit | null>(null);

  // Admin pipeline viewer
  const [showPipeline, setShowPipeline] = useState(false);

  // Track current L2 unit based on audio playback position
  useEffect(() => {
    if (!course?.scriptJson || !course?.timingData) {
      setCurrentUnit(null);
      return;
    }

    const currentTimeMs = currentTime * 1000;
    const PADDING_START_MS = 1000; // Show text 1 second before speech starts
    const PADDING_END_MS = 5000; // Keep text 5 seconds after speech ends

    // Find active L2 unit with padding
    const activeTiming = course.timingData.find((timing) => {
      const unit = course.scriptJson![timing.unitIndex];
      return (
        unit &&
        unit.type === 'L2' &&
        currentTimeMs >= timing.startTime - PADDING_START_MS &&
        currentTimeMs < timing.endTime + PADDING_END_MS
      );
    });

    if (activeTiming) {
      setCurrentUnit(course.scriptJson[activeTiming.unitIndex]);
    } else {
      setCurrentUnit(null);
    }
  }, [currentTime, course]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTitleEdit = () => {
    if (!course) return;
    setEditedTitle(course.title);
    setEditingTitle(true);
  };

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle !== course?.title) {
      await updateCourse({ title: editedTitle.trim() });
    }
    setEditingTitle(false);
  };

  const handleDescriptionEdit = () => {
    if (!course) return;
    setEditedDescription(course.description || '');
    setEditingDescription(true);
  };

  const handleDescriptionSave = async () => {
    if (editedDescription !== course?.description) {
      await updateCourse({ description: editedDescription });
    }
    setEditingDescription(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, saveHandler: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveHandler();
    } else if (e.key === 'Escape') {
      setEditingTitle(false);
      setEditingDescription(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto">
        <div className="card text-center py-12">
          <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto">
        <div className="card text-center py-12">
          <p className="text-gray-600">Audio course not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto space-y-5">
      {/* Header */}
      <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.22)] shadow-[0_8px_0_rgba(17,51,92,0.1)] px-4 sm:px-5 py-4">
        <div className="flex-1 min-w-0">
          {/* Editable Title */}
          {editingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => handleKeyDown(e, handleTitleSave)}
              className="retro-headline text-4xl sm:text-6xl bg-transparent border-b-2 border-[rgba(20,50,86,0.35)] focus:outline-none w-full"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: Inline editing UX
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="retro-headline text-4xl sm:text-6xl cursor-pointer text-left w-full"
              onClick={handleTitleEdit}
              title="Click to edit"
            >
              {course.title}
            </button>
          )}

          {/* Editable Description */}
          {editingDescription ? (
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              onBlur={handleDescriptionSave}
              onKeyDown={(e) => handleKeyDown(e, handleDescriptionSave)}
              className="text-[rgba(20,50,86,0.78)] mt-2 bg-transparent border-b-2 border-[rgba(20,50,86,0.28)] focus:outline-none w-full resize-none text-xl"
              rows={2}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: Inline editing UX
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="text-[rgba(20,50,86,0.78)] mt-2 cursor-pointer hover:text-[#1594bf] transition-colors text-left w-full text-lg sm:text-[2rem] leading-tight"
              onClick={handleDescriptionEdit}
              title="Click to edit"
            >
              {course.description || 'Click to add description...'}
            </button>
          )}
        </div>
      </div>

      {/* Course Info */}
      <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.9)] px-4 py-3 sm:px-5 sm:py-4 shadow-[0_8px_0_rgba(17,51,92,0.1)]">
        <div className="flex items-center gap-4 sm:gap-7 text-lg sm:text-4xl text-[rgba(20,50,86,0.82)] flex-wrap">
          <div className="inline-flex items-center gap-2 retro-caps">
            <span className="w-2.5 h-2.5 rounded-full bg-[rgba(20,50,86,0.35)] inline-block" />
            <span>{formatDuration(course.approxDurationSeconds || 0)}</span>
          </div>
          {course.coreItems && course.coreItems.length > 0 && (
            <div className="inline-flex items-center gap-2 retro-caps">
              <span className="w-2.5 h-2.5 rounded-full bg-[rgba(20,50,86,0.35)] inline-block" />
              <span>
                {course.coreItems.length} Core {course.coreItems.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>
          )}
          <div className="ml-auto">
            <span className="inline-flex px-3 py-1.5 bg-[rgba(26,178,209,0.18)] text-[rgba(20,50,86,0.92)] text-xl retro-caps font-semibold">
              {course.targetLanguage.toUpperCase()} → {course.nativeLanguage.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Course Player */}
      <div className="space-y-4">
        {/* eslint-disable-next-line no-nested-ternary */}
        {course.status === 'ready' && course.audioUrl ? (
          <>
            <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] shadow-[0_8px_0_rgba(17,51,92,0.1)]">
              <div className="px-4 sm:px-5 py-4 space-y-4">
                {/* View Toggle Buttons */}
                {course.timingData && (
                  <ViewToggleButtons
                    showReadings={showReadings}
                    showTranslations={showTranslations}
                    onToggleReadings={() => setShowReadings(!showReadings)}
                    onToggleTranslations={() => setShowTranslations(!showTranslations)}
                    readingsLabel="Furigana"
                    className="justify-end gap-4"
                  />
                )}

                {/* Current Text Display */}
                {course.timingData && (
                  <div>
                    <CurrentTextDisplay
                      currentUnit={currentUnit}
                      targetLanguage={course.targetLanguage}
                      showReadings={showReadings}
                      showTranslations={showTranslations}
                    />
                  </div>
                )}

                <h2 className="retro-headline text-4xl sm:text-[3rem]">Course Audio</h2>

                <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.9)] px-4 sm:px-5 py-3">
                  <AudioPlayer src={course.audioUrl} audioRef={audioRef} key={course.audioUrl} />
                </div>
              </div>
            </div>

            {/* Core Vocabulary */}
            {course.coreItems && course.coreItems.length > 0 && (
              <div className="retro-paper-panel mt-2 border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] shadow-[0_8px_0_rgba(17,51,92,0.1)] px-4 sm:px-5 py-4">
                <h3 className="retro-headline text-3xl sm:text-[2.65rem] mb-3">
                  Core Vocabulary ({course.coreItems.length} items)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {course.coreItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 min-h-[120px] bg-[rgba(252,246,228,0.95)] shadow-[inset_0_0_0_2px_rgba(20,50,86,0.10),0_10px_0_rgba(17,51,92,0.10)] transition-all hover:translate-y-[-1px]"
                    >
                      <div className="text-4xl sm:text-[2rem] font-black text-[rgba(20,50,86,0.92)] leading-tight">
                        {item.textL2}
                      </div>
                      {item.readingL2 && (
                        <div className="text-lg text-[rgba(20,50,86,0.6)] mt-1">
                          {item.readingL2}
                        </div>
                      )}
                      <div className="text-lg text-[rgba(20,50,86,0.76)] mt-3">
                        {item.translationL1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Original Prompt */}
            {course.courseEpisodes &&
              course.courseEpisodes.length > 0 &&
              course.courseEpisodes[0].episode?.sourceText && (
                <div className="retro-paper-panel mt-6 border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] shadow-[0_8px_0_rgba(17,51,92,0.1)] px-4 sm:px-5 py-4">
                  <h3 className="retro-headline text-2xl mb-3">Original Prompt</h3>
                  <div className="p-4 bg-[rgba(20,141,189,0.15)] border-2 border-[rgba(20,50,86,0.12)]">
                    <p className="text-sm text-[rgba(20,50,86,0.84)] whitespace-pre-wrap">
                      {course.courseEpisodes[0].episode.sourceText}
                    </p>
                  </div>
                </div>
              )}
          </>
        ) : course.status === 'generating' ? (
          <div className="card text-center py-12">
            <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Generating course audio...</p>

            {/* Progress Bar */}
            {generationProgress !== null && (
              <div className="max-w-md mx-auto">
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-coral via-strawberry to-periwinkle h-4 rounded-full transition-all duration-300 ease-out flex items-center justify-center text-xs font-semibold text-white"
                    style={{ width: `${Math.max(generationProgress, 3)}%` }}
                  >
                    {generationProgress > 10 && `${generationProgress}%`}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {(() => {
                    if (generationProgress < 20) return 'Extracting dialogue...';
                    if (generationProgress < 40) return 'Planning course structure...';
                    if (generationProgress < 60) return 'Generating teaching script...';
                    if (generationProgress < 85)
                      return `Synthesizing audio (${generationProgress - 60}% complete)...`;
                    return 'Finalizing audio file...';
                  })()}
                </p>
              </div>
            )}

            <p className="text-sm text-gray-500 mt-4">
              Hang tight! Our AI is crafting your personalized audio course with voice synthesis and
              timing.
            </p>
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-600">
              {course.status === 'draft' ? 'Course not yet generated' : 'No audio available'}
            </p>
          </div>
        )}
      </div>

      {/* Admin Pipeline Viewer */}
      {isAdmin && course.status !== 'draft' && (
        <>
          <button
            type="button"
            onClick={() => setShowPipeline(!showPipeline)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              showPipeline ? 'bg-coral text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            {showPipeline ? 'Hide Pipeline' : 'View Pipeline'}
          </button>

          {showPipeline && (
            <Suspense
              fallback={
                <div className="card text-center py-8">
                  <div className="loading-spinner w-8 h-8 border-4 border-coral border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading pipeline viewer...</p>
                </div>
              }
            >
              <AdminScriptWorkbench courseId={course.id} readOnly />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
};

export default CoursePage;
