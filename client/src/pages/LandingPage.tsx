import { useNavigate } from 'react-router-dom';
import { MessageSquare, BookOpen, Target, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/common/Logo';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy">ConvoLab</h1>
            <Logo size="medium" />
          </div>
          <div className="flex items-center gap-3 mt-2">
            {user ? (
              <button
                onClick={() => navigate('/app/library')}
                className="btn-primary"
              >
                Go to App
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-outline"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-primary"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-block mb-6">
            <span className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
              Research-Backed Language Lab
            </span>
          </div>

          <h2 className="text-5xl md:text-6xl font-bold text-navy mb-6 leading-tight">
            Your Personal
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600"> AI Language Lab</span>
          </h2>

          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create custom content grounded in linguistics and SLA research. Design narrow listening exercises, processing instruction activities, and lexical chunk practice tailored to your learning style.
          </p>

          <div className="flex items-center justify-center gap-4">
            {user ? (
              <button
                onClick={() => navigate('/app/library')}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-105"
              >
                Go to App
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg transition-all transform hover:scale-105"
              >
                Start Learning Free
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-navy mb-4">
            Your Personal Language Lab
          </h3>
          <p className="text-center text-gray-600 mb-12 text-lg">
            Apply proven SLA methods with AI-powered personalization
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                <MessageSquare className="w-7 h-7 text-indigo-600" />
              </div>
              <h4 className="text-xl font-bold text-navy mb-3">Comprehensible Input</h4>
              <p className="text-gray-600 leading-relaxed">
                Generate AI dialogues calibrated to your proficiency level. Create rich, contextual input that's challenging yet understandable—the sweet spot for acquisition.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-purple-600" />
              </div>
              <h4 className="text-xl font-bold text-navy mb-3">Narrow Listening</h4>
              <p className="text-gray-600 leading-relaxed">
                Build fluency through repetition with variation. Experience the same story told multiple ways—different tenses, formality levels, and perspectives—to deeply internalize patterns.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center mb-6">
                <BookOpen className="w-7 h-7 text-teal-600" />
              </div>
              <h4 className="text-xl font-bold text-navy mb-3">Processing Instruction & Chunks</h4>
              <p className="text-gray-600 leading-relaxed">
                Acquire grammar through structured input activities. Learn lexical chunks as complete units, the way native speakers actually use language—not isolated words or abstract rules.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-center text-white shadow-2xl">
          <Sparkles className="w-12 h-12 mx-auto mb-6" />
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Build Your Language Lab?
          </h3>
          <p className="text-xl mb-8 text-indigo-100">
            Start creating research-backed, personalized content in minutes.
          </p>
          <button
            onClick={() => navigate(user ? '/app/library' : '/login')}
            className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold text-lg hover:bg-indigo-50 transition-all transform hover:scale-105 shadow-lg"
          >
            {user ? 'Go to App' : 'Get Started Free'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 border-t border-gray-200">
        <div className="text-center text-gray-600">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="font-semibold text-navy">ConvoLab</span>
            <Logo size="small" />
          </div>
          <p className="text-sm">
            Your personal AI language lab
          </p>
        </div>
      </footer>
    </div>
  );
}
