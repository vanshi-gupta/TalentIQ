import { useCallback, useEffect, useRef, useState } from 'react';

interface UseApiOptions {
  enabled?: boolean;
}

export function useApi<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiOptions = {},
) {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loaderRef.current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message || 'Something went wrong.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, enabled]);

  return { data, error, loading, reload, setData };
}
