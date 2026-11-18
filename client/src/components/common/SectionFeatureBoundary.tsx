import { Navigate, Outlet } from 'react-router-dom';
import { useFeatureFlags, type FeatureFlags } from '../../hooks/useFeatureFlags';

type Feature = keyof Omit<FeatureFlags, 'id' | 'updatedAt'>;

const SectionFeatureBoundary = ({ feature }: { feature: Feature }) => {
  const { isFeatureEnabled, status, refetch } = useFeatureFlags();
  if (isFeatureEnabled(feature)) return <Outlet />;
  if (status === 'loading') return <p role="status">Loading…</p>;
  if (status === 'error') {
    return (
      <div role="alert">
        <p>We couldn’t check which sections are available.</p>
        <button
          type="button"
          onClick={() => {
            refetch();
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  return <Navigate to="/app/journal" replace />;
};

export default SectionFeatureBoundary;
