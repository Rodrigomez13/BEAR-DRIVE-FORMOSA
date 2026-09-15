import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShieldAlert, Headphones, Receipt, Search } from 'lucide-react';

const categoryLabels = { safety: 'Seguridad', payment: 'Pago', ride: 'Viaje', driver: 'Conductor', account: 'Cuenta' };
const statusLabels = { open: 'Abierto', in_progress: 'En atención' };
const money = value => new Intl.NumberFormat('es-AR', {style:'currency',currency:'ARS'}).format(Number(value) || 0);

export default function AdminOperations() {
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const request = useRef(0);
  const saving = useRef(false);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError('');
    try {
      const response = await base44.functions.invoke('supportOperations', { action: 'list' });
      if (id === request.current) setData(response.data);
    } catch (e) { if (id === request.current) setError(e.response?.data?.error || 'No se pudo actualizar la información.'); }
    finally { if (id === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const unsub = base44.entities.SupportCase.subscribe(() => load());
    return () => { request.current++; unsub(); };
  }, [load]);
  const update = async (item, status) => {
    if (saving.current) return;
    saving.current = true; setBusy(true);
    try {
      await base44.functions.invoke('supportOperations', { action: 'case', id: item.id, status, resolution: notes[item.id] || '' });
      setNotes(previous => { const next = {...previous}; delete next[item.id]; return next; });
      toast({ title: status === 'resolved' ? 'Caso resuelto y registrado' : 'Caso asignado' });
      await load();
    } catch (e) { toast({ title: e.response?.data?.error || e.message, variant: 'destructive' }); }
    finally { saving.current = false; setBusy(false); }
  };
  const cases = data?.cases || [];
  const visible = cases.filter(item => (filter === 'all' || item.category === filter) && [item.id,item.user_name,item.user_id,item.description,item.ride_id].some(value => String(value || '').toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()))).sort((a,b) => Number(b.category === 'safety') - Number(a.category === 'safety'));
  return <div className="max-w-6xl mx-auto space-y-5">
    <header className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-2xl font-bold">Operaciones y soporte</h1><p className="text-sm text-muted-foreground mt-1">Atendé consultas y revisá los viajes de la plataforma.</p></div><Button variant="outline" disabled={loading} onClick={load}><RefreshCw className="w-4 h-4 mr-2" />{loading ? 'Actualizando…' : 'Actualizar'}</Button></header>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-destructive">{error}{data && ' Se conserva la última información cargada.'}</p>}
    <div className="grid sm:grid-cols-3 gap-3">{[[Headphones,'Casos abiertos',data ? cases.length : '—'],[ShieldAlert,'Casos de seguridad',data ? cases.filter(item=>item.category==='safety').length : '—'],[Receipt,'Cargos pendientes',data ? data.charges.length : '—']].map(([Icon,label,count])=><div key={label} className="rounded-2xl border bg-card p-5"><Icon className="w-5 h-5 text-accent mb-2" /><p className="text-3xl font-bold">{count}</p><p className="text-sm text-muted-foreground mt-1">{label}</p></div>)}</div>
    <div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 rounded-xl border bg-card px-3 flex-1 min-w-0"><Search className="w-4 h-4 shrink-0" /><input aria-label="Buscar casos por usuario, viaje o descripción" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar usuario, viaje o consulta" className="bg-transparent min-h-12 w-full outline-none" /></label><select aria-label="Filtrar categoría de soporte" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border bg-card px-3 min-h-12"><option value="all">Todas las categorías</option>{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
    {loading && !data && <p role="status">Cargando operaciones…</p>}
    {data && !visible.length && <p className="rounded-2xl border border-dashed p-7 text-center text-muted-foreground">{cases.length ? 'No hay casos que coincidan con la búsqueda.' : 'No hay consultas abiertas.'}</p>}
    {visible.map(item => <article key={item.id} className={`rounded-2xl border bg-card p-5 space-y-3 ${item.category==='safety' ? 'border-destructive/40' : ''}`}>
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{item.user_name || item.user_id}</h2><span className="text-xs rounded-full bg-secondary px-3 py-1">{categoryLabels[item.category] || item.category} · {statusLabels[item.status] || item.status}</span></div>
      <p className="text-sm whitespace-pre-wrap break-words">{item.description}</p><p className="text-xs text-muted-foreground break-words">Caso: {item.id} · Viaje: {item.ride_id || 'Sin viaje asociado'} · Responsable: {item.assigned_to || 'Sin asignar'}</p>
      <label className="block text-sm font-medium">Nota de atención o resolución<textarea aria-label={`Resolución del caso ${item.id}`} disabled={busy} maxLength={2000} rows={3} className="block w-full mt-2 p-3 border rounded-xl bg-background font-normal" value={notes[item.id] || ''} onChange={e => setNotes({ ...notes, [item.id]: e.target.value })} /></label>
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy || item.status==='in_progress'} onClick={() => update(item, 'in_progress')}>Tomar caso</Button><Button disabled={busy || !notes[item.id]?.trim()} onClick={() => update(item, 'resolved')}>Resolver y registrar</Button></div>
    </article>)}
    <section className="rounded-2xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-2 mb-4"><h2 className="font-bold">Últimos 100 viajes</h2><Link className="text-sm underline" to="/admin/payments">Revisar cobros y cuentas</Link></div><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['Viaje','Estado','Pasajero','Conductor','Importe'].map(label=><th scope="col" key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{data?.rides.map(r=><tr key={r.id} className="border-t"><td className="p-3">{r.id}</td><td className="p-3">{r.status}</td><td className="p-3">{r.passenger_name}</td><td className="p-3">{r.driver_name || '—'}</td><td className="p-3 whitespace-nowrap">{money(r.final_fare ?? r.quoted_fare)}</td></tr>)}</tbody></table>{data && !data.rides.length && <p className="text-sm text-muted-foreground p-3">No hay viajes registrados.</p>}</div></section>
  </div>;
}
