import { eligibleVehicle, premiumEligible } from '../../shared/domain.ts';
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

// Notification hint only. Acceptance eligibility is always checked on the server.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { ride_id, round } = body;
    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });

    const roundNum = [1, 2, 3].includes(round) ? round : 1;
    if (roundNum !== 1) return Response.json({ skipped: true });

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

    const generation = ride.search_started_at || ride.created_date;
    const notifiedSearch = await base44.asServiceRole.entities.Ride.updateMany({ id: ride.id, status: 'SEARCHING', notified_search: ride.notified_search || null }, { $set: { notified_search: generation } });
    if (ride.notified_search === generation || notifiedSearch.updated !== 1) return Response.json({ skipped: true });

    const onlineDrivers = await base44.asServiceRole.entities.DriverLocation.filter({ online: true });

    // Filter by this round's distance band, sort closest-first.
    const candidates = onlineDrivers
      .filter((dl) => dl.lat != null && dl.lng != null && dl.driver_id !== ride.passenger_id)
      .map((dl) => ({
        ...dl,
        _dist: haversineKm(ride.origin_lat, ride.origin_lng, dl.lat, dl.lng),
      }))
      .filter((dl) => dl._dist <= (ride.search_radius_km || 10))
      .sort((a, b) => a._dist - b._dist);

    const toNotify = candidates;

    let notified = 0;
    for (const dl of toNotify) {
      try {
        const candidate = await base44.asServiceRole.entities.User.get(dl.driver_id);
        const vehicle = await eligibleVehicle(base44, candidate, dl.vehicle_id);
        if (ride.category === 'premium' && !premiumEligible(vehicle)) continue;
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