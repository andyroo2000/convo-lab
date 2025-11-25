import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageCode, ProficiencyLevel, ToneStyle, AudioSpeed } from '../../types';
import { useEpisodes } from '../../hooks/useEpisodes';
import { useAuth } from '../../contexts/AuthContext';
import { SUPPORTED_LANGUAGES, SPEAKER_COLORS } from '../../../../shared/src/constants';
import { getRandomName } from '../../../../shared/src/nameConstants';
import { getDialogueSpeakerVoices } from '../../../../shared/src/voiceSelection';

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

export default function DialogueGenerator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createEpisode, generateDialogue, generateAllSpeedsAudio, getEpisode, pollJobStatus, loading, error } = useEpisodes();

  const [sourceText, setSourceText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('ja');
  const [nativeLanguage] = useState<LanguageCode>('en');
  const [dialogueLength, setDialogueLength] = useState(8);
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK1');
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
      name: getRandomName(targetLanguage, speaker.gender),
      voiceId: speaker.voiceId,
      proficiency: 'intermediate' as ProficiencyLevel,
      tone: 'casual' as ToneStyle,
      color: DEFAULT_SPEAKER_COLORS[index],
    }));
  });

  // Re-initialize speakers when target language changes
  useEffect(() => {
    const speakerVoices = getDialogueSpeakerVoices(targetLanguage, 2);
    setSpeakers(speakerVoices.map((speaker, index) => ({
      name: getRandomName(targetLanguage, speaker.gender),
      voiceId: speaker.voiceId,
      proficiency: 'intermediate' as ProficiencyLevel,
      tone,
      color: DEFAULT_SPEAKER_COLORS[index],
    })));
  }, [targetLanguage, tone]);

  const [step, setStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [generatedEpisodeId, setGeneratedEpisodeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // Poll job status when generating
  useEffect(() => {
    if (!jobId || step !== 'generating') return;

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
          } catch (error) {
            console.error('Failed to trigger audio generation:', error);
          }
        }

        setStep('complete');

        // Navigate to playback page
        setTimeout(() => {
          if (generatedEpisodeId) {
            navigate(`/app/playback/${generatedEpisodeId}`);
          }
        }, 2000);
      } else if (status === 'failed') {
        clearInterval(pollInterval);
        setStep('input');
        alert('Dialogue generation failed. Please try again.');
      }
    }, 5000); // Poll every 5 seconds (reduced from 2s to minimize Redis usage)

    return () => clearInterval(pollInterval);
  }, [jobId, step, generatedEpisodeId, pollJobStatus, getEpisode, generateAllSpeedsAudio, navigate]);

  const handleGenerate = async () => {
    if (!sourceText.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (speakers.length < 2) {
      alert('Please add at least 2 speakers');
      return;
    }

    try {
      setStep('generating');

      // Get the appropriate proficiency level based on target language
      const proficiencyLevel = targetLanguage === 'ja' ? jlptLevel : hskLevel;

      // Step 1: Create episode with placeholder title
      const episode = await createEpisode({
        title: 'Generating dialogue...',
        sourceText,
        targetLanguage,
        nativeLanguage,
        speakers: speakers.map(s => ({
          name: s.name,
          voiceId: s.voiceId,
          proficiency: proficiencyLevel,
          tone: s.tone,
          color: s.color,
        })),
        audioSpeed: 'medium',
      });

      setGeneratedEpisodeId(episode.id);

      // Step 2: Generate dialogue
      const { jobId } = await generateDialogue(
        episode.id,
        speakers.map(s => ({
          id: '', // Will be assigned by backend
          name: s.name,
          voiceId: s.voiceId,
          proficiency: proficiencyLevel,
          tone: s.tone,
          color: s.color,
        })),
        3, // Generate 3 variations per sentence
        dialogueLength // Number of dialogue turns
      );

      // Save job ID for polling
      setJobId(jobId);

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
          <h2 className="text-3xl font-bold text-dark-brown mb-3">Generating Your Dialogue</h2>
          <p className="text-xl text-gray-600">
            AI is creating a natural conversation based on your story...
          </p>
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
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-dark-brown mb-3">Dialogue Generated!</h2>
          <p className="text-xl text-gray-600 mb-6">
            Redirecting to playback page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Episode Details */}
      <div className="bg-white border-l-8 border-periwinkle p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-dark-brown mb-6">Your Story</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-base font-bold text-dark-brown mb-3">
              What do you want to talk about? *
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base h-40"
              placeholder="Describe an experience, conversation, or situation you want to learn about. The AI will create a natural dialogue based on your description."
              data-testid="dialogue-input-source-text"
            />
            <p className="text-sm text-gray-500 mt-2">
              Be specific about the context, setting, and what happened. This helps create more authentic dialogue.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-base font-bold text-dark-brown mb-2">
                Target Language
              </label>
              <input
                type="text"
                value={`${SUPPORTED_LANGUAGES[targetLanguage].name} (${SUPPORTED_LANGUAGES[targetLanguage].nativeName})`}
                disabled
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed text-base"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-dark-brown mb-2">
                Conversation Length
              </label>
              <select
                value={dialogueLength}
                onChange={(e) => setDialogueLength(parseInt(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
                data-testid="dialogue-select-length"
              >
                <option value="8">8 turns</option>
                <option value="15">15 turns</option>
                <option value="30">30 turns</option>
                <option value="50">50 turns</option>
              </select>
            </div>

            {targetLanguage === 'ja' && (
              <div>
                <label className="block text-base font-bold text-dark-brown mb-2">
                  Target JLPT Level
                </label>
                <select
                  value={jlptLevel}
                  onChange={(e) => setJlptLevel(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
                  data-testid="dialogue-select-jlpt-level"
                >
                  <option value="N5">N5 (Beginner)</option>
                  <option value="N4">N4 (Upper Beginner)</option>
                  <option value="N3">N3 (Intermediate)</option>
                  <option value="N2">N2 (Upper Intermediate)</option>
                  <option value="N1">N1 (Advanced)</option>
                </select>
              </div>
            )}

            {targetLanguage === 'zh' && (
              <div>
                <label className="block text-base font-bold text-dark-brown mb-2">
                  Target HSK Level
                </label>
                <select
                  value={hskLevel}
                  onChange={(e) => setHskLevel(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
                  data-testid="dialogue-select-hsk-level"
                >
                  <option value="HSK1">HSK 1 (Beginner)</option>
                  <option value="HSK2">HSK 2 (Upper Beginner)</option>
                  <option value="HSK3">HSK 3 (Intermediate)</option>
                  <option value="HSK4">HSK 4 (Upper Intermediate)</option>
                  <option value="HSK5">HSK 5 (Advanced)</option>
                  <option value="HSK6">HSK 6 (Mastery)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-base font-bold text-dark-brown mb-2">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as ToneStyle)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-periwinkle focus:outline-none text-base"
                data-testid="dialogue-select-tone"
              >
                <option value="casual">Casual</option>
                <option value="polite">Polite</option>
                <option value="formal">Formal</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="bg-periwinkle-light border-l-8 border-periwinkle p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 sm:gap-8">
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-bold text-dark-brown mb-3">Ready to Generate?</h3>
            <p className="text-sm sm:text-base text-gray-700 mb-4">
              The AI will create a natural {SUPPORTED_LANGUAGES[targetLanguage].name} conversation between 2 speakers with randomly assigned names and voices. Both speakers will use {targetLanguage === 'ja' ? jlptLevel : hskLevel} level {tone} language.
            </p>
            <ul className="text-sm sm:text-base text-gray-700 space-y-2">
              <li className="font-medium">• {dialogueLength} dialogue turn{dialogueLength !== 1 ? 's' : ''}</li>
              <li className="font-medium">• 3 variations per sentence</li>
              <li className="font-medium">• English translations</li>
              <li className="font-medium">• Level-matched language complexity</li>
            </ul>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !sourceText.trim()}
            className="w-full sm:w-auto bg-periwinkle hover:bg-periwinkle-dark text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            data-testid="dialogue-button-generate"
          >
            {loading ? 'Generating...' : 'Generate Dialogue'}
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-base font-medium">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
