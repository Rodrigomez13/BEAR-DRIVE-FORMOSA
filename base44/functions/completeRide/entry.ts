import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { finalizeRideCompletion } from '../../shared/rideCompletion.ts';

// Server-authoritative ride completion with payment routing.
// The driver triggers this at PAYMENT_PENDING. Depending on the payment method:
//
// - cash:  immediate completion (driver confirms cash received)
// - card:  auto-charge the passenger's saved card (off-session PaymentIntent).
//          If the charge succeeds → ride COMPLETED. If it fails → ride stays
//          PAYMENT_PENDING and the passenger can retry manually.
// - qr:    create a Stripe Checkout Session and return the URL. The driver
//          shows a QR encoding this URL; the passenger scans/taps and pays.
//          The webhook confirms completion when payment succeeds.
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

    if (ride.status !== "PAYMENT_PENDING") {
      return Response.json({ error: "El viaje no está en estado de cobro" }, { status: 400 });
    }

    if (ride.driver_id !== user.id) {
      return Response.json({ error: "Solo el conductor puede iniciar el cobro" }, { status: 403 });
    }

    const fare = ride.final_fare || ride.quoted_fare;
    if (!fare || fare <= 0) {
      return Response.json({ error: "Tarifa inválida" }, { status: 400 });
    }

    const completedDate = new Date().toISOString();

    // --- CASH: immediate completion ---
    if (ride.payment_method === "cash") {
      const updated = await base44.asServiceRole.entities.Ride.update(ride_id, {
        status: "COMPLETED",
        final_fare: fare,
        completed_date: completedDate,
      });
      await finalizeRideCompletion(base44, ride_id, completedDate);
      return Response.json({ ride: updated, payment_status: "completed" });
    }

    // --- CARD: auto-charge saved card (off-session) ---
    if (ride.payment_method === "card") {
      const passenger = await base44.asServiceRole.entities.User.get(ride.passenger_id);
      if (!passenger?.stripe_customer_id) {
        return Response.json({
          error: "El pasajero no tiene una tarjeta vinculada",
          reason: "no_card",
        }, { status: 400 });
      }

      // Retrieve the passenger's saved payment method
      const pmRes = await fetch(
        `https://api.stripe.com/v1/payment_methods?customer=${passenger.stripe_customer_id}&type=card`,
        {
          headers: {
            "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
            "Stripe-Version": "2025-10-29.clover",
          },
        }
      );
      if (!pmRes.ok) {
        const err = await pmRes.json();
        console.error("Stripe error listing PMs:", JSON.stringify(err));
        return Response.json({ error: err.error?.message }, { status: 500 });
      }
      const paymentMethods = await pmRes.json();
      if (!paymentMethods.data || paymentMethods.data.length === 0) {
        return Response.json({
          error: "El pasajero no tiene una tarjeta vinculada",
          reason: "no_card",
        }, { status: 400 });
      }
      const pmId = paymentMethods.data[0].id;

      // Create + confirm PaymentIntent (off-session)
      const amountInCents = Math.round(fare * 100);
      const piParams = new URLSearchParams();
      piParams.append("amount", String(amountInCents));
      piParams.append("currency", "ars");
      piParams.append("customer", passenger.stripe_customer_id);
      piParams.append("payment_method", pmId);
      piParams.append("off_session", "true");
      piParams.append("confirm", "true");
      piParams.append("metadata[ride_id]", ride_id);
      piParams.append("metadata[base44_app_id]", secrets.get("BASE44_APP_ID") || "");

      const piRes = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
          "Stripe-Version": "2025-10-29.clover",
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: piParams,
      });

      if (!piRes.ok) {
        const err = await piRes.json();
        console.error("Stripe charge error:", JSON.stringify(err));
        return Response.json({
          error: err.error?.message || "Error al cobrar la tarjeta",
          reason: "charge_failed",
        }, { status: 500 });
      }

      const pi = await piRes.json();

      if (pi.status === "succeeded") {
        const updated = await base44.asServiceRole.entities.Ride.update(ride_id, {
          status: "COMPLETED",
          final_fare: fare,
          completed_date: completedDate,
          stripe_payment_intent_id: pi.id,
        });
        await finalizeRideCompletion(base44, ride_id, completedDate);
        return Response.json({ ride: updated, payment_status: "completed" });
      }

      // Charge requires 3DS or pending — ride stays PAYMENT_PENDING
      await base44.asServiceRole.entities.Ride.update(ride_id, {
        stripe_payment_intent_id: pi.id,
      });
      return Response.json({
        payment_status: "requires_action",
        message: "El pago requiere autenticación. El pasajero debe completarlo manualmente.",
      });
    }

    // --- QR: create Checkout Session for passenger to pay ---
    if (ride.payment_method === "qr") {
      const origin = new URL(req.url).origin;
      const amountInCents = Math.round(fare * 100);

      const params = new URLSearchParams();
      params.append("mode", "payment");
      params.append("success_url", `${origin}/passenger?payment=success&ride=${ride_id}`);
      params.append("cancel_url", `${origin}/passenger?payment=cancelled&ride=${ride_id}`);
      params.append("line_items[0][quantity]", "1");
      params.append("line_items[0][price_data][currency]", "ars");
      params.append("line_items[0][price_data][unit_amount]", String(amountInCents));
      params.append("line_items[0][price_data][product_data][name]", "Viaje BearDrive");
      params.append("line_items[0][price_data][product_data][description]", `${ride.origin_address || ""} → ${ride.destination_address || ""}`);
      params.append("metadata[ride_id]", ride_id);
      params.append("metadata[base44_app_id]", secrets.get("BASE44_APP_ID") || "");
      params.append("payment_intent_data[metadata][ride_id]", ride_id);
      params.append("payment_intent_data[metadata][base44_app_id]", secrets.get("BASE44_APP_ID") || "");

      const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
          "Stripe-Version": "2025-10-29.clover",
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: params,
      });

      if (!sessionRes.ok) {
        const err = await sessionRes.json();
        console.error("Stripe error creating QR session:", JSON.stringify(err));
        return Response.json({ error: err.error?.message }, { status: 500 });
      }

      const session = await sessionRes.json();
      await base44.asServiceRole.entities.Ride.update(ride_id, {
        stripe_session_id: session.id,
      });

      return Response.json({
        payment_status: "qr_pending",
        checkout_url: session.url,
        session_id: session.id,
      });
    }

    return Response.json({ error: "Método de pago no soportado" }, { status: 400 });
  } catch (error) {
    console.error("completeRide error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}