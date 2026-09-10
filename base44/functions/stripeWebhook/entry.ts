import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { todayBusinessDay } from '../../shared/pricing.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const signature = req.headers.get("stripe-signature");
    const rawBody = await req.text();

    if (!signature) {
      return Response.json({ error: "Firma de Stripe ausente" }, { status: 400 });
    }

    const webhookSecret = secrets.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET no configurado");
      return Response.json({ error: "Webhook no configurado" }, { status: 500 });
    }

    const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error("Stripe signature verification failed");
      return Response.json({ error: "Firma inválida" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const rideId = session.metadata?.ride_id;

      if (!rideId) {
        console.error("Webhook: ride_id ausente en metadata");
        return Response.json({ received: true, warning: "no_ride_id" });
      }

      const ride = await base44.asServiceRole.entities.Ride.get(rideId);
      if (!ride) {
        console.error("Webhook: viaje no encontrado:", rideId);
        return Response.json({ received: true, warning: "ride_not_found" });
      }

      if (ride.status === "COMPLETED") {
        return Response.json({ received: true, already_completed: true });
      }

      const fare = ride.final_fare || ride.quoted_fare;
      const completedDate = new Date().toISOString();

      // Mark ride COMPLETED
      await base44.asServiceRole.entities.Ride.update(rideId, {
        status: "COMPLETED",
        final_fare: fare,
        completed_date: completedDate
      });

      // Award BearPoints to passenger (10 points per completed ride)
      const pointsAward = 10;
      await base44.asServiceRole.entities.BearPointsLedger.create({
        user_id: ride.passenger_id,
        points: pointsAward,
        reason: "ride_completed",
        ride_id: rideId,
        balance_after: pointsAward
      });

      const passenger = await base44.asServiceRole.entities.User.get(ride.passenger_id);
      if (passenger) {
        await base44.asServiceRole.entities.User.update(ride.passenger_id, {
          bearpoints_balance: (passenger.bearpoints_balance || 0) + pointsAward,
          total_rides: (passenger.total_rides || 0) + 1
        });
      }

      // Driver daily charge — only on first completed ride of the business day
      const businessDay = todayBusinessDay(completedDate);
      const existingCharges = await base44.asServiceRole.entities.DriverDailyCharge.filter({
        driver_id: ride.driver_id,
        business_day: businessDay
      });
      if (existingCharges.length === 0 && ride.driver_id) {
        const chargeConfigs = await base44.asServiceRole.entities.DailyChargeConfig.filter({ active: true });
        const chargeConfig = chargeConfigs[0] || { amount: 1500, currency: "ARS" };
        await base44.asServiceRole.entities.DriverDailyCharge.create({
          driver_id: ride.driver_id,
          driver_name: ride.driver_name || "",
          business_day: businessDay,
          amount: chargeConfig.amount,
          currency: chargeConfig.currency || "ARS",
          status: "pending",
          total_due: chargeConfig.amount,
          trigger_ride_id: rideId
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("stripeWebhook error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function verifyStripeSignature(rawBody, signature, webhookSecret) {
  try {
    const parts = signature.split(",");
    const timestampPart = parts.find(p => p.startsWith("t="));
    const signaturePart = parts.find(p => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) return false;

    const timestamp = timestampPart.split("=")[1];
    const expectedSig = signaturePart.split("=")[1];

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signedPayload = `${timestamp}.${rawBody}`;
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const computedSig = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return computedSig === expectedSig;
  } catch (err) {
    console.error("verifyStripeSignature error:", err.message);
    return false;
  }
}