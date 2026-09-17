import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// System function invoked by the "Driver Location Cleanup" workflow every 5 minutes.
// Two-tier cleanup to keep the DriverLocation collection lean and the matching system fast:
//
//   Tier 1 — Mark offline: any DriverLocation still "online" but not updated in 5 min.
//   Tier 2 — Delete:       any DriverLocation not updated in 1 hour (truly stale, driver
//                          likely closed the app long ago; a fresh record is created when
//                          they go online again).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = Date.now();
    const OFFLINE_THRESHOLD = 5 * 60 * 1000;   // 5 min
    const DELETE_THRESHOLD = 60 * 60 * 1000;   // 1 hour

    const allLocations = await base44.asServiceRole.entities.DriverLocation.list(500);

    const toMarkOffline = [];
    const toDelete = [];

    for (const dl of allLocations) {
      const updated = dl.updated_date ? new Date(dl.updated_date).getTime() : 0;
      const age = now - updated;
      if (age >= DELETE_THRESHOLD) {
        toDelete.push(dl);
      } else if (dl.online && age >= OFFLINE_THRESHOLD) {
        toMarkOffline.push(dl);
      }
    }

    // Tier 1: bulk-mark stale online drivers as offline (one API call)
    let markedOffline = 0;
    if (toMarkOffline.length > 0) {
      await base44.asServiceRole.entities.DriverLocation.bulkUpdate(
        toMarkOffline.map((dl) => ({ id: dl.id, online: false }))
      );
      markedOffline = toMarkOffline.length;
    }

    // Tier 2: delete records inactive for more than 1 hour
    let deleted = 0;
    for (const dl of toDelete) {
      try {
        await base44.asServiceRole.entities.DriverLocation.delete(dl.id);
        deleted += 1;
      } catch (e) {
        console.error("Failed to delete stale location", dl.id, e?.message);
      }
    }

    return Response.json({
      markedOffline,
      deleted,
      checked: allLocations.length,
    });
  } catch (error) {
    console.error("cleanupStaleDriverLocations error", error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}