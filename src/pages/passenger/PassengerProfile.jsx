import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import StarRating from "@/components/bear/StarRating";
import { Phone, MapPin, Camera, LogOut, Car, ChevronRight, Shield, HelpCircle, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PassengerProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "Formosa");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ phone, city });
      toast({ title: "Perfil actualizado" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const driverCap = user?.driver_capability || "NO_DRIVER";
  const isDriver = driverCap === "APPROVED_ELIGIBLE";

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-10">
      <h1 className="text-2xl font-bold mb-6">Perfil</h1>

      <Card className="p-5 mb-4 bear-gradient text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-accent">
            {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg truncate">{user?.full_name || "Pasajero"}</p>
            <p className="text-sm text-white/60 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <StarRating value={user?.rating_avg || 0} readOnly size={14} />
              <span className="text-xs text-white/60">{user?.total_rides || 0} viajes</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-4 space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />Teléfono</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 370 4XX-XXXX" />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" />Ciudad</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full bear-gold-gradient text-foreground border-0">
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </Card>

      <Card className="p-2 mb-4">
        {isDriver ? (
          <button
            onClick={() => navigate("/driver")}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center"><Car className="w-5 h-5 text-accent" /></div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">Cambiar a modo Conductor</p>
              <p className="text-xs text-muted-foreground">Estás habilitado para conducir</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        ) : (
          <button
            onClick={() => navigate("/onboarding")}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center"><Car className="w-5 h-5 text-accent" /></div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">Quiero conducir con BearDrive</p>
              <p className="text-xs text-muted-foreground">Postuláte como conductor</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        <div className="h-px bg-border mx-3" />
        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><Shield className="w-5 h-5 text-muted-foreground" /></div>
          <div className="flex-1 text-left"><p className="font-medium text-sm">Seguridad y privacidad</p></div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="h-px bg-border mx-3" />
        <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><HelpCircle className="w-5 h-5 text-muted-foreground" /></div>
          <div className="flex-1 text-left"><p className="font-medium text-sm">Ayuda y soporte</p></div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </Card>

      <Button variant="outline" onClick={handleLogout} className="w-full text-destructive border-destructive/30 hover:bg-destructive/5">
        <LogOut className="w-4 h-4 mr-2" />Cerrar sesión
      </Button>
    </div>
  );
}