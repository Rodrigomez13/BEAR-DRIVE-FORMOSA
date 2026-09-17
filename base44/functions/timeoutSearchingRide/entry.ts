import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Workflows and authorized clients may request expiry; server time and search generation decide it.
export default async function(req) {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { ride_id } = body;
    if (!ride_id) {
      return Response.json({ error: 'ride_id es obligatorio' }, { status: 400 });
    }

    const e = client.asServiceRole.entities;
    let ride;
    try {
      ride = await e.Ride.get(ride_id);
    } catch {
      return Response.json({ skipped: true, reason: 'ride_not_found' });
    }

    if (!ride) {
      return Response.json({ skipped: true, reason: 'ride_not_found' });
    }

    if (user.role !== 'admin' && ride.passenger_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const started = ride.search_started_at || ride.created_date;
    if (ride.status !== 'SEARCHING' || Date.now() - Date.parse(started) < 90000) {
      return Response.json({ skipped: true });
    }

    const result = await e.Ride.updateMany(
      { id: ride.id, status: 'SEARCHING', search_started_at: ride.search_started_at || null },
      { $set: { status: 'NO_DRIVERS' } }
    );
    return Response.json({ timed_out: result.updated === 1 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}