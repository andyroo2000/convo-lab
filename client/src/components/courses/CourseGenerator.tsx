import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageCode } from '../../types';
import { TTS_VOICES } from '../../../../shared/src/constants';

export default function CourseGenerator() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [nativeLanguage] = useState<LanguageCode>('en');
  const [targetLanguage] = useState<LanguageCode>('ja');
  const [maxDuration, setMaxDuration] = useState(30);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [speaker1VoiceId, setSpeaker1VoiceId] = useState('');
  const [speaker2VoiceId, setSpeaker2VoiceId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [generatedCourseId, setGeneratedCourseId] = useState<string | null>(null);

  // Initialize default voices
  useEffect(() => {
    // Select default narrator voice for the native language
    const defaultVoice = TTS_VOICES[nativeLanguage as keyof typeof TTS_VOICES]?.voices[0]?.id || '';
    setSelectedVoice(defaultVoice);

    // Select default dialogue voices for the target language
    const targetVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];
    const femaleVoice = targetVoices.find(v => v.gender === 'female')?.id || targetVoices[0]?.id || '';
    const maleVoice = targetVoices.find(v => v.gender === 'male')?.id || targetVoices[0]?.id || '';
    setSpeaker1VoiceId(femaleVoice);
    setSpeaker2VoiceId(maleVoice);
  }, [nativeLanguage, targetLanguage]);

  const handleCreate = async () => {
    if (!title.trim() || !sourceText.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (!selectedVoice) {
      setError('Please select a narrator voice');
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
          jlptLevel,
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

      // Navigate to library page after a short delay
      setTimeout(() => {
        navigate('/library');
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
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-navy mb-2">Audio Course Created!</h2>
          <p className="text-gray-600 mb-6">
            Your audio course is now generating. You can track its progress on the Audio Courses page.
          </p>
        </div>
      </div>
    );
  }

  const nativeVoices = TTS_VOICES[nativeLanguage as keyof typeof TTS_VOICES]?.voices || [];
  const targetVoices = TTS_VOICES[targetLanguage as keyof typeof TTS_VOICES]?.voices || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Course Details */}
      <div className="card">
        <h2 className="text-xl font-semibold text-navy mb-4">Audio Course Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-2">
              Audio Course Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="e.g., Japanese Restaurant Conversations"
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
              placeholder="Describe an experience, conversation, or situation you want to learn about in Japanese. The AI will create an interactive audio course based on your description."
            />
            <p className="text-xs text-gray-500 mt-1">
              Be specific about the context and setting. This helps create more authentic learning material.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>
        </div>
      </div>

      {/* Voice Configuration */}
      <div className="card">
        <h2 className="text-xl font-semibold text-navy mb-4">Voice Configuration</h2>

        <div className="space-y-4">
          {/* Narrator Voice */}
          <div>
            <label className="block text-sm font-medium text-navy mb-2">
              Narrator Voice ({nativeLanguage.toUpperCase()}) *
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="input"
            >
              {nativeVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.description} ({voice.gender})
                </option>
              ))}
            </select>
            {selectedVoice && (() => {
              const selectedNarratorVoice = nativeVoices.find(v => v.id === selectedVoice);
              if (selectedNarratorVoice) {
                const voiceName = selectedNarratorVoice.description.split(' - ')[0].toLowerCase();
                return (
                  <audio
                    key={selectedVoice}
                    controls
                    className="w-full mt-2 h-8"
                    style={{ maxHeight: '32px' }}
                  >
                    <source src={`/voice-samples/${voiceName}.mp3`} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                );
              }
              return null;
            })()}
            <p className="text-xs text-gray-500 mt-1">
              This voice will narrate instructions in {nativeLanguage.toUpperCase()}
            </p>
          </div>

          {/* Dialogue Voices */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Dialogue Voices ({targetLanguage.toUpperCase()})
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Speaker 1 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Speaker 1 (Friend)
                </label>
                <select
                  value={speaker1VoiceId}
                  onChange={(e) => setSpeaker1VoiceId(e.target.value)}
                  className="input"
                >
                  {targetVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                    </option>
                  ))}
                </select>
                {speaker1VoiceId && (() => {
                  const selectedVoice = targetVoices.find(v => v.id === speaker1VoiceId);
                  if (selectedVoice) {
                    const voiceName = selectedVoice.description.split(' - ')[0].toLowerCase();
                    return (
                      <audio
                        key={speaker1VoiceId}
                        controls
                        className="w-full mt-2 h-8"
                        style={{ maxHeight: '32px' }}
                      >
                        <source src={`/voice-samples/${voiceName}.mp3`} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Speaker 2 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Speaker 2 (Listener)
                </label>
                <select
                  value={speaker2VoiceId}
                  onChange={(e) => setSpeaker2VoiceId(e.target.value)}
                  className="input"
                >
                  {targetVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                    </option>
                  ))}
                </select>
                {speaker2VoiceId && (() => {
                  const selectedVoice = targetVoices.find(v => v.id === speaker2VoiceId);
                  if (selectedVoice) {
                    const voiceName = selectedVoice.description.split(' - ')[0].toLowerCase();
                    return (
                      <audio
                        key={speaker2VoiceId}
                        controls
                        className="w-full mt-2 h-8"
                        style={{ maxHeight: '32px' }}
                      >
                        <source src={`/voice-samples/${voiceName}.mp3`} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Choose any voice for each speaker - (M) = Male, (F) = Female
            </p>
          </div>
        </div>
      </div>

      {/* Course Settings */}
      <div className="card">
        <h2 className="text-xl font-semibold text-navy mb-4">Audio Course Settings</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-2">
              Max Lesson Duration
            </label>
            <select
              value={maxDuration}
              onChange={(e) => setMaxDuration(parseInt(e.target.value))}
              className="input"
            >
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Lessons longer than this will be split into multiple parts
            </p>
          </div>

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
            <p className="text-xs text-gray-500 mt-1">
              Vocabulary and grammar will be tailored to this level
            </p>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="card bg-purple-50 border-purple-600">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-navy mb-2">Ready to Generate?</h3>
            <p className="text-sm text-gray-600 mb-4">
              The AI will create a Pimsleur-style interactive audio course with spaced repetition,
              anticipation drills, and graduated difficulty.
            </p>
            <ul className="text-sm text-gray-600 space-y-1 mb-4">
              <li>✓ Guided narration in your native language</li>
              <li>✓ Anticipation prompts with pauses</li>
              <li>✓ Spaced repetition for retention</li>
              <li>✓ JLPT {jlptLevel} level content</li>
            </ul>
          </div>
          <button
            onClick={handleCreate}
            disabled={isCreating || !title.trim() || !sourceText.trim() || !selectedVoice}
            className="btn-primary ml-6 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Audio Course'}
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
