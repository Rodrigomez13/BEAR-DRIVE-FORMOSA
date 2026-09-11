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
  const trackingRecordRef = useRef(null);
  const trackingRideRef = useRef(null);
  const creatingTrackingRef = useRef(false);
  const lastPublishedLocationRef = useRef({ at: 0, point: null });
  const sequenceRef = useRef(0);
  const routeStateRef = useRef({
    etaSeconds: null,
    distanceMeters: null,
    routePolyline: null,
    routeVersion: 0,
  });

  useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;

    const loadInitialState = async () => {
      try {
        const rides = await base44.entities.Ride.filter(
          { driver_id: user.id, status: { $in: ACTIVE_DRIVER_STATUSES } },
          "-created_date",
          1
        );

        if (!cancelled && rides?.[0]) setActiveRide(rides[0]);
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
    const ride = activeRide;
    if (!ride?.id || !user?.id) {
      trackingRecordRef.current = null;
      trackingRideRef.current = null;
      sequenceRef.current = 0;
      return;
    }

    if (trackingRideRef.current === ride.id) return;
    trackingRideRef.current = ride.id;
    trackingRecordRef.current = null;
    sequenceRef.current = 0;
    routeStateRef.current = {
      etaSeconds: null,
      distanceMeters: null,
      routePolyline: null,
      routeVersion: 0,
    };

    let cancelled = false;
    base44.entities.RideTracking.filter({ ride_id: ride.id, driver_id: user.id }, "-updated_date", 1)
      .then((records) => {
        if (!cancelled && records?.[0]?.id) {
          trackingRecordRef.current = records[0].id;
          sequenceRef.current = Number(records[0].sequence || 0);
          routeStateRef.current = {
            etaSeconds: records[0].eta_seconds ?? null,
            distanceMeters: records[0].distance_meters ?? null,
            routePolyline: records[0].route_polyline || null,
            routeVersion: Number(records[0].route_version || 0),
          };
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeRide?.id, user?.id]);

  useEffect(() => {
    if (!supportsNativeNavigation() || !user?.id) return undefined;
    let disposed = false;
    const handles = [];

    const upsertTracking = async (locationPayload = {}) => {
      const ride = activeRideRef.current;
      const phase = phaseForRide(ride);
      if (!ride || !phase) return;

      const lat = Number(locationPayload.latitude ?? locationPayload.lat);
      const lng = Number(locationPayload.longitude ?? locationPayload.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const point = { lat, lng };
      const now = Date.now();
      const previous = lastPublishedLocationRef.current;
      const elapsed = now - previous.at;
      const moved = metersBetween(previous.point, point);

      // La ubicación local puede actualizarse cada segundo, pero Passenger sólo necesita
      // una publicación cuando hay desplazamiento útil o vence el máximo de silencio.
      if (elapsed < 2500 && moved < 15) return;
      if (elapsed < 5000 && moved < 6) return;

      lastPublishedLocationRef.current = { at: now, point };
      sequenceRef.current += 1;

      const routeState = routeStateRef.current;
      const data = {
        ride_id: ride.id,
        driver_id: user.id,
        passenger_id: ride.passenger_id,
        phase,
        lat,
        lng,
        heading: Number.isFinite(Number(locationPayload.bearing)) ? Number(locationPayload.bearing) : undefined,
        speed: Number.isFinite(Number(locationPayload.speed)) ? Number(locationPayload.speed) : undefined,
        accuracy: Number.isFinite(Number(locationPayload.accuracy)) ? Number(locationPayload.accuracy) : undefined,
        eta_seconds: routeState.etaSeconds ?? undefined,
        distance_meters: routeState.distanceMeters ?? undefined,
        route_polyline: routeState.routePolyline ?? undefined,
        route_version: routeState.routeVersion,
        sequence: sequenceRef.current,
        observed_at: new Date(now).toISOString(),
      };

      try {
        if (trackingRecordRef.current) {
          await base44.entities.RideTracking.update(trackingRecordRef.current, data);
          return;
        }

        if (creatingTrackingRef.current) return;
        creatingTrackingRef.current = true;
        const created = await base44.entities.RideTracking.create(data);
        trackingRecordRef.current = created.id;
      } catch {
        // La siguiente posición vuelve a intentar sin interrumpir Navigation SDK.
      } finally {
        creatingTrackingRef.current = false;
      }
    };

    const handleProgress = (payload) => {
      if (!payload) return;
      const etaSeconds = Number(payload.etaSeconds);
      const distanceMeters = Number(payload.distanceMeters);
      routeStateRef.current = {
        ...routeStateRef.current,
        etaSeconds: Number.isFinite(etaSeconds) ? Math.max(0, Math.round(etaSeconds)) : routeStateRef.current.etaSeconds,
        distanceMeters: Number.isFinite(distanceMeters) ? Math.max(0, Math.round(distanceMeters)) : routeStateRef.current.distanceMeters,
      };
    };

    const handleRouteChanged = (payload) => {
      if (!payload) return;
      routeStateRef.current = {
        ...routeStateRef.current,
        routePolyline: payload.routePolyline || routeStateRef.current.routePolyline,
        routeVersion: routeStateRef.current.routeVersion + 1,
      };
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
        // La UI React mantiene controles manuales de respaldo.
      }
    };

    Promise.all([
      addNativeNavigationListener("location", upsertTracking),
      addNativeNavigationListener("progress", handleProgress),
      addNativeNavigationListener("routeChanged", handleRouteChanged),
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
