import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Headphones, Sparkles } from 'lucide-react';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useAuth } from '../contexts/AuthContext';
import { useIsDemo } from '../hooks/useDemo';
import QuotaBadge from '../components/QuotaBadge';
import CustomContentGuide from '../components/pulsePoints/CustomContentGuide';

const CreatePage = () => {
  const { t } = useTranslation(['create']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const { isFeatureEnabled } = useFeatureFlags();
  const { user, updateUser } = useAuth();
  const isDemo = useIsDemo();

  // Helper function to navigate with viewAs preserved
  const navigateWithViewAs = (path: string) => {
    const fullPath = viewAsUserId ? `${path}?viewAs=${viewAsUserId}` : path;
    navigate(fullPath);
  };

  // Show custom content guide for users who haven't seen it
  const [showCustomGuide, setShowCustomGuide] = useState(false);

  useEffect(() => {
    // Show guide if user completed onboarding, hasn't seen the custom content guide, and isn't a demo user
    if (user?.onboardingCompleted && !user?.seenCustomContentGuide && !isDemo) {
      setShowCustomGuide(true);
    }
  }, [user, isDemo]);

  const handleCloseCustomGuide = async () => {
    setShowCustomGuide(false);
    // Mark as seen so it doesn't show again
    if (user && !user.seenCustomContentGuide) {
      try {
        await updateUser({ seenCustomContentGuide: true });
      } catch (error) {
        console.error('Failed to update seenCustomContentGuide:', error);
      }
    }
  };

  return (
    <div>
      <div className="mb-12 text-center px-4 sm:px-0">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">{t('create:title')}</h1>
        <p className="text-lg text-gray-600 mb-4">{t('create:subtitle')}</p>
        <QuotaBadge />
      </div>

      <div className="max-w-5xl mx-auto space-y-3">
        {/* Dialogue Content Type */}
        {isFeatureEnabled('dialoguesEnabled') && (
          <button
            type="button"
            onClick={() => navigateWithViewAs('/app/create/dialogue')}
            className="w-full flex items-center bg-white hover:bg-periwinkle-light transition-all duration-200 hover:shadow-xl group"
            data-testid="create-card-dialogues"
          >
            <div className="w-20 sm:w-32 flex-shrink-0 bg-periwinkle flex flex-col items-center justify-center py-6 sm:py-8">
              <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-white mb-2" />
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">
                {t('create:types.dialogue.title')}
              </span>
            </div>
            <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6">
              <h2 className="text-xl sm:text-3xl font-bold text-dark-brown group-hover:text-periwinkle transition-colors mb-1 sm:mb-2">
                {t('create:types.dialogue.title')}
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                {t('create:types.dialogue.description')}
              </p>
            </div>
          </button>
        )}

        {/* Course Content Type */}
        {isFeatureEnabled('audioCourseEnabled') && (
          <button
            type="button"
            onClick={() => navigateWithViewAs('/app/create/audio-course')}
            className="w-full flex items-center bg-white hover:bg-coral-light transition-all duration-200 hover:shadow-xl group"
            data-testid="create-card-audio-course"
          >
            <div className="w-20 sm:w-32 flex-shrink-0 bg-coral flex flex-col items-center justify-center py-6 sm:py-8">
              <Headphones className="w-10 h-10 sm:w-12 sm:h-12 text-white mb-2" />
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide text-center leading-tight">
                {t('create:types.course.title').split(' ')[0]}
                <br />
                {t('create:types.course.title').split(' ')[1]}
              </span>
            </div>
            <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6">
              <h2 className="text-xl sm:text-3xl font-bold text-dark-brown group-hover:text-coral transition-colors mb-1 sm:mb-2">
                {t('create:types.course.title')}
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                {t('create:types.course.description')}
              </p>
            </div>
          </button>
        )}

        {/* Narrow Listening Content Type */}
        {isFeatureEnabled('narrowListeningEnabled') && (
          <button
            type="button"
            onClick={() => navigateWithViewAs('/app/create/narrow-listening')}
            className="w-full flex items-center bg-white hover:bg-strawberry-light transition-all duration-200 hover:shadow-xl group"
            data-testid="create-card-narrow-listening"
          >
            <div className="w-20 sm:w-32 flex-shrink-0 bg-strawberry flex flex-col items-center justify-center py-6 sm:py-8">
              <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-white mb-2" />
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide text-center leading-tight">
                {t('create:types.narrowListening.title').split(' ')[0]}
                <br />
                {t('create:types.narrowListening.title').split(' ')[1]}
              </span>
            </div>
            <div className="flex-1 px-4 sm:px-8 py-4 sm:py-6">
              <h2 className="text-xl sm:text-3xl font-bold text-dark-brown group-hover:text-strawberry transition-colors mb-1 sm:mb-2">
                {t('create:types.narrowListening.title')}
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                {t('create:types.narrowListening.description')}
              </p>
            </div>
          </button>
        )}

      </div>

      <p className="text-center text-gray-500 mt-12 px-4 sm:px-0">{t('create:footer')}</p>

      {/* Custom Content Guide Pulse Point */}
      {showCustomGuide && <CustomContentGuide onClose={handleCloseCustomGuide} />}
    </div>
  );
};

export default CreatePage;
