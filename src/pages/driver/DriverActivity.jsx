import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import StarRating from "@/components/bear/StarRating";
import { MapPin, Clock, DollarSign, Star } from "lucide-react";
import { displayAddress } from "@/lib/geo";

const STATUS_LABELS = {
  COMPLETED: "Completado", RATED: "Completado", CANCELLED: "Cancelado",
  IN_PROGRESS: "En viaje", SEARCHING: "Buscando", ASSIGNED: "Asignado",
};

export default function DriverActivity() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.Ride.filter({ driver_id: user.id }, "-created_date", 50);
        setRides(data);
      } catch (err) {} finally { setLoading(false); }
    };
    load();
  }, [user]);

  const formatPrice = (v) => `$${(v || 0).toLocaleString("es-AR")}`;
  const formatDate = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-10">
      <h1 className="text-2xl font-bold mb-6">Actividad</h1>
      {loading ? <div className="text-center py-10 text-muted-foreground">Cargando...</div> :
       rides.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Todavía no hiciste viajes como conductor</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rides.map(ride => (
            <Card key={ride.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ride.status === "COMPLETED" || ride.status === "RATED" ? "bg-green-100 text-green-700" : "bg-accent/10 text-accent"}`}>
                    {STATUS_LABELS[ride.status] || ride.status}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(ride.created_date)}</p>
                </div>
                <p className="font-bold text-lg text-accent">{formatPrice(ride.final_fare || ride.quoted_fare)}</p>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-muted-foreground truncate"><MapPin className="w-3.5 h-3.5 inline mr-1" />{displayAddress(ride.origin_address, "Origen")}</p>
                <p className="text-muted-foreground truncate"><MapPin className="w-3.5 h-3.5 inline mr-1" />{displayAddress(ride.destination_address, "Destino")}</p>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                {ride.distance_km && <span>{ride.distance_km} km</span>}
                {ride.duration_min && <span>{ride.duration_min} min</span>}
                <span className="capitalize">{ride.payment_method}</span>
                {ride.passenger_rating && <StarRating value={ride.passenger_rating} readOnly size={12} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}