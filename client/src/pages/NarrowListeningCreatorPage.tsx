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
            const errorMsg = status.failedReason || 'Generation failed. Please try again.';
            console.error('Job failed:', errorMsg, status.stacktrace);
            throw new Error(errorMsg);
          }
        } catch (err) {
          clearInterval(pollInterval);
          console.error('Status check error:', err);
          setError(err instanceof Error ? err.message : 'Failed to check status');
          setIsGenerating(false);
        }
      }, 5000); // Poll every 5 seconds (reduced from 2s to minimize Redis usage)

    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate pack');
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/create')}
          disabled={isGenerating}
          className="flex items-center gap-2 text-strawberry hover:text-strawberry-dark font-bold transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Create
        </button>
      </div>

      <div className="mb-8 pb-6 border-b-4 border-strawberry">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">Narrow Listening Packs</h1>
        <p className="text-xl text-gray-600">The same story told 5 different ways for focused listening practice</p>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-strawberry p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-dark-brown mb-6">Your Story</h2>

          {/* Form */}
          <div className="space-y-6">
            {/* Topic */}
            <div>
              <label className="block text-base font-bold text-dark-brown mb-3">
                What's your story about? <span className="text-strawberry">*</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                placeholder="Example: Tanaka's weekend activities, A trip to the convenience store, Meeting a friend for coffee"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100 resize-none h-32"
                rows={3}
              />
              <p className="text-sm text-gray-500 mt-2">
                Describe the scenario or topic for your story
              </p>
            </div>

            {/* JLPT Level */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-base font-bold text-dark-brown mb-2">
                  Target JLPT Level <span className="text-strawberry">*</span>
                </label>
                <select
                  value={jlptLevel}
                  onChange={(e) => setJlptLevel(e.target.value)}
                  disabled={isGenerating}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100"
                >
                  <option value="N5">N5 (Beginner)</option>
                  <option value="N4">N4 (Upper Beginner)</option>
                  <option value="N3">N3 (Intermediate)</option>
                  <option value="N2">N2 (Upper Intermediate)</option>
                  <option value="N1">N1 (Advanced)</option>
                </select>
                <p className="text-sm text-gray-500 mt-2">
                  Vocabulary and grammar will be tailored to this level
                </p>
              </div>

              {/* Grammar Focus (Optional) */}
              <div>
                <label className="block text-base font-bold text-dark-brown mb-2">
                  Grammar Focus (Optional)
                </label>
                <input
                  type="text"
                  value={grammarFocus}
                  onChange={(e) => setGrammarFocus(e.target.value)}
                  disabled={isGenerating}
                  placeholder="e.g., past vs present tense"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Optionally specify grammar points to focus on
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-6 bg-red-50 border-l-4 border-red-500">
                <p className="text-base text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Progress Bar */}
            {isGenerating && (
              <div className="p-6 bg-strawberry-light border-l-4 border-strawberry">
                <div className="flex items-center gap-3 mb-3">
                  <Loader className="w-5 h-5 text-strawberry animate-spin" />
                  <p className="text-base font-bold text-dark-brown">{statusMessage}</p>
                </div>
                <div className="w-full bg-strawberry-light rounded-full h-3 border-2 border-strawberry">
                  <div
                    className="bg-strawberry h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-700 mt-2 font-medium">{Math.round(progress)}% complete</p>
              </div>
            )}

            {/* Info Box */}
            <div className="p-6 bg-strawberry-light border-l-4 border-strawberry">
              <p className="text-base text-dark-brown font-bold mb-3">
                What is Narrow Listening?
              </p>
              <p className="text-base text-gray-700 mb-3">
                Narrow listening is a technique where you listen to the same content with slight variations.
                This helps you notice differences in grammar, vocabulary, and usage while maintaining context.
                Your pack will include:
              </p>
              <ul className="text-base text-gray-700 ml-4 space-y-2">
                <li className="font-medium">• 5 versions of the same story with different grammar patterns</li>
                <li className="font-medium">• Slow audio (0.7x speed) for shadowing practice</li>
                <li className="font-medium">• Optional normal speed audio (1.0x) when you're ready</li>
                <li className="font-medium">• Japanese text with English translations</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={() => navigate('/app/create')}
              disabled={isGenerating}
              className="px-8 py-4 border-2 border-gray-300 rounded-lg font-bold text-base text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="flex-1 bg-strawberry hover:bg-strawberry-dark text-white font-bold text-lg px-10 py-4 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
