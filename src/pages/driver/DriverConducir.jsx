import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import MapView from "@/components/bear/MapView";
import Haptics from "@/lib/haptics";
import navVoice from "@/lib/navVoice";
import { useWakeLock } from "@/hooks/useWakeLock";
import {
  Car,
  Check,
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
  Map as MapIcon,
  MessageCircle,
  Sun,
  Moon,
  Radio,
  Zap,
  ShieldCheck,
} from "lucide-react";
import {
  getCurrentPosition,
  watchCurrentPosition,
  clearPositionWatch,
  displayAddress,
} from "@/lib/geo";
import CancelRideDialog from "@/components/bear/CancelRideDialog";
import { useActiveRideGuard } from "@/hooks/useActiveRideGuard";
import { useBackoffPoll } from "@/hooks/useBackoffPoll";
import { useRideSubscription } from "@/hooks/useRideSubscription";
import BearAvatar from "@/components/bear/BearAvatar";
import RideRequestModal from "@/components/bear/RideRequestModal";
import TurnByTurnNav from "@/components/bear/TurnByTurnNav";
import LoadingScreen from "@/components/bear/LoadingScreen";
import RideChat from "@/components/bear/RideChat";
import QrPaymentDisplay from "@/components/bear/QrPaymentDisplay";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function computeBearing(from, to) {
  const toRad = (v) => (v * Math.PI) / 180;
  const toDeg = (v) => (v * 180) / Math.PI;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
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
  const [navMode, setNavMode] = useState("gps");
  const [navHeading, setNavHeading] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [qrCheckoutUrl, setQrCheckoutUrl] = useState(null);
  const [driverSolarMode, setDriverSolarMode] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("bear_driver_solar") === "true"
  );
  const { isLocked: isScreenAwake } = useWakeLock(online || !!activeRide);

  const positionWatchRef = useRef(null);
  const lastLocationPersistRef = useRef(0);
  const silencedRides = useRef(new Set());
  const prevPosRef = useRef(null);
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

  // Poll de solicitudes cercanas con backoff exponencial ante fallos de red.
  // Solo se ofrecen viajes dentro del radio de proximidad al conductor.
  useBackoffPoll(
    async () => {
      if (!driverPos) return;
      try {
        const res = await base44.functions.invoke("getNearbyRideRequests", {
          lat: driverPos.lat,
          lng: driverPos.lng,
          radius_km: 15,
        });
        const rides = res.data?.rides || [];
        setAvailableRides(rides.filter((ride) => !silencedRides.current.has(ride.id)));
      } catch {
        // Se mantiene la lista anterior ante errores transitorios de red.
      }
    },
    { enabled: online && !activeRide, baseDelay: 4000, maxDelay: 30000 }
  );

  // Realtime ride status subscription — primary sync mechanism (replaces 3s polling).
  // A 15s fallback poll inside the hook covers recovery if a realtime event is missed.
  useRideSubscription(activeRide?.id, (updated) => {
    if (updated) setActiveRide(updated);
  });

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

  // Auto-minimize info card during navigation so the map is fully visible.
  // Expand it again when navigation ends (DRIVER_ARRIVED, ARRIVED, PAYMENT_PENDING)
  // so the PIN input and payment actions are immediately visible.
  useEffect(() => {
    const phase = navigationPhase(activeRide?.status);
    if (phase) {
      setCardMinimized(true);
    } else if (activeRide) {
      setCardMinimized(false);
    }
  }, [activeRide?.status, activeRide?.id]);

  // Un único watcher GPS alimenta la UI, detección de llegada y persistencia del Driver.
  // No hacemos una consulta GPS independiente cada 5/15 segundos.
  useEffect(() => {
    if (!online || !user?.id) return;
    let cancelled = false;

    const persistDriverLocation = async (position) => {
      if (!driverLocationId) return;
      const now = Date.now();
      const persistInterval = activeRide ? 4000 : 15000;
      if (now - lastLocationPersistRef.current < persistInterval) return;
      lastLocationPersistRef.current = now;

      try {
        await base44.entities.DriverLocation.update(driverLocationId, {
          lat: position.lat,
          lng: position.lng,
          online: true,
          vehicle_id: selectedVehicle?.id,
          heading: Number.isFinite(position.heading) ? position.heading : null,
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
            await base44.functions.invoke("transitionRideStatus", {
              ride_id: activeRide.id, target_status: "DRIVER_ARRIVED",
            });
            navVoice.announceArrival(true);
            Haptics.arrival();
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
            await base44.functions.invoke("transitionRideStatus", {
              ride_id: activeRide.id, target_status: "ARRIVED",
            });
            navVoice.announceArrival(false);
            Haptics.arrival();
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

            // Descartar lecturas de baja precisión para el marcador y la navegación.
            const accuracy = Number.isFinite(position.accuracy) ? position.accuracy : 999;
            const isAccurate = accuracy <= 50;

            if (isAccurate) {
              setDriverPos(position);
            } else if (!prevPosRef.current) {
              // Primera lectura aunque sea imprecisa: mejor algo que nada.
              setDriverPos(position);
            }

            if (prevPosRef.current) {
              const movedKm = haversineKm(prevPosRef.current.lat, prevPosRef.current.lng, position.lat, position.lng);
              const movedM = movedKm * 1000;
              // Prefer the device GPS heading when valid; fall back to computed bearing
              // from position deltas once the driver moves enough to be reliable.
              if (Number.isFinite(position.heading) && position.heading >= 0 && movedM > 3) {
                setNavHeading(position.heading);
              } else if (isAccurate && movedM > 10) {
                const bearing = computeBearing(prevPosRef.current, position);
                if (Number.isFinite(bearing)) setNavHeading(bearing);
              }
            }
            prevPosRef.current = position;
            persistDriverLocation(position);
            evaluateArrival(position);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000,
            minimumUpdateInterval: activeRide ? 2000 : 4000,
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

    // Optimistic: show online state immediately, roll back on error
    setOnline(true);
    try {
      const position = await getCurrentPosition({ enableHighAccuracy: true, maximumAge: 1000 });
      setDriverPos(position);

      const res = await base44.functions.invoke("driverGoOnline", {
        lat: position.lat,
        lng: position.lng,
        vehicle_id: selectedVehicle.id,
      });

      setDriverLocationId(res.data.driver_location.id);
      lastLocationPersistRef.current = Date.now();
      toast({ title: "Estás online", description: "Buscando viajes..." });
    } catch (error) {
      setOnline(false);
      const msg = error?.response?.data?.error || error.message;
      const reason = error?.response?.data?.reason;
      if (reason === "blocking_debt") {
        toast({ title: msg, description: "Regularizá tu deuda para conducir", variant: "destructive" });
      } else {
        toast({ title: "No pudimos activar el modo conductor", description: msg, variant: "destructive" });
      }
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

      const res = await base44.functions.invoke("acceptRide", {
        ride_id: ride.id,
        vehicle_id: selectedVehicle.id,
        vehicle_plate: selectedVehicle.plate,
        vehicle_model: `${selectedVehicle.make} ${selectedVehicle.model}`,
        vehicle_color: selectedVehicle.color,
      });

      phaseRef.current = `${ride.id}:pickup`;
      setActiveRide(res.data.ride);
      setAvailableRides([]);
      toast({
        title: "Viaje aceptado",
        description: "Te guiamos hasta el punto de encuentro.",
      });
    } catch (error) {
      const msg = error?.response?.data?.error || error.message;
      toast({ title: "No se pudo aceptar", description: msg, variant: "destructive" });
    }
  };

  const handleArrived = async () => {
    if (!activeRide) return;
    try {
      const res = await base44.functions.invoke("transitionRideStatus", {
        ride_id: activeRide.id, target_status: "DRIVER_ARRIVED",
      });
      setActiveRide(res.data.ride);
      setRouteInfo(null);
    } catch (error) {
      toast({ title: "Error", description: error?.message, variant: "destructive" });
    }
  };

  const handleValidatePin = async () => {
    try {
      const res = await base44.functions.invoke("validateRidePin", {
        ride_id: activeRide.id, pin: pinInput,
      });
      setActiveRide(res.data.ride);
      setNavigationStart(driverPos ? { lat: driverPos.lat, lng: driverPos.lng } : null);
      setRouteInfo(null);
      phaseRef.current = `${activeRide.id}:destination`;
      setPinInput("");
      toast({
        title: "Viaje iniciado",
        description: "Ahora te guiamos hasta el destino.",
      });
    } catch (error) {
      const msg = error?.response?.data?.error || error.message;
      toast({ title: msg, variant: "destructive" });
    }
  };

  const handleDestinationArrived = async () => {
    if (!activeRide) return;
    try {
      const res = await base44.functions.invoke("transitionRideStatus", {
        ride_id: activeRide.id, target_status: "ARRIVED",
      });
      setActiveRide(res.data.ride);
      setRouteInfo(null);
    } catch (error) {
      toast({ title: "No se pudo confirmar la llegada", description: error?.message, variant: "destructive" });
    }
  };

  const handleProceedToPayment = async () => {
    if (!activeRide) return;
    try {
      const res = await base44.functions.invoke("transitionRideStatus", {
        ride_id: activeRide.id, target_status: "PAYMENT_PENDING",
      });
      setActiveRide(res.data.ride);
    } catch (error) {
      toast({ title: "No se pudo iniciar el cobro", description: error?.message, variant: "destructive" });
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await base44.functions.invoke("completeRide", {
        ride_id: activeRide.id,
      });

      const paymentStatus = res.data?.payment_status;

      if (paymentStatus === "completed") {
        toast({
          title: "Viaje completado",
          description: `Ganaste $${(activeRide.final_fare || activeRide.quoted_fare).toLocaleString("es-AR")}`,
        });
        setActiveRide(null);
        setNavigationStart(null);
        setRouteInfo(null);
        setQrCheckoutUrl(null);
      } else if (paymentStatus === "qr_pending") {
        setQrCheckoutUrl(res.data.checkout_url);
        toast({ title: "QR generado", description: "Mostrale el QR al pasajero" });
      } else if (paymentStatus === "requires_action") {
        toast({ title: "Pago requiere autenticación", description: res.data.message, variant: "destructive" });
      } else {
        toast({ title: "Viaje completado" });
        setActiveRide(null);
        setNavigationStart(null);
        setRouteInfo(null);
      }
    } catch (error) {
      const msg = error?.response?.data?.error || error.message;
      const reason = error?.response?.data?.reason;
      if (reason === "no_card") {
        toast({ title: "El pasajero no tiene tarjeta vinculada", description: "Sugerile pagar con QR o efectivo", variant: "destructive" });
      } else {
        toast({ title: "Error al completar", description: msg, variant: "destructive" });
      }
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeRide) return;
    try {
      const res = await base44.functions.invoke("driverCancelRide", { ride_id: activeRide.id });
      if (res.data?.re_searched) {
        toast({ title: "Viaje reasignado", description: "Buscando otro conductor para el pasajero" });
      } else {
        toast({ title: "Viaje cancelado" });
      }
      setActiveRide(null);
      setNavigationStart(null);
      setRouteInfo(null);
      setShowCancelDialog(false);
    } catch (error) {
      toast({ title: "No se pudo cancelar", description: error.message, variant: "destructive" });
    }
  };

  const formatPrice = (value) => `$${(value || 0).toLocaleString("es-AR")}`;

  if (loading) {
    return <LoadingScreen className="absolute inset-0" label="Preparando..." />;
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

    const etaString = routeInfo?.durationSeconds
      ? new Date(Date.now() + routeInfo.durationSeconds * 1000).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      : null;

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
          navigationZoom={navMode === "gps" ? 18 : 15}
          onRouteInfo={setRouteInfo}
          tilt={navMode === "gps" && isNavigating ? 48 : 0}
          heading={navMode === "gps" && isNavigating ? navHeading : 0}
          mapTheme={driverSolarMode ? "light" : "dark"}
          className="absolute inset-0"
        />

        {/* Turn-by-turn navigation HUD (top) */}
        {isNavigating && (
          <>
            {navMode === "gps" && (
              <TurnByTurnNav
                routeInfo={routeInfo}
                phaseLabel={navigatingToPickup ? "Hacia el pasajero" : "Rumbo al destino"}
                targetAddress={navigationAddress}
                remainingTime={routeInfo?.durationText}
                remainingDistance={routeInfo?.distanceText}
              />
            )}
            <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+8.5rem)] z-20 flex flex-col items-end gap-2">
              <button
                onClick={() => {
                  Haptics.light();
                  setNavMode(navMode === "gps" ? "normal" : "gps");
                }}
                className="flex items-center gap-1.5 rounded-full bg-[#0e1320]/90 backdrop-blur-md px-3 py-2 text-xs font-semibold text-white shadow-xl border border-white/10 active:scale-95 transition"
              >
                {navMode === "gps" ? <MapIcon className="w-4 h-4 text-accent" /> : <Navigation className="w-4 h-4 text-accent" />}
                {navMode === "gps" ? "Vista 2D" : "Modo 3D"}
              </button>

              <button
                onClick={() => {
                  Haptics.light();
                  const next = !driverSolarMode;
                  setDriverSolarMode(next);
                  try {
                    localStorage.setItem("bear_driver_solar", String(next));
                  } catch {}
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold shadow-xl border active:scale-95 transition ${
                  driverSolarMode
                    ? "bg-[#E9B74E] text-[#181E2F] border-[#E9B74E] font-bold"
                    : "bg-[#0e1320]/90 backdrop-blur-md text-white border-white/10"
                }`}
                title={driverSolarMode ? "Modo Deep Navy / Noche" : "Modo Sol / Alto contraste exterior"}
              >
                {driverSolarMode ? <Sun className="w-4 h-4 fill-current text-[#181E2F]" /> : <Moon className="w-4 h-4 text-accent" />}
                {driverSolarMode ? "Modo Sol" : "Modo Noche"}
              </button>
            </div>
          </>
        )}

        {/* NATIVE DRIVER HUD BOTTOM BAR (when navigating to pickup or destination) */}
        {isNavigating && (
          <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none">
            <div className="max-w-md mx-auto rounded-3xl bg-[#0e1320]/95 backdrop-blur-md border border-accent/30 p-4 shadow-2xl space-y-3 pointer-events-auto">
              {/* Top row: ETA + Remaining time & distance + Quick actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  {etaString && (
                    <span className="text-2xl font-black text-accent tracking-tight">
                      {etaString}
                    </span>
                  )}
                  <span className="text-xs font-bold text-white/90">
                    {routeInfo?.durationText || `${activeRide.duration_min} min`}
                  </span>
                  <span className="text-white/30 text-xs">•</span>
                  <span className="text-xs font-semibold text-white/60">
                    {routeInfo?.distanceText || `${activeRide.distance_km} km`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowChat(true)}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white relative active:scale-95 transition"
                    aria-label="Chat con pasajero"
                  >
                    <MessageCircle className="w-4 h-4 text-accent" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardMinimized(!cardMinimized)}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 active:scale-95 transition"
                    aria-label="Detalles del viaje"
                  >
                    {cardMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Target address pill */}
              <div className="flex items-center gap-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full bg-accent shrink-0 animate-pulse" />
                <p className="text-xs font-medium text-white/90 truncate flex-1">
                  <span className="text-white/50">{navigatingToPickup ? "Recogida: " : "Destino: "}</span>
                  {navigationAddress}
                </p>
              </div>

              {/* Main Driver Action Button (large single-touch target) */}
              {PICKUP_STATUSES.includes(status) && (
                <Button
                  type="button"
                  onClick={() => {
                    Haptics.success();
                    handleArrived();
                  }}
                  className="w-full h-12 bear-gold-gradient text-foreground border-0 font-extrabold text-sm shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  Marcar “Llegué al punto de encuentro”
                </Button>
              )}

              {status === "IN_PROGRESS" && (
                <Button
                  type="button"
                  onClick={() => {
                    Haptics.success();
                    handleDestinationArrived();
                  }}
                  className="w-full h-12 bear-gold-gradient text-foreground border-0 font-extrabold text-sm shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  Marcar “Llegué al destino”
                </Button>
              )}

              {/* Expanded details drawer (visible when expanded) */}
              {!cardMinimized && (
                <div className="pt-2.5 border-t border-white/10 space-y-2 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-white/70">
                    <span>Pasajero: <strong className="text-white">{activeRide.passenger_name || "Pasajero"}</strong></span>
                    <span className="text-accent font-bold">{formatPrice(activeRide.quoted_fare)}</span>
                  </div>
                  {activeRide.notes && (
                    <p className="p-2 rounded-xl bg-white/5 text-white/85 border border-white/10 italic text-[11px]">
                      {activeRide.notes}
                    </p>
                  )}
                  <div className="flex justify-between items-center pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCancelDialog(true)}
                      className="text-red-400 hover:underline text-[11px]"
                    >
                      Cancelar viaje
                    </button>
                    {navigationTarget && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${navigationTarget.lat},${navigationTarget.lng}&travelmode=driving`;
                          window.open(url, "_blank");
                        }}
                        className="text-white/40 hover:text-white/70 text-[11px] underline"
                      >
                        Abrir en app externa
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FOCUSED ACTION CARDS (when arrived, validating PIN, or payment pending) */}
        {!isNavigating && (
          <div className="absolute inset-x-0 bottom-0 z-20 p-3">
            <Card className="rounded-3xl p-5 max-w-md mx-auto shadow-2xl border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent capitalize">
                  {status.replace(/_/g, " ")}
                </span>
                <span className="font-bold text-lg text-accent">{formatPrice(activeRide.quoted_fare)}</span>
              </div>

              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                <BearAvatar size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{activeRide.passenger_name || "Pasajero"}</p>
                  <p className="text-xs text-muted-foreground">Pasajero</p>
                </div>
                <button
                  onClick={() => setShowChat(true)}
                  className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center no-select shrink-0"
                  aria-label="Chat con pasajero"
                >
                  <MessageCircle className="w-5 h-5 text-accent" />
                </button>
              </div>

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
                      className="text-center text-xl tracking-widest font-mono font-black h-12"
                    />
                    <Button
                      onClick={handleValidatePin}
                      disabled={pinInput.length !== 4}
                      className="bear-gold-gradient text-foreground border-0 h-12 px-5 font-bold"
                    >
                      <KeyRound className="w-5 h-5 mr-1" />
                      Iniciar
                    </Button>
                  </div>
                </div>
              )}

              {status === "ARRIVED" && (
                <div className="text-center">
                  <Navigation className="w-8 h-8 text-accent mx-auto mb-2" />
                  <p className="text-sm font-medium mb-1">Llegaste al destino</p>
                  <p className="text-xs text-muted-foreground mb-3">Continuá con el cobro para cerrar el viaje.</p>
                  <Button onClick={handleProceedToPayment} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-bold">
                    Continuar al cobro
                  </Button>
                </div>
              )}

            {status === "PAYMENT_PENDING" && (
              <div className="text-center">
                {qrCheckoutUrl ? (
                  <QrPaymentDisplay
                    checkoutUrl={qrCheckoutUrl}
                    amount={activeRide.final_fare || activeRide.quoted_fare}
                    rideId={activeRide.id}
                    onClose={() => setQrCheckoutUrl(null)}
                  />
                ) : activeRide.payment_method === "card" ? (
                  <>
                    <CreditCard className="w-8 h-8 text-accent mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Cobro automático a la tarjeta del pasajero
                    </p>
                    <Button
                      onClick={handleComplete}
                      disabled={completing}
                      className="w-full bear-gold-gradient text-foreground border-0"
                    >
                      {completing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cobrando...</>
                      ) : (
                        "Confirmar cobro automático"
                      )}
                    </Button>
                  </>
                ) : activeRide.payment_method === "qr" ? (
                  <>
                    <QrCode className="w-8 h-8 text-accent mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Generá el QR para que el pasajero pague
                    </p>
                    <Button
                      onClick={handleComplete}
                      disabled={completing}
                      className="w-full bear-gold-gradient text-foreground border-0"
                    >
                      {completing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</>
                      ) : (
                        "Generar QR de pago"
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Wallet className="w-8 h-8 text-accent mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Cobrá en efectivo
                    </p>
                    <Button
                      onClick={handleComplete}
                      disabled={completing}
                      className="w-full bear-gold-gradient text-foreground border-0"
                    >
                      {completing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirmando...</>
                      ) : (
                        "Confirmar pago recibido"
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
        {showChat && (
          <RideChat
            rideId={activeRide.id}
            userId={user.id}
            peerName={activeRide.passenger_name}
            onClose={() => setShowChat(false)}
          />
        )}
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
          mapTheme={driverSolarMode ? "light" : "dark"}
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

        {/* Radar concéntrico animado de 15 km sobre el mapa */}
        {!incomingRide && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-[5]">
            <div className="relative w-72 h-72 flex items-center justify-center">
              <span
                className="absolute w-80 h-80 rounded-full border-2 border-accent/20 animate-ping opacity-60"
                style={{ animationDuration: "3.2s" }}
              />
              <span
                className="absolute w-56 h-56 rounded-full border border-accent/30 animate-pulse"
                style={{ animationDuration: "2s" }}
              />
              <span className="absolute w-36 h-36 rounded-full border border-accent/40 bg-accent/5 animate-pulse" />
              <div className="w-12 h-12 rounded-full bg-accent/20 border border-accent/60 flex items-center justify-center shadow-lg shadow-accent/20">
                <Radio className="w-5 h-5 text-accent animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* HUD de Espera Activa con Radar 15km y WakeLock */}
        {!incomingRide && (
          <div className="absolute inset-x-0 bottom-0 z-10 p-3 pb-5 safe-bottom">
            <Card className="rounded-3xl p-4 max-w-md mx-auto border border-accent/20 bg-card/90 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center border border-accent/40 shrink-0">
                    <Radio className="w-4 h-4 text-accent animate-spin" style={{ animationDuration: "6s" }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      Radar de Viajes Activo
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Escaneando en Formosa • Cobertura 15 km
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border text-[11px] font-semibold text-foreground shrink-0">
                  <Zap className={`w-3.5 h-3.5 ${isScreenAwake ? "text-accent fill-accent" : "text-muted-foreground"}`} />
                  <span>{isScreenAwake ? "Pantalla activa" : "Modo auto"}</span>
                </div>
              </div>

              {selectedVehicle && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/40 border border-border/40 text-xs">
                  <div className="flex items-center gap-2">
                    <Car className="w-3.5 h-3.5 text-accent" />
                    <span className="font-semibold text-foreground">
                      {selectedVehicle.brand} {selectedVehicle.model}
                    </span>
                  </div>
                  <span className="font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {selectedVehicle.plate}
                  </span>
                </div>
              )}
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
          <Select
            value={selectedVehicle?.id || ""}
            onValueChange={(val) => setSelectedVehicle(vehicles.find((v) => v.id === val))}
          >
            <SelectTrigger className="w-full h-11 text-sm font-medium border-0 bg-transparent focus:ring-0">
              <SelectValue placeholder="Seleccionar vehículo" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.make} {vehicle.model} · {vehicle.plate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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