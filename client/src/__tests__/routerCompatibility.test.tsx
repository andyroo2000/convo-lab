import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

const RouteProbe = () => {
  const location = useLocation();
  const params = useParams();

  return (
    <output data-testid="route-probe">
      {JSON.stringify({
        hash: location.hash,
        pathname: location.pathname,
        search: location.search,
        params,
      })}
    </output>
  );
};

describe('React Router compatibility', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('preserves nested deep-link parameters, search, and hash', () => {
    window.history.replaceState(
      null,
      '',
      '/app/courses/course-123?tab=episodes&view=compact#track-2'
    );

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/app" element={<Outlet />}>
            <Route path="courses/:courseId" element={<RouteProbe />} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

    expect(JSON.parse(screen.getByTestId('route-probe').textContent ?? '')).toEqual({
      hash: '#track-2',
      pathname: '/app/courses/course-123',
      search: '?tab=episodes&view=compact',
      params: { courseId: 'course-123' },
    });
  });

  it('preserves the replace redirect from the app index to the study', async () => {
    window.history.replaceState(null, '', '/app');

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/app" element={<Outlet />}>
            <Route index element={<Navigate to="/app/study" replace />} />
            <Route path="study" element={<RouteProbe />} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/app/study');
      expect(JSON.parse(screen.getByTestId('route-probe').textContent ?? '')).toMatchObject({
        pathname: '/app/study',
      });
    });
  });

  it('completes link navigation when route updates are transition-wrapped', async () => {
    window.history.replaceState(null, '', '/app/home');

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/app" element={<Outlet />}>
            <Route path="home" element={<Link to="/app/study">Open study</Link>} />
            <Route path="study" element={<RouteProbe />} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

    await userEvent.click(screen.getByRole('link', { name: 'Open study' }));

    const routeProbe = await screen.findByTestId('route-probe');
    expect(window.location.pathname).toBe('/app/study');
    expect(JSON.parse(routeProbe.textContent ?? '')).toMatchObject({
      pathname: '/app/study',
    });
  });
});
