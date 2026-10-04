import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { listReadings } from './readingsApi';

export default function useReadings(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['readings', user?.id],
    queryFn: ({ signal }) => listReadings(signal),
    enabled: enabled && Boolean(user),
    staleTime: 60_000,
  });
}
