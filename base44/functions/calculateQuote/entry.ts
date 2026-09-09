import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { estimateRoadDistanceKm, estimateDurationMin, computeFare } from '../../shared/pricing.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { origin_lat, origin_lng, destination_lat, destination_lng, category } = body;

    if (
      typeof origin_lat !== "number" || typeof origin_lng !== "number" ||
      typeof destination_lat !== "number" || typeof destination_lng !== "number"
    ) {
      return Response.json({ error: "Coordenadas de origen y destino son obligatorias" }, { status: 400 });
    }

    const cat = ["basic", "flash", "premium"].includes(category) ? category : "basic";

    // Read active pricing config (service role — pricing is platform config)
    const configs = await base44.asServiceRole.entities.PricingConfig.filter({ active: true });
    const pricing = configs[0] || { base_fare: 300, per_km: 120, per_min: 40, min_fare: 500, flash_supplement: 200, premium_multiplier: 1.5, currency: "ARS" };

    const distanceKm = estimateRoadDistanceKm(origin_lat, origin_lng, destination_lat, destination_lng);
    const durationMin = estimateDurationMin(distanceKm);
    const fare = computeFare(distanceKm, durationMin, cat, pricing);

    const quote = {
      quote_id: "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      price: fare,
      currency: pricing.currency || "ARS",
      distance_km: Math.round(distanceKm * 10) / 10,
      duration_min: durationMin,
      category: cat,
      provider: "internal_haversine_v1",
      ttl_seconds: 300,
      breakdown: {
        base: pricing.base_fare,
        distance: Math.round(distanceKm * pricing.per_km),
        time: Math.round(durationMin * pricing.per_min),
        category_adjustment: fare - (pricing.base_fare + distanceKm * pricing.per_km + durationMin * pricing.per_min)
      },
      pricing_snapshot: {
        base_fare: pricing.base_fare,
        per_km: pricing.per_km,
        per_min: pricing.per_min,
        min_fare: pricing.min_fare
      },
      origin: { lat: origin_lat, lng: origin_lng },
      destination: { lat: destination_lat, lng: destination_lng },
      created_at: new Date().toISOString()
    };

    return Response.json({ quote });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}