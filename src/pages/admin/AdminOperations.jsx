import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';

export default function AdminOperations() {
  const [data, setData] = useState({ cases: [], rides: [], charges: [] });
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setData((await base44.functions.invoke('supportOperations', { action: 'list' })).data); }
    catch (e) { toast({ title: e.response?.data?.error || e.message, variant: 'destructive' }); }
  }, []);
  useEffect(() => {
    load();
    const unsub = base44.entities.SupportCase.subscribe(() => load());
    return () => unsub();
  }, [load]);
  const update = async (item, status) => {
    setBusy(true);
    try {
      await base44.functions.invoke('supportOperations', { action: 'case', id: item.id, status, resolution: notes[item.id] || '' });
      await load();
    } catch (e) { toast({ title: e.response?.data?.error || e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">Operaciones y soporte</h1>
    <button onClick={load} className="underline">Actualizar</button>
    <p>{data.cases.length} casos abiertos · {data.charges.length} cargos pendientes</p>
    {[...data.cases].sort((a,b) => Number(b.category === 'safety') - Number(a.category === 'safety')).map(item => <div key={item.id} className="rounded-xl border bg-card p-4 space-y-2">
      <p className="font-bold">{item.category === 'safety' ? 'SOS · ' : ''}{item.user_name || item.user_id} · {item.status}</p>
      <p>{item.description}</p><p>Viaje: {item.ride_id || '—'} · Responsable: {item.assigned_to || 'Sin asignar'}</p>
      <textarea aria-label="Resolución del caso" className="w-full p-2 border rounded bg-background" value={notes[item.id] || ''} onChange={e => setNotes({ ...notes, [item.id]: e.target.value })} />
      <div className="flex gap-4">
        <button disabled={busy} onClick={() => update(item, 'in_progress')}>Tomar caso</button>
        <button disabled={busy || !notes[item.id]?.trim()} onClick={() => update(item, 'resolved')}>Resolver y registrar</button>
      </div>
    </div>)}
    <h2 className="font-bold">Últimos 100 viajes</h2>
    <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th>Viaje</th><th>Estado</th><th>Pasajero</th><th>Conductor</th><th>Total</th></tr></thead>
      <tbody>{data.rides.map(r => <tr key={r.id} className="border-b"><td>{r.id}</td><td>{r.status}</td><td>{r.passenger_name}</td><td>{r.driver_name || '—'}</td><td>${r.final_fare || r.quoted_fare}</td></tr>)}</tbody>
    </table></div>
  </div>;
}
