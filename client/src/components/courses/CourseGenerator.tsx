import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCourseSpeakerVoices } from '@languageflow/shared/src/voiceSelection';
import { TTS_VOICES } from '@languageflow/shared/src/constants-new';
import { LanguageCode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useInvalidateLibrary } from '../../hooks/useLibraryData';
import { useIsDemo } from '../../hooks/useDemo';
import DemoRestrictionModal from '../common/DemoRestrictionModal';

const CourseGenerator = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['audioCourse']);
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const invalidateLibrary = useInvalidateLibrary();
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>('en');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('ja');
  const [maxDuration, setMaxDuration] = useState(30);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK1');
  const [cefrLevel, setCefrLevel] = useState<string>('A1');
  const [speaker1VoiceId, setSpeaker1VoiceId] = useState('');
  const [speaker2VoiceId, setSpeaker2VoiceId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [generatedCourseId, setGeneratedCourseId] = useState<string | null>(null);

  // Initialize from user preferences
  useEffect(() => {
    if (user) {
      setTargetLanguage(user.preferredStudyLanguage || 'ja');
      setNativeLanguage(user.preferredNativeLanguage || 'en');
    }
  }, [user]);

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

  const handleCreate = async () => {
    // Block demo users from creating content
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }

    if (!title.trim() || !sourceText.trim()) {
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
      const createResponse = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          sourceText: sourceText.trim(),
          nativeLanguage,
          targetLanguage,
          maxLessonDurationMinutes: maxDuration,
          l1VoiceId: selectedVoice,
          jlptLevel: targetLanguage === 'ja' ? jlptLevel : undefined,
          hskLevel: targetLanguage === 'zh' ? hskLevel : undefined,
          cefrLevel: targetLanguage === 'es' || targetLanguage === 'fr' ? cefrLevel : undefined,
          speaker1Gender: 'female',
          speaker2Gender: 'male',
          speaker1VoiceId,
          speaker2VoiceId,
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.message || 'Failed to create course');
      }

      const course = await createResponse.json();
      setGeneratedCourseId(course.id);

      // Start generation
      const generateResponse = await fetch(`/api/courses/${course.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!generateResponse.ok) {
        const error = await generateResponse.json();
        throw new Error(error.message || 'Failed to start course generation');
      }

      setStep('complete');

      // Invalidate library cache so new course shows up
      invalidateLibrary();

      // Navigate to library page after a short delay
      setTimeout(() => {
        navigate('/app/library');
      }, 2000);
    } catch (err) {
      console.error('Course creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create course');
      setIsCreating(false);
    }
  };

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

  const nativeVoices = TTS_VOICES[nativeLanguage as keyof typeof TTS_VOICES]?.voices || [];
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
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('audioCourse:courseDetails.courseTitle')} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base"
              placeholder={t('audioCourse:courseDetails.courseTitlePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-base font-bold text-dark-brown mb-3">
              {t('audioCourse:courseDetails.yourStory')} *
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base h-40"
              placeholder={t('audioCourse:courseDetails.storyPlaceholder')}
            />
            <p className="text-sm text-gray-500 mt-2">
              {t('audioCourse:courseDetails.storyHelper')}
            </p>
          </div>
        </div>
      </div>

      {/* Voice Configuration */}
      <div className="bg-white border-l-8 border-coral p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-dark-brown mb-6">
          {t('audioCourse:voiceConfig.title')}
        </h2>

        <div className="space-y-6">
          {/* Dialogue Voices */}
          <div className="border-t-2 border-gray-200 pt-6">
            <h3 className="text-base font-bold text-dark-brown mb-4">
              {t('audioCourse:voiceConfig.dialogueVoices')} ({targetLanguage.toUpperCase()})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Speaker 1 */}
              <div>
                <label className="block text-base font-bold text-dark-brown mb-2">
                  {t('audioCourse:voiceConfig.speaker1')}
                </label>
                <select
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
              </div>

              {/* Speaker 2 */}
              <div>
                <label className="block text-base font-bold text-dark-brown mb-2">
                  {t('audioCourse:voiceConfig.speaker2')}
                </label>
                <select
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
              <label className="block text-base font-bold text-dark-brown mb-2">
                {t('audioCourse:courseSettings.maxDuration')}
              </label>
              <select
                value={maxDuration}
                onChange={(e) => setMaxDuration(parseInt(e.target.value))}
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
              <label className="block text-base font-bold text-dark-brown mb-2">
                {t('audioCourse:courseSettings.targetJLPT')}
              </label>
              <select
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

          {targetLanguage === 'zh' && (
            <div>
              <label className="block text-base font-bold text-dark-brown mb-2">
                {t('audioCourse:courseSettings.targetHSK')}
              </label>
              <select
                value={hskLevel}
                onChange={(e) => setHskLevel(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base"
              >
                <option value="HSK1">{t('audioCourse:courseSettings.hsk.hsk1')}</option>
                <option value="HSK2">{t('audioCourse:courseSettings.hsk.hsk2')}</option>
                <option value="HSK3">{t('audioCourse:courseSettings.hsk.hsk3')}</option>
                <option value="HSK4">{t('audioCourse:courseSettings.hsk.hsk4')}</option>
                <option value="HSK5">{t('audioCourse:courseSettings.hsk.hsk5')}</option>
                <option value="HSK6">{t('audioCourse:courseSettings.hsk.hsk6')}</option>
              </select>
              <p className="text-sm text-gray-500 mt-2">
                {t('audioCourse:courseSettings.levelHelper')}
              </p>
            </div>
          )}

          {(targetLanguage === 'es' || targetLanguage === 'fr') && (
            <div>
              <label className="block text-base font-bold text-dark-brown mb-2">
                {t('audioCourse:courseSettings.targetCEFR')}
              </label>
              <select
                value={cefrLevel}
                onChange={(e) => setCefrLevel(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-base"
              >
                <option value="A1">{t('audioCourse:courseSettings.cefr.a1')}</option>
                <option value="A2">{t('audioCourse:courseSettings.cefr.a2')}</option>
                <option value="B1">{t('audioCourse:courseSettings.cefr.b1')}</option>
                <option value="B2">{t('audioCourse:courseSettings.cefr.b2')}</option>
                <option value="C1">{t('audioCourse:courseSettings.cefr.c1')}</option>
                <option value="C2">{t('audioCourse:courseSettings.cefr.c2')}</option>
              </select>
              <p className="text-sm text-gray-500 mt-2">
                {t('audioCourse:courseSettings.levelHelper')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <div className="bg-coral-light border-l-8 border-coral p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 sm:gap-8">
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-bold text-dark-brown mb-2 sm:mb-3">
              {t('audioCourse:generate.ready')}
            </h3>
            <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
              {t('audioCourse:generate.description')}
            </p>
            <ul className="text-sm sm:text-base text-gray-700 space-y-1.5 sm:space-y-2">
              <li className="font-medium">• {t('audioCourse:generate.features.duration')}</li>
              <li className="font-medium">• {t('audioCourse:generate.features.narration')}</li>
              <li className="font-medium">• {t('audioCourse:generate.features.pauses')}</li>
              <li className="font-medium">
                • {t('audioCourse:generate.features.level', { level: jlptLevel })}
              </li>
            </ul>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !title.trim() || !sourceText.trim() || !selectedVoice}
            className="w-full sm:w-auto bg-coral hover:bg-coral-dark text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isCreating ? t('audioCourse:generate.creating') : t('audioCourse:generate.button')}
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-base font-medium">
            {error}
          </div>
        )}
      </div>

      {/* Demo Restriction Modal */}
      <DemoRestrictionModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)} />
    </div>
  );
};

export default CourseGenerator;
