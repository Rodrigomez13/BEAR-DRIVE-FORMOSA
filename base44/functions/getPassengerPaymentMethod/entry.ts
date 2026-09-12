import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// Returns the passenger's saved card info (brand, last4, expiry) from Stripe.
// Used by the frontend to display the linked card and determine if auto-charge
// is available. Returns { has_card: false } if no card is saved.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!user.stripe_customer_id) {
      return Response.json({ has_card: false });
    }

    const pmRes = await fetch(
      `https://api.stripe.com/v1/payment_methods?customer=${user.stripe_customer_id}&type=card`,
      {
        headers: {
          "Authorization": `Bearer ${secrets.get("STRIPE_SECRET_KEY")}`,
          "Stripe-Version": "2025-10-29.clover",
        },
      }
    );

    if (!pmRes.ok) {
      const err = await pmRes.json();
      console.error("Stripe error listing payment methods:", JSON.stringify(err));
      return Response.json({ error: err.error?.message }, { status: 500 });
    }

    const paymentMethods = await pmRes.json();
    if (!paymentMethods.data || paymentMethods.data.length === 0) {
      return Response.json({ has_card: false });
    }

    const pm = paymentMethods.data[0];
    return Response.json({
      has_card: true,
      brand: pm.card?.brand || "card",
      last4: pm.card?.last4 || "",
      exp_month: pm.card?.exp_month || 0,
      exp_year: pm.card?.exp_year || 0,
      payment_method_id: pm.id,
    });
  } catch (error) {
    console.error("getPassengerPaymentMethod error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}