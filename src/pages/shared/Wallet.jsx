import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import PullToRefresh from "@/components/bear/PullToRefresh";
import LoadingScreen from "@/components/bear/LoadingScreen";
import { Wallet as WalletIcon, Star, ChevronRight, CreditCard, Receipt, ArrowUpRight, RefreshCw } from "lucide-react";

const money = value => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value) || 0);
const paymentLabels = { cash: "Efectivo", qr: "Mercado Pago / QR", card: "Tarjeta" };
const statuses = { paid: "Pagado", approved: "Pagado", pending: "Pago pendiente", failed: "Pago rechazado", refunded: "Reembolsado" };

export default function Wallet() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = async () => {
    if (!user?.id) return;
    setError(false);
    try {
      const data = await base44.entities.Ride.filter({ passenger_id: user.id, status: { $in: ["COMPLETED", "RATED"] } }, "-created_date", 20);
      setRides(data);
    } catch { setError(true); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user?.id]);
  if (loading) return <LoadingScreen className="h-full" label="Cargando tu billetera..." />;
  return <PullToRefresh onRefresh={load}><div className="max-w-md mx-auto px-5 pt-6 pb-8 space-y-6">
    <header className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Tus pagos, en un lugar</p><h1 className="text-3xl font-bold">Billetera</h1></div><span className="p-3 rounded-2xl bg-accent/15"><WalletIcon className="w-6 h-6 text-accent" /></span></header>
    <section className="rounded-3xl bear-gold-gradient p-6 text-foreground shadow-sm" aria-label="BearPoints"><div className="flex items-center justify-between"><p className="font-semibold text-sm">Tus BearPoints</p><Star className="w-6 h-6" /></div><p className="text-5xl font-bold tracking-tight mt-4">{Number(user?.bearpoints_balance || 0).toLocaleString("es-AR")}</p><p className="text-sm mt-2 opacity-80">Puntos para tus próximos beneficios</p><Link to="/passenger/wallet/benefits" className="mt-5 pt-4 border-t border-foreground/20 flex items-center justify-between min-h-12 font-semibold text-sm">Explorar beneficios<ChevronRight className="w-5 h-5" /></Link></section>
    <Link to="/passenger/wallet/payment-methods" className="flex items-center gap-3 p-5 rounded-3xl border bg-card min-h-24"><span className="p-3 rounded-2xl bg-secondary"><CreditCard className="w-5 h-5" /></span><span className="flex-1"><span className="block font-semibold">Cómo pagás tus viajes</span><span className="block text-sm text-muted-foreground mt-1">Preferencia: {paymentLabels[user?.preferred_payment_method] || "Efectivo"}</span></span><ChevronRight className="w-5 h-5 shrink-0" /></Link>
    <p className="text-xs text-muted-foreground leading-relaxed px-1">Los viajes se abonan al conductor. Los BearPoints son puntos de beneficios y no representan saldo de dinero.</p>
    <section aria-label="Pagos recientes"><div className="flex items-center justify-between mb-3"><h2 className="font-bold text-lg">Viajes recientes</h2><Link className="text-sm text-accent min-h-12 flex items-center" to="/passenger/rides">Ver viajes<ChevronRight className="w-4 h-4" /></Link></div>
      {error ? <div role="alert" className="rounded-2xl border border-destructive/30 p-5"><p className="text-sm">No pudimos cargar tus viajes.</p><button type="button" onClick={load} className="flex items-center gap-2 min-h-12 text-sm font-semibold"><RefreshCw className="w-4 h-4" />Reintentar</button></div> : rides.length === 0 ? <div className="text-center rounded-3xl border border-dashed p-8"><Receipt className="w-8 h-8 mx-auto text-muted-foreground mb-3" /><p className="font-semibold">Todavía no tenés viajes finalizados</p><p className="text-sm text-muted-foreground mt-2">Cuando completes un viaje, vas a poder revisar su importe acá.</p><Link to="/passenger" className="inline-flex items-center justify-center rounded-xl bg-accent text-accent-foreground px-5 min-h-12 mt-5 font-semibold text-sm">Pedir un viaje</Link></div> : <div className="rounded-3xl border bg-card divide-y divide-border overflow-hidden">{rides.map(ride => <div key={ride.id} className="p-4 flex gap-3 items-start"><span className="rounded-xl bg-secondary p-2.5"><ArrowUpRight className="w-4 h-4" /></span><div className="min-w-0 flex-1"><p className="font-medium text-sm truncate">{ride.destination_address || "Viaje finalizado"}</p><p className="text-xs text-muted-foreground mt-1">{ride.completed_date ? new Date(ride.completed_date).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "Fecha no disponible"} · {paymentLabels[ride.payment_method] || "Medio de pago no informado"}</p><p className="text-xs mt-1 text-muted-foreground">{statuses[ride.payment_status] || "Estado de pago sin confirmar"}</p></div><span className="font-bold text-sm whitespace-nowrap">{money(ride.final_fare ?? ride.quoted_fare)}</span></div>)}</div>}
    </section>
  </div></PullToRefresh>;
}
