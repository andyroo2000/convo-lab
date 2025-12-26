/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// eslint-disable-next-line import/no-extraneous-dependencies
import { SUPPORTED_LANGUAGES, SPEAKER_COLORS } from '@languageflow/shared/src/constants-new';
// eslint-disable-next-line import/no-extraneous-dependencies
import { getRandomName } from '@languageflow/shared/src/nameConstants';
// eslint-disable-next-line import/no-extraneous-dependencies
import { getDialogueSpeakerVoices } from '@languageflow/shared/src/voiceSelection';
import { LanguageCode, ProficiencyLevel, ToneStyle } from '../../types';
import { useEpisodes } from '../../hooks/useEpisodes';
import { useInvalidateLibrary } from '../../hooks/useLibraryData';
import { useIsDemo } from '../../hooks/useDemo';
import { useAuth } from '../../contexts/AuthContext';
import DemoRestrictionModal from '../common/DemoRestrictionModal';

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
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const {
    createEpisode,
    generateDialogue,
    generateAllSpeedsAudio,
    getEpisode,
    pollJobStatus,
    loading,
    error,
  } = useEpisodes();
  const invalidateLibrary = useInvalidateLibrary();
  const [showDemoModal, setShowDemoModal] = useState(false);

  const [sourceText, setSourceText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('ja');
  const [nativeLanguage] = useState<LanguageCode>('en');
  const [dialogueLength, setDialogueLength] = useState(8);
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK1');
  const [cefrLevel, setCefrLevel] = useState<string>('A1');
  const [tone, setTone] = useState<ToneStyle>('casual');

  // Initialize from user preferences
  useEffect(() => {
    if (user) {
      setTargetLanguage(user.preferredStudyLanguage || 'ja');
      // Initialize language-specific proficiency levels from user settings if available
      // For now, defaults to N5/HSK1 since we don't have user JLPT/HSK preferences yet
    }
  }, [user]);

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

  // Re-initialize speakers when target language changes
  useEffect(() => {
    const speakerVoices = getDialogueSpeakerVoices(targetLanguage, 2);
    setSpeakers(
      speakerVoices.map((speaker, index) => ({
        name: getRandomName(targetLanguage, speaker.gender as 'male' | 'female'),
        voiceId: speaker.voiceId,
        proficiency: 'intermediate' as ProficiencyLevel,
        tone,
        color: DEFAULT_SPEAKER_COLORS[index],
      }))
    );
  }, [targetLanguage, tone]);

  const [step, setStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [generatedEpisodeId, setGeneratedEpisodeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // Poll job status when generating
  useEffect(() => {
    if (!jobId || step !== 'generating') return undefined;

    const pollInterval = setInterval(async () => {
      const status = await pollJobStatus(jobId);

      if (status === 'completed') {
        clearInterval(pollInterval);

        // Automatically trigger audio generation after dialogue completes
        if (generatedEpisodeId) {
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

        setStep('complete');

        // Invalidate library cache so new episode shows up
        invalidateLibrary();

        // Navigate to playback page
        setTimeout(() => {
          if (generatedEpisodeId) {
            navigate(`/app/playback/${generatedEpisodeId}`);
          }
        }, 2000);
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
    pollJobStatus,
    getEpisode,
    generateAllSpeedsAudio,
    navigate,
  ]);

  // Helper function to get proficiency level based on target language
  const getProficiencyLevel = () => {
    if (targetLanguage === 'ja') return jlptLevel;
    if (targetLanguage === 'zh') return hskLevel;
    return cefrLevel;
  };

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

    try {
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
        dialogueLength // Number of dialogue turns
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-periwinkle p-12 shadow-sm text-center">
          <div className="loading-spinner w-16 h-16 border-4 border-periwinkle border-t-transparent rounded-full mx-auto mb-8" />
          <h2 className="text-3xl font-bold text-dark-brown mb-3">
            {t('dialogue:generating.title')}
          </h2>
          <p className="text-xl text-gray-600">{t('dialogue:generating.description')}</p>
          {error && (
            <div className="mt-8 p-6 bg-red-50 border-l-4 border-red-500 text-red-700 text-lg font-medium">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-periwinkle p-12 shadow-sm text-center">
          <div className="w-20 h-20 bg-periwinkle rounded-full flex items-center justify-center mx-auto mb-8">
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
            {t('dialogue:complete.title')}
          </h2>
          <p className="text-xl text-gray-600 mb-6">{t('dialogue:complete.redirecting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Episode Details */}
      <div className="bg-white border-l-8 border-periwinkle p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-dark-brown mb-6">{t('dialogue:form.yourStory')}</h2>

        <div className="space-y-6">
          <div>
            <label
              htmlFor="dialogue-source-text"
              className="block text-base font-bold text-dark-brown mb-3"
            >
              {t('dialogue:form.whatToTalkAbout')} *
            </label>
            <textarea
              id="dialogue-source-text"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base h-40"
              placeholder={t('dialogue:form.storyPlaceholder')}
              data-testid="dialogue-input-source-text"
            />
            <p className="text-sm text-gray-500 mt-2">{t('dialogue:form.storyHelper')}</p>
          </div>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="dialogue-length"
                className="block text-base font-bold text-dark-brown mb-2"
              >
                {t('dialogue:form.conversationLength')}
              </label>
              <select
                id="dialogue-length"
                value={dialogueLength}
                onChange={(e) => setDialogueLength(parseInt(e.target.value, 10))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
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
                <label
                  htmlFor="dialogue-jlpt-level"
                  className="block text-base font-bold text-dark-brown mb-2"
                >
                  {t('dialogue:form.targetJLPT')}
                </label>
                <select
                  id="dialogue-jlpt-level"
                  value={jlptLevel}
                  onChange={(e) => setJlptLevel(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
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

            {targetLanguage === 'zh' && (
              <div>
                <label
                  htmlFor="dialogue-hsk-level"
                  className="block text-base font-bold text-dark-brown mb-2"
                >
                  {t('dialogue:form.targetHSK')}
                </label>
                <select
                  id="dialogue-hsk-level"
                  value={hskLevel}
                  onChange={(e) => setHskLevel(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
                  data-testid="dialogue-select-hsk-level"
                >
                  <option value="HSK1">{t('dialogue:form.hsk.hsk1')}</option>
                  <option value="HSK2">{t('dialogue:form.hsk.hsk2')}</option>
                  <option value="HSK3">{t('dialogue:form.hsk.hsk3')}</option>
                  <option value="HSK4">{t('dialogue:form.hsk.hsk4')}</option>
                  <option value="HSK5">{t('dialogue:form.hsk.hsk5')}</option>
                  <option value="HSK6">{t('dialogue:form.hsk.hsk6')}</option>
                </select>
              </div>
            )}

            {(targetLanguage === 'es' || targetLanguage === 'fr') && (
              <div>
                <label
                  htmlFor="dialogue-cefr-level"
                  className="block text-base font-bold text-dark-brown mb-2"
                >
                  {t('dialogue:form.targetCEFR')}
                </label>
                <select
                  id="dialogue-cefr-level"
                  value={cefrLevel}
                  onChange={(e) => setCefrLevel(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
                  data-testid="dialogue-select-cefr-level"
                >
                  <option value="A1">{t('dialogue:form.cefr.a1')}</option>
                  <option value="A2">{t('dialogue:form.cefr.a2')}</option>
                  <option value="B1">{t('dialogue:form.cefr.b1')}</option>
                  <option value="B2">{t('dialogue:form.cefr.b2')}</option>
                  <option value="C1">{t('dialogue:form.cefr.c1')}</option>
                  <option value="C2">{t('dialogue:form.cefr.c2')}</option>
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="dialogue-tone"
                className="block text-base font-bold text-dark-brown mb-2"
              >
                {t('dialogue:form.tone')}
              </label>
              <select
                id="dialogue-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as ToneStyle)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
                data-testid="dialogue-select-tone"
              >
                <option value="casual">{t('dialogue:form.tones.casual')}</option>
                <option value="polite">{t('dialogue:form.tones.polite')}</option>
                <option value="formal">{t('dialogue:form.tones.formal')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="bg-periwinkle-light border-l-8 border-periwinkle p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 sm:gap-8">
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-bold text-dark-brown mb-3">
              {t('dialogue:generate.ready')}
            </h3>
            <p className="text-sm sm:text-base text-gray-700 mb-4">
              {t('dialogue:generate.description', {
                language: SUPPORTED_LANGUAGES[targetLanguage].name,
                level: getProficiencyLevel() || 'beginner',
                tone,
              })}
            </p>
            <ul className="text-sm sm:text-base text-gray-700 space-y-2">
              <li className="font-medium">
                • {t('dialogue:generate.features.turns', { count: dialogueLength })}
              </li>
              <li className="font-medium">• {t('dialogue:generate.features.variations')}</li>
              <li className="font-medium">• {t('dialogue:generate.features.translations')}</li>
              <li className="font-medium">• {t('dialogue:generate.features.complexity')}</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !sourceText.trim()}
            className="w-full sm:w-auto bg-periwinkle hover:bg-periwinkle-dark text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            data-testid="dialogue-button-generate"
          >
            {loading ? t('dialogue:generate.generating') : t('dialogue:generate.button')}
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

export default DialogueGenerator;
