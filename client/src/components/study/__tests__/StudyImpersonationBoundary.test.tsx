import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StudyImpersonationBoundary from '../StudyImpersonationBoundary';

const fetchMock = vi.fn();

const StudyNetworkProbe = ({ path }: { path: string }) => {
  useEffect(() => {
    fetch(`/api/study/${path}`).catch(() => undefined);
  }, [path]);

  return <div>Study surface: {path}</div>;
};

const renderStudyRoute = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/study" element={<StudyImpersonationBoundary />}>
          <Route index element={<StudyNetworkProbe path="main" />} />
          <Route path="browse" element={<StudyNetworkProbe path="browse" />} />
          <Route path="cards" element={<StudyNetworkProbe path="cards" />} />
          <Route path="create" element={<StudyNetworkProbe path="create" />} />
          <Route path="import" element={<StudyNetworkProbe path="import" />} />
          <Route path="settings" element={<StudyNetworkProbe path="settings" />} />
          <Route path="daily-audio" element={<StudyNetworkProbe path="daily-audio" />} />
          <Route path="time" element={<StudyNetworkProbe path="time" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('StudyImpersonationBoundary', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  it.each([
    ['/app/study?viewAs=user-1', 'main'],
    ['/app/study/browse?viewAs=user-1&noteId=note-1', 'browse'],
    ['/app/study/cards?viewAs=user-1', 'cards'],
    ['/app/study/create?viewAs=user-1', 'create'],
    ['/app/study/import?viewAs=user-1', 'import'],
    ['/app/study/settings?viewAs=user-1', 'settings'],
    ['/app/study/daily-audio?viewAs=user-1', 'daily-audio'],
    ['/app/study/time?viewAs=user-1', 'time'],
  ])('blocks %s before the %s surface can request Study data', (path) => {
    renderStudyRoute(path);

    expect(screen.getByRole('heading', { name: 'Study unavailable in View As' })).toBeVisible();
    expect(
      screen.getByText(/Study data is scoped to your own account and cannot be viewed or changed/)
    ).toBeVisible();
    expect(screen.queryByText(/Study surface:/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Back to viewed Library' })).toHaveAttribute(
      'href',
      '/app/library?viewAs=user-1'
    );
  });

  it('renders the Study route normally when View As is absent', async () => {
    renderStudyRoute('/app/study/cards');

    expect(screen.getByText('Study surface: cards')).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/study/cards'));
    expect(screen.queryByText('Study unavailable in View As')).not.toBeInTheDocument();
  });
});
