import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight, Loader } from 'lucide-react';

import { API_URL } from '../config';

interface ChunkExercise {
  id: string;
  exerciseType: string;
  prompt: string;
  options: string[];
  correctOption: string;
  explanation: string;
  audioUrl?: string;
}

const ChunkPackExercisesPage = () => {
  const { packId } = useParams();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<ChunkExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchExercises();
  }, [packId]);

  const fetchExercises = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chunk-packs/${packId}`, {
        credentials: 'include',
      });
      const data = await response.json();
      setExercises(data.exercises || []);
    } catch (err) {
      console.error('Failed to load exercises:', err);
    }
  };

  const handleOptionSelect = (option: string) => {
    if (hasAnswered) return;
    setSelectedOption(option);
    setHasAnswered(true);
    setResults([...results, option === currentExercise.correctOption]);

    // Auto-play the correct answer audio after selection
    if (currentExercise.audioUrl && audioRef.current) {
      audioRef.current.src = currentExercise.audioUrl;
      audioRef.current.play().catch((err) => console.error('Audio playback failed:', err));
    }
  };

  const handleNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setHasAnswered(false);
    } else {
      setSessionComplete(true);
    }
  };

  if (exercises.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const currentExercise = exercises[currentIndex];
  const progress = ((currentIndex + 1) / exercises.length) * 100;

  if (sessionComplete) {
    const correctCount = results.filter((r) => r).length;
    const accuracy = Math.round((correctCount / results.length) * 100);

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center px-4 sm:px-6">
        <div className="card bg-white shadow-xl max-w-2xl w-full text-center">
          <div className="mb-4 sm:mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy mb-1 sm:mb-2">
              Exercises Complete!
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              You&apos;ve finished all {exercises.length} exercises
            </p>
          </div>

          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="text-5xl sm:text-6xl font-bold text-emerald-600 mb-2">{accuracy}%</div>
            <div className="text-base sm:text-lg text-gray-700">
              {correctCount} correct out of {results.length}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => navigate('/app/library')} className="flex-1 btn-outline">
              Back to Library
            </button>
            <button type="button" onClick={() => navigate('/app/create')} className="flex-1 btn-primary">
              Back to Create
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-xs sm:text-sm font-medium text-gray-700">
              Exercise {currentIndex + 1} of {exercises.length}
            </span>
            <span className="text-xs sm:text-sm text-gray-500">Step 3: Practice</span>
          </div>
          <div className="h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="card bg-white shadow-xl">
          <h2 className="text-lg sm:text-2xl font-bold text-navy mb-4 sm:mb-6">
            {currentExercise.prompt}
          </h2>

          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
            {currentExercise.options.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === currentExercise.correctOption;
              const showAsCorrect = hasAnswered && isCorrect; // Show correct answer in green
              const showAsWrong = hasAnswered && isSelected && !isCorrect; // Show selected wrong answer in red

              return (
                <button
                  type="button"
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  onClick={() => handleOptionSelect(option)}
                  disabled={hasAnswered}
                  className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all ${
                    showAsCorrect
                      ? 'border-green-500 bg-green-50'
                      : showAsWrong
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                  } ${hasAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-xl">{option}</span>
                    {showAsCorrect && (
                      <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    )}
                    {showAsWrong && <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />}
                  </div>
                </button>
              );
            })}
          </div>

          {hasAnswered && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <h3 className="text-sm sm:text-base font-semibold text-blue-900 mb-1.5 sm:mb-2">
                Explanation
              </h3>
              <p className="text-xs sm:text-sm text-blue-800">{currentExercise.explanation}</p>
            </div>
          )}

          {hasAnswered && (
            <button
              type="button"
              onClick={handleNext}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {currentIndex < exercises.length - 1 ? (
                <>
                  Next Exercise
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </>
              ) : (
                'View Results'
              )}
            </button>
          )}

          {/* Hidden audio element for auto-playing correct answer */}
          <audio ref={audioRef} />
        </div>
      </div>
    </div>
  );
};

export default ChunkPackExercisesPage;
