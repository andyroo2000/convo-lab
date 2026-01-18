import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Library, Mic, Eye } from 'lucide-react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { LANGUAGE_ABBREVIATIONS } from '@languageflow/shared/src/constants-new';
import { useAuth } from '../../contexts/AuthContext';
import { useIsDemo } from '../../hooks/useDemo';
import useEffectiveUser from '../../hooks/useEffectiveUser';
import UserMenu from './UserMenu';
import Logo from './Logo';
import OnboardingModal from '../onboarding/OnboardingModal';

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
  if (!user.onboardingCompleted) {
    return <OnboardingModal />;
  }

  // Determine active navigation (updated for /app prefix)
  const isLibraryActive =
    location.pathname === '/app/library' ||
    location.pathname.startsWith('/app/playback') ||
    location.pathname.startsWith('/app/practice') ||
    location.pathname.startsWith('/app/courses') ||
    location.pathname.startsWith('/app/narrow-listening') ||
    location.pathname.startsWith('/app/chunk-packs') ||
    location.pathname.startsWith('/app/pi/session');
  const isCreateActive =
    location.pathname.startsWith('/app/create') || location.pathname.startsWith('/app/pi');

  // Pages that should have no horizontal padding on mobile for full-width cards
  const isFullWidthMobilePage =
    location.pathname === '/app/library' || location.pathname === '/app/create';

  return (
    <div className="min-h-screen bg-cream">
      <nav className="sticky top-0 z-20 bg-periwinkle shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16">
            <div className="flex items-center flex-1">
              <Link
                to={viewAsUserId ? `/app/library?viewAs=${viewAsUserId}` : '/app/library'}
                className="flex items-center gap-2 px-2 sm:px-4 text-white font-bold text-lg sm:text-xl drop-shadow-md flex-shrink-0"
              >
                <span className="hidden xs:inline">ConvoLab</span>
                <Logo size="small" />
              </Link>
              {isDemo && (
                <span className="hidden sm:inline-flex ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
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
              <div className="hidden sm:ml-6 sm:flex h-16 items-center gap-1">
                <Link
                  to={viewAsUserId ? `/app/library?viewAs=${viewAsUserId}` : '/app/library'}
                  className={`relative inline-flex items-center justify-center px-4 h-10 text-sm font-bold transition-all rounded-lg ${
                    isLibraryActive
                      ? 'bg-white text-strawberry shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Library className="w-4 h-4 mr-2 flex-shrink-0" />
                  {t('common:nav.library')}
                </Link>
                <Link
                  to={viewAsUserId ? `/app/create?viewAs=${viewAsUserId}` : '/app/create'}
                  className={`relative inline-flex items-center justify-center px-4 h-10 text-sm font-bold transition-all rounded-lg ${
                    isCreateActive
                      ? 'bg-white text-coral shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Mic className="w-4 h-4 mr-2 flex-shrink-0" />
                  {t('common:nav.create')}
                </Link>
              </div>
              {/* Mobile Navigation */}
              <div className="flex sm:hidden ml-2 gap-1 flex-1">
                <Link
                  to={viewAsUserId ? `/app/library?viewAs=${viewAsUserId}` : '/app/library'}
                  className={`relative inline-flex items-center justify-center px-3 h-11 text-xs font-bold transition-all rounded-lg flex-1 ${
                    isLibraryActive
                      ? 'bg-white text-strawberry shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Library className="w-4 h-4 mr-1 flex-shrink-0" />
                  {t('common:nav.library')}
                </Link>
                <Link
                  to={viewAsUserId ? `/app/create?viewAs=${viewAsUserId}` : '/app/create'}
                  className={`relative inline-flex items-center justify-center px-3 h-11 text-xs font-bold transition-all rounded-lg flex-1 ${
                    isCreateActive
                      ? 'bg-white text-coral shadow-md'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Mic className="w-4 h-4 mr-1 flex-shrink-0" />
                  {t('common:nav.create')}
                </Link>
              </div>
            </div>

            <div className="flex items-center ml-2">
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
              {/* Language Indicator - Mobile */}
              <div className="sm:hidden flex items-center mr-2">
                <div className="px-1.5 py-0.5 bg-white/20 rounded">
                  <span className="text-[10px] font-bold text-white tracking-wide">
                    {LANGUAGE_ABBREVIATIONS[
                      effectiveUser?.preferredStudyLanguage as keyof typeof LANGUAGE_ABBREVIATIONS
                    ] || 'JA'}
                  </span>
                </div>
              </div>
              {/* Language Indicator - Desktop */}
              <div className="hidden sm:flex items-center mr-3">
                <div className="px-2.5 py-1 bg-white/20 rounded-md">
                  <span className="text-xs font-bold text-white tracking-wide">
                    {LANGUAGE_ABBREVIATIONS[
                      effectiveUser?.preferredStudyLanguage as keyof typeof LANGUAGE_ABBREVIATIONS
                    ] || 'JA'}
                  </span>
                </div>
              </div>
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
        className={`max-w-7xl mx-auto py-8 ${isFullWidthMobilePage ? 'sm:px-6 lg:px-8' : 'px-4 sm:px-6 lg:px-8'}`}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
