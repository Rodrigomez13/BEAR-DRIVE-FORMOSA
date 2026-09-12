import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Server-side PIN validation — the backend validates the PIN and authorizes
// the transition to IN_PROGRESS. The PIN is never trusted from the client alone.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ride_id, pin } = body;
    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });
    if (!pin) return Response.json({ error: "PIN es obligatorio" }, { status: 400 });

    const ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    // Only the assigned driver can validate the PIN
    if (ride.driver_id !== user.id) {
      return Response.json({ error: "No autorizado para este viaje" }, { status: 403 });
    }

    // PIN can only be validated from DRIVER_ARRIVED or WAITING
    if (!["DRIVER_ARRIVED", "WAITING"].includes(ride.status)) {
      return Response.json({ error: "El viaje no está en estado de validación de PIN" }, { status: 400 });
    }

    // Server-side PIN comparison
    if (!ride.start_pin || String(pin) !== String(ride.start_pin)) {
      return Response.json({ error: "PIN incorrecto", reason: "invalid_pin" }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Ride.update(ride_id, {
      status: "IN_PROGRESS",
    });

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: user.id,
        actor_name: user.full_name || user.email,
        action: "ride_pin_validated",
        entity_type: "Ride",
        entity_id: ride_id,
        old_value: ride.status,
        new_value: "IN_PROGRESS",
      });
    } catch (e) {
      console.error("Audit log failed:", e?.message);
    }

    return Response.json({ ride: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}