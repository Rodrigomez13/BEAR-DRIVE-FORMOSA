import { Capacitor, registerPlugin } from "@capacitor/core";

const BearDriveNavigation = registerPlugin("BearDriveNavigation");

export function supportsNativeNavigation() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function startNativeNavigation(options) {
  if (!supportsNativeNavigation()) {
    return { supported: false, reason: "native_navigation_requires_android" };
  }

  await BearDriveNavigation.startNavigation({
    rideId: options.rideId,
    phase: options.phase,
    latitude: Number(options.latitude),
    longitude: Number(options.longitude),
    targetTitle: options.targetTitle || "Destino",
    passengerName: options.passengerName || "Pasajero",
    pickupAddress: options.pickupAddress || "",
    destinationAddress: options.destinationAddress || "",
    fareLabel: options.fareLabel || "",
  });

  return { supported: true };
}

export async function stopNativeNavigation() {
  if (!supportsNativeNavigation()) return;
  await BearDriveNavigation.stopNavigation();
}

export async function recenterNativeNavigation() {
  if (!supportsNativeNavigation()) return;
  await BearDriveNavigation.recenter();
}

export async function addNativeNavigationListener(eventName, callback) {
  if (!supportsNativeNavigation()) return { remove: async () => {} };
  return BearDriveNavigation.addListener(eventName, callback);
}

export { BearDriveNavigation };
