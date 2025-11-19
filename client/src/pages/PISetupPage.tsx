import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2';
type ItemCount = 10 | 15;

// Grammar point types (must match backend)
type GrammarPointType =
  // N5
  | 'ha_vs_ga' | 'ni_vs_de' | 'wo_vs_ga' | 'e_vs_ni' | 'mada_vs_mou'
  // N4
  | 'kara_vs_node' | 'ni_vs_to' | 'teiru_aspect' | 'to_vs_tari' | 'ha_vs_mo'
  // N3
  | 'passive_vs_active' | 'garu_vs_tai' | 'koto_ni_naru_vs_suru' | 'conditional_types' | 'zu_ni_vs_nai_de'
  // N2
  | 'discourse_ha_vs_ga' | 'wake_vs_hazu_vs_chigainai' | 'causative_types' | 'you_ni_vs_tame_ni' | 'koto_da_vs_mono_da';

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
  ha_vs_ga: { id: 'ha_vs_ga', name: 'は vs が', level: 'N5', category: 'particles', description: 'Topic vs subject' },
  ni_vs_de: { id: 'ni_vs_de', name: 'に vs で', level: 'N5', category: 'particles', description: 'Location types' },
  wo_vs_ga: { id: 'wo_vs_ga', name: 'を vs が', level: 'N5', category: 'particles', description: 'Trans/intrans' },
  e_vs_ni: { id: 'e_vs_ni', name: 'へ vs に', level: 'N5', category: 'particles', description: 'Direction' },
  mada_vs_mou: { id: 'mada_vs_mou', name: 'まだ vs もう', level: 'N5', category: 'aspect', description: 'Completion' },
  // N4
  kara_vs_node: { id: 'kara_vs_node', name: '〜から vs 〜ので', level: 'N4', category: 'conjunctions', description: 'Reason types' },
  ni_vs_to: { id: 'ni_vs_to', name: 'に vs と', level: 'N4', category: 'particles', description: 'Indirect object vs accompaniment' },
  teiru_aspect: { id: 'teiru_aspect', name: '〜ている', level: 'N4', category: 'aspect', description: 'State vs action' },
  to_vs_tari: { id: 'to_vs_tari', name: 'と vs たり', level: 'N4', category: 'conjunctions', description: 'List types' },
  ha_vs_mo: { id: 'ha_vs_mo', name: 'は vs も', level: 'N4', category: 'particles', description: 'Contrast vs inclusion' },
  // N3
  passive_vs_active: { id: 'passive_vs_active', name: 'Passive vs Active', level: 'N3', category: 'voice', description: 'Receiver vs agent' },
  garu_vs_tai: { id: 'garu_vs_tai', name: 'がる vs たい', level: 'N3', category: 'modality', description: 'Observed vs self desire' },
  koto_ni_naru_vs_suru: { id: 'koto_ni_naru_vs_suru', name: '〜ことになる vs 〜ことにする', level: 'N3', category: 'modality', description: 'External vs personal decision' },
  conditional_types: { id: 'conditional_types', name: 'と vs ば vs たら', level: 'N3', category: 'conditionals', description: 'Conditional nuances' },
  zu_ni_vs_nai_de: { id: 'zu_ni_vs_nai_de', name: 'ずに vs ないで', level: 'N3', category: 'conjunctions', description: 'Without doing' },
  // N2
  discourse_ha_vs_ga: { id: 'discourse_ha_vs_ga', name: 'は vs が (discourse)', level: 'N2', category: 'particles', description: 'Discourse-level contrast' },
  wake_vs_hazu_vs_chigainai: { id: 'wake_vs_hazu_vs_chigainai', name: '〜わけだ vs 〜はずだ vs 〜に違いない', level: 'N2', category: 'modality', description: 'Conclusion types' },
  causative_types: { id: 'causative_types', name: 'Causative vs Causative-passive', level: 'N2', category: 'voice', description: 'Cause vs suffer' },
  you_ni_vs_tame_ni: { id: 'you_ni_vs_tame_ni', name: '〜ように vs 〜ために', level: 'N2', category: 'modality', description: 'Purpose types' },
  koto_da_vs_mono_da: { id: 'koto_da_vs_mono_da', name: '〜ことだ vs 〜ものだ', level: 'N2', category: 'modality', description: 'Advice vs reminiscence' },
};

// Get grammar points for a specific level
function getGrammarPointsForLevel(level: JLPTLevel): GrammarPointType[] {
  return Object.values(GRAMMAR_POINTS)
    .filter(gp => gp.level === level)
    .map(gp => gp.id);
}

export default function PISetupPage() {
  const navigate = useNavigate();
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>('N5');
  const [grammarPoint, setGrammarPoint] = useState<GrammarPointType>('ha_vs_ga');
  const [itemCount, setItemCount] = useState<ItemCount>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When JLPT level changes, reset to first grammar point for that level
  useEffect(() => {
    const pointsForLevel = getGrammarPointsForLevel(jlptLevel);
    if (pointsForLevel.length > 0) {
      setGrammarPoint(pointsForLevel[0]);
    }
  }, [jlptLevel]);

  const handleStartSession = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/pi/generate-session`, {
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
        throw new Error(errorData.error || 'Failed to generate PI session');
      }

      const session = await response.json();

      // Validate session data
      if (!session || !session.items || session.items.length === 0) {
        throw new Error('Invalid session data received from server');
      }

      // Navigate to session page with the session data
      navigate('/pi/session', { state: { session } });
    } catch (err: any) {
      console.error('Error generating PI session:', err);
      setError(err.message || 'Failed to generate session. Please try again.');
      setIsGenerating(false);
    }
  };

  const availableGrammarPoints = getGrammarPointsForLevel(jlptLevel);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <button
          onClick={() => navigate('/studio')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Studio
        </button>

        {/* Main Card */}
        <div className="card bg-white shadow-xl">
          {/* Title Section */}
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-navy">Processing Instruction</h1>
              <p className="text-gray-600 mt-1">Grammar-focused comprehension training</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-8">
            <h2 className="font-semibold text-indigo-900 mb-2">What is this?</h2>
            <p className="text-sm text-indigo-800 leading-relaxed">
              Processing Instruction (PI) helps you understand Japanese grammar through <strong>meaning-based tasks</strong>.
              You'll hear Japanese sentences and answer questions about <em>what they mean</em> - not which grammar form was used.
              This trains your brain to process grammar correctly in real-time comprehension.
            </p>
          </div>

          {/* Setup Options */}
          <div className="space-y-6">
            {/* JLPT Level Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Select Your Level
              </label>
              <div className="grid grid-cols-4 gap-3">
                {(['N5', 'N4', 'N3', 'N2'] as JLPTLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setJlptLevel(level)}
                    className={`px-6 py-4 rounded-lg border-2 font-medium transition-all ${
                      jlptLevel === level
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xl font-bold">{level}</div>
                    <div className="text-xs mt-1">
                      {level === 'N5' && 'Beginner'}
                      {level === 'N4' && 'Elementary'}
                      {level === 'N3' && 'Intermediate'}
                      {level === 'N2' && 'Advanced'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Grammar Point Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Select Grammar Point
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2">
                {availableGrammarPoints.map((gpId) => {
                  const gp = GRAMMAR_POINTS[gpId];
                  return (
                    <button
                      key={gpId}
                      onClick={() => setGrammarPoint(gpId)}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                        grammarPoint === gpId
                          ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold text-sm">{gp.name}</div>
                      <div className="text-xs mt-1 text-gray-600">{gp.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Item Count Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Number of Items
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([10, 15] as ItemCount[]).map((count) => (
                  <button
                    key={count}
                    onClick={() => setItemCount(count)}
                    className={`px-6 py-4 rounded-lg border-2 font-medium transition-all ${
                      itemCount === count
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs mt-1">
                      {count === 10 ? '~5-7 minutes' : '~8-10 minutes'}
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
          <div className="mt-8 pt-6 border-t">
            <button
              onClick={handleStartSession}
              disabled={isGenerating}
              className="w-full btn-primary text-lg py-4 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Generating Session...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Start Practice Session
                </>
              )}
            </button>
          </div>

          {/* Info Footer */}
          <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500">
            <p>
              💡 Tip: Find a quiet space and use headphones for the best experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
