import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import MapView from "@/components/bear/MapView";
import { Car, Power, Loader2, MapPin, Clock, DollarSign, Navigation, CheckCircle2, KeyRound, X, AlertTriangle, Wallet } from "lucide-react";
import { getCurrentPosition, FORMOSA_CENTER, displayAddress } from "@/lib/geo";
import CancelRideDialog from "@/components/bear/CancelRideDialog";
import { useActiveRideGuard } from "@/hooks/useActiveRideGuard";
import BearAvatar from "@/components/bear/BearAvatar";
import { BEAR_MASCOT_WAVE } from "@/lib/brandAssets";
import { Image } from "@/components/ui/image";

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
  const pollRef = useRef(null);
  const posRef = useRef(null);

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
        setAvailableRides(rides);
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

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;

  // Not eligible
  if (!eligible) {
    const cap = user?.driver_capability || "NO_DRIVER";
    return (
      <div className="max-w-md mx-auto px-5 pt-16 pb-10 text-center">
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
      <div className="relative h-full">
        <MapView
          origin={{ lat: activeRide.origin_lat, lng: activeRide.origin_lng }}
          destination={{ lat: activeRide.destination_lat, lng: activeRide.destination_lng }}
          driverPos={driverPos}
          recenter={driverPos}
          interactive={false}
          className="absolute inset-0"
        />
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <Card className="rounded-2xl p-5 max-w-md mx-auto">
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
                <span className="capitalize">{activeRide.payment_method}</span>
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
                <Wallet className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3 capitalize">{activeRide.payment_method === "cash" ? "Cobrá en efectivo" : "Generá el QR de pago"}</p>
                <Button onClick={handleComplete} disabled={completing} className="w-full bear-gold-gradient text-foreground border-0">Confirmar pago</Button>
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

  // Online / offline home
  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Conducir</h1>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${online ? "bg-green-100 text-green-700" : "bg-secondary text-muted-foreground"}`}>
          {online ? "● Online" : "○ Offline"}
        </div>
      </div>

      {/* Vehicle selector */}
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

      {!online ? (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bear-gradient flex items-center justify-center mx-auto mb-4">
            <Power className="w-8 h-8 text-accent" />
          </div>
          <h2 className="font-bold text-lg mb-2">Conectate para recibir viajes</h2>
          <p className="text-sm text-muted-foreground mb-5">Cuando estés online vas a ver las solicitudes cercanas</p>
          <Button onClick={handleGoOnline} disabled={vehicles.length === 0} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold">Conectarme</Button>
        </Card>
      ) : (
        <div>
          <Card className="p-5 mb-4 bear-gradient text-white text-center">
            <Image src={BEAR_MASCOT_WAVE} fittingType="fit" className="w-24 h-24 mx-auto mb-2" />
            <p className="text-sm text-white/60 mb-1">Disponible para viajes</p>
            <p className="text-2xl font-bold">Esperando solicitudes...</p>
            <Loader2 className="w-5 h-5 animate-spin text-accent mt-2 mx-auto" />
          </Card>
          <Button onClick={handleGoOffline} variant="outline" className="w-full">Desconectarme</Button>

          {availableRides.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-sm mb-2">Viajes disponibles ({availableRides.length})</h3>
              <div className="space-y-3">
                {availableRides.map(ride => (
                  <Card key={ride.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate"><MapPin className="w-3.5 h-3.5 inline mr-1 text-muted-foreground shrink-0" />{displayAddress(ride.origin_address)}</p>
                        <p className="text-sm text-muted-foreground truncate"><Navigation className="w-3.5 h-3.5 inline mr-1 shrink-0" />{displayAddress(ride.destination_address)}</p>
                      </div>
                      <p className="font-bold text-lg text-accent shrink-0 ml-2">{formatPrice(ride.quoted_fare)}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span><Clock className="w-3 h-3 inline mr-1" />{ride.duration_min} min</span>
                      <span>{ride.distance_km} km</span>
                      <span className="capitalize">{ride.category}</span>
                    </div>
                    <Button onClick={() => handleAcceptRide(ride)} className="w-full bear-gold-gradient text-foreground border-0">Aceptar viaje</Button>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}