import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Driver-initiated cancellation. If the driver cancels during the approach phase
// (ASSIGNED / DRIVER_APPROACHING), the ride goes back to SEARCHING so the passenger
// isn't stranded — the search timeout workflow picks it up again. Later phases
// (DRIVER_ARRIVED, WAITING, IN_PROGRESS) are treated as a real cancellation.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ride_id } = body;
    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });

    let ride;
    try {
      ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    } catch {
      return Response.json({ error: "Viaje no encontrado" }, { status: 404 });
    }
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    if (ride.driver_id !== user.id) {
      return Response.json({ error: "No autorizado para este viaje" }, { status: 403 });
    }

    const approachStatuses = ["ASSIGNED", "DRIVER_APPROACHING"];

    if (approachStatuses.includes(ride.status)) {
      const updated = await base44.asServiceRole.entities.Ride.update(ride_id, {
        status: "SEARCHING",
        driver_id: null,
        driver_name: null,
        vehicle_id: null,
        vehicle_plate: null,
        vehicle_model: null,
        vehicle_color: null,
      });

      // Notify the passenger that a new driver is being sought.
      try {
        const passenger = await base44.asServiceRole.entities.User.get(ride.passenger_id);
        if (passenger?.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: passenger.email,
            subject: "BearDrive — Buscando un nuevo conductor",
            body: `Hola,\n\nTu conductor canceló el viaje, pero estamos buscando uno nuevo para vos.\n\nOrigen: ${ride.origin_address || "No disponible"}\nDestino: ${ride.destination_address || "No disponible"}\n\nIngresá a la app para ver el estado del viaje.\n\nEquipo BearDrive`,
          });
        }
      } catch (e) {
        console.error("Failed to notify passenger of re-search", e?.message);
      }

      return Response.json({ ride: updated, re_searched: true });
    }

    const updated = await base44.asServiceRole.entities.Ride.update(ride_id, {
      status: "CANCELLED",
      cancelled_date: new Date().toISOString(),
      cancel_reason: "driver_cancelled",
    });

    return Response.json({ ride: updated, cancelled: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}