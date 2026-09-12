import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// System function invoked by the "Ride Search Timeout" workflow after a 90s wait.
// No user auth — the workflow has no user session. The operation is narrow and safe:
// it only moves a still-SEARCHING ride to NO_DRIVERS so the passenger isn't left hanging.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { ride_id } = body;

    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });

    const ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    // Only timeout if still searching — a driver may have accepted during the wait.
    if (ride.status !== "SEARCHING") {
      return Response.json({ skipped: true, reason: "status_changed", status: ride.status });
    }

    const updated = await base44.asServiceRole.entities.Ride.update(ride_id, {
      status: "NO_DRIVERS",
    });

    return Response.json({ ride: updated, timed_out: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}