import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import BearAvatar from "@/components/bear/BearAvatar";
import ThemeToggle from "@/components/bear/ThemeToggle";
import ModeSwitcher from "@/components/bear/ModeSwitcher";
import { UserRound, FileCheck, Settings, ShieldCheck, LifeBuoy, ChevronRight, LogOut, Car, Star } from "lucide-react";

export default function AccountHome() {
  const { user, logout } = useAuth();
  const driver = useLocation().pathname.startsWith("/driver");
  const base = driver ? "/driver/account" : "/passenger/account";
  const rows = [
    { icon: UserRound, title: "Datos personales", detail: "Tu foto, teléfono y datos de identidad", path: "personal" },
    ...(driver ? [{ icon: FileCheck, title: "Documentación y vehículos", detail: "Revisá tus documentos y habilitación", path: "documents" }] : []),
    { icon: Settings, title: "Preferencias", detail: "Notificaciones, contraseña y contactos", path: "preferences" },
    { icon: ShieldCheck, title: "Seguridad y privacidad", detail: "Controlá tu información y tu seguridad", path: "security" },
    { icon: LifeBuoy, title: "Ayuda y soporte", detail: "Encontrá respuestas o pedí ayuda", path: "help" },
  ];
  return <div className="h-full overflow-y-auto bg-background">
    <div className="max-w-md mx-auto px-5 pt-6 pb-8 space-y-6">
      <header className="flex justify-between items-center"><div><p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Tu espacio en BearDrive</p><h1 className="text-3xl font-bold">Cuenta</h1></div><ThemeToggle /></header>
      <Link to={`${base}/personal`} className="block rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/15 via-card to-card p-5 focus-visible:ring-2 focus-visible:ring-accent">
        <div className="flex items-center gap-4"><BearAvatar photoUrl={user?.profile_photo_url} size={64} /><div className="min-w-0 flex-1"><h2 className="text-xl font-bold truncate">{user?.full_name || "Mi cuenta"}</h2><p className="text-sm text-muted-foreground truncate">{user?.email}</p></div><ChevronRight className="w-5 h-5 shrink-0" /></div>
        <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-border text-xs"><span className="rounded-full bg-secondary px-3 py-1.5">{driver ? "Modo conductor" : "Modo pasajero"}</span><span className="flex items-center gap-1.5"><Star className="w-4 h-4 text-accent" />{user?.rating_avg ? Number(user.rating_avg).toFixed(1) : "Sin calificaciones"}</span><span className="self-center text-muted-foreground">{user?.total_rides || 0} viajes</span></div>
      </Link>
      <section aria-label="Administrar mi cuenta" className="rounded-3xl border bg-card overflow-hidden divide-y divide-border">{rows.map(({icon: Icon, title, detail, path}) => <Link key={path} to={`${base}/${path}`} className="flex items-center gap-3 p-4 min-h-20 hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"><span className="rounded-2xl bg-secondary p-3"><Icon className="w-5 h-5" /></span><span className="flex-1 min-w-0"><span className="block font-semibold text-sm">{title}</span><span className="block text-xs text-muted-foreground mt-1">{detail}</span></span><ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" /></Link>)}</section>
      <ModeSwitcher />
      {!driver && user?.driver_capability !== "APPROVED_ELIGIBLE" && <Link to="/onboarding" className="flex items-center gap-3 rounded-2xl bg-accent/10 border border-accent/30 p-4"><Car className="w-6 h-6 text-accent" /><span className="flex-1"><span className="block font-semibold text-sm">Quiero conducir</span><span className="text-xs text-muted-foreground">Completá tu registro como conductor</span></span><ChevronRight className="w-4 h-4" /></Link>}
      <button type="button" onClick={() => logout()} className="w-full min-h-12 flex items-center justify-center gap-2 rounded-2xl border border-destructive/25 text-destructive hover:bg-destructive/10"><LogOut className="w-4 h-4" />Cerrar sesión</button>
    </div>
  </div>;
}
