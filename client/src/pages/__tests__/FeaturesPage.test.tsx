import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FeaturesPage from '../FeaturesPage';

vi.mock('../../components/common/Logo', () => ({
  default: () => <div data-testid="logo">ConvoLab</div>,
}));

describe('FeaturesPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/features');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('moves through the editorial deck with the controls', () => {
    render(<FeaturesPage />);

    expect(
      screen.getByRole('heading', { name: 'I was using too many separate apps.' })
    ).toBeInTheDocument();
    expect(screen.getByText('Time tracker')).toBeInTheDocument();
    expect(screen.getByText('Anki replacement')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /original JLPT N3 Study Tracker/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /original ConvoLab dialogue generator/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next feature' }));

    expect(
      screen.getByRole('heading', { name: 'Every part should know what I know.' })
    ).toBeInTheDocument();
    expect(screen.getByText('Kanji knowledge')).toBeInTheDocument();
    expect(window.location.hash).toBe('#shared-context');
  });

  it('supports presentation keyboard navigation', () => {
    render(<FeaturesPage />);

    fireEvent.keyDown(window, { key: 'End' });

    expect(
      screen.getByRole('heading', { name: 'Then the agents started reviewing each other.' })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#how-it-was-built');
  });

  it('opens a directly linked feature', () => {
    window.history.replaceState(null, '', '/features#wanikani');

    render(<FeaturesPage />);

    expect(
      screen.getByRole('heading', { name: 'Your known kanji come with you.' })
    ).toBeInTheDocument();
    expect(screen.getByText('WaniKani connected')).toBeInTheDocument();
  });
});
