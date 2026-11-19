import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookOpen, Clock, Settings } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import WorkspaceSwitcher from '../WorkspaceSwitcher';

const journal = {
  id: 'journal',
  label: 'Journal',
  path: '/app/journal',
  isActive: true,
  icon: BookOpen,
};
const settings = {
  id: 'settings',
  label: 'Settings',
  path: '/app/settings',
  isActive: false,
  icon: Settings,
};
const time = { id: 'time', label: 'Time', path: '/app/study/time', isActive: false, icon: Clock };

describe('Soft Paper workspace navigation', () => {
  it('keeps a journal-only account out of a single-item dropdown', () => {
    render(
      <MemoryRouter>
        <WorkspaceSwitcher items={[journal, settings]} />
      </MemoryRouter>
    );
    expect(screen.queryByRole('group', { name: 'Workspace navigation' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Journal' })).toHaveAttribute('href', '/app/journal');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('groups enabled destinations and closes on Escape and outside clicks', () => {
    render(
      <MemoryRouter>
        <WorkspaceSwitcher items={[journal, time, settings]} />
      </MemoryRouter>
    );
    const disclosure = screen.getByRole('group', {
      name: 'Workspace navigation',
    }) as HTMLDetailsElement;
    disclosure.open = true;
    expect(screen.getByRole('region', { name: 'Practice' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Manage' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Journal' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(disclosure.open).toBe(false);
    disclosure.open = true;
    fireEvent.pointerDown(document.body);
    expect(disclosure.open).toBe(false);
  });
});
