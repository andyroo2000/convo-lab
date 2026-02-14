import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Library, Mic, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useIsDemo } from '../../hooks/useDemo';
import useEffectiveUser from '../../hooks/useEffectiveUser';
import UserMenu from './UserMenu';
import Logo from './Logo';
import OnboardingModal from '../onboarding/OnboardingModal';
import { SHOW_ONBOARDING_WELCOME } from '../../config';

const Layout = () => {
  const { user, loading, logout } = useAuth();
  const { effectiveUser, isImpersonating } = useEffectiveUser();
  const { t } = useTranslation(['common']);
  const isDemo = useIsDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <div className="loading-spinner w-12 h-12 border-4 border-periwinkle border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-medium-brown">{t('common:loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(location.pathname);
    navigate(`/login?returnUrl=${returnUrl}`);
    return null;
  }

  // Show onboarding modal if user hasn't completed it
  if (SHOW_ONBOARDING_WELCOME && user.onboardingCompleted === false) {
    return <OnboardingModal />;
  }

  // Determine active navigation
  // Library should only be highlighted on the library index itself.
  const isLibraryActive = location.pathname === '/app/library';
  const isCreateActive = location.pathname.startsWith('/app/create');

  // Pages that should have no horizontal padding on mobile for full-width cards
  const isFullWidthMobilePage =
    location.pathname === '/app/library' || location.pathname === '/app/create';

  return (
    <div className="min-h-screen bg-cream retro-shell">
      <nav className="sticky top-0 z-20 bg-periwinkle retro-topbar">
        <div className="max-w-7xl xl:max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-[4.5rem] items-center">
            <div className="flex items-center flex-1 min-w-0">
              <Link
                to={viewAsUserId ? `/app/library?viewAs=${viewAsUserId}` : '/app/library'}
                className="flex items-center gap-2 px-2 text-white font-bold text-lg sm:text-xl drop-shadow-md flex-shrink-0"
              >
                <Logo size="small" showKana showIcons={false} />
              </Link>
              {isDemo && (
                <span className="hidden sm:inline-flex ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full retro-caps">
                  {t('common:demoMode')}
                </span>
              )}
              {isImpersonating && effectiveUser && (
                <span className="hidden sm:inline-flex ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Viewing as: {effectiveUser.displayName || effectiveUser.name}
                </span>
              )}
              {/* Desktop Navigation */}
              <div className="hidden sm:ml-6 sm:flex h-[4.5rem] items-center gap-2">
                <Link
                  to={viewAsUserId ? `/app/library?viewAs=${viewAsUserId}` : '/app/library'}
                  className={`retro-nav-tab relative inline-flex items-center justify-center transition-all ${
                    isLibraryActive
                      ? 'is-active bg-white text-strawberry shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Library className="w-5 h-5 mr-2.5 flex-shrink-0" />
                  {t('common:nav.library')}
                </Link>
                <Link
                  to={viewAsUserId ? `/app/create?viewAs=${viewAsUserId}` : '/app/create'}
                  className={`retro-nav-tab relative inline-flex items-center justify-center transition-all ${
                    isCreateActive
                      ? 'is-active bg-white text-coral shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Mic className="w-5 h-5 mr-2.5 flex-shrink-0" />
                  {t('common:nav.create')}
                </Link>
              </div>
              {/* Mobile Navigation */}
              <div className="flex sm:hidden ml-2 gap-2 flex-1 min-w-0">
                <Link
                  to={viewAsUserId ? `/app/library?viewAs=${viewAsUserId}` : '/app/library'}
                  className={`retro-nav-tab relative inline-flex items-center justify-center text-xs font-bold transition-all flex-1 ${
                    isLibraryActive
                      ? 'is-active bg-white text-strawberry shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Library className="w-5 h-5 mr-1.5 flex-shrink-0" />
                  {t('common:nav.library')}
                </Link>
                <Link
                  to={viewAsUserId ? `/app/create?viewAs=${viewAsUserId}` : '/app/create'}
                  className={`retro-nav-tab relative inline-flex items-center justify-center text-xs font-bold transition-all flex-1 ${
                    isCreateActive
                      ? 'is-active bg-white text-coral shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Mic className="w-5 h-5 mr-1.5 flex-shrink-0" />
                  {t('common:nav.create')}
                </Link>
              </div>
            </div>

            <div className="flex items-center ml-2 gap-2">
              {isDemo && (
                <span className="sm:hidden inline-flex mr-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full">
                  {t('common:demoMode')}
                </span>
              )}
              {isImpersonating && effectiveUser && (
                <span className="sm:hidden inline-flex mr-2 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-800 rounded-full items-center gap-1">
                  <Eye className="w-2.5 h-2.5" />
                  {effectiveUser.displayName || effectiveUser.name}
                </span>
              )}
              <UserMenu
                userName={
                  isImpersonating && effectiveUser
                    ? effectiveUser.displayName || effectiveUser.name
                    : user.displayName || user.name
                }
                avatarColor={
                  isImpersonating && effectiveUser ? effectiveUser.avatarColor : user.avatarColor
                }
                avatarUrl={
                  isImpersonating && effectiveUser ? effectiveUser.avatarUrl : user.avatarUrl
                }
                userRole={isImpersonating && effectiveUser ? effectiveUser.role : user.role}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </div>
      </nav>
      <main
        className={`max-w-7xl xl:max-w-[96rem] mx-auto py-8 ${
          isFullWidthMobilePage ? 'sm:px-6 lg:px-8' : 'px-4 sm:px-6 lg:px-8'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
