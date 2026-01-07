import { useFeatureFlags, FeatureFlags } from '../hooks/useFeatureFlags';
import NotFoundPage from '../pages/NotFoundPage';

interface ProtectedByFeatureFlagProps {
  flag: keyof Omit<FeatureFlags, 'id' | 'updatedAt'>;
  children: React.ReactNode;
}

const ProtectedByFeatureFlag = ({ flag, children }: ProtectedByFeatureFlagProps) => {
  const { isFeatureEnabled } = useFeatureFlags();

  if (!isFeatureEnabled(flag)) {
    return <NotFoundPage />;
  }

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{children}</>;
};

export default ProtectedByFeatureFlag;
