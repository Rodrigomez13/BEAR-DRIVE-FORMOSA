import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Clock, DollarSign, X, BellOff, Check } from "lucide-react";
import { displayAddress } from "@/lib/geo";
import BearAvatar from "@/components/bear/BearAvatar";

export default function RideRequestModal({ ride, driverPos, onAccept, onReject, onSilence }) {
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

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-auto rounded-t-3xl p-5 animate-fade-in max-h-[85%] overflow-y-auto scrollbar-hide border-0">
        <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm font-bold text-accent">Nueva solicitud</span>
          </div>
          <span className="text-xs text-muted-foreground">#{ride.id?.slice(-6)}</span>
        </div>

        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
          <BearAvatar size={48} />
          <div className="flex-1">
            <p className="font-semibold">{ride.passenger_name || "Pasajero"}</p>
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-3.5 h-3.5 fill-accent text-accent" />
              <span>{ride.passenger_rating || "Nuevo"}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-3">
            <span className="w-3 h-3 rounded-full bg-foreground shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Recogida</p>
              <p className="text-sm font-medium truncate">{displayAddress(ride.origin_address)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-3 h-3 rounded-full bg-accent shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Destino</p>
              <p className="text-sm font-medium truncate">{displayAddress(ride.destination_address)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-3 rounded-xl bg-secondary/50">
            <MapPin className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-lg font-bold">{pickupDist.toFixed(1)}</p>
            <p className="text-[14px] text-muted-foreground">km recogida</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/50">
            <Clock className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-lg font-bold">{ride.duration_min}</p>
            <p className="text-[14px] text-muted-foreground">min viaje</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-accent/10">
            <DollarSign className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-lg font-bold text-accent">{formatPrice(ride.quoted_fare)}</p>
            <p className="text-[14px] text-muted-foreground">ganancia</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-muted-foreground">Método de pago</span>
          <span className="font-medium">{paymentLabel}</span>
        </div>

        <div className="space-y-2">
          <Button onClick={onAccept} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold">
            <Check className="w-5 h-5 mr-2" />Aceptar viaje
          </Button>
          <div className="flex gap-2">
            <Button onClick={onReject} variant="outline" className="flex-1 text-destructive">
              <X className="w-4 h-4 mr-1" />Rechazar
            </Button>
            <Button onClick={onSilence} variant="outline" className="flex-1">
              <BellOff className="w-4 h-4 mr-1" />Silenciar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}