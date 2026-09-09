import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import StarRating from "@/components/bear/StarRating";
import { MapPin, Clock, DollarSign, Receipt } from "lucide-react";

const STATUS_LABELS = {
  SEARCHING: "Buscando conductor",
  ASSIGNED: "Conductor asignado",
  DRIVER_APPROACHING: "Conductor en camino",
  DRIVER_ARRIVED: "Conductor llegó",
  IN_PROGRESS: "En viaje",
  COMPLETED: "Completado",
  RATED: "Completado",
  CANCELLED: "Cancelado",
  NO_SHOW: "No presentado",
};

export default function PassengerActivity() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.Ride.filter({ passenger_id: user.id }, "-created_date", 50);
        setRides(data);
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const formatPrice = (v) => `$${(v || 0).toLocaleString("es-AR")}`;
  const formatDate = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-10">
      <h1 className="text-2xl font-bold mb-6">Actividad</h1>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Cargando...</div>
      ) : rides.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Todavía no hiciste viajes</p>
          <p className="text-xs text-muted-foreground mt-1">Pedí tu primer viaje desde la pestaña Viajar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rides.map((ride) => (
            <Card key={ride.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      ride.status === "COMPLETED" || ride.status === "RATED" ? "bg-green-100 text-green-700" :
                      ride.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                      "bg-accent/10 text-accent"
                    }`}>
                      {STATUS_LABELS[ride.status] || ride.status}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">{ride.category}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(ride.created_date)}</p>
                </div>
                <p className="font-bold text-lg">{formatPrice(ride.final_fare || ride.quoted_fare)}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-foreground mt-1.5 shrink-0" />
                  <p className="text-muted-foreground truncate">{ride.origin_address || "Origen"}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
                  <p className="text-muted-foreground truncate">{ride.destination_address || "Destino"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                {ride.distance_km && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ride.distance_km} km</span>}
                {ride.duration_min && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ride.duration_min} min</span>}
                <span className="flex items-center gap-1 capitalize"><DollarSign className="w-3 h-3" />{ride.payment_method}</span>
                {ride.driver_rating && <StarRating value={ride.driver_rating} readOnly size={12} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}