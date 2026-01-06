import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { LanguageCode } from '../../types';

const OnboardingModal = () => {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation(['onboarding', 'common']);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>(
    user?.preferredNativeLanguage || 'en'
  );
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(
    user?.preferredStudyLanguage || 'ja'
  );
  const [jlptLevel, setJlptLevel] = useState<string>('N5');
  const [hskLevel, setHskLevel] = useState<string>('HSK1');
  const [cefrLevel, setCefrLevel] = useState<string>('A1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset target language if it matches native language
  useEffect(() => {
    if (targetLanguage === nativeLanguage) {
      const availableTargets: LanguageCode[] = ['en', 'ja', 'zh', 'es', 'fr', 'ar'];
      const firstAvailable = availableTargets.find((lang) => lang !== nativeLanguage);
      if (firstAvailable) {
        setTargetLanguage(firstAvailable);
      }
    }
  }, [nativeLanguage, targetLanguage]);

  const handleComplete = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Store the language-specific level in the generic proficiencyLevel field
      let proficiencyLevel: string;
      if (targetLanguage === 'ja') {
        proficiencyLevel = jlptLevel;
      } else if (targetLanguage === 'zh') {
        proficiencyLevel = hskLevel;
      } else {
        proficiencyLevel = cefrLevel;
      }

      await updateUser({
        preferredNativeLanguage: nativeLanguage,
        preferredStudyLanguage: targetLanguage,
        proficiencyLevel,
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-navy mb-2">{t('onboarding:welcome')}</h1>
          <p className="text-gray-600">{t('onboarding:subtitle')}</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div
            className={`h-2 w-24 rounded-full ${step === 1 ? 'bg-indigo-600' : 'bg-gray-300'}`}
          />
          <div
            className={`h-2 w-24 rounded-full ${step === 2 ? 'bg-indigo-600' : 'bg-gray-300'}`}
          />
          <div
            className={`h-2 w-24 rounded-full ${step === 3 ? 'bg-indigo-600' : 'bg-gray-300'}`}
          />
        </div>

        {/* Step 1: Native Language Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-navy mb-2">
                {t('onboarding:step1.title')}
              </h2>
              <p className="text-gray-600">{t('onboarding:step1.description')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setNativeLanguage('en')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  nativeLanguage === 'en'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-navy mb-1">English</h3>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setNativeLanguage('ja')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  nativeLanguage === 'ja'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-navy mb-1">Japanese</h3>
                  <p className="text-sm text-gray-600">日本語</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setNativeLanguage('zh')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  nativeLanguage === 'zh'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-navy mb-1">Chinese</h3>
                  <p className="text-sm text-gray-600">中文</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setNativeLanguage('es')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  nativeLanguage === 'es'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-navy mb-1">Spanish</h3>
                  <p className="text-sm text-gray-600">Español</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setNativeLanguage('fr')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  nativeLanguage === 'fr'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-navy mb-1">French</h3>
                  <p className="text-sm text-gray-600">Français</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setNativeLanguage('ar')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  nativeLanguage === 'ar'
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-navy mb-1">Arabic</h3>
                  <p className="text-sm text-gray-600">العربية</p>
                </div>
              </button>
            </div>

            <div className="flex justify-end mt-8">
              <button type="button" onClick={() => setStep(2)} className="btn-primary px-8 py-3">
                {t('onboarding:buttons.next')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Target Language Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-navy mb-2">
                {t('onboarding:step2.title')}
              </h2>
              <p className="text-gray-600">{t('onboarding:step2.description')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {nativeLanguage !== 'en' && (
                <button
                  type="button"
                  onClick={() => setTargetLanguage('en')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    targetLanguage === 'en'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-navy mb-1">English</h3>
                  </div>
                </button>
              )}

              {nativeLanguage !== 'ja' && (
                <button
                  type="button"
                  onClick={() => setTargetLanguage('ja')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    targetLanguage === 'ja'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-navy mb-1">Japanese</h3>
                    <p className="text-sm text-gray-600">日本語</p>
                  </div>
                </button>
              )}

              {nativeLanguage !== 'zh' && (
                <button
                  type="button"
                  onClick={() => setTargetLanguage('zh')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    targetLanguage === 'zh'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-navy mb-1">Chinese</h3>
                    <p className="text-sm text-gray-600">中文</p>
                  </div>
                </button>
              )}

              {nativeLanguage !== 'es' && (
                <button
                  type="button"
                  onClick={() => setTargetLanguage('es')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    targetLanguage === 'es'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-navy mb-1">Spanish</h3>
                    <p className="text-sm text-gray-600">Español</p>
                  </div>
                </button>
              )}

              {nativeLanguage !== 'fr' && (
                <button
                  type="button"
                  onClick={() => setTargetLanguage('fr')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    targetLanguage === 'fr'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-navy mb-1">French</h3>
                    <p className="text-sm text-gray-600">Français</p>
                  </div>
                </button>
              )}

              {nativeLanguage !== 'ar' && (
                <button
                  type="button"
                  onClick={() => setTargetLanguage('ar')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    targetLanguage === 'ar'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-navy mb-1">Arabic</h3>
                    <p className="text-sm text-gray-600">العربية</p>
                  </div>
                </button>
              )}
            </div>

            <div className="flex justify-between mt-8">
              <button type="button" onClick={() => setStep(1)} className="btn-outline px-8 py-3">
                {t('onboarding:buttons.back')}
              </button>
              <button type="button" onClick={() => setStep(3)} className="btn-primary px-8 py-3">
                {t('onboarding:buttons.next')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Proficiency Level */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-navy mb-2">
                {t('onboarding:step3.title')}
              </h2>
              <p className="text-gray-600">{t('onboarding:step3.description')}</p>
            </div>

            {targetLanguage === 'ja' && (
              <div className="space-y-3">
                <button
                  type="button"
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
                  type="button"
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
                  type="button"
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
                  type="button"
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
                  type="button"
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
                  type="button"
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
                  type="button"
                  onClick={() => setHskLevel('HSK2')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    hskLevel === 'HSK2'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">HSK 2 (Upper Beginner)</h3>
                  <p className="text-sm text-gray-600">Can communicate in simple routine tasks</p>
                </button>

                <button
                  type="button"
                  onClick={() => setHskLevel('HSK3')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    hskLevel === 'HSK3'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">HSK 3 (Intermediate)</h3>
                  <p className="text-sm text-gray-600">Can handle most everyday situations</p>
                </button>

                <button
                  type="button"
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
                  type="button"
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
                  type="button"
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

            {(targetLanguage === 'en' ||
              targetLanguage === 'es' ||
              targetLanguage === 'fr' ||
              targetLanguage === 'ar') && (
              <div className="space-y-3">
                <button
                  type="button"
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
                  type="button"
                  onClick={() => setCefrLevel('A2')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    cefrLevel === 'A2'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">A2 (Elementary)</h3>
                  <p className="text-sm text-gray-600">Can communicate in simple routine tasks</p>
                </button>

                <button
                  type="button"
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
                  type="button"
                  onClick={() => setCefrLevel('B2')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    cefrLevel === 'B2'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">B2 (Upper Intermediate)</h3>
                  <p className="text-sm text-gray-600">Can interact with fluency and spontaneity</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCefrLevel('C1')}
                  className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                    cefrLevel === 'C1'
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <h3 className="font-semibold text-navy mb-1">C1 (Advanced)</h3>
                  <p className="text-sm text-gray-600">Can use language flexibly and effectively</p>
                </button>

                <button
                  type="button"
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
                type="button"
                onClick={() => setStep(2)}
                className="btn-outline px-8 py-3"
                disabled={isSubmitting}
              >
                {t('onboarding:buttons.back')}
              </button>
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
        )}
      </div>
    </div>
  );
};

export default OnboardingModal;
