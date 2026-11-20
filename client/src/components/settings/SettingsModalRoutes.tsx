import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, useLocation, type Location } from 'react-router-dom';

const SettingsDialog = lazy(() => import('./SettingsDialog'));

function settingsBackground(location: Location) {
  const previous = location.state?.backgroundLocation as Location | undefined;
  const isSettings = /^\/app\/settings(?:\/[^/]+)?\/?$/.test(location.pathname);
  const validBackground = previous?.pathname?.startsWith('/app/');
  const background =
    isSettings && validBackground && !previous?.pathname.startsWith('/app/settings')
      ? previous
      : undefined;

  return background;
}

const SettingsModalRoutes = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const background = settingsBackground(location);

  return (
    <>
      <Routes location={background}>{children}</Routes>
      {background && (
        <Suspense fallback={null}>
          <Routes>
            <Route path="/app/settings/:tab?" element={<SettingsDialog />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
};

export default SettingsModalRoutes;
