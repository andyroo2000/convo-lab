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
      screen.getByRole('heading', { name: 'Great apps. Separate memories.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /JLPT N3 Study Tracker/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /AI Card Maker/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Dialogue Generator/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next feature' }));

    expect(
      screen.getByRole('heading', { name: 'I started with the easiest gap.' })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#the-first-gap');
  });

  it('supports presentation keyboard navigation', () => {
    render(<FeaturesPage />);

    fireEvent.keyDown(window, { key: 'End' });

    expect(
      screen.getByRole('heading', {
        name: 'The review loop helped. It did not make the code perfect.',
      })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#code-health-reality-check');
  });

  it('opens a directly linked feature', () => {
    window.history.replaceState(null, '', '/features#wanikani');

    render(<FeaturesPage />);

    expect(
      screen.getByRole('heading', { name: 'Your known kanji come with you.' })
    ).toBeInTheDocument();
    expect(screen.getByText('WaniKani connected')).toBeInTheDocument();
  });

  it('opens the narrative problem slide directly', () => {
    window.history.replaceState(null, '', '/features#the-silo-problem');

    render(<FeaturesPage />);

    expect(
      screen.getByRole('heading', { name: 'Every app had its own version of me.' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('Isolated')).toHaveLength(4);
  });

  it('opens the CodeScene reality check directly', () => {
    window.history.replaceState(null, '', '/features#code-health-reality-check');

    render(<FeaturesPage />);

    expect(
      screen.getByRole('heading', {
        name: 'The review loop helped. It did not make the code perfect.',
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/^8\.6/)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /CodeScene analysis of ConvoLab/i })
    ).toBeInTheDocument();
  });
});
