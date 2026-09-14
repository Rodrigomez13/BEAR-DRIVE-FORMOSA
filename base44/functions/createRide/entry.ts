import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, fail, all, ACTIVE, requireNoDebt } from '../../shared/domain.ts';
import { withUserLock } from '../../shared/userLock.ts';
export default req => api(req, createClientFromRequest, async (client, user, body) => {
  const e = client.asServiceRole.entities;
  return withUserLock(client, user.id, async () => {
    if (!body.quote_id) fail('Cotizá el viaje primero');
    const previous = await e.Ride.filter({ passenger_id: user.id, quote_id: body.quote_id });
    if (previous.length) return { ride: previous[0] };
    await requireNoDebt(client, user.id);
    if ((await all(e.Ride, { passenger_id: user.id, status: { $in: ACTIVE } })).length) fail('Ya tenés un viaje activo', 409);
    const q = await e.RideQuote.get(body.quote_id);
    if (!q || q.passenger_id !== user.id || q.consumed || Date.parse(q.expires_at) <= Date.now()) fail('La cotización venció. Volvé a cotizar.', 409);
    if (!['cash','qr'].includes(body.payment_method)) fail('Elegí efectivo o Mercado Pago');
    const bytes = crypto.getRandomValues(new Uint32Array(1));
    const ride = await e.Ride.create({ passenger_id: user.id, passenger_name: user.full_name || '', status: 'SEARCHING',
      origin_lat: q.origin_lat, origin_lng: q.origin_lng, destination_lat: q.destination_lat, destination_lng: q.destination_lng,
      origin_address: q.origin_address, destination_address: q.destination_address, category: q.category,
      payment_method: body.payment_method, quoted_fare: q.price, distance_km: q.distance_km, duration_min: q.duration_min,
      start_pin: String(1000 + bytes[0] % 9000), quote_id: q.id, quote_data: JSON.stringify(q),
      notes: String(body.notes || '').slice(0,500), search_radius_km: q.search_radius_km, retry_count: q.retry_count,
      retry_of: q.retry_of || null, search_started_at: new Date().toISOString(), idempotency_key: q.id,
      destination_revision: 0, payment_status: 'unpaid' });
    await e.RideQuote.update(q.id, { consumed: true });
    return { ride };
  });
});
