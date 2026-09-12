import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// Retrieves the checkout URL for a ride with a pending QR payment.
// For Mercado Pago rides, the URL is stored directly on the ride
// (payment_checkout_url) when the preference was created.
// For legacy Stripe rides, retrieves it from the Stripe Checkout Session.
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
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    // Mercado Pago — URL stored on the ride
    if (ride.payment_checkout_url) {
      return Response.json({ checkout_url: ride.payment_checkout_url });
    }

    // Legacy Stripe rides — retrieve from session
    if (ride.stripe_session_id) {
      const sessionRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${ride.stripe_session_id}`,
        {
          headers: {
            "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
            "Stripe-Version": "2025-10-29.clover",
          },
        }
      );

      if (!sessionRes.ok) {
        const err = await sessionRes.json();
        console.error("Stripe error retrieving session:", JSON.stringify(err));
        return Response.json({ error: err.error?.message }, { status: 500 });
      }

      const session = await sessionRes.json();
      return Response.json({ checkout_url: session.url });
    }

    return Response.json({ error: "No hay sesión de pago generada" }, { status: 400 });
  } catch (error) {
    console.error("getRidePaymentUrl error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}