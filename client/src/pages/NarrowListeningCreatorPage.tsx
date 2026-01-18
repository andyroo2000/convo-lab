import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader, Sparkles } from 'lucide-react';
import { useInvalidateLibrary } from '../hooks/useLibraryData';
import { useIsDemo } from '../hooks/useDemo';
import { useAuth } from '../contexts/AuthContext';
import DemoRestrictionModal from '../components/common/DemoRestrictionModal';
import UpgradePrompt from '../components/common/UpgradePrompt';

const NarrowListeningCreatorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const { t } = useTranslation(['narrowListening']);
  const invalidateLibrary = useInvalidateLibrary();
  const isDemo = useIsDemo();
  const { user } = useAuth();

  const [topic, setTopic] = useState('');
  const targetLanguage = (user?.preferredStudyLanguage || 'ja') as 'ja' | 'zh' | 'es' | 'fr';
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK3');
  const [cefrLevel, setCefrLevel] = useState<string>('A1');
  const [grammarFocus, setGrammarFocus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMetadata, setErrorMetadata] = useState<{ status?: number; quota?: unknown } | null>(
    null
  );
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const versionCount = 5; // Fixed at 5 variations

  const handleGenerate = async () => {
    // Block demo users from generating content
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }

    if (!topic.trim()) {
      setError(t('narrowListening:alerts.enterTopic'));
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setStatusMessage(t('narrowListening:progress.creating'));

    try {
      // Start generation
      const viewAsParam = viewAsUserId ? `?viewAs=${viewAsUserId}` : '';
      const response = await fetch(`/api/narrow-listening/generate${viewAsParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topic: topic.trim(),
          targetLanguage,
          jlptLevel: targetLanguage === 'ja' ? jlptLevel : undefined,
          hskLevel: targetLanguage === 'zh' ? hskLevel : undefined,
          cefrLevel: targetLanguage === 'es' || targetLanguage === 'fr' ? cefrLevel : undefined,
          versionCount,
          grammarFocus: grammarFocus.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle quota exceeded errors
        if (response.status === 429 && errorData.metadata?.quota) {
          setErrorMetadata({ status: 429, quota: errorData.metadata.quota });
          setShowUpgradePrompt(true);
        }

        throw new Error(errorData.message || 'Failed to start generation');
      }

      const { jobId, packId } = await response.json();

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/narrow-listening/job/${jobId}${viewAsParam}`, {
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
              setStatusMessage(t('narrowListening:progress.generatingStory'));
            } else if (status.progress < 90) {
              setStatusMessage(t('narrowListening:progress.creatingAudio'));
            } else {
              setStatusMessage(t('narrowListening:progress.finalizing'));
            }
          }

          // Check if completed
          if (status.state === 'completed') {
            clearInterval(pollInterval);
            // Invalidate library cache so new pack shows up
            invalidateLibrary();
            // Navigate to playback page
            const packUrl = viewAsUserId
              ? `/app/narrow-listening/${packId}?viewAs=${viewAsUserId}`
              : `/app/narrow-listening/${packId}`;
            navigate(packUrl);
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
        <h1 className="text-5xl font-bold text-dark-brown mb-3">
          {t('narrowListening:pageTitle')}
        </h1>
        <p className="text-xl text-gray-600">{t('narrowListening:pageSubtitle')}</p>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-strawberry p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-dark-brown mb-6">
            {t('narrowListening:form.yourStory')}
          </h2>

          {/* Form */}
          <div className="space-y-6">
            {/* Topic */}
            <div>
              <label
                htmlFor="narrow-listening-topic"
                className="block text-base font-bold text-dark-brown mb-3"
              >
                {t('narrowListening:form.whatAbout')} <span className="text-strawberry">*</span>
              </label>
              <textarea
                id="narrow-listening-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                placeholder={t(`narrowListening:form.topicPlaceholder.${targetLanguage}`)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100 resize-none h-32"
                rows={3}
              />
              <p className="text-sm text-gray-500 mt-2">{t('narrowListening:form.topicHelper')}</p>
            </div>

            {/* Proficiency Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="narrow-listening-level"
                  className="block text-base font-bold text-dark-brown mb-2"
                >
                  {(() => {
                    if (targetLanguage === 'ja') return t('narrowListening:form.targetJLPT');
                    if (targetLanguage === 'zh') return t('narrowListening:form.targetHSK');
                    return t('narrowListening:form.targetCEFR');
                  })()}{' '}
                  <span className="text-strawberry">*</span>
                </label>
                {(() => {
                  if (targetLanguage === 'ja') {
                    return (
                      <select
                        id="narrow-listening-level"
                        value={jlptLevel}
                        onChange={(e) => setJlptLevel(e.target.value)}
                        disabled={isGenerating}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100"
                      >
                        <option value="N5">{t('narrowListening:form.jlpt.n5')}</option>
                        <option value="N4">{t('narrowListening:form.jlpt.n4')}</option>
                        <option value="N3">{t('narrowListening:form.jlpt.n3')}</option>
                        <option value="N2">{t('narrowListening:form.jlpt.n2')}</option>
                        <option value="N1">{t('narrowListening:form.jlpt.n1')}</option>
                      </select>
                    );
                  }
                  if (targetLanguage === 'zh') {
                    return (
                      <select
                        id="narrow-listening-level"
                        value={hskLevel}
                        onChange={(e) => setHskLevel(e.target.value)}
                        disabled={isGenerating}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100"
                      >
                        <option value="HSK1">{t('narrowListening:form.hsk.hsk1')}</option>
                        <option value="HSK2">{t('narrowListening:form.hsk.hsk2')}</option>
                        <option value="HSK3">{t('narrowListening:form.hsk.hsk3')}</option>
                        <option value="HSK4">{t('narrowListening:form.hsk.hsk4')}</option>
                        <option value="HSK5">{t('narrowListening:form.hsk.hsk5')}</option>
                        <option value="HSK6">{t('narrowListening:form.hsk.hsk6')}</option>
                      </select>
                    );
                  }
                  return (
                    <select
                      id="narrow-listening-level"
                      value={cefrLevel}
                      onChange={(e) => setCefrLevel(e.target.value)}
                      disabled={isGenerating}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100"
                    >
                      <option value="A1">{t('narrowListening:form.cefr.a1')}</option>
                      <option value="A2">{t('narrowListening:form.cefr.a2')}</option>
                      <option value="B1">{t('narrowListening:form.cefr.b1')}</option>
                      <option value="B2">{t('narrowListening:form.cefr.b2')}</option>
                      <option value="C1">{t('narrowListening:form.cefr.c1')}</option>
                      <option value="C2">{t('narrowListening:form.cefr.c2')}</option>
                    </select>
                  );
                })()}
                <p className="text-sm text-gray-500 mt-2">
                  {t('narrowListening:form.levelHelper')}
                </p>
              </div>

              {/* Grammar Focus (Optional) */}
              <div>
                <label
                  htmlFor="narrow-listening-grammar"
                  className="block text-base font-bold text-dark-brown mb-2"
                >
                  {t('narrowListening:form.grammarFocus')}
                </label>
                <input
                  id="narrow-listening-grammar"
                  type="text"
                  value={grammarFocus}
                  onChange={(e) => setGrammarFocus(e.target.value)}
                  disabled={isGenerating}
                  placeholder={t('narrowListening:form.grammarPlaceholder')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-strawberry focus:outline-none text-base disabled:bg-gray-100"
                />
                <p className="text-sm text-gray-500 mt-2">
                  {t('narrowListening:form.grammarHelper')}
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
                <p className="text-sm text-gray-700 mt-2 font-medium">
                  {t('narrowListening:progress.complete', { progress: Math.round(progress) })}
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="p-6 bg-strawberry-light border-l-4 border-strawberry">
              <p className="text-base text-dark-brown font-bold mb-3">
                {t('narrowListening:info.title')}
              </p>
              <p className="text-base text-gray-700 mb-3">
                {t('narrowListening:info.description')}
              </p>
              <ul className="text-base text-gray-700 ml-4 space-y-2">
                <li className="font-medium">• {t('narrowListening:info.features.versions')}</li>
                <li className="font-medium">• {t('narrowListening:info.features.slowAudio')}</li>
                <li className="font-medium">• {t('narrowListening:info.features.normalAudio')}</li>
                <li className="font-medium">
                  •{' '}
                  {(() => {
                    if (targetLanguage === 'ja') return t('narrowListening:info.features.textJa');
                    if (targetLanguage === 'zh') return t('narrowListening:info.features.textZh');
                    if (targetLanguage === 'es') return t('narrowListening:info.features.textEs');
                    return t('narrowListening:info.features.textFr');
                  })()}
                </li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-8">
            <button
              type="button"
              onClick={() => navigate('/app/create')}
              disabled={isGenerating}
              className="px-8 py-4 border-2 border-gray-300 rounded-lg font-bold text-base text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              {t('narrowListening:actions.cancel')}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="flex-1 bg-strawberry hover:bg-strawberry-dark text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-4 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-6 h-6 animate-spin" />
                  {t('narrowListening:actions.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  {t('narrowListening:actions.generate')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Demo Restriction Modal */}
      <DemoRestrictionModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)} />

      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt && errorMetadata?.quota && (
        <UpgradePrompt
          onClose={() => setShowUpgradePrompt(false)}
          quotaUsed={errorMetadata.quota.used}
          quotaLimit={errorMetadata.quota.limit}
        />
      )}
    </div>
  );
};

export default NarrowListeningCreatorPage;
