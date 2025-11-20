import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Library, Mic } from 'lucide-react';
import UserMenu from './UserMenu';
import Logo from './Logo';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(location.pathname);
    navigate(`/login?returnUrl=${returnUrl}`);
    return null;
  }

  // Determine active navigation (updated for /app prefix)
  const isLibraryActive = location.pathname === '/app/library' || location.pathname.startsWith('/app/playback') || location.pathname.startsWith('/app/practice') || location.pathname.startsWith('/app/courses') || location.pathname.startsWith('/app/narrow-listening') || location.pathname.startsWith('/app/chunk-packs') || location.pathname.startsWith('/app/pi/session');
  const isStudioActive = location.pathname.startsWith('/app/studio') || location.pathname.startsWith('/app/pi');

  return (
    <div className="min-h-screen bg-soft-sand">
      <nav className="sticky top-0 z-20 bg-white border-b border-warm-gray shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16">
            <div className="flex">
              <Link to="/app/library" className="flex items-center gap-2 px-4 text-navy font-bold text-xl">
                ConvoLab
                <Logo size="small" />
              </Link>
              <div className="hidden sm:ml-6 sm:flex h-16 items-center">
                <Link
                  to="/app/library"
                  className={`relative inline-flex items-center justify-center w-24 h-full text-sm font-semibold transition-colors ${
                    isLibraryActive
                      ? 'text-indigo'
                      : 'text-navy hover:text-indigo'
                  }`}
                >
                  <Library className="w-4 h-4 mr-2 flex-shrink-0" />
                  Library
                  {isLibraryActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo"></span>
                  )}
                </Link>
                <Link
                  to="/app/studio"
                  className={`relative inline-flex items-center justify-center w-24 h-full text-sm font-semibold transition-colors ${
                    isStudioActive
                      ? 'text-indigo'
                      : 'text-navy hover:text-indigo'
                  }`}
                >
                  <Mic className="w-4 h-4 mr-2 flex-shrink-0" />
                  Create
                  {isStudioActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo"></span>
                  )}
                </Link>
              </div>
            </div>

            <div className="flex items-center ml-auto">
              <UserMenu
                userName={user.displayName || user.name}
                avatarColor={user.avatarColor}
                role={user.role}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
