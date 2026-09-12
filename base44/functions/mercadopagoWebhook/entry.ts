import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { finalizeRideCompletion } from '../../shared/rideCompletion.ts';

// Mercado Pago webhook handler — confirms ride completion when QR payments
// are approved. MP sends: { type: "payment", data: { id: "123456789" } }
// We fetch the payment to verify its status and match it to a ride via
// the metadata[ride_id] field set when the preference was created.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { type, data } = body;

    if (type !== "payment" || !data?.id) {
      return Response.json({ received: true, ignored: true });
    }

    const paymentId = data.id;
    const mpToken = secrets.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mpToken) {
      console.error("MERCADO_PAGO_ACCESS_TOKEN no configurado");
      return Response.json({ error: "MP no configurado" }, { status: 500 });
    }

    // Fetch the payment details to verify status
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${mpToken}`,
      },
    });

    if (!payRes.ok) {
      const err = await payRes.json();
      console.error("MP error fetching payment:", JSON.stringify(err));
      return Response.json({ error: err.message }, { status: 500 });
    }

    const payment = await payRes.json();

    // Only process approved payments
    if (payment.status !== "approved") {
      return Response.json({ received: true, status: payment.status });
    }

    const rideId = payment.metadata?.ride_id;
    if (!rideId) {
      console.error("MP webhook: ride_id ausente en metadata del pago", paymentId);
      return Response.json({ received: true, warning: "no_ride_id" });
    }

    const ride = await base44.asServiceRole.entities.Ride.get(rideId);
    if (!ride) {
      console.error("MP webhook: viaje no encontrado:", rideId);
      return Response.json({ received: true, warning: "ride_not_found" });
    }

    if (ride.status === "COMPLETED") {
      return Response.json({ received: true, already_completed: true });
    }

    const fare = ride.final_fare || ride.quoted_fare;
    const completedDate = new Date().toISOString();

    await base44.asServiceRole.entities.Ride.update(rideId, {
      status: "COMPLETED",
      final_fare: fare,
      completed_date: completedDate,
    });

    await finalizeRideCompletion(base44, rideId, completedDate);

    return Response.json({ received: true, completed: true });
  } catch (error) {
    console.error("mercadopagoWebhook error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}