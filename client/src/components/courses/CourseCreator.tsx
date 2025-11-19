import { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { Episode, CreateCourseRequest } from '../../types';
import { TTS_VOICES } from '../../../../shared/src/constants';

interface CourseCreatorProps {
  isOpen: boolean;
  episode: Episode;
  onClose: () => void;
  onCourseCreated: (courseId: string) => void;
}

export default function CourseCreator({
  isOpen,
  episode,
  onClose,
  onCourseCreated,
}: CourseCreatorProps) {
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

      // Select default narrator voice for the native language
      const defaultVoice = TTS_VOICES[episode.nativeLanguage as keyof typeof TTS_VOICES]?.voices[0]?.id || '';
      setSelectedVoice(defaultVoice);

      // Select default dialogue voices for the target language (female for speaker 1, male for speaker 2)
      const targetVoices = TTS_VOICES[episode.targetLanguage as keyof typeof TTS_VOICES]?.voices || [];
      const femaleVoice = targetVoices.find(v => v.gender === 'female')?.id || targetVoices[0]?.id || '';
      const maleVoice = targetVoices.find(v => v.gender === 'male')?.id || targetVoices[0]?.id || '';
      setSpeaker1VoiceId(femaleVoice);
      setSpeaker2VoiceId(maleVoice);

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
      setError('Please enter a course title');
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
          episodeIds: [episode.id],
          nativeLanguage: episode.nativeLanguage,
          targetLanguage: episode.targetLanguage,
          maxLessonDurationMinutes: maxDuration,
          l1VoiceId: selectedVoice,
          jlptLevel,
          speaker1Gender: 'female', // Hardcoded: Speaker 1 is always female
          speaker2Gender: 'male',   // Hardcoded: Speaker 2 is always male
          speaker1VoiceId,
          speaker2VoiceId,
        } as CreateCourseRequest),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.message || 'Failed to create course');
      }

      const course = await createResponse.json();

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
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-navy">Create Audio Course</h2>
            <p className="text-sm text-gray-600 mt-1">
              Pimsleur-style interactive lesson from "{episode.title}"
            </p>
          </div>
          <button
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio Course Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCreating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
              placeholder="e.g., Restaurant Conversation - Audio Course"
            />
            <p className="text-xs text-gray-500 mt-1">
              A description will be automatically generated using AI
            </p>
          </div>

          {/* Narrator Voice Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Narrator Voice ({episode.nativeLanguage.toUpperCase()})
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              disabled={isCreating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
            >
              {availableVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.description} ({voice.gender})
                </option>
              ))}
            </select>
            {/* Voice Sample Player */}
            {selectedVoice && (() => {
              const selectedNarratorVoice = availableVoices.find(v => v.id === selectedVoice);
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
              This voice will narrate instructions in {episode.nativeLanguage.toUpperCase()}
            </p>
          </div>

          {/* Dialogue Voice Selection */}
          <div className="border-t pt-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Dialogue Voices ({episode.targetLanguage.toUpperCase()})
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Speaker 1 Voice */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Speaker 1 (Friend)
                </label>
                <select
                  value={speaker1VoiceId}
                  onChange={(e) => setSpeaker1VoiceId(e.target.value)}
                  disabled={isCreating}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
                >
                  {(TTS_VOICES[episode.targetLanguage as keyof typeof TTS_VOICES]?.voices || [])
                    .map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                      </option>
                    ))}
                </select>
                {/* Voice Sample Player */}
                {speaker1VoiceId && (() => {
                  const selectedVoice = (TTS_VOICES[episode.targetLanguage as keyof typeof TTS_VOICES]?.voices || [])
                    .find(v => v.id === speaker1VoiceId);
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

              {/* Speaker 2 Voice */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Speaker 2 (Listener)
                </label>
                <select
                  value={speaker2VoiceId}
                  onChange={(e) => setSpeaker2VoiceId(e.target.value)}
                  disabled={isCreating}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
                >
                  {(TTS_VOICES[episode.targetLanguage as keyof typeof TTS_VOICES]?.voices || [])
                    .map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                      </option>
                    ))}
                </select>
                {/* Voice Sample Player */}
                {speaker2VoiceId && (() => {
                  const selectedVoice = (TTS_VOICES[episode.targetLanguage as keyof typeof TTS_VOICES]?.voices || [])
                    .find(v => v.id === speaker2VoiceId);
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

          {/* Max Lesson Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Lesson Duration
            </label>
            <select
              value={maxDuration}
              onChange={(e) => setMaxDuration(parseInt(e.target.value))}
              disabled={isCreating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
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

          {/* JLPT Level Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target JLPT Level
            </label>
            <select
              value={jlptLevel}
              onChange={(e) => setJlptLevel(e.target.value)}
              disabled={isCreating}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy focus:border-navy disabled:bg-gray-100"
            >
              <option value="N5">N5 (Beginner)</option>
              <option value="N4">N4 (Upper Beginner)</option>
              <option value="N3">N3 (Intermediate)</option>
              <option value="N2">N2 (Upper Intermediate)</option>
              <option value="N1">N1 (Advanced)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Vocabulary and grammar will be tailored to students at this level
            </p>
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
              <strong>What is a Pimsleur-style course?</strong> An audio-only lesson using:
            </p>
            <ul className="text-xs text-blue-700 mt-2 ml-4 list-disc space-y-1">
              <li>Anticipation: Prompts with pauses for you to respond</li>
              <li>Spaced Repetition: Items reviewed at increasing intervals</li>
              <li>Graduated Difficulty: Builds from simple to complex phrases</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-lg flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="btn-outline flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !title.trim() || !selectedVoice}
            className="flex-1 px-4 py-2 bg-navy text-white rounded-lg font-medium hover:bg-navy/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create & Generate Audio Course'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
