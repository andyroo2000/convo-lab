import { useNavigate } from 'react-router-dom';
import { MessageSquare, BookOpen, Target, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/common/Logo';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 bg-periwinkle-light z-50 shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-dark-brown">ConvoLab</h1>
              <Logo size="medium" variant="dark" />
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <button
                  onClick={() => navigate('/app/library')}
                  className="px-6 py-2.5 bg-coral text-white rounded-full font-semibold hover:bg-coral-dark transition-all"
                  data-testid="landing-header-button-go-to-app"
                >
                  Go to App
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-6 py-2.5 border-2 border-dark-brown text-dark-brown rounded-full font-semibold hover:bg-dark-brown hover:text-cream transition-all"
                    data-testid="landing-header-button-signin"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-6 py-2.5 bg-coral text-white rounded-full font-semibold hover:bg-coral-dark transition-all"
                    data-testid="landing-header-button-get-started"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="bg-cream">

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="max-w-5xl mx-auto">
          <div className="inline-block mb-8">
            <span className="px-5 py-2.5 bg-yellow text-dark-brown rounded-full text-sm font-bold tracking-wide uppercase">
              Research-Backed Language Lab
            </span>
          </div>

          <h2 className="text-6xl md:text-7xl font-bold text-dark-brown mb-8 leading-[1.1]">
            Your Personal<br />
            <span className="text-coral">AI Language Lab</span>
          </h2>

          <p className="text-2xl text-medium-brown mb-12 max-w-3xl mx-auto leading-relaxed font-normal">
            Create custom content grounded in linguistics and SLA research. Design narrow listening exercises, processing instruction activities, and lexical chunk practice tailored to your learning style.
          </p>

          <div className="flex items-center justify-center gap-4">
            {user ? (
              <button
                onClick={() => navigate('/app/library')}
                className="px-10 py-4 bg-strawberry text-white rounded-full font-bold text-lg hover:bg-strawberry-dark transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                data-testid="landing-hero-button-go-to-app"
              >
                Go to App
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-10 py-4 bg-strawberry text-white rounded-full font-bold text-lg hover:bg-strawberry-dark transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                data-testid="landing-hero-button-start"
              >
                Start Learning Free
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-5xl font-bold text-dark-brown mb-4 leading-tight">
              Your Personal<br />Language Lab
            </h3>
            <p className="text-xl text-medium-brown font-normal">
              Apply proven SLA methods with AI-powered personalization
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-periwinkle-light rounded-3xl p-10 border-4 border-periwinkle hover:border-periwinkle-dark transition-all">
              <div className="w-16 h-16 bg-periwinkle rounded-2xl flex items-center justify-center mb-6">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold text-dark-brown mb-4">Comprehensible Input</h4>
              <p className="text-lg text-medium-brown leading-relaxed">
                Generate AI dialogues calibrated to your proficiency level. Create rich, contextual input that's challenging yet understandable—the sweet spot for acquisition.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-coral-light rounded-3xl p-10 border-4 border-coral hover:border-coral-dark transition-all">
              <div className="w-16 h-16 bg-coral rounded-2xl flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-bold text-dark-brown mb-4">Narrow Listening</h4>
              <p className="text-lg text-medium-brown leading-relaxed">
                Build fluency through repetition with variation. Experience the same story told multiple ways—different tenses, formality levels, and perspectives—to deeply internalize patterns.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-yellow-light rounded-3xl p-10 border-4 border-yellow hover:border-yellow-dark transition-all">
              <div className="w-16 h-16 bg-yellow rounded-2xl flex items-center justify-center mb-6">
                <BookOpen className="w-8 h-8 text-dark-brown" />
              </div>
              <h4 className="text-2xl font-bold text-dark-brown mb-4">Processing Instruction & Chunks</h4>
              <p className="text-lg text-medium-brown leading-relaxed">
                Acquire grammar through structured input activities. Learn lexical chunks as complete units, the way native speakers actually use language—not isolated words or abstract rules.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto bg-periwinkle rounded-[3rem] p-16 text-center text-white shadow-2xl border-4 border-periwinkle-dark">
          <Sparkles className="w-14 h-14 mx-auto mb-8" />
          <h3 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Ready to Build<br />Your Language Lab?
          </h3>
          <p className="text-2xl mb-10 text-periwinkle-light font-normal">
            Start creating research-backed, personalized content in minutes.
          </p>
          <button
            onClick={() => navigate(user ? '/app/library' : '/login')}
            className="px-10 py-4 bg-yellow text-dark-brown rounded-full font-bold text-lg hover:bg-yellow-dark transition-all transform hover:-translate-y-0.5 shadow-xl"
            data-testid={user ? 'landing-cta-button-go-to-app' : 'landing-cta-button-start'}
          >
            {user ? 'Go to App' : 'Get Started Free'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-16 border-t-2 border-light-brown">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xl font-bold text-dark-brown">ConvoLab</span>
            <Logo size="small" variant="dark" />
          </div>
          <p className="text-medium-brown">
            Your personal AI language lab
          </p>
        </div>
      </footer>
      </div>
    </div>
  );
}
