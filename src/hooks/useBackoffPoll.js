import { useEffect, useRef } from "react";

/**
 * Polls an async function with exponential backoff on failure.
 *
 * - Starts at baseDelay, doubles on each consecutive failure, caps at maxDelay.
 * - Resets to baseDelay immediately on success.
 * - Stops and cleans up when enabled becomes false.
 *
 * This replaces fixed setInterval polling so transient network errors don't
 * hammer the server — the interval grows (3s → 6s → 12s → 24s → 30s cap) until
 * a successful response resets it.
 */
export function useBackoffPoll(fn, { enabled = true, baseDelay = 3000, maxDelay = 30000 } = {}) {
  const fnRef = useRef(fn);
  const timerRef = useRef(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let attempt = 0;

    const tick = async () => {
      if (cancelled) return;
      try {
        await fnRef.current();
        if (cancelled) return;
        attempt = 0;
        timerRef.current = setTimeout(tick, baseDelay);
      } catch {
        if (cancelled) return;
        attempt += 1;
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        timerRef.current = setTimeout(tick, delay);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, baseDelay, maxDelay]);
}
