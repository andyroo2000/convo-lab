import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// eslint-disable-next-line import/no-extraneous-dependencies
import { getCourseSpeakerVoices } from '@languageflow/shared/src/voiceSelection';
// eslint-disable-next-line import/no-extraneous-dependencies
import { TTS_VOICES } from '@languageflow/shared/src/constants-new';
import { Episode, LanguageCode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useInvalidateLibrary } from '../../hooks/useLibraryData';
import { useIsDemo } from '../../hooks/useDemo';
import { useEpisodes } from '../../hooks/useEpisodes';
import DemoRestrictionModal from '../common/DemoRestrictionModal';
import UpgradePrompt from '../common/UpgradePrompt';
import AdminScriptWorkbench from './AdminScriptWorkbench';
import VoicePreview from '../common/VoicePreview';

interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

interface ErrorMetadata {
  quota?: QuotaInfo;
  status?: number;
}

interface CourseGeneratorProps {
  episodeId?: string;
}

const CourseGenerator = ({ episodeId }: CourseGeneratorProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const { t } = useTranslation(['audioCourse']);
  const { user } = useAuth(); // For role checking
  const { getEpisode } = useEpisodes();
  const isDemo = useIsDemo();
  const invalidateLibrary = useInvalidateLibrary();
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  const nativeLanguage: LanguageCode = 'en';
  const targetLanguage: LanguageCode = 'ja';
  const [maxDuration, setMaxDuration] = useState(30);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [speaker1VoiceId, setSpeaker1VoiceId] = useState('');
  const [speaker2VoiceId, setSpeaker2VoiceId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMetadata, setErrorMetadata] = useState<ErrorMetadata | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [step, setStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [_generatedCourseId, setGeneratedCourseId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [adminDraftCourseId, setAdminDraftCourseId] = useState<string | null>(null);

  // Show upgrade prompt when quota is exceeded
  useEffect(() => {
    if (errorMetadata?.status === 429 && errorMetadata?.quota) {
      setShowUpgradePrompt(true);
    }
  }, [errorMetadata]);

  // Initialize default voices when languages change
  useEffect(() => {
    const { narratorVoice, speakerVoices } = getCourseSpeakerVoices(
      targetLanguage,
      nativeLanguage,
      2
    );

    setSelectedVoice(narratorVoice);
    setSpeaker1VoiceId(speakerVoices[0] || '');
    setSpeaker2VoiceId(speakerVoices[1] || '');
  }, [nativeLanguage, targetLanguage]);

  // Load episode details when creating a course from an existing dialogue
  useEffect(() => {
    if (!episodeId) return undefined;
    let isActive = true;

    const loadEpisode = async () => {
      try {
        setEpisodeLoading(true);
        setEpisodeError(null);
        const data = await getEpisode(episodeId, false, viewAsUserId);
        if (!isActive) return;

        setEpisode(data);
        setTitle((prev) => prev || `${data.title} - Audio Course`);
        if (data.jlptLevel) {
          setJlptLevel(data.jlptLevel);
        }

        if (data.dialogue?.speakers?.length) {
          const [first, second] = data.dialogue.speakers;
          if (first?.voiceId) setSpeaker1VoiceId(first.voiceId);
          if (second?.voiceId) setSpeaker2VoiceId(second.voiceId);
        }
      } catch (err) {
        if (!isActive) return;
        setEpisodeError(err instanceof Error ? err.message : 'Failed to load dialogue');
      } finally {
        if (isActive) setEpisodeLoading(false);
      }
    };

    loadEpisode();

    return () => {
      isActive = false;
    };
  }, [episodeId, getEpisode, viewAsUserId]);

  const handleCreate = async () => {
    // Block demo users from creating content
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }

    if (!title.trim() || (!episodeId && !sourceText.trim())) {
      setError(t('audioCourse:alerts.fillRequired'));
      return;
    }

    if (!selectedVoice) {
      setError(t('audioCourse:alerts.selectVoice'));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Create course
      const viewAsParam = viewAsUserId ? `?viewAs=${viewAsUserId}` : '';
      const createResponse = await fetch(`/api/courses${viewAsParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          ...(episodeId ? { episodeIds: [episodeId] } : { sourceText: sourceText.trim() }),
          nativeLanguage,
          targetLanguage,
          maxLessonDurationMinutes: maxDuration,
          l1VoiceId: selectedVoice,
          jlptLevel,
          speaker1Gender: 'male',
          speaker2Gender: 'female',
          speaker1VoiceId,
          speaker2VoiceId,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        // Handle both formats: { message } and { error: { message } }
        const errorMessage =
          errorData.message ||
          errorData.error?.message ||
          (typeof errorData.error === 'string' ? errorData.error : null) ||
          'Failed to create course';
        throw new Error(errorMessage);
      }

      const course = await createResponse.json();
      setGeneratedCourseId(course.id);

      // Start generation
      const generateResponse = await fetch(`/api/courses/${course.id}/generate${viewAsParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        // Handle both formats: { message } and { error: { message } }
        const errorMessage =
          errorData.message ||
          errorData.error?.message ||
          (typeof errorData.error === 'string' ? errorData.error : null) ||
          'Failed to start course generation';

        // Capture metadata for quota errors (can be at root or nested in error)
        const quota = errorData.quota || errorData.error?.quota;
        if (generateResponse.status === 429 && quota) {
          setErrorMetadata({
            status: generateResponse.status,
            quota,
          });
        }

        throw new Error(errorMessage);
      }

      setStep('complete');

      // Invalidate library cache so new course shows up
      invalidateLibrary();

      // Navigate to library page after a short delay
      setTimeout(() => {
        const libraryUrl = viewAsUserId ? `/app/library?viewAs=${viewAsUserId}` : '/app/library';
        navigate(libraryUrl);
      }, 2000);
    } catch (err) {
      console.error('Course creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create course');
      setIsCreating(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!title.trim() || (!episodeId && !sourceText.trim())) {
      setError(t('audioCourse:alerts.fillRequired'));
      return;
    }

    if (!selectedVoice) {
      setError(t('audioCourse:alerts.selectVoice'));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const viewAsParam = viewAsUserId ? `?viewAs=${viewAsUserId}` : '';
      const createResponse = await fetch(`/api/courses${viewAsParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          ...(episodeId ? { episodeIds: [episodeId] } : { sourceText: sourceText.trim() }),
          nativeLanguage,
          targetLanguage,
          maxLessonDurationMinutes: maxDuration,
          l1VoiceId: selectedVoice,
          jlptLevel,
          speaker1Gender: 'male',
          speaker2Gender: 'female',
          speaker1VoiceId,
          speaker2VoiceId,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        const errorMessage =
          errorData.message ||
          errorData.error?.message ||
          (typeof errorData.error === 'string' ? errorData.error : null) ||
          'Failed to create course';
        throw new Error(errorMessage);
      }

      const course = await createResponse.json();
      setAdminDraftCourseId(course.id);
    } catch (err) {
      console.error('Course draft creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create course draft');
    } finally {
      setIsCreating(false);
    }
  };

  const dialoguePreview = useMemo(() => {
    if (!episode?.dialogue?.sentences?.length) return '';
    const speakerMap = new Map(
      episode.dialogue.speakers?.map((speaker) => [speaker.id, speaker.name]) || []
    );
    return episode.dialogue.sentences
      .map((sentence) => {
        const speakerName = speakerMap.get(sentence.speakerId) || 'Speaker';
        return `${speakerName}: ${sentence.text}`;
      })
      .join('\n');
  }, [episode]);

  if (step === 'complete') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-coral p-12 shadow-sm text-center">
          <div className="w-20 h-20 bg-coral rounded-full flex items-center justify-center mx-auto mb-8">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-dark-brown mb-3">
            {t('audioCourse:complete.title')}
          </h2>
          <p className="text-xl text-gray-600 mb-6">{t('audioCourse:complete.description')}</p>
        </div>
      </div>
    );
  }

  const narratorVoices = TTS_VOICES[nativeLanguage as keyof typeof TTS_VOICES]?.voices || [];
  const narratorVoiceChoices = narratorVoices.filter((voice) => voice.provider === 'fishaudio');
  const targetVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Course Details */}
      <div className="bg-white border-l-8 border-coral p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-dark-brown mb-6">
          {t('audioCourse:courseDetails.title')}
        </h2>

        <div className="space-y-6">
          <div>
            <label
              htmlFor="course-generator-title"
              className="block text-base font-bold text-dark-brown mb-3"
            >
              {t('audioCourse:courseDetails.courseTitle')} *
            </label>
            <input
              id="course-generator-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base"
              placeholder={t('audioCourse:courseDetails.courseTitlePlaceholder')}
            />
          </div>

          <div>
            <label
              htmlFor="course-generator-story"
              className="block text-base font-bold text-dark-brown mb-3"
            >
              {episodeId
                ? t('audioCourse:courseDetails.dialoguePreview')
                : t('audioCourse:courseDetails.yourStory')}{' '}
              {!episodeId && '*'}
            </label>
            {episodeId ? (
              <>
                <textarea
                  id="course-generator-story"
                  value={dialoguePreview}
                  readOnly
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-base h-40"
                  placeholder={t('audioCourse:courseDetails.dialoguePlaceholder')}
                />
                <p className="text-sm text-gray-500 mt-2">
                  {t('audioCourse:courseDetails.dialogueHelper')}
                </p>
                {episodeLoading && (
                  <p className="text-sm text-gray-500 mt-2">
                    {t('audioCourse:courseDetails.loadingDialogue')}
                  </p>
                )}
                {episodeError && <p className="text-sm text-red-600 mt-2">{episodeError}</p>}
              </>
            ) : (
              <>
                <textarea
                  id="course-generator-story"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base h-40"
                  placeholder={t('audioCourse:courseDetails.storyPlaceholder')}
                />
                <p className="text-sm text-gray-500 mt-2">
                  {t('audioCourse:courseDetails.storyHelper')}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Voice Configuration */}
      <div className="bg-white border-l-8 border-coral p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-dark-brown mb-6">
          {t('audioCourse:voiceConfig.title')}
        </h2>

        <div className="space-y-6">
          {/* Narrator Voice */}
          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-base font-bold text-dark-brown mb-4">
              {t('audioCourse:voiceConfig.narrator')} ({nativeLanguage.toUpperCase()})
            </h3>
            <div>
              <label
                htmlFor="generator-narrator-voice"
                className="block text-base font-bold text-dark-brown mb-2"
              >
                {t('audioCourse:voiceConfig.narratorLabel')}
              </label>
              <select
                id="generator-narrator-voice"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base"
              >
                {narratorVoiceChoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.description} ({voice.gender})
                  </option>
                ))}
              </select>
              <VoicePreview voiceId={selectedVoice} />
            </div>
          </div>

          {/* Dialogue Voices */}
          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-base font-bold text-dark-brown mb-4">
              {t('audioCourse:voiceConfig.dialogueVoices')} ({targetLanguage.toUpperCase()})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Speaker 1 */}
              <div>
                <label
                  htmlFor="generator-speaker1-voice"
                  className="block text-base font-bold text-dark-brown mb-2"
                >
                  {t('audioCourse:voiceConfig.speaker1')}
                </label>
                <select
                  id="generator-speaker1-voice"
                  value={speaker1VoiceId}
                  onChange={(e) => setSpeaker1VoiceId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base"
                >
                  {targetVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                    </option>
                  ))}
                </select>
                <VoicePreview voiceId={speaker1VoiceId} />
              </div>

              {/* Speaker 2 */}
              <div>
                <label
                  htmlFor="generator-speaker2-voice"
                  className="block text-base font-bold text-dark-brown mb-2"
                >
                  {t('audioCourse:voiceConfig.speaker2')}
                </label>
                <select
                  id="generator-speaker2-voice"
                  value={speaker2VoiceId}
                  onChange={(e) => setSpeaker2VoiceId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base"
                >
                  {targetVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                    </option>
                  ))}
                </select>
                <VoicePreview voiceId={speaker2VoiceId} />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3">{t('audioCourse:voiceConfig.voiceHelper')}</p>
          </div>
        </div>
      </div>

      {/* Course Settings */}
      <div className="bg-white border-l-8 border-coral p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-dark-brown mb-6">
          {t('audioCourse:courseSettings.title')}
        </h2>

        <div className={user?.role === 'admin' ? 'grid grid-cols-2 gap-6' : ''}>
          {user?.role === 'admin' && (
            <div>
              <label
                htmlFor="generator-max-duration"
                className="block text-base font-bold text-dark-brown mb-2"
              >
                {t('audioCourse:courseSettings.maxDuration')}
              </label>
              <select
                id="generator-max-duration"
                value={maxDuration}
                onChange={(e) => setMaxDuration(parseInt(e.target.value, 10))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base"
              >
                <option value={10}>{t('audioCourse:courseSettings.durationOptions.10')}</option>
                <option value={15}>{t('audioCourse:courseSettings.durationOptions.15')}</option>
                <option value={20}>{t('audioCourse:courseSettings.durationOptions.20')}</option>
                <option value={30}>{t('audioCourse:courseSettings.durationOptions.30')}</option>
              </select>
              <p className="text-sm text-gray-500 mt-2">
                {t('audioCourse:courseSettings.durationHelper')}
              </p>
            </div>
          )}

          {targetLanguage === 'ja' && (
            <div>
              <label
                htmlFor="generator-jlpt-level"
                className="block text-base font-bold text-dark-brown mb-2"
              >
                {t('audioCourse:courseSettings.targetJLPT')}
              </label>
              <select
                id="generator-jlpt-level"
                value={jlptLevel}
                onChange={(e) => setJlptLevel(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base"
              >
                <option value="N5">{t('audioCourse:courseSettings.jlpt.n5')}</option>
                <option value="N4">{t('audioCourse:courseSettings.jlpt.n4')}</option>
                <option value="N3">{t('audioCourse:courseSettings.jlpt.n3')}</option>
                <option value="N2">{t('audioCourse:courseSettings.jlpt.n2')}</option>
                <option value="N1">{t('audioCourse:courseSettings.jlpt.n1')}</option>
              </select>
              <p className="text-sm text-gray-500 mt-2">
                {t('audioCourse:courseSettings.levelHelper')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Admin Mode Toggle */}
      {user?.role === 'admin' && !adminDraftCourseId && (
        <div className="bg-white border-l-8 border-purple-500 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-dark-brown">Script Lab (Admin)</h3>
              <p className="text-sm text-gray-500 mt-1">
                Step through the pipeline: prompt, dialogue, script, then audio
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAdminMode(!adminMode)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                adminMode ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  adminMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Generate Button / Create Draft Button */}
      <div className="bg-coral-light border-l-8 border-coral p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 sm:gap-8">
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-bold text-dark-brown mb-2 sm:mb-3">
              {adminMode ? 'Create Draft Course' : t('audioCourse:generate.ready')}
            </h3>
            <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
              {adminMode
                ? 'Creates the course record without starting generation. You can then step through each pipeline stage.'
                : t('audioCourse:generate.description')}
            </p>
            {!adminMode && (
              <ul className="text-sm sm:text-base text-gray-700 space-y-1.5 sm:space-y-2">
                <li className="font-medium">• {t('audioCourse:generate.features.duration')}</li>
                <li className="font-medium">• {t('audioCourse:generate.features.narration')}</li>
                <li className="font-medium">• {t('audioCourse:generate.features.pauses')}</li>
                <li className="font-medium">
                  • {t('audioCourse:generate.features.level', { level: jlptLevel })}
                </li>
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={adminMode ? handleCreateDraft : handleCreate}
            disabled={
              isCreating || !title.trim() || (!episodeId && !sourceText.trim()) || !selectedVoice
            }
            className="w-full sm:w-auto bg-coral hover:bg-coral-dark text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {/* eslint-disable-next-line no-nested-ternary */}
            {isCreating
              ? adminMode
                ? 'Creating Draft...'
                : t('audioCourse:generate.creating')
              : adminMode
                ? 'Create Draft'
                : t('audioCourse:generate.button')}
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-base font-medium">
            {error}
          </div>
        )}
      </div>

      {/* Admin Script Workbench */}
      {adminDraftCourseId && <AdminScriptWorkbench courseId={adminDraftCourseId} />}

      {/* Demo Restriction Modal */}
      <DemoRestrictionModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)} />

      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt && errorMetadata?.quota && (
        <UpgradePrompt
          onClose={() => setShowUpgradePrompt(false)}
          quotaUsed={errorMetadata.quota.used}
          quotaLimit={errorMetadata.quota.limit}
        />
      )}
    </div>
  );
};

export default CourseGenerator;
