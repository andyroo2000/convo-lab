import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageCode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { getCourseSpeakerVoices } from '../../../../shared/src/voiceSelection';

export default function CourseGenerator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>('en');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('ja');
  const [maxDuration, setMaxDuration] = useState(30);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK1');
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
          jlptLevel: targetLanguage === 'ja' ? jlptLevel : undefined,
          hskLevel: targetLanguage === 'zh' ? hskLevel : undefined,
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
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value as LanguageCode)}
                className="input"
              >
                <option value="ja">Japanese (日本語)</option>
                <option value="zh">Mandarin Chinese (中文)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                The language you want to learn
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                Native Language
              </label>
              <select
                value={nativeLanguage}
                onChange={(e) => setNativeLanguage(e.target.value as LanguageCode)}
                className="input"
              >
                <option value="en">English</option>
                <option value="es">Spanish (Español)</option>
                <option value="fr">French (Français)</option>
                <option value="zh">Chinese (中文)</option>
                <option value="ja">Japanese (日本語)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Your first language for narration
              </p>
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

        <div className={user?.role === 'admin' ? 'grid grid-cols-2 gap-4' : ''}>
          {user?.role === 'admin' && (
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
          )}

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
              <p className="text-xs text-gray-500 mt-1">
                Vocabulary and grammar will be tailored to this level
              </p>
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
              <p className="text-xs text-gray-500 mt-1">
                Vocabulary and grammar will be tailored to this level
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <div className="card bg-purple-50 border-purple-600">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-navy mb-2">Ready to Generate?</h3>
            <p className="text-sm text-gray-600 mb-4">
              The AI will create audio-only lessons with guided narration, anticipation practice,
              and spaced repetition—perfect for hands-free learning.
            </p>
            <ul className="text-sm text-gray-600 space-y-1 mb-4">
              <li>✓ ~30 minute lessons, audio-only format</li>
              <li>✓ Guided L1 narration with L2 prompts</li>
              <li>✓ Anticipation pauses for recall practice</li>
              <li>✓ JLPT {jlptLevel} level vocabulary & grammar</li>
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
