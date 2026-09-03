import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { useCourse } from '../hooks/useCourse';
import { useAuth } from '../contexts/AuthContext';
import AudioPlayer from '../components/AudioPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import useWarmAudioCache from '../hooks/useWarmAudioCache';
import CurrentTextDisplay from '../components/CurrentTextDisplay';
import ViewToggleButtons from '../components/common/ViewToggleButtons';
import type { Course, LessonScriptUnit } from '../types';

const AdminScriptWorkbench = lazy(() => import('../components/courses/AdminScriptWorkbench'));

type UpdateCourse = (updates: { title?: string; description?: string }) => Promise<unknown>;
const TEXT_PADDING_START_MS = 1000;
const TEXT_PADDING_END_MS = 5000;

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const progressMessage = (progress: number) => {
  if (progress < 20) return 'Extracting dialogue...';
  if (progress < 40) return 'Planning course structure...';
  if (progress < 60) return 'Generating teaching script...';
  if (progress < 85) return `Synthesizing audio (${progress - 60}% complete)...`;
  return 'Finalizing audio file...';
};

const useCurrentCourseUnit = (course: Course | null, currentTime: number) => {
  const [currentUnit, setCurrentUnit] = useState<LessonScriptUnit | null>(null);
  useEffect(() => {
    if (!course?.scriptJson || !course.timingData) {
      setCurrentUnit(null);
      return;
    }
    const currentTimeMs = currentTime * 1000;
    const activeTiming = course.timingData.find((timing) => {
      const unit = course.scriptJson![timing.unitIndex];
      if (!unit || unit.type !== 'L2') return false;
      return (
        currentTimeMs >= timing.startTime - TEXT_PADDING_START_MS &&
        currentTimeMs < timing.endTime + TEXT_PADDING_END_MS
      );
    });
    setCurrentUnit(activeTiming ? course.scriptJson[activeTiming.unitIndex] : null);
  }, [currentTime, course]);
  return currentUnit;
};

interface CourseFieldOptions {
  initialValue: string;
  persist: (value: string) => Promise<unknown>;
}

const useEditableCourseField = ({ initialValue, persist }: CourseFieldOptions) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const beginEditing = () => {
    setValue(initialValue);
    setEditing(true);
  };
  const save = async () => {
    await persist(value);
    setEditing(false);
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      save();
    }
    if (event.key === 'Escape') setEditing(false);
  };
  return { beginEditing, editing, handleKeyDown, save, setValue, value };
};

const persistCourseTitle = async ({
  course,
  updateCourse,
  value,
}: {
  course: Course;
  updateCourse: UpdateCourse;
  value: string;
}) => {
  const title = value.trim();
  if (title && title !== course.title) await updateCourse({ title });
};

const persistCourseDescription = async ({
  course,
  updateCourse,
  value,
}: {
  course: Course;
  updateCourse: UpdateCourse;
  value: string;
}) => {
  if (value !== course.description) await updateCourse({ description: value });
};

const EditableCourseField = ({
  course,
  kind,
  updateCourse,
}: {
  course: Course;
  kind: 'title' | 'description';
  updateCourse: UpdateCourse;
}) => {
  const isTitle = kind === 'title';
  const field = useEditableCourseField({
    initialValue: isTitle ? course.title : course.description || '',
    persist: (value) =>
      isTitle
        ? persistCourseTitle({ course, updateCourse, value })
        : persistCourseDescription({ course, updateCourse, value }),
  });
  if (field.editing && isTitle) {
    return (
      <input
        type="text"
        value={field.value}
        onChange={(event) => field.setValue(event.target.value)}
        onBlur={field.save}
        onKeyDown={field.handleKeyDown}
        className="retro-headline text-4xl sm:text-6xl bg-transparent border-b-2 border-[rgba(20,50,86,0.35)] focus:outline-none w-full"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: Inline editing UX
        autoFocus
      />
    );
  }
  if (field.editing) {
    return (
      <textarea
        value={field.value}
        onChange={(event) => field.setValue(event.target.value)}
        onBlur={field.save}
        onKeyDown={field.handleKeyDown}
        className="text-[rgba(20,50,86,0.78)] mt-2 bg-transparent border-b-2 border-[rgba(20,50,86,0.28)] focus:outline-none w-full resize-none text-xl"
        rows={2}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: Inline editing UX
        autoFocus
      />
    );
  }
  if (isTitle) {
    return (
      <button
        type="button"
        className="retro-headline text-4xl sm:text-6xl cursor-pointer text-left w-full"
        onClick={field.beginEditing}
        title="Click to edit"
      >
        {course.title}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="text-[rgba(20,50,86,0.78)] mt-2 cursor-pointer hover:text-[#1594bf] transition-colors text-left w-full text-lg sm:text-[2rem] leading-tight"
      onClick={field.beginEditing}
      title="Click to edit"
    >
      {course.description || 'Click to add description...'}
    </button>
  );
};

const CourseHeader = ({ course, updateCourse }: { course: Course; updateCourse: UpdateCourse }) => (
  <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(20,141,189,0.22)] shadow-[0_8px_0_rgba(17,51,92,0.1)] px-4 sm:px-5 py-4">
    <div className="flex-1 min-w-0">
      <EditableCourseField course={course} kind="title" updateCourse={updateCourse} />
      <EditableCourseField course={course} kind="description" updateCourse={updateCourse} />
    </div>
  </div>
);

const CourseLanguagePair = ({ course }: { course: Course }) => (
  <span className="inline-flex px-3 py-1.5 bg-[rgba(26,178,209,0.18)] text-[rgba(20,50,86,0.92)] text-xl retro-caps font-semibold">
    {course.targetLanguage.toUpperCase()} → {course.nativeLanguage.toUpperCase()}
  </span>
);

const CourseInfo = ({ course }: { course: Course }) => (
  <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.9)] px-4 py-3 sm:px-5 sm:py-4 shadow-[0_8px_0_rgba(17,51,92,0.1)]">
    <div className="flex items-center gap-4 sm:gap-7 text-lg sm:text-4xl text-[rgba(20,50,86,0.82)] flex-wrap">
      <div className="inline-flex items-center gap-2 retro-caps">
        <span className="w-2.5 h-2.5 rounded-full bg-[rgba(20,50,86,0.35)] inline-block" />
        <span>{formatDuration(course.approxDurationSeconds || 0)}</span>
      </div>
      {!!course.coreItems?.length && (
        <div className="inline-flex items-center gap-2 retro-caps">
          <span className="w-2.5 h-2.5 rounded-full bg-[rgba(20,50,86,0.35)] inline-block" />
          <span>
            {course.coreItems.length} Core {course.coreItems.length === 1 ? 'Item' : 'Items'}
          </span>
        </div>
      )}
      <div className="ml-auto">
        <CourseLanguagePair course={course} />
      </div>
    </div>
  </div>
);

const CoreVocabulary = ({ course }: { course: Course }) => {
  if (!course.coreItems?.length) return null;
  return (
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
              <div className="text-lg text-[rgba(20,50,86,0.6)] mt-1">{item.readingL2}</div>
            )}
            <div className="text-lg text-[rgba(20,50,86,0.76)] mt-3">{item.translationL1}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const OriginalPrompt = ({ course }: { course: Course }) => {
  const sourceText = course.courseEpisodes?.[0]?.episode?.sourceText;
  if (!sourceText) return null;
  return (
    <div className="retro-paper-panel mt-6 border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] shadow-[0_8px_0_rgba(17,51,92,0.1)] px-4 sm:px-5 py-4">
      <h3 className="retro-headline text-2xl mb-3">Original Prompt</h3>
      <div className="p-4 bg-[rgba(20,141,189,0.15)] border-2 border-[rgba(20,50,86,0.12)]">
        <p className="text-sm text-[rgba(20,50,86,0.84)] whitespace-pre-wrap">{sourceText}</p>
      </div>
    </div>
  );
};

const ReadyCoursePlayer = ({
  course,
  audioUrl,
  audioRef,
  currentUnit,
}: {
  course: Course;
  audioUrl: string;
  audioRef: (element: HTMLAudioElement | null) => void;
  currentUnit: LessonScriptUnit | null;
}) => {
  const [showReadings, setShowReadings] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  return (
    <>
      <div className="retro-paper-panel border-2 border-[rgba(20,50,86,0.12)] bg-[rgba(252,246,228,0.92)] shadow-[0_8px_0_rgba(17,51,92,0.1)]">
        <div className="px-4 sm:px-5 py-4 space-y-4">
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
            <AudioPlayer src={audioUrl} audioRef={audioRef} key={audioUrl} />
          </div>
        </div>
      </div>
      <CoreVocabulary course={course} />
      <OriginalPrompt course={course} />
    </>
  );
};

const GeneratingCoursePlayer = ({ progress }: { progress: number | null }) => (
  <div className="card text-center py-12">
    <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
    <p className="text-gray-600 mb-4">Generating course audio...</p>
    {progress !== null && (
      <div className="max-w-md mx-auto">
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-coral via-strawberry to-periwinkle h-4 rounded-full transition-all duration-300 ease-out flex items-center justify-center text-xs font-semibold text-white"
            style={{ width: `${Math.max(progress, 3)}%` }}
          >
            {progress > 10 && `${progress}%`}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">{progressMessage(progress)}</p>
      </div>
    )}
    <p className="text-sm text-gray-500 mt-4">
      Hang tight! Our AI is crafting your personalized audio course with voice synthesis and timing.
    </p>
  </div>
);

const CoursePlayer = ({
  course,
  generationProgress,
  audioRef,
  currentUnit,
}: {
  course: Course;
  generationProgress: number | null;
  audioRef: (element: HTMLAudioElement | null) => void;
  currentUnit: LessonScriptUnit | null;
}) => {
  if (course.status === 'ready' && course.audioUrl) {
    return (
      <ReadyCoursePlayer
        course={course}
        audioUrl={course.audioUrl}
        audioRef={audioRef}
        currentUnit={currentUnit}
      />
    );
  }
  if (course.status === 'generating')
    return <GeneratingCoursePlayer progress={generationProgress} />;
  return (
    <div className="card text-center py-12">
      <p className="text-gray-600">
        {course.status === 'draft' ? 'Course not yet generated' : 'No audio available'}
      </p>
    </div>
  );
};

const AdminPipelineViewer = ({ course, isAdmin }: { course: Course; isAdmin: boolean }) => {
  const [showPipeline, setShowPipeline] = useState(false);
  if (!isAdmin || course.status === 'draft') return null;
  return (
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
  );
};

const LoadingCourse = () => (
  <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto">
    <div className="card text-center py-12">
      <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-gray-600">Loading course...</p>
    </div>
  </div>
);

const MissingCourse = () => (
  <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto">
    <div className="card text-center py-12">
      <p className="text-gray-600">Audio course not found</p>
    </div>
  </div>
);

const CoursePage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const { course, isLoading, generationProgress, updateCourse } = useCourse(courseId, viewAsUserId);
  const { audioRef, currentTime } = useAudioPlayer();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  useWarmAudioCache([course?.audioUrl], course?.status === 'ready');
  const currentUnit = useCurrentCourseUnit(course, currentTime);

  if (isLoading) return <LoadingCourse />;
  if (!course) return <MissingCourse />;

  return (
    <div className="w-full max-w-7xl xl:max-w-[96rem] mx-auto space-y-5">
      <CourseHeader course={course} updateCourse={updateCourse} />
      <CourseInfo course={course} />
      <div className="space-y-4">
        <CoursePlayer
          course={course}
          generationProgress={generationProgress}
          audioRef={audioRef}
          currentUnit={currentUnit}
        />
      </div>
      <AdminPipelineViewer course={course} isAdmin={isAdmin} />
    </div>
  );
};

export default CoursePage;
