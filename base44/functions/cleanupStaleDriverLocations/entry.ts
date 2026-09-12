import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// System function invoked by the "Driver Location Cleanup" workflow every 5 minutes.
// Marks offline any DriverLocation that is still "online" but hasn't reported a position
// in the last 5 minutes — handles drivers who closed the app without going offline.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const staleThreshold = Date.now() - 5 * 60 * 1000;

    const onlineDrivers = await base44.asServiceRole.entities.DriverLocation.filter({ online: true });

    const stale = onlineDrivers.filter((dl) => {
      const updated = dl.updated_date ? new Date(dl.updated_date).getTime() : 0;
      return updated < staleThreshold;
    });

    let cleaned = 0;
    for (const dl of stale) {
      try {
        await base44.asServiceRole.entities.DriverLocation.update(dl.id, { online: false });
        cleaned += 1;
      } catch (e) {
        console.error("Failed to clean stale location", dl.id, e?.message);
      }
    }

    return Response.json({ cleaned, checked: onlineDrivers.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}