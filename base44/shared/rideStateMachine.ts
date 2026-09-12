// Ride state machine — shared transition rules for server-authoritative validation.
// Ensures the backend is the sole authority over ride lifecycle transitions.

export const RIDE_TRANSITIONS = {
  SEARCHING: ["ASSIGNED", "DRIVER_APPROACHING", "NO_DRIVERS", "CANCELLED"],
  ASSIGNED: ["DRIVER_APPROACHING", "SEARCHING", "CANCELLED"],
  DRIVER_APPROACHING: ["DRIVER_ARRIVED", "SEARCHING", "CANCELLED"],
  DRIVER_ARRIVED: ["PIN_VALIDATION", "IN_PROGRESS", "CANCELLED"],
  PIN_VALIDATION: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["PAYMENT_PENDING", "COMPLETED"],
  PAYMENT_PENDING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_DRIVERS: [],
  NO_SHOW: [],
  PLANNING: ["QUOTED"],
  QUOTED: ["SEARCHING", "PLANNING"],
  WAITING: ["PIN_VALIDATION", "IN_PROGRESS", "CANCELLED"],
  RATED: [],
};

export function isValidTransition(fromStatus, toStatus) {
  const allowed = RIDE_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

// Who is authorized to trigger each transition
export const TRANSITION_ACTORS = {
  "SEARCHING->DRIVER_APPROACHING": "driver",
  "ASSIGNED->DRIVER_APPROACHING": "driver",
  "DRIVER_APPROACHING->DRIVER_ARRIVED": "driver",
  "DRIVER_ARRIVED->IN_PROGRESS": "driver",
  "IN_PROGRESS->ARRIVED": "driver",
  "ARRIVED->PAYMENT_PENDING": "driver",
  "DRIVER_APPROACHING->SEARCHING": "driver",
  "ASSIGNED->SEARCHING": "driver",
  "SEARCHING->CANCELLED": "passenger",
  "DRIVER_APPROACHING->CANCELLED": "passenger",
  "DRIVER_ARRIVED->CANCELLED": "passenger",
  "IN_PROGRESS->CANCELLED": "passenger",
};