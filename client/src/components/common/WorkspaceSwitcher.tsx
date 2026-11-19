import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
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

const WorkspaceGroup = ({ title, items }: { title: string; items: UserMenuMobileNavItem[] }) => {
  if (!items.length) return null;
  return (
    <section className="workspace-group" aria-label={title}>
      <h2>{title}</h2>
      {items.map(({ id, label, path, isActive, icon: Icon }) => (
        <Link key={id} to={path} aria-current={isActive ? 'page' : undefined}>
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
          {isActive && <Check size={16} aria-hidden="true" className="workspace-check" />}
        </Link>
      ))}
    </section>
  );
};

const WorkspaceSwitcher = ({ items }: { items: UserMenuMobileNavItem[] }) => {
  const details = useWorkspaceDisclosure();
  const destinations = items.filter((item) => item.id !== 'settings');
  if (!destinations.length) return null;
  if (destinations.length === 1) {
    const item = destinations[0];
    return (
      <div className="workspace-switcher">
        <Link className="workspace-single" to={item.path}>
          {item.label}
        </Link>
      </div>
    );
  }
  const active = destinations.find((item) => item.isActive)?.label ?? 'Workspace';
  const isManage = (item: UserMenuMobileNavItem) => ['cards', 'time'].includes(item.id);
  return (
    <details className="workspace-switcher" ref={details} aria-label="Workspace navigation">
      <summary aria-label={`${active}, switch section`}>
        {active}
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="workspace-options">
        <WorkspaceGroup title="Practice" items={destinations.filter((item) => !isManage(item))} />
        <WorkspaceGroup title="Manage" items={destinations.filter(isManage)} />
      </div>
    </details>
  );
};
export default WorkspaceSwitcher;
