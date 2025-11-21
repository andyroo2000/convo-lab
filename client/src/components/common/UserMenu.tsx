import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown, Shield } from 'lucide-react';

interface UserMenuProps {
  userName: string;
  avatarColor?: string;
  avatarUrl?: string;
  role: 'user' | 'moderator' | 'admin';
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

export default function UserMenu({ userName, avatarColor = 'indigo', avatarUrl, role, onLogout }: UserMenuProps) {
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
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-navy transition-colors rounded-lg hover:bg-gray-50"
      >
        {avatarUrl ? (
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200">
            <img
              src={avatarUrl}
              alt={userName}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={`w-8 h-8 ${colorScheme.bg} rounded-full flex items-center justify-center`}>
            <span className={`text-sm font-medium ${colorScheme.text}`}>
              {userInitial}
            </span>
          </div>
        )}
        <span>{userName}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
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
              >
                <Shield className="w-4 h-4" />
                <span>Admin</span>
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/app/settings');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
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
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
