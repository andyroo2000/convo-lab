import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { LanguageCode } from '../../types';

const OnboardingModal = () => {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation(['onboarding', 'common']);
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nativeLanguage: LanguageCode = 'en';
  const targetLanguage: LanguageCode = 'ja';

  const handleComplete = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await updateUser({
        preferredNativeLanguage: nativeLanguage,
        preferredStudyLanguage: targetLanguage,
        proficiencyLevel: jlptLevel,
        onboardingCompleted: true,
      });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // eslint-disable-next-line no-alert
      alert('Failed to save preferences. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-cream rounded-3xl shadow-2xl max-w-2xl w-full p-8 sm:p-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-navy mb-2">{t('onboarding:welcome')}</h1>
          <p className="text-gray-600">{t('onboarding:step3.description')}</p>
        </div>

        {/* JLPT Level Selection */}
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-navy mb-2">
              {t('onboarding:step3.title')}
            </h2>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setJlptLevel('N5')}
              className={`w-full p-5 rounded-xl border-2 transition-all text-left bg-white ${
                jlptLevel === 'N5'
                  ? 'border-coral shadow-lg ring-2 ring-coral ring-opacity-50'
                  : 'border-gray-200 hover:border-coral-light hover:shadow-md'
              }`}
            >
              <h3 className="font-semibold text-navy mb-1">N5 (Beginner)</h3>
              <p className="text-sm text-gray-600">
                Basic grammar and around 800 vocabulary words
              </p>
            </button>

            <button
              type="button"
              onClick={() => setJlptLevel('N4')}
              className={`w-full p-5 rounded-xl border-2 transition-all text-left bg-white ${
                jlptLevel === 'N4'
                  ? 'border-coral shadow-lg ring-2 ring-coral ring-opacity-50'
                  : 'border-gray-200 hover:border-coral-light hover:shadow-md'
              }`}
            >
              <h3 className="font-semibold text-navy mb-1">N4 (Upper Beginner)</h3>
              <p className="text-sm text-gray-600">
                Can understand everyday conversations at slower speeds
              </p>
            </button>

            <button
              type="button"
              onClick={() => setJlptLevel('N3')}
              className={`w-full p-5 rounded-xl border-2 transition-all text-left bg-white ${
                jlptLevel === 'N3'
                  ? 'border-coral shadow-lg ring-2 ring-coral ring-opacity-50'
                  : 'border-gray-200 hover:border-coral-light hover:shadow-md'
              }`}
            >
              <h3 className="font-semibold text-navy mb-1">N3 (Intermediate)</h3>
              <p className="text-sm text-gray-600">
                Can understand most everyday conversations
              </p>
            </button>

            <button
              type="button"
              onClick={() => setJlptLevel('N2')}
              className={`w-full p-5 rounded-xl border-2 transition-all text-left bg-white ${
                jlptLevel === 'N2'
                  ? 'border-coral shadow-lg ring-2 ring-coral ring-opacity-50'
                  : 'border-gray-200 hover:border-coral-light hover:shadow-md'
              }`}
            >
              <h3 className="font-semibold text-navy mb-1">N2 (Upper Intermediate)</h3>
              <p className="text-sm text-gray-600">
                Can understand a wide range of topics at natural speed
              </p>
            </button>

            <button
              type="button"
              onClick={() => setJlptLevel('N1')}
              className={`w-full p-5 rounded-xl border-2 transition-all text-left bg-white ${
                jlptLevel === 'N1'
                  ? 'border-coral shadow-lg ring-2 ring-coral ring-opacity-50'
                  : 'border-gray-200 hover:border-coral-light hover:shadow-md'
              }`}
            >
              <h3 className="font-semibold text-navy mb-1">N1 (Advanced)</h3>
              <p className="text-sm text-gray-600">
                Can understand complex topics and nuanced expressions
              </p>
            </button>
          </div>

          <div className="flex justify-end mt-8">
            <button
              type="button"
              onClick={handleComplete}
              disabled={isSubmitting}
              className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('common:loading') : t('onboarding:buttons.finish')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
