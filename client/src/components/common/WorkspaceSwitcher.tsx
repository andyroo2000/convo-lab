import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { UserMenuMobileNavItem } from './UserMenu';

function useWorkspaceDisclosure() {
  const details = useRef<HTMLDetailsElement>(null);
  const location = useLocation();
  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [location.key]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node))
        details.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.current?.open) return;
      details.current.open = false;
      details.current.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return details;
}

const WorkspaceSwitcher = ({ items }: { items: UserMenuMobileNavItem[] }) => {
  const details = useWorkspaceDisclosure();
  if (!items.length) return null;
  const active = items.find((item) => item.isActive)?.label ?? 'Workspace';
  return (
    <details className="workspace-switcher" ref={details}>
      <summary aria-label={`Switch section, ${active}`}>
        {active}
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="workspace-options">
        {items.map(({ id, label, path, isActive, icon: Icon }) => (
          <Link key={id} to={path} aria-current={isActive ? 'page' : undefined}>
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
    </details>
  );
};
export default WorkspaceSwitcher;
