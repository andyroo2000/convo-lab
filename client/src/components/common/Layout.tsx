import { useContext, useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, BookOpen, BookMarked, Clock3, NotebookPen } from 'lucide-react';
import useReadings from '../../features/readings/useReadings';
import { useAuth } from '../../contexts/AuthContext';
import { useIsDemo } from '../../hooks/useDemo';
import useEffectiveUser from '../../hooks/useEffectiveUser';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import UserMenu, { type UserMenuMobileNavItem } from './UserMenu';
import JournalBrand from './JournalBrand';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import JournalNavigationContext from '../../features/journal/JournalNavigationContext';
import JournalNavigationProvider from '../../features/journal/JournalNavigationProvider';
import './workspaceNavigation.css';
import OnboardingModal from '../onboarding/OnboardingModal';
import { SHOW_ONBOARDING_WELCOME } from '../../config';
import { StudyActivityProvider } from '../../contexts/StudyActivityContext';
import ActiveStudyTimer from '../study/ActiveStudyTimer';
import MobileLearningDock from './MobileLearningDock';
import type { User } from '../../types';

type LayoutRouteState = {
  isStudyActive: boolean;
  isTimeActive: boolean;
};

function getViewAsUserId(searchParams: URLSearchParams) {
  return searchParams.get('viewAs') || undefined;
}

function shouldRedirectToLogin(loading: boolean, user: User | null) {
  return !loading && !user;
}

function shouldShowOnboarding(user: User, dismissedUser: User['id'] | null) {
  if (dismissedUser === user.id) return false;
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

function getLayoutRouteState(pathname: string): LayoutRouteState {
  const isTimeActive = pathname === '/app/study/time';
  return {
    isStudyActive: pathname.startsWith('/app/study') && !isTimeActive,
    isTimeActive,
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

const SessionBadges = ({
  demoLabel,
  isDemo,
  impersonated,
  mobile = false,
}: {
  demoLabel: string;
  isDemo: boolean;
  impersonated: User | null | false;
  mobile?: boolean;
}) => (
  <>
    {isDemo && <DemoBadge label={demoLabel} mobile={mobile} />}
    {impersonated && <ImpersonationBadge user={impersonated} mobile={mobile} />}
  </>
);

const LayoutTopBar = ({
  demoLabel,
  effectiveUser,
  isDemo,
  isImpersonating,
  menuUser,
  mobileNavItems,
  onLogout,
  viewAsUserId,
}: {
  demoLabel: string;
  effectiveUser: User | null;
  isDemo: boolean;
  isImpersonating: boolean;
  menuUser: User;
  mobileNavItems: UserMenuMobileNavItem[];
  onLogout: () => void;
  viewAsUserId?: string;
}) => {
  const { t } = useTranslation('common');
  const showImpersonation = isImpersonating && effectiveUser;
  const location = useLocation();
  const journal = location.pathname.startsWith('/app/journal') && !viewAsUserId;
  const slots = useContext(JournalNavigationContext);
  return (
    <nav className="sticky top-0 z-20 journal-topbar">
      <div className="workspace-nav-inner">
        <div className="flex h-[4.5rem] items-center">
          <div className="flex items-center flex-1 min-w-0">
            <Link
              to="/app/journal"
              className="journal-header-home"
              aria-label={t('journalBrand.home')}
            >
              <JournalBrand compact />
            </Link>
            <SessionBadges demoLabel={demoLabel} isDemo={isDemo} impersonated={showImpersonation} />
            <WorkspaceSwitcher items={mobileNavItems} />
            {journal && <div ref={slots.setContents} className="workspace-contents" />}
          </div>
          <div className="flex items-center ml-2 gap-2">
            <SessionBadges
              demoLabel={demoLabel}
              isDemo={isDemo}
              impersonated={showImpersonation}
              mobile
            />
            <UserMenu
              userName={menuUser.displayName || menuUser.name}
              userRole={menuUser.role}
              journalSettings={journal ? <div ref={slots.setSettings} /> : undefined}
              onLogout={onLogout}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};

const LayoutBody = ({
  isImpersonating,
  showMobileLearningDock,
  userId,
}: {
  isImpersonating: boolean;
  showMobileLearningDock: boolean;
  userId: User['id'];
}) => (
  <>
    <StudyActivityProvider key={String(userId)} userId={userId} enabled={!isImpersonating}>
      <main
        className={`max-w-7xl xl:max-w-[96rem] mx-auto pt-8 px-4 sm:px-6 lg:px-8 ${showMobileLearningDock ? 'pb-28 sm:pb-8' : 'pb-8'}`}
      >
        <Outlet />
      </main>
      <ActiveStudyTimer />
    </StudyActivityProvider>
    {showMobileLearningDock ? <MobileLearningDock /> : null}
  </>
);

const useVisibleReadings = (viewAsUserId: string | undefined, enabled: boolean): boolean => {
  const readings = useReadings(!viewAsUserId && enabled);
  return enabled && !viewAsUserId && Boolean(readings.data?.length);
};

function getWorkspaceItems({
  flashcardsEnabled,
  viewAsUserId,
  labels,
  route,
  isJournalActive,
  hasReadings,
  isReadingsActive,
  studyTimeEnabled,
}: {
  flashcardsEnabled: boolean;
  viewAsUserId?: string;
  labels: { study: string; studyTime: string };
  route: LayoutRouteState;
  isJournalActive: boolean;
  hasReadings: boolean;
  isReadingsActive: boolean;
  studyTimeEnabled: boolean;
}): UserMenuMobileNavItem[] {
  return [
    ...(flashcardsEnabled && !viewAsUserId
      ? [
          {
            id: 'study',
            label: labels.study,
            path: '/app/study',
            isActive: route.isStudyActive,
            icon: BookOpen,
          },
        ]
      : []),
    ...(!viewAsUserId
      ? [
          {
            id: 'journal',
            label: 'Journal',
            path: '/app/journal',
            isActive: isJournalActive,
            icon: NotebookPen,
          },
        ]
      : []),
    ...(hasReadings
      ? [
          {
            id: 'readings',
            label: 'Readings',
            path: '/app/readings',
            isActive: isReadingsActive,
            icon: BookMarked,
          },
        ]
      : []),
    ...(!viewAsUserId && studyTimeEnabled
      ? [
          {
            id: 'time',
            label: labels.studyTime,
            path: '/app/study/time',
            isActive: route.isTimeActive,
            icon: Clock3,
          },
        ]
      : []),
  ];
}

const Layout = () => {
  const [signingOut, setSigningOut] = useState(false);
  const [dismissedOnboardingUser, setDismissedOnboardingUser] = useState<User['id'] | null>(null);
  const { user, loading, logout } = useAuth();
  const { effectiveUser, isImpersonating } = useEffectiveUser();
  const { t } = useTranslation(['common']);
  const isDemo = useIsDemo();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const viewAsUserId = getViewAsUserId(searchParams);
  const readingsEnabled = isFeatureEnabled('readingsEnabled');
  const hasReadings = useVisibleReadings(viewAsUserId, readingsEnabled);
  const isJournalActive = location.pathname.startsWith('/app/journal');
  const isReadingsActive = location.pathname.startsWith('/app/readings');
  const route = getLayoutRouteState(location.pathname);
  const protectedReturnUrl = `${location.pathname}${location.search}${location.hash}`;
  const loginRedirect = `/login?${new URLSearchParams({
    returnUrl: protectedReturnUrl,
  }).toString()}`;

  useEffect(() => {
    if (shouldRedirectToLogin(loading, user)) {
      navigate(signingOut ? '/login' : loginRedirect, { replace: true });
    }
  }, [loading, loginRedirect, navigate, signingOut, user]);

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
  };

  const flashcardsEnabled = isFeatureEnabled('flashcardsEnabled');
  const showMobileLearningDock = shouldShowMobileLearningDock(
    flashcardsEnabled,
    viewAsUserId,
    isImpersonating
  );
  const labels = {
    study: t('common:nav.study'),
    studyTime: t('common:nav.studyTime'),
  };
  const mobileNavItems = getWorkspaceItems({
    flashcardsEnabled,
    viewAsUserId,
    labels,
    route,
    isJournalActive,
    hasReadings,
    isReadingsActive,
    studyTimeEnabled: isFeatureEnabled('studyTimeEnabled'),
  });

  // Show loading spinner while checking authentication
  if (loading) {
    return <LoadingScreen message={t('common:loading')} />;
  }

  if (!user) {
    return null;
  }

  // Show onboarding modal if user hasn't completed it
  if (shouldShowOnboarding(user, dismissedOnboardingUser)) {
    return <OnboardingModal onClose={() => setDismissedOnboardingUser(user.id)} />;
  }

  const menuUser = getMenuUser(user, effectiveUser, isImpersonating);

  return (
    <JournalNavigationProvider>
      <div className="min-h-screen bg-cream retro-shell">
        <LayoutTopBar
          demoLabel={t('common:demoMode')}
          effectiveUser={effectiveUser}
          isDemo={isDemo}
          isImpersonating={isImpersonating}
          menuUser={menuUser}
          mobileNavItems={mobileNavItems}
          onLogout={handleLogout}
          viewAsUserId={viewAsUserId}
        />
        <LayoutBody
          isImpersonating={isImpersonating}
          showMobileLearningDock={showMobileLearningDock}
          userId={user.id}
        />
      </div>
    </JournalNavigationProvider>
  );
};

export default Layout;
