import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import MapView from "@/components/bear/MapView";
import {
  Car,
  Power,
  Loader2,
  MapPin,
  Clock,
  Navigation,
  KeyRound,
  AlertTriangle,
  Wallet,
  CreditCard,
  Banknote,
  QrCode,
  Bell,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  getCurrentPosition,
  watchCurrentPosition,
  clearPositionWatch,
  displayAddress,
} from "@/lib/geo";
import CancelRideDialog from "@/components/bear/CancelRideDialog";
import { useActiveRideGuard } from "@/hooks/useActiveRideGuard";
import BearAvatar from "@/components/bear/BearAvatar";
import RideRequestModal from "@/components/bear/RideRequestModal";
import TurnByTurnNav from "@/components/bear/TurnByTurnNav";

const PICKUP_STATUSES = ["ASSIGNED", "DRIVER_APPROACHING"];
const ACTIVE_RIDE_STATUSES = [
  "ASSIGNED",
  "DRIVER_APPROACHING",
  "DRIVER_ARRIVED",
  "WAITING",
  "PIN_VALIDATION",
  "IN_PROGRESS",
  "ARRIVED",
  "PAYMENT_PENDING",
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function navigationPhase(status) {
  if (PICKUP_STATUSES.includes(status)) return "pickup";
  if (status === "IN_PROGRESS") return "destination";
  return null;
}

function formatManeuverDistance(meters) {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export default function DriverConducir() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [online, setOnline] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [availableRides, setAvailableRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [driverPos, setDriverPos] = useState(null);
  const [driverLocationId, setDriverLocationId] = useState(null);
  const [notifAsked, setNotifAsked] = useState(false);
  const [navigationStart, setNavigationStart] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [cardMinimized, setCardMinimized] = useState(false);

  const pollRef = useRef(null);
  const positionWatchRef = useRef(null);
  const lastLocationPersistRef = useRef(0);
  const silencedRides = useRef(new Set());
  const arrivalHitsRef = useRef({ pickup: 0, destination: 0 });
  const transitionInFlightRef = useRef(false);
  const phaseRef = useRef(null);

  const eligible = user?.driver_capability === "APPROVED_ELIGIBLE";

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      try {
        const vehiclesResult = await base44.entities.Vehicle.filter({ driver_id: user.id, status: "approved" });
        setVehicles(vehiclesResult);
        if (vehiclesResult.length > 0) setSelectedVehicle(vehiclesResult[0]);

        const active = await base44.entities.Ride.filter(
          { driver_id: user.id, status: { $in: ACTIVE_RIDE_STATUSES } },
          "-created_date",
          1
        );
        if (active.length > 0) setActiveRide(active[0]);

        const locations = await base44.entities.DriverLocation.filter({ driver_id: user.id });
        if (locations.length > 0) {
          setDriverLocationId(locations[0].id);
          if (locations[0].online) setOnline(true);
          if (Number.isFinite(locations[0].lat) && Number.isFinite(locations[0].lng)) {
            setDriverPos({ lat: locations[0].lat, lng: locations[0].lng });
          }
        }
      } catch {
        // El estado local puede recuperarse en los siguientes eventos de la app.
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  // Poll temporal de solicitudes. Se reemplazará por Realtime en el siguiente checkpoint.
  useEffect(() => {
    if (!online || activeRide) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const rides = await base44.entities.Ride.filter({ status: "SEARCHING" }, "-created_date", 10);
        setAvailableRides(rides.filter((ride) => !silencedRides.current.has(ride.id)));
      } catch {
        // Realtime reemplazará este fallback.
      }
    };

    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [online, activeRide]);

  // Poll temporal del estado del viaje para reflejar cambios del pasajero/pago.
  useEffect(() => {
    if (!activeRide) return;

    const poll = async () => {
      try {
        const updated = await base44.entities.Ride.get(activeRide.id);
        if (updated) setActiveRide(updated);
      } catch {
        // Realtime reemplazará este fallback.
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [activeRide?.id]);

  useActiveRideGuard(!!activeRide);

  // Cuando cambia la fase de navegación, fijamos el punto de partida de la ruta una sola vez.
  // Esto evita recalcular Directions con cada actualización GPS.
  useEffect(() => {
    const phase = navigationPhase(activeRide?.status);
    if (!activeRide || !phase) {
      phaseRef.current = null;
      setNavigationStart(null);
      setRouteInfo(null);
      return;
    }

    if (phaseRef.current === `${activeRide.id}:${phase}`) return;
    phaseRef.current = `${activeRide.id}:${phase}`;
    setRouteInfo(null);

    let cancelled = false;
    getCurrentPosition({ enableHighAccuracy: true, maximumAge: 2000 })
      .then((position) => {
        if (cancelled) return;
        setDriverPos(position);
        setNavigationStart({ lat: position.lat, lng: position.lng });
      })
      .catch(() => {
        if (!cancelled && driverPos) {
          setNavigationStart({ lat: driverPos.lat, lng: driverPos.lng });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeRide?.id, activeRide?.status]);

  useEffect(() => {
    arrivalHitsRef.current = { pickup: 0, destination: 0 };
    transitionInFlightRef.current = false;
  }, [activeRide?.id, activeRide?.status]);

  // Auto-minimize info card during navigation so the map is fully visible
  useEffect(() => {
    const phase = navigationPhase(activeRide?.status);
    if (phase) setCardMinimized(true);
    if (!activeRide) setCardMinimized(false);
  }, [activeRide?.status, activeRide?.id]);

  // Un único watcher GPS alimenta la UI, detección de llegada y persistencia del Driver.
  // No hacemos una consulta GPS independiente cada 5/15 segundos.
  useEffect(() => {
    if (!online || !user?.id) return;
    let cancelled = false;

    const persistDriverLocation = async (position) => {
      if (!driverLocationId) return;
      const now = Date.now();
      if (now - lastLocationPersistRef.current < 15000) return;
      lastLocationPersistRef.current = now;

      try {
        await base44.entities.DriverLocation.update(driverLocationId, {
          lat: position.lat,
          lng: position.lng,
          online: true,
          vehicle_id: selectedVehicle?.id,
        });
      } catch {
        // La siguiente ventana de persistencia vuelve a intentar.
      }
    };

    const evaluateArrival = async (position) => {
      if (!activeRide || transitionInFlightRef.current) return;
      const accurateEnough = !Number.isFinite(position.accuracy) || position.accuracy <= 70;
      if (!accurateEnough) return;

      if (PICKUP_STATUSES.includes(activeRide.status)) {
        const distanceKm = haversineKm(
          position.lat,
          position.lng,
          activeRide.origin_lat,
          activeRide.origin_lng
        );
        arrivalHitsRef.current.pickup = distanceKm <= 0.08 ? arrivalHitsRef.current.pickup + 1 : 0;

        // Dos lecturas consecutivas reducen falsos positivos por rebote de GPS.
        if (arrivalHitsRef.current.pickup >= 2) {
          transitionInFlightRef.current = true;
          try {
            await base44.entities.Ride.update(activeRide.id, { status: "DRIVER_ARRIVED" });
            setActiveRide((previous) => previous ? { ...previous, status: "DRIVER_ARRIVED" } : previous);
            setRouteInfo(null);
            toast({
              title: "Llegaste al punto de encuentro",
              description: "Pedile al pasajero el PIN para iniciar el viaje.",
            });
          } catch {
            transitionInFlightRef.current = false;
          }
        }
        return;
      }

      if (activeRide.status === "IN_PROGRESS") {
        const distanceKm = haversineKm(
          position.lat,
          position.lng,
          activeRide.destination_lat,
          activeRide.destination_lng
        );
        arrivalHitsRef.current.destination = distanceKm <= 0.08 ? arrivalHitsRef.current.destination + 1 : 0;

        if (arrivalHitsRef.current.destination >= 2) {
          transitionInFlightRef.current = true;
          try {
            await base44.entities.Ride.update(activeRide.id, { status: "ARRIVED" });
            setActiveRide((previous) => previous ? { ...previous, status: "ARRIVED" } : previous);
            setRouteInfo(null);
            toast({
              title: "Llegaste al destino",
              description: "Confirmá la llegada para continuar con el cobro.",
            });
          } catch {
            transitionInFlightRef.current = false;
          }
        }
      }
    };

    const startWatching = async () => {
      try {
        positionWatchRef.current = await watchCurrentPosition(
          (position, error) => {
            if (cancelled || error || !position) return;
            setDriverPos(position);
            persistDriverLocation(position);
            evaluateArrival(position);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 1500,
            timeout: 15000,
            minimumUpdateInterval: activeRide ? 2500 : 5000,
          }
        );
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Ubicación no disponible",
            description: error.message,
            variant: "destructive",
          });
        }
      }
    };

    startWatching();

    return () => {
      cancelled = true;
      const handle = positionWatchRef.current;
      positionWatchRef.current = null;
      if (handle) clearPositionWatch(handle).catch(() => {});
    };
  }, [online, user?.id, selectedVehicle?.id, driverLocationId, activeRide?.id, activeRide?.status]);

  const handleGoOnline = async () => {
    if (!selectedVehicle) {
      toast({ title: "Necesitás un vehículo aprobado", variant: "destructive" });
      return;
    }

    try {
      const position = await getCurrentPosition({ enableHighAccuracy: true, maximumAge: 1000 });
      setDriverPos(position);

      const locations = await base44.entities.DriverLocation.filter({ driver_id: user.id });
      if (locations.length > 0) {
        await base44.entities.DriverLocation.update(locations[0].id, {
          lat: position.lat,
          lng: position.lng,
          online: true,
          vehicle_id: selectedVehicle.id,
        });
        setDriverLocationId(locations[0].id);
      } else {
        const created = await base44.entities.DriverLocation.create({
          driver_id: user.id,
          lat: position.lat,
          lng: position.lng,
          online: true,
          vehicle_id: selectedVehicle.id,
        });
        setDriverLocationId(created.id);
      }

      lastLocationPersistRef.current = Date.now();
      setOnline(true);
      toast({ title: "Estás online", description: "Buscando viajes..." });
    } catch (error) {
      toast({ title: "No pudimos activar el modo conductor", description: error.message, variant: "destructive" });
    }
  };

  const handleGoOffline = async () => {
    try {
      if (driverLocationId) {
        await base44.entities.DriverLocation.update(driverLocationId, { online: false });
      }
      setOnline(false);
      setAvailableRides([]);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleEnableNotif = async () => {
    setNotifAsked(true);
    if ("Notification" in window) {
      await Notification.requestPermission();
    }
    toast({ title: "Notificaciones activadas", description: "Te avisaremos cuando haya viajes cercanos" });
  };

  const handleRejectRide = (ride) => {
    silencedRides.current.add(ride.id);
    setAvailableRides((previous) => previous.filter((item) => item.id !== ride.id));
  };

  const handleSilenceRide = (ride) => {
    silencedRides.current.add(ride.id);
    setAvailableRides((previous) => previous.filter((item) => item.id !== ride.id));
  };

  const handleAcceptRide = async (ride) => {
    let position = driverPos;
    try {
      position = await getCurrentPosition({ enableHighAccuracy: true, maximumAge: 2000 });
    } catch {
      if (!driverPos) {
        toast({ title: "No se pudo obtener tu ubicación", description: "Activá el GPS e intentá nuevamente", variant: "destructive" });
        return;
      }
    }
    try {
      setDriverPos(position);
      setNavigationStart({ lat: position.lat, lng: position.lng });
      setRouteInfo(null);

      const updated = await base44.entities.Ride.update(ride.id, {
        status: "DRIVER_APPROACHING",
        driver_id: user.id,
        driver_name: user.full_name || user.email,
        vehicle_id: selectedVehicle.id,
        vehicle_plate: selectedVehicle.plate,
        vehicle_model: `${selectedVehicle.make} ${selectedVehicle.model}`,
        vehicle_color: selectedVehicle.color,
      });

      phaseRef.current = `${ride.id}:pickup`;
      setActiveRide(updated);
      setAvailableRides([]);
      toast({
        title: "Viaje aceptado",
        description: "Te guiamos hasta el punto de encuentro.",
      });
    } catch (error) {
      toast({ title: "No se pudo aceptar", description: error.message, variant: "destructive" });
    }
  };

  const handleArrived = async () => {
    if (!activeRide) return;
    try {
      await base44.entities.Ride.update(activeRide.id, { status: "DRIVER_ARRIVED" });
      setActiveRide({ ...activeRide, status: "DRIVER_ARRIVED" });
      setRouteInfo(null);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleValidatePin = async () => {
    if (pinInput !== activeRide.start_pin) {
      toast({ title: "PIN incorrecto", variant: "destructive" });
      return;
    }

    try {
      await base44.entities.Ride.update(activeRide.id, { status: "IN_PROGRESS" });
      const nextRide = { ...activeRide, status: "IN_PROGRESS" };
      setActiveRide(nextRide);
      setNavigationStart(driverPos ? { lat: driverPos.lat, lng: driverPos.lng } : null);
      setRouteInfo(null);
      phaseRef.current = `${activeRide.id}:destination`;
      setPinInput("");
      toast({
        title: "Viaje iniciado",
        description: "Ahora te guiamos hasta el destino.",
      });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDestinationArrived = async () => {
    if (!activeRide) return;
    try {
      await base44.entities.Ride.update(activeRide.id, { status: "ARRIVED" });
      setActiveRide({ ...activeRide, status: "ARRIVED" });
      setRouteInfo(null);
    } catch {
      toast({ title: "No se pudo confirmar la llegada", variant: "destructive" });
    }
  };

  const handleProceedToPayment = async () => {
    if (!activeRide) return;
    try {
      await base44.entities.Ride.update(activeRide.id, { status: "PAYMENT_PENDING" });
      setActiveRide({ ...activeRide, status: "PAYMENT_PENDING" });
    } catch {
      toast({ title: "No se pudo iniciar el cobro", variant: "destructive" });
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await base44.functions.invoke("completeRide", {
        ride_id: activeRide.id,
        final_fare: activeRide.quoted_fare,
        payment_method: activeRide.payment_method,
      });
      toast({
        title: "Viaje completado",
        description: `Ganaste $${activeRide.quoted_fare.toLocaleString("es-AR")}`,
      });
      setActiveRide(null);
      setNavigationStart(null);
      setRouteInfo(null);
    } catch (error) {
      toast({ title: "Error al completar", description: error.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeRide) return;
    try {
      await base44.entities.Ride.update(activeRide.id, {
        status: "CANCELLED",
        cancelled_date: new Date().toISOString(),
        cancel_reason: "driver_cancelled",
      });
      setActiveRide(null);
      setNavigationStart(null);
      setRouteInfo(null);
      setShowCancelDialog(false);
      toast({ title: "Viaje cancelado" });
    } catch {
      toast({ title: "No se pudo cancelar", variant: "destructive" });
    }
  };

  const formatPrice = (value) => `$${(value || 0).toLocaleString("es-AR")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center absolute inset-0">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!eligible) {
    const capability = user?.driver_capability || "NO_DRIVER";
    return (
      <div className="max-w-md mx-auto px-4 pt-10 pb-8 text-center h-full overflow-y-auto scrollbar-hide">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-xl font-bold mb-2">No estás habilitado para conducir</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {capability === "NO_DRIVER" && "Todavía no te postulaste como conductor."}
          {capability === "ONBOARDING" && "Tu postulación requiere más información."}
          {capability === "PENDING_REVIEW" && "Tu postulación está en revisión."}
          {capability === "APPROVED_BLOCKED" && "Tu cuenta tiene un bloqueo temporal (deuda o documentación)."}
          {capability === "SUSPENDED" && "Tu cuenta está suspendida."}
        </p>
        {capability === "NO_DRIVER" || capability === "ONBOARDING" ? (
          <Button onClick={() => navigate("/onboarding")} className="w-full bear-gold-gradient text-foreground border-0">
            Postularme como conductor
          </Button>
        ) : capability === "APPROVED_BLOCKED" ? (
          <Button onClick={() => navigate("/driver/earnings")} className="w-full bear-gold-gradient text-foreground border-0">
            Ver deuda y regularizar
          </Button>
        ) : null}
      </div>
    );
  }

  if (activeRide) {
    const status = activeRide.status;
    const phase = navigationPhase(status);
    const navigatingToPickup = phase === "pickup";
    const navigatingToDestination = phase === "destination";
    const isNavigating = navigatingToPickup || navigatingToDestination;
    const navigationTarget = navigatingToPickup
      ? { lat: activeRide.origin_lat, lng: activeRide.origin_lng }
      : navigatingToDestination
        ? { lat: activeRide.destination_lat, lng: activeRide.destination_lng }
        : null;
    const navigationTargetLabel = navigatingToPickup ? "Punto de encuentro" : "Destino";
    const navigationAddress = navigatingToPickup
      ? displayAddress(activeRide.origin_address)
      : displayAddress(activeRide.destination_address);

    return (
      <div className="absolute inset-0">
        <MapView
          origin={isNavigating ? navigationStart : { lat: activeRide.origin_lat, lng: activeRide.origin_lng }}
          destination={isNavigating ? navigationTarget : { lat: activeRide.destination_lat, lng: activeRide.destination_lng }}
          originLabel={isNavigating ? "" : "Origen"}
          destinationLabel={isNavigating ? navigationTargetLabel : "Destino"}
          showOriginMarker={!isNavigating}
          showDestinationMarker={true}
          driverPos={driverPos}
          interactive={true}
          followDriver={isNavigating}
          navigationZoom={15}
          onRouteInfo={setRouteInfo}
          className="absolute inset-0"
        />

        {isNavigating && (
          <TurnByTurnNav
            routeInfo={routeInfo}
            phaseLabel={navigatingToPickup ? "Ir a buscar al pasajero" : "En viaje al destino"}
            targetAddress={navigationAddress}
            remainingTime={routeInfo?.durationText}
            remainingDistance={routeInfo?.distanceText}
          />
        )}

        {cardMinimized && isNavigating && (
          <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
            <button
              onClick={() => setCardMinimized(false)}
              className="max-w-md mx-auto flex items-center gap-2 px-3 py-2 rounded-full bg-[#0e1320]/90 border border-white/10 text-white shadow-lg backdrop-blur-md"
            >
              <BearAvatar size={24} />
              <span className="font-medium text-xs truncate flex-1 text-left">{activeRide.passenger_name || "Pasajero"}</span>
              <span className="text-xs font-bold text-accent shrink-0">{formatPrice(activeRide.quoted_fare)}</span>
              <ChevronUp className="w-3.5 h-3.5 text-white/40 shrink-0" />
            </button>
          </div>
        )}
        {!cardMinimized && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <Card className="rounded-2xl p-4 max-w-md mx-auto">
            {isNavigating && (
              <button onClick={() => setCardMinimized(true)} className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground mb-3">
                <ChevronDown className="w-4 h-4" /> Minimizar
              </button>
            )}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent capitalize">
                {status.replace(/_/g, " ")}
              </span>
              <span className="font-bold text-lg text-accent">{formatPrice(activeRide.quoted_fare)}</span>
            </div>

            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border">
              <BearAvatar size={40} />
              <div>
                <p className="font-medium text-sm">{activeRide.passenger_name || "Pasajero"}</p>
                <p className="text-xs text-muted-foreground">Pasajero</p>
              </div>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <p className="text-muted-foreground truncate">
                <MapPin className="w-3.5 h-3.5 inline mr-1 shrink-0" />
                {displayAddress(activeRide.origin_address)}
              </p>
              <p className="text-muted-foreground truncate">
                <Navigation className="w-3.5 h-3.5 inline mr-1 shrink-0" />
                {displayAddress(activeRide.destination_address)}
              </p>
              <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                <span><Clock className="w-3 h-3 inline mr-1" />{activeRide.duration_min} min</span>
                <span><MapPin className="w-3 h-3 inline mr-1" />{activeRide.distance_km} km</span>
                <span className="capitalize flex items-center gap-1">
                  {activeRide.payment_method === "card" && <CreditCard className="w-3 h-3" />}
                  {activeRide.payment_method === "cash" && <Banknote className="w-3 h-3" />}
                  {activeRide.payment_method === "qr" && <QrCode className="w-3 h-3" />}
                  {activeRide.payment_method === "card"
                    ? "Tarjeta"
                    : activeRide.payment_method === "cash"
                      ? "Efectivo"
                      : "QR"}
                </span>
              </div>
            </div>

            {PICKUP_STATUSES.includes(status) && (
              <div>
                <p className="text-sm text-center text-muted-foreground mb-3">
                  Seguí la guía hasta el punto de encuentro. La llegada se detecta automáticamente.
                </p>
                <Button onClick={handleArrived} variant="outline" className="w-full">
                  Marcar “Llegué” manualmente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full mt-2 text-destructive text-sm"
                >
                  Cancelar viaje
                </Button>
              </div>
            )}

            {status === "DRIVER_ARRIVED" && (
              <div>
                <p className="text-sm text-center text-muted-foreground mb-3">
                  Estás en el punto de encuentro. Pedile al pasajero el PIN de inicio:
                </p>
                <div className="flex gap-2">
                  <Input
                    value={pinInput}
                    onChange={(event) => setPinInput(event.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    placeholder="PIN de 4 dígitos"
                    maxLength={4}
                    className="text-center text-lg tracking-widest"
                  />
                  <Button
                    onClick={handleValidatePin}
                    disabled={pinInput.length !== 4}
                    className="bear-gold-gradient text-foreground border-0"
                  >
                    <KeyRound className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {status === "IN_PROGRESS" && (
              <div>
                <p className="text-sm text-center text-muted-foreground mb-3">
                  Seguí la guía hasta el destino. BearDrive detectará la llegada automáticamente.
                </p>
                <Button onClick={handleDestinationArrived} variant="outline" className="w-full">
                  Marcar llegada manualmente
                </Button>
              </div>
            )}

            {status === "ARRIVED" && (
              <div className="text-center">
                <Navigation className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-sm font-medium mb-1">Llegaste al destino</p>
                <p className="text-xs text-muted-foreground mb-3">Continuá con el cobro para cerrar el viaje.</p>
                <Button onClick={handleProceedToPayment} className="w-full bear-gold-gradient text-foreground border-0">
                  Continuar al cobro
                </Button>
              </div>
            )}

            {status === "PAYMENT_PENDING" && (
              <div className="text-center">
                {activeRide.payment_method === "card" ? (
                  <>
                    <Loader2 className="w-8 h-8 text-accent mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground mb-1">Esperando pago con tarjeta</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      El pasajero está pagando. El viaje se completará automáticamente.
                    </p>
                  </>
                ) : (
                  <>
                    <Wallet className="w-8 h-8 text-accent mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-3 capitalize">
                      {activeRide.payment_method === "cash" ? "Cobrá en efectivo" : "Generá el QR de pago"}
                    </p>
                    <Button
                      onClick={handleComplete}
                      disabled={completing}
                      className="w-full bear-gold-gradient text-foreground border-0"
                    >
                      {completing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirmando...</>
                      ) : (
                        "Confirmar pago"
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
        )}

        <CancelRideDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancel}
          isDriver={true}
        />
      </div>
    );
  }

  if (online && !activeRide) {
    const incomingRide = availableRides[0];
    return (
      <div className="absolute inset-0">
        <MapView
          driverPos={driverPos}
          recenter={driverPos}
          interactive={true}
          className="absolute inset-0"
        />

        <div className="absolute inset-x-0 top-0 z-10 p-3 safe-top">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-navy">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-white">Online</span>
            </div>
            <Button
              onClick={handleGoOffline}
              size="sm"
              className="rounded-full glass-navy border-0 text-white hover:text-white"
            >
              Desconectarme
            </Button>
          </div>
        </div>

        {!notifAsked && (
          <div className="absolute inset-x-0 top-16 z-10 p-3">
            <Card className="p-4 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">¿Recibir notificaciones de viajes?</p>
                  <p className="text-xs text-muted-foreground mb-3">Te avisaremos cuando haya solicitudes cercanas</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleEnableNotif}
                      className="bear-gold-gradient text-foreground border-0"
                    >
                      Sí, activar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNotifAsked(true)}>Ahora no</Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {!incomingRide && (
          <div className="absolute inset-x-0 bottom-0 z-10 p-3">
            <Card className="rounded-2xl p-4 max-w-md mx-auto text-center">
              <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Esperando solicitudes de viaje...</p>
            </Card>
          </div>
        )}

        {incomingRide && (
          <RideRequestModal
            ride={incomingRide}
            driverPos={driverPos}
            onAccept={() => handleAcceptRide(incomingRide)}
            onReject={() => handleRejectRide(incomingRide)}
            onSilence={() => handleSilenceRide(incomingRide)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-8 animate-fade-in h-full overflow-y-auto scrollbar-hide">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Conducir</h1>
        <div className="px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground">
          ○ Offline
        </div>
      </div>

      {vehicles.length > 0 && (
        <Card className="p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-2">Vehículo</p>
          <select
            value={selectedVehicle?.id || ""}
            onChange={(event) => setSelectedVehicle(vehicles.find((vehicle) => vehicle.id === event.target.value))}
            className="w-full bg-transparent text-sm font-medium outline-none"
          >
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.make} {vehicle.model} · {vehicle.plate}
              </option>
            ))}
          </select>
        </Card>
      )}

      {vehicles.length === 0 && (
        <Card className="p-5 mb-4 text-center">
          <Car className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tenés vehículos aprobados</p>
        </Card>
      )}

      <Card className="p-8 text-center">
        <div className="w-16 h-16 rounded-full bear-gradient flex items-center justify-center mx-auto mb-4">
          <Power className="w-8 h-8 text-accent" />
        </div>
        <h2 className="font-bold text-lg mb-2">Conectate para recibir viajes</h2>
        <p className="text-sm text-muted-foreground mb-5">Cuando estés online vas a recibir solicitudes cercanas</p>
        <Button
          onClick={handleGoOnline}
          disabled={vehicles.length === 0}
          className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold"
        >
          Conectarme
        </Button>
      </Card>
    </div>
  );
}