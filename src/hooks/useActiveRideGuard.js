import { useEffect } from "react";

// Warns the user when closing the app/refreshing during an active ride.
export function useActiveRideGuard(hasActiveRide) {
  useEffect(() => {
    if (!hasActiveRide) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasActiveRide]);
}