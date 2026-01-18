import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader } from 'lucide-react';

import { API_URL } from '../config';
import { useIsDemo } from '../hooks/useDemo';
import DemoRestrictionModal from '../components/common/DemoRestrictionModal';
import UpgradePrompt from '../components/common/UpgradePrompt';

type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2';
type ItemCount = 10 | 15;

// Grammar point types (must match backend)
type GrammarPointType =
  // N5
  | 'ha_vs_ga'
  | 'ni_vs_de'
  | 'wo_vs_ga'
  | 'e_vs_ni'
  | 'mada_vs_mou'
  // N4
  | 'kara_vs_node'
  | 'ni_vs_to'
  | 'teiru_aspect'
  | 'to_vs_tari'
  | 'ha_vs_mo'
  // N3
  | 'passive_vs_active'
  | 'garu_vs_tai'
  | 'koto_ni_naru_vs_suru'
  | 'conditional_types'
  | 'zu_ni_vs_nai_de'
  // N2
  | 'discourse_ha_vs_ga'
  | 'wake_vs_hazu_vs_chigainai'
  | 'causative_types'
  | 'you_ni_vs_tame_ni'
  | 'koto_da_vs_mono_da';

interface GrammarPointMetadata {
  id: GrammarPointType;
  name: string;
  level: JLPTLevel;
  category: 'particles' | 'aspect' | 'conditionals' | 'conjunctions' | 'voice' | 'modality';
  description: string;
}

// Grammar points metadata (matches backend GRAMMAR_POINTS)
const GRAMMAR_POINTS: Record<GrammarPointType, GrammarPointMetadata> = {
  // N5
  ha_vs_ga: {
    id: 'ha_vs_ga',
    name: 'は vs が',
    level: 'N5',
    category: 'particles',
    description: 'Topic vs subject',
  },
  ni_vs_de: {
    id: 'ni_vs_de',
    name: 'に vs で',
    level: 'N5',
    category: 'particles',
    description: 'Location types',
  },
  wo_vs_ga: {
    id: 'wo_vs_ga',
    name: 'を vs が',
    level: 'N5',
    category: 'particles',
    description: 'Trans/intrans',
  },
  e_vs_ni: {
    id: 'e_vs_ni',
    name: 'へ vs に',
    level: 'N5',
    category: 'particles',
    description: 'Direction',
  },
  mada_vs_mou: {
    id: 'mada_vs_mou',
    name: 'まだ vs もう',
    level: 'N5',
    category: 'aspect',
    description: 'Completion',
  },
  // N4
  kara_vs_node: {
    id: 'kara_vs_node',
    name: '〜から vs 〜ので',
    level: 'N4',
    category: 'conjunctions',
    description: 'Reason types',
  },
  ni_vs_to: {
    id: 'ni_vs_to',
    name: 'に vs と',
    level: 'N4',
    category: 'particles',
    description: 'Indirect object vs accompaniment',
  },
  teiru_aspect: {
    id: 'teiru_aspect',
    name: '〜ている',
    level: 'N4',
    category: 'aspect',
    description: 'State vs action',
  },
  to_vs_tari: {
    id: 'to_vs_tari',
    name: 'と vs たり',
    level: 'N4',
    category: 'conjunctions',
    description: 'List types',
  },
  ha_vs_mo: {
    id: 'ha_vs_mo',
    name: 'は vs も',
    level: 'N4',
    category: 'particles',
    description: 'Contrast vs inclusion',
  },
  // N3
  passive_vs_active: {
    id: 'passive_vs_active',
    name: 'Passive vs Active',
    level: 'N3',
    category: 'voice',
    description: 'Receiver vs agent',
  },
  garu_vs_tai: {
    id: 'garu_vs_tai',
    name: 'がる vs たい',
    level: 'N3',
    category: 'modality',
    description: 'Observed vs self desire',
  },
  koto_ni_naru_vs_suru: {
    id: 'koto_ni_naru_vs_suru',
    name: '〜ことになる vs 〜ことにする',
    level: 'N3',
    category: 'modality',
    description: 'External vs personal decision',
  },
  conditional_types: {
    id: 'conditional_types',
    name: 'と vs ば vs たら',
    level: 'N3',
    category: 'conditionals',
    description: 'Conditional nuances',
  },
  zu_ni_vs_nai_de: {
    id: 'zu_ni_vs_nai_de',
    name: 'ずに vs ないで',
    level: 'N3',
    category: 'conjunctions',
    description: 'Without doing',
  },
  // N2
  discourse_ha_vs_ga: {
    id: 'discourse_ha_vs_ga',
    name: 'は vs が (discourse)',
    level: 'N2',
    category: 'particles',
    description: 'Discourse-level contrast',
  },
  wake_vs_hazu_vs_chigainai: {
    id: 'wake_vs_hazu_vs_chigainai',
    name: '〜わけだ vs 〜はずだ vs 〜に違いない',
    level: 'N2',
    category: 'modality',
    description: 'Conclusion types',
  },
  causative_types: {
    id: 'causative_types',
    name: 'Causative vs Causative-passive',
    level: 'N2',
    category: 'voice',
    description: 'Cause vs suffer',
  },
  you_ni_vs_tame_ni: {
    id: 'you_ni_vs_tame_ni',
    name: '〜ように vs 〜ために',
    level: 'N2',
    category: 'modality',
    description: 'Purpose types',
  },
  koto_da_vs_mono_da: {
    id: 'koto_da_vs_mono_da',
    name: '〜ことだ vs 〜ものだ',
    level: 'N2',
    category: 'modality',
    description: 'Advice vs reminiscence',
  },
};

// Get grammar points for a specific level
function getGrammarPointsForLevel(level: JLPTLevel): GrammarPointType[] {
  return Object.values(GRAMMAR_POINTS)
    .filter((gp) => gp.level === level)
    .map((gp) => gp.id);
}

const PISetupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const { t } = useTranslation(['processingInstruction']);
  const isDemo = useIsDemo();
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [grammarPoint, setGrammarPoint] = useState<GrammarPointType>('ha_vs_ga');
  const [itemCount, setItemCount] = useState<ItemCount>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMetadata, setErrorMetadata] = useState<{ status?: number; quota?: unknown } | null>(
    null
  );
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // When JLPT level changes, reset to first grammar point for that level
  useEffect(() => {
    const pointsForLevel = getGrammarPointsForLevel(jlptLevel);
    if (pointsForLevel.length > 0) {
      setGrammarPoint(pointsForLevel[0]);
    }
  }, [jlptLevel]);

  const handleStartSession = async () => {
    // Block demo users from generating content
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const viewAsParam = viewAsUserId ? `?viewAs=${viewAsUserId}` : '';
      const response = await fetch(`${API_URL}/api/pi/generate-session${viewAsParam}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jlptLevel,
          itemCount,
          grammarPoint,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle quota exceeded errors
        if (response.status === 429 && errorData.metadata?.quota) {
          setErrorMetadata({ status: 429, quota: errorData.metadata.quota });
          setShowUpgradePrompt(true);
        }

        throw new Error(errorData.error || 'Failed to generate PI session');
      }

      const session = await response.json();

      // Validate session data
      if (!session || !session.items || session.items.length === 0) {
        throw new Error('Invalid session data received from server');
      }

      // Navigate to session page with the session data
      const sessionUrl = viewAsUserId
        ? `/app/pi/session?viewAs=${viewAsUserId}`
        : '/app/pi/session';
      navigate(sessionUrl, { state: { session } });
    } catch (err: unknown) {
      console.error('Error generating PI session:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to generate session. Please try again.'
      );
      setIsGenerating(false);
    }
  };

  const availableGrammarPoints = getGrammarPointsForLevel(jlptLevel);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 pb-6 border-b-4 border-keylime">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">
          {t('processingInstruction:pageTitle')}
        </h1>
        <p className="text-xl text-gray-600">{t('processingInstruction:pageSubtitle')}</p>
      </div>

      {/* Main Card */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-l-8 border-keylime p-8 shadow-sm">
          {/* Description */}
          <div className="bg-keylime-light border-l-4 border-keylime p-6 mb-8">
            <h2 className="text-xl font-bold text-dark-brown mb-3">
              {t('processingInstruction:what.title')}
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              {t('processingInstruction:what.description')}
            </p>
          </div>

          {/* Setup Options */}
          <div className="space-y-8">
            {/* JLPT Level Selection */}
            <div>
              <label
                htmlFor="jlpt-level-selection"
                className="block text-base sm:text-lg font-bold text-dark-brown mb-3 sm:mb-4"
              >
                {t('processingInstruction:setup.selectLevel')}
              </label>
              <div
                id="jlpt-level-selection"
                className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3"
                role="group"
                aria-label={t('processingInstruction:setup.selectLevel')}
              >
                {(['N5', 'N4', 'N3', 'N2'] as JLPTLevel[]).map((level) => (
                  <button
                    type="button"
                    key={level}
                    onClick={() => setJlptLevel(level)}
                    className={`px-4 sm:px-6 py-3 sm:py-4 rounded-lg border-2 font-bold transition-all ${
                      jlptLevel === level
                        ? 'border-keylime bg-keylime text-white shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-keylime hover:bg-keylime-light'
                    }`}
                  >
                    <div className="text-lg sm:text-xl font-bold">{level}</div>
                    <div className="text-xs sm:text-sm mt-1 font-medium">
                      {t(`processingInstruction:levels.${level.toLowerCase()}`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Grammar Point Selection */}
            <div>
              <label
                htmlFor="grammar-point-selection"
                className="block text-base sm:text-lg font-bold text-dark-brown mb-3 sm:mb-4"
              >
                {t('processingInstruction:setup.selectGrammar')}
              </label>
              <div
                id="grammar-point-selection"
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 max-h-64 overflow-y-auto p-2"
                role="group"
                aria-label={t('processingInstruction:setup.selectGrammar')}
              >
                {availableGrammarPoints.map((gpId) => {
                  const gp = GRAMMAR_POINTS[gpId];
                  return (
                    <button
                      type="button"
                      key={gpId}
                      onClick={() => setGrammarPoint(gpId)}
                      className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 text-left transition-all ${
                        grammarPoint === gpId
                          ? 'border-keylime bg-keylime text-white shadow-md'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-keylime hover:bg-keylime-light'
                      }`}
                    >
                      <div className="font-bold text-base sm:text-lg">{gp.name}</div>
                      <div
                        className={`text-xs sm:text-sm mt-1 ${grammarPoint === gpId ? 'text-white opacity-90' : 'text-gray-600'}`}
                      >
                        {t(`processingInstruction:grammarPoints.${gpId}`)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Item Count Selection */}
            <div>
              <label
                htmlFor="item-count-selection"
                className="block text-lg font-bold text-dark-brown mb-4"
              >
                {t('processingInstruction:setup.itemCount')}
              </label>
              <div
                id="item-count-selection"
                className="grid grid-cols-2 gap-3"
                role="group"
                aria-label={t('processingInstruction:setup.itemCount')}
              >
                {([10, 15] as ItemCount[]).map((count) => (
                  <button
                    type="button"
                    key={count}
                    onClick={() => setItemCount(count)}
                    className={`px-6 py-4 rounded-lg border-2 font-medium transition-all ${
                      itemCount === count
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm mt-1">
                      {t(`processingInstruction:setup.duration.${count}`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Start Button */}
          <div className="mt-8">
            <button
              type="button"
              onClick={handleStartSession}
              disabled={isGenerating}
              className="w-full bg-keylime hover:bg-keylime-dark text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  {t('processingInstruction:actions.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                  {t('processingInstruction:actions.start')}
                </>
              )}
            </button>
          </div>

          {/* Info Footer */}
          <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500">
            <p>{t('processingInstruction:tip')}</p>
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

export default PISetupPage;
