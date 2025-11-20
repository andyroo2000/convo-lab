import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Sparkles } from 'lucide-react';

export default function NarrowListeningCreatorPage() {
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [grammarFocus, setGrammarFocus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const versionCount = 5; // Fixed at 5 variations

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic or story idea');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setStatusMessage('Creating narrow listening pack...');

    try {
      // Start generation
      const response = await fetch('/api/narrow-listening/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topic: topic.trim(),
          jlptLevel,
          versionCount,
          grammarFocus: grammarFocus.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start generation');
      }

      const { jobId, packId } = await response.json();
      console.log(`Generation started: jobId=${jobId}, packId=${packId}`);

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/narrow-listening/job/${jobId}`, {
            credentials: 'include',
          });

          if (!statusRes.ok) {
            throw new Error('Failed to check generation status');
          }

          const status = await statusRes.json();

          // Update progress
          if (status.progress) {
            setProgress(status.progress);

            // Update status message based on progress
            if (status.progress < 20) {
              setStatusMessage('Generating story with AI...');
            } else if (status.progress < 90) {
              setStatusMessage('Creating audio for story variations...');
            } else {
              setStatusMessage('Finalizing your pack...');
            }
          }

          // Check if completed
          if (status.state === 'completed') {
            clearInterval(pollInterval);
            console.log('Generation complete!', status.result);
            // Navigate to playback page
            navigate(`/app/narrow-listening/${packId}`);
          } else if (status.state === 'failed') {
            clearInterval(pollInterval);
            throw new Error('Generation failed. Please try again.');
          }
        } catch (err) {
          clearInterval(pollInterval);
          console.error('Status check error:', err);
          setError(err instanceof Error ? err.message : 'Failed to check status');
          setIsGenerating(false);
        }
      }, 2000); // Poll every 2 seconds

    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate pack');
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/app/studio')}
            disabled={isGenerating}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Create
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Narrow Listening Pack</h1>
              <p className="text-sm text-gray-600 mt-1">
                Generate a short story with multiple variations for targeted practice
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6 mt-8">
            {/* Topic */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic / Story Idea <span className="text-red-500">*</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                placeholder="Example: Tanaka's weekend activities, A trip to the convenience store, Meeting a friend for coffee"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Describe the scenario or topic for your story
              </p>
            </div>

            {/* JLPT Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target JLPT Level <span className="text-red-500">*</span>
              </label>
              <select
                value={jlptLevel}
                onChange={(e) => setJlptLevel(e.target.value)}
                disabled={isGenerating}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
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

            {/* Grammar Focus (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grammar Focus (Optional)
              </label>
              <input
                type="text"
                value={grammarFocus}
                onChange={(e) => setGrammarFocus(e.target.value)}
                disabled={isGenerating}
                placeholder="Example: past vs present tense, は vs が particles, casual vs polite"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optionally specify what grammar points you want to focus on
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Progress Bar */}
            {isGenerating && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Loader className="w-4 h-4 text-purple-600 animate-spin" />
                  <p className="text-sm font-medium text-purple-900">{statusMessage}</p>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-purple-700 mt-2">{Math.round(progress)}% complete</p>
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>What is Narrow Listening?</strong>
              </p>
              <p className="text-xs text-blue-700 mt-2">
                Narrow listening is a technique where you listen to the same content with slight variations.
                This helps you notice differences in grammar, vocabulary, and usage while maintaining context.
                Your pack will include:
              </p>
              <ul className="text-xs text-blue-700 mt-2 ml-4 list-disc space-y-1">
                <li>5 versions of the same story with different grammar patterns</li>
                <li>Slow audio (0.7x speed) for shadowing practice</li>
                <li>Optional normal speed audio (1.0x) when you're ready</li>
                <li>Japanese text with English translations</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-8 pt-6 border-t">
            <button
              onClick={() => navigate('/app/studio')}
              disabled={isGenerating}
              className="btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Pack
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
