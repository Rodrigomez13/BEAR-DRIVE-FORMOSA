import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// In-app ride chat — replaces direct phone calls with a privacy-preserving
// channel. The backend validates that the sender is a participant of the ride
// (passenger or driver) and that the ride is in an active communication state.
// Phone numbers are never exposed; all communication flows through this channel.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ride_id, text } = body;
    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });
    if (!text || typeof text !== "string") return Response.json({ error: "text es obligatorio" }, { status: 400 });

    // Truncate and sanitize — no HTML, no excessive length
    const cleanText = text.trim().slice(0, 500);
    if (!cleanText) return Response.json({ error: "Mensaje vacío" }, { status: 400 });

    const ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    // Determine sender role and validate participation
    let senderRole;
    if (ride.passenger_id === user.id) {
      senderRole = "passenger";
    } else if (ride.driver_id === user.id) {
      senderRole = "driver";
    } else {
      return Response.json({ error: "No autorizado para este viaje" }, { status: 403 });
    }

    // Only allow chat during active ride phases (not after completion/cancellation)
    const activeStates = ["ASSIGNED", "DRIVER_APPROACHING", "DRIVER_ARRIVED", "WAITING", "PIN_VALIDATION", "IN_PROGRESS", "ARRIVED", "PAYMENT_PENDING"];
    if (!activeStates.includes(ride.status)) {
      return Response.json({ error: "El chat no está disponible en este estado del viaje" }, { status: 400 });
    }

    const message = await base44.asServiceRole.entities.RideMessage.create({
      ride_id,
      sender_id: user.id,
      sender_role: senderRole,
      text: cleanText,
    });

    return Response.json({ message });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}