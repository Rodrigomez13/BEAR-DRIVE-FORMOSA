import { secrets } from 'base44:runtime';
import { fail } from './domain.ts';
import { computeFare } from './pricing.ts';

export async function quoteRoute(client, owner, input) {
  for (const key of ['origin_lat', 'origin_lng', 'destination_lat', 'destination_lng']) {
    const max = key.endsWith('lat') ? 90 : 180;
    if (!Number.isFinite(input[key]) || Math.abs(input[key]) > max) fail('Coordenadas inválidas');
  }
  if (!['basic', 'flash', 'premium'].includes(input.category)) fail('Categoría inválida');
  const key = secrets.get('GOOGLE_ROUTES_API_KEY');
  if (!key) fail('La cotización de rutas no está configurada', 503);
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' },
    body: JSON.stringify({ origin: { location: { latLng: { latitude: input.origin_lat, longitude: input.origin_lng } } }, destination: { location: { latLng: { latitude: input.destination_lat, longitude: input.destination_lng } } }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE' }),
  });
  if (!res.ok) fail('No se pudo cotizar la ruta. Intentá nuevamente.', 503);
  const route = (await res.json()).routes?.[0];
  const km = route?.distanceMeters / 1000;
  const min = parseFloat(route?.duration) / 60;
  if (!(km > 0) || !(min > 0)) fail('No se encontró una ruta válida');
  const configs = await client.asServiceRole.entities.PricingConfig.filter({ active: true });
  const pricing = configs[0];
  if (!pricing || ['base_fare','per_km','per_min','min_fare'].some(k => !Number.isFinite(pricing[k]) || pricing[k] < 0)) fail('Las tarifas necesitan configuración administrativa', 503);
  const basic = computeFare(km, min, 'basic', pricing);
  const premium = computeFare(km, min, 'premium', pricing);
  const price = input.category === 'flash' ? Math.round((basic + premium) / 2) : computeFare(km, min, input.category, pricing);
  const record = await client.asServiceRole.entities.RideQuote.create({
    passenger_id: owner, category: input.category, price, currency: 'ARS', distance_km: km, duration_min: Math.ceil(min),
    origin_lat: input.origin_lat, origin_lng: input.origin_lng, destination_lat: input.destination_lat, destination_lng: input.destination_lng,
    origin_address: String(input.origin_address || '').slice(0, 300), destination_address: String(input.destination_address || '').slice(0, 300),
    provider: 'google_routes', expires_at: new Date(Date.now() + 300000).toISOString(), consumed: false,
    search_radius_km: input.category === 'flash' ? 20 : 10, retry_count: 0,
  });
  return { ...record, quote_id: record.id, ttl_seconds: 300 };
}
