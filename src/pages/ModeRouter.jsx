import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

// Decides where to send the user after auth based on requested mode + driver capability.
export default function ModeRouter() {
  const { user } = useAuth();

  useEffect(() => {
    const persistMode = async () => {
      if (!user) return;
      const requestedMode = sessionStorage.getItem("bear_requested_mode");
      const adminAttempt = sessionStorage.getItem("bear_admin_attempt") === "true";

      if (adminAttempt) {
        sessionStorage.removeItem("bear_admin_attempt");
        if (user.role !== "admin") {
          // Generic error — do not reveal why
          sessionStorage.setItem("bear_admin_denied", "true");
          await base44.auth.logout();
          return;
        }
      }

      if (requestedMode || user.last_active_mode) {
        const mode = requestedMode || user.last_active_mode || "passenger";
        await base44.auth.updateMe({ last_active_mode: mode }).catch(() => {});
      }
    };
    persistMode();
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;

  const adminAttempt = sessionStorage.getItem("bear_admin_attempt") === "true";
  if (adminAttempt && user.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  const requestedMode = sessionStorage.getItem("bear_requested_mode") || user.last_active_mode || "passenger";

  if (requestedMode === "driver") {
    // Check driver capability to decide destination
    const cap = user.driver_capability || "NO_DRIVER";
    if (cap === "APPROVED_ELIGIBLE") {
      return <Navigate to="/driver" replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/passenger" replace />;
}