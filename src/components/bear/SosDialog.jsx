import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Share2, LifeBuoy, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

export default function SosDialog({ open, onOpenChange, ride, userPos }) {
  const { user } = useAuth();
  const [notifying, setNotifying] = useState(false);

  const handleCallEmergency = () => {
    window.location.href = "tel:911";
  };

  const handleShareLocation = async () => {
    if (!userPos) {
      toast({ title: "Ubicación no disponible", variant: "destructive" });
      return;
    }
    const link = `https://www.google.com/maps?q=${userPos.lat},${userPos.lng}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mi ubicación — BearDrive",
          text: "Esta es mi ubicación al momento de compartir:",
          url: link,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        toast({ title: "Link copiado", description: "Pegalo donde quieras compartirlo" });
      } catch {
        toast({ title: "No se pudo compartir", variant: "destructive" });
      }
    }
  };

  const handleNotifySupport = async () => {
    setNotifying(true);
    try {
      await base44.entities.SupportCase.create({
        user_id: user.id,
        user_name: user.full_name || user.email,
        category: "safety",
        status: "open",
        description: `Alerta SOS desde viaje ${ride?.id || "desconocido"}. Ubicación: ${userPos ? `${userPos.lat},${userPos.lng}` : "no disponible"}`,
        ride_id: ride?.id,
      });
      toast({ title: "Solicitud registrada", description: "El equipo de soporte podrá atenderla desde su panel. Ante una emergencia, llamá al 911." });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "No se pudo notificar", description: err.message, variant: "destructive" });
    } finally {
      setNotifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <LifeBuoy className="w-5 h-5" /> Asistencia de seguridad
          </DialogTitle>
          <DialogDescription>Estamos para ayudarte. Elegí una opción.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button onClick={handleCallEmergency} variant="destructive" className="w-full h-12 text-base font-semibold">
            <Phone className="w-5 h-5 mr-2" /> Llamar a emergencias (911)
          </Button>
          <Button onClick={handleShareLocation} variant="outline" className="w-full h-12">
            <Share2 className="w-5 h-5 mr-2" /> Compartir mi ubicación
          </Button>
          <Button onClick={handleNotifySupport} disabled={notifying} variant="outline" className="w-full h-12">
            {notifying ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <><LifeBuoy className="w-5 h-5 mr-2" /> Avisar a soporte BearDrive</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}