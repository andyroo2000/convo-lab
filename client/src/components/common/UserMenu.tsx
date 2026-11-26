import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import UserMenuItems from './UserMenuItems';
import JournalAccountAvatar from './JournalAccountAvatar';

export interface UserMenuMobileNavItem {
  id: string;
  label: string;
  path: string;
  isActive: boolean;
  icon: LucideIcon;
}

interface UserMenuProps {
  userName: string;
  userRole: 'user' | 'moderator' | 'admin' | 'demo';
  mobileNavItems?: UserMenuMobileNavItem[];
  onLogout: () => void;
  journalSettings?: ReactNode;
}

function useAccountMenuDisclosure() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (document.querySelector('dialog[open]')) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Close on ESC key
    function handleEscKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        menuRef.current?.querySelector('button')?.focus();
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscKey);
      };
    }
    return undefined;
  }, [isOpen]);

  return { isOpen, setIsOpen, menuRef };
}

const UserMenu = ({
  userName,
  userRole,
  mobileNavItems = [],
  onLogout,
  journalSettings,
}: UserMenuProps) => {
  const { isOpen, setIsOpen, menuRef } = useAccountMenuDisclosure();
  const navigate = useNavigate();
  const location = useLocation();
  const navigateFromMenu = (path: string) => {
    if (path === '/app/settings' || path === '/app/settings/study') {
      menuRef.current?.querySelector('button')?.focus();
      navigate(path, { state: { backgroundLocation: location } });
      return;
    }
    navigate(path);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* User Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="journal-account-trigger"
        data-testid="user-menu-button"
        aria-label="Account menu"
        aria-expanded={isOpen}
      >
        <JournalAccountAvatar name={userName} />
      </button>

      {(isOpen || journalSettings) && (
        <div className="workspace-account-menu" hidden={!isOpen}>
          {journalSettings}
          {isOpen && (
            <UserMenuItems
              userRole={userRole}
              mobileNavItems={mobileNavItems}
              close={() => setIsOpen(false)}
              navigate={navigateFromMenu}
              logout={onLogout}
            />
          )}
        </div>
      )}
    </div>
  );
};
export default UserMenu;
