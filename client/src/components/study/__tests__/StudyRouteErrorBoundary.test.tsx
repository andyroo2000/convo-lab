import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StudyRouteErrorBoundary from '../StudyRouteErrorBoundary';

describe('StudyRouteErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('remounts the study route when retry is clicked', () => {
    let shouldThrow = true;

    const FlakyStudyView = () => {
      if (shouldThrow) {
        throw new Error('Study exploded');
      }

      return <p>Recovered study view</p>;
    };

    render(
      <StudyRouteErrorBoundary onBackToStudy={vi.fn()}>
        <FlakyStudyView />
      </StudyRouteErrorBoundary>
    );

    expect(screen.getByText('Study hit a snag')).toBeInTheDocument();
    expect(screen.getByText('Study exploded')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Recovered study view')).toBeInTheDocument();
  });

  it('routes back to the study dashboard when requested', () => {
    const onBackToStudy = vi.fn();

    const BrokenStudyView = () => {
      throw new Error('Broken study route');
    };

    render(
      <StudyRouteErrorBoundary onBackToStudy={onBackToStudy}>
        <BrokenStudyView />
      </StudyRouteErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to Study' }));

    expect(onBackToStudy).toHaveBeenCalledTimes(1);
  });
});
