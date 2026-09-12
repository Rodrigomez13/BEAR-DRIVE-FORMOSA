import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import StarRating from "@/components/bear/StarRating";
import BearAvatar from "@/components/bear/BearAvatar";
import ThemeToggle from "@/components/bear/ThemeToggle";
import ModeSwitcher from "@/components/bear/ModeSwitcher";
import { Phone, MapPin, Camera, LogOut, Car, ChevronRight, Shield, HelpCircle, Bell, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DeleteAccountDialog from "@/components/bear/DeleteAccountDialog";

export default function PassengerProfile() {
  const { user, logout, checkUserAuth } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "Formosa");
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(user?.profile_photo_url || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ profile_photo_url: file_url });
      setPhotoUrl(file_url);
      await checkUserAuth();
      toast({ title: "Foto actualizada" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

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
    <div className="max-w-md mx-auto px-4 pt-6 pb-8 h-full overflow-y-auto scrollbar-hide">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Perfil</h1>
        <ThemeToggle />
      </div>

      <Card className="p-5 mb-4 bear-gradient text-white">
        <div className="flex items-center gap-4">
          <div className="relative">
            <BearAvatar photoUrl={photoUrl} size={64} />
            <label className="absolute bottom-0 right-0 w-11 h-11 rounded-full bg-accent flex items-center justify-center cursor-pointer shadow-lg">
              {uploadingPhoto ? <Loader2 className="w-5 h-5 text-foreground animate-spin" /> : <Camera className="w-5 h-5 text-foreground" />}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
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

      <ModeSwitcher />

      {!isDriver && (
        <Card className="p-0 mb-4 overflow-hidden">
          <button
            onClick={() => navigate("/onboarding")}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center"><Car className="w-5 h-5 text-accent" /></div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">Quiero conducir con BearDrive</p>
              <p className="text-xs text-muted-foreground">Postuláte como conductor</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </Card>
      )}

      <Card className="p-0 mb-4 overflow-hidden">
        <button onClick={() => navigate("/security-privacy")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><Shield className="w-5 h-5 text-muted-foreground" /></div>
          <div className="flex-1 text-left"><p className="font-medium text-sm">Seguridad y privacidad</p></div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="h-px bg-border mx-4" />
        <button onClick={() => navigate("/help-support")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><HelpCircle className="w-5 h-5 text-muted-foreground" /></div>
          <div className="flex-1 text-left"><p className="font-medium text-sm">Ayuda y soporte</p></div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </Card>

      <div className="space-y-2 pt-2">
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full h-12 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold flex items-center justify-center"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar sesión
        </Button>

        <Button
          variant="ghost"
          onClick={() => setShowDeleteDialog(true)}
          className="w-full h-10 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-medium flex items-center justify-center"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          Eliminar cuenta
        </Button>
      </div>

      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </div>
  );
}