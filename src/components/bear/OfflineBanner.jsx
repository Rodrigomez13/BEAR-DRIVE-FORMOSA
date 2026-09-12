import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";

/**
 * Global reactive connectivity banner for BearDrive Formosa.
 * Detects 3G/4G micro-cuts and mobile disconnects, providing reassuring feedback
 * and seamless auto-reconnect notifications.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOffline(false);
      setReconnected(true);
      const timer = setTimeout(() => {
        setReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          key="offline-banner"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 inset-x-0 z-[9999] pointer-events-auto"
        >
          <div className="bg-amber-500/95 text-slate-950 px-4 py-2.5 shadow-lg backdrop-blur-md flex items-center justify-between safe-top border-b border-amber-600/30">
            <div className="flex items-center gap-2.5 text-xs font-semibold max-w-md mx-auto w-full">
              <div className="w-6 h-6 rounded-full bg-slate-950/10 flex items-center justify-center shrink-0">
                <WifiOff className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-950 text-xs leading-tight">
                  Sin conexión de datos móviles
                </p>
                <p className="text-[11px] text-slate-900/80 leading-tight truncate">
                  Reconectando automáticamente con BearDrive Formosa...
                </p>
              </div>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950/70 shrink-0" />
            </div>
          </div>
        </motion.div>
      )}

      {!isOffline && reconnected && (
        <motion.div
          key="online-banner"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 inset-x-0 z-[9999] pointer-events-auto"
        >
          <div className="bg-emerald-500/95 text-slate-950 px-4 py-2.5 shadow-lg backdrop-blur-md flex items-center justify-center safe-top border-b border-emerald-600/30">
            <div className="flex items-center gap-2 text-xs font-bold max-w-md mx-auto">
              <Wifi className="w-4 h-4 text-slate-950" />
              <span>Conexión restablecida • BearDrive en línea</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
