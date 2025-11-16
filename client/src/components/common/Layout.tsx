import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Library, Mic, Play } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-soft-sand">
      <nav className="sticky top-0 z-20 bg-white border-b border-warm-gray shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/library" className="flex items-center px-4 text-navy font-bold text-xl">
                LanguageFlow Studio
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                <Link
                  to="/library"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-navy hover:text-indigo transition-colors"
                >
                  <Library className="w-4 h-4 mr-2" />
                  Library
                </Link>
                <Link
                  to="/studio"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-navy hover:text-indigo transition-colors"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Create
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.name}</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-navy transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
