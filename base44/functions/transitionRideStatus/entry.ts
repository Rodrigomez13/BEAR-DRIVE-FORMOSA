import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isValidTransition } from '../../shared/rideStateMachine.ts';

// Server-authoritative ride status transitions. The backend validates that:
// 1. The user is authenticated
// 2. The user is authorized for this ride (driver or passenger)
// 3. The transition is legal per the state machine
// Only then does the status change. The frontend cannot skip states.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ride_id, target_status, reason } = body;
    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });
    if (!target_status) return Response.json({ error: "target_status es obligatorio" }, { status: 400 });

    const ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    // Authorization: only the assigned driver or the passenger can transition
    const isDriver = ride.driver_id === user.id;
    const isPassenger = ride.passenger_id === user.id;
    if (!isDriver && !isPassenger) {
      return Response.json({ error: "No autorizado para este viaje" }, { status: 403 });
    }

    // Validate transition is legal
    if (!isValidTransition(ride.status, target_status)) {
      return Response.json({
        error: `Transición no válida: ${ride.status} → ${target_status}`,
        reason: "invalid_transition",
        current_status: ride.status,
      }, { status: 400 });
    }

    // Role-based transition authorization
    // Driver-only transitions: DRIVER_ARRIVED, ARRIVED, PAYMENT_PENDING
    const driverOnly = ["DRIVER_ARRIVED", "ARRIVED", "PAYMENT_PENDING"];
    if (driverOnly.includes(target_status) && !isDriver) {
      return Response.json({ error: "Solo el conductor puede realizar esta transición" }, { status: 403 });
    }

    const updateData = { status: target_status };
    if (target_status === "ARRIVED") {
      // No extra data needed; arrival is detected by GPS
    }

    const updated = await base44.asServiceRole.entities.Ride.update(ride_id, updateData);

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: user.id,
        actor_name: user.full_name || user.email,
        action: "ride_status_transition",
        entity_type: "Ride",
        entity_id: ride_id,
        old_value: ride.status,
        new_value: target_status,
        reason: reason || null,
      });
    } catch (e) {
      console.error("Audit log failed:", e?.message);
    }

    return Response.json({ ride: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}