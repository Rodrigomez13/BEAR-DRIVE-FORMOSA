import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  Settings,
  ChevronLeft,
  Lock,
  Bell,
  Shield,
  Phone,
  User,
  LogOut,
  Trash2,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Wallet,
  CreditCard,
  HelpCircle,
  Volume2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DeleteAccountDialog from "@/components/bear/DeleteAccountDialog";

export default function AccountSettings() {
  const { user, logout, checkUserAuth } = useAuth();
  const navigate = useNavigate();

  // Password / Security states
  const [resettingPassword, setResettingPassword] = useState(false);

  // Notifications states
  const [pushRideAlerts, setPushRideAlerts] = useState(() => {
    return localStorage.getItem("setting_push_rides") !== "false";
  });
  const [pushPromos, setPushPromos] = useState(() => {
    return localStorage.getItem("setting_push_promos") === "true";
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    return localStorage.getItem("setting_sound_alerts") !== "false";
  });

  // Emergency contact states
  const [emergencyName, setEmergencyName] = useState(user?.emergency_contact_name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergency_contact_phone || "");
  const [savingEmergency, setSavingEmergency] = useState(false);

  // Security preferences
  const [shareLiveTrip, setShareLiveTrip] = useState(() => {
    return localStorage.getItem("setting_share_live_trip") !== "false";
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleToggleNotification = (key, value, setter) => {
    setter(value);
    localStorage.setItem(key, String(value));
    toast({ title: "Preferencia actualizada" });
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResettingPassword(true);
    try {
      await base44.auth.resetPasswordRequest(user.email);
      toast({
        title: "Correo de restablecimiento enviado",
        description: `Enviamos un enlace seguro a ${user.email} para cambiar tu contraseña.`,
      });
    } catch (err) {
      toast({
        title: "Error al solicitar restablecimiento",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSaveEmergencyContact = async (e) => {
    e.preventDefault();
    setSavingEmergency(true);
    try {
      await base44.auth.updateMe({
        emergency_contact_name: emergencyName.trim(),
        emergency_contact_phone: emergencyPhone.trim(),
      });
      await checkUserAuth();
      toast({
        title: "Contacto de emergencia guardado",
        description: "Esta persona podrá ser notificada en caso de activar el botón SOS durante un viaje.",
      });
    } catch (err) {
      toast({
        title: "Error al guardar contacto",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingEmergency(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-20 min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Volver
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent shadow-sm">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-xs text-muted-foreground">
            Seguridad, notificaciones y preferencias de tu cuenta
          </p>
        </div>
      </div>

      {/* Centralized Quick Links */}
      <Card className="p-0 mb-6 overflow-hidden border-border bg-card">
        <button
          onClick={() => navigate("/wallet")}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Billetera Digital</p>
              <p className="text-xs text-muted-foreground">Historial, saldos y ganancias</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="h-px bg-border mx-4" />
        <button
          onClick={() => navigate("/payment-methods")}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Métodos de Pago</p>
              <p className="text-xs text-muted-foreground">Tarjetas guardadas, QR y efectivo</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </Card>

      {/* Section 1: Seguridad y Contraseña */}
      <div className="space-y-3 mb-6">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Seguridad y Acceso
        </p>

        <Card className="p-4 border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Contraseña</p>
                <p className="text-[11px] text-muted-foreground">Gestionada mediante enlace seguro a tu correo</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={resettingPassword}
              onClick={handlePasswordReset}
              className="text-xs h-8 border-border hover:border-accent"
            >
              {resettingPassword ? "Enviando..." : "Cambiar contraseña"}
            </Button>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Correo de acceso:</span>
            <span className="font-semibold text-foreground truncate max-w-[200px]">{user?.email}</span>
          </div>

          {user?.dni && (
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">DNI registrado:</span>
              <Badge variant="outline" className="text-xs">{user.dni}</Badge>
            </div>
          )}
        </Card>
      </div>

      {/* Section 2: Notificaciones */}
      <div className="space-y-3 mb-6">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Notificaciones y Sonidos
        </p>

        <Card className="p-4 border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Alertas de Viajes</p>
                <p className="text-[11px] text-muted-foreground">Avisos de llegada, cambios y asignación de conductor</p>
              </div>
            </div>
            <Switch
              checked={pushRideAlerts}
              onCheckedChange={(val) =>
                handleToggleNotification("setting_push_rides", val, setPushRideAlerts)
              }
            />
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Tono Acústico y Sonidos</p>
                <p className="text-[11px] text-muted-foreground">Alertas audibles de solicitud y llegada</p>
              </div>
            </div>
            <Switch
              checked={soundAlerts}
              onCheckedChange={(val) =>
                handleToggleNotification("setting_sound_alerts", val, setSoundAlerts)
              }
            />
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Promociones y Puntos</p>
                <p className="text-[11px] text-muted-foreground">Novedades de beneficios y multiplicadores de BearPoints</p>
              </div>
            </div>
            <Switch
              checked={pushPromos}
              onCheckedChange={(val) =>
                handleToggleNotification("setting_push_promos", val, setPushPromos)
              }
            />
          </div>
        </Card>
      </div>

      {/* Section 3: Privacidad y Contacto de Emergencia */}
      <div className="space-y-3 mb-6">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Seguridad y Contacto de Emergencia
        </p>

        <Card className="p-4 border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Compartir ubicación en vivo</p>
                <p className="text-[11px] text-muted-foreground">Habilitar monitoreo del viaje durante el trayecto</p>
              </div>
            </div>
            <Switch
              checked={shareLiveTrip}
              onCheckedChange={(val) =>
                handleToggleNotification("setting_share_live_trip", val, setShareLiveTrip)
              }
            />
          </div>

          <form onSubmit={handleSaveEmergencyContact} className="pt-3 border-t border-border space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nombre del contacto de emergencia</Label>
              <Input
                placeholder="Ej. Mamá, Pareja, Hermano"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Teléfono de emergencia</Label>
              <Input
                placeholder="+54 370 4XX-XXXX"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="h-9 text-xs mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={savingEmergency}
              className="w-full h-8 bear-gold-gradient text-foreground font-bold text-xs"
            >
              {savingEmergency ? "Guardando..." : "Guardar Contacto de Emergencia"}
            </Button>
          </form>
        </Card>

        <Card className="p-0 overflow-hidden border-border">
          <button
            onClick={() => navigate("/security-privacy")}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span>Ver políticas completas de privacidad</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </Card>
      </div>

      {/* Section 4: Acciones de Cuenta */}
      <div className="space-y-2 pt-2">
        <Button
          variant="outline"
          onClick={logout}
          className="w-full h-11 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold flex items-center justify-center text-xs"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar sesión
        </Button>

        <Button
          variant="ghost"
          onClick={() => setShowDeleteDialog(true)}
          className="w-full h-9 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-medium flex items-center justify-center"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          Eliminar cuenta
        </Button>
      </div>

      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </div>
  );
}
