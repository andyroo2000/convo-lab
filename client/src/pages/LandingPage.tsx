import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, BookOpen, Target, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/common/Logo';

const LandingPage = () => {
  const { t } = useTranslation(['landing', 'common']);
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen retro-landing-v3-wrap">
      {/* Header */}
      <header className="sticky top-0 z-20 retro-topbar">
        <div className="max-w-7xl xl:max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="retro-landing-v3-nav">
            <Logo size="medium" showKana showIcons={false} />
            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => navigate('/app/library')}
                  className="retro-landing-v3-nav-btn is-primary"
                  data-testid="landing-header-button-go-to-app"
                >
                  {t('landing:header.goToApp')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="hidden sm:inline-flex retro-landing-v3-nav-btn"
                    data-testid="landing-header-button-signin"
                  >
                    {t('landing:header.signIn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="retro-landing-v3-nav-btn is-primary"
                    data-testid="landing-header-button-get-started"
                  >
                    {t('landing:header.getStarted')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="retro-landing-v3-main max-w-7xl xl:max-w-[96rem] mx-auto">
        {/* Hero Section */}
        <section className="retro-landing-v3-hero-shell">
          <div className="retro-landing-v3-hero-top">
            <h2 className="retro-landing-v3-hero-brand">CONVOLAB</h2>
            <div className="retro-landing-v3-hero-kana">コンボラボ</div>
          </div>

          <div className="retro-landing-v3-hero-main">
            <div className="retro-landing-v3-badge-row">
              <span className="retro-landing-v3-badge">{t('landing:hero.badge')}</span>
            </div>

            <h1 className="retro-landing-v3-title">
              <span>{t('landing:hero.title1')}</span>
              <span className="retro-landing-v3-title-accent">{t('landing:hero.title2')}</span>
            </h1>

            <p className="retro-landing-v3-description">{t('landing:hero.description')}</p>

            <div className="retro-landing-v3-hero-actions">
              {user ? (
                <button
                  type="button"
                  onClick={() => navigate('/app/library')}
                  className="retro-landing-v3-hero-btn"
                  data-testid="landing-hero-button-go-to-app"
                >
                  {t('landing:hero.goToApp')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="retro-landing-v3-hero-btn"
                  data-testid="landing-hero-button-start"
                >
                  {t('landing:hero.startLearning')}
                </button>
              )}
            </div>

            <div className="retro-landing-v3-highlights">
              <div className="retro-landing-v3-highlight">
                <MessageSquare className="w-4 h-4" />
                <span>JP Dialogues</span>
              </div>
              <div className="retro-landing-v3-highlight">
                <Target className="w-4 h-4" />
                <span>Audio Builder</span>
              </div>
              <div className="retro-landing-v3-highlight">
                <BookOpen className="w-4 h-4" />
                <span>Practice Loop</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="retro-landing-v3-section retro-landing-v3-features">
          <div className="retro-landing-v3-section-head">
            <h3 className="retro-landing-v3-section-title whitespace-pre-line">
              {t('landing:features.title')}
            </h3>
            <p className="retro-landing-v3-section-subtitle">{t('landing:features.subtitle')}</p>
          </div>

          <div className="retro-landing-v3-features-grid">
            <div className="retro-landing-v3-feature-card is-cyan">
              <div className="retro-landing-v3-feature-icon">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="retro-landing-v3-feature-title">
                {t('landing:features.feature1.title')}
              </h4>
              <p className="retro-landing-v3-feature-copy">
                {t('landing:features.feature1.description')}
              </p>
            </div>

            <div className="retro-landing-v3-feature-card is-ink">
              <div className="retro-landing-v3-feature-icon">
                <Target className="w-6 h-6" />
              </div>
              <h4 className="retro-landing-v3-feature-title">
                {t('landing:features.feature2.title')}
              </h4>
              <p className="retro-landing-v3-feature-copy">
                {t('landing:features.feature2.description')}
              </p>
            </div>

            <div className="retro-landing-v3-feature-card is-paper">
              <div className="retro-landing-v3-feature-icon">
                <BookOpen className="w-6 h-6" />
              </div>
              <h4 className="retro-landing-v3-feature-title">
                {t('landing:features.feature3.title')}
              </h4>
              <p className="retro-landing-v3-feature-copy">
                {t('landing:features.feature3.description')}
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="retro-landing-v3-section retro-landing-v3-cta-shell">
          <Sparkles className="retro-landing-v3-cta-icon" />
          <h3 className="retro-landing-v3-cta-title">
            {t('landing:cta.title')
              .split('\n')
              .map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
          </h3>
          <p className="retro-landing-v3-cta-copy">{t('landing:cta.description')}</p>
          <button
            type="button"
            onClick={() => navigate(user ? '/app/library' : '/login')}
            className="retro-landing-v3-cta-btn"
            data-testid={user ? 'landing-cta-button-go-to-app' : 'landing-cta-button-start'}
          >
            {user ? t('landing:cta.goToApp') : t('landing:cta.getStarted')}
          </button>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
