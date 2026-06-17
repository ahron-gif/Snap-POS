import { useState, useEffect, useCallback, useRef } from 'react';
import type { ApiResult } from '../services/dashboardService';

interface UseDashboardApiResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboardApi<T>(
  fetchFn: () => Promise<ApiResult<T>>,
  deps: unknown[] = [],
  enabled = true
): UseDashboardApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (!mountedRef.current) return;
      if (result.isSuccess && result.response !== null) {
        setData(result.response);
      } else {
        setError(result.message || 'Failed to load data');
      }
    } catch {
      if (mountedRef.current) setError('Network error');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
