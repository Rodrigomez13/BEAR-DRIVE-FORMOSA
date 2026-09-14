import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { searchPlaces, geocodePlace } from '@/lib/geo';
import { toast } from '@/components/ui/use-toast';

export default function RideDestinationChange({ ride, onUpdated, readOnly = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  let proposal = null;
  try { proposal = JSON.parse(ride.fare_change_quote || 'null'); } catch { /* old record */ }
  const run = async (action, data = {}) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('changeRideDestination', { ride_id: ride.id, action, ...data });
      onUpdated(res.data.ride || { ...ride, fare_change_quote: JSON.stringify(res.data.quote) });
      setResults([]);
      if (action === 'confirm') setOpen(false);
    } catch (e) { toast({ title: e.response?.data?.error || e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const find = async () => {
    setBusy(true);
    try { setResults(await searchPlaces(query)); }
    catch { toast({ title: 'No se pudo buscar el destino', variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const select = async item => {
    setBusy(true);
    try {
      const pos = await geocodePlace(item.place_id, item.location);
      await run('quote', { lat: pos.lat, lng: pos.lng, address: item.label });
    } catch { toast({ title: 'No se pudo ubicar el destino', variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return <div className="my-3 rounded-xl border p-3 text-sm">
    {proposal && <div className="mb-2">
      <p>Nuevo destino propuesto: {proposal.destination_address}</p>
      <p className="font-bold">Nuevo total: ${proposal.price.toLocaleString('es-AR')}</p>
      <p>{Math.round(proposal.total_distance_km * 10) / 10} km · {Math.ceil(proposal.total_duration_min)} min</p>
      {readOnly ? <p>Pendiente de confirmación del pasajero</p> : <div className="flex gap-3 mt-2">
        <button disabled={busy} onClick={() => run('confirm', { quote_id: proposal.id })}>Confirmar nuevo precio</button>
        <button disabled={busy} onClick={() => run('cancel')}>Descartar</button>
      </div>}
    </div>}
    {!readOnly && <>
      <button onClick={() => setOpen(!open)} className="underline">Cambiar destino</button>
      {open && <div className="mt-2 space-y-2">
        <input aria-label="Nuevo destino" value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded border bg-background p-2" />
        <button disabled={busy || query.trim().length < 3} onClick={find}>Buscar dirección</button>
        {results.map(item => <button className="block text-left w-full py-2" key={item.place_id} disabled={busy} onClick={() => select(item)}>{item.label}</button>)}
      </div>}
    </>}
  </div>;
}
