import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Loader2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

export default function FavoriteModal({ open, onClose, destination }) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && destination?.address) {
      const parts = destination.address.split(",");
      setLabel(parts[0] || "Destino");
    }
  }, [open, destination]);

  const handleSave = async () => {
    if (!destination) return;
    setSaving(true);
    try {
      await base44.entities.FavoritePlace.create({
        label: label.trim() || "Destino",
        address: destination.address,
        lat: destination.lat,
        lng: destination.lng,
      });
      toast({ title: "Lugar guardado como favorito" });
      onClose();
    } catch (err) {
      toast({ title: "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-accent fill-accent" />
            Guardar destino favorito
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">¿Querés guardar este destino para próximos viajes?</p>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nombre del lugar" className="h-11" autoFocus />
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
            <span className="truncate">{destination?.address}</span>
          </p>
        </div>
        <DialogFooter className="gap-2 flex-row">
          <Button variant="ghost" onClick={onClose} className="flex-1">Ahora no</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bear-gold-gradient text-foreground border-0">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}