import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LanguageCode } from '../../types';

export default function OnboardingModal() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(user?.preferredStudyLanguage || 'ja');
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK1');
  const [cefrLevel, setCefrLevel] = useState<string>('A1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Store the language-specific level in the generic proficiencyLevel field
      const proficiencyLevel =
        targetLanguage === 'ja' ? jlptLevel :
        targetLanguage === 'zh' ? hskLevel :
        cefrLevel;

      await updateUser({
        preferredStudyLanguage: targetLanguage,
        proficiencyLevel,
        onboardingCompleted: true,
      });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      alert('Failed to save preferences. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-navy mb-2">Welcome to ConvoLab! 🎉</h1>
          <p className="text-gray-600">
            Let's personalize your learning experience
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`h-2 w-24 rounded-full ${step === 1 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
          <div className={`h-2 w-24 rounded-full ${step === 2 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
        </div>

        {/* Step 1: Language Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-navy mb-2">
                What language are you learning?
              </h2>
              <p className="text-gray-600">
                Choose your target language to get started
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTargetLanguage('ja')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  targetLanguage === 'ja'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🇯🇵</div>
                  <h3 className="text-xl font-semibold text-navy mb-1">Japanese</h3>
                  <p className="text-sm text-gray-600">日本語</p>
                </div>
              </button>

              <button
                onClick={() => setTargetLanguage('zh')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  targetLanguage === 'zh'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🇨🇳</div>
                  <h3 className="text-xl font-semibold text-navy mb-1">Chinese</h3>
                  <p className="text-sm text-gray-600">中文</p>
                </div>
              </button>

              <button
                onClick={() => setTargetLanguage('fr')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  targetLanguage === 'fr'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🇫🇷</div>
                  <h3 className="text-xl font-semibold text-navy mb-1">French</h3>
                  <p className="text-sm text-gray-600">Français</p>
                </div>
              </button>
            </div>

            <div className="flex justify-end mt-8">
              <button
                onClick={() => setStep(2)}
                className="btn-primary px-8 py-3"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Proficiency Level */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-navy mb-2">
                What's your current {
                  targetLanguage === 'ja' ? 'JLPT' :
                  targetLanguage === 'zh' ? 'HSK' :
                  'CEFR'
                } level?
              </h2>
              <p className="text-gray-600">
                This helps us create content at the right difficulty
              </p>
            </div>

            {targetLanguage === 'ja' && (
              <div className="space-y-3">
                <button
                  onClick={() => setJlptLevel('N5')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    jlptLevel === 'N5'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">N5 (Beginner)</h3>
                  <p className="text-sm text-gray-600">
                    Basic grammar and around 800 vocabulary words
                  </p>
                </button>

                <button
                  onClick={() => setJlptLevel('N4')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    jlptLevel === 'N4'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">N4 (Upper Beginner)</h3>
                  <p className="text-sm text-gray-600">
                    Can understand everyday conversations at slower speeds
                  </p>
                </button>

                <button
                  onClick={() => setJlptLevel('N3')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    jlptLevel === 'N3'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">N3 (Intermediate)</h3>
                  <p className="text-sm text-gray-600">
                    Can understand most everyday conversations
                  </p>
                </button>

                <button
                  onClick={() => setJlptLevel('N2')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    jlptLevel === 'N2'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">N2 (Upper Intermediate)</h3>
                  <p className="text-sm text-gray-600">
                    Can understand a wide range of topics at natural speed
                  </p>
                </button>

                <button
                  onClick={() => setJlptLevel('N1')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    jlptLevel === 'N1'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">N1 (Advanced)</h3>
                  <p className="text-sm text-gray-600">
                    Can understand complex topics and nuanced expressions
                  </p>
                </button>
              </div>
            )}

            {targetLanguage === 'zh' && (
              <div className="space-y-3">
                <button
                  onClick={() => setHskLevel('HSK1')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    hskLevel === 'HSK1'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">HSK 1 (Beginner)</h3>
                  <p className="text-sm text-gray-600">
                    Can understand and use very simple phrases
                  </p>
                </button>

                <button
                  onClick={() => setHskLevel('HSK2')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    hskLevel === 'HSK2'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">HSK 2 (Upper Beginner)</h3>
                  <p className="text-sm text-gray-600">
                    Can communicate in simple routine tasks
                  </p>
                </button>

                <button
                  onClick={() => setHskLevel('HSK3')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    hskLevel === 'HSK3'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">HSK 3 (Intermediate)</h3>
                  <p className="text-sm text-gray-600">
                    Can handle most everyday situations
                  </p>
                </button>

                <button
                  onClick={() => setHskLevel('HSK4')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    hskLevel === 'HSK4'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">HSK 4 (Upper Intermediate)</h3>
                  <p className="text-sm text-gray-600">
                    Can discuss a wide range of topics fluently
                  </p>
                </button>

                <button
                  onClick={() => setHskLevel('HSK5')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    hskLevel === 'HSK5'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">HSK 5 (Advanced)</h3>
                  <p className="text-sm text-gray-600">
                    Can read newspapers and understand TV programs
                  </p>
                </button>

                <button
                  onClick={() => setHskLevel('HSK6')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    hskLevel === 'HSK6'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">HSK 6 (Mastery)</h3>
                  <p className="text-sm text-gray-600">
                    Can easily comprehend and express yourself in Chinese
                  </p>
                </button>
              </div>
            )}

            {targetLanguage === 'fr' && (
              <div className="space-y-3">
                <button
                  onClick={() => setCefrLevel('A1')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    cefrLevel === 'A1'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">A1 (Beginner)</h3>
                  <p className="text-sm text-gray-600">
                    Can understand and use familiar everyday expressions
                  </p>
                </button>

                <button
                  onClick={() => setCefrLevel('A2')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    cefrLevel === 'A2'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">A2 (Elementary)</h3>
                  <p className="text-sm text-gray-600">
                    Can communicate in simple routine tasks
                  </p>
                </button>

                <button
                  onClick={() => setCefrLevel('B1')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    cefrLevel === 'B1'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">B1 (Intermediate)</h3>
                  <p className="text-sm text-gray-600">
                    Can deal with most situations while traveling
                  </p>
                </button>

                <button
                  onClick={() => setCefrLevel('B2')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    cefrLevel === 'B2'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">B2 (Upper Intermediate)</h3>
                  <p className="text-sm text-gray-600">
                    Can interact with fluency and spontaneity
                  </p>
                </button>

                <button
                  onClick={() => setCefrLevel('C1')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    cefrLevel === 'C1'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">C1 (Advanced)</h3>
                  <p className="text-sm text-gray-600">
                    Can use language flexibly and effectively
                  </p>
                </button>

                <button
                  onClick={() => setCefrLevel('C2')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    cefrLevel === 'C2'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">C2 (Mastery)</h3>
                  <p className="text-sm text-gray-600">
                    Can understand virtually everything heard or read
                  </p>
                </button>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(1)}
                className="btn-outline px-8 py-3"
                disabled={isSubmitting}
              >
                ← Back
              </button>
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Get Started'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
