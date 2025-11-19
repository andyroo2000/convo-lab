import { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';

interface UserMenuProps {
  userName: string;
  onLogout: () => void;
}

export default function UserMenu({ userName, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-indigo-600" />
        </div>
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
            {/* Settings - Placeholder for future */}
            <button
              onClick={() => {
                setIsOpen(false);
                // TODO: Navigate to settings page when implemented
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              disabled
            >
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="text-gray-400">Settings (Coming Soon)</span>
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
