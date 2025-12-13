import { useState, useEffect } from 'react';
import { API_URL } from '../config';

interface QuotaInfo {
  unlimited: boolean;
  quota: {
    used: number;
    limit: number;
    remaining: number;
    resetsAt: string;
  } | null;
  cooldown: {
    active: boolean;
    remainingSeconds: number;
  };
}

/**
 * Hook to fetch and manage user quota information
 * Returns quota status and a function to refetch
 */
export function useQuota() {
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/auth/me/quota`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to fetch quota');
      }

      const data = await res.json();
      setQuotaInfo(data);
    } catch (err) {
      console.error('Failed to fetch quota:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  return { quotaInfo, loading, error, refetchQuota: fetchQuota };
}
