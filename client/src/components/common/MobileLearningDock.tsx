import { BookOpen, Clock3, Files, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

const MobileLearningDock = () => {
  const { t } = useTranslation('common');
  const location = useLocation();
  const { pathname } = location;
  const { isFeatureEnabled } = useFeatureFlags();
  const isCardsActive = [
    '/app/study/cards',
    '/app/study/browse',
    '/app/study/import',
    '/app/study/create',
  ].some((path) => pathname.startsWith(path));

  const items = [
    {
      id: 'study',
      label: t('nav.study'),
      path: '/app/study',
      icon: BookOpen,
      active: ['/app/study', '/app/study/daily-audio'].includes(pathname),
    },
    {
      id: 'cards',
      label: t('nav.cards'),
      path: '/app/study/cards',
      icon: Files,
      active: isCardsActive,
    },
    {
      id: 'time',
      label: t('nav.time'),
      path: '/app/study/time',
      icon: Clock3,
      active: pathname.startsWith('/app/study/time'),
    },
    {
      id: 'settings',
      label: t('settings'),
      path: '/app/settings',
      icon: Settings,
      active: pathname.startsWith('/app/settings') || pathname.startsWith('/app/study/settings'),
    },
  ];

  return (
    <nav
      aria-label={t('nav.learning')}
      className="mobile-learning-dock sm:hidden"
      data-testid="mobile-learning-dock"
    >
      <div className="mobile-learning-dock-inner">
        {items
          .filter((item) => item.id !== 'time' || isFeatureEnabled('studyTimeEnabled'))
          .map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                to={item.path}
                state={item.id === 'settings' ? { backgroundLocation: location } : undefined}
                aria-current={item.active ? 'page' : undefined}
                className="mobile-learning-dock-link"
                data-testid={`mobile-learning-dock-${item.id}`}
              >
                <span className="mobile-learning-dock-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
      </div>
    </nav>
  );
};

export default MobileLearningDock;
