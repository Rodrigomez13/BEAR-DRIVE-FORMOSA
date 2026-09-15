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
import {
  Phone,
  MapPin,
  Camera,
  Loader2
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import DeleteAccountDialog from "@/components/bear/DeleteAccountDialog";

export default function PassengerProfile() {
  const { user, checkUserAuth } = useAuth();
  const navigate = useNavigate();
  const accountPath = useLocation().pathname.startsWith("/driver") ? "/driver/account" : "/passenger/account";
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "Formosa");
  const [dni, setDni] = useState(user?.dni || "");
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(user?.profile_photo_url || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.phone !== undefined) setPhone(user.phone || "");
      if (user.city !== undefined) setCity(user.city || "Formosa");
      if (user.dni !== undefined) setDni(user.dni || "");
      if (user.profile_photo_url !== undefined) setPhotoUrl(user.profile_photo_url || "");
    }
  }, [user]);

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
      await base44.auth.updateMe({ phone, city, dni });
      await checkUserAuth();
      toast({ title: "Perfil actualizado" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-20 h-full overflow-y-auto scrollbar-hide">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Datos personales</h1>
        <Button variant="ghost" onClick={() => navigate(accountPath)}>Volver</Button>
      </div>

      {/* User Header Card */}
      <Card className="p-5 mb-4 bear-gradient text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="relative">
            <BearAvatar photoUrl={photoUrl} size={64} />
            <label className="absolute bottom-0 right-0 w-12 h-12 rounded-full bg-accent flex items-center justify-center cursor-pointer shadow-lg">
              {uploadingPhoto ? <Loader2 className="w-4 h-4 text-foreground animate-spin" /> : <Camera className="w-4 h-4 text-foreground" />}
              <input type="file" accept="image/*" aria-label="Cambiar foto de perfil" className="sr-only" onChange={handlePhotoUpload} />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg truncate">{user?.full_name || "Pasajero"}</p>
            <p className="text-sm text-white/70 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <StarRating value={user?.rating_avg || 0} readOnly size={14} />
              <span className="text-xs text-white/70">{user?.total_rides || 0} viajes</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Personal Data */}
      <Card className="p-5 mb-4 space-y-3 border-border">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
          Datos Personales
        </p>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3.5 h-3.5" /> Teléfono
          </Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 370 4XX-XXXX" className="h-9 text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /> Ciudad
            </Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              DNI
            </Label>
            <Input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="DNI sin puntos" className="h-9 text-xs" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full bear-gold-gradient text-foreground border-0 h-9 font-bold text-xs mt-2">
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </Card>

      <Button variant="ghost" onClick={() => setShowDeleteDialog(true)} className="min-h-12 w-full text-destructive">Eliminar cuenta</Button>
      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </div>
  );
}
