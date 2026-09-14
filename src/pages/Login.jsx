import React, { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, User, Car, ShieldCheck, X, MapPin, Eye, EyeOff } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";
import { requestLocationPermission } from "@/lib/geo";
import ThemeToggle from "@/components/bear/ThemeToggle";

export default function Login() {
  const [mode, setMode] = useState(null); // "passenger" | "driver" | null
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminModal, setAdminModal] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminDenied, setAdminDenied] = useState(() => sessionStorage.getItem("bear_admin_denied") === "true");
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [requestingPermission, setRequestingPermission] = useState(false);
  const returnTo = safeReturnTo();

  React.useEffect(() => {
    if (adminDenied) {
      const t = setTimeout(() => {
        sessionStorage.removeItem("bear_admin_denied");
        setAdminDenied(false);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [adminDenied]);

  const [showPassword, setShowPassword] = useState(false);
  const timerRef = useRef(null);

  const startPress = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setAdminModal(true);
      setAdminError("");
      setAdminCode("");
    }, 2500);
  }, []);

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    try {
      const res = await base44.functions.invoke("checkAdminCode", { code: adminCode });
      if (res.data?.valid) {
        sessionStorage.setItem("bear_admin_attempt", "true");
        setAdminModal(false);
        setMode("passenger");
        setPermissionsGranted(true);
      } else {
        setAdminError("No pudimos validar el acceso.");
      }
    } catch {
      setAdminError("No pudimos validar el acceso.");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!mode) {
      setError("Elegí cómo querés ingresar");
      return;
    }
    setLoading(true);
    sessionStorage.setItem("bear_requested_mode", mode);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Email o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    if (!mode) {
      setError("Elegí cómo querés ingresar");
      return;
    }
    sessionStorage.setItem("bear_requested_mode", mode);
    base44.auth.loginWithProvider("google", returnTo);
  };

  const handleRequestPermissions = async () => {
    setPermissionError("");
    setRequestingPermission(true);
    try {
      await requestLocationPermission({ requirePrecise: mode === "driver" });

      // Browser notifications remain a compatibility path for now. Native push
      // (FCM) will replace this after the E2E vertical slice is stable.
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      setPermissionsGranted(true);
    } catch (err) {
      setPermissionError(
        err?.message ||
        "No pudimos habilitar tu ubicación. Revisá los permisos de BearDrive en la configuración del dispositivo."
      );
    } finally {
      setRequestingPermission(false);
    }
  };

  return (
    <div className="relative h-[100dvh] overflow-y-auto scrollbar-hide flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-background to-secondary/40">
      <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        {adminDenied &&
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
            No pudimos validar el acceso.
          </div>
        }
        <div
          className="flex flex-col items-center mb-6 cursor-pointer select-none"
          onMouseDown={startPress}
          onMouseUp={cancelPress}
          onMouseLeave={cancelPress}
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchCancel={cancelPress}
          onContextMenu={(e) => e.preventDefault()}>
          
          {/* Logo Pin Oficial BearDrive */}
          <div className="relative mb-3 group flex items-center justify-center">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
              <img
                src="/assets/beardrive-login-pin.png"
                alt="Logo BearDrive Formosa"
                className="relative w-full h-full object-contain filter z-10 drop-shadow-[0_8px_16px_rgba(233,183,78,0.25)] opacity-100" />
              
            </div>
          </div>

          {/* Logotipo Oficial BearDrive - Compartiendo Destinos */}
          <img
            src="/assets/beardrive_logo_slogan.png"
            alt="BearDrive - Compartiendo Destinos"
            className="h-11 w-auto object-contain drop-shadow" />
          

          <p className="mt-2 text-xs text-muted-foreground font-medium text-center">
            Movilidad urbana y segura en Formosa
          </p>
        </div>

        {!mode ?
        <div className="space-y-4">
            <p className="text-center text-lg font-semibold mb-2">¿Cómo querés ingresar?</p>
            <button
            onClick={() => setMode("passenger")}
            className="w-full p-5 rounded-2xl bear-gradient text-white flex items-center gap-4 hover:opacity-90 transition-opacity shadow-lg">
            
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <User className="w-6 h-6 text-accent" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-base">Soy pasajero</p>
                <p className="text-sm text-white/60">Pedí un viaje</p>
              </div>
            </button>
            <button
            onClick={() => setMode("driver")}
            className="w-full p-5 rounded-2xl border-2 border-accent/40 bg-card flex items-center gap-4 hover:border-accent transition-colors">
            
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Car className="w-6 h-6 text-accent" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-base">Soy conductor</p>
                <p className="text-sm text-muted-foreground">Conducí con BearDrive</p>
              </div>
            </button>
            <p className="text-center text-xs text-muted-foreground pt-2">
              ¿No tenés cuenta?{" "}
              <Link to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")} className="text-accent font-medium hover:underline">
                Crear una
              </Link>
            </p>
          </div> :

        <div className="space-y-5">
            <div className="flex items-center justify-between">
              <button onClick={() => {setMode(null);setPermissionsGranted(false);}} className="text-sm text-muted-foreground hover:text-foreground">
                ← Volver
              </button>
              <span className="text-sm font-medium capitalize flex items-center gap-1.5">
                {mode === "passenger" ? <User className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                {mode === "passenger" ? "Pasajero" : "Conductor"}
              </span>
            </div>

            <Button variant="outline" className="w-full h-12 text-sm font-medium" onClick={handleGoogle}>
              <GoogleIcon className="w-5 h-5 mr-2" />
              Continuar con Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">o</span>
              </div>
            </div>

            {error &&
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">{error}</div>
          }

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" autoComplete="email" autoFocus placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link to="/forgot-password" className="text-xs text-accent hover:underline">¿Olvidaste tu contraseña?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  required />
                
                  <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 font-semibold bear-gold-gradient text-foreground border-0" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ingresando...</> : "Ingresar"}
              </Button>
            </form>
          </div>
        }
      </div>

      {mode && !permissionsGranted &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Permisos necesarios</h3>
              <button onClick={() => setPermissionsGranted(true)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-accent" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                BearDrive usa tu ubicación para {mode === "passenger" ? "conectar con conductores cercanos y mostrar tu viaje en tiempo real" : "recibir solicitudes de pasajeros cercanos y navegar a sus puntos de encuentro"}.
              </p>
              <p className="text-xs text-muted-foreground">
                {mode === "driver" ?
              "El modo conductor necesita ubicación precisa. Las notificaciones push se activarán en una etapa posterior del MVP." :
              "También necesitamos notificaciones para informarte cambios importantes del viaje."}
              </p>
            </div>
            {permissionError &&
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center mb-4">
                {permissionError}
              </div>
          }
            <Button onClick={handleRequestPermissions} disabled={requestingPermission} className="w-full h-12 bear-gold-gradient text-foreground border-0 font-semibold mb-2">
              {requestingPermission ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Solicitando...</> : <><MapPin className="w-4 h-4 mr-2" />Permitir ubicación</>}
            </Button>
            <Button variant="ghost" onClick={() => setPermissionsGranted(true)} className="w-full text-sm">
              Continuar de todos modos
            </Button>
          </div>
        </div>
      }

      {adminModal &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setAdminModal(false)}>
          <div className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h3 className="font-semibold">Acceso restringido</h3>
              </div>
              <button onClick={() => setAdminModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-code">Código de acceso</Label>
                <Input id="admin-code" type="password" autoFocus value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="••••••••" className="h-12 tracking-widest" required />
              </div>
              {adminError && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">{adminError}</div>}
              <Button type="submit" className="w-full h-12 bear-gradient text-white border-0" disabled={adminLoading}>
                {adminLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuar"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setAdminModal(false)}>Cancelar</Button>
            </form>
          </div>
        </div>
      }
    </div>);

}