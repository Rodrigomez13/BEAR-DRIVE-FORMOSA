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

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { lat, lng, radius_km } = body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return Response.json({ error: "lat y lng son obligatorios" }, { status: 400 });
    }
    const radius = typeof radius_km === "number" && radius_km > 0 ? radius_km : 15;

    // Service role: rides are owned by passengers, drivers need cross-user read access.
    const rides = await base44.asServiceRole.entities.Ride.filter(
      { status: "SEARCHING" },
      "-created_date",
      30
    );

    const nearby = rides
      .map((r) => ({
        ...r,
        distance_km:
          r.origin_lat != null && r.origin_lng != null
            ? haversineKm(lat, lng, r.origin_lat, r.origin_lng)
            : null,
      }))
      .filter((r) => r.distance_km != null && r.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km);

    return Response.json({ rides: nearby });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}