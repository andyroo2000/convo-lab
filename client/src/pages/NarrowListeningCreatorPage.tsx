import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Sparkles } from 'lucide-react';
import { useInvalidateLibrary } from '../hooks/useLibraryData';
import { useIsDemo } from '../hooks/useDemo';
import DemoRestrictionModal from '../components/common/DemoRestrictionModal';

export default function NarrowListeningCreatorPage() {
  const navigate = useNavigate();
  const invalidateLibrary = useInvalidateLibrary();
  const isDemo = useIsDemo();

  const [topic, setTopic] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<'ja' | 'zh' | 'es' | 'fr'>('ja');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK3');
  const [cefrLevel, setCefrLevel] = useState<string>('A1');
  const [grammarFocus, setGrammarFocus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [showDemoModal, setShowDemoModal] = useState(false);

  const versionCount = 5; // Fixed at 5 variations

  const handleGenerate = async () => {
    // Block demo users from generating content
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }

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
          targetLanguage,
          jlptLevel: targetLanguage === 'ja' ? jlptLevel : undefined,
          hskLevel: targetLanguage === 'zh' ? hskLevel : undefined,
          cefrLevel: (targetLanguage === 'es' || targetLanguage === 'fr') ? cefrLevel : undefined,
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
            // Invalidate library cache so new pack shows up
            invalidateLibrary();
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
            {/* Language Selection */}
            <div>
              <label className="block text-base font-bold text-dark-brown mb-3">
                Target Language <span className="text-strawberry">*</span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTargetLanguage('ja')}
                  disabled={isGenerating}
                  className={`flex-1 px-4 py-3 rounded-lg font-bold text-base transition-all ${
                    targetLanguage === 'ja'
                      ? 'bg-strawberry text-white border-2 border-strawberry'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-strawberry'
                  } disabled:opacity-50`}
                >
                  Japanese
                </button>
                <button
                  type="button"
                  onClick={() => setTargetLanguage('zh')}
                  disabled={isGenerating}
                  className={`flex-1 px-4 py-3 rounded-lg font-bold text-base transition-all ${
                    targetLanguage === 'zh'
                      ? 'bg-strawberry text-white border-2 border-strawberry'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-strawberry'
                  } disabled:opacity-50`}
                >
                  Chinese
                </button>
                <button
                  type="button"
                  onClick={() => setTargetLanguage('es')}
                  disabled={isGenerating}
                  className={`flex-1 px-4 py-3 rounded-lg font-bold text-base transition-all ${
                    targetLanguage === 'es'
                      ? 'bg-strawberry text-white border-2 border-strawberry'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-strawberry'
                  } disabled:opacity-50`}
                >
                  Spanish
                </button>
                <button
                  type="button"
                  onClick={() => setTargetLanguage('fr')}
                  disabled={isGenerating}
                  className={`flex-1 px-4 py-3 rounded-lg font-bold text-base transition-all ${
                    targetLanguage === 'fr'
                      ? 'bg-strawberry text-white border-2 border-strawberry'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-strawberry'
                  } disabled:opacity-50`}
                >
                  French
                </button>
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="block text-base font-bold text-dark-brown mb-3">
                What's your story about? <span className="text-strawberry">*</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                placeholder={targetLanguage === 'ja'
                  ? "Example: Tanaka's weekend activities, A trip to the convenience store, Meeting a friend for coffee"
                  : targetLanguage === 'zh'
                  ? "Example: Wang Wei's weekend activities, A trip to the supermarket, Meeting a friend for tea"
                  : targetLanguage === 'es'
                  ? "Example: María's weekend activities, A trip to the market, Meeting a friend for tapas"
                  : "Example: Sophie's weekend activities, A trip to the bakery, Meeting a friend for coffee"
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100 resize-none h-32"
                rows={3}
              />
              <p className="text-sm text-gray-500 mt-2">
                Describe the scenario or topic for your story
              </p>
            </div>

            {/* Proficiency Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-base font-bold text-dark-brown mb-2">
                  Target {
                    targetLanguage === 'ja' ? 'JLPT' :
                    targetLanguage === 'zh' ? 'HSK' :
                    'CEFR'
                  } Level <span className="text-strawberry">*</span>
                </label>
                {targetLanguage === 'ja' ? (
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
                ) : targetLanguage === 'zh' ? (
                  <select
                    value={hskLevel}
                    onChange={(e) => setHskLevel(e.target.value)}
                    disabled={isGenerating}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100"
                  >
                    <option value="HSK1">HSK1 (Beginner)</option>
                    <option value="HSK2">HSK2 (Elementary)</option>
                    <option value="HSK3">HSK3 (Intermediate)</option>
                    <option value="HSK4">HSK4 (Upper Intermediate)</option>
                    <option value="HSK5">HSK5 (Advanced)</option>
                    <option value="HSK6">HSK6 (Proficient)</option>
                  </select>
                ) : (
                  <select
                    value={cefrLevel}
                    onChange={(e) => setCefrLevel(e.target.value)}
                    disabled={isGenerating}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100"
                  >
                    <option value="A1">A1 (Beginner)</option>
                    <option value="A2">A2 (Elementary)</option>
                    <option value="B1">B1 (Intermediate)</option>
                    <option value="B2">B2 (Upper Intermediate)</option>
                    <option value="C1">C1 (Advanced)</option>
                    <option value="C2">C2 (Mastery)</option>
                  </select>
                )}
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
                <li className="font-medium">• {
                  targetLanguage === 'ja' ? 'Japanese text with furigana' :
                  targetLanguage === 'zh' ? 'Chinese text with pinyin' :
                  targetLanguage === 'es' ? 'Spanish text' :
                  'French text'
                } and English translations</li>
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
              className="flex-1 bg-strawberry hover:bg-strawberry-dark text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-4 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-6 h-6 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  Generate Pack
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Demo Restriction Modal */}
      <DemoRestrictionModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
      />
    </div>
  );
}
