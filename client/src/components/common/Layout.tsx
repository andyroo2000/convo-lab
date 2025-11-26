import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useIsDemo } from '../../hooks/useDemo';
import { Library, Mic } from 'lucide-react';
import UserMenu from './UserMenu';
import Logo from './Logo';
import OnboardingModal from '../onboarding/OnboardingModal';

export default function Layout() {
  const { user, logout } = useAuth();
  const isDemo = useIsDemo();
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

  // Show onboarding modal if user hasn't completed it
  if (!user.onboardingCompleted) {
    return <OnboardingModal />;
  }

  // Determine active navigation (updated for /app prefix)
  const isLibraryActive = location.pathname === '/app/library' || location.pathname.startsWith('/app/playback') || location.pathname.startsWith('/app/practice') || location.pathname.startsWith('/app/courses') || location.pathname.startsWith('/app/narrow-listening') || location.pathname.startsWith('/app/chunk-packs') || location.pathname.startsWith('/app/pi/session');
  const isCreateActive = location.pathname.startsWith('/app/create') || location.pathname.startsWith('/app/pi');

  return (
    <div className="min-h-screen bg-cream">
      <nav className="sticky top-0 z-20 bg-periwinkle shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16">
            <div className="flex items-center flex-1">
              <Link to="/app/library" className="flex items-center gap-2 px-2 sm:px-4 text-white font-bold text-lg sm:text-xl drop-shadow-md flex-shrink-0">
                <span className="hidden xs:inline">ConvoLab</span>
                <Logo size="small" />
              </Link>
              {isDemo && (
                <span className="hidden sm:inline-flex ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                  Demo Mode
                </span>
              )}
              {/* Desktop Navigation */}
              <div className="hidden sm:ml-6 sm:flex h-16 items-center gap-1">
                <Link
                  to="/app/library"
                  className={`relative inline-flex items-center justify-center px-4 h-10 text-sm font-bold transition-all rounded-lg ${
                    isLibraryActive
                      ? 'bg-white text-strawberry shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Library className="w-4 h-4 mr-2 flex-shrink-0" />
                  Library
                </Link>
                <Link
                  to="/app/create"
                  className={`relative inline-flex items-center justify-center px-4 h-10 text-sm font-bold transition-all rounded-lg ${
                    isCreateActive
                      ? 'bg-white text-coral shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Mic className="w-4 h-4 mr-2 flex-shrink-0" />
                  Create
                </Link>
              </div>
              {/* Mobile Navigation */}
              <div className="flex sm:hidden ml-2 gap-1 flex-1">
                <Link
                  to="/app/library"
                  className={`relative inline-flex items-center justify-center px-3 h-9 text-xs font-bold transition-all rounded-lg flex-1 ${
                    isLibraryActive
                      ? 'bg-white text-strawberry shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Library className="w-4 h-4 mr-1 flex-shrink-0" />
                  Library
                </Link>
                <Link
                  to="/app/create"
                  className={`relative inline-flex items-center justify-center px-3 h-9 text-xs font-bold transition-all rounded-lg flex-1 ${
                    isCreateActive
                      ? 'bg-white text-coral shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Mic className="w-4 h-4 mr-1 flex-shrink-0" />
                  Create
                </Link>
              </div>
            </div>

            <div className="flex items-center ml-2">
              {isDemo && (
                <span className="sm:hidden inline-flex mr-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full">
                  Demo
                </span>
              )}
              <UserMenu
                userName={user.displayName || user.name}
                avatarColor={user.avatarColor}
                avatarUrl={user.avatarUrl}
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
