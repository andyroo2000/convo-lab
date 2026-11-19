import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings, LogOut, Shield } from 'lucide-react';
import type { UserMenuMobileNavItem } from './UserMenu';

const itemClass =
  'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#173b65] hover:bg-[#d4e5e6] transition-colors';

const UserMenuItems = ({
  userRole,
  mobileNavItems,
  close,
  navigate,
  logout,
}: {
  userRole: string;
  mobileNavItems: UserMenuMobileNavItem[];
  close: () => void;
  navigate: (path: string) => void;
  logout: () => void;
}) => {
  const { t } = useTranslation('common');
  const destinations = [
    ...(userRole === 'admin'
      ? [{ id: 'admin', path: '/app/admin', label: t('admin'), icon: Shield }]
      : []),
    { id: 'settings', path: '/app/settings', label: t('settings'), icon: Settings },
  ];
  return (
    <>
      {mobileNavItems.length > 0 && (
        <div className="border-b border-[#bcc8c7] pb-1 sm:hidden">
          {mobileNavItems.map(({ id, label, path, isActive, icon: Icon }) => (
            <Link
              key={id}
              to={path}
              onClick={close}
              data-testid={`user-menu-mobile-nav-${id}`}
              className={`${itemClass} ${isActive ? 'bg-[#d4e5e6] font-semibold text-[#11335c]' : ''}`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      )}
      {destinations.map(({ id, path, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={itemClass}
          data-testid={`user-menu-item-${id}`}
          onClick={() => {
            close();
            navigate(path);
          }}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </button>
      ))}
      <div className="border-t border-[#bcc8c7] my-1" />
      <button
        type="button"
        data-testid="user-menu-item-logout"
        className={`${itemClass} hover:bg-[#f4d7cf] hover:text-[#9e3920]`}
        onClick={() => {
          close();
          logout();
        }}
      >
        <LogOut className="w-4 h-4" />
        <span>{t('buttons.logout')}</span>
      </button>
    </>
  );
};
export default UserMenuItems;
