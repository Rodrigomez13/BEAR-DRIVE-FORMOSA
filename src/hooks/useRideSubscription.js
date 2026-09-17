import { useEffect, useRef } from "react";
import { beardrive } from "@/services/beardrive";
import { observeRide } from "@/services/observe-ride";

/**
 * Realtime ride subscription — the primary sync mechanism for ride status.
 *
 * Reconciles on events, reconnect and foreground, with bounded failure retries.
 * Event payloads are never treated as authoritative snapshots.
 *
 * This replaces the previous 3-second polling pattern — the backend remains
 * the authoritative source of truth, and the client reacts to events instead
 * of constantly querying.
 */
export function useRideSubscription(rideId, onUpdate) {
  const callbackRef = useRef(onUpdate);

  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!rideId) return;

    return observeRide({
      id: rideId,
      get: beardrive.rides.get,
      subscribe: beardrive.rides.subscribe,
      onUpdate: ride => callbackRef.current?.(ride),
      onError: () => window.dispatchEvent(new Event('bear-sync-error')),
    });
  }, [rideId]);
}
