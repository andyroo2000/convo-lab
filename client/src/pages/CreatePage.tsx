import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
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
    <div className="retro-create-v3-wrap">
      <div className="retro-create-v3-shell">
        <div className="retro-create-v3-top">
          <div className="retro-create-v3-branding">
            <h1 className="retro-create-v3-title">{t('create:title')}</h1>
            <p className="retro-create-v3-subtitle">{t('create:subtitle')}</p>
          </div>
        </div>

        <div className="retro-create-v3-main">
          <div className="retro-create-v3-badge-row">
            <QuotaBadge />
          </div>

          <div className="retro-create-v3-grid">
            {/* Dialogue Content Type */}
            {isFeatureEnabled('dialoguesEnabled') && (
              <button
                type="button"
                onClick={() => navigateWithViewAs('/app/create/dialogue')}
                className="retro-create-v3-card group"
                data-testid="create-card-dialogues"
              >
                <div className="retro-create-v3-card-head">
                  <div className="retro-create-v3-card-kicker retro-caps">ワーク 1</div>
                  <h2 className="retro-create-v3-card-title">{t('create:types.dialogue.title')}</h2>
                </div>

                <div className="retro-create-v3-card-body">
                  <div className="retro-create-v3-card-mini">
                    <span className="retro-create-v3-icon-wrap" aria-hidden="true">
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <span className="retro-caps">Prompt / Story / Dialogue</span>
                  </div>

                  <p className="retro-create-v3-card-description">
                    {t('create:types.dialogue.description')}
                  </p>

                  <div className="retro-create-v3-card-cta">
                    <span className="retro-create-v3-open retro-caps">
                      {t('create:buttons.create')}
                    </span>
                  </div>
                </div>
              </button>
            )}
          </div>

          <p className="retro-create-v3-footer">{t('create:footer')}</p>
        </div>
      </div>

      {/* Custom Content Guide Pulse Point */}
      {showCustomGuide && <CustomContentGuide onClose={handleCloseCustomGuide} />}
    </div>
  );
};

export default CreatePage;
