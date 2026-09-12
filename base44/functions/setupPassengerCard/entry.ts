import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// Creates a Stripe Checkout Session in "setup" mode so the passenger can
// link a card. The card is saved on a Stripe Customer created for this user.
// The passenger redirects to Stripe, saves their card, and returns to the app.
// The card can then be charged automatically when rides complete (off-session).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const origin = new URL(req.url).origin;

    // Create or retrieve Stripe Customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customerParams = new URLSearchParams();
      customerParams.append("email", user.email || "");
      customerParams.append("name", user.full_name || "");
      customerParams.append("metadata[user_id]", user.id);
      customerParams.append("metadata[base44_app_id]", secrets.get("BASE44_APP_ID") || "");

      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
          "Stripe-Version": "2025-10-29.clover",
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: customerParams,
      });

      if (!customerRes.ok) {
        const err = await customerRes.json();
        console.error("Stripe error creating customer:", JSON.stringify(err));
        return Response.json({ error: err.error?.message || "Error al crear cliente" }, { status: 500 });
      }

      const customer = await customerRes.json();
      customerId = customer.id;
      await base44.asServiceRole.entities.User.update(user.id, { stripe_customer_id: customerId });
    }

    // Create SetupIntent via Checkout Session (setup mode)
    const params = new URLSearchParams();
    params.append("mode", "setup");
    params.append("customer", customerId);
    params.append("success_url", `${origin}/passenger?card_setup=success`);
    params.append("cancel_url", `${origin}/passenger?card_setup=cancelled`);
    params.append("metadata[user_id]", user.id);
    params.append("metadata[base44_app_id]", secrets.get("BASE44_APP_ID") || "");
    params.append("payment_method_types[0]", "card");

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
      console.error("Stripe error creating setup session:", JSON.stringify(err));
      return Response.json({ error: err.error?.message || "Error al crear sesión" }, { status: 500 });
    }

    const session = await sessionRes.json();
    return Response.json({ checkout_url: session.url, session_id: session.id });
  } catch (error) {
    console.error("setupPassengerCard error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}