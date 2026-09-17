import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// Stripe webhook handler — confirms ride completion when payments succeed.
// Handles two event types:
// - checkout.session.completed: QR payments (passenger paid via Checkout URL)
// - payment_intent.succeeded: card auto-charges (off-session PaymentIntent)
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

    const object = event.data?.object;
    const rideId = object?.metadata?.ride_id;
    if (rideId) {
      const existing = await base44.asServiceRole.entities.SupportCase.filter({ description: `Pago Stripe pendiente de conciliación: ${event.id}` });
      if (!existing.length) {
        const ride = await base44.asServiceRole.entities.Ride.get(rideId);
        await base44.asServiceRole.entities.SupportCase.create({ user_id: ride.passenger_id, ride_id: rideId, category: 'payment', status: 'open', description: `Pago Stripe pendiente de conciliación: ${event.id}` });
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

    if (!Number.isFinite(Number(timestamp)) || Math.abs(Date.now() - Number(timestamp) * 1000) > 300000) return false;
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