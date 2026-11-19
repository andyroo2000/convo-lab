import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import UserMenuItems from './UserMenuItems';

export interface UserMenuMobileNavItem {
  id: string;
  label: string;
  path: string;
  isActive: boolean;
  icon: LucideIcon;
}

interface UserMenuProps {
  userName: string;
  avatarColor?: string;
  avatarUrl?: string;
  userRole: 'user' | 'moderator' | 'admin' | 'demo';
  mobileNavItems?: UserMenuMobileNavItem[];
  onLogout: () => void;
  journalSettings?: ReactNode;
}

const UserMenu = ({
  userName,
  avatarColor: _avatarColor = 'indigo',
  avatarUrl,
  userRole,
  mobileNavItems = [],
  onLogout,
  journalSettings,
}: UserMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Color scheme for future use - currently using direct avatarColor
  // const colorScheme = AVATAR_COLOR_MAP[avatarColor] || AVATAR_COLOR_MAP.indigo;
  const userInitial = userName.charAt(0).toUpperCase();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Close on ESC key
    function handleEscKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
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

  return (
    <div className="relative" ref={menuRef}>
      {/* User Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="retro-user-pill hover:bg-[#1296bf]/70 transition-colors"
        data-testid="user-menu-button"
        aria-label="Account menu"
        aria-expanded={isOpen}
      >
        {avatarUrl ? (
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#f6f2df]">
            <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-9 h-9 bg-[#f6f2df] rounded-full flex items-center justify-center">
            <span className="retro-caps text-xl font-bold text-[#173b65]">{userInitial}</span>
          </div>
        )}
      </button>

      {(isOpen || journalSettings) && (
        <div className="workspace-account-menu" hidden={!isOpen}>
          {journalSettings}
          {isOpen && (
            <UserMenuItems
              userRole={userRole}
              mobileNavItems={mobileNavItems}
              close={() => setIsOpen(false)}
              navigate={navigate}
              logout={onLogout}
            />
          )}
        </div>
      )}
    </div>
  );
};
export default UserMenu;
