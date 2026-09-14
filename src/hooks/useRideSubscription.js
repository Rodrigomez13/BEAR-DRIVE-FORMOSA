import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Realtime ride subscription — the primary sync mechanism for ride status.
 *
 * Subscribes to Ride entity updates and calls onUpdate whenever the tracked
 * ride changes. A slow fallback poll (every 15s) runs alongside the
 * subscription purely as a recovery mechanism in case a realtime event is
 * missed (network drop, app backgrounded, etc).
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

    let live = true;
    // Initial fetch ensures we have the latest state on mount/reconnect
    base44.entities.Ride.get(rideId)
      .then((ride) => {
        if (live && ride) callbackRef.current?.(ride);
      })
      .catch(() => {});

    // Realtime subscription — primary sync mechanism
    let unsubscribe = () => {};
    try {
      unsubscribe = base44.entities.Ride.subscribe((event) => {
        if (event.data?.id !== rideId) return;
        if (event.type === "delete") return;
        if (live) callbackRef.current?.(event.data);
      });
    } catch {
      // Subscription may fail on reconnect — fallback poll covers this
    }

    // Fallback poll — recovery only, not the primary mechanism
    const fallbackInterval = setInterval(async () => {
      try {
        const ride = await base44.entities.Ride.get(rideId);
        if (live && ride) callbackRef.current?.(ride);
      } catch {
        // Network errors are non-fatal — next interval will retry
      }
    }, 15000);

    return () => {
      live = false;
      unsubscribe();
      clearInterval(fallbackInterval);
    };
  }, [rideId]);
}