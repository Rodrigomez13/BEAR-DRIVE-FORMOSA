import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/card";
import { Car, User, ChevronRight } from "lucide-react";

export default function ModeSwitcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDriver = user?.driver_capability === "APPROVED_ELIGIBLE";

  if (!isDriver) return null;

  const isCurrentlyDriver = window.location.pathname.startsWith("/driver");

  return (
    <Card
      className="p-0 mb-4 overflow-hidden cursor-pointer hover:bg-secondary/30 transition-colors"
      onClick={() => navigate(isCurrentlyDriver ? "/passenger" : "/driver")}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCurrentlyDriver ? "bg-accent/10" : "bg-accent/10"}`}>
          {isCurrentlyDriver ? <User className="w-5 h-5 text-accent" /> : <Car className="w-5 h-5 text-accent" />}
        </div>
        <div className="flex-1 text-left">
          <p className="font-medium text-sm">
            {isCurrentlyDriver ? "Cambiar a modo Pasajero" : "Cambiar a modo Conductor"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isCurrentlyDriver ? "Pedí un viaje" : "Recibí solicitudes"}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>
    </Card>
  );
}