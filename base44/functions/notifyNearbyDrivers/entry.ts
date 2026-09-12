import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Matching rounds — each round targets a distinct distance band so no driver
// receives duplicate pushes. Closest drivers are notified first; the search
// expands outward only if earlier rounds don't produce an acceptance.
//
// Round 1 (0–5 km, max 5 drivers):  immediate, closest matches
// Round 2 (5–10 km, max 10 drivers): first expansion after 30s
// Round 3 (10–15 km, all):           final expansion after 60s
const ROUND_CONFIG = {
  1: { minKm: 0, maxKm: 5, limit: 5 },
  2: { minKm: 5, maxKm: 10, limit: 10 },
  3: { minKm: 10, maxKm: 15, limit: null },
};

// System function invoked by the "Ride Search Timeout" workflow when a ride
// enters SEARCHING. Best-effort push to nearby online drivers in expanding
// rounds. Polling (getNearbyRideRequests) is the fallback if push credentials
// aren't configured — failures are caught and logged, never thrown.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { ride_id, round } = body;
    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });

    const roundNum = [1, 2, 3].includes(round) ? round : 1;
    const config = ROUND_CONFIG[roundNum];

    let ride;
    try {
      ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    } catch {
      return Response.json({ skipped: true, reason: "ride_not_found" });
    }
    // Skip if a driver already accepted — later rounds are no-ops.
    if (!ride || ride.status !== "SEARCHING") {
      return Response.json({ skipped: true, reason: "not_searching" });
    }
    if (ride.origin_lat == null || ride.origin_lng == null) {
      return Response.json({ skipped: true, reason: "no_origin" });
    }

    const onlineDrivers = await base44.asServiceRole.entities.DriverLocation.filter({ online: true });

    // Filter by this round's distance band, sort closest-first.
    const candidates = onlineDrivers
      .filter((dl) => dl.lat != null && dl.lng != null && dl.driver_id !== ride.passenger_id)
      .map((dl) => ({
        ...dl,
        _dist: haversineKm(ride.origin_lat, ride.origin_lng, dl.lat, dl.lng),
      }))
      .filter((dl) => dl._dist >= config.minKm && dl._dist <= config.maxKm)
      .sort((a, b) => a._dist - b._dist);

    const toNotify = config.limit ? candidates.slice(0, config.limit) : candidates;

    let notified = 0;
    for (const dl of toNotify) {
      try {
        await base44.asServiceRole.integrations.Core.SendPushNotification({
          user_id: dl.driver_id,
          title: "Nuevo viaje cercano",
          content: `Viaje a ${ride.destination_address || "destino"} · $${(ride.quoted_fare || 0).toLocaleString("es-AR")}`,
          action_label: "Ver viaje",
          action_url: "/driver",
        });
        notified += 1;
      } catch (e) {
        console.error("Push failed for driver", dl.driver_id, e?.message);
      }
    }

    return Response.json({ round: roundNum, notified, considered: toNotify.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}