import { NotebookPen } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const JournalNav = ({ disabled }: { disabled: boolean }) => {
  if (disabled) return null;
  return (
    <NavLink
      to="/app/journal"
      className={({ isActive }) =>
        `retro-nav-tab relative inline-flex items-center justify-center transition-all ${isActive ? 'is-active bg-white text-navy shadow-md' : 'text-white hover:bg-white/20'}`
      }
    >
      <NotebookPen className="mr-2.5 h-5 w-5 shrink-0" aria-hidden="true" />
      Journal
    </NavLink>
  );
};

export default JournalNav;
