import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import StarRating from "@/components/bear/StarRating";
import BearAvatar from "@/components/bear/BearAvatar";
import ThemeToggle from "@/components/bear/ThemeToggle";
import { Car, LogOut, User, FileText, ChevronRight, Shield, HelpCircle, CheckCircle2, AlertTriangle, Camera, Loader2, Clock } from "lucide-react";
import { businessDaysUntil } from "@/lib/businessDays";
import { validateFile, optimizeForWeb } from "@/lib/imageUtils";

export default function DriverProfile() {
  const { user, logout, checkUserAuth } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [docs, setDocs] = useState([]);
  const [photoUrl, setPhotoUrl] = useState(user?.profile_photo_url || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [application, setApplication] = useState(null);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const validation = validateFile(file);
    if (!validation.valid) {
      toast({ title: "Archivo inválido", description: validation.error, variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    try {
      const optimized = await optimizeForWeb(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: optimized });
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

  useEffect(() => {
    const load = async () => {
      try {
        const v = await base44.entities.Vehicle.filter({ driver_id: user.id });
        setVehicles(v);
        const d = await base44.entities.DriverDocument.filter({ driver_id: user.id });
        setDocs(d);
        if (user?.driver_capability === "PENDING_REVIEW") {
          const apps = await base44.entities.DriverApplication.filter({ user_id: user.id }, "-created_date", 1);
          if (apps.length > 0) setApplication(apps[0]);
        }
      } catch (err) {}
    };
    load();
  }, [user]);

  const cap = user?.driver_capability || "NO_DRIVER";
  const capLabel = {
    APPROVED_ELIGIBLE: "Aprobado y habilitado",
    APPROVED_BLOCKED: "Aprobado con bloqueo",
    PENDING_REVIEW: "En revisión",
    ONBOARDING: "En preparación",
    NO_DRIVER: "No conductor",
    SUSPENDED: "Suspendido",
  }[cap] || cap;

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Perfil</h1>
        <ThemeToggle />
      </div>

      <Card className="p-5 mb-4 bear-gradient text-white">
        <div className="flex items-center gap-4">
          <div className="relative">
            <BearAvatar photoUrl={photoUrl} size={64} />
            <label className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-accent flex items-center justify-center cursor-pointer shadow-lg">
              {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 text-foreground animate-spin" /> : <Camera className="w-3.5 h-3.5 text-foreground" />}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg truncate">{user?.full_name || "Conductor"}</p>
            <p className="text-sm text-white/60 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <StarRating value={user?.rating_avg || 0} readOnly size={14} />
              <span className="text-xs text-white/60">{user?.total_rides || 0} viajes</span>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/10">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cap === "APPROVED_ELIGIBLE" ? "bg-green-500/20 text-green-300" : "bg-accent/20 text-accent"}`}>
            {capLabel}
          </span>
        </div>
      </Card>

      {cap === "PENDING_REVIEW" && application?.status === "UNDER_REVIEW" && application?.review_deadline && (
        <Card className="p-5 mb-4 bear-gradient text-white">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-accent shrink-0" />
            <div>
              <p className="font-semibold text-sm">Revisión en curso</p>
              <p className="text-3xl font-extrabold text-accent">{businessDaysUntil(application.review_deadline)}</p>
              <p className="text-xs text-white/60">días hábiles restantes para aprobación</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-2 mb-4">
        <div className="p-3">
          <p className="font-semibold text-sm mb-2">Vehículos</p>
          {vehicles.length === 0 ? <p className="text-sm text-muted-foreground">Sin vehículos registrados</p> : (
            <div className="space-y-2">
              {vehicles.map(v => (
                <div key={v.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><Car className="w-4 h-4 text-muted-foreground" /><span>{v.make} {v.model} · {v.plate}</span></div>
                  <span className={`text-xs ${v.status === "approved" ? "text-green-600" : "text-muted-foreground"}`}>{v.status === "approved" ? "Aprobado" : "Pendiente"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="h-px bg-border mx-3" />
        <div className="p-3">
          <p className="font-semibold text-sm mb-2">Documentación</p>
          <div className="space-y-2">
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">Sin documentos</p> : docs.map(d => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />{d.label}</span>
                <span className={`text-xs ${d.status === "APPROVED" ? "text-green-600" : d.status === "REJECTED" ? "text-destructive" : "text-muted-foreground"}`}>
                  {d.status === "APPROVED" ? <CheckCircle2 className="w-3.5 h-3.5 inline" /> : d.status === "REJECTED" ? <AlertTriangle className="w-3.5 h-3.5 inline" /> : null} {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-0 mb-4 overflow-hidden">
        <button onClick={() => navigate("/passenger")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center"><User className="w-5 h-5 text-accent" /></div>
          <div className="flex-1 text-left"><p className="font-medium text-sm">Cambiar a modo Pasajero</p></div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="h-px bg-border mx-4" />
        <button onClick={() => navigate("/security-privacy")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><Shield className="w-5 h-5 text-muted-foreground" /></div>
          <div className="flex-1 text-left"><p className="font-medium text-sm">Seguridad</p></div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="h-px bg-border mx-4" />
        <button onClick={() => navigate("/help-support")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><HelpCircle className="w-5 h-5 text-muted-foreground" /></div>
          <div className="flex-1 text-left"><p className="font-medium text-sm">Ayuda y soporte</p></div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </Card>

      <Button variant="outline" onClick={() => logout()} className="w-full text-destructive border-destructive/30 hover:bg-destructive/5">
        <LogOut className="w-4 h-4 mr-2" />Cerrar sesión
      </Button>
    </div>
  );
}