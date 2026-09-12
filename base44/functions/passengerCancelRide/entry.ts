import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isValidTransition } from '../../shared/rideStateMachine.ts';

// Server-authoritative passenger cancel — validates that:
// 1. The user is the passenger of this ride
// 2. The ride is in a cancellable state (per state machine)
// Only then does the status change to CANCELLED with proper metadata.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ride_id, reason } = body;
    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });

    const ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    // Only the passenger can cancel via this function
    if (ride.passenger_id !== user.id) {
      return Response.json({ error: "No autorizado para este viaje" }, { status: 403 });
    }

    // Validate transition is legal per state machine
    if (!isValidTransition(ride.status, "CANCELLED")) {
      return Response.json({
        error: "El viaje no se puede cancelar en este estado",
        reason: "invalid_transition",
        current_status: ride.status,
      }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Ride.update(ride_id, {
      status: "CANCELLED",
      cancelled_date: new Date().toISOString(),
      cancel_reason: reason || "passenger_cancelled",
    });

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: user.id,
        actor_name: user.full_name || user.email,
        action: "ride_cancelled_passenger",
        entity_type: "Ride",
        entity_id: ride_id,
        old_value: ride.status,
        new_value: "CANCELLED",
        reason: reason || "passenger_cancelled",
      });
    } catch (e) {
      console.error("Audit log failed:", e?.message);
    }

    return Response.json({ ride: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}