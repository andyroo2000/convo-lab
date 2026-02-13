import { Link, Outlet } from 'react-router-dom';

import Logo from './Logo';

const ToolsPublicLayout = () => (
  <div className="min-h-screen bg-cream retro-shell">
    <nav className="sticky top-0 z-20 bg-periwinkle retro-topbar">
      <div className="max-w-7xl xl:max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-[4.5rem] items-center">
          <Link
            to="/tools"
            className="flex items-center gap-2 px-2 text-white font-bold text-lg sm:text-xl drop-shadow-md"
          >
            <Logo
              size="small"
              showKana
              showIcons={false}
              wordmarkText="CONVOLAB TOOLS"
              kanaText="コンボラボ・ツールズ"
            />
          </Link>
        </div>
      </div>
    </nav>

    <main className="max-w-7xl xl:max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Outlet />
    </main>
  </div>
);

export default ToolsPublicLayout;
