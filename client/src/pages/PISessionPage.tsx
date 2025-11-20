import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Volume2, CheckCircle, XCircle, ArrowRight, RotateCcw } from 'lucide-react';

import { API_URL } from '../config';

interface PIChoice {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface PIItem {
  type: 'who_did_it' | 'topic_vs_subject' | 'meaning_match';
  question: string;
  contextSentence?: string;
  japaneseSentence: string;
  audioUrl?: string;
  audioUrlA?: string;
  audioUrlB?: string;
  choices: PIChoice[];
  explanation: string;
  sentencePair?: {
    sentenceA: string;
    sentenceB: string;
  };
}

interface PISession {
  items: PIItem[];
  jlptLevel: string;
  grammarPoint: string;
}

// Grammar point display names (matches frontend setup page)
const GRAMMAR_POINT_NAMES: Record<string, string> = {
  ha_vs_ga: 'は vs が',
  ni_vs_de: 'に vs で',
  wo_vs_ga: 'を vs が',
  e_vs_ni: 'へ vs に',
  mada_vs_mou: 'まだ vs もう',
  kara_vs_node: '〜から vs 〜ので',
  ni_vs_to: 'に vs と',
  teiru_aspect: '〜ている',
  to_vs_tari: 'と vs たり',
  ha_vs_mo: 'は vs も',
  passive_vs_active: 'Passive vs Active',
  garu_vs_tai: 'がる vs たい',
  koto_ni_naru_vs_suru: '〜ことになる vs 〜ことにする',
  conditional_types: 'と vs ば vs たら',
  zu_ni_vs_nai_de: 'ずに vs ないで',
  discourse_ha_vs_ga: 'は vs が (discourse)',
  wake_vs_hazu_vs_chigainai: '〜わけだ vs 〜はずだ vs 〜に違いない',
  causative_types: 'Causative vs Causative-passive',
  you_ni_vs_tame_ni: '〜ように vs 〜ために',
  koto_da_vs_mono_da: '〜ことだ vs 〜ものだ',
};

export default function PISessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = location.state?.session as PISession | undefined;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Redirect if no session data
    if (!session) {
      navigate('/app/pi');
    }
  }, [session, navigate]);

  useEffect(() => {
    // Auto-play audio when item changes
    if (currentItem && currentItem.audioUrl) {
      setTimeout(() => {
        audioRef.current?.play().catch((error) => {
          console.log('Auto-play prevented by browser:', error);
          // Don't show alert for auto-play failures, just log it
        });
      }, 300);
    }
  }, [currentIndex]);

  if (!session) {
    return null;
  }

  const currentItem = session.items[currentIndex];
  const progress = ((currentIndex + 1) / session.items.length) * 100;

  const handleChoiceSelect = (choiceId: string) => {
    if (hasAnswered) return;

    setSelectedChoice(choiceId);
    setHasAnswered(true);

    const choice = currentItem.choices.find((c) => c.id === choiceId);
    if (choice) {
      setResults([...results, choice.isCorrect]);
    }
  };

  const handleNext = () => {
    if (currentIndex < session.items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedChoice(null);
      setHasAnswered(false);
    } else {
      setSessionComplete(true);
    }
  };

  const handlePlayAudio = (audioType: 'main' | 'A' | 'B' = 'main') => {
    let audio: HTMLAudioElement | null = null;

    if (audioType === 'A') {
      audio = audioRefA.current;
    } else if (audioType === 'B') {
      audio = audioRefB.current;
    } else {
      audio = audioRef.current;
    }

    if (audio) {
      audio.currentTime = 0;
      audio.play().catch((error) => {
        console.error('Error playing audio:', error);
        // Retry after user interaction
        alert('Audio playback failed. Please try clicking the button again.');
      });
    }
  };

  const handleRestart = () => {
    navigate('/app/pi');
  };

  // Session complete view
  if (sessionComplete) {
    const correctCount = results.filter((r) => r).length;
    const accuracy = Math.round((correctCount / results.length) * 100);

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center px-6">
        <div className="card bg-white shadow-xl max-w-2xl w-full text-center">
          <div className="mb-6">
            {accuracy >= 80 ? (
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-12 h-12 text-yellow-600" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-navy mb-2">Session Complete!</h1>
            <p className="text-gray-600">You've finished all {session.items.length} items</p>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-8 mb-8">
            <div className="text-6xl font-bold text-indigo-600 mb-2">{accuracy}%</div>
            <div className="text-lg text-gray-700">
              {correctCount} correct out of {results.length}
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {accuracy >= 90 && (
              <p className="text-green-700 font-medium">🎉 Excellent work! You're processing は and が very well!</p>
            )}
            {accuracy >= 70 && accuracy < 90 && (
              <p className="text-blue-700 font-medium">👍 Good job! Keep practicing to strengthen your particle processing.</p>
            )}
            {accuracy < 70 && (
              <p className="text-yellow-700 font-medium">💪 Keep practicing! Remember to focus on the meaning that each particle creates.</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 btn-outline"
            >
              New Session
            </button>
            <button
              onClick={() => navigate('/app/studio')}
              className="flex-1 btn-primary"
            >
              Back to Studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main session view
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Progress Bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Question {currentIndex + 1} of {session.items.length}
            </span>
            <span className="text-sm text-gray-500">
              {session.jlptLevel} • {GRAMMAR_POINT_NAMES[session.grammarPoint] || session.grammarPoint}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="card bg-white shadow-xl">
          {/* Question */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-navy mb-4">
              {currentItem.question}
            </h2>

            {/* Context Sentence (if provided) */}
            {currentItem.contextSentence && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Context:</p>
                <p className="text-base text-gray-800 font-japanese">{currentItem.contextSentence}</p>
              </div>
            )}

            {/* Audio Player */}
            {currentItem.type === 'meaning_match' && currentItem.sentencePair ? (
              // For meaning_match type, show two audio buttons
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-lg">
                  <button
                    onClick={() => handlePlayAudio('A')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                    Sentence A
                  </button>
                  <span className="text-2xl text-gray-900 font-japanese">{currentItem.sentencePair.sentenceA}</span>
                </div>
                <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg">
                  <button
                    onClick={() => handlePlayAudio('B')}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                    Sentence B
                  </button>
                  <span className="text-2xl text-gray-900 font-japanese">{currentItem.sentencePair.sentenceB}</span>
                </div>
                <audio
                  ref={audioRefA}
                  src={currentItem.audioUrlA ? `${API_URL}${currentItem.audioUrlA}` : ''}
                  preload="auto"
                  onError={(e) => console.error('Error loading audio A:', e)}
                  onLoadedData={() => console.log('Audio A loaded:', currentItem.audioUrlA)}
                />
                <audio
                  ref={audioRefB}
                  src={currentItem.audioUrlB ? `${API_URL}${currentItem.audioUrlB}` : ''}
                  preload="auto"
                  onError={(e) => console.error('Error loading audio B:', e)}
                  onLoadedData={() => console.log('Audio B loaded:', currentItem.audioUrlB)}
                />
              </div>
            ) : (
              // For other types, show single audio button
              <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-lg">
                <button
                  onClick={() => handlePlayAudio()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Volume2 className="w-5 h-5" />
                  Play Audio
                </button>
                <span className="text-2xl text-gray-900 font-japanese">
                  {currentItem.japaneseSentence}
                </span>
                <audio
                  ref={audioRef}
                  src={currentItem.audioUrl ? `${API_URL}${currentItem.audioUrl}` : ''}
                  preload="auto"
                  onError={(e) => console.error('Error loading audio:', e, currentItem.audioUrl)}
                  onLoadedData={() => console.log('Audio loaded:', currentItem.audioUrl)}
                />
              </div>
            )}
          </div>

          {/* Choices */}
          <div className="space-y-3 mb-6">
            {currentItem.choices.map((choice) => {
              const isSelected = selectedChoice === choice.id;
              const showResult = hasAnswered && isSelected;

              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoiceSelect(choice.id)}
                  disabled={hasAnswered}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    showResult && choice.isCorrect
                      ? 'border-green-500 bg-green-50'
                      : showResult && !choice.isCorrect
                      ? 'border-red-500 bg-red-50'
                      : isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${hasAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{choice.text}</span>
                    </div>
                    {showResult && (
                      <div className="ml-3 flex-shrink-0">
                        {choice.isCorrect ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation (shown after answering) */}
          {hasAnswered && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Explanation:</h3>
              <p className="text-sm text-blue-800 leading-relaxed">
                {currentItem.explanation}
              </p>
            </div>
          )}

          {/* Next Button */}
          {hasAnswered && (
            <button
              onClick={handleNext}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {currentIndex < session.items.length - 1 ? (
                <>
                  Next Question
                  <ArrowRight className="w-5 h-5" />
                </>
              ) : (
                'View Results'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
