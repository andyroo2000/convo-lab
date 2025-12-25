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
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 bg-periwinkle-light z-50 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <Logo size="medium" variant="dark" />
            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                <button type="button"
                  onClick={() => navigate('/app/library')}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 bg-coral text-white rounded-full font-semibold hover:bg-coral-dark transition-all text-sm sm:text-base"
                  data-testid="landing-header-button-go-to-app"
                >
                  {t('landing:header.goToApp')}
                </button>
              ) : (
                <>
                  <button type="button"
                    onClick={() => navigate('/login')}
                    className="hidden sm:block px-6 py-2.5 border-2 border-dark-brown text-dark-brown rounded-full font-semibold hover:bg-dark-brown hover:text-cream transition-all"
                    data-testid="landing-header-button-signin"
                  >
                    {t('landing:header.signIn')}
                  </button>
                  <button type="button"
                    onClick={() => navigate('/login')}
                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-coral text-white rounded-full font-semibold hover:bg-coral-dark transition-all text-sm sm:text-base"
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

      <div className="bg-cream">
        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-24 text-center">
          <div className="max-w-5xl mx-auto">
            <div className="inline-block mb-6 sm:mb-8">
              <span className="px-4 sm:px-5 py-2 sm:py-2.5 bg-yellow text-dark-brown rounded-full text-xs sm:text-sm font-bold tracking-wide uppercase">
                {t('landing:hero.badge')}
              </span>
            </div>

            <h2 className="text-4xl sm:text-6xl md:text-7xl font-bold text-dark-brown mb-6 sm:mb-8 leading-[1.1]">
              {t('landing:hero.title1')}
              <br />
              <span className="text-coral">{t('landing:hero.title2')}</span>
            </h2>

            <p className="text-lg sm:text-2xl text-medium-brown mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed font-normal">
              {t('landing:hero.description')}
            </p>

            <div className="flex items-center justify-center gap-4">
              {user ? (
                <button type="button"
                  onClick={() => navigate('/app/library')}
                  className="px-8 sm:px-10 py-3 sm:py-4 bg-strawberry text-white rounded-full font-bold text-base sm:text-lg hover:bg-strawberry-dark transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  data-testid="landing-hero-button-go-to-app"
                >
                  {t('landing:hero.goToApp')}
                </button>
              ) : (
                <button type="button"
                  onClick={() => navigate('/login')}
                  className="px-8 sm:px-10 py-3 sm:py-4 bg-strawberry text-white rounded-full font-bold text-base sm:text-lg hover:bg-strawberry-dark transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  data-testid="landing-hero-button-start"
                >
                  {t('landing:hero.startLearning')}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-16">
              <h3 className="text-3xl sm:text-5xl font-bold text-dark-brown mb-3 sm:mb-4 leading-tight">
                {t('landing:features.title')}
              </h3>
              <p className="text-lg sm:text-xl text-medium-brown font-normal">
                {t('landing:features.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
              {/* Feature 1 */}
              <div className="bg-periwinkle-light rounded-2xl sm:rounded-3xl p-6 sm:p-10 border-4 border-periwinkle hover:border-periwinkle-dark transition-all">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-periwinkle rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                  <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h4 className="text-xl sm:text-2xl font-bold text-dark-brown mb-3 sm:mb-4">
                  {t('landing:features.feature1.title')}
                </h4>
                <p className="text-base sm:text-lg text-medium-brown leading-relaxed">
                  {t('landing:features.feature1.description')}
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-coral-light rounded-2xl sm:rounded-3xl p-6 sm:p-10 border-4 border-coral hover:border-coral-dark transition-all">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-coral rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                  <Target className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h4 className="text-xl sm:text-2xl font-bold text-dark-brown mb-3 sm:mb-4">
                  {t('landing:features.feature2.title')}
                </h4>
                <p className="text-base sm:text-lg text-medium-brown leading-relaxed">
                  {t('landing:features.feature2.description')}
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-yellow-light rounded-2xl sm:rounded-3xl p-6 sm:p-10 border-4 border-yellow hover:border-yellow-dark transition-all">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-yellow rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                  <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-dark-brown" />
                </div>
                <h4 className="text-xl sm:text-2xl font-bold text-dark-brown mb-3 sm:mb-4">
                  {t('landing:features.feature3.title')}
                </h4>
                <p className="text-base sm:text-lg text-medium-brown leading-relaxed">
                  {t('landing:features.feature3.description')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-4xl mx-auto bg-periwinkle rounded-2xl sm:rounded-[3rem] p-8 sm:p-16 text-center text-white shadow-2xl border-4 border-periwinkle-dark">
            <Sparkles className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-6 sm:mb-8" />
            <h3 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              {t('landing:cta.title')}
            </h3>
            <p className="text-lg sm:text-2xl mb-8 sm:mb-10 text-periwinkle-light font-normal">
              {t('landing:cta.description')}
            </p>
            <button type="button"
              onClick={() => navigate(user ? '/app/library' : '/login')}
              className="px-8 sm:px-10 py-3 sm:py-4 bg-yellow text-dark-brown rounded-full font-bold text-base sm:text-lg hover:bg-yellow-dark transition-all transform hover:-translate-y-0.5 shadow-xl"
              data-testid={user ? 'landing-cta-button-go-to-app' : 'landing-cta-button-start'}
            >
              {user ? t('landing:cta.goToApp') : t('landing:cta.getStarted')}
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 border-t-2 border-light-brown">
          <div className="text-center">
            <div className="flex items-center justify-center mb-3 sm:mb-4">
              <Logo size="medium" variant="dark" />
            </div>
            <p className="text-sm sm:text-base text-medium-brown">{t('common:tagline')}</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
