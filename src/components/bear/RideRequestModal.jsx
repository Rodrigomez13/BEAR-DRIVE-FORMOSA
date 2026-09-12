import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Clock, DollarSign, X, BellOff, VolumeX, Check, Navigation, Flame } from "lucide-react";
import { displayAddress } from "@/lib/geo";
import BearAvatar from "@/components/bear/BearAvatar";
import Haptics from "@/lib/haptics";
import soundAlert from "@/lib/soundAlert";

const TOTAL_SECONDS = 15;

export default function RideRequestModal({ ride, driverPos, onAccept, onReject, onSilence }) {
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef(null);

  // Iniciar alerta acústica y cuenta regresiva de 15 segundos
  useEffect(() => {
    soundAlert.startIncomingAlert(1800);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          soundAlert.stopIncomingAlert();
          // Auto-silenciar o declinar al expirar el tiempo
          if (onSilence) onSilence();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      soundAlert.stopIncomingAlert();
    };
  }, [onSilence]);

  const handleSilence = () => {
    soundAlert.stopIncomingAlert();
    setIsMuted(true);
    Haptics.light();
    if (onSilence) onSilence();
  };

  const handleAccept = () => {
    soundAlert.stopIncomingAlert();
    Haptics.success();
    onAccept();
  };

  const handleReject = () => {
    soundAlert.stopIncomingAlert();
    Haptics.warning();
    onReject();
  };

  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const pickupDist = driverPos ? haversineKm(driverPos.lat, driverPos.lng, ride.origin_lat, ride.origin_lng) : 0;
  const formatPrice = (v) => `$${(v || 0).toLocaleString("es-AR")}`;
  const paymentLabel = ride.payment_method === "card" ? "Tarjeta" : ride.payment_method === "cash" ? "Efectivo" : "QR";

  // Dimensiones del anillo de cuenta regresiva SVG
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - timeLeft / TOTAL_SECONDS);
  const isUrgent = timeLeft <= 5;

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/70 backdrop-blur-md animate-fade-in">
      <Card className="w-full max-w-md mx-auto rounded-t-3xl p-5 border-0 shadow-2xl relative overflow-hidden bg-card/95 backdrop-blur-xl max-h-[88%] overflow-y-auto scrollbar-hide border-t-2 border-accent/40">
        
        {/* Barra superior de progreso continuo */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-muted overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              isUrgent ? "bg-destructive animate-pulse" : "bg-gradient-to-r from-amber-500 to-accent"
            }`}
            style={{ width: `${(timeLeft / TOTAL_SECONDS) * 100}%` }}
          />
        </div>

        <div className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-3 mt-1" />

        {/* Encabezado con Timer Circular y Badge de Alerta */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50">
          <div className="flex items-center gap-3">
            {/* Temporizador Circular SVG 15s */}
            <div className="relative flex items-center justify-center w-11 h-11 shrink-0">
              <svg className="w-11 h-11 -rotate-90" viewBox="0 0 46 46">
                <circle
                  cx="23"
                  cy="23"
                  r={radius}
                  className="stroke-muted/40"
                  strokeWidth="3.5"
                  fill="transparent"
                />
                <circle
                  cx="23"
                  cy="23"
                  r={radius}
                  className={`transition-all duration-1000 ease-linear ${
                    isUrgent ? "stroke-destructive" : "stroke-accent"
                  }`}
                  strokeWidth="3.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <span
                className={`absolute text-xs font-black tracking-tight ${
                  isUrgent ? "text-destructive animate-ping-short" : "text-accent"
                }`}
              >
                {timeLeft}s
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                <span className="text-sm font-bold text-accent">¡Nueva Solicitud!</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Toca aceptar antes de que expire el tiempo
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
              #{ride.id?.slice(-6)}
            </span>
          </div>
        </div>

        {/* Datos del Pasajero */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/40">
          <BearAvatar size={48} />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-base">{ride.passenger_name || "Pasajero BearDrive"}</p>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="w-3.5 h-3.5 fill-accent text-accent" />
              <span className="font-semibold text-foreground">{ride.passenger_rating || "5.0"}</span>
              <span className="text-xs text-muted-foreground">• Formosa</span>
            </div>
          </div>
        </div>

        {/* Puntos de Ruta */}
        <div className="space-y-3 mb-4 bg-secondary/30 p-3 rounded-2xl border border-border/40">
          <div className="flex items-start gap-3">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0 mt-1 shadow-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Punto de Recogida</p>
              <p className="text-sm font-medium text-foreground truncate">{displayAddress(ride.origin_address)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-3.5 h-3.5 rounded-full bg-accent shrink-0 mt-1 shadow-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Destino</p>
              <p className="text-sm font-medium text-foreground truncate">{displayAddress(ride.destination_address)}</p>
            </div>
          </div>
        </div>

        {/* Métricas clave: Distancia, Tiempo, Tarifa sin comisiones */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-3 rounded-xl bg-secondary/50 border border-border/30">
            <MapPin className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-lg font-extrabold text-foreground">{pickupDist.toFixed(1)}</p>
            <p className="text-[11px] text-muted-foreground font-medium">km llegada</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/50 border border-border/30">
            <Clock className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-lg font-extrabold text-foreground">{ride.duration_min || 12}</p>
            <p className="text-[11px] text-muted-foreground font-medium">min viaje</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-accent/15 border border-accent/30 shadow-inner">
            <DollarSign className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-lg font-black text-accent">{formatPrice(ride.quoted_fare)}</p>
            <p className="text-[11px] text-emerald-500 font-bold">0% comisión</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 text-xs px-1 text-muted-foreground">
          <span>Método de cobro: <strong className="text-foreground">{paymentLabel}</strong></span>
          {isMuted ? (
            <span className="text-amber-500 flex items-center gap-1"><VolumeX className="w-3.5 h-3.5" /> Sonido silenciado</span>
          ) : (
            <span className="text-accent flex items-center gap-1"><Flame className="w-3.5 h-3.5 animate-pulse" /> Alerta sonora activa</span>
          )}
        </div>

        {/* Acciones principales del Conductor */}
        <div className="space-y-2.5">
          <Button
            onClick={handleAccept}
            className="w-full h-14 bear-gold-gradient text-foreground border-0 font-extrabold text-base shadow-xl active:scale-95 transition-transform"
          >
            <Check className="w-6 h-6 mr-2" />
            Aceptar viaje ({timeLeft}s)
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={handleReject}
              variant="outline"
              className="flex-1 h-11 text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold"
            >
              <X className="w-4 h-4 mr-1.5" />
              Rechazar
            </Button>
            <Button
              onClick={handleSilence}
              variant="outline"
              className="flex-1 h-11 text-muted-foreground hover:text-foreground font-semibold"
            >
              <BellOff className="w-4 h-4 mr-1.5" />
              Silenciar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}