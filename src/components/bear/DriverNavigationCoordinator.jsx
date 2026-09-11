import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import {
  addNativeNavigationListener,
  startNativeNavigation,
  stopNativeNavigation,
  supportsNativeNavigation,
} from "@/lib/nativeNavigation";

const ACTIVE_DRIVER_STATUSES = [
  "ASSIGNED",
  "DRIVER_APPROACHING",
  "DRIVER_ARRIVED",
  "WAITING",
  "PIN_VALIDATION",
  "IN_PROGRESS",
  "ARRIVED",
  "PAYMENT_PENDING",
];

function phaseForRide(ride) {
  if (!ride) return null;
  if (["ASSIGNED", "DRIVER_APPROACHING"].includes(ride.status)) return "pickup";
  if (ride.status === "IN_PROGRESS") return "destination";
  return null;
}

function metersBetween(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function DriverNavigationCoordinator() {
  const { user } = useAuth();
  const [activeRide, setActiveRide] = useState(null);

  const activeRideRef = useRef(null);
  const launchedNavigationRef = useRef(null);
  const driverLocationIdRef = useRef(null);
  const creatingLocationRef = useRef(false);
  const lastPublishedLocationRef = useRef({ at: 0, point: null });

  useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;

    const loadInitialState = async () => {
      try {
        const [rides, locations] = await Promise.all([
          base44.entities.Ride.filter(
            { driver_id: user.id, status: { $in: ACTIVE_DRIVER_STATUSES } },
            "-created_date",
            1
          ),
          base44.entities.DriverLocation.filter({ driver_id: user.id }),
        ]);

        if (cancelled) return;
        if (rides?.[0]) setActiveRide(rides[0]);
        if (locations?.[0]?.id) driverLocationIdRef.current = locations[0].id;
      } catch {
        // Realtime puede recuperar el estado en el siguiente cambio.
      }
    };

    loadInitialState();

    const unsubscribeRide = base44.entities.Ride.subscribe((event) => {
      if (cancelled) return;
      const ride = event?.data;
      if (!ride || ride.driver_id !== user.id) return;

      if (ACTIVE_DRIVER_STATUSES.includes(ride.status)) {
        setActiveRide(ride);
        return;
      }

      if (activeRideRef.current?.id === ride.id) {
        setActiveRide(null);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeRide?.();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!supportsNativeNavigation() || !user?.id) return undefined;
    let disposed = false;
    const handles = [];

    const publishLocation = async (payload) => {
      const ride = activeRideRef.current;
      if (!ride || !payload) return;

      const lat = Number(payload.latitude ?? payload.lat);
      const lng = Number(payload.longitude ?? payload.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const point = { lat, lng };
      const now = Date.now();
      const previous = lastPublishedLocationRef.current;
      const elapsed = now - previous.at;
      const moved = metersBetween(previous.point, point);

      // El SDK puede emitir fixes cada segundo. Sólo publicamos cuando el movimiento
      // es útil para Passenger o cuando vence la ventana máxima de silencio.
      if (elapsed < 2500 && moved < 15) return;
      if (elapsed < 5000 && moved < 6) return;

      lastPublishedLocationRef.current = { at: now, point };

      const data = {
        lat,
        lng,
        online: true,
        heading: Number.isFinite(Number(payload.bearing)) ? Number(payload.bearing) : undefined,
        speed: Number.isFinite(Number(payload.speed)) ? Number(payload.speed) : undefined,
        accuracy: Number.isFinite(Number(payload.accuracy)) ? Number(payload.accuracy) : undefined,
        ride_id: ride.id,
      };

      try {
        if (driverLocationIdRef.current) {
          await base44.entities.DriverLocation.update(driverLocationIdRef.current, data);
          return;
        }

        if (creatingLocationRef.current) return;
        creatingLocationRef.current = true;
        const created = await base44.entities.DriverLocation.create({
          driver_id: user.id,
          ...data,
        });
        driverLocationIdRef.current = created.id;
      } catch {
        // El siguiente fix vuelve a intentar; no interrumpimos navegación.
      } finally {
        creatingLocationRef.current = false;
      }
    };

    const handleArrival = async (payload) => {
      const ride = activeRideRef.current;
      if (!ride || !payload || payload.rideId !== ride.id) return;

      try {
        if (payload.phase === "pickup" && ["ASSIGNED", "DRIVER_APPROACHING"].includes(ride.status)) {
          const updated = await base44.entities.Ride.update(ride.id, { status: "DRIVER_ARRIVED" });
          if (!disposed) setActiveRide(updated);
        }

        if (payload.phase === "destination" && ride.status === "IN_PROGRESS") {
          const updated = await base44.entities.Ride.update(ride.id, { status: "ARRIVED" });
          if (!disposed) setActiveRide(updated);
        }
      } catch {
        // El viaje permanece recuperable desde la UI React.
      }
    };

    Promise.all([
      addNativeNavigationListener("location", publishLocation),
      addNativeNavigationListener("arrival", handleArrival),
      addNativeNavigationListener("navigationClosed", () => {
        launchedNavigationRef.current = null;
      }),
    ]).then((listenerHandles) => {
      if (disposed) {
        listenerHandles.forEach((handle) => handle?.remove?.());
        return;
      }
      handles.push(...listenerHandles);
    });

    return () => {
      disposed = true;
      handles.forEach((handle) => handle?.remove?.());
    };
  }, [user?.id]);

  useEffect(() => {
    if (!supportsNativeNavigation()) return;

    const phase = phaseForRide(activeRide);
    if (!activeRide || !phase) {
      launchedNavigationRef.current = null;
      stopNativeNavigation().catch(() => {});
      return;
    }

    const launchKey = `${activeRide.id}:${phase}`;
    if (launchedNavigationRef.current === launchKey) return;

    const target = phase === "pickup"
      ? { lat: activeRide.origin_lat, lng: activeRide.origin_lng }
      : { lat: activeRide.destination_lat, lng: activeRide.destination_lng };

    if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return;

    launchedNavigationRef.current = launchKey;
    startNativeNavigation({
      rideId: activeRide.id,
      phase,
      latitude: target.lat,
      longitude: target.lng,
      targetTitle: phase === "pickup" ? "Punto de encuentro" : "Destino",
      passengerName: activeRide.passenger_name || "Pasajero",
      pickupAddress: activeRide.origin_address || "",
      destinationAddress: activeRide.destination_address || "",
      fareLabel: activeRide.quoted_fare
        ? `$${Number(activeRide.quoted_fare).toLocaleString("es-AR")}`
        : "",
    }).catch(() => {
      if (launchedNavigationRef.current === launchKey) {
        launchedNavigationRef.current = null;
      }
    });
  }, [activeRide?.id, activeRide?.status]);

  return null;
}
