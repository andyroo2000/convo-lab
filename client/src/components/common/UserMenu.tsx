import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings, LogOut, Shield } from 'lucide-react';

interface UserMenuProps {
  userName: string;
  avatarColor?: string;
  avatarUrl?: string;
  userRole: 'user' | 'moderator' | 'admin' | 'demo';
  onLogout: () => void;
}

// Avatar color map for future use
// const AVATAR_COLOR_MAP: Record<string, { bg: string; text: string }> = {
//   indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
//   teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
//   purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
//   pink: { bg: 'bg-pink-100', text: 'text-pink-600' },
//   emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
//   amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
//   rose: { bg: 'bg-rose-100', text: 'text-rose-600' },
//   cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600' },
// };

const UserMenu = ({
  userName,
  avatarColor: _avatarColor = 'indigo',
  avatarUrl,
  userRole,
  onLogout,
}: UserMenuProps) => {
  const { t } = useTranslation('common');
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

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 border-2 border-[#bcc8c7] bg-[#f8f2df] shadow-[0_10px_0_rgba(17,51,92,0.12)] z-50 animate-fadeIn"
          style={{ top: '100%' }}
        >
          <div className="py-1">
            {/* Admin (only for admins) */}
            {userRole === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/app/admin');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#173b65] hover:bg-[#d4e5e6] transition-colors"
                data-testid="user-menu-item-admin"
              >
                <Shield className="w-4 h-4" />
                <span>{t('admin')}</span>
              </button>
            )}

            {/* Settings */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/app/settings');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#173b65] hover:bg-[#d4e5e6] transition-colors"
              data-testid="user-menu-item-settings"
            >
              <Settings className="w-4 h-4" />
              <span>{t('settings')}</span>
            </button>

            {/* Divider */}
            <div className="border-t border-[#bcc8c7] my-1" />

            {/* Logout */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#173b65] hover:bg-[#f4d7cf] hover:text-[#9e3920] transition-colors"
              data-testid="user-menu-item-logout"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('buttons.logout')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
