import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { ride_id } = body;

    if (!ride_id) return Response.json({ error: "ride_id es obligatorio" }, { status: 400 });

    const ride = await base44.asServiceRole.entities.Ride.get(ride_id);
    if (!ride) return Response.json({ error: "Viaje no encontrado" }, { status: 404 });

    if (ride.passenger_id !== user.id) {
      return Response.json({ error: "No autorizado para este viaje" }, { status: 403 });
    }

    if (!["ARRIVED", "PAYMENT_PENDING"].includes(ride.status)) {
      return Response.json({ error: "El viaje no está listo para pago" }, { status: 400 });
    }

    const fare = ride.final_fare || ride.quoted_fare;
    if (!fare || fare <= 0) {
      return Response.json({ error: "Tarifa inválida" }, { status: 400 });
    }

    const amountInCents = Math.round(fare * 100);
    const origin = new URL(req.url).origin;

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${origin}/passenger?payment=success&ride=${ride_id}`);
    params.append("cancel_url", `${origin}/passenger?payment=cancelled&ride=${ride_id}`);
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "ars");
    params.append("line_items[0][price_data][unit_amount]", String(amountInCents));
    params.append("line_items[0][price_data][product_data][name]", `Viaje BearDrive`);
    params.append("line_items[0][price_data][product_data][description]", `${ride.origin_address || "Origen"} → ${ride.destination_address || "Destino"}`);
    params.append("metadata[ride_id]", ride_id);
    params.append("metadata[passenger_id]", ride.passenger_id);
    params.append("metadata[base44_app_id]", secrets.get("BASE44_APP_ID") || "");
    params.append("payment_intent_data[metadata][ride_id]", ride_id);
    params.append("payment_intent_data[metadata][base44_app_id]", secrets.get("BASE44_APP_ID") || "");

    const sessionResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
        "Stripe-Version": "2025-10-29.clover",
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": crypto.randomUUID()
      },
      body: params
    });

    if (!sessionResponse.ok) {
      const err = await sessionResponse.json();
      console.error("Stripe error creating session:", JSON.stringify(err));
      return Response.json({ error: err.error?.message || "Error al crear sesión de pago" }, { status: 500 });
    }

    const session = await sessionResponse.json();

    // Save session id on ride for tracking
    await base44.asServiceRole.entities.Ride.update(ride_id, {
      stripe_session_id: session.id
    });

    return Response.json({ checkout_url: session.url, session_id: session.id });
  } catch (error) {
    console.error("createRidePayment error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}