/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  SUPPORTED_LANGUAGES,
  SPEAKER_COLORS,
  TTS_VOICES,
} from '@languageflow/shared/src/constants-new';
// eslint-disable-next-line import/no-extraneous-dependencies
import { getRandomName } from '@languageflow/shared/src/nameConstants';
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  getCourseSpeakerVoices,
  getDialogueSpeakerVoices,
} from '@languageflow/shared/src/voiceSelection';
import { LanguageCode, ProficiencyLevel, ToneStyle } from '../../types';
import { useEpisodes } from '../../hooks/useEpisodes';
import { useInvalidateLibrary } from '../../hooks/useLibraryData';
import { useIsDemo } from '../../hooks/useDemo';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import DemoRestrictionModal from '../common/DemoRestrictionModal';
import UpgradePrompt from '../common/UpgradePrompt';
import VoicePreview from '../common/VoicePreview';

interface SpeakerFormData {
  name: string;
  voiceId: string;
  proficiency: ProficiencyLevel;
  tone: ToneStyle;
  color: string;
}

// Note: Speaker colors are now assigned at runtime based on index, not stored in the database
// This constant is kept for backward compatibility with episode creation API
const DEFAULT_SPEAKER_COLORS = SPEAKER_COLORS;

const DialogueGenerator = () => {
  const { t } = useTranslation(['dialogue']);
  const navigate = useNavigate();
  const isDemo = useIsDemo();
  const { isFeatureEnabled } = useFeatureFlags();
  const {
    createEpisode,
    generateDialogue,
    generateAllSpeedsAudio,
    getEpisode,
    pollJobStatus,
    loading,
    error,
    errorMetadata,
  } = useEpisodes();
  const invalidateLibrary = useInvalidateLibrary();
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [sourceText, setSourceText] = useState('');
  const targetLanguage: LanguageCode = 'ja';
  const nativeLanguage: LanguageCode = 'en';
  const [dialogueLength, setDialogueLength] = useState(8);
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [tone, setTone] = useState<ToneStyle>('casual');
  const [autoGenerateAudio, setAutoGenerateAudio] = useState(true);
  const [vocabSeedOverride, setVocabSeedOverride] = useState('');
  const [grammarSeedOverride, setGrammarSeedOverride] = useState('');
  const [createAudioCourse, setCreateAudioCourse] = useState(false);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseMaxDuration, setCourseMaxDuration] = useState(30);
  const [courseNarratorVoice, setCourseNarratorVoice] = useState('');

  // Initialize speakers based on target language with unique voices
  const [speakers, setSpeakers] = useState<SpeakerFormData[]>(() => {
    const speakerVoices = getDialogueSpeakerVoices(targetLanguage, 2);
    return speakerVoices.map((speaker, index) => ({
      name: getRandomName(targetLanguage, speaker.gender as 'male' | 'female'),
      voiceId: speaker.voiceId,
      proficiency: 'intermediate' as ProficiencyLevel,
      tone: 'casual' as ToneStyle,
      color: DEFAULT_SPEAKER_COLORS[index],
    }));
  });
  const audioCourseEnabled = isFeatureEnabled('audioCourseEnabled');

  // Show upgrade prompt when quota is exceeded
  useEffect(() => {
    if (errorMetadata?.status === 429 && errorMetadata?.quota) {
      setShowUpgradePrompt(true);
    }
  }, [errorMetadata]);

  // Keep speaker tone in sync with selection without resetting voices
  useEffect(() => {
    setSpeakers((prev) =>
      prev.map((speaker) => ({
        ...speaker,
        tone,
      }))
    );
  }, [tone]);

  // Initialize narrator voice for optional audio course creation
  useEffect(() => {
    const { narratorVoice } = getCourseSpeakerVoices(targetLanguage, nativeLanguage, 2);
    setCourseNarratorVoice((prev) => prev || narratorVoice);
  }, [nativeLanguage, targetLanguage]);

  const [step, setStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [generatedEpisodeId, setGeneratedEpisodeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const courseCreationStartedRef = useRef(false);

  // Helper function to get proficiency level
  const getProficiencyLevel = () => jlptLevel;

  const createCourseFromEpisode = useCallback(
    async (episodeId: string): Promise<string | null> => {
      if (!createAudioCourse || !audioCourseEnabled) return null;

      const getTargetVoiceGender = (voiceId: string): 'male' | 'female' => {
        const voices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];
        const match = voices.find((voice) => voice.id === voiceId);
        return match?.gender === 'female' ? 'female' : 'male';
      };

      const createResponse = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: courseTitle.trim(),
          episodeIds: [episodeId],
          nativeLanguage,
          targetLanguage,
          maxLessonDurationMinutes: courseMaxDuration,
          l1VoiceId: courseNarratorVoice,
          jlptLevel,
          speaker1Gender: getTargetVoiceGender(speakers[0]?.voiceId),
          speaker2Gender: getTargetVoiceGender(speakers[1]?.voiceId),
          speaker1VoiceId: speakers[0]?.voiceId,
          speaker2VoiceId: speakers[1]?.voiceId,
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

      const generateResponse = await fetch(`/api/courses/${course.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        const errorMessage =
          errorData.message ||
          errorData.error?.message ||
          (typeof errorData.error === 'string' ? errorData.error : null) ||
          'Failed to start course generation';
        throw new Error(errorMessage);
      }

      return course.id;
    },
    [
      audioCourseEnabled,
      courseMaxDuration,
      courseNarratorVoice,
      courseTitle,
      createAudioCourse,
      jlptLevel,
      nativeLanguage,
      speakers,
      targetLanguage,
    ]
  );

  // Poll job status when generating
  useEffect(() => {
    if (!jobId || step !== 'generating') return undefined;

    const pollInterval = setInterval(async () => {
      const status = await pollJobStatus(jobId);

      if (status === 'completed') {
        clearInterval(pollInterval);

        // Guard against duplicate completion handling from effect restarts
        if (courseCreationStartedRef.current) return;
        courseCreationStartedRef.current = true;

        setCourseError(null);

        let createdCourseId: string | null = null;

        // Automatically trigger audio generation after dialogue completes (opt-out)
        if (generatedEpisodeId && autoGenerateAudio) {
          try {
            // Get the episode to find the dialogue ID
            const episode = await getEpisode(generatedEpisodeId);

            if (episode.dialogue?.id) {
              // Trigger multi-speed audio generation
              await generateAllSpeedsAudio(generatedEpisodeId, episode.dialogue.id);
            }
          } catch (audioError) {
            console.error('Failed to trigger audio generation:', audioError);
          }
        }

        if (generatedEpisodeId && createAudioCourse && audioCourseEnabled) {
          try {
            createdCourseId = await createCourseFromEpisode(generatedEpisodeId);
          } catch (courseErr) {
            console.error('Failed to create audio course:', courseErr);
            const message =
              courseErr instanceof Error
                ? courseErr.message
                : t('dialogue:complete.courseFailureFallback');
            setCourseError(message);
          }
        }

        setStep('complete');

        // Invalidate library cache so new episode shows up
        invalidateLibrary();

        const shouldAutoRedirect = !createAudioCourse || !!createdCourseId;

        if (shouldAutoRedirect) {
          // Navigate to playback page or course page
          setTimeout(() => {
            if (createdCourseId) {
              navigate(`/app/courses/${createdCourseId}`);
            } else if (generatedEpisodeId) {
              navigate(`/app/playback/${generatedEpisodeId}`);
            }
          }, 2000);
        }
      } else if (status === 'failed') {
        clearInterval(pollInterval);
        setStep('input');
        // eslint-disable-next-line no-alert
        alert(t('dialogue:alerts.generationFailed'));
      }
    }, 5000); // Poll every 5 seconds (reduced from 2s to minimize Redis usage)

    return () => clearInterval(pollInterval);
  }, [
    jobId,
    step,
    generatedEpisodeId,
    autoGenerateAudio,
    createAudioCourse,
    audioCourseEnabled,
    createCourseFromEpisode,
    pollJobStatus,
    getEpisode,
    generateAllSpeedsAudio,
    navigate,
  ]);

  const handleGenerate = async () => {
    // Block demo users from generating content
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }

    if (!sourceText.trim()) {
      // eslint-disable-next-line no-alert
      alert(t('dialogue:alerts.fillRequired'));
      return;
    }

    if (speakers.length < 2) {
      // eslint-disable-next-line no-alert
      alert(t('dialogue:alerts.twoSpeakers'));
      return;
    }

    if (createAudioCourse && audioCourseEnabled) {
      if (!courseTitle.trim() || !courseNarratorVoice) {
        // eslint-disable-next-line no-alert
        alert(t('dialogue:alerts.courseFields'));
        return;
      }
    }

    try {
      setCourseError(null);
      courseCreationStartedRef.current = false;
      setStep('generating');

      // Get the appropriate proficiency level based on target language
      const proficiencyLevel = getProficiencyLevel();

      // Step 1: Create episode with placeholder title
      const episode = await createEpisode({
        title: t('dialogue:placeholderTitle'),
        sourceText,
        targetLanguage,
        nativeLanguage,
        speakers: speakers.map((s) => ({
          name: s.name,
          voiceId: s.voiceId,
          proficiency: proficiencyLevel as ProficiencyLevel,
          tone: s.tone,
          color: s.color,
        })),
        audioSpeed: 'medium',
        jlptLevel,
        autoGenerateAudio,
      });

      setGeneratedEpisodeId(episode.id);

      // Step 2: Generate dialogue
      const { jobId: generationJobId } = await generateDialogue(
        episode.id,
        speakers.map((s) => ({
          id: '', // Will be assigned by backend
          name: s.name,
          voiceId: s.voiceId,
          proficiency: proficiencyLevel as ProficiencyLevel,
          tone: s.tone,
          color: s.color,
        })),
        3, // Generate 3 variations per sentence
        dialogueLength, // Number of dialogue turns
        {
          jlptLevel,
          vocabSeedOverride,
          grammarSeedOverride,
        }
      );

      // Save job ID for polling
      setJobId(generationJobId);

      // The useEffect hook will now poll for completion
    } catch (err) {
      console.error('Failed to generate dialogue:', err);
      setStep('input');
    }
  };

  if (step === 'generating') {
    return (
      <div className="retro-dialogue-create-v3-generator">
        <div className="retro-dialogue-create-v3-state">
          <div className="loading-spinner retro-dialogue-create-v3-spinner" />
          <h2 className="retro-dialogue-create-v3-state-title">{t('dialogue:generating.title')}</h2>
          <p className="retro-dialogue-create-v3-state-copy">
            {t('dialogue:generating.description')}
          </p>
          {error && <div className="retro-dialogue-create-v3-alert is-error">{error}</div>}
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="retro-dialogue-create-v3-generator">
        <div className="retro-dialogue-create-v3-state">
          <div className="retro-dialogue-create-v3-check">
            <svg
              className="retro-dialogue-create-v3-check-icon"
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
          <h2 className="retro-dialogue-create-v3-state-title">{t('dialogue:complete.title')}</h2>
          <p className="retro-dialogue-create-v3-state-copy">
            {courseError
              ? t('dialogue:complete.courseFailureSubtitle')
              : t('dialogue:complete.redirecting')}
          </p>
          {courseError && (
            <div className="retro-dialogue-create-v3-alert is-warning">
              <p className="retro-dialogue-create-v3-alert-title">
                {t('dialogue:complete.courseFailureTitle')}
              </p>
              <p className="retro-dialogue-create-v3-alert-copy">
                {t('dialogue:complete.courseFailureBody')}
              </p>
              <p className="retro-dialogue-create-v3-alert-detail">
                {t('dialogue:complete.courseFailureDetail', { message: courseError })}
              </p>
              {generatedEpisodeId && (
                <button
                  type="button"
                  className="retro-dialogue-create-v3-alert-btn"
                  onClick={() => navigate(`/app/playback/${generatedEpisodeId}`)}
                >
                  {t('dialogue:complete.courseFailureCta')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const narratorVoices = TTS_VOICES[nativeLanguage as keyof typeof TTS_VOICES]?.voices || [];
  const narratorVoiceChoices = narratorVoices.filter((voice) => voice.provider === 'fishaudio');
  const targetVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];

  return (
    <div className="space-y-6 retro-dialogue-create-v3-generator">
      {/* Episode Details */}
      <section className="retro-dialogue-create-v3-section">
        <h2 className="retro-dialogue-create-v3-section-title">{t('dialogue:form.yourStory')}</h2>

        <div className="space-y-6">
          <div>
            <label htmlFor="dialogue-source-text" className="retro-dialogue-create-v3-label">
              {t('dialogue:form.whatToTalkAbout')} *
            </label>
            <textarea
              id="dialogue-source-text"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea"
              placeholder={t('dialogue:form.storyPlaceholder')}
              data-testid="dialogue-input-source-text"
            />
            <p className="retro-dialogue-create-v3-helper">{t('dialogue:form.storyHelper')}</p>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="dialogue-length" className="retro-dialogue-create-v3-label">
                {t('dialogue:form.conversationLength')}
              </label>
              <select
                id="dialogue-length"
                value={dialogueLength}
                onChange={(e) => setDialogueLength(parseInt(e.target.value, 10))}
                className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
                data-testid="dialogue-select-length"
              >
                <option value="8">{t('dialogue:form.turns', { count: 8 })}</option>
                <option value="15">{t('dialogue:form.turns', { count: 15 })}</option>
                <option value="30">{t('dialogue:form.turns', { count: 30 })}</option>
                <option value="50">{t('dialogue:form.turns', { count: 50 })}</option>
              </select>
            </div>

            {targetLanguage === 'ja' && (
              <div>
                <label htmlFor="dialogue-jlpt-level" className="retro-dialogue-create-v3-label">
                  {t('dialogue:form.targetJLPT')}
                </label>
                <select
                  id="dialogue-jlpt-level"
                  value={jlptLevel}
                  onChange={(e) => setJlptLevel(e.target.value)}
                  className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
                  data-testid="dialogue-select-jlpt-level"
                >
                  <option value="N5">{t('dialogue:form.jlpt.n5')}</option>
                  <option value="N4">{t('dialogue:form.jlpt.n4')}</option>
                  <option value="N3">{t('dialogue:form.jlpt.n3')}</option>
                  <option value="N2">{t('dialogue:form.jlpt.n2')}</option>
                  <option value="N1">{t('dialogue:form.jlpt.n1')}</option>
                </select>
              </div>
            )}

            <div>
              <label htmlFor="dialogue-tone" className="retro-dialogue-create-v3-label">
                {t('dialogue:form.tone')}
              </label>
              <select
                id="dialogue-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as ToneStyle)}
                className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
                data-testid="dialogue-select-tone"
              >
                <option value="casual">{t('dialogue:form.tones.casual')}</option>
                <option value="polite">{t('dialogue:form.tones.polite')}</option>
                <option value="formal">{t('dialogue:form.tones.formal')}</option>
              </select>
            </div>

            {targetLanguage === 'ja' && (
              <div className="retro-dialogue-create-v3-divider">
                <h3 className="retro-dialogue-create-v3-subtitle-title">
                  {t('dialogue:form.seedOverrides')}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="dialogue-vocab-seeds"
                      className="retro-dialogue-create-v3-label is-small"
                    >
                      {t('dialogue:form.vocabSeeds')}
                    </label>
                    <textarea
                      id="dialogue-vocab-seeds"
                      value={vocabSeedOverride}
                      onChange={(e) => setVocabSeedOverride(e.target.value)}
                      className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea is-short"
                      placeholder={t('dialogue:form.vocabSeedsPlaceholder')}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dialogue-grammar-seeds"
                      className="retro-dialogue-create-v3-label is-small"
                    >
                      {t('dialogue:form.grammarSeeds')}
                    </label>
                    <textarea
                      id="dialogue-grammar-seeds"
                      value={grammarSeedOverride}
                      onChange={(e) => setGrammarSeedOverride(e.target.value)}
                      className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea is-short"
                      placeholder={t('dialogue:form.grammarSeedsPlaceholder')}
                    />
                  </div>
                  <p className="retro-dialogue-create-v3-helper is-small">
                    {t('dialogue:form.seedHelper')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Voice Configuration */}
      <section className="retro-dialogue-create-v3-section">
        <h2 className="retro-dialogue-create-v3-section-title">
          {t('dialogue:voiceConfig.title')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {speakers.map((speaker, index) => (
            <div key={`${speaker.name}-${speaker.voiceId}`}>
              <label
                htmlFor={`dialogue-speaker-${index + 1}-voice`}
                className="retro-dialogue-create-v3-label"
              >
                {t('dialogue:voiceConfig.speaker', { number: index + 1 })}
              </label>
              <select
                id={`dialogue-speaker-${index + 1}-voice`}
                value={speaker.voiceId}
                onChange={(e) => {
                  const nextVoiceId = e.target.value;
                  setSpeakers((prev) =>
                    prev.map((current, idx) =>
                      idx === index
                        ? {
                            ...current,
                            voiceId: nextVoiceId,
                          }
                        : current
                    )
                  );
                }}
                className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
              >
                {targetVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                  </option>
                ))}
              </select>
              <VoicePreview voiceId={speaker.voiceId} />
            </div>
          ))}
        </div>
        <p className="retro-dialogue-create-v3-helper is-small">
          {t('dialogue:voiceConfig.helper')}
        </p>
      </section>

      {/* Audio Settings */}
      <section className="retro-dialogue-create-v3-section">
        <h2 className="retro-dialogue-create-v3-section-title">
          {t('dialogue:audioSettings.title')}
        </h2>
        <div className="retro-dialogue-create-v3-toggle-row">
          <div>
            <p className="retro-dialogue-create-v3-toggle-title">
              {t('dialogue:audioSettings.autoTitle')}
            </p>
            <p className="retro-dialogue-create-v3-helper">
              {t('dialogue:audioSettings.autoHelper')}
            </p>
          </div>
          <label htmlFor="dialogue-auto-audio" className="retro-dialogue-create-v3-switch">
            <input
              id="dialogue-auto-audio"
              type="checkbox"
              checked={autoGenerateAudio}
              onChange={(e) => setAutoGenerateAudio(e.target.checked)}
              className="retro-dialogue-create-v3-switch-input sr-only"
              aria-label={t('dialogue:audioSettings.autoTitle')}
            />
            <span className="retro-dialogue-create-v3-switch-track" />
          </label>
        </div>
      </section>

      {/* Optional Audio Course */}
      {audioCourseEnabled && (
        <section className="retro-dialogue-create-v3-section is-course">
          <h2 className="retro-dialogue-create-v3-section-title">
            {t('dialogue:audioCourse.title')}
          </h2>
          <div className="retro-dialogue-create-v3-toggle-row">
            <div>
              <p className="retro-dialogue-create-v3-toggle-title">
                {t('dialogue:audioCourse.toggleTitle')}
              </p>
              <p className="retro-dialogue-create-v3-helper">
                {t('dialogue:audioCourse.toggleHelper')}
              </p>
            </div>
            <label
              htmlFor="dialogue-create-audio-course"
              className="retro-dialogue-create-v3-switch"
            >
              <input
                id="dialogue-create-audio-course"
                type="checkbox"
                checked={createAudioCourse}
                onChange={(e) => setCreateAudioCourse(e.target.checked)}
                className="retro-dialogue-create-v3-switch-input sr-only"
                aria-label={t('dialogue:audioCourse.toggleTitle')}
              />
              <span className="retro-dialogue-create-v3-switch-track is-course" />
            </label>
          </div>

          {createAudioCourse && (
            <div className="mt-6 space-y-6">
              <div>
                <label htmlFor="dialogue-course-title" className="retro-dialogue-create-v3-label">
                  {t('dialogue:audioCourse.courseTitle')}
                </label>
                <input
                  id="dialogue-course-title"
                  type="text"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
                  placeholder={t('dialogue:audioCourse.courseTitlePlaceholder')}
                />
              </div>

              <div>
                <label
                  htmlFor="dialogue-course-narrator"
                  className="retro-dialogue-create-v3-label"
                >
                  {t('dialogue:audioCourse.narratorLabel')}
                </label>
                <select
                  id="dialogue-course-narrator"
                  value={courseNarratorVoice}
                  onChange={(e) => setCourseNarratorVoice(e.target.value)}
                  className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
                >
                  {narratorVoiceChoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.description} ({voice.gender})
                    </option>
                  ))}
                </select>
                <VoicePreview voiceId={courseNarratorVoice} />
              </div>

              <div>
                <label
                  htmlFor="dialogue-course-duration"
                  className="retro-dialogue-create-v3-label"
                >
                  {t('dialogue:audioCourse.maxDuration')}
                </label>
                <select
                  id="dialogue-course-duration"
                  value={courseMaxDuration}
                  onChange={(e) => setCourseMaxDuration(parseInt(e.target.value, 10))}
                  className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
                >
                  <option value={10}>{t('dialogue:audioCourse.durationOptions.10')}</option>
                  <option value={15}>{t('dialogue:audioCourse.durationOptions.15')}</option>
                  <option value={20}>{t('dialogue:audioCourse.durationOptions.20')}</option>
                  <option value={30}>{t('dialogue:audioCourse.durationOptions.30')}</option>
                </select>
              </div>

              <p className="retro-dialogue-create-v3-helper is-small">
                {t('dialogue:audioCourse.helper')}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Generate Button */}
      <section className="retro-dialogue-create-v3-summary">
        <div className="retro-dialogue-create-v3-summary-grid">
          <div className="flex-1">
            <h3 className="retro-dialogue-create-v3-summary-title">
              {t('dialogue:generate.ready')}
            </h3>
            <p className="retro-dialogue-create-v3-summary-copy">
              {t('dialogue:generate.description', {
                language: SUPPORTED_LANGUAGES[targetLanguage].name,
                level: getProficiencyLevel() || 'beginner',
                tone,
              })}
            </p>
            <ul className="retro-dialogue-create-v3-summary-list">
              <li>• {t('dialogue:generate.features.turns', { count: dialogueLength })}</li>
              <li>• {t('dialogue:generate.features.variations')}</li>
              <li>• {t('dialogue:generate.features.translations')}</li>
              <li>• {t('dialogue:generate.features.complexity')}</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={
              loading ||
              !sourceText.trim() ||
              (createAudioCourse &&
                audioCourseEnabled &&
                (!courseTitle.trim() || !courseNarratorVoice))
            }
            className="retro-dialogue-create-v3-generate-btn"
            data-testid="dialogue-button-generate"
          >
            {loading ? t('dialogue:generate.generating') : t('dialogue:generate.button')}
          </button>
        </div>

        {error && <div className="retro-dialogue-create-v3-alert is-error">{error}</div>}
      </section>

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

export default DialogueGenerator;
