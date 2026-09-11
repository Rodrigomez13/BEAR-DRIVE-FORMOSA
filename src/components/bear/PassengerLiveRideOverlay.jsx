import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, Clock, MapPin, Navigation, Phone, Shield, Star } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import MapView from "@/components/bear/MapView";
import BearAvatar from "@/components/bear/BearAvatar";
import CancelRideDialog from "@/components/bear/CancelRideDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { displayAddress } from "@/lib/geo";

const TRACKED_STATUSES = [
  "ASSIGNED",
  "DRIVER_APPROACHING",
  "DRIVER_ARRIVED",
  "WAITING",
  "PIN_VALIDATION",
  "IN_PROGRESS",
];

function phaseForRide(ride) {
  if (!ride) return null;
  if (["ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING", "PIN_VALIDATION"].includes(ride.status)) {
    return "pickup";
  }
  if (ride.status === "IN_PROGRESS") return "destination";
  return null;
}

function parseRoutePath(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    const normalized = parsed
      .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    return normalized.length >= 2 ? normalized : null;
  } catch {
    return null;
  }
}

function squaredDistance(a, b) {
  const latScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const dLat = a.lat - b.lat;
  const dLng = (a.lng - b.lng) * latScale;
  return dLat * dLat + dLng * dLng;
}

function remainingRoutePath(path, driverPos) {
  if (!path || path.length < 2 || !driverPos) return path;

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.length; index += 1) {
    const distance = squaredDistance(path[index], driverPos);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  // Keep one point behind the snapped position so the line visually connects
  // to the interpolated vehicle marker without drawing the already-travelled route.
  const startIndex = Math.max(0, closestIndex - 1);
  const remaining = path.slice(startIndex);
  if (remaining.length < 2) return path.slice(-2);
  return remaining;
}

function formatEta(seconds) {
  if (!Number.isFinite(Number(seconds))) return "";
  const minutes = Math.max(1, Math.ceil(Number(seconds) / 60));
  return `${minutes} min`;
}

function formatDistance(meters) {
  if (!Number.isFinite(Number(meters))) return "";
  const value = Number(meters);
  if (value < 1000) return `${Math.max(10, Math.round(value / 10) * 10)} m`;
  return `${(value / 1000).toFixed(1).replace(".", ",")} km`;
}

export default function PassengerLiveRideOverlay() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeRide, setActiveRide] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [fallbackRouteInfo, setFallbackRouteInfo] = useState(null);
  const [routeAnchor, setRouteAnchor] = useState(null);

  const rideRef = useRef(null);
  const routeAnchorTimeRef = useRef(0);
  const routeVersionRef = useRef(null);

  useEffect(() => {
    rideRef.current = activeRide;
  }, [activeRide]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;

    const recover = async () => {
      try {
        const rides = await base44.entities.Ride.filter(
          { passenger_id: user.id, status: { $in: TRACKED_STATUSES } },
          "-created_date",
          1
        );
        if (!cancelled) setActiveRide(rides?.[0] || null);
      } catch {
        // Realtime can recover the state on the next change.
      }
    };

    recover();

    const unsubscribe = base44.entities.Ride.subscribe((event) => {
      if (cancelled) return;
      const ride = event?.data;
      if (!ride || ride.passenger_id !== user.id) return;

      if (TRACKED_STATUSES.includes(ride.status)) {
        setActiveRide(ride);
        return;
      }

      if (rideRef.current?.id === ride.id) {
        setActiveRide(null);
        setTracking(null);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!activeRide?.id || !user?.id) {
      setTracking(null);
      return undefined;
    }

    let cancelled = false;
    setExpanded(false);
    setFallbackRouteInfo(null);
    setRouteAnchor(null);
    routeAnchorTimeRef.current = 0;
    routeVersionRef.current = null;

    const recoverTracking = async () => {
      try {
        const records = await base44.entities.RideTracking.filter(
          { ride_id: activeRide.id, passenger_id: user.id },
          "-sequence",
          1
        );
        if (!cancelled && records?.[0]) setTracking(records[0]);
      } catch {
        // The first realtime event will complete the state.
      }
    };

    recoverTracking();

    const unsubscribe = base44.entities.RideTracking.subscribe((event) => {
      if (cancelled) return;
      const record = event?.data;
      if (!record || record.ride_id !== activeRide.id || record.passenger_id !== user.id) return;
      setTracking(record);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeRide?.id, user?.id]);

  const driverPos = useMemo(() => {
    const lat = Number(tracking?.lat);
    const lng = Number(tracking?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      heading: Number(tracking?.heading),
      speed: Number(tracking?.speed),
      accuracy: Number(tracking?.accuracy),
    };
  }, [tracking?.lat, tracking?.lng, tracking?.heading, tracking?.speed, tracking?.accuracy]);

  const phase = phaseForRide(activeRide);
  const target = useMemo(() => {
    if (!activeRide || !phase) return null;
    if (phase === "pickup") {
      return { lat: Number(activeRide.origin_lat), lng: Number(activeRide.origin_lng) };
    }
    return { lat: Number(activeRide.destination_lat), lng: Number(activeRide.destination_lng) };
  }, [activeRide?.id, activeRide?.status, activeRide?.origin_lat, activeRide?.origin_lng, activeRide?.destination_lat, activeRide?.destination_lng, phase]);

  useEffect(() => {
    if (!driverPos) return;
    const now = Date.now();
    const routeVersion = Number(tracking?.route_version || 0);
    const routeChanged = routeVersionRef.current !== routeVersion;
    const stale = now - routeAnchorTimeRef.current >= 15000;

    if (!routeAnchor || routeChanged || stale) {
      setRouteAnchor({ lat: driverPos.lat, lng: driverPos.lng });
      routeAnchorTimeRef.current = now;
      routeVersionRef.current = routeVersion;
    }
  }, [driverPos?.lat, driverPos?.lng, tracking?.route_version]);

  const routePath = useMemo(() => {
    return remainingRoutePath(parseRoutePath(tracking?.route_polyline), driverPos);
  }, [tracking?.route_polyline, tracking?.route_version, driverPos?.lat, driverPos?.lng]);

  if (location.pathname !== "/passenger" || !activeRide || !phase) return null;

  const etaText = formatEta(tracking?.eta_seconds) || fallbackRouteInfo?.durationText || "Calculando...";
  const distanceText = formatDistance(tracking?.distance_meters) || fallbackRouteInfo?.distanceText || "";
  const pickupPhase = phase === "pickup";
  const driverArrived = ["DRIVER_ARRIVED", "WAITING", "PIN_VALIDATION"].includes(activeRide.status);

  const handleCancel = async () => {
    try {
      await base44.entities.Ride.update(activeRide.id, {
        status: "CANCELLED",
        cancelled_date: new Date().toISOString(),
        cancel_reason: "passenger_cancelled",
      });
      setShowCancelDialog(false);
      setActiveRide(null);
      setTracking(null);
    } catch {
      // PassengerViajar keeps its cancellation fallback if this request fails.
    }
  };

  return (
    <div className="absolute inset-0 z-30 bg-background">
      <MapView
        center={driverPos || target}
        origin={routePath ? null : (routeAnchor || driverPos)}
        destination={routePath ? null : target}
        path={routePath || undefined}
        driverPos={driverPos}
        userPos={pickupPhase ? target : null}
        originLabel=""
        destinationLabel={pickupPhase ? "Tu ubicación" : "Destino"}
        showOriginMarker={false}
        showDestinationMarker={true}
        interactive={true}
        onRouteInfo={setFallbackRouteInfo}
        className="absolute inset-0"
      />

      <div className="absolute inset-x-0 top-0 z-10 p-3 safe-top pointer-events-none">
        <div className="max-w-md mx-auto flex justify-center">
          <div className="px-4 py-2 rounded-full glass-navy text-white shadow-lg">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>{pickupPhase ? (driverArrived ? "Tu conductor llegó" : "Tu conductor está en camino") : "Viaje en curso"}</span>
              <span className="text-accent">{etaText}</span>
              {distanceText && <span className="text-white/55">· {distanceText}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 p-3 pointer-events-none">
        <Card className="max-w-md mx-auto rounded-2xl border-white/10 shadow-2xl overflow-hidden pointer-events-auto">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="w-full text-left px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <BearAvatar size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{activeRide.driver_name || "Conductor"}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="w-3 h-3 fill-accent text-accent" />
                    <span>{activeRide.driver_rating || "5.0"}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {pickupPhase
                    ? (driverArrived ? "Esperándote en el punto de encuentro" : `${etaText}${distanceText ? ` · ${distanceText}` : ""}`)
                    : `En viaje · ${etaText}${distanceText ? ` · ${distanceText}` : ""}`}
                </p>
              </div>
              <div className="shrink-0 text-muted-foreground">
                {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </div>
            </div>

            {driverArrived && (
              <div className="mt-3 rounded-xl bg-accent/10 px-3 py-2 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">PIN para iniciar</span>
                <span className="text-xl font-extrabold tracking-[0.28em] text-accent">{activeRide.start_pin}</span>
              </div>
            )}
          </button>

          {expanded && (
            <div className="px-4 pb-4 pt-1 border-t border-border/60 animate-fade-in">
              <div className="grid grid-cols-[1fr_auto] gap-3 items-start mt-3">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Punto de encuentro</p>
                      <p className="truncate">{displayAddress(activeRide.origin_address)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Navigation className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Destino</p>
                      <p className="truncate">{displayAddress(activeRide.destination_address)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{etaText}{distanceText ? ` · ${distanceText}` : ""}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeRide.vehicle_model || "Vehículo"}{activeRide.vehicle_color ? ` · ${activeRide.vehicle_color}` : ""}{activeRide.vehicle_plate ? ` · ${activeRide.vehicle_plate}` : ""}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <button type="button" className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-accent" />
                  </button>
                  <button type="button" className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-accent" />
                  </button>
                </div>
              </div>

              {pickupPhase && !driverArrived && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full mt-4 text-destructive"
                >
                  Cancelar viaje
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      <CancelRideDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleCancel}
        isDriver={false}
      />
    </div>
  );
}
