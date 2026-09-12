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

// System function invoked by the "Ride Search Timeout" workflow when a ride enters SEARCHING.
// Best-effort push to nearby online drivers. Polling (getNearbyRideRequests) is the fallback
// if push credentials aren't configured — failures are caught and logged, never thrown.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { ride_id } = body;
    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });

    let ride;
    try {
      ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    } catch {
      return Response.json({ skipped: true, reason: "ride_not_found" });
    }
    if (!ride || ride.status !== "SEARCHING") {
      return Response.json({ skipped: true, reason: "not_searching" });
    }
    if (ride.origin_lat == null || ride.origin_lng == null) {
      return Response.json({ skipped: true, reason: "no_origin" });
    }

    const onlineDrivers = await base44.asServiceRole.entities.DriverLocation.filter({ online: true });
    const radius = 15;

    const nearby = onlineDrivers.filter((dl) => {
      if (dl.lat == null || dl.lng == null) return false;
      if (dl.driver_id === ride.passenger_id) return false;
      return haversineKm(ride.origin_lat, ride.origin_lng, dl.lat, dl.lng) <= radius;
    });

    let notified = 0;
    for (const dl of nearby) {
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

    return Response.json({ notified, considered: nearby.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}