import { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyFeatureBoundary from '../StudyFeatureBoundary';

const { featureState, refetchMock, studyActionMock, studyFetchMock } = vi.hoisted(() => ({
  featureState: {
    enabled: false,
    error: null as Error | null,
    status: 'loading' as 'loading' | 'ready' | 'error' | 'adminOverride',
  },
  refetchMock: vi.fn(),
  studyActionMock: vi.fn(),
  studyFetchMock: vi.fn(),
}));

vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    error: featureState.error,
    isFeatureEnabled: () => featureState.enabled,
    refetch: refetchMock,
    status: featureState.status,
  }),
}));

const StudyProbe = () => {
  useEffect(() => {
    studyFetchMock('/api/study/overview');
    studyActionMock();
  }, []);

  return <div>Study mounted</div>;
};

const renderBoundary = () =>
  render(
    <MemoryRouter initialEntries={['/app/study']}>
      <Routes>
        <Route path="/app/study" element={<StudyFeatureBoundary />}>
          <Route index element={<StudyProbe />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('StudyFeatureBoundary', () => {
  beforeEach(() => {
    featureState.enabled = false;
    featureState.error = null;
    featureState.status = 'loading';
    refetchMock.mockReset();
    studyActionMock.mockReset();
    studyFetchMock.mockReset();
  });

  it.each([
    ['loading', null, 'Checking Study availability…'],
    ['error', new Error('Unavailable'), 'Study availability could not be confirmed.'],
    ['ready', null, 'Study is currently disabled for this environment.'],
  ] as const)(
    'does not mount Study network or actions while feature state is %s',
    (status, error, message) => {
      featureState.status = status;
      featureState.error = error;

      renderBoundary();

      expect(screen.getByText(message)).toBeVisible();
      expect(screen.queryByText('Study mounted')).not.toBeInTheDocument();
      expect(studyFetchMock).not.toHaveBeenCalled();
      expect(studyActionMock).not.toHaveBeenCalled();
    }
  );

  it('mounts Study only after an affirmative flag result', () => {
    featureState.enabled = true;
    featureState.status = 'ready';

    renderBoundary();

    expect(screen.getByText('Study mounted')).toBeVisible();
    expect(studyFetchMock).toHaveBeenCalledWith('/api/study/overview');
    expect(studyActionMock).toHaveBeenCalledTimes(1);
  });

  it('lets the user retry after availability could not be confirmed', () => {
    featureState.error = new Error('Unavailable');
    featureState.status = 'error';

    renderBoundary();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetchMock).toHaveBeenCalledTimes(1);
    expect(studyFetchMock).not.toHaveBeenCalled();
    expect(studyActionMock).not.toHaveBeenCalled();
  });
});
