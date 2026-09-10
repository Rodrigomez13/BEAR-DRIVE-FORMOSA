import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import MapView from "@/components/bear/MapView";
import { Car, Power, Loader2, MapPin, Clock, DollarSign, Navigation, CheckCircle2, KeyRound, X, AlertTriangle, Wallet, CreditCard, Banknote, QrCode, Bell } from "lucide-react";
import { getCurrentPosition, FORMOSA_CENTER, displayAddress } from "@/lib/geo";
import CancelRideDialog from "@/components/bear/CancelRideDialog";
import { useActiveRideGuard } from "@/hooks/useActiveRideGuard";
import BearAvatar from "@/components/bear/BearAvatar";
import { BEAR_MASCOT_WAVE } from "@/lib/brandAssets";
import { Image } from "@/components/ui/image";
import RideRequestModal from "@/components/bear/RideRequestModal";

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
  const [driverPos, setDriverPos] = useState(FORMOSA_CENTER);
  const [notifAsked, setNotifAsked] = useState(false);
  const pollRef = useRef(null);
  const posRef = useRef(null);
  const silencedRides = useRef(new Set());

  const eligible = user?.driver_capability === "APPROVED_ELIGIBLE";

  useEffect(() => {
    const load = async () => {
      try {
        const v = await base44.entities.Vehicle.filter({ driver_id: user.id, status: "approved" });
        setVehicles(v);
        if (v.length > 0) setSelectedVehicle(v[0]);
        // Check active ride
        const active = await base44.entities.Ride.filter({ driver_id: user.id, status: { $in: ["ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING", "PIN_VALIDATION", "IN_PROGRESS", "ARRIVED", "PAYMENT_PENDING"] } }, "-created_date", 1);
        if (active.length > 0) setActiveRide(active[0]);
        // Check if online
        const locs = await base44.entities.DriverLocation.filter({ driver_id: user.id });
        if (locs.length > 0 && locs[0].online) setOnline(true);
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Poll for available rides when online and no active ride
  useEffect(() => {
    if (!online || activeRide) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const rides = await base44.entities.Ride.filter({ status: "SEARCHING" }, "-created_date", 10);
        setAvailableRides(rides.filter(r => !silencedRides.current.has(r.id)));
      } catch (err) { /* ignore */ }
    };
    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [online, activeRide]);

  // Poll active ride
  useEffect(() => {
    if (!activeRide) return;
    const poll = async () => {
      try {
        const updated = await base44.entities.Ride.get(activeRide.id);
        if (updated) setActiveRide(updated);
      } catch (err) { /* ignore */ }
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [activeRide?.id]);

  // Guard against closing app during active ride
  useActiveRideGuard(!!activeRide);

  // Auto-arrived and auto-complete based on GPS proximity
  useEffect(() => {
    if (!activeRide || !online) return;
    const status = activeRide.status;
    if (!["ASSIGNED", "DRIVER_APPROACHING", "IN_PROGRESS"].includes(status)) return;

    const checkProximity = async () => {
      try {
        const pos = await getCurrentPosition();
        setDriverPos(pos);

        if (["ASSIGNED", "DRIVER_APPROACHING"].includes(activeRide.status)) {
          const distToOrigin = haversineKm(pos.lat, pos.lng, activeRide.origin_lat, activeRide.origin_lng);
          if (distToOrigin <= 0.1) {
            await base44.entities.Ride.update(activeRide.id, { status: "DRIVER_ARRIVED" });
            setActiveRide(prev => ({ ...prev, status: "DRIVER_ARRIVED" }));
            toast({ title: "Llegaste al punto de encuentro" });
          }
        } else if (activeRide.status === "IN_PROGRESS") {
          const distToDest = haversineKm(pos.lat, pos.lng, activeRide.destination_lat, activeRide.destination_lng);
          if (distToDest <= 0.1) {
            await base44.functions.invoke("completeRide", { ride_id: activeRide.id, final_fare: activeRide.quoted_fare, payment_method: activeRide.payment_method });
            toast({ title: "Viaje completado", description: `Ganaste $${activeRide.quoted_fare.toLocaleString("es-AR")}` });
            setActiveRide(null);
          }
        }
      } catch (err) { /* ignore */ }
    };

    checkProximity();
    const interval = setInterval(checkProximity, 5000);
    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status, online]);

  // Update driver position when online
  useEffect(() => {
    if (!online) return;
    const updatePos = async () => {
      try {
        const pos = await getCurrentPosition();
        setDriverPos(pos);
        const locs = await base44.entities.DriverLocation.filter({ driver_id: user.id });
        if (locs.length > 0) {
          await base44.entities.DriverLocation.update(locs[0].id, { lat: pos.lat, lng: pos.lng, online: true, vehicle_id: selectedVehicle?.id });
        }
      } catch (err) { /* ignore */ }
    };
    updatePos();
    posRef.current = setInterval(updatePos, 15000);
    return () => { if (posRef.current) clearInterval(posRef.current); };
  }, [online, selectedVehicle, user]);

  const handleGoOnline = async () => {
    if (!selectedVehicle) {
      toast({ title: "Necesitás un vehículo aprobado", variant: "destructive" });
      return;
    }
    try {
      const pos = await getCurrentPosition().catch(() => FORMOSA_CENTER);
      setDriverPos(pos);
      const locs = await base44.entities.DriverLocation.filter({ driver_id: user.id });
      if (locs.length > 0) {
        await base44.entities.DriverLocation.update(locs[0].id, { lat: pos.lat, lng: pos.lng, online: true, vehicle_id: selectedVehicle.id });
      } else {
        await base44.entities.DriverLocation.create({ driver_id: user.id, lat: pos.lat, lng: pos.lng, online: true, vehicle_id: selectedVehicle.id });
      }
      setOnline(true);
      toast({ title: "Estás online", description: "Buscando viajes..." });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleGoOffline = async () => {
    try {
      const locs = await base44.entities.DriverLocation.filter({ driver_id: user.id });
      if (locs.length > 0) {
        await base44.entities.DriverLocation.update(locs[0].id, { online: false });
      }
      setOnline(false);
      setAvailableRides([]);
    } catch (err) {
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
    setAvailableRides(prev => prev.filter(r => r.id !== ride.id));
  };

  const handleSilenceRide = (ride) => {
    silencedRides.current.add(ride.id);
    setAvailableRides(prev => prev.filter(r => r.id !== ride.id));
  };

  const handleAcceptRide = async (ride) => {
    try {
      const updated = await base44.entities.Ride.update(ride.id, {
        status: "ASSIGNED",
        driver_id: user.id,
        driver_name: user.full_name || user.email,
        vehicle_id: selectedVehicle.id,
        vehicle_plate: selectedVehicle.plate,
        vehicle_model: `${selectedVehicle.make} ${selectedVehicle.model}`,
        vehicle_color: selectedVehicle.color,
      });
      setActiveRide(updated);
      setAvailableRides([]);
      toast({ title: "Viaje aceptado" });
    } catch (err) {
      toast({ title: "No se pudo aceptar", description: err.message, variant: "destructive" });
    }
  };

  const handleArrived = async () => {
    try {
      await base44.entities.Ride.update(activeRide.id, { status: "DRIVER_ARRIVED" });
      setActiveRide({ ...activeRide, status: "DRIVER_ARRIVED" });
    } catch (err) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleValidatePin = async () => {
    if (pinInput !== activeRide.start_pin) {
      toast({ title: "PIN incorrecto", variant: "destructive" });
      return;
    }
    try {
      await base44.entities.Ride.update(activeRide.id, { status: "IN_PROGRESS" });
      setActiveRide({ ...activeRide, status: "IN_PROGRESS" });
      setPinInput("");
      toast({ title: "Viaje iniciado" });
    } catch (err) { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await base44.functions.invoke("completeRide", { ride_id: activeRide.id, final_fare: activeRide.quoted_fare, payment_method: activeRide.payment_method });
      toast({ title: "Viaje completado", description: `Ganaste $${activeRide.quoted_fare.toLocaleString("es-AR")}` });
      setActiveRide(null);
    } catch (err) {
      toast({ title: "Error al completar", description: err.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeRide) return;
    try {
      await base44.entities.Ride.update(activeRide.id, { status: "CANCELLED", cancelled_date: new Date().toISOString(), cancel_reason: "driver_cancelled" });
      setActiveRide(null);
      setShowCancelDialog(false);
      toast({ title: "Viaje cancelado" });
    } catch (err) {
      toast({ title: "No se pudo cancelar", variant: "destructive" });
    }
  };

  const formatPrice = (v) => `$${(v || 0).toLocaleString("es-AR")}`;

  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  if (loading) return <div className="flex items-center justify-center absolute inset-0"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;

  // Not eligible
  if (!eligible) {
    const cap = user?.driver_capability || "NO_DRIVER";
    return (
      <div className="max-w-md mx-auto px-4 pt-10 pb-8 text-center">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-xl font-bold mb-2">No estás habilitado para conducir</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {cap === "NO_DRIVER" && "Todavía no te postulaste como conductor."}
          {cap === "ONBOARDING" && "Tu postulación requiere más información."}
          {cap === "PENDING_REVIEW" && "Tu postulación está en revisión."}
          {cap === "APPROVED_BLOCKED" && "Tu cuenta tiene un bloqueo temporal (deuda o documentación)."}
          {cap === "SUSPENDED" && "Tu cuenta está suspendida."}
        </p>
        {cap === "NO_DRIVER" || cap === "ONBOARDING" ? (
          <Button onClick={() => navigate("/onboarding")} className="w-full bear-gold-gradient text-foreground border-0">Postularme como conductor</Button>
        ) : cap === "APPROVED_BLOCKED" ? (
          <Button onClick={() => navigate("/driver/earnings")} className="w-full bear-gold-gradient text-foreground border-0">Ver deuda y regularizar</Button>
        ) : null}
      </div>
    );
  }

  // Active ride view
  if (activeRide) {
    const status = activeRide.status;
    return (
      <div className="absolute inset-0">
        <MapView
          origin={{ lat: activeRide.origin_lat, lng: activeRide.origin_lng }}
          destination={{ lat: activeRide.destination_lat, lng: activeRide.destination_lng }}
          driverPos={driverPos}
          recenter={driverPos}
          interactive={false}
          className="absolute inset-0"
        />
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <Card className="rounded-2xl p-4 max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent capitalize">{status.replace(/_/g, " ")}</span>
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
              <p className="text-muted-foreground truncate"><MapPin className="w-3.5 h-3.5 inline mr-1 shrink-0" />{displayAddress(activeRide.origin_address)}</p>
              <p className="text-muted-foreground truncate"><Navigation className="w-3.5 h-3.5 inline mr-1 shrink-0" />{displayAddress(activeRide.destination_address)}</p>
              <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                <span><Clock className="w-3 h-3 inline mr-1" />{activeRide.duration_min} min</span>
                <span><MapPin className="w-3 h-3 inline mr-1" />{activeRide.distance_km} km</span>
                <span className="capitalize flex items-center gap-1">
                  {activeRide.payment_method === "card" && <CreditCard className="w-3 h-3" />}
                  {activeRide.payment_method === "cash" && <Banknote className="w-3 h-3" />}
                  {activeRide.payment_method === "qr" && <QrCode className="w-3 h-3" />}
                  {activeRide.payment_method === "card" ? "Tarjeta" : activeRide.payment_method === "cash" ? "Efectivo" : "QR"}
                </span>
              </div>
            </div>

            {(status === "ASSIGNED" || status === "DRIVER_APPROACHING") && (
              <div>
                <p className="text-sm text-center text-muted-foreground mb-3">Dirigite al punto de encuentro</p>
                <Button onClick={handleArrived} className="w-full bear-gold-gradient text-foreground border-0">Llegué</Button>
                <Button variant="outline" onClick={() => setShowCancelDialog(true)} className="w-full mt-2 text-destructive text-sm">Cancelar viaje</Button>
              </div>
            )}
            {status === "DRIVER_ARRIVED" && (
              <div>
                <p className="text-sm text-center text-muted-foreground mb-3">Esperá al pasajero. Pedile el PIN de inicio:</p>
                <div className="flex gap-2">
                  <Input value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN de 4 dígitos" maxLength={4} className="text-center text-lg tracking-widest" />
                  <Button onClick={handleValidatePin} disabled={pinInput.length !== 4} className="bear-gold-gradient text-foreground border-0"><KeyRound className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
            {status === "IN_PROGRESS" && (
              <Button onClick={handleComplete} disabled={completing} className="w-full bear-gold-gradient text-foreground border-0">
                {completing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Finalizando...</> : "Finalizar viaje"}
              </Button>
            )}
            {status === "PAYMENT_PENDING" && (
              <div className="text-center">
                {activeRide.payment_method === "card" ? (
                  <>
                    <Loader2 className="w-8 h-8 text-accent mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground mb-1">Esperando pago con tarjeta</p>
                    <p className="text-xs text-muted-foreground mb-3">El pasajero está pagando. El viaje se completará automáticamente.</p>
                  </>
                ) : (
                  <>
                    <Wallet className="w-8 h-8 text-accent mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-3 capitalize">{activeRide.payment_method === "cash" ? "Cobrá en efectivo" : "Generá el QR de pago"}</p>
                    <Button onClick={handleComplete} disabled={completing} className="w-full bear-gold-gradient text-foreground border-0">Confirmar pago</Button>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
        <CancelRideDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancel}
          isDriver={true}
        />
      </div>
    );
  }

  // Online view — full screen map with ride request modal
  if (online && !activeRide) {
    const incomingRide = availableRides[0];
    return (
      <div className="absolute inset-0">
        <MapView driverPos={driverPos} recenter={driverPos} interactive={false} className="absolute inset-0" />

        <div className="absolute inset-x-0 top-0 z-10 p-3 safe-top">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-navy">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-white">Online</span>
            </div>
            <Button onClick={handleGoOffline} size="sm" className="rounded-full glass-navy border-0 text-white hover:text-white">Desconectarme</Button>
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
                    <Button size="sm" onClick={handleEnableNotif} className="bear-gold-gradient text-foreground border-0">Sí, activar</Button>
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

  // Offline home
  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-8 animate-fade-in">
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
            onChange={e => setSelectedVehicle(vehicles.find(v => v.id === e.target.value))}
            className="w-full bg-transparent text-sm font-medium outline-none"
          >
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.plate}</option>)}
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
        <Button onClick={handleGoOnline} disabled={vehicles.length === 0} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold">Conectarme</Button>
      </Card>
    </div>
  );
}