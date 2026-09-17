import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { searchPlaces, geocodePlace } from '@/lib/geo';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Search, Loader2, Check, X } from 'lucide-react';

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
    } catch (e) {
      toast({ title: e.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const find = async () => {
    setBusy(true);
    try {
      setResults(await searchPlaces(query));
    } catch {
      toast({ title: 'No se pudo buscar el destino', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const select = async (item) => {
    setBusy(true);
    try {
      const pos = await geocodePlace(item.place_id, item.location);
      await run('quote', { lat: pos.lat, lng: pos.lng, address: item.label });
    } catch {
      toast({ title: 'No se pudo ubicar el destino', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-3 rounded-2xl border border-border/70 bg-card/80 p-3.5 text-xs shadow-sm">
      {proposal && (
        <div className="mb-3 p-3 rounded-xl bg-accent/10 border border-accent/30 space-y-1.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent shrink-0" />
            <p className="font-bold text-foreground">Nuevo destino propuesto:</p>
          </div>
          <p className="text-foreground text-xs pl-6">{proposal.destination_address}</p>
          <div className="flex items-center justify-between pt-1 pl-6">
            <span className="text-muted-foreground">{Math.round(proposal.total_distance_km * 10) / 10} km · {Math.ceil(proposal.total_duration_min)} min</span>
            <span className="font-bold text-accent text-sm">${(proposal.price || 0).toLocaleString('es-AR')}</span>
          </div>

          {readOnly ? (
            <p className="text-muted-foreground italic pt-1 pl-6">Pendiente de confirmación del pasajero</p>
          ) : (
            <div className="flex gap-2 mt-2 pt-2 border-t border-accent/20">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run('confirm', { quote_id: proposal.id })}
                className="flex-1 bear-gold-gradient text-foreground font-bold border-0 h-9"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                Confirmar nuevo precio
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run('cancel')}
                className="h-9 px-3 text-destructive"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Descartar
              </Button>
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">¿Cambio de planes en viaje?</span>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="text-accent font-semibold hover:underline text-xs flex items-center gap-1"
            >
              <MapPin className="w-3.5 h-3.5" />
              {open ? 'Cerrar' : 'Cambiar destino'}
            </button>
          </div>

          {open && (
            <div className="mt-3 space-y-2 pt-2 border-t border-border/50">
              <div className="flex gap-2">
                <Input
                  aria-label="Nuevo destino"
                  placeholder="Ingresá la nueva dirección..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && query.trim().length >= 3) find(); }}
                  className="h-9 text-xs"
                />
                <Button
                  size="sm"
                  disabled={busy || query.trim().length < 3}
                  onClick={find}
                  className="h-9 bear-gold-gradient text-foreground font-bold px-3 shrink-0"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </Button>
              </div>

              {results.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-border/60 bg-secondary/30 p-1.5">
                  {results.map((item) => (
                    <button
                      key={item.place_id}
                      type="button"
                      disabled={busy}
                      onClick={() => select(item)}
                      className="block text-left w-full py-1.5 px-2 rounded-lg hover:bg-accent/15 text-xs text-foreground transition-colors truncate"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
