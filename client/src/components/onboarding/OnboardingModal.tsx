import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LanguageCode, ProficiencyLevel } from '../../types';

export default function OnboardingModal() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(user?.preferredStudyLanguage || 'ja');
  const [proficiencyLevel, setProficiencyLevel] = useState<ProficiencyLevel>(user?.proficiencyLevel || 'beginner');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
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
                What's your current level?
              </h2>
              <p className="text-gray-600">
                This helps us create content at the right difficulty
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setProficiencyLevel('beginner')}
                className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                  proficiencyLevel === 'beginner'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <h3 className="font-semibold text-navy mb-1">Beginner</h3>
                <p className="text-sm text-gray-600">
                  Just starting out or know basic phrases
                </p>
              </button>

              <button
                onClick={() => setProficiencyLevel('intermediate')}
                className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                  proficiencyLevel === 'intermediate'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <h3 className="font-semibold text-navy mb-1">Intermediate</h3>
                <p className="text-sm text-gray-600">
                  Can have basic conversations and understand common phrases
                </p>
              </button>

              <button
                onClick={() => setProficiencyLevel('advanced')}
                className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                  proficiencyLevel === 'advanced'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <h3 className="font-semibold text-navy mb-1">Advanced</h3>
                <p className="text-sm text-gray-600">
                  Fluent in most situations, looking to refine skills
                </p>
              </button>

              <button
                onClick={() => setProficiencyLevel('native')}
                className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                  proficiencyLevel === 'native'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <h3 className="font-semibold text-navy mb-1">Native / Near-Native</h3>
                <p className="text-sm text-gray-600">
                  Native speaker or completely fluent
                </p>
              </button>
            </div>

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
