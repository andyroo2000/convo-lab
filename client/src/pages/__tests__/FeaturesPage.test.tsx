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
        name: 'Code smells were only half the story.',
      })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#two-kinds-of-review');
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
    expect(screen.getByLabelText('Recreated goal-driven agent exchange')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Okay, I'd like for us to address the recommendations in a series of well-scoped PRs that should only be merged if they increase the score. Our goal is to get to at least 9.25 while prioritizing hotspot health over squeezing the aggregate score higher"
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/I'm continuing with the next hotspot slice:/)).toHaveTextContent(
      "I'll keep it behavior-preserving"
    );
    expect(screen.queryByText(/The second slice clears the local gate/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PR #548 is open/)).not.toBeInTheDocument();
    expect(screen.queryByText('2.62 → 2.79')).not.toBeInTheDocument();
    expect(screen.queryByText('Codex')).not.toBeInTheDocument();
  });

  it('opens the agent result and merge-gate slide directly', () => {
    window.history.replaceState(null, '', '/features#goal-results-and-merge-gate');

    render(<FeaturesPage />);

    expect(
      screen.getByRole('heading', { name: 'Progress was reported. The merge still waited.' })
    ).toBeInTheDocument();
    expect(screen.getByText(/The second slice clears the local gate/)).toHaveTextContent(
      'both new achievement modules score 10.0'
    );
    expect(screen.getByText(/PR #548 is open/)).toHaveTextContent(
      "I'm waiting for the independent CodeScene and review checks before any merge"
    );
    expect(screen.getByText('2.62 → 2.79')).toBeInTheDocument();
  });

  it('opens the pull-request evidence slide directly', () => {
    window.history.replaceState(null, '', '/features#pr-review-evidence');

    render(<FeaturesPage />);

    expect(
      screen.getByRole('heading', { name: 'The pull request had to show its work.' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Pull request diff with CodeScene comments/i })
    ).toBeInTheDocument();
    expect(screen.getByText('10 → 9')).toBeInTheDocument();
    expect(screen.getByText('232 → 219')).toBeInTheDocument();
  });

  it('opens the second-review-layer slide directly', () => {
    window.history.replaceState(null, '', '/features#two-kinds-of-review');

    render(<FeaturesPage />);

    expect(
      screen.getByRole('heading', { name: 'Code smells were only half the story.' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Claude review bot comment examining the behavior/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Behavior and logic')).toBeInTheDocument();
    expect(screen.getByText('Subtle bugs and race conditions')).toBeInTheDocument();
    expect(screen.getByText('Missing test coverage')).toBeInTheDocument();
  });
});
