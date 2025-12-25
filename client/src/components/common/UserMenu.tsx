import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Settings, LogOut, ChevronDown, Shield } from 'lucide-react';

interface UserMenuProps {
  userName: string;
  avatarColor?: string;
  avatarUrl?: string;
  role: 'user' | 'moderator' | 'admin' | 'demo';
  onLogout: () => void;
}

const AVATAR_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600' },
};

export default function UserMenu({
  userName,
  avatarColor = 'indigo',
  avatarUrl,
  role,
  onLogout,
}: UserMenuProps) {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const colorScheme = AVATAR_COLOR_MAP[avatarColor] || AVATAR_COLOR_MAP.indigo;
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
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 text-sm font-bold text-white hover:bg-white/20 transition-colors rounded-lg"
        data-testid="user-menu-button"
      >
        {avatarUrl ? (
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
            <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-periwinkle">{userInitial}</span>
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30 animate-fadeIn"
          style={{ top: '100%' }}
        >
          <div className="py-1">
            {/* Admin (only for admins) */}
            {role === 'admin' && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/app/admin');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                data-testid="user-menu-item-admin"
              >
                <Shield className="w-4 h-4" />
                <span>{t('admin')}</span>
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/app/settings');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              data-testid="user-menu-item-settings"
            >
              <Settings className="w-4 h-4" />
              <span>{t('settings')}</span>
            </button>

            {/* Divider */}
            <div className="border-t border-gray-200 my-1" />

            {/* Logout */}
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600 transition-colors"
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
}
