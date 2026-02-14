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
            <div className="sm:hidden flex flex-col leading-none">
              <span className="retro-logo-wordmark text-[1.45rem] text-[#f4f3df]">
                CONVOLAB TOOLS
              </span>
              <span className="retro-logo-kana mt-0.5 text-[0.72rem] text-[#f4f3df]">
                コンボラボ・ツールズ
              </span>
            </div>
            <Logo
              size="small"
              showKana
              showIcons={false}
              wordmarkText="CONVOLAB TOOLS"
              kanaText="コンボラボ・ツールズ"
              className="hidden sm:flex"
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
