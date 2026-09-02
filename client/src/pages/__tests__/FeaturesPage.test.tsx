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
    expect(screen.getByText('Anki')).toBeInTheDocument();
    expect(screen.getByText('WaniKani')).toBeInTheDocument();
    expect(screen.getByText('Bunpro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next feature' }));

    expect(
      screen.getByRole('heading', { name: 'Then I started making the missing pieces.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /JLPT N3 Study Tracker/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /AI Card Maker/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Dialogue Generator/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#little-apps-for-the-gaps');
  });

  it('supports presentation keyboard navigation', () => {
    render(<FeaturesPage />);

    fireEvent.keyDown(window, { key: 'End' });

    expect(
      screen.getByRole('heading', {
        name: 'A persistent goal kept the constraint alive.',
      })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#goal-driven-refactors');
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

  it('includes the exact code-health prompt as presentation copy', () => {
    window.history.replaceState(null, '', '/features#the-code-health-prompt');

    render(<FeaturesPage />);

    expect(
      screen.getByText(
        /Okay, I'd like for us to address the recommendations in a series of well-scoped PRs/
      )
    ).toHaveTextContent(
      "Okay, I'd like for us to address the recommendations in a series of well-scoped PRs that should only be merged if they increase the score. Our goal is to get to at least 9.25 while prioritizing hotspot health over squeezing the aggregate score higher"
    );
    expect(screen.getByText('Hotspot health first')).toBeInTheDocument();
  });

  it('opens the brand-neutral Goal progress slide directly', () => {
    window.history.replaceState(null, '', '/features#goal-driven-refactors');

    render(<FeaturesPage />);

    expect(
      screen.getByRole('heading', { name: 'A persistent goal kept the constraint alive.' })
    ).toBeInTheDocument();
    expect(screen.getByText('2.62 → 2.79')).toBeInTheDocument();
    expect(screen.getByLabelText('Recreated goal-driven agent exchange')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.queryByText('Codex')).not.toBeInTheDocument();
  });
});
