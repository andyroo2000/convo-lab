import { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// eslint-disable-next-line import/no-extraneous-dependencies
import { getCourseSpeakerVoices } from '@languageflow/shared/src/voiceSelection';
// eslint-disable-next-line import/no-extraneous-dependencies
import { TTS_VOICES } from '@languageflow/shared/src/constants-new';
import { Episode, CreateCourseRequest, LanguageCode } from '../../types';

interface CourseCreatorProps {
  isOpen: boolean;
  episode: Episode;
  onClose: () => void;
  onCourseCreated: (courseId: string) => void;
}

const CourseCreator = ({ isOpen, episode, onClose, onCourseCreated }: CourseCreatorProps) => {
  const { t } = useTranslation('audioCourse');
  const [title, setTitle] = useState('');
  const [maxDuration, setMaxDuration] = useState(30);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [speaker1VoiceId, setSpeaker1VoiceId] = useState('');
  const [speaker2VoiceId, setSpeaker2VoiceId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize default values when modal opens
  useEffect(() => {
    if (isOpen && episode) {
      setTitle(`${episode.title} - Audio Course`);

      const { narratorVoice, speakerVoices } = getCourseSpeakerVoices(
        episode.targetLanguage as LanguageCode,
        episode.nativeLanguage as LanguageCode,
        2
      );

      setSelectedVoice(narratorVoice);
      setSpeaker1VoiceId(speakerVoices[0] || '');
      setSpeaker2VoiceId(speakerVoices[1] || '');

      setError(null);
    }
  }, [isOpen, episode]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isCreating, onClose]);

  const handleCreate = async () => {
    // Prevent double-submission
    if (isCreating) {
      return;
    }

    if (!title.trim()) {
      setError(t('creator.errors.titleRequired'));
      return;
    }

    if (!selectedVoice) {
      setError(t('creator.errors.voiceRequired'));
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
          episodeIds: [episode.id],
          nativeLanguage: episode.nativeLanguage,
          targetLanguage: episode.targetLanguage,
          maxLessonDurationMinutes: maxDuration,
          l1VoiceId: selectedVoice,
          jlptLevel,
          speaker1Gender: 'male', // Speaker 1 default: male
          speaker2Gender: 'female', // Speaker 2 default: female
          speaker1VoiceId,
          speaker2VoiceId,
        } as CreateCourseRequest),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || 'Failed to create course');
      }

      const course = await createResponse.json();

      // Start generation
      const generateResponse = await fetch(`/api/courses/${course.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.message || 'Failed to start course generation');
      }

      // Success!
      onCourseCreated(course.id);
      onClose();
    } catch (err) {
      console.error('Course creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create course');
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const nativeLanguage = episode.nativeLanguage as keyof typeof TTS_VOICES;
  const availableVoices = TTS_VOICES[nativeLanguage]?.voices || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fadeIn"
      onClick={!isCreating ? onClose : undefined}
      onKeyDown={(e) => !isCreating && e.key === 'Escape' && onClose()}
      role="button"
      tabIndex={-1}
      aria-label="Close modal"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-navy">{t('creator.title')}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('creator.subtitle', { episodeTitle: episode.title })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Title Input */}
          <div>
            <label htmlFor="course-title" className="block text-sm font-medium text-gray-700 mb-2">
              {t('creator.titleLabel')}
            </label>
            <input
              id="course-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCreating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
              placeholder={t('creator.titlePlaceholder')}
            />
            <p className="text-xs text-gray-500 mt-1">{t('creator.autoDescription')}</p>
          </div>

          {/* Narrator Voice Selection */}
          <div>
            <label
              htmlFor="narrator-voice"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              {t('creator.narratorLabel', { language: episode.nativeLanguage.toUpperCase() })}
            </label>
            <select
              id="narrator-voice"
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              disabled={isCreating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
            >
              {availableVoices.map((voice: { id: string; description: string; gender: string }) => (
                <option key={voice.id} value={voice.id}>
                  {voice.description} ({voice.gender})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {t('creator.narratorHelper', { language: episode.nativeLanguage.toUpperCase() })}
            </p>
          </div>

          {/* Dialogue Voice Selection */}
          <div className="border-t pt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {t('creator.dialogueVoices', { language: episode.targetLanguage.toUpperCase() })}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Speaker 1 Voice */}
              <div>
                <label
                  htmlFor="speaker1-voice"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {t('voiceConfig.speaker1')}
                </label>
                <select
                  id="speaker1-voice"
                  value={speaker1VoiceId}
                  onChange={(e) => setSpeaker1VoiceId(e.target.value)}
                  disabled={isCreating}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
                >
                  {(
                    TTS_VOICES[episode.targetLanguage as keyof typeof TTS_VOICES]?.voices || []
                  ).map((voice: { id: string; description: string; gender: string }) => (
                    <option key={voice.id} value={voice.id}>
                      ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speaker 2 Voice */}
              <div>
                <label
                  htmlFor="speaker2-voice"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {t('voiceConfig.speaker2')}
                </label>
                <select
                  id="speaker2-voice"
                  value={speaker2VoiceId}
                  onChange={(e) => setSpeaker2VoiceId(e.target.value)}
                  disabled={isCreating}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
                >
                  {(
                    TTS_VOICES[episode.targetLanguage as keyof typeof TTS_VOICES]?.voices || []
                  ).map((voice: { id: string; description: string; gender: string }) => (
                    <option key={voice.id} value={voice.id}>
                      ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{t('voiceConfig.voiceHelper')}</p>
          </div>

          {/* Max Lesson Duration */}
          <div>
            <label htmlFor="max-duration" className="block text-sm font-medium text-gray-700 mb-2">
              {t('courseSettings.maxDuration')}
            </label>
            <select
              id="max-duration"
              value={maxDuration}
              onChange={(e) => setMaxDuration(parseInt(e.target.value, 10))}
              disabled={isCreating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
            >
              <option value={10}>{t('courseSettings.durationOptions.10')}</option>
              <option value={15}>{t('courseSettings.durationOptions.15')}</option>
              <option value={20}>{t('courseSettings.durationOptions.20')}</option>
              <option value={30}>{t('courseSettings.durationOptions.30')}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('courseSettings.durationHelper')}</p>
          </div>

          {/* JLPT Level Selector */}
          <div>
            <label htmlFor="jlpt-level" className="block text-sm font-medium text-gray-700 mb-2">
              {t('courseSettings.targetJLPT')}
            </label>
            <select
              id="jlpt-level"
              value={jlptLevel}
              onChange={(e) => setJlptLevel(e.target.value)}
              disabled={isCreating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
            >
              <option value="N5">{t('courseSettings.jlpt.n5')}</option>
              <option value="N4">{t('courseSettings.jlpt.n4')}</option>
              <option value="N3">{t('courseSettings.jlpt.n3')}</option>
              <option value="N2">{t('courseSettings.jlpt.n2')}</option>
              <option value="N1">{t('courseSettings.jlpt.n1')}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('courseSettings.levelHelper')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{t('creator.pimsleurInfo.title')}</strong>{' '}
              {t('creator.pimsleurInfo.description')}
            </p>
            <ul className="text-xs text-blue-700 mt-2 ml-4 list-disc space-y-1">
              <li>{t('creator.pimsleurInfo.feature1')}</li>
              <li>{t('creator.pimsleurInfo.feature2')}</li>
              <li>{t('creator.pimsleurInfo.feature3')}</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-lg flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="btn-outline flex-1"
          >
            {t('creator.cancel')}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !title.trim() || !selectedVoice}
            className="flex-1 px-4 py-2 bg-navy text-white rounded-lg font-medium hover:bg-navy/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                {t('creator.creating')}
              </>
            ) : (
              t('creator.create')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseCreator;
