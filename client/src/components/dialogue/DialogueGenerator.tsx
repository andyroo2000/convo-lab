import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageCode, ProficiencyLevel, ToneStyle, AudioSpeed } from '../../types';
import { useEpisodes } from '../../hooks/useEpisodes';
import { useAuth } from '../../contexts/AuthContext';
import SpeakerConfig from './SpeakerConfig';
import { TTS_VOICES, SUPPORTED_LANGUAGES } from '../../../../shared/src/constants';
import { getRandomName } from '../../../../shared/src/nameConstants';

interface SpeakerFormData {
  name: string;
  voiceId: string;
  proficiency: ProficiencyLevel;
  tone: ToneStyle;
  color: string;
}

const DEFAULT_SPEAKER_COLORS = ['#5E6AD8', '#4EA6B1', '#FF6A6A', '#A6F2C2'];

/**
 * Get a random voice ID for the specified gender and language
 */
function getRandomVoice(gender: 'male' | 'female', language: LanguageCode): string {
  const languageVoices = TTS_VOICES[language as keyof typeof TTS_VOICES]?.voices || [];
  const genderVoices = languageVoices.filter(v => v.gender === gender);

  if (genderVoices.length === 0) {
    return languageVoices[0]?.id || '';
  }

  return genderVoices[Math.floor(Math.random() * genderVoices.length)].id;
}

export default function DialogueGenerator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createEpisode, generateDialogue, pollJobStatus, loading, error } = useEpisodes();

  const [title, setTitle] = useState('');
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

  // Get default voices from TTS_VOICES for the target language
  const targetVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];

  // Initialize speakers based on target language
  const [speakers, setSpeakers] = useState<SpeakerFormData[]>(() => [
    {
      name: getRandomName(targetLanguage, 'female'),
      voiceId: getRandomVoice('female', targetLanguage),
      proficiency: 'intermediate',
      tone: 'casual',
      color: DEFAULT_SPEAKER_COLORS[0],
    },
    {
      name: getRandomName(targetLanguage, 'male'),
      voiceId: getRandomVoice('male', targetLanguage),
      proficiency: 'intermediate',
      tone: 'casual',
      color: DEFAULT_SPEAKER_COLORS[1],
    },
  ]);

  // Re-initialize speakers when target language changes
  useEffect(() => {
    setSpeakers([
      {
        name: getRandomName(targetLanguage, 'female'),
        voiceId: getRandomVoice('female', targetLanguage),
        proficiency: 'intermediate',
        tone,
        color: DEFAULT_SPEAKER_COLORS[0],
      },
      {
        name: getRandomName(targetLanguage, 'male'),
        voiceId: getRandomVoice('male', targetLanguage),
        proficiency: 'intermediate',
        tone,
        color: DEFAULT_SPEAKER_COLORS[1],
      },
    ]);
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
  }, [jobId, step, generatedEpisodeId, pollJobStatus, navigate]);

  const handleGenerate = async () => {
    if (!title.trim() || !sourceText.trim()) {
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

      // Step 1: Create episode
      const episode = await createEpisode({
        title,
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
        <div className="card text-center py-12">
          <div className="loading-spinner w-12 h-12 border-4 border-indigo border-t-transparent rounded-full mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-navy mb-2">Generating Your Dialogue</h2>
          <p className="text-gray-600">
            AI is creating a natural conversation based on your story...
          </p>
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
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
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-navy mb-2">Dialogue Generated!</h2>
          <p className="text-gray-600 mb-6">
            Redirecting to playback page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Episode Details */}
      <div className="card">
        <h2 className="text-xl font-semibold text-navy mb-4">Episode Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-2">
              Episode Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="e.g., Coffee Shop Conversation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-2">
              Your Story or Experience *
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="textarea h-32"
              placeholder="Describe an experience, conversation, or situation you want to learn about in Japanese. The AI will create a natural dialogue based on your description."
            />
            <p className="text-xs text-gray-500 mt-1">
              Be specific about the context, setting, and what happened. This helps create more authentic dialogue.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                Target Language
              </label>
              <input
                type="text"
                value={`${SUPPORTED_LANGUAGES[targetLanguage].name} (${SUPPORTED_LANGUAGES[targetLanguage].nativeName})`}
                disabled
                className="input bg-gray-50 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                Conversation Length
              </label>
              <select
                value={dialogueLength}
                onChange={(e) => setDialogueLength(parseInt(e.target.value))}
                className="input"
              >
                <option value="8">8 turns</option>
                <option value="15">15 turns</option>
                <option value="30">30 turns</option>
                <option value="50">50 turns</option>
              </select>
            </div>

            {targetLanguage === 'ja' && (
              <div>
                <label className="block text-sm font-medium text-navy mb-2">
                  Target JLPT Level
                </label>
                <select
                  value={jlptLevel}
                  onChange={(e) => setJlptLevel(e.target.value)}
                  className="input"
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
                <label className="block text-sm font-medium text-navy mb-2">
                  Target HSK Level
                </label>
                <select
                  value={hskLevel}
                  onChange={(e) => setHskLevel(e.target.value)}
                  className="input"
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
              <label className="block text-sm font-medium text-navy mb-2">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as ToneStyle)}
                className="input"
              >
                <option value="casual">Casual</option>
                <option value="polite">Polite</option>
                <option value="formal">Formal</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Speakers */}
      <div>
        <h2 className="text-xl font-semibold text-navy mb-4">Speakers</h2>

        <div className="space-y-4">
          {speakers.map((speaker, index) => (
            <SpeakerConfig
              key={index}
              name={speaker.name}
              targetLanguage={targetLanguage}
            />
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Speakers are assigned random names and voices. Proficiency and tone are controlled above.
        </p>
      </div>

      {/* Generate Button */}
      <div className="card bg-pale-sky border-indigo">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-navy mb-2">Ready to Generate?</h3>
            <p className="text-sm text-gray-600 mb-4">
              The AI will create a natural {SUPPORTED_LANGUAGES[targetLanguage].name} conversation between 2 speakers with randomly assigned names and voices. Both speakers will use {targetLanguage === 'ja' ? jlptLevel : hskLevel} level {tone} language.
            </p>
            <ul className="text-sm text-gray-600 space-y-1 mb-4">
              <li>✓ {dialogueLength} dialogue turn{dialogueLength !== 1 ? 's' : ''}</li>
              <li>✓ 3 variations per sentence</li>
              <li>✓ English translations</li>
              <li>✓ Level-matched language complexity</li>
            </ul>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !title.trim() || !sourceText.trim()}
            className="btn-primary ml-6 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Dialogue'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
