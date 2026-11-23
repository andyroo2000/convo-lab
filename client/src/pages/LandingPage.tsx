import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import JournalLandingStory from '../features/landing/JournalLandingStory';
import BetaAccessForm from '../features/landing/BetaAccessForm';
import '../features/landing/landing.css';

const LandingPage = () => {
  const { user } = useAuth();
  return (
    <div className="journal-landing">
      <header className="landing-header">
        <Link to="/" className="landing-name">
          Journal <span>by ConvoLab</span>
        </Link>
        <nav aria-label="Journal">
          <Link to={user ? '/app/journal' : '/login'} className="landing-login">
            {user ? 'Open Journal' : 'Log in'}
          </Link>
          <a href="#request-access" className="landing-cta">
            Request access
          </a>
        </nav>
      </header>
      <main>
        <JournalLandingStory />
        <BetaAccessForm />
      </main>
    </div>
  );
};

export default LandingPage;
