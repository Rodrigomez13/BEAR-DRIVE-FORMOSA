// Lightweight selective haptic feedback utility for BearDrive Formosa
// Supports both Web Vibration API (mobile browser) and Capacitor Haptics (native app)
export const Haptics = {
  // Light vibration for selection chips, category changes, tab switching
  light() {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(18);
      }
    } catch {
      // ignore
    }
  },

  // Medium vibration for button presses like "Pedir Viaje", "Aceptar"
  medium() {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(35);
      }
    } catch {
      // ignore
    }
  },

  // Marked vibration pattern when a driver is assigned or ride accepted
  success() {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 60, 50]);
      }
    } catch {
      // ignore
    }
  },

  // Distinct alert pattern when the driver arrives at the meeting point
  arrival() {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([60, 80, 60, 80, 100]);
      }
    } catch {
      // ignore
    }
  },

  // Warning or cancellation
  warning() {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }
    } catch {
      // ignore
    }
  },
};

export default Haptics;
