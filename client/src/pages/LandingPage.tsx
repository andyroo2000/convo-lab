import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock3, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/common/Logo';

const LandingPage = () => {
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
              <button
                type="button"
                onClick={() => navigate('/tools')}
                className="retro-landing-v3-nav-btn is-primary"
                data-testid="landing-header-button-open-tools"
              >
                Open Free Tools
              </button>
              {user ? (
                <button
                  type="button"
                  onClick={() => navigate('/app/library')}
                  className="hidden sm:inline-flex retro-landing-v3-nav-btn"
                  data-testid="landing-header-button-go-to-app"
                >
                  Go to App (Beta)
                </button>
              ) : (
                <span className="retro-landing-v3-nav-btn" data-testid="landing-header-beta-badge">
                  Invite-Only Beta
                </span>
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
              <span className="retro-landing-v3-badge">Free Public Japanese Tools</span>
            </div>

            <h1 className="retro-landing-v3-title">
              <span>Practice Japanese</span>
              <span className="retro-landing-v3-title-accent">Dates & Time</span>
            </h1>

            <p className="retro-landing-v3-description">
              Start instantly with free tools for Japanese date and time reading, with furigana and
              audio. The full ConvoLab app is currently in private beta and invite-only.
            </p>

            <div className="retro-landing-v3-hero-actions">
              <button
                type="button"
                onClick={() => navigate('/tools/japanese-date')}
                className="retro-landing-v3-hero-btn"
                data-testid="landing-hero-button-open-date-tool"
              >
                Open Date Practice Tool
              </button>
              <button
                type="button"
                onClick={() => navigate('/tools/japanese-time')}
                className="retro-landing-v3-hero-btn"
                data-testid="landing-hero-button-open-time-tool"
              >
                Open Time Practice Tool
              </button>
            </div>

            <div className="retro-landing-v3-highlights">
              <div className="retro-landing-v3-highlight">
                <CalendarDays className="w-4 h-4" />
                <span>Date Readings</span>
              </div>
              <div className="retro-landing-v3-highlight">
                <Clock3 className="w-4 h-4" />
                <span>Time Drills</span>
              </div>
              <div className="retro-landing-v3-highlight">
                <Lock className="w-4 h-4" />
                <span>App Private Beta</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="retro-landing-v3-section retro-landing-v3-features">
          <div className="retro-landing-v3-section-head">
            <h3 className="retro-landing-v3-section-title">What You Can Use Right Now</h3>
            <p className="retro-landing-v3-section-subtitle">
              Fast, focused tools that work immediately on desktop and mobile.
            </p>
          </div>

          <div className="retro-landing-v3-features-grid">
            <div className="retro-landing-v3-feature-card is-cyan">
              <div className="retro-landing-v3-feature-icon">
                <CalendarDays className="w-6 h-6" />
              </div>
              <h4 className="retro-landing-v3-feature-title">Japanese Date Practice Tool</h4>
              <p className="retro-landing-v3-feature-copy">
                Practice Japanese calendar readings with furigana, audio playback, and quick
                reveal/quiz flow.
              </p>
            </div>

            <div className="retro-landing-v3-feature-card is-ink">
              <div className="retro-landing-v3-feature-icon">
                <Clock3 className="w-6 h-6" />
              </div>
              <h4 className="retro-landing-v3-feature-title">Japanese Time Practice Tool</h4>
              <p className="retro-landing-v3-feature-copy">
                Train time recognition with delayed reveal, audio-first loops, and rapid
                clock-format drills.
              </p>
            </div>

            <div className="retro-landing-v3-feature-card is-paper">
              <div className="retro-landing-v3-feature-icon">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="retro-landing-v3-feature-title">ConvoLab App: Private Beta</h4>
              <p className="retro-landing-v3-feature-copy">
                The full paid app is currently invite-only while we finalize onboarding and quality.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="retro-landing-v3-section retro-landing-v3-cta-shell">
          <Sparkles className="retro-landing-v3-cta-icon" />
          <h3 className="retro-landing-v3-cta-title">Start With Free Japanese Tools</h3>
          <p className="retro-landing-v3-cta-copy">
            Explore the tools directory and jump straight into date/time practice with no account
            required.
          </p>
          <button
            type="button"
            onClick={() => navigate('/tools')}
            className="retro-landing-v3-cta-btn"
            data-testid="landing-cta-button-open-tools"
          >
            Browse Free Tools
          </button>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
