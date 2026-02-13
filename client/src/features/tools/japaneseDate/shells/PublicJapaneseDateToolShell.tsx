import { Link } from 'react-router-dom';

import { useAuth } from '../../../../contexts/AuthContext';

import useSeoMeta from '../hooks/useSeoMeta';
import JapaneseDateToolPage from '../components/JapaneseDateToolPage';

const CANONICAL_URL = 'https://convo-lab.com/tools/japanese-date';

const PublicJapaneseDateToolShell = () => {
  const { user } = useAuth();

  useSeoMeta({
    title: 'Japanese Date & Time Reader (with Kana) | ConvoLab',
    description:
      'Convert Gregorian dates and times into Japanese script and kana readings. Toggle 12h/24h format and copy results instantly.',
    canonicalUrl: CANONICAL_URL,
    robots: 'index,follow',
  });

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="card retro-paper-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/" className="retro-caps text-sm text-[#1f4368] hover:underline">
              ConvoLab Home
            </Link>
            {user ? (
              <Link to="/app/tools/japanese-date" className="btn-secondary">
                Open In App
              </Link>
            ) : (
              <Link to="/login?returnUrl=%2Fapp%2Ftools%2Fjapanese-date" className="btn-secondary">
                Sign In For In-App Tool
              </Link>
            )}
          </div>
        </header>

        <JapaneseDateToolPage />
      </div>
    </div>
  );
};

export default PublicJapaneseDateToolShell;
