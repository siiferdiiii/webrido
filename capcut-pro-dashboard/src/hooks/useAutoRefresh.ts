import { useEffect, useRef, useCallback, useState } from "react";

interface UseAutoRefreshOptions {
  /** Interval in milliseconds (default: 15000) */
  intervalMs?: number;
  /** Whether auto-refresh is enabled (default: true) */
  enabled?: boolean;
}

interface UseAutoRefreshReturn {
  /** Seconds since last successful refresh */
  secondsAgo: number;
  /** Whether a background refresh is currently running */
  isRefreshing: boolean;
  /** Manually trigger a refresh */
  refresh: () => void;
}

/**
 * Smart polling hook that:
 * - Pauses when the browser tab is hidden (saves bandwidth)
 * - Resumes immediately when the tab becomes visible again
 * - Tracks how many seconds ago the last refresh occurred
 */
export function useAutoRefresh(
  fetchFn: () => Promise<void> | void,
  options: UseAutoRefreshOptions = {}
): UseAutoRefreshReturn {
  const { intervalMs = 15000, enabled = true } = options;

  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const lastRefreshAt = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchFnRef = useRef(fetchFn);

  // Always keep fetchFn ref fresh
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const runFetch = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchFnRef.current();
      lastRefreshAt.current = Date.now();
      setSecondsAgo(0);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        runFetch();
      }
    }, intervalMs);
  }, [intervalMs, runFetch]);

  useEffect(() => {
    if (!enabled) return;

    // Start polling
    startPolling();

    // Tick counter: update "X seconds ago" every second
    tickRef.current = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefreshAt.current) / 1000));
    }, 1000);

    // Resume immediately when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runFetch();
        startPolling();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, startPolling, runFetch]);

  return {
    secondsAgo,
    isRefreshing,
    refresh: runFetch,
  };
}
