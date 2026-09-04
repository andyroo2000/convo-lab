import { useEffect, useMemo } from 'react';
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Library, Mic, Eye, BookOpen, Clock3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useIsDemo } from '../../hooks/useDemo';
import useEffectiveUser from '../../hooks/useEffectiveUser';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import UserMenu, { type UserMenuMobileNavItem } from './UserMenu';
import Logo from './Logo';
import OnboardingModal from '../onboarding/OnboardingModal';
import { SHOW_ONBOARDING_WELCOME } from '../../config';
import { StudyActivityProvider } from '../../contexts/StudyActivityContext';
import ActiveStudyTimer from '../study/ActiveStudyTimer';
import MobileLearningDock from './MobileLearningDock';
import type { User } from '../../types';

type LayoutRouteState = {
  createPath: string;
  isCreateActive: boolean;
  isFullWidthMobilePage: boolean;
  isLibraryActive: boolean;
  isStudyActive: boolean;
  isTimeActive: boolean;
  libraryPath: string;
};

type NavigationLabels = {
  create: string;
  library: string;
  study: string;
  studyTime: string;
};

function pathForViewer(path: string, viewAsUserId?: string) {
  return viewAsUserId ? `${path}?viewAs=${viewAsUserId}` : path;
}

function getViewAsUserId(searchParams: URLSearchParams) {
  return searchParams.get('viewAs') || undefined;
}

function shouldRedirectToLogin(loading: boolean, user: User | null) {
  return !loading && !user;
}

function shouldShowOnboarding(user: User) {
  return SHOW_ONBOARDING_WELCOME && user.onboardingCompleted === false;
}

function shouldShowMobileLearningDock(
  flashcardsEnabled: boolean,
  viewAsUserId: string | undefined,
  isImpersonating: boolean
) {
  return flashcardsEnabled && !viewAsUserId && !isImpersonating;
}

function getMenuUser(user: User, effectiveUser: User | null, isImpersonating: boolean) {
  if (isImpersonating && effectiveUser) return effectiveUser;
  return user;
}

function getLayoutRouteState(pathname: string, viewAsUserId?: string): LayoutRouteState {
  const isLibraryActive = pathname === '/app/library';
  const isCreateActive = pathname.startsWith('/app/create');
  const isTimeActive = pathname === '/app/study/time';
  return {
    createPath: pathForViewer('/app/create', viewAsUserId),
    isCreateActive,
    isFullWidthMobilePage: isLibraryActive || pathname === '/app/create',
    isLibraryActive,
    isStudyActive: pathname.startsWith('/app/study') && !isTimeActive,
    isTimeActive,
    libraryPath: pathForViewer('/app/library', viewAsUserId),
  };
}

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-cream">
    <div className="text-center">
      <div className="loading-spinner w-12 h-12 border-4 border-periwinkle border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-medium-brown">{message}</p>
    </div>
  </div>
);

const DemoBadge = ({ label, mobile = false }: { label: string; mobile?: boolean }) => {
  const className = mobile
    ? 'sm:hidden inline-flex mr-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full'
    : 'hidden sm:inline-flex ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full retro-caps';
  return <span className={className}>{label}</span>;
};

const ImpersonationBadge = ({ user, mobile = false }: { user: User; mobile?: boolean }) => {
  const className = mobile
    ? 'sm:hidden inline-flex mr-2 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-800 rounded-full items-center gap-1'
    : 'hidden sm:inline-flex ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full items-center gap-1';
  return (
    <span className={className}>
      <Eye className={mobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {mobile ? null : 'Viewing as: '}
      {user.displayName || user.name}
    </span>
  );
};

const DesktopNavigation = ({
  flashcardsEnabled,
  labels,
  route,
  viewAsUserId,
}: {
  flashcardsEnabled: boolean;
  labels: NavigationLabels;
  route: LayoutRouteState;
  viewAsUserId?: string;
}) => (
  <div className="hidden sm:ml-6 sm:flex h-[4.5rem] items-center gap-2">
    <Link
      to={route.libraryPath}
      className={`retro-nav-tab relative inline-flex items-center justify-center transition-all ${
        route.isLibraryActive
          ? 'is-active bg-white text-strawberry shadow-md'
          : 'text-white hover:bg-white/20'
      }`}
    >
      <Library className="w-5 h-5 mr-2.5 flex-shrink-0" />
      {labels.library}
    </Link>
    <Link
      to={route.createPath}
      className={`retro-nav-tab relative inline-flex items-center justify-center transition-all ${
        route.isCreateActive
          ? 'is-active bg-white text-coral shadow-md'
          : 'text-white hover:bg-white/20'
      }`}
    >
      <Mic className="w-5 h-5 mr-2.5 flex-shrink-0" />
      {labels.create}
    </Link>
    {flashcardsEnabled && !viewAsUserId ? (
      <Link
        to="/app/study"
        className={`retro-nav-tab relative inline-flex items-center justify-center transition-all ${
          route.isStudyActive
            ? 'is-active bg-white text-navy shadow-md'
            : 'text-white hover:bg-white/20'
        }`}
      >
        <BookOpen className="w-5 h-5 mr-2.5 flex-shrink-0" />
        {labels.study}
      </Link>
    ) : null}
    {!viewAsUserId ? (
      <Link
        to="/app/study/time"
        className={`retro-nav-tab relative inline-flex items-center justify-center transition-all ${
          route.isTimeActive
            ? 'is-active bg-white text-navy shadow-md'
            : 'text-white hover:bg-white/20'
        }`}
      >
        <Clock3 className="w-5 h-5 mr-2.5 flex-shrink-0" />
        {labels.studyTime}
      </Link>
    ) : null}
  </div>
);

const LayoutTopBar = ({
  demoLabel,
  effectiveUser,
  flashcardsEnabled,
  isDemo,
  isImpersonating,
  labels,
  menuUser,
  mobileNavItems,
  onLogout,
  route,
  viewAsUserId,
}: {
  demoLabel: string;
  effectiveUser: User | null;
  flashcardsEnabled: boolean;
  isDemo: boolean;
  isImpersonating: boolean;
  labels: NavigationLabels;
  menuUser: User;
  mobileNavItems: UserMenuMobileNavItem[];
  onLogout: () => void;
  route: LayoutRouteState;
  viewAsUserId?: string;
}) => {
  const showImpersonation = isImpersonating && effectiveUser;
  return (
    <nav className="sticky top-0 z-20 bg-periwinkle retro-topbar">
      <div className="max-w-7xl xl:max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-[4.5rem] items-center">
          <div className="flex items-center flex-1 min-w-0">
            <Link
              to={route.libraryPath}
              className="flex items-center gap-2 px-2 text-white font-bold text-lg sm:text-xl drop-shadow-md flex-shrink-0"
            >
              <Logo size="small" showKana showIcons={false} alwaysShowText />
            </Link>
            {isDemo ? <DemoBadge label={demoLabel} /> : null}
            {showImpersonation ? <ImpersonationBadge user={showImpersonation} /> : null}
            <DesktopNavigation
              flashcardsEnabled={flashcardsEnabled}
              labels={labels}
              route={route}
              viewAsUserId={viewAsUserId}
            />
          </div>
          <div className="flex items-center ml-2 gap-2">
            {isDemo ? <DemoBadge label={demoLabel} mobile /> : null}
            {showImpersonation ? <ImpersonationBadge user={showImpersonation} mobile /> : null}
            <UserMenu
              userName={menuUser.displayName || menuUser.name}
              avatarColor={menuUser.avatarColor}
              avatarUrl={menuUser.avatarUrl}
              userRole={menuUser.role}
              mobileNavItems={mobileNavItems}
              onLogout={onLogout}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};

const LayoutBody = ({
  isFullWidthMobilePage,
  isImpersonating,
  showMobileLearningDock,
  userId,
}: {
  isFullWidthMobilePage: boolean;
  isImpersonating: boolean;
  showMobileLearningDock: boolean;
  userId: User['id'];
}) => (
  <>
    <StudyActivityProvider key={String(userId)} userId={userId} enabled={!isImpersonating}>
      <main
        className={`max-w-7xl xl:max-w-[96rem] mx-auto pt-8 ${
          isFullWidthMobilePage ? 'sm:px-6 lg:px-8' : 'px-4 sm:px-6 lg:px-8'
        } ${showMobileLearningDock ? 'pb-28 sm:pb-8' : 'pb-8'}`}
      >
        <Outlet />
      </main>
      <ActiveStudyTimer />
    </StudyActivityProvider>
    {showMobileLearningDock ? <MobileLearningDock /> : null}
  </>
);

const Layout = () => {
  const { user, loading, logout } = useAuth();
  const { effectiveUser, isImpersonating } = useEffectiveUser();
  const { t } = useTranslation(['common']);
  const isDemo = useIsDemo();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const viewAsUserId = getViewAsUserId(searchParams);
  const route = getLayoutRouteState(location.pathname, viewAsUserId);
  const protectedReturnUrl = `${location.pathname}${location.search}${location.hash}`;
  const loginRedirect = `/login?${new URLSearchParams({
    returnUrl: protectedReturnUrl,
  }).toString()}`;

  useEffect(() => {
    if (shouldRedirectToLogin(loading, user)) {
      navigate(loginRedirect, { replace: true });
    }
  }, [loading, loginRedirect, navigate, user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const flashcardsEnabled = isFeatureEnabled('flashcardsEnabled');
  const showMobileLearningDock = shouldShowMobileLearningDock(
    flashcardsEnabled,
    viewAsUserId,
    isImpersonating
  );
  const labels = {
    create: t('common:nav.create'),
    library: t('common:nav.library'),
    study: t('common:nav.study'),
    studyTime: t('common:nav.studyTime'),
  };
  const mobileNavItems = useMemo<UserMenuMobileNavItem[]>(
    () => [
      {
        id: 'library',
        label: labels.library,
        path: route.libraryPath,
        isActive: route.isLibraryActive,
        icon: Library,
      },
      {
        id: 'create',
        label: labels.create,
        path: route.createPath,
        isActive: route.isCreateActive,
        icon: Mic,
      },
    ],
    [
      labels.create,
      labels.library,
      route.createPath,
      route.isCreateActive,
      route.isLibraryActive,
      route.libraryPath,
    ]
  );

  // Show loading spinner while checking authentication
  if (loading) {
    return <LoadingScreen message={t('common:loading')} />;
  }

  if (!user) {
    return null;
  }

  // Show onboarding modal if user hasn't completed it
  if (shouldShowOnboarding(user)) {
    return <OnboardingModal />;
  }

  const menuUser = getMenuUser(user, effectiveUser, isImpersonating);

  return (
    <div className="min-h-screen bg-cream retro-shell">
      <LayoutTopBar
        demoLabel={t('common:demoMode')}
        effectiveUser={effectiveUser}
        flashcardsEnabled={flashcardsEnabled}
        isDemo={isDemo}
        isImpersonating={isImpersonating}
        labels={labels}
        menuUser={menuUser}
        mobileNavItems={mobileNavItems}
        onLogout={handleLogout}
        route={route}
        viewAsUserId={viewAsUserId}
      />
      <LayoutBody
        isFullWidthMobilePage={route.isFullWidthMobilePage}
        isImpersonating={isImpersonating}
        showMobileLearningDock={showMobileLearningDock}
        userId={user.id}
      />
    </div>
  );
};

export default Layout;
