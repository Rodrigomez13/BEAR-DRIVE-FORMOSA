import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook to request and manage the Screen Wake Lock API.
 * Keeps the device screen awake during active navigation or online driving.
 * Handles automatic re-acquisition when the app returns to the foreground.
 *
 * @param {boolean} enabled - Whether wake lock should currently be requested.
 * @returns {{ isLocked: boolean, isSupported: boolean }}
 */
export function useWakeLock(enabled = false) {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef(null);
  const isSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  const requestLock = useCallback(async () => {
    if (!isSupported || wakeLockRef.current !== null) return;
    try {
      const lock = await navigator.wakeLock.request("screen");
      wakeLockRef.current = lock;
      setIsLocked(true);

      lock.addEventListener("release", () => {
        wakeLockRef.current = null;
        setIsLocked(false);
      });
    } catch {
      // Browsers may reject if battery saver is on or window isn't active
      wakeLockRef.current = null;
      setIsLocked(false);
    }
  }, [isSupported]);

  const releaseLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore
      } finally {
        wakeLockRef.current = null;
        setIsLocked(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    if (enabled) {
      requestLock();
    } else {
      releaseLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && enabled) {
        requestLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseLock();
    };
  }, [enabled, isSupported, requestLock, releaseLock]);

  return { isLocked, isSupported };
}

export default useWakeLock;
