import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Atomic ride acceptance — the backend is the sole authority for this transition.
// Prevents two drivers from accepting the same ride: the status check happens
// server-side, and only a SEARCHING ride can be accepted. If another driver
// already accepted between the client's poll and this call, the status will
// no longer be SEARCHING and the request is rejected.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ride_id, vehicle_id, vehicle_plate, vehicle_model, vehicle_color, driver_lat, driver_lng } = body;
    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });

    // Verify driver is eligible to accept rides
    if (user.driver_capability !== "APPROVED_ELIGIBLE") {
      return Response.json({ error: "No estás habilitado para conducir" }, { status: 403 });
    }

    // Pre-fetch for validation (passenger check) — not authoritative for the race
    const ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    // Driver cannot accept their own ride
    if (ride.passenger_id === user.id) {
      return Response.json({ error: "No podés aceptar tu propio viaje" }, { status: 403 });
    }

    // Atomic conditional update — only succeeds if the ride is STILL SEARCHING.
    // The DB-level filter { id, status: "SEARCHING" } eliminates the race window
    // entirely: if another driver already transitioned the ride between our fetch
    // and this call, the filter won't match and nothing gets modified.
    await base44.asServiceRole.entities.Ride.updateMany(
      { id: ride_id, status: "SEARCHING" },
      { $set: {
        status: "DRIVER_APPROACHING",
        driver_id: user.id,
        driver_name: user.full_name || user.email,
        vehicle_id: vehicle_id || null,
        vehicle_plate: vehicle_plate || null,
        vehicle_model: vehicle_model || null,
        vehicle_color: vehicle_color || null,
      }}
    );

    // Re-fetch to verify we won the race (our driver_id is set)
    const updated = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!updated || updated.driver_id !== user.id) {
      return Response.json({ error: "El viaje ya fue tomado por otro conductor", reason: "already_assigned" }, { status: 409 });
    }

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: user.id,
        actor_name: user.full_name || user.email,
        action: "ride_accepted",
        entity_type: "Ride",
        entity_id: ride_id,
        old_value: "SEARCHING",
        new_value: "DRIVER_APPROACHING",
      });
    } catch (e) {
      console.error("Audit log failed:", e?.message);
    }

    return Response.json({ ride: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}