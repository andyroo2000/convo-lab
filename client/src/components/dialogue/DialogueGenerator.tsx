import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageCode, ProficiencyLevel, ToneStyle } from '../../types';
import { useEpisodes } from '../../hooks/useEpisodes';
import SpeakerConfig from './SpeakerConfig';

interface SpeakerFormData {
  name: string;
  voiceId: string;
  proficiency: ProficiencyLevel;
  tone: ToneStyle;
  color: string;
}

const DEFAULT_SPEAKER_COLORS = ['#5E6AD8', '#4EA6B1', '#FF6A6A', '#A6F2C2'];

export default function DialogueGenerator() {
  const navigate = useNavigate();
  const { createEpisode, generateDialogue, pollJobStatus, loading, error } = useEpisodes();

  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [targetLanguage] = useState<LanguageCode>('ja'); // Fixed for now
  const [nativeLanguage] = useState<LanguageCode>('en');
  const [dialogueLength, setDialogueLength] = useState(6);
  const [speakers, setSpeakers] = useState<SpeakerFormData[]>([
    {
      name: 'Speaker 1',
      voiceId: 'ja-JP-Neural2-B',
      proficiency: 'intermediate',
      tone: 'casual',
      color: DEFAULT_SPEAKER_COLORS[0],
    },
    {
      name: 'Speaker 2',
      voiceId: 'ja-JP-Neural2-C',
      proficiency: 'native',
      tone: 'polite',
      color: DEFAULT_SPEAKER_COLORS[1],
    },
  ]);

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
            navigate(`/playback/${generatedEpisodeId}`);
          }
        }, 2000);
      } else if (status === 'failed') {
        clearInterval(pollInterval);
        setStep('input');
        alert('Dialogue generation failed. Please try again.');
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, step, generatedEpisodeId, pollJobStatus, navigate]);

  const addSpeaker = () => {
    const newIndex = speakers.length;
    setSpeakers([
      ...speakers,
      {
        name: `Speaker ${newIndex + 1}`,
        voiceId: newIndex % 2 === 0 ? 'ja-JP-Neural2-B' : 'ja-JP-Neural2-C',
        proficiency: 'intermediate',
        tone: 'casual',
        color: DEFAULT_SPEAKER_COLORS[newIndex % DEFAULT_SPEAKER_COLORS.length],
      },
    ]);
  };

  const removeSpeaker = (index: number) => {
    setSpeakers(speakers.filter((_, i) => i !== index));
  };

  const updateSpeaker = (index: number, field: string, value: string) => {
    const updated = [...speakers];
    updated[index] = { ...updated[index], [field]: value };
    setSpeakers(updated);
  };

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

      // Step 1: Create episode
      const episode = await createEpisode({
        title,
        sourceText,
        targetLanguage,
        nativeLanguage,
        speakers: speakers.map(s => ({
          name: s.name,
          voiceId: s.voiceId,
          proficiency: s.proficiency,
          tone: s.tone,
          color: s.color,
        })),
      });

      setGeneratedEpisodeId(episode.id);

      // Step 2: Generate dialogue
      const { jobId } = await generateDialogue(
        episode.id,
        speakers.map(s => ({
          id: '', // Will be assigned by backend
          name: s.name,
          voiceId: s.voiceId,
          proficiency: s.proficiency,
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                Target Language
              </label>
              <input
                type="text"
                value="Japanese (日本語)"
                disabled
                className="input bg-gray-50 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                More languages coming soon!
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                Native Language
              </label>
              <input
                type="text"
                value="English"
                disabled
                className="input bg-gray-50 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                Dialogue Length
              </label>
              <input
                type="number"
                min="2"
                max="50"
                value={dialogueLength}
                onChange={(e) => setDialogueLength(Math.max(2, Math.min(50, parseInt(e.target.value) || 6)))}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">
                2-50 turns (default: 6)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Speakers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-navy">Speakers</h2>
          <button
            onClick={addSpeaker}
            className="btn-outline text-sm"
            disabled={speakers.length >= 4}
          >
            + Add Speaker
          </button>
        </div>

        <div className="space-y-4">
          {speakers.map((speaker, index) => (
            <SpeakerConfig
              key={index}
              {...speaker}
              onUpdate={(field, value) => updateSpeaker(index, field, value)}
              onRemove={() => removeSpeaker(index)}
              canRemove={speakers.length > 2}
            />
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Configure each speaker's voice, proficiency level, and speaking style. The AI will adjust
          the dialogue complexity and tone to match these settings.
        </p>
      </div>

      {/* Generate Button */}
      <div className="card bg-pale-sky border-indigo">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-navy mb-2">Ready to Generate?</h3>
            <p className="text-sm text-gray-600 mb-4">
              The AI will create a natural {targetLanguage === 'ja' ? 'Japanese' : 'multi-language'} conversation
              with {speakers.length} speakers, including variations and translations.
            </p>
            <ul className="text-sm text-gray-600 space-y-1 mb-4">
              <li>✓ {dialogueLength} dialogue turn{dialogueLength !== 1 ? 's' : ''}</li>
              <li>✓ 3 variations per sentence</li>
              <li>✓ English translations</li>
              <li>✓ Proficiency-matched language</li>
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
