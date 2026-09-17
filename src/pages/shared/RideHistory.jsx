import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { displayAddress } from "@/lib/geo";
import PullToRefresh from "@/components/bear/PullToRefresh";
import { SkeletonList } from "@/components/bear/SkeletonCard";
import { ArrowUpRight, ChevronDown, Navigation, RefreshCw } from "lucide-react";

const labels = { SEARCHING: "Buscando conductor", ASSIGNED: "Conductor asignado", DRIVER_APPROACHING: "En camino", DRIVER_ARRIVED: "Conductor llegó", IN_PROGRESS: "En viaje", COMPLETED: "Completado", RATED: "Completado", CANCELLED: "Cancelado", NO_SHOW: "No presentado", EXPIRED: "Solicitud vencida" };
const finished = new Set(["COMPLETED", "RATED"]);
const cancelled = new Set(["CANCELLED", "NO_SHOW", "EXPIRED"]);
const active = new Set(["SEARCHING", "ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "IN_PROGRESS"]);
const filters = [["all", "Todos"], ["active", "En curso"], ["completed", "Completados"], ["cancelled", "Cancelados"]];
const methods = { cash: "Efectivo", qr: "Mercado Pago / QR", card: "Tarjeta" };
const paymentStates = { paid: "Pagado", approved: "Pagado", pending: "Pendiente", failed: "Rechazado", refunded: "Reembolsado" };
const money = value => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value) || 0);
const dateLabel = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Fecha no disponible";

export default function RideHistory({ mode = "passenger" }) {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!user?.id) return;
    const request = ++generation.current;
    setError(false);
    try {
      const data = await base44.entities.Ride.filter({ [mode === "driver" ? "driver_id" : "passenger_id"]: user.id }, "-created_date", 50);
      if (request === generation.current) setRides(data);
    } catch { if (request === generation.current) setError(true); }
    finally { if (request === generation.current) setLoading(false); }
  }, [mode, user?.id]);
  useEffect(() => { setLoading(true); load(); return () => { generation.current++; }; }, [load]);
  const visible = rides.filter(ride => filter === "all" || (filter === "active" ? active : filter === "completed" ? finished : cancelled).has(ride.status));
  return <PullToRefresh onRefresh={load}><div className="max-w-md mx-auto px-5 pt-6 pb-8 space-y-5">
    <header><p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Cada recorrido, a mano</p><h1 className="text-3xl font-bold">Viajes</h1><p className="text-sm text-muted-foreground mt-2">{mode === "driver" ? "Revisá tus recorridos y sus importes." : "Consultá tus recorridos y el estado de cada viaje."}</p></header>
    <div role="group" aria-label="Filtrar viajes" className="flex gap-2 overflow-x-auto pb-1">{filters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`shrink-0 rounded-full px-4 min-h-12 text-xs font-semibold border ${filter === value ? "bg-accent text-accent-foreground border-accent" : "bg-card text-muted-foreground border-border"}`}>{label}</button>)}</div>
    {error && <div role="alert" className="rounded-2xl border border-destructive/30 p-4"><p className="text-sm">No pudimos actualizar tus viajes. {rides.length > 0 && "Mostramos la última información cargada."}</p><button type="button" onClick={load} className="flex items-center gap-2 min-h-12 text-sm font-semibold"><RefreshCw className="w-4 h-4" />Reintentar</button></div>}
    {loading ? <SkeletonList count={3} /> : !error && visible.length === 0 ? <div className="rounded-3xl border border-dashed p-7 text-center"><Navigation className="w-8 h-8 mx-auto text-accent mb-4" /><h2 className="font-bold">{rides.length ? "No hay viajes en esta categoría" : "Tu próximo recorrido empieza acá"}</h2><p className="text-sm text-muted-foreground mt-2">{rides.length ? "Probá con otro filtro para ver tus recorridos." : "Tus viajes van a aparecer en esta pantalla."}</p><Link to={`/${mode}`} className="inline-flex items-center gap-2 min-h-12 px-5 mt-5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm">{mode === "driver" ? "Ir a Conducir" : "Pedir un viaje"}<ArrowUpRight className="w-4 h-4" /></Link></div> : <div className="space-y-3">{visible.map(ride => <article key={ride.id} className="rounded-3xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3"><div><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${finished.has(ride.status) ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : cancelled.has(ride.status) ? "bg-secondary text-muted-foreground" : "bg-accent/15 text-accent"}`}>{labels[ride.status] || "Estado no disponible"}</span><p className="text-xs text-muted-foreground mt-2">{dateLabel(ride.created_date)}</p></div><div className="text-right shrink-0"><p className="font-bold text-lg">{money(ride.final_fare ?? ride.quoted_fare)}</p><p className="text-xs text-muted-foreground">{ride.final_fare == null ? "Importe estimado" : "Importe final"}</p></div></div>
      <div className="space-y-3 py-4 text-sm"><p className="flex gap-3 items-start"><span className="w-2 h-2 mt-1.5 rounded-full bg-muted-foreground shrink-0" /><span className="break-words min-w-0 text-muted-foreground">{displayAddress(ride.origin_address, "Origen")}</span></p><p className="flex gap-3 items-start"><span className="w-2 h-2 mt-1.5 rounded-full bg-accent shrink-0" /><span className="break-words min-w-0 font-medium">{displayAddress(ride.destination_address, "Destino")}</span></p></div>
      {active.has(ride.status) && <Link to={`/${mode}`} className="flex items-center justify-between min-h-12 text-accent font-semibold text-sm border-t">Volver al viaje<ArrowUpRight className="w-4 h-4" /></Link>}
      <details className="border-t group"><summary className="list-none cursor-pointer min-h-12 flex items-center justify-between text-sm font-medium">Ver detalle<ChevronDown className="w-4 h-4 group-open:rotate-180" /></summary><dl className="grid grid-cols-2 gap-3 text-xs pb-2"><dt className="text-muted-foreground">Medio de pago</dt><dd className="text-right">{methods[ride.payment_method] || "Sin informar"}</dd><dt className="text-muted-foreground">Estado del pago</dt><dd className="text-right">{paymentStates[ride.payment_status] || "Sin confirmar"}</dd><dt className="text-muted-foreground">{mode === "driver" ? "Pasajero" : "Conductor"}</dt><dd className="text-right break-words">{(mode === "driver" ? ride.passenger_name : ride.driver_name) || "Sin informar"}</dd>{ride.distance_km != null && <><dt className="text-muted-foreground">Distancia</dt><dd className="text-right">{ride.distance_km} km</dd></>}{ride.duration_min != null && <><dt className="text-muted-foreground">Duración</dt><dd className="text-right">{ride.duration_min} min</dd></>}{(mode === "driver" ? ride.passenger_rating : ride.driver_rating) != null && <><dt className="text-muted-foreground">Calificación</dt><dd className="text-right">{mode === "driver" ? ride.passenger_rating : ride.driver_rating} / 5</dd></>}</dl></details>
    </article>)}{rides.length === 50 && <p className="text-xs text-muted-foreground text-center">Mostramos tus últimos 50 viajes.</p>}</div>}
  </div></PullToRefresh>;
}
